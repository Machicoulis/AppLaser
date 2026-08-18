const API_BASE = "http://localhost:4000/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Erreur API ${path} : ${res.status}`);
  return res.json() as Promise<T>;
}
