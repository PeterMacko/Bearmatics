-- SCRUM-249: the profile bear is dressed from five parts instead of one of 8 bears.
-- Additive only: the old `bear` column stays (older app versions in previews still read and
-- write it; new code also keeps it filled with the closest old bear).
-- Parts are indexes into the lists in shared/bearLook.ts:
--   fur 0-7, background 0-7, head 0-5, neck 0-5, eyes 0-3 (0 = none for head, neck and eyes).
ALTER TABLE accounts ADD COLUMN bear_fur INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN bear_bg INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN bear_head INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN bear_neck INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN bear_eyes INTEGER NOT NULL DEFAULT 0;

-- The first 8 bears keep their look: same fur and background; their extra goes to its slot
-- (star -> crown, leaf -> flower, panda patches -> panda fur). Same table as OLD_BEARS.
UPDATE accounts SET bear_fur = 0, bear_bg = 0, bear_head = 3, bear_neck = 0, bear_eyes = 0 WHERE bear = 1;
UPDATE accounts SET bear_fur = 1, bear_bg = 1, bear_head = 2, bear_neck = 0, bear_eyes = 0 WHERE bear = 2;
UPDATE accounts SET bear_fur = 3, bear_bg = 2, bear_head = 0, bear_neck = 3, bear_eyes = 0 WHERE bear = 3;
UPDATE accounts SET bear_fur = 4, bear_bg = 3, bear_head = 0, bear_neck = 0, bear_eyes = 0 WHERE bear = 4;
UPDATE accounts SET bear_fur = 5, bear_bg = 4, bear_head = 4, bear_neck = 0, bear_eyes = 0 WHERE bear = 5;
UPDATE accounts SET bear_fur = 6, bear_bg = 5, bear_head = 0, bear_neck = 0, bear_eyes = 1 WHERE bear = 6;
UPDATE accounts SET bear_fur = 7, bear_bg = 6, bear_head = 5, bear_neck = 0, bear_eyes = 0 WHERE bear = 7;
UPDATE accounts SET bear_fur = 2, bear_bg = 7, bear_head = 3, bear_neck = 0, bear_eyes = 0 WHERE bear = 8;

UPDATE app_meta SET value = '6' WHERE key = 'schema_version';
