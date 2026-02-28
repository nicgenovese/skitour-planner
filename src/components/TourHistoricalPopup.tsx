'use client';

import { useState } from 'react';
import type { TourLogEntry } from '@/types';
import { DANGER_COLORS, WEATHER_CODES } from '@/types';
import { enrichTourWithHistoricalData } from '@/lib/historical-data';

interface Props {
  tour: TourLogEntry;
  onClose: () => void;
  onEnriched: (tour: TourLogEntry) => void;
  onGoToday: () => void;
}

export default function TourHistoricalPopup({ tour, onClose, onEnriched, onGoToday }: Props) {
  const [loading, setLoading] = useState(false);

  const hasData = tour.historicalWeather || tour.historicalAvalanche;

  const handleFetchData = async () => {
    setLoading(true);
    try {
      const enriched = await enrichTourWithHistoricalData(tour);
      onEnriched(enriched);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startWp = tour.route.waypoints[0];
  const endWp = tour.route.waypoints[tour.route.waypoints.length - 1];

  return (
    <div className="absolute bottom-3 left-3 right-3 z-[1001] md:left-auto md:right-3 md:max-w-sm">
      <div className="bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-600 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-3 border-b border-slate-700">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{tour.name}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {tour.date} · {tour.route.difficulty} · ↑{tour.route.totalElevation}m
            </p>
            {startWp && endWp && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {startWp.label} ({startWp.elevation}m) → {endWp.label} ({endWp.elevation}m)
              </p>
            )}
            {tour.participants.length > 0 && (
              <p className="text-[10px] text-slate-500">{tour.participants.join(', ')}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Conditions from log */}
          {tour.conditions && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold">Conditions (logged)</p>
              <p className="text-xs text-slate-300">{tour.conditions}</p>
            </div>
          )}

          {/* Historical Weather */}
          {tour.historicalWeather?.days && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold">Weather on {tour.date}</p>
              <div className="mt-1 space-y-1">
                {tour.historicalWeather.days.map((day, i) => {
                  const info = WEATHER_CODES[day.weatherCode] || { label: 'Unknown', icon: 'cloud' };
                  const isMainDay = day.date === tour.date;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                        isMainDay ? 'bg-slate-700/50 text-white' : 'text-slate-400'
                      }`}
                    >
                      <span className="w-14 text-slate-500 text-[10px]">{day.date.slice(5)}</span>
                      <span className="flex-1">{info.label}</span>
                      <span className="text-blue-300">{day.tempMin}°</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-orange-300">{day.tempMax}°</span>
                      {day.snowfall > 0 && (
                        <span className="text-blue-200 text-[10px]">{day.snowfall}cm</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Avalanche */}
          {tour.historicalAvalanche && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold">Avalanche Bulletin</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="danger-badge"
                  style={{ backgroundColor: DANGER_COLORS[tour.historicalAvalanche.maxDangerLevel] || '#94a3b8' }}
                >
                  {tour.historicalAvalanche.maxDangerLevel}
                </span>
                <span className="text-xs text-slate-300">
                  Danger level {tour.historicalAvalanche.maxDangerLevel}/5
                </span>
              </div>
              {tour.historicalAvalanche.problems && tour.historicalAvalanche.problems.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Problems: {tour.historicalAvalanche.problems.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Fetch button if no data yet */}
          {!hasData && (
            <button
              onClick={handleFetchData}
              disabled={loading}
              className="w-full py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full spinner" />
                  Loading historical data...
                </>
              ) : (
                'Load Weather & Avalanche Data'
              )}
            </button>
          )}

          {/* Notes */}
          {tour.notes && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold">Notes</p>
              <p className="text-xs text-slate-300">{tour.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-3 border-t border-slate-700">
          <button
            onClick={onGoToday}
            className="flex-1 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 active:bg-green-700 transition-colors"
          >
            ← Back to Today
          </button>
          {!hasData && !loading && (
            <button
              onClick={handleFetchData}
              className="flex-1 py-2 text-xs font-medium text-blue-400 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Fetch Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
