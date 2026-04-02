-- Add ClubDesk-relevant fields to members collection
-- Run on both dev and prod: psql -U directus -d directus_kscw_dev -f 005-clubdesk-fields.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS adresse VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS plz VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ort VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS nationalitaet VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS anrede VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS geschlecht VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ahv_nummer VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS beitragskategorie VARCHAR(100);
