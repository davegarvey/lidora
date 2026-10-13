ALTER TABLE polled_feeds ADD COLUMN redirect_url TEXT;
ALTER TABLE polled_feeds ADD COLUMN redirect_observations INTEGER NOT NULL DEFAULT 0;
