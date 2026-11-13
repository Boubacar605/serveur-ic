-- Lieu précis de la mission (quartier, rue, repère) en complément de la zone.
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS lieu VARCHAR(255);
