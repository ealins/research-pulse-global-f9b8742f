import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TERMINAL = new Set(["closed", "archived"]);

async function promoteCanonicalRecord(entityType: string, entityId: string, checkedAt: string) {
  const verified = {
    verification_status: "verified" as never,
    last_verified_at: checkedAt,
  };

  if (entityType === "opportunity") {
    const { data } = await supabaseAdmin
      .from("opportunities")
      .select("application_deadline, verification_status")
      .eq("id", entityId)
      .maybeSingle();
    if (!data || data.verification_status === "archived") return;
    const today = new Date().toISOString().slice(0, 10);
    if (data.application_deadline && data.application_deadline < today) {
      await supabaseAdmin
        .from("opportunities")
        .update({
          status: "closed" as never,
          verification_status: "closed" as never,
          last_verified_at: checkedAt,
        })
        .eq("id", entityId);
      return;
    }
    await supabaseAdmin.from("opportunities").update(verified).eq("id", entityId);
    return;
  }

  if (entityType === "institution")
    await supabaseAdmin.from("institutions").update(verified).eq("id", entityId);
  else if (entityType === "course")
    await supabaseAdmin.from("courses").update(verified).eq("id", entityId);
  else if (entityType === "researcher")
    await supabaseAdmin.from("researchers").update(verified).eq("id", entityId);
  else if (entityType === "project")
    await supabaseAdmin.from("projects").update(verified).eq("id", entityId);
  else if (entityType === "event")
    await supabaseAdmin.from("events").update(verified).eq("id", entityId);
  else if (entityType === "publication")
    await supabaseAdmin.from("publications").update(verified).eq("id", entityId);
}

/**
 * Refresh provenance on every successful source fetch. A stable repeat fetch is
 * independent confirmation that the canonical claim still exists at its
 * official URL, so it promotes non-terminal records to verified.
 */
export async function refreshSourceTrust(input: {
  sourceId: string;
  changed: boolean;
  checkedAt: string;
}): Promise<void> {
  const { data: evidence, error } = await supabaseAdmin
    .from("record_sources")
    .select("id, entity_type, entity_id, verification_status")
    .eq("source_id", input.sourceId);
  if (error) throw error;

  for (const record of evidence ?? []) {
    if (input.changed || TERMINAL.has(record.verification_status)) {
      await supabaseAdmin
        .from("record_sources")
        .update({ last_checked_at: input.checkedAt })
        .eq("id", record.id);
      continue;
    }

    await supabaseAdmin
      .from("record_sources")
      .update({
        verification_status: "verified" as never,
        confidence: "high" as never,
        last_checked_at: input.checkedAt,
        last_verified_at: input.checkedAt,
      })
      .eq("id", record.id);
    await promoteCanonicalRecord(record.entity_type, record.entity_id, input.checkedAt);
  }
}
