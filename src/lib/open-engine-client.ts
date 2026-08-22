const OPEN_ENGINE_URL = (import.meta.env["VITE_GEOACADEMIC_API_URL"] || "").replace(/\/$/, "");
const OPEN_ENGINE_SNAPSHOT_URL = import.meta.env["VITE_GEOACADEMIC_SNAPSHOT_URL"] || "";

export const openEngineConfigured = Boolean(OPEN_ENGINE_URL);

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
      signal,
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
    const entityType = decodeURIComponent(latestMatch[1]);
    return {
      entity_type: entityType,
      items: snapshot.latest[entityType] || [],
      snapshot_generated_at: snapshot.generated_at,
    } as T;
  }
  throw new Error(`No public snapshot fallback for ${path}`);
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!OPEN_ENGINE_URL) {
    throw new Error("VITE_GEOACADEMIC_API_URL is not configured");
  }
  try {
    const response = await fetch(`${OPEN_ENGINE_URL}${path}`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      if (response.status < 500) {
        throw new NonFallbackApiError(`GeoAcademic API ${response.status}: ${path}`);
      }
      return await snapshotFallback<T>(path, signal);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof NonFallbackApiError || signal?.aborted || !OPEN_ENGINE_SNAPSHOT_URL) {
      throw error;
    }
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
