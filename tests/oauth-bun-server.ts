import { createApp } from '../server/handle';
import { openBunSqlite } from '../server/bun-sqlite';
import { createSelfHostedDatabases } from '../server/sqlite-d1';

const databases = await createSelfHostedDatabases(process.env.SIFT_DATA_DIR!, openBunSqlite);
const documents = JSON.parse(process.env.DOCUMENTS ?? '{}') as Record<string, unknown>;
const app = createApp({
  db: databases.sync as unknown as D1Database,
  oauthSecret: 'oauth-integration-test-secret-01234567890123456789',
  publicUrl: 'http://localhost',
  oauthMetadataFetch: async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return documents[url] ? Response.json(documents[url]) : new Response(null, { status: 404 });
  },
});
export default { port: Number(process.env.PORT), fetch: app.fetch };
