-- SCRUM-96: database foundation. Holds no user data.
-- Records the schema version so /api/health can confirm migrations were applied.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '1');
