import { useState } from "react";
import { apiGet } from "../../api/client";
import type { LatLng } from "./geo";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressSearchProps {
  onSelect: (center: LatLng) => void;
}

export function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<NominatimResult[]>(`/geocode/search?q=${encodeURIComponent(query)}`);
      setResults(data);
      if (data.length === 0) setError("Aucun résultat");
    } catch {
      setError("Recherche indisponible (backend non lancé ?)");
    } finally {
      setLoading(false);
    }
  }

  function pick(result: NominatimResult) {
    onSelect({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setResults([]);
    setQuery(result.display_name);
  }

  return (
    <div className="address-search">
      <form onSubmit={search}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ville, adresse..."
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : "Rechercher"}
        </button>
      </form>
      {error && <p className="address-search__error">{error}</p>}
      {results.length > 0 && (
        <ul className="address-search__results">
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" onClick={() => pick(r)}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
