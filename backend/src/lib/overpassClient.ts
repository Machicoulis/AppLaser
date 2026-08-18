import { createHash } from "node:crypto";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h : les données OSM d'une zone ne changent pas d'une session à l'autre

interface CacheEntry {
  data: OverpassResponse;
  expiresAt: number;
}

export interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

export interface OverpassWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: (OverpassNode | OverpassWay)[];
}

const cache = new Map<string, CacheEntry>();

export async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const key = createHash("sha256").update(query).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(`Overpass API a répondu ${response.status}`);
  }
  const data = (await response.json()) as OverpassResponse;
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
