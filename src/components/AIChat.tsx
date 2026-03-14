'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, RouteData, TourLogEntry, WeatherDay, RiskLevel } from '@/types';
import { RISK_LEVEL_COLORS, WEATHER_CODES } from '@/types';
import type { ParsedBulletin } from '@/lib/avalanche-parser';
import { buildSnowContext, buildIncidentContext, buildReportContext } from '@/lib/ai-context-builder';
import { loadTourDB, getTourById, getTourByIdAsync, type TourEntry } from '@/lib/tour-database';

interface Props {
  onRouteGenerated: (route: RouteData) => void;
  bulletin: ParsedBulletin | null;
  weatherDays: WeatherDay[];
  tourLog: TourLogEntry[];
  hideHeader?: boolean;
}

const CHAT_STORAGE_KEY = 'skitour-chat-messages';
const MAX_STORED_MESSAGES = 30;
const CONTEXT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Get next Saturday as ISO date string */
function getNextSaturday(): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  if (dayOfWeek !== 6) {
    const daysUntilSat = (6 - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() + daysUntilSat);
  }
  return d.toISOString().split('T')[0];
}

/** Parse risk level from string */
function parseRiskLevel(value: string | undefined): RiskLevel | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase().trim();
  if (['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(upper)) {
    return upper as RiskLevel;
  }
  return undefined;
}

/** Validate and filter waypoints to ensure they're within Switzerland */
const SWISS_BOUNDS = { latMin: 45.82, latMax: 47.81, lonMin: 5.95, lonMax: 10.49 };

function validateWaypoints(waypoints: any[]): any[] {
  if (!Array.isArray(waypoints)) return [];
  return waypoints.filter(wp => {
    if (typeof wp.lat !== 'number' || typeof wp.lon !== 'number') return false;
    // Must be within Switzerland bounds
    return (
      wp.lat >= SWISS_BOUNDS.latMin &&
      wp.lat <= SWISS_BOUNDS.latMax &&
      wp.lon >= SWISS_BOUNDS.lonMin &&
      wp.lon <= SWISS_BOUNDS.lonMax
    );
  });
}

/** Validate danger zones within Swiss bounds */
function validateDangerZones(zones: any[]): any[] {
  if (!Array.isArray(zones)) return [];
  return zones.filter(dz => {
    if (typeof dz.lat !== 'number' || typeof dz.lon !== 'number') return false;
    return (
      dz.lat >= SWISS_BOUNDS.latMin &&
      dz.lat <= SWISS_BOUNDS.latMax &&
      dz.lon >= SWISS_BOUNDS.lonMin &&
      dz.lon <= SWISS_BOUNDS.lonMax
    );
  });
}

/** Resolve a tour ID from the database to a RouteData */
function tourEntryToRouteData(entry: TourEntry, aiData: any): RouteData {
  return {
    name: entry.name,
    waypoints: [
      { lat: entry.startPoint.lat, lon: entry.startPoint.lon, label: entry.startPoint.label, elevation: 0 },
      ...entry.waypoints.slice(1, -1).map((wp, i) => ({ lat: wp.lat, lon: wp.lon, label: `Waypoint ${i + 2}`, elevation: 0 })),
      { lat: entry.summit.lat, lon: entry.summit.lon, label: entry.summit.label || entry.name, elevation: entry.summit.elevation },
    ],
    dangerZones: validateDangerZones(aiData.dangerZones || []),
    totalElevation: entry.totalElevation || aiData.totalElevation || 0,
    distance: entry.distance || aiData.distance || 0,
    estimatedTime: entry.estimatedTime || aiData.estimatedTime || '',
    difficulty: entry.difficulty || aiData.difficulty || '',
    keyInfo: aiData.keyInfo || entry.routeDesc || '',
    risk: parseRiskLevel(aiData.risk),
    safetyNote: aiData.safetyNote || '',
  };
}

/** Parse a single route from ```json ... ``` block — resolves tourId from DB (async) */
async function parseRouteFromResponse(text: string): Promise<RouteData | null> {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const data = JSON.parse(jsonMatch[1]);

    // New format: tourId reference → look up from database (async to ensure DB loaded)
    if (data.tourId) {
      const entry = await getTourByIdAsync(data.tourId);
      if (entry) return tourEntryToRouteData(entry, data);
    }

    // Legacy fallback: inline waypoints
    if (data.waypoints && Array.isArray(data.waypoints)) {
      const validWaypoints = validateWaypoints(data.waypoints);
      if (validWaypoints.length < 2) return null;
      return {
        name: data.name || 'Unnamed Route',
        waypoints: validWaypoints,
        dangerZones: validateDangerZones(data.dangerZones || []),
        totalElevation: data.totalElevation || 0,
        distance: data.distance || 0,
        estimatedTime: data.estimatedTime || '',
        difficulty: data.difficulty || '',
        keyInfo: data.keyInfo || '',
        risk: parseRiskLevel(data.risk),
        safetyNote: data.safetyNote || '',
      };
    }
  } catch { /* ignore parse errors */ }
  return null;
}

/** Parse multiple tour suggestions from ```suggestions ... ``` block — resolves tourIds (async) */
async function parseSuggestionsFromResponse(text: string): Promise<RouteData[] | null> {
  const sugMatch = text.match(/```suggestions\s*([\s\S]*?)```/);
  if (!sugMatch) return null;
  try {
    const data = JSON.parse(sugMatch[1]);
    if (Array.isArray(data)) {
      const results = await Promise.all(
        data.map(async (d: any) => {
          // New format: tourId reference (async to ensure DB loaded)
          if (d.tourId) {
            const entry = await getTourByIdAsync(d.tourId);
            if (entry) return tourEntryToRouteData(entry, d);
          }

          // Legacy fallback: inline waypoints
          const validWaypoints = validateWaypoints(d.waypoints || []);
          if (validWaypoints.length < 2) return null;
          return {
            name: d.name || 'Unnamed Route',
            waypoints: validWaypoints,
            dangerZones: validateDangerZones(d.dangerZones || []),
            totalElevation: d.totalElevation || 0,
            distance: d.distance || 0,
            estimatedTime: d.estimatedTime || '',
            difficulty: d.difficulty || '',
            keyInfo: d.keyInfo || '',
            risk: parseRiskLevel(d.risk),
            safetyNote: d.safetyNote || '',
          };
        })
      );
      return results.filter(Boolean) as RouteData[];
    }
  } catch { /* ignore */ }
  return null;
}

/** Risk badge component */
function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: `${RISK_LEVEL_COLORS[risk]}20`,
        color: RISK_LEVEL_COLORS[risk],
        border: `1px solid ${RISK_LEVEL_COLORS[risk]}50`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: RISK_LEVEL_COLORS[risk] }}
      />
      {risk}
    </span>
  );
}

/** Strip all JSON/suggestion code blocks from text */
function stripCodeBlocks(text: string): string {
  return text
    .replace(/```json\s*[\s\S]*?```/g, '')
    .replace(/```suggestions\s*[\s\S]*?```/g, '')
    .trim();
}

/** Extended chat message with optional suggestions */
interface ExtChatMessage extends ChatMessage {
  suggestions?: RouteData[];
}

const WELCOME_MESSAGE: ExtChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Gr\u00FCezi! I\'m your ski tour planning assistant. Ask me to plan a tour, suggest routes based on conditions, or answer questions about Swiss ski mountaineering.\n\nTry: "Plan a weekend tour near Andermatt" or "What\'s safe given current avalanche conditions?"',
  timestamp: Date.now(),
};

/** Tour detail card */
function TourDetailCard({
  route,
  onClose,
  onShowOnMap,
}: {
  route: RouteData;
  onClose: () => void;
  onShowOnMap: () => void;
}) {
  const startWp = route.waypoints[0];
  const endWp = route.waypoints[route.waypoints.length - 1];

  return (
    <div className="mt-2 glass-card-elevated rounded-xl overflow-hidden">
      <div className="flex items-start justify-between p-3 border-b border-white/[0.04]">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate tracking-tight">{route.name}</h4>
          <p className="text-[11px] text-white/40 mt-0.5">
            {route.difficulty} · ↑{route.totalElevation}m · {route.distance}km · {route.estimatedTime}
          </p>
          {startWp && endWp && (
            <p className="text-[10px] text-white/20 mt-0.5">
              {startWp.label} ({startWp.elevation}m) → {endWp.label} ({endWp.elevation}m)
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/20 hover:text-white/60 transition-colors p-1 -mr-1 -mt-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 space-y-2.5">
        {route.keyInfo && (
          <p className="text-xs text-white/50 leading-relaxed">{route.keyInfo}</p>
        )}
        {route.dangerZones.length > 0 && (
          <p className="text-[10px] text-[#FF9F0A]/60">
            {route.dangerZones.length} danger zone(s)
          </p>
        )}
        <button
          onClick={onShowOnMap}
          className="w-full py-2.5 text-xs font-semibold text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          style={{ backgroundColor: '#007AFF' }}
        >
          Show on Map
        </button>
      </div>
    </div>
  );
}

export default function AIChat({ onRouteGenerated, bulletin, weatherDays, tourLog, hideHeader }: Props) {
  const [messages, setMessages] = useState<ExtChatMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<{ msgId: string; idx: number } | null>(null);
  const [plannedDate, setPlannedDate] = useState(getNextSaturday);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextCacheRef = useRef<{ data: { snow: string; incidents: string; reports: string }; timestamp: number } | null>(null);

  // Load tour database + chat from localStorage on mount
  useEffect(() => {
    // Pre-load tour database for ID resolution
    loadTourDB().catch(() => { /* non-critical */ });

    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed: ExtChatMessage[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
          setChatLoaded(true);
          return;
        }
      }
    } catch { /* ignore corrupt data */ }
    setMessages([WELCOME_MESSAGE]);
    setChatLoaded(true);
  }, []);

  // Save chat to localStorage when messages change
  useEffect(() => {
    if (!chatLoaded) return;
    try {
      const toSave = messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* storage full */ }
  }, [messages, chatLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, expandedSuggestion]);

  const handleClearChat = useCallback(() => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
    setExpandedSuggestion(null);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ExtChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setExpandedSuggestion(null);

    try {
      let avalancheSummary = '';
      if (bulletin && bulletin.regions.length > 0) {
        avalancheSummary = bulletin.regions.slice(0, 5).map(r => {
          const maxLevel = Math.max(...r.dangerRatings.map(d => d.level));
          const problems = r.problems.map(p => p.type.replace(/_/g, ' ')).join(', ');
          return `${r.regionName}: Level ${maxLevel}${problems ? `, problems: ${problems}` : ''}`;
        }).join('\n');
      }

      // Build weather summary with planned date highlighted
      let weatherSummary = '';
      if (weatherDays.length > 0) {
        const dateFmt = new Date(plannedDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
        weatherSummary = `USER IS PLANNING FOR: ${dateFmt}\n\n`;
        weatherSummary += weatherDays.slice(0, 7).map(d => {
          const isPlanned = d.date === plannedDate;
          const prefix = isPlanned ? '>>> PLANNED DATE >>> ' : '';
          return `${prefix}${d.date}: ${d.tempMin}\u00B0/${d.tempMax}\u00B0C, snow ${d.snowfall}cm, wind ${d.windSpeedMax}km/h${d.freezingLevel ? `, 0\u00B0=${Math.round(d.freezingLevel)}m` : ''}`;
        }).join('\n');
      }

      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      // Fetch enriched context with caching
      let snowSummary = '';
      let incidentSummary = '';
      let recentReports = '';

      const cache = contextCacheRef.current;
      const cacheValid = cache && (Date.now() - cache.timestamp) < CONTEXT_CACHE_TTL;

      if (cacheValid) {
        snowSummary = cache.data.snow;
        incidentSummary = cache.data.incidents;
        recentReports = cache.data.reports;
      } else {
        try {
          const contextLat = 46.8;
          const contextLon = 8.2;

          const [snowRes, incidentRes, reportRes] = await Promise.allSettled([
            fetch(`/api/snow-stations?lat=${contextLat}&lon=${contextLon}&radius=50`).then(r => r.json()),
            fetch(`/api/avalanche-incidents?lat=${contextLat}&lon=${contextLon}&radius=20`).then(r => r.json()),
            fetch(`/api/tour-reports?query=${encodeURIComponent(text.split(' ').slice(0, 3).join(' '))}&days=30`).then(r => r.json()),
          ]);

          if (snowRes.status === 'fulfilled' && snowRes.value.stations) {
            snowSummary = buildSnowContext(snowRes.value.stations);
          }
          if (incidentRes.status === 'fulfilled' && incidentRes.value.summary) {
            incidentSummary = `HISTORICAL AVALANCHE INCIDENTS NEARBY:\n${incidentRes.value.summary}`;
          }
          if (reportRes.status === 'fulfilled' && reportRes.value.reports) {
            recentReports = buildReportContext(reportRes.value.reports);
          }

          // Cache the results
          contextCacheRef.current = {
            data: { snow: snowSummary, incidents: incidentSummary, reports: recentReports },
            timestamp: Date.now(),
          };
        } catch {
          // Non-critical
        }
      }

      // Send raw bulletin data so server can compute per-tour risk (aspects + elevation bands)
      const rawBulletin = bulletin ? {
        regions: bulletin.regions.slice(0, 5).map(r => ({
          regionName: r.regionName,
          dangerRatings: r.dangerRatings.map(dr => ({
            level: dr.level,
            aspects: dr.aspects,
            elevationHigh: dr.elevationHigh,
            elevationLow: dr.elevationLow,
          })),
          problems: r.problems.map(p => ({
            type: p.type,
            aspects: p.aspects,
            elevationHigh: p.elevationHigh,
            elevationLow: p.elevationLow,
          })),
        })),
      } : undefined;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          avalancheSummary,
          weatherSummary,
          snowSummary,
          incidentSummary,
          recentReports,
          rawBulletin,
          tourLog: tourLog.map(t => ({
            name: t.name,
            date: t.date,
            difficulty: t.route.difficulty,
            rating: t.rating,
            elevation: t.route.totalElevation,
            participants: t.participants.join(', '),
            conditions: t.conditions,
            notes: t.notes,
          })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      const content = data.content || 'Sorry, I could not generate a response.';

      const suggestions = await parseSuggestionsFromResponse(content);
      const route = !suggestions ? await parseRouteFromResponse(content) : null;

      // Attach planned date to routes
      if (route) {
        route.plannedDate = plannedDate;
      }
      if (suggestions) {
        suggestions.forEach(s => { s.plannedDate = plannedDate; });
      }

      const assistantMsg: ExtChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: stripCodeBlocks(content),
        route: route || undefined,
        suggestions: suggestions || undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (route) {
        onRouteGenerated(route);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get response'}. Check your API key is configured.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, bulletin, weatherDays, tourLog, onRouteGenerated, plannedDate]);

  const handleSelectSuggestion = (msgId: string, idx: number) => {
    if (expandedSuggestion?.msgId === msgId && expandedSuggestion?.idx === idx) {
      setExpandedSuggestion(null);
    } else {
      setExpandedSuggestion({ msgId, idx });
    }
  };

  const handleShowOnMap = (route: RouteData) => {
    onRouteGenerated({ ...route, plannedDate });
  };

  const quickActions = [
    'Plan a tour near Andermatt',
    'What\'s safe this weekend?',
    'Similar to Stotzigen Firsten',
    'Suggest a powder tour',
  ];

  // Clear chat button component
  const ClearButton = () => (
    <button
      onClick={handleClearChat}
      className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
      title="Clear chat"
    >
      <svg className="w-3.5 h-3.5 text-white/20 hover:text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-black" style={{ minHeight: 0 }}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">⛷️</span>
            <h2 className="text-sm font-semibold text-white tracking-tight">Skitour AI</h2>
          </div>
          <div className="flex items-center gap-2">
            <ClearButton />
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-[#FFD60A] animate-pulse' : 'bg-[#30D158]'}`} />
              <span className="text-[10px] text-white/30 font-medium">{loading ? 'thinking...' : 'online'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Planning date picker */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[#007AFF]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Tour date</span>
        <input
          type="date"
          value={plannedDate}
          onChange={e => setPlannedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="bg-white/[0.05] text-[11px] text-white/60 px-2 py-1 rounded-lg outline-none border border-white/[0.04] cursor-pointer hover:bg-white/[0.08] transition-colors"
        />
        {hideHeader && (
          <div className="ml-auto">
            <ClearButton />
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto ios-scroll chat-scroll px-3 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'text-white rounded-br-md'
                  : 'glass-card text-white/80 rounded-bl-md'
              }`}
              style={msg.role === 'user' ? { backgroundColor: '#007AFF' } : undefined}
            >
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</p>

              {/* Single route card */}
              {msg.route && (
                <div className="mt-2.5 glass-card-elevated rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-white flex-1 tracking-tight">{msg.route.name}</p>
                    {msg.route.risk && <RiskBadge risk={msg.route.risk} />}
                  </div>
                  {msg.route.safetyNote && (
                    <p className="text-[11px] text-white/40 mt-1.5 leading-snug">{msg.route.safetyNote}</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[11px]">
                    <span className="text-white/25">↑ <span className="text-white/70">{msg.route.totalElevation}m</span></span>
                    <span className="text-white/25">↔ <span className="text-white/70">{msg.route.distance}km</span></span>
                    <span className="text-white/25">⏱ <span className="text-white/70">{msg.route.estimatedTime}</span></span>
                    <span className="text-white/25">📐 <span className="text-white/70">{msg.route.difficulty}</span></span>
                  </div>
                  {msg.route.plannedDate && (
                    <p className="text-[10px] mt-2 font-medium" style={{ color: 'rgba(0,122,255,0.5)' }}>
                      📅 {new Date(msg.route.plannedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                  <p className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(0,122,255,0.6)' }}>✓ Route shown on map</p>
                  {msg.route.dangerZones.length > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,159,10,0.6)' }}>
                      ⚠ {msg.route.dangerZones.length} danger zone(s) flagged
                    </p>
                  )}
                </div>
              )}

              {/* Tour suggestion list */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  <p className="text-[10px] text-white/20 uppercase font-semibold tracking-wider">Suggestions</p>
                  {msg.suggestions.map((sug, idx) => {
                    const isExpanded = expandedSuggestion?.msgId === msg.id && expandedSuggestion?.idx === idx;
                    const startWp = sug.waypoints[0];
                    const endWp = sug.waypoints[sug.waypoints.length - 1];

                    return (
                      <div key={idx}>
                        <button
                          onClick={() => handleSelectSuggestion(msg.id, idx)}
                          className={`w-full text-left rounded-xl p-2.5 border transition-all ${
                            isExpanded
                              ? 'border-[#007AFF]/30 bg-[#007AFF]/10'
                              : 'glass-card hover:bg-white/[0.06] active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-semibold text-white truncate">{sug.name}</p>
                                {sug.risk && <RiskBadge risk={sug.risk} />}
                              </div>
                              <p className="text-[11px] text-white/35 mt-0.5">
                                {sug.difficulty} · ↑{sug.totalElevation}m · {sug.distance}km · {sug.estimatedTime}
                              </p>
                              {sug.safetyNote && (
                                <p className="text-[10px] text-white/30 mt-1 leading-snug line-clamp-2">{sug.safetyNote}</p>
                              )}
                              {startWp && endWp && (
                                <p className="text-[10px] text-white/20 mt-0.5">
                                  {startWp.label} → {endWp.label}
                                </p>
                              )}
                            </div>
                            <svg
                              className={`w-4 h-4 text-white/25 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <TourDetailCard
                            route={sug}
                            onClose={() => setExpandedSuggestion(null)}
                            onShowOnMap={() => handleShowOnMap(sug)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { setInput(action); }}
              className="text-[11px] glass-card px-3 py-1.5 rounded-full hover:bg-white/[0.06] active:scale-[0.97] transition-all"
              style={{ color: 'rgba(0,122,255,0.7)' }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t border-white/[0.04] flex-shrink-0 bg-black">
        <div className="flex items-center gap-2 glass-card rounded-full px-4 py-1">
          <input
            type="text"
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about a tour..."
            className="flex-1 bg-transparent text-[16px] md:text-sm text-white placeholder-white/20 outline-none py-2"
            style={{ fontSize: '16px' }}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 rounded-full text-white disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all flex-shrink-0"
            style={{ backgroundColor: '#007AFF' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
