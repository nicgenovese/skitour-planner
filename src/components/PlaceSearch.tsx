'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeoResult } from '@/types';

interface Props {
  onSelect: (lat: number, lon: number) => void;
}

export default function PlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: GeoResult) => {
    setQuery(result.label);
    setOpen(false);
    onSelect(result.lat, result.lon);
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-slate-800/90 rounded-lg shadow-lg backdrop-blur-sm">
        <svg className="w-4 h-4 ml-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Search places in Switzerland..."
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none"
        />
        {loading && (
          <div className="mr-3 w-4 h-4 border-2 border-slate-500 border-t-blue-400 rounded-full spinner" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-slate-800/95 rounded-lg shadow-xl backdrop-blur-sm max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/80 transition-colors border-b border-slate-700/50 last:border-0"
            >
              <p className="text-slate-200 font-medium truncate">{r.label}</p>
              {r.detail && <p className="text-xs text-slate-400 truncate">{r.detail}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
