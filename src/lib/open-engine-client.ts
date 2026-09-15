import { supabase } from "@/integrations/supabase/client";

// Public reads are served from the Supabase open-engine RPC surface. Cloud Run is
// the ingestion runtime, not a browser-facing read dependency. Keeping reads on
// Supabase avoids adding a failed/decommissioned API hop to every cold page load.
const OPEN_ENGINE_SNAPSHOT_URL = import.meta.env["VITE_GEOACADEMIC_SNAPSHOT_URL"] || "";

// The open-engine read model is available through Supabase even when no separate
// HTTP API URL is configured.
export const openEngineConfigured = true;

export type OpenEngineFeed<T = Record<string, unknown>> = {
  entity_type: string;
  items: T[];
};

export type OpenEnginePulse<T = Record<string, unknown>> = {
  items: T[];
  window_hours: number;
};

type PublicSnapshot = {
  generated_at: string;
  pulse: OpenEnginePulse;
  pulse_summary: Record<string, unknown>;
  latest: Record<string, Record<string, unknown>[]>;
};

class NonFallbackApiError extends Error {}

let snapshotPromise: Promise<PublicSnapshot> | null = null;

async function publicSnapshot(signal?: AbortSignal): Promise<PublicSnapshot> {
  if (!OPEN_ENGINE_SNAPSHOT_URL) {
    throw new Error("VITE_GEOACADEMIC_SNAPSHOT_URL is not configured");
  }
  if (!snapshotPromise) {
    snapshotPromise = fetch(OPEN_ENGINE_SNAPSHOT_URL, {
      signal: signal ?? null,
      headers: { accept: "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`GeoAcademic snapshot ${response.status}`);
      }
      return (await response.json()) as PublicSnapshot;
    });
    globalThis.setTimeout(() => {
      snapshotPromise = null;
    }, 5 * 60 * 1000);
  }
  return snapshotPromise;
}

async function snapshotFallback<T>(path: string, signal?: AbortSignal): Promise<T> {
  const snapshot = await publicSnapshot(signal);
  if (path.startsWith("/v1/pulse/latest")) {
    return snapshot.pulse as T;
  }
  if (path.startsWith("/v1/pulse/summary")) {
    return snapshot.pulse_summary as T;
  }
  const latestMatch = path.match(/^\/v1\/latest\/([^?]+)/);
  if (latestMatch) {
    const entityType = decodeURIComponent(latestMatch[1] ?? "");
    return {
      entity_type: entityType,
      items: snapshot.latest[entityType] ?? [],
      snapshot_generated_at: snapshot.generated_at,
    } as T;
  }
  throw new Error(`No public snapshot fallback for ${path}`);
}

function queryParams(path: string): URLSearchParams {
  const index = path.indexOf("?");
  return new URLSearchParams(index >= 0 ? path.slice(index + 1) : "");
}

async function rpcFallback<T>(path: string): Promise<T> {
  const params = queryParams(path);
  const rpc = (supabase as any).rpc.bind(supabase);

  if (path === "/health") {
    const { data, error } = await rpc("geoacademic_open_engine_latest", {
      p_entity_type: "event",
      p_limit: 1,
      p_country: null,
    });
    if (error) throw error;
    return {
      ok: true,
      service: "geoacademic-open-engine-supabase",
      fallback: "supabase",
      sample_items: Array.isArray(data?.items) ? data.items.length : 0,
    } as T;
  }

  const latestMatch = path.match(/^\/v1\/latest\/([^?]+)/);
  if (latestMatch) {
    const { data, error } = await rpc("geoacademic_open_engine_latest", {
      p_entity_type: decodeURIComponent(latestMatch[1] ?? ""),
      p_limit: Number(params.get("limit") || 50),
      p_country: params.get("country"),
    });
    if (error) throw error;
    return data as T;
  }

  if (path.startsWith("/v1/pulse/latest")) {
    const { data, error } = await rpc("geoacademic_open_engine_pulse", {
      p_hours: Number(params.get("hours") || 24),
      p_limit: Number(params.get("limit") || 50),
      p_country: params.get("country"),
      p_topic: params.get("topic"),
    });
    if (error) throw error;
    return data as T;
  }

  if (path.startsWith("/v1/pulse/summary")) {
    const hours = Number(params.get("hours") || 24);
    const { data, error } = await rpc("geoacademic_open_engine_pulse", {
      p_hours: hours,
      p_limit: 200,
      p_country: null,
      p_topic: null,
    });
    if (error) throw error;
    const items = Array.isArray(data?.items) ? data.items : [];
    const byType = new Map<string, number>();
    for (const item of items) {
      const type = typeof item?.signal_type === "string" ? item.signal_type : "unknown";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    return {
      window_hours: hours,
      total: items.length,
      by_type: [...byType.entries()].map(([signal_type, count]) => ({ signal_type, count })),
      fallback: "supabase",
    } as T;
  }

  const entityMatch = path.match(/^\/v1\/entities\/([^/]+)\/([^?]+)/);
  if (entityMatch) {
    const { data, error } = await rpc("geoacademic_open_engine_entity", {
      p_entity_type: decodeURIComponent(entityMatch[1] ?? ""),
      p_slug: decodeURIComponent(entityMatch[2] ?? ""),
    });
    if (error) throw error;
    if (!data) throw new NonFallbackApiError(`GeoAcademic entity not found: ${path}`);
    return data as T;
  }

  if (path.startsWith("/v1/search")) {
    const { data, error } = await rpc("geoacademic_open_engine_search", {
      p_query: params.get("q") || "",
      p_limit: Number(params.get("limit") || 20),
    });
    if (error) throw error;
    return data as T;
  }

  throw new Error(`No Supabase Open Engine fallback for ${path}`);
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    return await rpcFallback<T>(path);
  } catch (rpcError) {
    if (rpcError instanceof NonFallbackApiError || signal?.aborted) throw rpcError;
    if (!OPEN_ENGINE_SNAPSHOT_URL) throw rpcError;
    return snapshotFallback<T>(path, signal);
  }
}

export const openEngine = {
  health: (signal?: AbortSignal) => request<{ ok: boolean }>("/health", signal),
  pulse: (hours = 24, limit = 50, signal?: AbortSignal) =>
    request<OpenEnginePulse>(`/v1/pulse/latest?hours=${hours}&limit=${limit}`, signal),
  pulseSummary: (hours = 24, signal?: AbortSignal) =>
    request<Record<string, unknown>>(`/v1/pulse/summary?hours=${hours}`, signal),
  latest: (entityType: string, limit = 50, signal?: AbortSignal) =>
    request<OpenEngineFeed>(`/v1/latest/${encodeURIComponent(entityType)}?limit=${limit}`, signal),
  entity: (entityType: string, slug: string, signal?: AbortSignal) =>
    request<Record<string, unknown>>(
      `/v1/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(slug)}`,
      signal,
    ),
  search: (query: string, limit = 20, signal?: AbortSignal) =>
    request<{ query: string; items: Record<string, unknown>[] }>(
      `/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      signal,
    ),
};
