const OPEN_ENGINE_URL = (import.meta.env["VITE_GEOACADEMIC_API_URL"] || "").replace(/\/$/, "");

export const openEngineConfigured = Boolean(OPEN_ENGINE_URL);

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!OPEN_ENGINE_URL) {
    throw new Error("VITE_GEOACADEMIC_API_URL is not configured");
  }
  const response = await fetch(`${OPEN_ENGINE_URL}${path}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GeoAcademic API ${response.status}: ${path}`);
  }
  return (await response.json()) as T;
}

export type OpenEngineFeed<T = Record<string, unknown>> = {
  entity_type: string;
  items: T[];
};

export type OpenEnginePulse<T = Record<string, unknown>> = {
  items: T[];
  window_hours: number;
};

export const openEngine = {
  health: (signal?: AbortSignal) => request<{ ok: boolean }>("/health", signal),
  pulse: (hours = 24, limit = 50, signal?: AbortSignal) =>
    request<OpenEnginePulse>(`/v1/pulse/latest?hours=${hours}&limit=${limit}`, signal),
  pulseSummary: (hours = 24, signal?: AbortSignal) =>
    request<Record<string, unknown>>(`/v1/pulse/summary?hours=${hours}`, signal),
  latest: (entityType: string, limit = 50, signal?: AbortSignal) =>
    request<OpenEngineFeed>(`/v1/latest/${encodeURIComponent(entityType)}?limit=${limit}`, signal),
  search: (query: string, limit = 20, signal?: AbortSignal) =>
    request<{ query: string; items: Record<string, unknown>[] }>(
      `/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      signal,
    ),
};
