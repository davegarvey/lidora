import type { Hono, MiddlewareHandler } from 'hono';
import { APP_SHELL_PAGES } from './navigation-routes';

export function mountAppShellPages(app: Hono, shell: MiddlewareHandler): void {
  for (const path of APP_SHELL_PAGES) app.get(path, shell);
}
