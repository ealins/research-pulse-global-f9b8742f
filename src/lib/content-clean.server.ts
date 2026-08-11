// Server-only content cleaner. Strips site chrome from stored raw page text and
// prioritises the sections a model actually needs, so requests stay small.
import { LLM_MAX_INPUT_CHARS } from "./llm-config.server";

const BOILERPLATE_LINE =
  /^(home|menu|search|login|log in|sign in|register|newsletter|cookie|cookies|accept all|privacy policy|datenschutz|impressum|imprint|terms|sitemap|skip to (main )?content|zur (haupt)?navigation|share|print|drucken|follow us|copyright|©.*|all rights reserved|back to top|nach oben|deutsch|english|de \| en|en \| de)$/i;

const NAV_NOISE = /(cookie|consent|javascript is disabled|enable javascript|social media|follow us on|newsletter sign|©\s?\d{4})/i;

const JOB_SECTION =
  /(your tasks|your profile|your qualifications|responsibilities|requirements|qualifications|we offer|what we offer|how to apply|application|deadline|contract|salary|remuneration|contact|ihre aufgaben|ihr profil|wir bieten|bewerbung|bewerbungsfrist|verg[uü]tung|entgeltgruppe|befristet|vollzeit|teilzeit|kennziffer|reference)/i;

export type CleanedContent = {
  text: string;
  originalChars: number;
  sentChars: number;
  contentReduced: boolean;
};

function dedupeRepeatedLines(lines: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    // Repeated menu entries appear many times; keep only the first occurrence
    // of short repeated lines.
    if (count > 1 && line.length < 60) continue;
    out.push(line);
  }
  return out;
}

/** Remove chrome, then keep the most informative sections when over budget. */
export function cleanPageText(raw: string, opts?: { maxChars?: number; prioritiseJobSections?: boolean }): CleanedContent {
  const maxChars = opts?.maxChars ?? LLM_MAX_INPUT_CHARS;
  const originalChars = raw.length;

  const lines = raw
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .filter((l) => !BOILERPLATE_LINE.test(l))
    .filter((l) => !(l.length < 80 && NAV_NOISE.test(l)));

  let kept = dedupeRepeatedLines(lines);

  if (opts?.prioritiseJobSections !== false) {
    const joinedLength = kept.join("\n").length;
    if (joinedLength > maxChars) {
      const priority: string[] = [];
      const rest: string[] = [];
      for (const line of kept) (JOB_SECTION.test(line) || line.length > 120 ? priority : rest).push(line);
      kept = [...priority, ...rest];
    }
  }

  let text = kept.join("\n");
  const contentReduced = text.length > maxChars;
  if (contentReduced) text = text.slice(0, maxChars);

  return { text, originalChars, sentChars: text.length, contentReduced };
}
