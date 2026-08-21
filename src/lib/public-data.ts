export const PUBLIC_VERIFICATION_STATUSES = [
  "verified",
  "auto_discovered",
  "possibly_outdated",
] as const;

export const PUBLIC_CONFIDENCE_LEVELS = ["high", "medium"] as const;

export const LIVE_OPPORTUNITY_STATUSES = [
  "open",
  "closing_soon",
  "rolling",
  "possibly_open",
] as const;

function countryKey(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const COUNTRY_NAMES: Record<string, string> = {
  deutschland: "Germany",
  holland: "Netherlands",
  uk: "United Kingdom",
  "u-k": "United Kingdom",
  "great-britain": "United Kingdom",
  usa: "United States",
  "u-s": "United States",
  "u-s-a": "United States",
  "united-states-of-america": "United States",
  "estados-unidos": "United States",
};

const COUNTRY_VARIANTS: Record<string, string[]> = {
  Germany: ["Germany", "Deutschland"],
  Netherlands: ["Netherlands", "Holland"],
  "United Kingdom": ["United Kingdom", "UK", "U.K.", "Great Britain"],
  "United States": [
    "United States",
    "United States of America",
    "USA",
    "U.S.A.",
    "US",
    "U.S.",
    "Estados Unidos",
  ],
};

/** Keep country tabs, rollups and detail links stable across source spellings. */
export function canonicalCountry(country: string | null | undefined): string | null {
  if (!country?.trim()) return null;
  const trimmed = country.trim();
  return COUNTRY_NAMES[countryKey(trimmed)] ?? trimmed;
}

export function countrySlug(country: string): string {
  return countryKey(canonicalCountry(country) ?? country);
}

export function countryVariants(country: string): string[] {
  const canonical = canonicalCountry(country) ?? country.trim();
  return [...new Set([country.trim(), canonical, ...(COUNTRY_VARIANTS[canonical] ?? [])])];
}
