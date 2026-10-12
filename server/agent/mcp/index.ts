import type { OAuthAuthenticator } from '../oauth/authenticate';
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
import { hasScope, type TokenAuth } from '../../sync/auth';
import { RATE_LIMITS, checkRateLimit } from '../../sync/ratelimit';
import { ensureSchema } from '../../sync/schema';
import { publicOrigin } from '../origin';
import { discoverTools } from './discover';
import { readTools } from './read-tools';
import { describeIssue } from './schema';
import { ToolError, type ToolContext, type ToolDefinition } from './types';
import { writeTools } from './write-tools';

export interface McpRoutesOptions {
  db: D1Database;
  pollDb?: D1Database;
  publicUrl?: string;
  oauth?: OAuthAuthenticator;
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

async function checkArguments(tool: ToolDefinition, args: unknown): Promise<string | null> {
  const validator = inputValidators.get(tool.name);
  if (!validator) return 'arguments could not be checked';
  const result = await validator['~standard'].validate(args);
  return result.issues ? describeIssue(tool.inputSchema, result.issues.map((issue) => issue.message)) : null;
}

interface Deps {
  db: D1Database;
  pollDb?: D1Database;
}

interface McpExtra {
  auth: TokenAuth;
  deps: Deps;
}

function availableTools(deps: Deps, scopes: ToolContext['scopes']): ToolDefinition[] {
  return TOOLS.filter((tool) => hasScope(scopes, tool.scope) && (!tool.needsPoll || deps.pollDb !== undefined));
}

async function callTool(deps: Deps, ctx: ToolContext, name: string, args: unknown): Promise<CallToolResult> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool || (tool.needsPoll && deps.pollDb === undefined)) throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool.');
  if (!hasScope(ctx.scopes, tool.scope)) {
    return toolErrorResult(`insufficient_scope: this tool requires the ${tool.scope} scope, which this connection does not have.`);
  }
  const limit = await checkRateLimit(deps.db, `mcp:tok:${ctx.tokenId}`, RATE_LIMITS.mcp.windowSeconds, RATE_LIMITS.mcp.limit);
  if (!limit.ok) return toolErrorResult(`Rate limit reached. Retry in ${limit.retryAfter} seconds.`);
  const input = args ?? {};
  const problem = await checkArguments(tool, input);
  if (problem) return toolErrorResult(`Invalid arguments: ${problem}.`);
  try {
    const output = await tool.run(ctx, input as Record<string, unknown>);
    return { content: [{ type: 'text', text: output.text }], structuredContent: output.data };
  } catch (error) {
    return toolErrorResult(error instanceof ToolError ? error.message : 'The tool failed unexpectedly. Try again.');
  }
}

function createServer(extra: McpExtra): Server {
  const { auth, deps } = extra;
  const ctx: ToolContext = { db: deps.db, pollDb: deps.pollDb, syncKey: auth.syncKey, tokenId: auth.tokenId, scopes: auth.scopes };
  const server = new Server(
    { name: 'sift', title: 'Sift', version: pkg.version },
    { capabilities: { tools: { listChanged: false } }, instructions: instructions(deps.pollDb !== undefined) },
  );
  server.setRequestHandler('tools/list', () => ({
    tools: availableTools(deps, ctx.scopes).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema as { type: 'object' },
      outputSchema: tool.outputSchema as { type: 'object' },
      annotations: { title: tool.title, ...tool.annotations },
    })),
  }));
  server.setRequestHandler('tools/call', (request) => callTool(deps, ctx, request.params.name, request.params.arguments));
  return server;
}

function extraFrom(info: AuthInfo | undefined): McpExtra {
  const extra = info?.extra as McpExtra | undefined;
  if (!extra?.auth || !extra.deps) throw new Error('Unauthenticated MCP request.');
  return extra;
}

let sdkHandler: ReturnType<typeof createMcpHandler> | undefined;

function modernHandler() {
  sdkHandler ??= createMcpHandler((context) => createServer(extraFrom(context.authInfo)), {
    legacy: 'reject',
    responseMode: 'json',
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  return sdkHandler;
}

async function serveLegacy(request: Request, authInfo: AuthInfo): Promise<Response> {
  const server = createServer(extraFrom(authInfo));
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, { authInfo });
  } finally {
    await server.close();
  }
}

function withStreamableHeaders(source: Headers, hasBody: boolean): Headers {
  const headers = new Headers(source);
  const accept = headers.get('accept') ?? '';
  const missing = ['application/json', 'text/event-stream'].filter((type) => !accept.includes(type));
  if (missing.length > 0) headers.set('accept', [accept, ...missing].filter(Boolean).join(', '));
  if (hasBody && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return headers;
}

export function createMcpRoutes(options: McpRoutesOptions): Hono {
  const { db, pollDb, publicUrl } = options;
  const app = new Hono();
  const deps: Deps = { db, pollDb };
  let schemaReady: Promise<void> | null = null;

  function unauthorised(c: Context, connectionId?: string): Response {
    const suffix = connectionId === undefined ? '' : `/mcp/c/${encodeURIComponent(connectionId)}`;
    const metadata = `${publicOrigin(c.req.url, publicUrl)}/.well-known/oauth-protected-resource${suffix}`;
    return c.text('Unauthorized', 401, {
      ...CORS_HEADERS,
      'WWW-Authenticate': `Bearer resource_metadata="${metadata}"`,
      'Cache-Control': 'no-store',
    });
  }

  async function handle(c: Context, connectionId?: string): Promise<Response> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('Authorization') ?? '');
    if (!bearer) return unauthorised(c, connectionId);
    if (!schemaReady) schemaReady = ensureSchema(db);
    await schemaReady;
    const auth = await options.oauth?.(bearer[1], c.req.url);
    if (!auth) {
      assertNoKeyLog(bearer[1]);
      return unauthorised(c, connectionId);
    }

    const declared = Number(c.req.header('Content-Length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return c.json(REQUEST_TOO_LARGE, 413, CORS_HEADERS);
    const raw = await c.req.text();
    if (raw.length > MAX_BODY_BYTES) return c.json(REQUEST_TOO_LARGE, 413, CORS_HEADERS);
    const request = new Request(c.req.url, { method: 'POST', headers: withStreamableHeaders(c.req.raw.headers, raw !== ''), body: raw });

    const extra: McpExtra = { auth, deps };
    const authInfo: AuthInfo = { token: bearer[1], clientId: auth.tokenId, scopes: auth.scopes, extra: { ...extra } };
    const response = (await isLegacyRequest(request))
      ? await serveLegacy(request, authInfo)
      : await modernHandler().fetch(request, { authInfo });
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
