DELETE FROM pairing_codes WHERE kind = 'agent';
DROP INDEX IF EXISTS idx_tokens_sync_key;
DROP TABLE IF EXISTS tokens;
