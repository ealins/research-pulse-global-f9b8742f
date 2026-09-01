-- The `courses` table was the only content table missing the `confidence`
-- quality column that the application queries against (.neq("confidence", "low")
-- and SELECT "confidence"). Bring it in line with projects, publications,
-- opportunities, and events.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS confidence public.confidence_level NOT NULL DEFAULT 'medium';

-- Existing rows keep 'medium' (visible). Low-confidence courses can be
-- demoted by the ingestion pipeline as needed.
