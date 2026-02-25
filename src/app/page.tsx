'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import type { RouteData, TourLogEntry, WeatherDay } from '@/types';
import type { ParsedBulletin, RegionBulletin } from '@/lib/avalanche-parser';
import PhoneAIChat from '@/components/PhoneAIChat';
import WeatherPanel from '@/components/WeatherPanel';
import AvalancheBulletin from '@/components/AvalancheBulletin';
import TourLog from '@/components/TourLog';
import TourExport from '@/components/TourExport';
import { SEED_TOURS } from '@/lib/seed-tours';

// Dynamic import for Leaflet (SSR incompatible)
const SwissTopoMap = dynamic(() => import('@/components/SwissTopoMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-800">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-slate-600 border-t-blue-400 rounded-full spinner mx-auto mb-2" />
        <p className="text-sm text-slate-400">Loading map...</p>
      </div>
    </div>
  ),
});

type SideTab = 'weather' | 'avalanche' | 'log';

export default function Home() {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [bulletin, setBulletin] = useState<ParsedBulletin | null>(null);
  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>([]);
  const [tourLog, setTourLog] = useState<TourLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<SideTab>('avalanche');
  const [weatherLocation, setWeatherLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Load tour log from localStorage, seed with group history on first visit
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skitour-log');
      if (saved) {
        setTourLog(JSON.parse(saved));
      } else {
        // First visit: seed with group tour history
        setTourLog(SEED_TOURS);
        localStorage.setItem('skitour-log', JSON.stringify(SEED_TOURS));
      }
    } catch { /* ignore */ }
  }, []);

  const handleRouteGenerated = useCallback((newRoute: RouteData) => {
    setRoute(newRoute);
    // Set weather location to first waypoint
    if (newRoute.waypoints.length > 0) {
      setWeatherLocation({
        lat: newRoute.waypoints[0].lat,
        lon: newRoute.waypoints[0].lon,
      });
    }
  }, []);

  const handleBulletinLoaded = useCallback((b: ParsedBulletin) => {
    setBulletin(b);
  }, []);

  const handleWeatherLoaded = useCallback((days: WeatherDay[]) => {
    setWeatherDays(days);
  }, []);

  // Get the first matching region from bulletin for exports
  const activeBulletinRegion: RegionBulletin | null =
    bulletin && bulletin.regions.length > 0 ? bulletin.regions[0] : null;

  const tabs: { key: SideTab; label: string }[] = [
    { key: 'avalanche', label: 'Avalanche' },
    { key: 'weather', label: 'Weather' },
    { key: 'log', label: 'Tour Log' },
  ];

  return (
    <main className="h-screen flex">
      {/* Left side: Map + bottom panels */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Map */}
        <div className="flex-1 relative">
          <SwissTopoMap route={route} />
        </div>

        {/* Bottom panel with tabs */}
        <div className="h-[280px] bg-slate-850 border-t border-slate-700 flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-slate-700">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto chat-scroll bg-slate-900">
            {activeTab === 'avalanche' && (
              <AvalancheBulletin onBulletinLoaded={handleBulletinLoaded} />
            )}
            {activeTab === 'weather' && (
              <WeatherPanel
                lat={weatherLocation?.lat || null}
                lon={weatherLocation?.lon || null}
                onWeatherLoaded={handleWeatherLoaded}
              />
            )}
            {activeTab === 'log' && (
              <TourLog
                entries={tourLog}
                onEntriesChange={setTourLog}
                currentRoute={route}
              />
            )}
          </div>

          {/* Export bar (when route is active) */}
          {route && (
            <div className="p-2 border-t border-slate-700 bg-slate-900">
              <TourExport
                route={route}
                weatherDays={weatherDays}
                bulletin={activeBulletinRegion}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right side: Phone AI Chat */}
      <div className="w-[380px] p-3 flex-shrink-0">
        <PhoneAIChat
          onRouteGenerated={handleRouteGenerated}
          bulletin={bulletin}
          weatherDays={weatherDays}
          tourLog={tourLog}
        />
      </div>
    </main>
  );
}
