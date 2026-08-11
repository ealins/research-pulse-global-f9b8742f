// Deterministic candidate selection. No model request is made for pages that
// obviously cannot yield a canonical record — this is the cost gate.
import { looksLikeSinglePosting } from "./ingest.server";

export type Candidate =
  | "VACANCY_CANDIDATE"
  | "PROGRAMME_CANDIDATE"
  | "PROJECT_CANDIDATE"
  | "RESEARCHER_CANDIDATE"
  | "EVENT_CANDIDATE"
  | "TOPIC_CLASSIFICATION_CANDIDATE"
  | "NOT_A_CANDIDATE";

export type CandidateDecision = { candidate: Candidate; reason: string };

const JUNK_PATH =
  /\/(privacy|datenschutz|impressum|imprint|cookie|terms|agb|login|signin|sign-in|anmelden|search|suche|sitemap|rss|feed|newsletter|accessibility|barrierefreiheit)(\/|$|\?)/i;
const JUNK_TITLE =
  /^(privacy|data protection|datenschutz|impressum|imprint|cookie|terms|login|sign in|search|sitemap|accessibility|barrierefreiheit|newsletter|404|page not found)/i;
const ASSET = /\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|svg|mp4|ics)$/i;

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return (url || "").toLowerCase();
  }
}

/**
 * Decide whether a raw page is worth a model request, based only on stored
 * deterministic signals. Vacancy candidacy additionally requires the existing
 * strict single-posting gate to pass — the model can never overturn it.
 */
export function selectCandidate(input: {
  url: string;
  title: string;
  text: string;
  classification: string | null;
}): CandidateDecision {
  const url = input.url ?? "";
  const title = (input.title ?? "").trim();
  const text = input.text ?? "";
  const path = pathOf(url);

  if (ASSET.test(path)) return { candidate: "NOT_A_CANDIDATE", reason: "binary asset, not a web page" };
  if (JUNK_PATH.test(path)) return { candidate: "NOT_A_CANDIDATE", reason: "legal/utility page path" };
  if (JUNK_TITLE.test(title)) return { candidate: "NOT_A_CANDIDATE", reason: "legal/utility page title" };
  if (path === "/" || path === "") return { candidate: "NOT_A_CANDIDATE", reason: "site homepage" };
  if (text.length < 400) return { candidate: "NOT_A_CANDIDATE", reason: "page too thin to extract from" };

  switch (input.classification) {
    case "VACANCY": {
      const gate = looksLikeSinglePosting(url, title, text);
      if (!gate.ok) return { candidate: "NOT_A_CANDIDATE", reason: `deterministic vacancy gate rejected: ${gate.reason}` };
      return { candidate: "VACANCY_CANDIDATE", reason: "single vacancy posting passed the deterministic gate" };
    }
    case "PROGRAMME":
    case "COURSE":
      return { candidate: "PROGRAMME_CANDIDATE", reason: "degree programme / course page" };
    case "PROJECT":
      return { candidate: "PROJECT_CANDIDATE", reason: "research project page" };
    case "RESEARCHER":
      return { candidate: "RESEARCHER_CANDIDATE", reason: "people / staff page" };
    case "EVENT":
      return { candidate: "EVENT_CANDIDATE", reason: "event or conference page" };
    case "RESEARCH_NEWS":
    case "RESEARCH_GROUP":
      return { candidate: "TOPIC_CLASSIFICATION_CANDIDATE", reason: "research page eligible for relevance/topic classification" };
    default:
      return { candidate: "NOT_A_CANDIDATE", reason: `classification ${input.classification ?? "UNKNOWN"} has no extractor` };
  }
}
