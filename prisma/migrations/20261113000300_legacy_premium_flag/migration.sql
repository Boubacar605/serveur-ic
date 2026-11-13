-- Adds the Premium flag to databases initialized from the legacy SQL file
-- (prisma/legacy/001_initial_schema.sql). Fresh databases already receive the
-- column from the init migration, so this statement is a no-op for them.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
