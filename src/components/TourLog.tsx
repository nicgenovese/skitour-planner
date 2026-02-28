'use client';

import { useState, useEffect } from 'react';
import type { TourLogEntry, RouteData } from '@/types';
import { DANGER_COLORS } from '@/types';
import Link from 'next/link';

interface Props {
  entries: TourLogEntry[];
  onEntriesChange: (entries: TourLogEntry[]) => void;
  currentRoute: RouteData | null;
  onViewTour?: (entry: TourLogEntry) => void;
}

export default function TourLog({ entries, onEntriesChange, currentRoute, onViewTour }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    participants: '',
    conditions: '',
    notes: '',
    rating: 3 as 1 | 2 | 3 | 4 | 5,
  });

  useEffect(() => {
    if (currentRoute && showForm) {
      setFormData(prev => ({
        ...prev,
        name: currentRoute.name,
      }));
    }
  }, [currentRoute, showForm]);

  const handleSave = () => {
    if (!currentRoute || !formData.name) return;

    const entry: TourLogEntry = {
      id: `tour-${Date.now()}`,
      name: formData.name,
      date: formData.date,
      participants: formData.participants.split(',').map(s => s.trim()).filter(Boolean),
      route: currentRoute,
      conditions: formData.conditions,
      notes: formData.notes,
      rating: formData.rating,
      createdAt: Date.now(),
    };

    const updated = [entry, ...entries];
    onEntriesChange(updated);
    localStorage.setItem('skitour-log', JSON.stringify(updated));
    setShowForm(false);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      participants: '',
      conditions: '',
      notes: '',
      rating: 3,
    });
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    onEntriesChange(updated);
    localStorage.setItem('skitour-log', JSON.stringify(updated));
  };

  const getStartEnd = (entry: TourLogEntry) => {
    const wps = entry.route.waypoints;
    if (wps.length === 0) return { start: '—', end: '—' };
    const start = `${wps[0].label} (${wps[0].elevation || '?'}m)`;
    const end = `${wps[wps.length - 1].label} (${wps[wps.length - 1].elevation || '?'}m)`;
    return { start, end };
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Tour Log
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href="/tours"
            className="text-[10px] px-2 py-0.5 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-colors"
          >
            All Tours
          </Link>
          {currentRoute && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
            >
              {showForm ? 'Cancel' : '+ Log Tour'}
            </button>
          )}
        </div>
      </div>

      {/* Add tour form */}
      {showForm && currentRoute && (
        <div className="mb-3 p-2 bg-slate-800/50 rounded-lg space-y-2">
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Tour name"
            className="w-full bg-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-200 outline-none"
          />
          <input
            type="date"
            value={formData.date}
            onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full bg-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-200 outline-none"
          />
          <input
            type="text"
            value={formData.participants}
            onChange={e => setFormData(prev => ({ ...prev, participants: e.target.value }))}
            placeholder="Participants (comma separated)"
            className="w-full bg-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-200 outline-none"
          />
          <input
            type="text"
            value={formData.conditions}
            onChange={e => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
            placeholder="Snow/weather conditions"
            className="w-full bg-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-200 outline-none"
          />
          <textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes..."
            rows={2}
            className="w-full bg-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-200 outline-none resize-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rating:</span>
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                onClick={() => setFormData(prev => ({ ...prev, rating: r as any }))}
                className={`text-base ${r <= formData.rating ? 'text-yellow-400' : 'text-slate-600'}`}
              >
                ★
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={!formData.name}
            className="w-full text-xs py-1.5 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-40 transition-colors"
          >
            Save to Log
          </button>
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          No tours logged yet. Plan a route and save it here.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto chat-scroll">
          {entries.map(entry => {
            const { start, end } = getStartEnd(entry);
            const dangerLevel = entry.historicalAvalanche?.maxDangerLevel;

            return (
              <div
                key={entry.id}
                className="tour-entry p-2 bg-slate-800/30 rounded-lg hover:bg-slate-800/60 group cursor-pointer"
                onClick={() => onViewTour?.(entry)}
              >
                <div className="flex items-start gap-2">
                  {/* Danger level badge */}
                  {dangerLevel && dangerLevel > 0 && (
                    <span
                      className="danger-badge flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: DANGER_COLORS[dangerLevel] || '#94a3b8' }}
                    >
                      {dangerLevel}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{entry.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {entry.date} · {entry.route.difficulty} · ↑{entry.route.totalElevation}m
                    </p>
                    <p className="text-[10px] text-slate-600 truncate">
                      {start} → {end}
                    </p>
                    {/* Historical weather snippet */}
                    {entry.historicalWeather?.days?.[1] && (
                      <p className="text-[9px] text-slate-600 mt-0.5">
                        {entry.historicalWeather.days[1].tempMin}°/{entry.historicalWeather.days[1].tempMax}°C
                        {entry.historicalWeather.days[1].snowfall > 0 && ` · ${entry.historicalWeather.days[1].snowfall}cm snow`}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(r => (
                          <span key={r} className={`text-[10px] ${r <= entry.rating ? 'text-yellow-400' : 'text-slate-700'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                      {entry.participants.length > 0 && (
                        <span className="text-[9px] text-slate-600 truncate">
                          · {entry.participants.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs flex-shrink-0"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
