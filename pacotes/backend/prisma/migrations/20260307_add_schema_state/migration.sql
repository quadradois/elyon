-- Migration applied: 2026-03-07
-- Adds schemaState JSONB column to the leads table
-- Table name is "leads" (lowercase, per Prisma @@map("leads"))
-- JSONB used instead of JSON for indexed querying support

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS "schemaState" jsonb;
