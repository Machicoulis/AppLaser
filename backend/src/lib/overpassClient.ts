import { createHash } from "node:crypto";

// overpass-api.de (l'instance historique) bloque de plus en plus le trafic automatisé (erreur 406) ;
// on tente d'abord des miroirs plus permissifs, avec repli sur l'instance historique en dernier recours.
const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h : les données OSM d'une zone ne changent pas d'une session à l'autre
const USER_AGENT = "AppLaser/0.1 (usage personnel, generateur de cartes laser)";
const TIMEOUT_MS = 20_000; // un miroir qui ne répond pas du tout ne doit pas bloquer indéfiniment

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

  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "fr,en;q=0.5",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        lastError = new Error(`${url} a répondu ${response.status}`);
        console.warn(lastError);
        continue;
      }
      const data = (await response.json()) as OverpassResponse;
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } catch (err) {
      lastError = err;
      const reason = err instanceof Error && err.name === "TimeoutError" ? `pas de réponse après ${TIMEOUT_MS / 1000}s` : err;
      console.warn(`Échec de connexion à ${url} :`, reason);
    }
  }
  throw lastError;
}
