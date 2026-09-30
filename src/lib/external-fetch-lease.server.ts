import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ExternalFetchLease = {
  task_id: string;
  source_id: string;
  lease_started_at: string;
  url: string;
  adapter_key: string;
  category: string;
  institution_id: string | null;
  refresh_frequency_hours: number | null;
  attempt: number;
  max_attempts: number;
};

export async function leaseExternalFetchTasks(
  limit = 8,
): Promise<ExternalFetchLease[]> {
  const requested = Math.min(20, Math.max(1, Math.floor(limit)));
  const { data, error } = await supabaseAdmin.rpc(
    "lease_external_fetch_tasks",
    { p_limit: requested },
  );
  if (error) throw error;
  return (data ?? []) as ExternalFetchLease[];
}
