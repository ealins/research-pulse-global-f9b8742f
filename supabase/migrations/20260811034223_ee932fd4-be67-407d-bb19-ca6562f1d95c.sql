ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'academic';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS employer_name text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS seniority text;
CREATE INDEX IF NOT EXISTS opportunities_sector_idx ON public.opportunities (sector);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_kind text NOT NULL DEFAULT 'conference';