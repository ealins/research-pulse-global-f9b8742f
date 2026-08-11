// Controlled topic classification against the EXISTING research taxonomy.
// Runs only on records that already survived entity validation.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runExtraction, type ExtractionInput, type ExtractionOutcome } from "./engine.server";
import { fail, nullableString, parseObject, stringArray, unitNumber, type ValidationOutcome } from "./shared.server";

export type TopicClassification = {
  relevant: boolean;
  relevance_score: number;
  topics: string[];
  reason: string;
};

let taxonomyCache: { at: number; rows: { id: string; name: string }[] } | null = null;

/** The controlled vocabulary is the database, never a hardcoded list. */
export async function loadTaxonomy(): Promise<{ id: string; name: string }[]> {
  if (taxonomyCache && Date.now() - taxonomyCache.at < 10 * 60_000) return taxonomyCache.rows;
  const { data } = await supabaseAdmin.from("research_topics").select("id, name").eq("active", true).order("name");
  const rows = (data ?? []) as { id: string; name: string }[];
  taxonomyCache = { at: Date.now(), rows };
  return rows;
}

export function buildClassificationPrompt(topicNames: string[]): string {
  return `You are the relevance classifier of GeoAcademic Radar, a research intelligence platform for photogrammetry, remote sensing, geodesy, geoinformatics, GeoAI and Earth observation.

RULES — absolute:
1. Use ONLY the supplied text. Never infer facts that are not stated.
2. "topics" may contain ONLY values copied verbatim from the controlled vocabulary below. Never invent a topic.
3. Generic AI, machine-learning, data-science or software material is NOT GeoAI unless the text shows genuine geospatial, Earth-observation or 3D-mapping content.
4. Reply with ONE JSON object and nothing else — no prose, no markdown fences.

CONTROLLED VOCABULARY:
${topicNames.join(", ")}

Return exactly:
{
  "relevant": boolean,
  "relevance_score": number,
  "topics": string[],
  "reason": string
}

"relevance_score" is 0 to 1. If "relevant" is false, return an empty "topics" array and a short reason.`;
}

export function validateClassification(vocabulary: string[]) {
  return (completion: string): ValidationOutcome<TopicClassification> => {
    const parsedRes = parseObject<TopicClassification>(completion);
    if (!parsedRes.ok) return parsedRes.outcome;
    const obj = parsedRes.obj;

    if (typeof obj["relevant"] !== "boolean") return fail("SCHEMA_FAILURE", "relevant must be a boolean");
    const score = unitNumber(obj["relevance_score"]);
    if (score === null) return fail("BUSINESS_RULE_FAILURE", "relevance_score must be a number between 0 and 1");

    const lower = new Map(vocabulary.map((v) => [v.toLowerCase(), v]));
    const raw = stringArray(obj["topics"], 120, 12);
    const topics: string[] = [];
    for (const t of raw) {
      const hit = lower.get(t.toLowerCase());
      // A topic outside the controlled vocabulary is dropped, never stored.
      if (hit && !topics.includes(hit)) topics.push(hit);
    }
    const relevant = obj["relevant"] === true;
    if (relevant && topics.length === 0) {
      return fail("BUSINESS_RULE_FAILURE", "marked relevant but returned no controlled-vocabulary topic");
    }

    return {
      ok: true,
      value: {
        relevant,
        relevance_score: score,
        topics: relevant ? topics : [],
        reason: nullableString(obj["reason"], 400) ?? "",
      },
    };
  };
}

export async function classifyTopics(input: ExtractionInput): Promise<ExtractionOutcome<TopicClassification>> {
  const taxonomy = await loadTaxonomy();
  const names = taxonomy.map((t) => t.name);
  return runExtraction<TopicClassification>({
    operation: "RELEVANCE_CLASSIFICATION",
    system: buildClassificationPrompt(names),
    validate: validateClassification(names),
    input,
  });
}

/** Map validated topic names to taxonomy ids for the join tables. */
export async function topicIdsFor(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const taxonomy = await loadTaxonomy();
  const byName = new Map(taxonomy.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const n of names) {
    const id = byName.get(n.toLowerCase());
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
