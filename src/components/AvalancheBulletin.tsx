'use client';

import { useState, useEffect } from 'react';
import { parseBulletinJSON, type ParsedBulletin, type RegionBulletin } from '@/lib/avalanche-parser';
import { DANGER_COLORS } from '@/types';

interface Props {
  onBulletinLoaded?: (bulletin: ParsedBulletin) => void;
}

function DangerBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white"
      style={{ backgroundColor: DANGER_COLORS[level] || '#94a3b8' }}
    >
      {level}
    </span>
  );
}

function AspectRose({ aspects }: { aspects: string[] }) {
  const all = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (
    <div className="inline-grid grid-cols-3 gap-0.5 text-[9px] leading-none">
      {[' ', 'N', ' ', 'NW', '', 'NE', 'W', '+', 'E', 'SW', '', 'SE', ' ', 'S', ' '].map((label, i) => {
        if (label === '' || label === '+') {
          return <span key={i} className="w-3.5 h-3.5" />;
        }
        const active = aspects.includes(label);
        return (
          <span
            key={i}
            className={`w-3.5 h-3.5 flex items-center justify-center rounded-sm ${
              active ? 'bg-orange-500 text-white font-bold' : 'text-slate-600'
            }`}
          >
            {label.trim() ? label : ''}
          </span>
        );
      })}
    </div>
  );
}

export default function AvalancheBulletin({ onBulletinLoaded }: Props) {
  const [bulletin, setBulletin] = useState<ParsedBulletin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/avalanche')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        const parsed = parseBulletinJSON(data);
        if (parsed) {
          setBulletin(parsed);
          onBulletinLoaded?.(parsed);
        } else {
          setError('Could not parse bulletin');
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [onBulletinLoaded]);

  if (loading) {
    return (
      <div className="p-3 flex items-center gap-2 text-xs text-slate-400">
        <div className="w-3 h-3 border-2 border-slate-500 border-t-orange-400 rounded-full spinner" />
        Loading SLF bulletin...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <p className="text-xs text-red-400">Bulletin unavailable: {error}</p>
        <a
          href="https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 underline mt-1 block"
        >
          Check SLF directly
        </a>
      </div>
    );
  }

  if (!bulletin) return null;

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Avalanche Bulletin
        </h3>
        <span className="text-[10px] text-slate-500">
          {bulletin.regions.length} regions
        </span>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto chat-scroll">
        {bulletin.regions.map(region => {
          const maxLevel = Math.max(...region.dangerRatings.map(r => r.level), 1);
          const isExpanded = expandedRegion === region.regionId;

          return (
            <div
              key={region.regionId}
              className="rounded bg-slate-800/50 overflow-hidden"
            >
              <button
                onClick={() => setExpandedRegion(isExpanded ? null : region.regionId)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-700/50 transition-colors"
              >
                <DangerBadge level={maxLevel} />
                <span className="text-xs text-slate-300 flex-1 truncate">
                  {region.regionName}
                </span>
                <svg
                  className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 space-y-2">
                  {region.dangerRatings.map((dr, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <DangerBadge level={dr.level} />
                      <div>
                        <p className="text-slate-300">
                          {dr.levelLabel} — {dr.elevationBand || 'all elevations'}
                        </p>
                        <div className="mt-1">
                          <AspectRose aspects={dr.aspects} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {region.problems.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Problems:</p>
                      {region.problems.map((p, i) => (
                        <p key={i} className="text-[10px] text-slate-400">
                          &bull; {p.type.replace(/_/g, ' ')}
                          {p.aspects.length > 0 && ` (${p.aspects.join(', ')})`}
                        </p>
                      ))}
                    </div>
                  )}

                  {region.snowpackComment && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-3">
                      {region.snowpackComment}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-slate-600 mt-2">
        Source: WSL/SLF &mdash;{' '}
        <a
          href="https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          slf.ch
        </a>
      </p>
    </div>
  );
}
