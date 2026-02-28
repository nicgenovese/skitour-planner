'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TourLogEntry } from '@/types';
import { DANGER_COLORS } from '@/types';
import { SEED_TOURS } from '@/lib/seed-tours';
import { enrichTourWithHistoricalData } from '@/lib/historical-data';

const DIFFICULTY_OPTIONS = ['L', 'WS', 'WS+', 'ZS', 'ZS+', 'S', 'S+', 'SS', 'AS'];

export default function ToursPage() {
  const [entries, setEntries] = useState<TourLogEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingHistorical, setLoadingHistorical] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    participants: '',
    difficulty: 'WS',
    elevation: '',
    distance: '',
    time: '',
    startPoint: '',
    startElevation: '',
    endPoint: '',
    endElevation: '',
    conditions: '',
    notes: '',
    rating: 3 as 1 | 2 | 3 | 4 | 5,
  });

  // Load entries from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skitour-log');
      if (saved) {
        setEntries(JSON.parse(saved));
      } else {
        setEntries(SEED_TOURS);
        localStorage.setItem('skitour-log', JSON.stringify(SEED_TOURS));
      }
    } catch { /* ignore */ }
  }, []);

  const saveEntries = (updated: TourLogEntry[]) => {
    setEntries(updated);
    localStorage.setItem('skitour-log', JSON.stringify(updated));
  };

  const handleSave = () => {
    if (!formData.name) return;

    const startElev = parseInt(formData.startElevation) || 0;
    const endElev = parseInt(formData.endElevation) || 0;

    const entry: TourLogEntry = {
      id: `tour-${Date.now()}`,
      name: formData.name,
      date: formData.date,
      participants: formData.participants.split(',').map(s => s.trim()).filter(Boolean),
      route: {
        name: formData.name,
        waypoints: [
          { lat: 46.8, lon: 8.2, label: formData.startPoint || 'Start', elevation: startElev },
          { lat: 46.8, lon: 8.2, label: formData.endPoint || 'End', elevation: endElev },
        ],
        dangerZones: [],
        totalElevation: parseInt(formData.elevation) || Math.max(0, endElev - startElev),
        distance: parseFloat(formData.distance) || 0,
        estimatedTime: formData.time || 'N/A',
        difficulty: formData.difficulty,
        keyInfo: formData.notes,
      },
      conditions: formData.conditions,
      notes: formData.notes,
      rating: formData.rating,
      createdAt: Date.now(),
    };

    const updated = [entry, ...entries];
    saveEntries(updated);
    setShowForm(false);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      participants: '',
      difficulty: 'WS',
      elevation: '',
      distance: '',
      time: '',
      startPoint: '',
      startElevation: '',
      endPoint: '',
      endElevation: '',
      conditions: '',
      notes: '',
      rating: 3,
    });
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveEntries(updated);
  };

  const handleFetchHistorical = async (entry: TourLogEntry) => {
    setLoadingHistorical(prev => ({ ...prev, [entry.id]: true }));
    try {
      const enriched = await enrichTourWithHistoricalData(entry);
      const updated = entries.map(e => e.id === entry.id ? enriched : e);
      saveEntries(updated);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    } finally {
      setLoadingHistorical(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  const getStartEnd = (entry: TourLogEntry) => {
    const wps = entry.route.waypoints;
    if (wps.length === 0) return { start: '—', end: '—' };
    return {
      start: `${wps[0].label} (${wps[0].elevation || '?'}m)`,
      end: `${wps[wps.length - 1].label} (${wps[wps.length - 1].elevation || '?'}m)`,
    };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← Map
            </Link>
            <h1 className="text-lg font-bold">Tour Log</h1>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              {entries.length} tours
            </span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 active:bg-blue-700 transition-colors font-medium"
          >
            {showForm ? 'Cancel' : '+ Add Tour'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Add Tour Form */}
        {showForm && (
          <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">New Tour Entry</h2>

            {/* Name + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Tour Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Pizzo Nero 2903m"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Start + End Points */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Start Point</label>
                <input
                  type="text"
                  value={formData.startPoint}
                  onChange={e => setFormData(prev => ({ ...prev, startPoint: e.target.value }))}
                  placeholder="e.g. Realp"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Start Elev. (m)</label>
                <input
                  type="number"
                  value={formData.startElevation}
                  onChange={e => setFormData(prev => ({ ...prev, startElevation: e.target.value }))}
                  placeholder="1538"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">End / Summit</label>
                <input
                  type="text"
                  value={formData.endPoint}
                  onChange={e => setFormData(prev => ({ ...prev, endPoint: e.target.value }))}
                  placeholder="e.g. Stotzigen Firsten"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">End Elev. (m)</label>
                <input
                  type="number"
                  value={formData.endElevation}
                  onChange={e => setFormData(prev => ({ ...prev, endElevation: e.target.value }))}
                  placeholder="2747"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Difficulty + Elevation + Distance + Time */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={e => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                >
                  {DIFFICULTY_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Elevation (m)</label>
                <input
                  type="number"
                  value={formData.elevation}
                  onChange={e => setFormData(prev => ({ ...prev, elevation: e.target.value }))}
                  placeholder="1250"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Distance (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.distance}
                  onChange={e => setFormData(prev => ({ ...prev, distance: e.target.value }))}
                  placeholder="10"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Time</label>
                <input
                  type="text"
                  value={formData.time}
                  onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  placeholder="4-5h"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Participants */}
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Participants</label>
              <input
                type="text"
                value={formData.participants}
                onChange={e => setFormData(prev => ({ ...prev, participants: e.target.value }))}
                placeholder="Jonas Widmer, Lukas Preiswerk"
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
              />
            </div>

            {/* Conditions + Notes */}
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Conditions</label>
              <input
                type="text"
                value={formData.conditions}
                onChange={e => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
                placeholder="Pulverschnee; wenig Wind"
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Tour notes, observations..."
                rows={3}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Rating:</span>
              {[1, 2, 3, 4, 5].map(r => (
                <button
                  key={r}
                  onClick={() => setFormData(prev => ({ ...prev, rating: r as any }))}
                  className={`text-xl transition-colors ${r <= formData.rating ? 'text-yellow-400' : 'text-slate-600'}`}
                >
                  ★
                </button>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={!formData.name}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-40 transition-colors font-medium text-sm"
            >
              Save Tour
            </button>
          </div>
        )}

        {/* Tour list */}
        <div className="space-y-2">
          {entries.map(entry => {
            const { start, end } = getStartEnd(entry);
            const dangerLevel = entry.historicalAvalanche?.maxDangerLevel;
            const isExpanded = expandedId === entry.id;
            const isLoading = loadingHistorical[entry.id];

            return (
              <div
                key={entry.id}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full p-3 flex items-start gap-3 text-left hover:bg-slate-750 transition-colors"
                >
                  {/* Danger badge */}
                  {dangerLevel && dangerLevel > 0 ? (
                    <span
                      className="danger-badge flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: DANGER_COLORS[dangerLevel] || '#94a3b8' }}
                    >
                      {dangerLevel}
                    </span>
                  ) : (
                    <span className="danger-badge flex-shrink-0 mt-0.5 bg-slate-700 text-slate-400">
                      ?
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{entry.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {entry.date} · {entry.route.difficulty} · ↑{entry.route.totalElevation}m · {entry.route.distance}km
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {start} → {end}
                    </p>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(r => (
                        <span key={r} className={`text-xs ${r <= entry.rating ? 'text-yellow-400' : 'text-slate-700'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-500 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-700">
                    {/* Participants */}
                    {entry.participants.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Participants</p>
                        <p className="text-xs text-slate-300">{entry.participants.join(', ')}</p>
                      </div>
                    )}

                    {/* Conditions + Notes */}
                    {entry.conditions && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Conditions</p>
                        <p className="text-xs text-slate-300">{entry.conditions}</p>
                      </div>
                    )}
                    {entry.notes && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Notes</p>
                        <p className="text-xs text-slate-300">{entry.notes}</p>
                      </div>
                    )}

                    {/* Historical data */}
                    {entry.historicalWeather?.days && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Weather on Tour Day</p>
                        <div className="flex gap-3 mt-1">
                          {entry.historicalWeather.days.map((day, i) => (
                            <div key={i} className="text-xs text-slate-400">
                              <span className="text-slate-500">{day.date}: </span>
                              {day.tempMin}°/{day.tempMax}°C
                              {day.snowfall > 0 && <span className="text-blue-300"> · {day.snowfall}cm snow</span>}
                              {day.windSpeedMax > 40 && <span className="text-red-400"> · wind {day.windSpeedMax}km/h</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {entry.historicalAvalanche && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Avalanche Bulletin</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="danger-badge"
                            style={{ backgroundColor: DANGER_COLORS[entry.historicalAvalanche.maxDangerLevel] || '#94a3b8' }}
                          >
                            {entry.historicalAvalanche.maxDangerLevel}
                          </span>
                          <span className="text-xs text-slate-400">
                            {entry.historicalAvalanche.regionName}
                          </span>
                        </div>
                        {entry.historicalAvalanche.problems && entry.historicalAvalanche.problems.length > 0 && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            Problems: {entry.historicalAvalanche.problems.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Fetch historical data button */}
                    {(!entry.historicalWeather || !entry.historicalAvalanche) && (
                      <button
                        onClick={() => handleFetchHistorical(entry)}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 bg-slate-700 text-blue-400 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-3 h-3 border-2 border-slate-500 border-t-blue-400 rounded-full spinner" />
                            Fetching data...
                          </>
                        ) : (
                          'Fetch Historical Weather & Avalanche Data'
                        )}
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      Delete Tour
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No tours logged yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Add Your First Tour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
