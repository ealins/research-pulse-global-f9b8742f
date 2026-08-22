WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY payload->>'source_id'
      ORDER BY priority DESC, created_at, id
    ) AS rn
  FROM ingestion_tasks
  WHERE task_type='FETCH'
    AND status IN ('QUEUED','PROCESSING','RETRY')
    AND payload ? 'source_id'
)
UPDATE ingestion_tasks t
SET status='DEAD',
    error='duplicate active fetch task collapsed before unique index',
    updated_at=now()
FROM ranked r
WHERE t.id=r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ingestion_tasks_active_fetch_source_uq
  ON ingestion_tasks ((payload->>'source_id'))
  WHERE task_type='FETCH'
    AND status IN ('QUEUED','PROCESSING','RETRY')
    AND payload ? 'source_id';
