ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS extracted_by text NOT NULL DEFAULT 'DETERMINISTIC',
  ADD COLUMN IF NOT EXISTS extraction_model text,
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric,
  ADD COLUMN IF NOT EXISTS extraction_timestamp timestamptz;