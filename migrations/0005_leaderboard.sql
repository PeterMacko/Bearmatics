-- SCRUM-148: leaderboard. One on/off value per account (on by default); nothing else stored.
ALTER TABLE accounts ADD COLUMN leaderboard INTEGER NOT NULL DEFAULT 1 CHECK (leaderboard IN (0, 1));

UPDATE app_meta SET value = '5' WHERE key = 'schema_version';
