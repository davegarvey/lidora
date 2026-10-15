export const SERVER_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/(?:about|privacy|terms)(?:\.html)?\/?$/,
  /^\/oauth\//,
  /^\/\.well-known\//,
  /^\/mcp(?:\/|$)/,
  /^\/sync\//,
  /^\/llms\.txt$/,
  /^\/migrate\.html$/,
  /^\/openapi\.json$/,
];

export const FETCH_ONLY_ROUTES = ['/feed', '/article', '/img'];

export const APP_SHELL_PAGES = ['/stats', '/settings', '/settings/*'];

export const APP_SHELL_ROUTES = ['/', '/connect', ...APP_SHELL_PAGES];

export const WORKER_FIRST_ROUTES = ['/feed', '/article', '/img', '/oauth/*', '/.well-known/*', '/mcp', '/mcp/*', '/sync/*'];
