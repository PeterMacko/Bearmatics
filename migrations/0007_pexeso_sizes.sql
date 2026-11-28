-- SCRUM-324: Pexeso (Logic 6-8) saves its pair count as the lesson size, so lessons also take
-- sizes 6 and 15 (5, 10, 20 as before). SQLite cannot change a CHECK constraint in place: the
-- short-lived lessons table (rows are deleted 2 days after the start) is copied into a new
-- table with the wider check and renamed. Older app versions keep working (they only use
-- 5 / 10 / 20). No other table points at lessons.
CREATE TABLE lessons_0007 (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  size INTEGER NOT NULL CHECK (size IN (5, 6, 10, 15, 20)),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  claim TEXT
);
INSERT INTO lessons_0007 (id, account_id, size, started_at, finished_at, claim)
  SELECT id, account_id, size, started_at, finished_at, claim FROM lessons;
DROP TABLE lessons;
ALTER TABLE lessons_0007 RENAME TO lessons;
CREATE INDEX IF NOT EXISTS lessons_account ON lessons (account_id);
CREATE INDEX IF NOT EXISTS lessons_started ON lessons (started_at);

UPDATE app_meta SET value = '7' WHERE key = 'schema_version';
