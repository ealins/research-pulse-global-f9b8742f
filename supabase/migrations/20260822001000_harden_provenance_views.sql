-- Public provenance views must run with the caller's permissions. The contract
-- migration grants only their selected columns on the underlying tables.

BEGIN;

ALTER VIEW public.public_record_sources SET (
  security_invoker = true,
  security_barrier = true
);

ALTER VIEW public.public_source_registry SET (
  security_invoker = true,
  security_barrier = true
);

COMMIT;
