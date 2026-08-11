// Vacancy extraction prompt + typed model output. Server-only.
import { cleanPageText } from "../content-clean.server";
import { callNemotron, type NemotronResult } from "../nvidia.server";

export const VACANCY_SYSTEM_PROMPT = `You are the extraction engine of GeoAcademic Radar, a research intelligence platform for photogrammetry, remote sensing, geodesy, geoinformatics, GeoAI and Earth observation.

RULES — these are absolute:
1. Use ONLY the supplied page text. Never infer, complete or invent any fact.
2. If a field is not stated in the text, return null. Never guess.
3. Every evidence snippet must be copied verbatim from the supplied text.
4. Reply with ONE JSON object and nothing else — no prose, no markdown fences.

Return exactly this shape:
{
  "is_single_real_position": boolean,
  "rejection_reason": string | null,
  "title": string | null,
  "opportunity_type": "phd" | "doctoral_researcher" | "research_assistant" | "postdoc" | "other" | null,
  "sector": "academic" | "industry" | null,
  "department": string | null,
  "supervisor_name": string | null,
  "city": string | null,
  "country": string | null,
  "funding_type": string | null,
  "salary_text": string | null,
  "contract_type": string | null,
  "start_date": string | null,
  "application_deadline": string | null,
  "application_url": string | null,
  "requirements": string | null,
  "summary": string | null,
  "geospatial_relevance": boolean,
  "topics": string[],
  "confidence": number,
  "evidence": string[]
}

Dates must be ISO (YYYY-MM-DD) or null. "confidence" is 0 to 1.
Set "is_single_real_position" to false for careers hubs, vacancy lists, marketing pages, employee stories or product pages, and give a short rejection_reason.
Set "geospatial_relevance" to true only when the role genuinely concerns photogrammetry, remote sensing, geodesy, geoinformatics, GIS, GeoAI, Earth observation, LiDAR/SAR/point clouds or spatial data science. A generic software or machine-learning role that merely mentions AI is NOT relevant.`;

export type VacancyExtraction = {
  is_single_real_position: boolean;
  rejection_reason: string | null;
  title: string | null;
  opportunity_type: string | null;
  sector: string | null;
  department: string | null;
  supervisor_name: string | null;
  city: string | null;
  country: string | null;
  funding_type: string | null;
  salary_text: string | null;
  contract_type: string | null;
  start_date: string | null;
  application_deadline: string | null;
  application_url: string | null;
  requirements: string | null;
  summary: string | null;
  geospatial_relevance: boolean;
  topics: string[];
  confidence: number;
  evidence: string[];
};

export async function extractVacancy(input: {
  url: string;
  title: string;
  text: string;
  sourceId?: string | null;
  rawRecordId?: string | null;
  contentHash?: string | null;
}): Promise<{ call: NemotronResult; cleanedChars: number; originalChars: number }> {
  const cleaned = cleanPageText(input.text, { prioritiseJobSections: true });
  const user = `PAGE URL: ${input.url}
PAGE TITLE: ${input.title}

PAGE TEXT:
"""
${cleaned.text}
"""`;

  const call = await callNemotron({
    system: VACANCY_SYSTEM_PROMPT,
    user,
    operation: "VACANCY_EXTRACTION",
    sourceId: input.sourceId ?? null,
    rawRecordId: input.rawRecordId ?? null,
    contentHash: input.contentHash ?? null,
    contentReduced: cleaned.contentReduced,
    maxTokens: 1400,
  });

  return { call, cleanedChars: cleaned.sentChars, originalChars: cleaned.originalChars };
}
