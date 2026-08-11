import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractProgramme } from "@/lib/extraction/entities.server";

const ids = ["50512f31-7643-48f1-9379-07bc5cd17dcb","a68f6c5b-8fbd-441c-bed3-dbc61a3155d7","f19ca4be-110d-44d0-87f1-5946102d1da4","876c7cdb-2fee-471c-ab85-8d097cbd1fb2","b1a873e1-783e-4fee-96b9-8af5f60178a1","dd2d1ce0-48ae-4a5d-b801-6e8282ecbb0e"];
const { data } = await supabaseAdmin.from("raw_records").select("id,source_id,source_url,final_url,page_title,text_content").in("id", ids);
for (const r of data ?? []) {
  const t0 = Date.now();
  const out = await extractProgramme({ url: r.final_url ?? r.source_url, title: r.page_title ?? "", text: r.text_content ?? "", sourceId: r.source_id, rawRecordId: r.id, contentHash: null });
  console.log(JSON.stringify({ url: (r.final_url ?? r.source_url).slice(0,60), ms: Date.now()-t0, ok: out.value !== null, err: out.errorCode, accepted: out.value ? (out.value as any).is_single_real_programme : null }));
}
