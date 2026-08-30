/**
 * Canonical lifecycle policy: excludes expired, stale, terminal, and low-confidence
 * data from all public surfaces. Applied consistently across DB views, API, and frontend.
 *
 * Rationale: "lean data" — surfaces show only actionable, recent, verified information.
 */

import { PUBLIC_VERIFICATION_STATUSES, PUBLIC_CONFIDENCE_LEVELS } from "./public-data";

/** Terminal verification statuses excluded from public */
export const EXCLUDED_VERIFICATION_STATUSES = [
  "archived",
  "closed",
  "needs_review",
  "unverified",
] as const;

/** Active project statuses only (exclude completed/recently_completed) */
export const LIVE_PROJECT_STATUSES = ["planned", "active"] as const;

/** Stale window: opportunities/events without recent source check (30 days) */
export const STALE_DAYS = 30;

/**
 * Return ISO date string N days before today
 */
export function dateNDaysAgo(days: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - days * 86_400_000);
  return past.toISOString().slice(0, 10);
}

/**
 * Return today's ISO date string
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return tomorrow's ISO date string
 */
export function tomorrow(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return now.toISOString().slice(0, 10);
}

/**
 * Lifecycle checks applied client-side as final safety net
 */

export function isLiveOpportunity(row: {
  status?: string;
  verification_status?: string;
  confidence?: string;
  application_deadline?: string | null;
  official_source_url?: string | null;
}): boolean {
  if (!row.official_source_url) return false;
  if (row.status && !["open", "closing_soon", "rolling", "possibly_open"].includes(row.status))
    return false;
  if (
    row.verification_status &&
    !PUBLIC_VERIFICATION_STATUSES.includes(row.verification_status as never)
  )
    return false;
  if (row.confidence && !PUBLIC_CONFIDENCE_LEVELS.includes(row.confidence as never)) return false;
  if (row.application_deadline) {
    const deadline = new Date(`${row.application_deadline}T23:59:59Z`).getTime();
    if (deadline < Date.now()) return false;
  }
  return true;
}

export function isLiveEvent(row: {
  verification_status?: string;
  start_date?: string | null;
  end_date?: string | null;
}): boolean {
  if (row.verification_status && !PUBLIC_VERIFICATION_STATUSES.includes(row.verification_status as never))
    return false;
  // Exclude past events (end_date or start_date < today)
  if (row.end_date) {
    const endDate = new Date(`${row.end_date}T23:59:59Z`).getTime();
    if (endDate < Date.now()) return false;
  } else if (row.start_date) {
    const startDate = new Date(`${row.start_date}T23:59:59Z`).getTime();
    if (startDate < Date.now()) return false;
  }
  return true;
}

export function isLiveProject(row: {
  status?: string;
  verification_status?: string;
}): boolean {
  if (row.verification_status && !PUBLIC_VERIFICATION_STATUSES.includes(row.verification_status as never))
    return false;
  if (row.status && !LIVE_PROJECT_STATUSES.includes(row.status as never)) return false;
  return true;
}
