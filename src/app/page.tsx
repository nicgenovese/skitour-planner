'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import type { RouteData, TourLogEntry, WeatherDay, CurrentConditions, PlannedTour } from '@/types';
import { parseBulletinJSON, type ParsedBulletin, type RegionBulletin } from '@/lib/avalanche-parser';
import { DANGER_COLORS, RISK_LEVEL_COLORS, IOS_COLORS } from '@/types';
import AIChat from '@/components/AIChat';
import WeatherPanel from '@/components/WeatherPanel';
import AvalancheBulletin from '@/components/AvalancheBulletin';
import TourHistoricalPopup from '@/components/TourHistoricalPopup';
import HomeScreen from '@/components/HomeScreen';
import RouteInfoPanel from '@/components/RouteInfoPanel';
import TourBrowser from '@/components/TourBrowser';
import { SEED_TOURS } from '@/lib/seed-tours';

const SwissTopoMap = dynamic(() => import('@/components/SwissTopoMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-white/10 rounded-full spinner mx-auto mb-2" style={{ borderTopColor: IOS_COLORS.blue }} />
        <p className="text-sm text-white/30">Loading map...</p>
      </div>
    </div>
  ),
});

type MobileTab = 'home' | 'avalanche' | 'weather' | 'map' | 'chat';
type DesktopPanel = 'home' | 'browse' | 'ai' | 'danger' | 'weather';

const PLANNED_TOURS_KEY = 'skitour-planned-tours';

/* ─── Mobile Bottom Navigation Bar ─── */
function MobileBottomNav({
  activeTab,
  onTabChange,
  dangerLevel,
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  dangerLevel: number | null;
}) {
  const tabs: { key: MobileTab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      key: 'home',
      label: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'avalanche',
      label: 'Danger',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      badge: dangerLevel && dangerLevel > 0 ? (
        <span
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: DANGER_COLORS[dangerLevel] || '#94a3b8' }}
        >
          {dangerLevel}
        </span>
      ) : null,
    },
    {
      key: 'weather',
      label: 'Weather',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    {
      key: 'map',
      label: 'Map',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      key: 'chat',
      label: 'AI Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="mobile-bottom-nav flex safe-area-bottom flex-shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${
            activeTab === tab.key
              ? 'text-white'
              : 'text-white/25 active:text-white/50'
          }`}
        >
          <span className="relative">
            {tab.icon}
            {tab.badge}
          </span>
          <span className="nav-label text-[9px] font-medium leading-none tracking-wide">{tab.label}</span>
          {activeTab === tab.key && (
            <span
              className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
              style={{ backgroundColor: IOS_COLORS.blue }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}

export default function Home() {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [bulletin, setBulletin] = useState<ParsedBulletin | null>(null);
  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>([]);
  const [tourLog, setTourLog] = useState<TourLogEntry[]>([]);
  const [plannedTours, setPlannedTours] = useState<PlannedTour[]>([]);
  // Pre-load weather with central Switzerland coordinates (bug fix: was null)
  const [weatherLocation, setWeatherLocation] = useState<{ lat: number; lon: number }>({ lat: 46.8, lon: 8.2 });
  const [mapDate, setMapDate] = useState<string | null>(null);
  const [selectedTour, setSelectedTour] = useState<TourLogEntry | null>(null);
  const [currentConditions, setCurrentConditions] = useState<CurrentConditions | null>(null);
  const [expandedRouteInfo, setExpandedRouteInfo] = useState(false);
  const [guidePhoneNumber] = useState<string | undefined>(
    process.env.NEXT_PUBLIC_VAPI_PHONE_NUMBER || undefined
  );

  // Mobile-specific state
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>('ai');

  // Load tour log from localStorage
  useEffect(() => {
    try {
      const SEED_VERSION = '4';
      const savedVersion = localStorage.getItem('skitour-log-version');
      const saved = localStorage.getItem('skitour-log');

      if (savedVersion === SEED_VERSION && saved) {
        setTourLog(JSON.parse(saved));
      } else {
        setTourLog(SEED_TOURS);
        localStorage.setItem('skitour-log', JSON.stringify(SEED_TOURS));
        localStorage.setItem('skitour-log-version', SEED_VERSION);
      }
    } catch { /* ignore */ }
  }, []);

  // Background-fetch bulletin data on mount (independent of which panel is shown)
  useEffect(() => {
    if (bulletin) return; // Already loaded (e.g. via AvalancheBulletin component)
    fetch('/api/avalanche')
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        const parsed = parseBulletinJSON(data);
        if (parsed) setBulletin(parsed);
      })
      .catch(() => { /* non-critical */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load planned tours from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PLANNED_TOURS_KEY);
      if (saved) {
        setPlannedTours(JSON.parse(saved));
      }
    } catch { /* ignore */ }
  }, []);

  // Save planned tours whenever they change
  useEffect(() => {
    if (plannedTours.length > 0) {
      localStorage.setItem(PLANNED_TOURS_KEY, JSON.stringify(plannedTours));
    } else {
      // Keep the key so it exists, just empty
      localStorage.setItem(PLANNED_TOURS_KEY, '[]');
    }
  }, [plannedTours]);

  // Auto-update planned tours when bulletin changes
  useEffect(() => {
    if (!bulletin || bulletin.regions.length === 0 || plannedTours.length === 0) return;

    const maxLevel = Math.max(
      ...bulletin.regions.map(r => Math.max(...r.dangerRatings.map(d => d.level)))
    );

    setPlannedTours(prev => {
      const updated = prev.map(tour => {
        const original = tour.originalDangerLevel;
        let trend: PlannedTour['dangerTrend'] = 'same';
        if (original != null && maxLevel > original) trend = 'worse';
        else if (original != null && maxLevel < original) trend = 'better';

        return {
          ...tour,
          currentDangerLevel: maxLevel,
          dangerTrend: trend,
        };
      });
      return updated;
    });
  }, [bulletin]); // Only react to bulletin changes, not plannedTours

  // Build current conditions from weather + avalanche data + snow stations
  useEffect(() => {
    const controller = new AbortController();

    const cond: CurrentConditions = {
      dangerLevel: null,
      dangerProblems: [],
      tempMin: null,
      tempMax: null,
      snowfall: null,
      freezingLevel: null,
      windSpeedMax: null,
      nearestSnowDepth: null,
      nearestStationName: null,
    };

    // From bulletin
    if (bulletin && bulletin.regions.length > 0) {
      const maxLevel = Math.max(
        ...bulletin.regions.map(r => Math.max(...r.dangerRatings.map(d => d.level)))
      );
      cond.dangerLevel = maxLevel;
      const allProblems = new Set<string>();
      bulletin.regions.forEach(r =>
        r.problems.forEach(p => allProblems.add(p.type))
      );
      cond.dangerProblems = Array.from(allProblems);
    }

    // From weather
    if (weatherDays.length > 0) {
      const today = weatherDays[0];
      cond.tempMin = today.tempMin;
      cond.tempMax = today.tempMax;
      cond.snowfall = today.snowfall;
      cond.freezingLevel = today.freezingLevel ?? null;
      cond.windSpeedMax = today.windSpeedMax;
    }

    // Fetch nearest snow station with abort controller (memory leak fix)
    fetch('/api/snow-stations?lat=46.8&lon=8.2&radius=50', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.stations && data.stations.length > 0) {
          const nearest = data.stations.find((s: any) => s.latest?.snowDepth != null);
          if (nearest) {
            setCurrentConditions(prev => ({
              ...(prev || cond),
              nearestSnowDepth: nearest.latest.snowDepth,
              nearestStationName: nearest.label,
            }));
          }
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return; // silently ignore aborts
        /* non-critical */
      });

    setCurrentConditions(cond);

    return () => controller.abort();
  }, [bulletin, weatherDays]);

  const handleRouteGenerated = useCallback((newRoute: RouteData) => {
    setRoute(newRoute);
    setSelectedTour(null);
    setMapDate(null);
    setExpandedRouteInfo(false);
    if (newRoute.waypoints.length > 0) {
      setWeatherLocation({
        lat: newRoute.waypoints[0].lat,
        lon: newRoute.waypoints[0].lon,
      });
    }
    setMobileTab('map');
  }, []);

  const handleBulletinLoaded = useCallback((b: ParsedBulletin) => {
    setBulletin(b);
  }, []);

  const handleWeatherLoaded = useCallback((days: WeatherDay[]) => {
    setWeatherDays(days);
  }, []);

  const handleViewTour = useCallback((entry: TourLogEntry) => {
    setRoute(entry.route);
    if (entry.route.waypoints.length > 0) {
      setWeatherLocation({
        lat: entry.route.waypoints[0].lat,
        lon: entry.route.waypoints[0].lon,
      });
    }
    setMapDate(entry.date);
    setSelectedTour(entry);
    setExpandedRouteInfo(false);
    setMobileTab('map');
  }, []);

  const handleViewPlannedTour = useCallback((tour: PlannedTour) => {
    setRoute(tour.route);
    if (tour.route.waypoints.length > 0) {
      setWeatherLocation({
        lat: tour.route.waypoints[0].lat,
        lon: tour.route.waypoints[0].lon,
      });
    }
    setMapDate(null);
    setSelectedTour(null);
    setExpandedRouteInfo(false);
    setMobileTab('map');
  }, []);

  const handlePlanTour = useCallback((tour: PlannedTour) => {
    setPlannedTours(prev => {
      // Prevent duplicates by checking name + date
      const exists = prev.some(
        t => t.name === tour.name && t.plannedDate === tour.plannedDate
      );
      if (exists) return prev;
      return [tour, ...prev];
    });
  }, []);

  const handleCompleteTour = useCallback((tour: PlannedTour, rating: number, conditions: string) => {
    // Create tour log entry from planned tour
    const logEntry: TourLogEntry = {
      id: `tour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: tour.name,
      date: tour.plannedDate,
      participants: tour.participants,
      route: tour.route,
      conditions,
      notes: tour.notes,
      rating: Math.min(5, Math.max(1, rating)) as 1 | 2 | 3 | 4 | 5,
      createdAt: Date.now(),
    };

    // Add to tour log
    const updatedLog = [logEntry, ...tourLog];
    setTourLog(updatedLog);
    localStorage.setItem('skitour-log', JSON.stringify(updatedLog));

    // Remove from planned tours
    setPlannedTours(prev => prev.filter(t => t.id !== tour.id));
  }, [tourLog]);

  const handleGoToday = useCallback(() => {
    setMapDate(null);
    setSelectedTour(null);
    setRoute(null);
    setExpandedRouteInfo(false);
  }, []);

  const handleTourEnriched = useCallback((enrichedTour: TourLogEntry) => {
    const updated = tourLog.map(t => t.id === enrichedTour.id ? enrichedTour : t);
    setTourLog(updated);
    localStorage.setItem('skitour-log', JSON.stringify(updated));
    setSelectedTour(enrichedTour);
  }, [tourLog]);

  const handleCloseRoute = useCallback(() => {
    setRoute(null);
    setExpandedRouteInfo(false);
  }, []);

  const activeBulletinRegion: RegionBulletin | null =
    bulletin && bulletin.regions.length > 0 ? bulletin.regions[0] : null;

  // Derive summary data
  const maxDangerLevel = bulletin
    ? Math.max(...bulletin.regions.map(r => Math.max(...r.dangerRatings.map(d => d.level))), 0)
    : null;

  // Is there an active planned route (not a historical tour)?
  const hasPlannedRoute = route && !selectedTour;

  return (
    <main className="h-[100dvh] flex flex-col md:flex-row overflow-hidden bg-black" style={{ height: '100dvh' }}>

      {/* ═══════════════════════════════════════════ */}
      {/* DESKTOP: Hidden weather loader for AI context */}
      {/* ═══════════════════════════════════════════ */}
      <div className="hidden md:block" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <WeatherPanel lat={weatherLocation.lat} lon={weatherLocation.lon} onWeatherLoaded={handleWeatherLoaded} />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* CENTER: Map (desktop + mobile)               */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative">
          <SwissTopoMap
            route={route}
            tourLog={tourLog}
            onViewTour={handleViewTour}
            mapDate={mapDate}
            selectedTourId={selectedTour?.id || null}
          />

          {/* Date bar on map (top center) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 glass-card-elevated rounded-full px-3 py-1.5">
            <input
              type="date"
              value={mapDate || new Date().toISOString().split('T')[0]}
              onChange={e => {
                const val = e.target.value;
                const today = new Date().toISOString().split('T')[0];
                setMapDate(val === today ? null : val);
                setSelectedTour(null);
              }}
              className="bg-transparent text-xs text-white/80 outline-none w-[110px] cursor-pointer"
            />
            {mapDate && (
              <button
                onClick={handleGoToday}
                className="text-[10px] px-2 py-0.5 text-white rounded-full active:scale-95 transition-all font-medium whitespace-nowrap"
                style={{ backgroundColor: IOS_COLORS.blue }}
              >
                Today
              </button>
            )}
          </div>

          {/* Historical tour popup */}
          {selectedTour && (
            <TourHistoricalPopup
              tour={selectedTour}
              onClose={() => setSelectedTour(null)}
              onEnriched={handleTourEnriched}
              onGoToday={handleGoToday}
            />
          )}

          {/* Mobile: Compact route info bar (above bottom nav, on map tab) */}
          {hasPlannedRoute && (
            <div className="md:hidden absolute bottom-14 left-2 right-2 z-[999]">
              <button
                onClick={() => setExpandedRouteInfo(true)}
                className="w-full glass-card-elevated rounded-2xl p-3 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white truncate tracking-tight">{route.name}</p>
                      {route.risk && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0"
                          style={{
                            backgroundColor: `${RISK_LEVEL_COLORS[route.risk]}20`,
                            color: RISK_LEVEL_COLORS[route.risk],
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RISK_LEVEL_COLORS[route.risk] }} />
                          {route.risk}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {route.difficulty} · ↑{route.totalElevation}m · {route.estimatedTime}
                      {route.plannedDate && (
                        <> · {new Date(route.plannedDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-[10px] font-medium" style={{ color: IOS_COLORS.blue }}>Details</span>
                    <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Mobile: Bottom navigation bar on map */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 z-[1000]">
            <MobileBottomNav
              activeTab={mobileTab}
              onTabChange={setMobileTab}
              dangerLevel={maxDangerLevel}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* MOBILE: Full-screen panel overlays          */}
        {/* ═══════════════════════════════════════════ */}
        {mobileTab !== 'map' && (
          <div className="md:hidden mobile-panel-overlay">
            {/* Panel header — hidden on home tab for cleaner look */}
            {mobileTab !== 'home' && (
              <div className="mobile-panel-header flex items-center gap-3 px-4 py-3 border-b flex-shrink-0 safe-area-top" style={{ borderColor: IOS_COLORS.separator }}>
                <button
                  onClick={() => setMobileTab('home')}
                  className="text-white/30 hover:text-white transition-colors p-1 -ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {mobileTab === 'avalanche' && 'Avalanche Bulletin'}
                  {mobileTab === 'weather' && 'Weather Forecast'}
                  {mobileTab === 'chat' && 'Skitour AI'}
                </h2>
                {mobileTab === 'avalanche' && maxDangerLevel !== null && maxDangerLevel > 0 && (
                  <span
                    className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: DANGER_COLORS[maxDangerLevel] || '#94a3b8' }}
                  >
                    {maxDangerLevel}
                  </span>
                )}
              </div>
            )}

            {/* Home tab header */}
            {mobileTab === 'home' && (
              <div className="mobile-panel-header flex items-center justify-between px-5 py-4 flex-shrink-0 safe-area-top">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Skitour</h1>
                  <p className="text-[11px] text-white/25 mt-0.5 font-medium">{new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center">
                  <span className="text-sm">⛷️</span>
                </div>
              </div>
            )}

            {/* Panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobileTab === 'home' && (
                <HomeScreen
                  tourLog={tourLog}
                  plannedTours={plannedTours}
                  conditions={currentConditions}
                  onViewTour={handleViewTour}
                  onViewPlannedTour={handleViewPlannedTour}
                  onCompleteTour={handleCompleteTour}
                  onPlanTour={() => setMobileTab('chat')}
                />
              )}
              {mobileTab === 'avalanche' && (
                <div className="h-full overflow-y-auto ios-scroll chat-scroll">
                  <AvalancheBulletin onBulletinLoaded={handleBulletinLoaded} />
                </div>
              )}
              {mobileTab === 'weather' && (
                <div className="h-full overflow-y-auto ios-scroll chat-scroll">
                  <WeatherPanel
                    lat={weatherLocation.lat}
                    lon={weatherLocation.lon}
                    onWeatherLoaded={handleWeatherLoaded}
                  />
                </div>
              )}
              {mobileTab === 'chat' && (
                <AIChat
                  onRouteGenerated={handleRouteGenerated}
                  bulletin={bulletin}
                  weatherDays={weatherDays}
                  tourLog={tourLog}
                  hideHeader
                />
              )}
            </div>

            <MobileBottomNav
              activeTab={mobileTab}
              onTabChange={setMobileTab}
              dangerLevel={maxDangerLevel}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* DESKTOP: Right panel — Browse / Chat          */}
      {/* ═══════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col w-[420px] flex-shrink-0 border-l" style={{ borderColor: IOS_COLORS.separator }}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Skitour</h1>
            <p className="text-[11px] text-white/25 mt-0.5 font-medium">
              {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {maxDangerLevel !== null && maxDangerLevel > 0 && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                style={{ backgroundColor: DANGER_COLORS[maxDangerLevel] }}
                title={`Danger level ${maxDangerLevel}`}
              >
                {maxDangerLevel}
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center">
              <span className="text-sm">⛷️</span>
            </div>
          </div>
        </div>

        {/* Segmented control — hidden when route info is showing */}
        {!hasPlannedRoute && (
          <div className="flex mx-4 mb-3 p-0.5 rounded-lg bg-white/[0.04] flex-shrink-0">
            {([
              { key: 'home' as DesktopPanel, label: 'Home' },
              { key: 'danger' as DesktopPanel, label: 'Danger' },
              { key: 'weather' as DesktopPanel, label: 'Weather' },
              { key: 'browse' as DesktopPanel, label: 'Tours' },
              { key: 'ai' as DesktopPanel, label: 'AI' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setDesktopPanel(tab.key)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                  desktopPanel === tab.key
                    ? 'text-white bg-white/[0.08] shadow-sm'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasPlannedRoute ? (
            <RouteInfoPanel
              route={route}
              weatherDays={weatherDays}
              bulletin={activeBulletinRegion}
              onClose={handleCloseRoute}
              onPlanTour={handlePlanTour}
              guidePhoneNumber={guidePhoneNumber}
            />
          ) : desktopPanel === 'home' ? (
            <div className="h-full overflow-y-auto ios-scroll chat-scroll">
              <HomeScreen
                tourLog={tourLog}
                plannedTours={plannedTours}
                conditions={currentConditions}
                onViewTour={handleViewTour}
                onViewPlannedTour={handleViewPlannedTour}
                onCompleteTour={handleCompleteTour}
                onPlanTour={() => setDesktopPanel('ai')}
              />
            </div>
          ) : desktopPanel === 'danger' ? (
            <div className="h-full overflow-y-auto ios-scroll chat-scroll">
              <AvalancheBulletin onBulletinLoaded={handleBulletinLoaded} />
            </div>
          ) : desktopPanel === 'weather' ? (
            <div className="h-full overflow-y-auto ios-scroll chat-scroll">
              <WeatherPanel
                lat={weatherLocation.lat}
                lon={weatherLocation.lon}
                onWeatherLoaded={handleWeatherLoaded}
              />
            </div>
          ) : desktopPanel === 'browse' ? (
            <TourBrowser onTourSelected={handleRouteGenerated} />
          ) : (
            <AIChat
              onRouteGenerated={handleRouteGenerated}
              bulletin={bulletin}
              weatherDays={weatherDays}
              tourLog={tourLog}
            />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MOBILE: Expanded route info overlay          */}
      {/* ═══════════════════════════════════════════ */}
      {expandedRouteInfo && hasPlannedRoute && (
        <div className="md:hidden fixed inset-0 z-[2000] bg-black flex flex-col" style={{ height: '100dvh' }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0 safe-area-top" style={{ borderColor: IOS_COLORS.separator }}>
            <button
              onClick={() => setExpandedRouteInfo(false)}
              className="text-white/30 hover:text-white transition-colors p-1 -ml-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm font-bold text-white tracking-tight">Tour Details</h2>
          </div>
          <div className="flex-1 min-h-0">
            <RouteInfoPanel
              route={route}
              weatherDays={weatherDays}
              bulletin={activeBulletinRegion}
              onClose={handleCloseRoute}
              onPlanTour={handlePlanTour}
              guidePhoneNumber={guidePhoneNumber}
            />
          </div>
        </div>
      )}
    </main>
  );
}
