import {
  ProtocolError,
  ProtocolErrorCode,
  Server,
  WebStandardStreamableHTTPServerTransport,
  createMcpHandler,
  fromJsonSchema,
  isLegacyRequest,
  type AuthInfo,
  type CallToolResult,
} from '@modelcontextprotocol/server';
import { Hono, type Context } from 'hono';
import pkg from '../../../package.json';
import { assertNoKeyLog } from '../../log';
import { authenticateToken, hasScope, type TokenAuth } from '../../sync/auth';
import { RATE_LIMITS, checkRateLimit } from '../../sync/ratelimit';
import { ensureSchema } from '../../sync/schema';
import { publicOrigin } from '../origin';
import { discoverTools } from './discover';
import { readTools } from './read-tools';
import { ToolError, type ToolContext, type ToolDefinition } from './types';
import { writeTools } from './write-tools';

export interface McpRoutesOptions {
  db: D1Database;
  pollDb?: D1Database;
  publicUrl?: string;
}

const MAX_BODY_BYTES = 256 * 1024;

const TOOLS: ToolDefinition[] = [...readTools, ...discoverTools, ...writeTools];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
};

function instructions(hasContent: boolean): string {
  const lines = [
    'Sift is a personal RSS reader. These tools read and manage the user\'s subscriptions, reading statistics and (where available) recent articles.',
    '',
    'Identifiers:',
    '- A feed is identified by feedId, an opaque string from list_subscriptions. Never use a feed URL as an identifier.',
    '- An item is identified by <feedId>::<guid>, as returned in the id field of list_items. Pass it back unchanged.',
    '- Feed URLs in results have credentials removed and may show REDACTED values.',
    '',
    'Workflows:',
    '- Recommend feeds: call list_subscriptions with sort "engagement" to see what the user reads most, then suggest similar feeds and verify every suggestion with discover_feeds before proposing or subscribing to it.',
    '- Find a person\'s or organisation\'s blog: call discover_feeds with their website URL. It reports the feeds it finds and whether the user already subscribes.',
  ];
  if (hasContent) {
    lines.push(
      '- Summarise recent reading: call get_reading_stats or list_subscriptions to choose feeds, then list_items (use feedIds and since), then get_item for the articles worth reading in full.',
      '- Article content covers only the last seven days of items.',
    );
  } else {
    lines.push(
      '- Summarise reading: use get_reading_stats or list_subscriptions. Article content is unavailable on this deployment, so list_items and get_item are not offered.',
    );
  }
  lines.push(
    '- Subscribe, tag, rename or unsubscribe only when the user asks. Confirm before unsubscribing. Write tools are offered only when the connection has write access.',
  );
  return lines.join('\n');
}

const REQUEST_TOO_LARGE = { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large.' } };

function toolErrorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const inputValidators = new Map(TOOLS.map((tool) => [tool.name, fromJsonSchema(tool.inputSchema as Record<string, unknown>)]));

async function checkArguments(tool: ToolDefinition, args: unknown): Promise<string[]> {
  const validator = inputValidators.get(tool.name);
  if (!validator) return ['no schema'];
  const result = await validator['~standard'].validate(args);
  return result.issues ? result.issues.map((issue) => issue.message) : [];
}

function authFrom(info: AuthInfo | undefined): TokenAuth | null {
  const auth = info?.extra?.auth;
  return typeof auth === 'object' && auth !== null ? (auth as TokenAuth) : null;
}

export function createMcpRoutes(options: McpRoutesOptions): Hono {
  const { db, pollDb, publicUrl } = options;
  const app = new Hono();
  const hasContent = pollDb !== undefined;
  let schemaReady: Promise<void> | null = null;

  function availableTools(scopes: ToolContext['scopes']): ToolDefinition[] {
    return TOOLS.filter((tool) => hasScope(scopes, tool.scope) && (!tool.needsPoll || hasContent));
  }

  function unauthorised(c: Context, connectionId?: string): Response {
    const suffix = connectionId === undefined ? '' : `/mcp/c/${encodeURIComponent(connectionId)}`;
    const metadata = `${publicOrigin(c.req.url, publicUrl)}/.well-known/oauth-protected-resource${suffix}`;
    return c.text('Unauthorized', 401, {
      ...CORS_HEADERS,
      'WWW-Authenticate': `Bearer resource_metadata="${metadata}"`,
      'Cache-Control': 'no-store',
    });
  }

  async function callTool(ctx: ToolContext, name: string, args: unknown): Promise<CallToolResult> {
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool || (tool.needsPoll && !hasContent)) throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool.');
    if (!hasScope(ctx.scopes, tool.scope)) {
      return toolErrorResult(`insufficient_scope: this tool requires the ${tool.scope} scope, which this connection does not have.`);
    }
    const limit = await checkRateLimit(db, `mcp:tok:${ctx.tokenId}`, RATE_LIMITS.mcp.windowSeconds, RATE_LIMITS.mcp.limit);
    if (!limit.ok) return toolErrorResult(`Rate limit reached. Retry in ${limit.retryAfter} seconds.`);
    const input = args ?? {};
    const errors = await checkArguments(tool, input);
    if (errors.length > 0) return toolErrorResult(`Invalid arguments: ${errors.slice(0, 5).join('; ')}`);
    try {
      const output = await tool.run(ctx, input as Record<string, unknown>);
      return { content: [{ type: 'text', text: output.text }], structuredContent: output.data };
    } catch (error) {
      return toolErrorResult(error instanceof ToolError ? error.message : 'The tool failed unexpectedly. Try again.');
    }
  }

  function createServer(auth: TokenAuth): Server {
    const ctx: ToolContext = { db, pollDb, syncKey: auth.syncKey, tokenId: auth.tokenId, scopes: auth.scopes };
    const server = new Server(
      { name: 'sift', title: 'Sift', version: pkg.version },
      { capabilities: { tools: { listChanged: false } }, instructions: instructions(hasContent) },
    );
    server.setRequestHandler('tools/list', () => ({
      tools: availableTools(ctx.scopes).map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as { type: 'object' },
        outputSchema: tool.outputSchema as { type: 'object' },
        annotations: { title: tool.title, ...tool.annotations },
      })),
    }));
    server.setRequestHandler('tools/call', (request) => callTool(ctx, request.params.name, request.params.arguments));
    return server;
  }

  const mcp = createMcpHandler(
    (context) => {
      const auth = authFrom(context.authInfo);
      if (!auth) throw new Error('Unauthenticated MCP request.');
      return createServer(auth);
    },
    { legacy: 'reject', responseMode: 'json', maxRequestBodySize: MAX_BODY_BYTES },
  );

  async function serveLegacy(request: Request, auth: TokenAuth, authInfo: AuthInfo): Promise<Response> {
    const server = createServer(auth);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { authInfo });
    } finally {
      await server.close();
    }
  }

  async function handle(c: Context, connectionId?: string): Promise<Response> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('Authorization') ?? '');
    if (!bearer) return unauthorised(c, connectionId);
    if (!schemaReady) schemaReady = ensureSchema(db);
    await schemaReady;
    const auth = await authenticateToken(db, bearer[1]);
    if (!auth) {
      assertNoKeyLog(bearer[1]);
      return unauthorised(c, connectionId);
    }

    const declared = Number(c.req.header('Content-Length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return c.json(REQUEST_TOO_LARGE, 413, CORS_HEADERS);
    const raw = await c.req.text();
    if (raw.length > MAX_BODY_BYTES) return c.json(REQUEST_TOO_LARGE, 413, CORS_HEADERS);
    const request = new Request(c.req.url, { method: 'POST', headers: c.req.raw.headers, body: raw });

    const authInfo: AuthInfo = { token: bearer[1], clientId: auth.tokenId, scopes: auth.scopes, extra: { auth } };
    const response = (await isLegacyRequest(request))
      ? await serveLegacy(request, auth, authInfo)
      : await mcp.fetch(request, { authInfo });
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries({ ...CORS_HEADERS, 'Cache-Control': 'no-store' })) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const methodNotAllowed = (c: Context) =>
    c.text('Method Not Allowed', 405, { ...CORS_HEADERS, Allow: 'POST, OPTIONS' });
  const preflight = (c: Context) => new Response(null, { status: 204, headers: CORS_HEADERS });

  app.options('/mcp', preflight);
  app.options('/mcp/c/:id', preflight);
  app.post('/mcp', (c) => handle(c));
  app.post('/mcp/c/:id', (c) => handle(c, c.req.param('id')));
  app.all('/mcp', methodNotAllowed);
  app.all('/mcp/c/:id', methodNotAllowed);

  return app;
}
