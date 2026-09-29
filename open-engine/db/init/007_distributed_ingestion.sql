ALTER TABLE ingestion_tasks
  ADD COLUMN IF NOT EXISTS dispatch_state text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ingestion_tasks_dispatch_idx
  ON ingestion_tasks(task_type, status, dispatch_state, next_attempt_at, priority DESC, id)
  WHERE status IN ('QUEUED','RETRY');

-- External IDs are scoped to their adapter/source. A globally unique external
-- ID incorrectly conflates identifiers from unrelated providers.
DROP INDEX IF EXISTS source_registry_external_id_uq;
CREATE UNIQUE INDEX IF NOT EXISTS source_registry_parent_external_id_uq
  ON source_registry(parent_source_id, external_id)
  WHERE external_id IS NOT NULL AND parent_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS source_registry_url_content_idx
  ON source_registry(url)
  WHERE source_kind='content';

-- A worker owns the task only after it has successfully claimed it. Dispatch
-- state is separate so Pub/Sub retries never create duplicate DB work.
UPDATE ingestion_tasks
SET dispatch_state='DONE'
WHERE status='DONE' AND dispatch_state <> 'DONE';

UPDATE ingestion_tasks
SET dispatch_state='PENDING'
WHERE status IN ('QUEUED','RETRY') AND dispatch_state IS NULL;
