// Server-only configuration for the GeoAcademic Radar intelligence engine.
export const AI_PROVIDER = "NVIDIA" as const;
export const NVIDIA_SECRET_NAME = "Nvidia" as const;
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
export const NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const NVIDIA_MAX_CONCURRENCY = 2;
export const NVIDIA_RETRY_LIMIT = 3;
export const NVIDIA_TIMEOUT_MS = 90_000;
export const LLM_EXTRACTION_ENABLED = true;
/** Hard cap on characters sent to the model per request. */
export const LLM_MAX_INPUT_CHARS = 12_000;
export const LLM_DEFAULT_TEMPERATURE = 0.1;
export const LLM_DEFAULT_MAX_TOKENS = 2000;

export type LlmOperation =
  | "CONNECTION_TEST"
  | "VACANCY_EXTRACTION"
  | "PROGRAMME_EXTRACTION"
  | "PROJECT_EXTRACTION"
  | "RESEARCHER_EXTRACTION"
  | "EVENT_EXTRACTION"
  | "RELEVANCE_CLASSIFICATION";

/**
 * Output budget per operation. Deliberately tight: the model spends reasoning
 * tokens before the JSON, so each budget is the smallest value that reliably
 * returns a complete object for that schema.
 */
export const LLM_MAX_TOKENS: Record<LlmOperation, number> = {
  CONNECTION_TEST: 24,
  VACANCY_EXTRACTION: 3000,
  PROGRAMME_EXTRACTION: 1600,
  PROJECT_EXTRACTION: 1800,
  RESEARCHER_EXTRACTION: 1600,
  EVENT_EXTRACTION: 1200,
  RELEVANCE_CLASSIFICATION: 700,
};

/** Input budget per operation — smaller pages cost less and classify better. */
export const LLM_INPUT_CHARS: Record<LlmOperation, number> = {
  CONNECTION_TEST: 500,
  VACANCY_EXTRACTION: LLM_MAX_INPUT_CHARS,
  PROGRAMME_EXTRACTION: 10_000,
  PROJECT_EXTRACTION: 10_000,
  RESEARCHER_EXTRACTION: 9_000,
  EVENT_EXTRACTION: 8_000,
  RELEVANCE_CLASSIFICATION: 6_000,
};
