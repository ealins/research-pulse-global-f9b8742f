-- Durable cadence and lease state for optional semantic discovery providers.
-- Provider credentials are never stored in this table or in the database.
CREATE TABLE IF NOT EXISTS ingestion_provider_state (
    provider text PRIMARY KEY,
    status text NOT NULL DEFAULT 'IDLE',
    last_started_at timestamptz,
    last_finished_at timestamptz,
    lease_expires_at timestamptz,
    next_run_at timestamptz,
    last_error text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_provider_state_due_idx
    ON ingestion_provider_state (next_run_at)
    WHERE next_run_at IS NOT NULL;