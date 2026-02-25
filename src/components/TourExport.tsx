'use client';

import { useState } from 'react';
import type { RouteData, WeatherDay } from '@/types';
import type { RegionBulletin } from '@/lib/avalanche-parser';
import { downloadGPX } from '@/lib/gpx-generator';
import { downloadTourPDF } from '@/lib/pdf-generator';

interface Props {
  route: RouteData | null;
  weatherDays: WeatherDay[];
  bulletin: RegionBulletin | null;
}

export default function TourExport({ route, weatherDays, bulletin }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    participants: '',
  });

  if (!route) return null;

  const handleGPXDownload = () => {
    downloadGPX({
      name: route.name,
      waypoints: route.waypoints.map(w => ({
        lat: w.lat,
        lon: w.lon,
        elevation: w.elevation,
        name: w.label,
      })),
    });
  };

  const handlePDFDownload = () => {
    downloadTourPDF({
      route,
      date: formData.date,
      participants: formData.participants.split(',').map(s => s.trim()).filter(Boolean),
      weather: weatherDays,
      bulletin: bulletin || undefined,
    });
    setShowModal(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-xl border border-green-500/30">
        <div className="flex-1">
          <p className="text-sm font-bold text-white">{route.name}</p>
          <p className="text-xs text-slate-400">
            {route.totalElevation}m &middot; {route.distance}km &middot; {route.estimatedTime}
          </p>
        </div>
        <button
          onClick={handleGPXDownload}
          className="text-xs px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
          title="Download GPX for GPS device"
        >
          GPX
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-medium"
        >
          We go!
        </button>
      </div>

      {/* PDF Export Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-1">Tour Plan Export</h3>
            <p className="text-xs text-slate-400 mb-4">
              Generate a complete PDF tour plan with route, weather, avalanche info, and checklist.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tour Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Participants</label>
                <input
                  type="text"
                  value={formData.participants}
                  onChange={e => setFormData(prev => ({ ...prev, participants: e.target.value }))}
                  placeholder="Anna, Max, Luca"
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none border border-slate-600 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-sm text-slate-400 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePDFDownload}
                className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
