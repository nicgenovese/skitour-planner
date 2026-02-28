/**
 * Client-side tour database — loads verified Swiss ski tours
 * from the static JSON built by scripts/build-tour-db.js.
 *
 * All coordinates are real WGS84 from Swisstopo (OGD).
 */

export interface TourEntry {
  id: string;
  name: string;
  routeDesc: string;
  difficulty: string;
  startPoint: { lat: number; lon: number; label: string };
  summit: { lat: number; lon: number; label: string; elevation: number };
  waypoints: { lat: number; lon: number }[];
  totalElevation: number;
  distance: number;
  estimatedTime: string;
  sacUrl: string;
  region: string;
}

/** Compact index entry — much smaller than full TourEntry (no waypoints) */
export interface TourIndexEntry {
  id: string;
  n: string;    // name
  d: string;    // difficulty
  e: number;    // totalElevation
  a: number;    // summit altitude
  rg: string;   // region
  rd: string;   // routeDesc
}

let _tours: TourEntry[] | null = null;
let _loading: Promise<TourEntry[]> | null = null;
let _index: TourIndexEntry[] | null = null;
let _indexLoading: Promise<TourIndexEntry[]> | null = null;

/** Load compact tour index (~350KB vs 2.2MB full DB) — for browsing/searching */
export async function loadTourIndex(): Promise<TourIndexEntry[]> {
  if (_index) return _index;
  if (_indexLoading) return _indexLoading;

  _indexLoading = fetch('/data/swiss-tours-index.json')
    .then(r => r.json())
    .then((data: TourIndexEntry[]) => {
      _index = data;
      return data;
    });

  return _indexLoading;
}

/** Load the full tour database (cached after first load) */
export async function loadTourDB(): Promise<TourEntry[]> {
  if (_tours) return _tours;
  if (_loading) return _loading;

  _loading = fetch('/data/swiss-tours.json')
    .then(r => r.json())
    .then((data: TourEntry[]) => {
      _tours = data;
      return data;
    });

  return _loading;
}

/** Get a tour by ID — loads full DB if not already loaded */
export async function getTourByIdAsync(id: string): Promise<TourEntry | undefined> {
  if (_tours) return _tours.find(t => t.id === id);
  const tours = await loadTourDB();
  return tours.find(t => t.id === id);
}

/** Get a tour by ID (sync — only works if DB already loaded) */
export function getTourById(id: string): TourEntry | undefined {
  return _tours?.find(t => t.id === id);
}

/** Search tours by name, region, or route description */
export function searchTours(query: string, tours?: TourEntry[]): TourEntry[] {
  const db = tours || _tours || [];
  const q = query.toLowerCase().trim();
  if (!q) return db.slice(0, 50);

  const words = q.split(/\s+/);
  return db.filter(t => {
    const text = `${t.name} ${t.routeDesc} ${t.region} ${t.startPoint.label} ${t.summit.label}`.toLowerCase();
    return words.every(w => text.includes(w));
  }).slice(0, 50);
}

/** Filter tours by criteria */
export function filterTours(opts: {
  region?: string;
  difficulty?: string[];
  minElevation?: number;
  maxElevation?: number;
  nearLat?: number;
  nearLon?: number;
  radiusKm?: number;
}, tours?: TourEntry[]): TourEntry[] {
  const db = tours || _tours || [];
  let filtered = db;

  if (opts.region) {
    filtered = filtered.filter(t => t.region === opts.region);
  }

  if (opts.difficulty && opts.difficulty.length > 0) {
    filtered = filtered.filter(t => opts.difficulty!.some(d => t.difficulty.startsWith(d)));
  }

  if (opts.minElevation) {
    filtered = filtered.filter(t => t.totalElevation >= opts.minElevation!);
  }

  if (opts.maxElevation) {
    filtered = filtered.filter(t => t.totalElevation <= opts.maxElevation!);
  }

  if (opts.nearLat !== undefined && opts.nearLon !== undefined) {
    const r = opts.radiusKm || 30;
    filtered = filtered
      .map(t => ({
        ...t,
        _dist: haversine(opts.nearLat!, opts.nearLon!, t.summit.lat, t.summit.lon),
      }))
      .filter(t => t._dist <= r)
      .sort((a, b) => a._dist - b._dist) as any[];
  }

  return filtered.slice(0, 100);
}

/** Get all unique regions (works with index or full DB) */
export function getRegions(): string[] {
  if (_index) {
    const set = new Set(_index.map(t => t.rg));
    return Array.from(set).sort();
  }
  if (!_tours) return [];
  const set = new Set(_tours.map(t => t.region));
  return Array.from(set).sort();
}

/** Find tours near a coordinate (for AI pre-filtering) */
export function toursNear(lat: number, lon: number, radiusKm: number = 30): TourEntry[] {
  const db = _tours || [];
  return db
    .map(t => ({ ...t, _dist: haversine(lat, lon, t.summit.lat, t.summit.lon) }))
    .filter(t => t._dist <= radiusKm)
    .sort((a, b) => a._dist - b._dist);
}

/** Build a compact tour list string for AI prompt injection */
export function buildTourContext(tours: TourEntry[]): string {
  return tours.map(t =>
    `[${t.id}] ${t.name} | ${t.difficulty} | ↑${t.totalElevation}m | ${t.estimatedTime} | ${t.region} | ${t.routeDesc}`
  ).join('\n');
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
