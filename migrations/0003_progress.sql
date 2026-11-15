-- SCRUM-117: points for signed-in players. One point total per account (courses are not
-- distinguished) and the IDs of recent lessons, only so that one lesson never counts twice.
-- Lesson rows are deleted 2 days after the start. Both tables go with the account.
CREATE TABLE IF NOT EXISTS progress (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  size INTEGER NOT NULL CHECK (size IN (5, 10, 20)),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  claim TEXT
);
CREATE INDEX IF NOT EXISTS lessons_account ON lessons (account_id);
CREATE INDEX IF NOT EXISTS lessons_started ON lessons (started_at);

UPDATE app_meta SET value = '3' WHERE key = 'schema_version';
