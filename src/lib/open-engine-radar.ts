import { queryOptions } from "@tanstack/react-query";

import { openEngine, openEngineConfigured } from "@/lib/open-engine-client";
import {
  countsQuery as legacyCountsQuery,
  eventsQuery as legacyEventsQuery,
  opportunitiesQuery as legacyOpportunitiesQuery,
  pulseQuery as legacyPulseQuery,
  type OpportunityRow,
} from "@/lib/radar-queries";
import { opportunityDetailQuery as legacyOpportunityDetailQuery } from "@/lib/detail-queries";
import { eventDetailQuery as legacyEventDetailQuery } from "@/lib/relevance-queries";

type EngineEntity = {
  id: string;
  entity_type: string;
  external_key: string | null;
  slug: string | null;
  title: string;
  subtitle: string | null;
  country: string | null;
  verification_status: string;
  confidence: number;
  source_url: string | null;
  published_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string;
  data: Record<string, unknown> | string | null;
  start_date?: string | null;
  end_date?: string | null;
  posted_date?: string | null;
  deadline_date?: string | null;
};

type EngineSignal = {
  id: string | number;
  signal_type: string;
  entity_id: string | null;
  entity_type: string | null;
  title: string;
  summary: string | null;
  country: string | null;
  topics: string[];
  importance_score: number;
  confidence: number;
  verification_status: string;
  source_url: string | null;
  detected_at: string;
  published_at: string;
  data: Record<string, unknown> | string | null;
};

function dataOf(value: EngineEntity | EngineSignal): Record<string, unknown> {
  if (value.data && typeof value.data === "object") return value.data;
  if (typeof value.data === "string") {
    try {
      const parsed = JSON.parse(value.data);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function confidenceLabel(value: number): string {
  if (value >= 0.85) return "high";
  if (value >= 0.7) return "medium";
  return "low";
}

function absoluteUrl(value: string | null, base: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, base || undefined).toString();
  } catch {
    return base;
  }
}

function jobType(title: string): string {
  const value = title.toLowerCase();
  if (/post[- ]?doc|postdoctoral/.test(value)) return "postdoc";
  if (/doctoral researcher/.test(value)) return "doctoral_researcher";
  if (/research assistant/.test(value)) return "research_assistant";
  if (/\bph\.?d\b|doctoral|doctorate/.test(value)) return "phd";
  return "other";
}

function seniority(title: string): string | null {
  const type = jobType(title);
  if (type === "postdoc") return "Postdoc";
  if (type === "phd" || type === "doctoral_researcher") return "Doctoral";
  if (type === "research_assistant") return "Research assistant";
  if (/professor|faculty|lecturer/i.test(title)) return "Faculty";
  return null;
}

function statusForDeadline(deadline: string | null): string {
  if (!deadline) return "possibly_open";
  const target = new Date(`${deadline}T23:59:59Z`).getTime();
  if (!Number.isFinite(target)) return "possibly_open";
  const days = Math.ceil((target - Date.now()) / 86_400_000);
  if (days < 0) return "closed";
  if (days <= 14) return "closing_soon";
  return "open";
}

function sourceOrganization(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    if (host.endsWith("isprs.org")) return "ISPRS";
    if (host.endsWith("earthobservations.org")) return "Group on Earth Observations";
    if (host.endsWith("egu.eu")) return "European Geosciences Union";
    return host;
  } catch {
    return null;
  }
}

function eventKind(title: string): string {
  const value = title.toLowerCase();
  if (value.includes("workshop")) return "workshop";
  if (value.includes("school") || value.includes("course")) return "summer_school";
  if (value.includes("colloquium")) return "colloquium";
  if (value.includes("fair") || value.includes("expo")) return "trade_fair";
  return "conference";
}

function mapOpportunity(entity: EngineEntity): OpportunityRow & Record<string, unknown> {
  const data = dataOf(entity);
  const location = text(data["location"]);
  const institution = text(data["institution"]);
  const deadline = entity.deadline_date ?? text(data["deadline_date"]);
  const start = entity.start_date ?? text(data["start_date"]);
  const detailUrl = absoluteUrl(text(data["detail_url"]), entity.source_url);
  const city =
    location && entity.country && location.includes(",")
      ? location.split(",")[0]?.trim() || null
      : null;

  return {
    id: entity.id,
    title: entity.title,
    slug: entity.slug ?? entity.external_key?.slice(0, 16) ?? entity.id,
    city,
    country: entity.country,
    opportunity_type: jobType(entity.title),
    description: text(data["description"]),
    requirements: null,
    funding_type: null,
    salary_text: null,
    start_date: start,
    application_deadline: deadline,
    application_url: detailUrl ?? entity.source_url,
    official_source_url: entity.source_url,
    supervisor_name: null,
    sector: "academic",
    employer_name: institution,
    seniority: seniority(entity.title),
    status: statusForDeadline(deadline),
    confidence: confidenceLabel(Number(entity.confidence) || 0),
    verification_status: entity.verification_status,
    last_checked_at: entity.last_seen_at,
    is_demo: false,
    institutions: null,
    opportunity_topics: [],
    first_discovered_at: entity.first_seen_at,
    last_verified_at: entity.verification_status === "verified" ? entity.last_seen_at : null,
    departments: null,
    researchers: null,
    projects: null,
    open_engine: true,
  };
}

function mapEvent(entity: EngineEntity): Record<string, unknown> {
  const data = dataOf(entity);
  return {
    id: entity.id,
    title: entity.title,
    slug: entity.slug ?? entity.external_key?.slice(0, 16) ?? entity.id,
    organization: sourceOrganization(entity.source_url),
    location: text(data["location"]),
    country: entity.country,
    recurrence: null,
    summary: text(data["description"]),
    source: entity.source_url,
    website: entity.source_url,
    start_date: entity.start_date ?? text(data["start_date"]),
    end_date: entity.end_date ?? text(data["end_date"]),
    event_kind: eventKind(entity.title),
    abstract_deadline: null,
    paper_deadline: null,
    registration_deadline: null,
    verification_status: entity.verification_status,
    confidence: confidenceLabel(Number(entity.confidence) || 0),
    last_verified_at: entity.verification_status === "verified" ? entity.last_seen_at : null,
    last_checked_at: entity.last_seen_at,
    is_demo: false,
    event_topics: [],
    open_engine: true,
  };
}

function pulseCategory(signal: EngineSignal): string {
  if (signal.entity_type === "opportunity") return "PHD";
  if (signal.entity_type === "event") return "EVENT";
  if (signal.entity_type === "publication") return "PAPER";
  if (signal.entity_type === "project") return "PROJECT";
  return "PEOPLE";
}

async function runLegacy<T>(options: any, context: any): Promise<T> {
  if (typeof options.queryFn !== "function") {
    throw new Error("Legacy query does not expose a query function");
  }
  return (await options.queryFn(context)) as T;
}

const openEngineOpportunitiesQuery = queryOptions({
  queryKey: ["opportunities", "open-engine"],
  queryFn: async (): Promise<OpportunityRow[]> => {
    const feed = await openEngine.latest("opportunity", 200);
    return (feed.items as unknown as EngineEntity[]).map(mapOpportunity);
  },
  staleTime: 60_000,
});

const openEngineEventsQuery = queryOptions({
  queryKey: ["events", "open-engine"],
  queryFn: async (): Promise<any[]> => {
    const feed = await openEngine.latest("event", 200);
    return (feed.items as unknown as EngineEntity[]).map(mapEvent);
  },
  staleTime: 60_000,
});

const openEnginePulseQuery = queryOptions({
  queryKey: ["pulse", "open-engine"],
  queryFn: async (): Promise<any[]> => {
    const feed = await openEngine.pulse(720, 100);
    const mapped = (feed.items as unknown as EngineSignal[]).map((signal) => ({
      id: String(signal.id),
      entity_id: signal.entity_id,
      category: pulseCategory(signal),
      title: signal.title,
      summary: signal.summary,
      event_date: signal.published_at ?? signal.detected_at,
      importance: signal.importance_score,
      link_url: signal.source_url,
      source_url: signal.source_url,
      verification_status: signal.verification_status,
      confidence: confidenceLabel(Number(signal.confidence) || 0),
      is_demo: false,
      country: signal.country,
      pulse_event_topics: [],
    }));
    // One row per entity: ingestion emits both NEW and UPDATED signals for the
    // same record, which renders as duplicate rows. Keep the freshest signal.
    const latestByEntity = new Map<string, (typeof mapped)[number]>();
    for (const item of mapped) {
      const key = item.entity_id ?? item.id;
      const prev = latestByEntity.get(key);
      if (!prev || item.event_date >= prev.event_date) latestByEntity.set(key, item);
    }
    return [...latestByEntity.values()].sort((a, b) =>
      b.event_date < a.event_date ? -1 : b.event_date > a.event_date ? 1 : 0,
    );
  },
  staleTime: 60_000,
});

export const hybridOpportunitiesQuery = queryOptions({
  queryKey: openEngineConfigured ? ["opportunities", "open-engine"] : ["opportunities"],
  queryFn: async (context): Promise<OpportunityRow[]> =>
    openEngineConfigured
      ? openEngineOpportunitiesQuery.queryFn!(context as never)
      : runLegacy<OpportunityRow[]>(legacyOpportunitiesQuery, context),
  staleTime: 60_000,
});

export const hybridEventsQuery = queryOptions({
  queryKey: openEngineConfigured ? ["events", "open-engine"] : ["events"],
  queryFn: async (context): Promise<any[]> =>
    openEngineConfigured
      ? openEngineEventsQuery.queryFn!(context as never)
      : runLegacy<any[]>(legacyEventsQuery, context),
  staleTime: 60_000,
});

export const hybridPulseQuery = queryOptions({
  queryKey: openEngineConfigured ? ["pulse", "open-engine"] : ["pulse"],
  queryFn: async (context): Promise<any[]> => {
    if (!openEngineConfigured) return runLegacy<any[]>(legacyPulseQuery, context);

    try {
      const openEngineItems = await openEnginePulseQuery.queryFn!(context as never);
      // Open Engine is an optional acceleration layer. During a degraded
      // deployment or ingestion restart, the public Supabase surface remains
      // usable and must continue to populate the homepage.
      if (openEngineItems.length > 0) return openEngineItems;

      // If the signal projection is temporarily empty, build the homepage feed
      // from the same public entity projection that powers /jobs and /events.
      // This keeps data visible during pulse refresh/rebuild windows.
      const [opportunities, events, projects, publications] = await Promise.all([
        openEngine.latest("opportunity", 40),
        openEngine.latest("event", 20),
        openEngine.latest("project", 20),
        openEngine.latest("publication", 20),
      ]);
      const entityItems = [
        ...(opportunities.items as unknown as EngineEntity[]).map((item) => ({
          ...mapOpportunity(item),
          id: String(item.id),
          category: "PHD",
          event_date: item.last_changed_at ?? item.last_seen_at,
          title: item.title,
          summary: text(dataOf(item)["description"]),
          importance: 80,
          link_url: absoluteUrl(text(dataOf(item)["detail_url"]), item.source_url),
          source_url: item.source_url,
          verification_status: item.verification_status,
          confidence: confidenceLabel(Number(item.confidence) || 0),
          is_demo: false,
          country: item.country,
        })),
        ...(events.items as unknown as EngineEntity[]).map((item) => ({
          ...mapEvent(item),
          id: String(item.id),
          category: "EVENT",
          event_date: item.start_date ?? item.last_changed_at ?? item.last_seen_at,
          title: item.title,
          summary: text(dataOf(item)["description"]),
          importance: 70,
          link_url: item.source_url,
          source_url: item.source_url,
          verification_status: item.verification_status,
          confidence: confidenceLabel(Number(item.confidence) || 0),
          is_demo: false,
          country: item.country,
        })),
        ...(projects.items as unknown as EngineEntity[]).map((item) => ({
          id: String(item.id),
          category: "PROJECT",
          event_date: item.last_changed_at ?? item.last_seen_at,
          title: item.title,
          summary: text(dataOf(item)["description"]),
          importance: 60,
          link_url: item.source_url,
          source_url: item.source_url,
          verification_status: item.verification_status,
          confidence: confidenceLabel(Number(item.confidence) || 0),
          is_demo: false,
          country: item.country,
        })),
        ...(publications.items as unknown as EngineEntity[]).map((item) => ({
          id: String(item.id),
          category: "PAPER",
          event_date: item.published_at ?? item.last_changed_at ?? item.last_seen_at,
          title: item.title,
          summary: text(dataOf(item)["description"]),
          importance: 55,
          link_url: item.source_url,
          source_url: item.source_url,
          verification_status: item.verification_status,
          confidence: confidenceLabel(Number(item.confidence) || 0),
          is_demo: false,
          country: item.country,
        })),
      ];
      if (entityItems.length > 0) {
        return entityItems
          .sort((a, b) => (a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0))
          .slice(0, 100);
      }
    } catch {
      // Fall through to the existing public Supabase pulse surface.
    }

    return runLegacy<any[]>(legacyPulseQuery, context);
  },
  staleTime: 60_000,
});

export const hybridCountsQuery = queryOptions({
  queryKey: openEngineConfigured ? ["counts", "hybrid-open-engine"] : ["counts"],
  queryFn: async (context): Promise<any> => {
    const legacy = await runLegacy<any>(legacyCountsQuery, context);
    if (!openEngineConfigured) return legacy;

    try {
      const [institutions, researchers, opportunities, publications, projects, events] =
        await Promise.all([
          openEngine.latest("institution", 200),
          openEngine.latest("researcher", 200),
          openEngine.latest("opportunity", 200),
          openEngine.latest("publication", 200),
          openEngine.latest("project", 200),
          openEngine.latest("event", 200),
        ]);
      return {
        ...legacy,
        institutions: institutions.items.length > 0 ? institutions.items.length : legacy.institutions,
        researchers: researchers.items.length > 0 ? researchers.items.length : legacy.researchers,
        opportunities: opportunities.items.length > 0 ? opportunities.items.length : legacy.opportunities,
        publications: publications.items.length > 0 ? publications.items.length : legacy.publications,
        projects: projects.items.length > 0 ? projects.items.length : legacy.projects,
        events: events.items.length > 0 ? events.items.length : legacy.events,
      };
    } catch {
      // Never blank the homepage because the optional Open Engine read path is
      // unhealthy. The database-backed aggregate is already available.
      return legacy;
    }
  },
  staleTime: 60_000,
});

export function hybridOpportunityDetailQuery(slug: string): any {
  if (!openEngineConfigured) return legacyOpportunityDetailQuery(slug);
  return queryOptions({
    queryKey: ["opportunity-detail", "open-engine", slug],
    throwOnError: true,
    queryFn: async () => mapOpportunity((await openEngine.entity("opportunity", slug)) as unknown as EngineEntity),
    staleTime: 60_000,
  });
}

export function hybridEventDetailQuery(slug: string): any {
  if (!openEngineConfigured) return legacyEventDetailQuery(slug);
  return queryOptions({
    queryKey: ["event-detail", "open-engine", slug],
    throwOnError: true,
    queryFn: async () => {
      const [entity, eventFeed, opportunityFeed] = await Promise.all([
        openEngine.entity("event", slug),
        openEngine.latest("event", 200),
        openEngine.latest("opportunity", 200),
      ]);
      const event = mapEvent(entity as unknown as EngineEntity) as any;
      const siblings = (eventFeed.items as unknown as EngineEntity[])
        .filter((item) => item.id !== event.id)
        .map(mapEvent)
        .filter((item: any) => !item.end_date || item.end_date >= new Date().toISOString().slice(0, 10))
        .slice(0, 8);
      const calls = (opportunityFeed.items as unknown as EngineEntity[])
        .map(mapOpportunity)
        .filter(
          (item) =>
            (!event.country || item.country === event.country) &&
            ["open", "closing_soon", "rolling", "possibly_open"].includes(item.status),
        )
        .slice(0, 6);
      return { event, topicIds: [], siblings, calls };
    },
    staleTime: 60_000,
  });
}
