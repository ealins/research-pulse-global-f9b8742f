import { Link } from "@tanstack/react-router";

/**
 * Full-card click target. Place inside a `relative` card container; it stretches
 * over the whole card so users don't have to hit the heading exactly.
 * Nested interactive elements need `relative z-10` to stay clickable.
 */
export function CardLink({
  to,
  params,
  search,
  label,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      aria-label={label}
      className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    />
  );
}

/** Same idea for cards whose primary destination is an external source. */
export function CardExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    />
  );
}
