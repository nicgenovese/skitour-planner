'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadTourIndex, getTourByIdAsync, getRegions, type TourIndexEntry } from '@/lib/tour-database';
import type { RouteData } from '@/types';

interface Props {
  onTourSelected: (route: RouteData) => void;
}

const DIFFICULTY_OPTIONS = ['L', 'WS', 'ZS', 'S', 'SS'];

export default function TourBrowser({ onTourSelected }: Props) {
  const [allTours, setAllTours] = useState<TourIndexEntry[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTour, setLoadingTour] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    loadTourIndex().then(data => {
      setAllTours(data);
      setRegions(getRegions());
      setLoading(false);
    });
  }, []);

  const filteredTours = useMemo(() => {
    let result = allTours;

    if (query.trim()) {
      const words = query.toLowerCase().trim().split(/\s+/);
      result = result.filter(t => {
        const text = `${t.n} ${t.rd} ${t.rg}`.toLowerCase();
        return words.every(w => text.includes(w));
      });
    }

    if (region) {
      result = result.filter(t => t.rg === region);
    }

    if (difficulty) {
      result = result.filter(t => t.d.startsWith(difficulty));
    }

    return result.slice(0, 50);
  }, [allTours, query, region, difficulty]);

  const handleSelect = useCallback(async (tour: TourIndexEntry) => {
    setLoadingTour(tour.id);
    try {
      const full = await getTourByIdAsync(tour.id);
      if (full) {
        const route: RouteData = {
          name: full.name,
          waypoints: [
            { lat: full.startPoint.lat, lon: full.startPoint.lon, label: full.startPoint.label, elevation: 0 },
            ...full.waypoints.slice(1, -1).map(wp => ({ lat: wp.lat, lon: wp.lon, label: '', elevation: 0 })),
            { lat: full.summit.lat, lon: full.summit.lon, label: full.summit.label || full.name, elevation: full.summit.elevation },
          ],
          dangerZones: [],
          totalElevation: full.totalElevation,
          distance: full.distance,
          estimatedTime: full.estimatedTime,
          difficulty: full.difficulty,
          keyInfo: full.routeDesc,
        };
        onTourSelected(route);
      }
    } finally {
      setLoadingTour(null);
    }
  }, [onTourSelected]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-white/10 rounded-full mx-auto mb-2" style={{ borderTopColor: '#007AFF', animation: 'spin 1s linear infinite' }} />
          <p className="text-xs text-white/30">Loading tours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-white/[0.04] flex-shrink-0 space-y-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tours..."
          className="w-full bg-white/[0.05] text-sm text-white placeholder-white/20 px-3 py-2 rounded-lg outline-none border border-white/[0.04] focus:border-[#007AFF]/30 transition-colors"
          style={{ fontSize: '16px' }}
        />

        <div className="flex gap-2">
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="flex-1 bg-white/[0.05] text-[11px] text-white/60 px-2 py-1.5 rounded-lg outline-none border border-white/[0.04] cursor-pointer"
          >
            <option value="">All regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            className="w-20 bg-white/[0.05] text-[11px] text-white/60 px-2 py-1.5 rounded-lg outline-none border border-white/[0.04] cursor-pointer"
          >
            <option value="">All</option>
            {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Tour count */}
      <div className="px-3 py-1.5 flex-shrink-0">
        <p className="text-[10px] text-white/20 uppercase font-semibold tracking-wider">
          {filteredTours.length} tours{filteredTours.length >= 50 ? '+' : ''}
        </p>
      </div>

      {/* Tour list */}
      <div className="flex-1 min-h-0 overflow-y-auto ios-scroll chat-scroll px-3 pb-3 space-y-1">
        {filteredTours.map(tour => (
          <button
            key={tour.id}
            onClick={() => handleSelect(tour)}
            disabled={loadingTour === tour.id}
            className="w-full text-left rounded-xl p-3 glass-card hover:bg-white/[0.06] active:scale-[0.98] transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{tour.n}</p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {tour.d || '—'} · ↑{tour.e || '?'}m
                  {tour.a ? ` · ${tour.a}m` : ''}
                </p>
              </div>
              <span className="text-[9px] text-white/15 font-medium flex-shrink-0 mt-0.5">
                {loadingTour === tour.id ? '...' : tour.rg}
              </span>
            </div>
          </button>
        ))}

        {filteredTours.length === 0 && (
          <div className="text-center py-10">
            <p className="text-white/30 text-sm">No tours found</p>
            <p className="text-white/15 text-xs mt-1">Try a different search</p>
          </div>
        )}
      </div>
    </div>
  );
}
