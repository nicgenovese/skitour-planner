'use client';

import { useState, useEffect } from 'react';
import type { TourLogEntry, RouteData } from '@/types';

interface Props {
  entries: TourLogEntry[];
  onEntriesChange: (entries: TourLogEntry[]) => void;
  currentRoute: RouteData | null;
}

export default function TourLog({ entries, onEntriesChange, currentRoute }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    participants: '',
    conditions: '',
    notes: '',
    rating: 3 as 1 | 2 | 3 | 4 | 5,
  });

  // Pre-fill from current route
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

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Tour Log
        </h3>
        {currentRoute && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Log Tour'}
          </button>
        )}
      </div>

      {/* Add tour form */}
      {showForm && currentRoute && (
        <div className="mb-3 p-2 bg-slate-800/50 rounded-lg space-y-2">
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Tour name"
            className="w-full bg-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none"
          />
          <input
            type="date"
            value={formData.date}
            onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full bg-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none"
          />
          <input
            type="text"
            value={formData.participants}
            onChange={e => setFormData(prev => ({ ...prev, participants: e.target.value }))}
            placeholder="Participants (comma separated)"
            className="w-full bg-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none"
          />
          <input
            type="text"
            value={formData.conditions}
            onChange={e => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
            placeholder="Snow/weather conditions"
            className="w-full bg-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none"
          />
          <textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes..."
            rows={2}
            className="w-full bg-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none resize-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rating:</span>
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                onClick={() => setFormData(prev => ({ ...prev, rating: r as any }))}
                className={`text-sm ${r <= formData.rating ? 'text-yellow-400' : 'text-slate-600'}`}
              >
                &#9733;
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
        <div className="space-y-1 max-h-[250px] overflow-y-auto chat-scroll">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="tour-entry flex items-start gap-2 p-2 bg-slate-800/30 rounded hover:bg-slate-800/60 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{entry.name}</p>
                <p className="text-[10px] text-slate-500">
                  {entry.date} &middot; {entry.route.difficulty} &middot; {entry.route.totalElevation}m
                </p>
                <div className="flex gap-0.5 mt-0.5">
                  {[1, 2, 3, 4, 5].map(r => (
                    <span key={r} className={`text-[10px] ${r <= entry.rating ? 'text-yellow-400' : 'text-slate-700'}`}>
                      &#9733;
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                title="Delete"
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
