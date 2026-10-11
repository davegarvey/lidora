import { createApp } from '../server/handle';

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  DOCUMENTS?: string;
}

export default {
  fetch(request: Request, env: Env) {
    const documents = JSON.parse(env.DOCUMENTS ?? '{}') as Record<string, unknown>;
    return createApp({
      db: env.DB,
      oauthSecret: env.BETTER_AUTH_SECRET,
      oauthMetadataFetch: async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return documents[url] ? Response.json(documents[url]) : new Response(null, { status: 404 });
      },
    }).fetch(request);
  },
};
