import { Link } from "@tanstack/react-router";
import { CardLink } from "@/components/CardLink";
import { EmptyState } from "@/components/EmptyState";
import type { ReactNode } from "react";
import {
  Activity,
  Briefcase,
  Sparkles,
  Building2,
  CalendarDays,
  FlaskConical,
  Globe2,
  GraduationCap,
  LineChart,
  MapPinned,
  Network,
  ScrollText,
  ShieldCheck,
  Tags,
  Target,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { openJobCountQuery } from "@/lib/radar-queries";
import { CommandPalette } from "@/components/CommandPalette";

const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [
      { to: "/", label: "Research Pulse", icon: Activity },
      { to: "/top", label: "Top picks", icon: Sparkles },
      { to: "/atlas", label: "World Monitor", icon: Globe2 },
      { to: "/countries", label: "Countries", icon: MapPinned },
      { to: "/trends", label: "Research trends", icon: LineChart },
      { to: "/collaboration", label: "Collaboration graph", icon: Network },
    ],
  },
  {
    label: "Careers",
    items: [
      { to: "/jobs", label: "Academic & industry jobs", icon: Briefcase },
      { to: "/matcher", label: "Matcher", icon: Target },
      { to: "/events", label: "Events & deadlines", icon: CalendarDays },
      { to: "/programmes", label: "Programmes", icon: GraduationCap },
    ],
  },
  {
    label: "Knowledge base",
    items: [
      { to: "/institutions", label: "Institutions", icon: Building2 },
      { to: "/researchers", label: "Researchers", icon: Users },
      { to: "/projects", label: "Projects", icon: FlaskConical },
      { to: "/publications", label: "Publications", icon: ScrollText },
      { to: "/topics", label: "Topic taxonomy", icon: Tags },
    ],
  },
  {
    label: "Trust",
    items: [{ to: "/methodology", label: "Methodology", icon: ShieldCheck }],
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: openJobs } = useQuery(openJobCountQuery);


  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="border-b border-sidebar-border bg-sidebar/80 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center text-primary">
            <span className="live-dot absolute inset-0 rounded-full" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold leading-none text-sidebar-foreground">
              GeoAcademic Radar
            </p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              Photogrammetry · RS · GI
            </p>
          </div>
        </div>


        <div className="px-3 pb-3">
          <CommandPalette />
        </div>

        <nav className="flex flex-col gap-4 px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                {group.label}
              </p>
              <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    className="group flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{label}</span>
                    {to === "/jobs" && openJobs ? (
                      <span className="mono-num ml-auto hidden rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] text-primary lg:inline">
                        {openJobs}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>


      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid-lines border-b border-border">
      <div className="signal-wash">
        <div className="mx-auto w-full max-w-7xl px-6 py-10">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}

function isEmptyStat(value: string | number): boolean {
  return value === "—" || value === 0 || value === "0";
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  to,
  params,
  search,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "signal" | "deadline" | "growth";
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
}) {
  const toneClass =
    tone === "signal"
      ? "text-signal"
      : tone === "deadline"
        ? "text-deadline"
        : tone === "growth"
          ? "text-growth"
          : "text-primary";
  const empty = isEmptyStat(value);
  return (
    <div className="panel panel-hover rise-in relative p-4">
      {to ? <CardLink to={to} params={params} search={search} label={`${label}: open`} /> : null}
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {empty ? (
        <div className="mt-2">
          <EmptyState variant="compact" />
        </div>
      ) : (
        <p className={`mono-num mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      )}
      {hint && !empty ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProvenanceChips({
  verification,
  isDemo,
  confidence,
}: {
  verification: string;
  isDemo?: boolean;
  confidence?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-muted-foreground">
        {verification === "verified" ? "Verified" : "Not verified"}
      </span>
      {confidence ? (
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-muted-foreground">
          {confidence} confidence
        </span>
      ) : null}
      {isDemo ? (
        <span className="rounded-full border border-deadline/40 bg-deadline/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-deadline">
          Demo data
        </span>
      ) : null}
    </span>
  );
}

export function TopicPills({ topics }: { topics: (string | undefined)[] }) {
  const list = topics.filter(Boolean).slice(0, 5) as string[];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((t) => (
        <span
          key={t}
          className="rounded-md border border-signal/30 bg-signal/10 px-2 py-0.5 text-[0.68rem] text-foreground/85"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
