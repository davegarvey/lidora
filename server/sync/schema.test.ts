import { describe, expect, it } from 'vitest';
import { ensureSchemaOnce } from './schema';

function fakeDb(failBatches = 0) {
  const calls = { batch: 0, run: 0 };
  let remaining = failBatches;
  const statement = { run: async () => { calls.run += 1; return {}; } };
  const db = {
    prepare: () => statement,
    batch: async () => {
      calls.batch += 1;
      if (remaining > 0) {
        remaining -= 1;
        throw new Error('d1 unavailable');
      }
      return [];
    },
  } as unknown as D1Database;
  return { db, calls };
}

describe('ensureSchemaOnce', () => {
  it('runs the schema statements once per database across concurrent and later callers', async () => {
    const { db, calls } = fakeDb();
    await Promise.all([ensureSchemaOnce(db), ensureSchemaOnce(db), ensureSchemaOnce(db)]);
    await ensureSchemaOnce(db);
    expect(calls.batch).toBe(1);
    const runs = calls.run;
    await ensureSchemaOnce(db);
    expect(calls.run).toBe(runs);
  });

  it('checks each database separately', async () => {
    const a = fakeDb();
    const b = fakeDb();
    await ensureSchemaOnce(a.db);
    await ensureSchemaOnce(b.db);
    expect(a.calls.batch).toBe(1);
    expect(b.calls.batch).toBe(1);
  });

  it('retries after a failed check', async () => {
    const { db, calls } = fakeDb(1);
    await expect(ensureSchemaOnce(db)).rejects.toThrow('d1 unavailable');
    await ensureSchemaOnce(db);
    await ensureSchemaOnce(db);
    expect(calls.batch).toBe(2);
  });
});
