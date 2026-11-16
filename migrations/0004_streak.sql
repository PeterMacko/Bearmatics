-- SCRUM-118: daily streak for signed-in players, in the SCRUM-117 progress row.
-- streak: days in a row with a finished lesson; last_day: last such day ('YYYY-MM-DD',
-- Slovak time); offer_day: day of an unlock offer not answered yet (after midnight it counts
-- as "No thanks"). Nothing else.
ALTER TABLE progress ADD COLUMN streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0);
ALTER TABLE progress ADD COLUMN last_day TEXT;
ALTER TABLE progress ADD COLUMN offer_day TEXT;

UPDATE app_meta SET value = '4' WHERE key = 'schema_version';
