-- SCRUM-97: optional accounts. Stores only what the approved scope lists.
-- Password accounts: username, server salt + verifier of the browser-derived key, optional email.
-- Google accounts: only the Google account ID (sub). Every account: nickname, bear icon,
-- time of the parent confirmation. No real names, no Google email/name/photo.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT,
  username_key TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  server_salt TEXT,
  verifier TEXT,
  email TEXT,
  nickname TEXT NOT NULL,
  bear INTEGER NOT NULL,
  parent_confirmed_at INTEGER NOT NULL,
  CHECK ((username_key IS NOT NULL) <> (google_sub IS NOT NULL))
);

-- Login sessions: only a SHA-256 of the random cookie token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);

-- Wrong-password limit. Keyed by a SHA-256 of the lower-case username, so unknown and existing
-- usernames behave the same. Rows are deleted after a day.
CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY NOT NULL,
  failures INTEGER NOT NULL,
  locked_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- First Google sign-in waits here (max 15 minutes) until the child picks nickname and bear.
CREATE TABLE IF NOT EXISTS google_pending (
  token_hash TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

UPDATE app_meta SET value = '2' WHERE key = 'schema_version';
