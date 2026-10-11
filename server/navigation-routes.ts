export const SERVER_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/(?:about|privacy|terms)(?:\.html)?\/?$/,
  /^\/oauth\//,
  /^\/\.well-known\//,
  /^\/mcp(?:\/|$)/,
  /^\/sync\//,
  /^\/llms\.txt$/,
  /^\/openapi\.json$/,
];

export const FETCH_ONLY_ROUTES = ['/feed', '/article', '/img'];

export const APP_SHELL_ROUTES = ['/', '/connect'];

export const WORKER_FIRST_ROUTES = ['/oauth/*', '/.well-known/*', '/mcp', '/mcp/*', '/sync/*'];
