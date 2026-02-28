'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { RouteData, WeatherDay, RiskLevel, PlannedTour } from '@/types';
import {
  RISK_LEVEL_COLORS,
  WEATHER_CODES,
  DANGER_COLORS,
  IOS_COLORS,
  DEFAULT_EQUIPMENT,
  parseEquipmentFromKeyInfo,
} from '@/types';
import type { RegionBulletin } from '@/lib/avalanche-parser';
import { downloadGPX } from '@/lib/gpx-generator';
import { downloadTourPDF } from '@/lib/pdf-generator';

interface Props {
  route: RouteData;
  weatherDays: WeatherDay[];
  bulletin: RegionBulletin | null;
  onClose: () => void;
  onPlanTour?: (tour: PlannedTour) => void;
  guidePhoneNumber?: string;
}

function RiskBadgeLarge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: `${RISK_LEVEL_COLORS[risk]}15`,
        color: RISK_LEVEL_COLORS[risk],
        border: `1px solid ${RISK_LEVEL_COLORS[risk]}40`,
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: RISK_LEVEL_COLORS[risk] }}
      />
      {risk} Risk
    </span>
  );
}

function WeatherIcon({ code, size = 'md' }: { code: number; size?: 'sm' | 'md' | 'lg' }) {
  const info = WEATHER_CODES[code] || { label: 'Unknown', icon: 'cloud' };
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm';

  if (info.icon === 'sun') return <span className={`${sizeClass}`} style={{ color: IOS_COLORS.yellow }}>&#9728;</span>;
  if (info.icon === 'cloud-sun') return <span className={`${sizeClass}`} style={{ color: IOS_COLORS.yellow }}>&#9925;</span>;
  if (info.icon === 'cloud') return <span className={`text-white/40 ${sizeClass}`}>&#9729;</span>;
  if (info.icon === 'cloud-rain') return <span className={`${sizeClass}`} style={{ color: IOS_COLORS.blue }}>&#127783;</span>;
  if (info.icon === 'snowflake') return <span className={`text-blue-200 ${sizeClass}`}>&#10052;</span>;
  if (info.icon === 'cloud-lightning') return <span className={`${sizeClass}`} style={{ color: IOS_COLORS.yellow }}>&#9889;</span>;
  return <span className={`text-white/40 ${sizeClass}`}>&#9729;</span>;
}

function EquipmentChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (item: string) => {
    setChecked(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em]">
          Equipment · {checkedCount}/{items.length}
        </p>
        {checkedCount === items.length && (
          <span className="text-[10px] font-medium" style={{ color: IOS_COLORS.green }}>
            All packed ✓
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {items.map(item => (
          <button
            key={item}
            onClick={() => toggle(item)}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all active:scale-[0.97]"
            style={{
              background: checked[item] ? 'rgba(48,209,88,0.08)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                backgroundColor: checked[item] ? IOS_COLORS.green : 'transparent',
                border: checked[item] ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              }}
            >
              {checked[item] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span
              className="text-[11px] font-medium truncate"
              style={{
                color: checked[item] ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
                textDecoration: checked[item] ? 'line-through' : 'none',
              }}
            >
              {item}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RouteInfoPanel({
  route,
  weatherDays,
  bulletin,
  onClose,
  onPlanTour,
  guidePhoneNumber,
}: Props) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [participants, setParticipants] = useState('');
  const [tourSaved, setTourSaved] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Equipment parsed from route keyInfo
  const equipment = route.keyInfo ? parseEquipmentFromKeyInfo(route.keyInfo) : [...DEFAULT_EQUIPMENT];

  // Portal target for modals — ensures they render at document.body level
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Find weather for planned date
  const plannedWeather = route.plannedDate
    ? weatherDays.find(d => d.date === route.plannedDate)
    : null;

  const weatherInfo = plannedWeather
    ? WEATHER_CODES[plannedWeather.weatherCode]
    : null;

  const plannedDateFormatted = route.plannedDate
    ? new Date(route.plannedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

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
      date: route.plannedDate || new Date().toISOString().split('T')[0],
      participants: participants.split(',').map(s => s.trim()).filter(Boolean),
      weather: weatherDays,
      bulletin: bulletin || undefined,
    });
    setShowExportModal(false);
  };

  const handleSavePlannedTour = () => {
    if (!onPlanTour) return;

    const planned: PlannedTour = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: route.name,
      plannedDate: route.plannedDate || new Date().toISOString().split('T')[0],
      route,
      equipment,
      participants: participants.split(',').map(s => s.trim()).filter(Boolean),
      notes: route.safetyNote || '',
      createdAt: Date.now(),
      currentDangerLevel: bulletin?.dangerRatings?.length
        ? Math.max(...bulletin.dangerRatings.map(r => r.level))
        : undefined,
      originalDangerLevel: bulletin?.dangerRatings?.length
        ? Math.max(...bulletin.dangerRatings.map(r => r.level))
        : undefined,
    };

    onPlanTour(planned);
    setTourSaved(true);
    setTimeout(() => setTourSaved(false), 3000);
  };

  const handleWeGo = () => {
    // Auto-save as planned tour
    if (onPlanTour && !tourSaved) {
      handleSavePlannedTour();
    }
    // Open export modal
    setShowExportModal(true);
  };

  // Export modal — rendered via portal to escape z-index stacking
  const exportModal = showExportModal && portalTarget
    ? createPortal(
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
          style={{ zIndex: 5000 }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="glass-card-elevated rounded-2xl p-5 w-full max-w-sm slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Export Tour Plan</h3>
            <p className="text-xs text-white/40 mb-4">
              Generate a PDF with route, weather, avalanche info & checklist.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-white/30 block mb-1 uppercase tracking-wider font-medium">
                  Tour Date
                </label>
                <p className="text-sm text-white/70 bg-white/[0.05] rounded-xl px-3 py-2.5 border border-white/[0.04]">
                  {plannedDateFormatted ||
                    new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                </p>
              </div>
              <div>
                <label className="text-[11px] text-white/30 block mb-1 uppercase tracking-wider font-medium">
                  Participants
                </label>
                <input
                  type="text"
                  value={participants}
                  onChange={e => setParticipants(e.target.value)}
                  placeholder="Anna, Max, Luca"
                  className="w-full bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.04] transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  onFocus={e => (e.target.style.borderColor = `${IOS_COLORS.blue}50`)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.04)')}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 text-sm text-white/50 bg-white/[0.05] rounded-xl hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePDFDownload}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl active:scale-[0.98] transition-all"
                style={{ backgroundColor: IOS_COLORS.blue }}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>,
        portalTarget
      )
    : null;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-1">
              Planned Tour
            </p>
            <h2 className="text-[17px] font-bold text-white tracking-tight leading-tight">
              {route.name}
            </h2>
            <p className="text-[11px] text-white/30 mt-0.5">
              {route.difficulty} · ↑{route.totalElevation}m · {route.distance}km · {route.estimatedTime}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0 ml-3 mt-1 active:scale-95"
          >
            <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto ios-scroll chat-scroll px-4 pb-4 space-y-3">
          {/* Risk assessment */}
          {route.risk && (
            <div className="glass-card rounded-xl p-3">
              <RiskBadgeLarge risk={route.risk} />
              {route.safetyNote && (
                <p className="text-[12px] text-white/50 leading-relaxed mt-2">
                  {route.safetyNote}
                </p>
              )}
            </div>
          )}

          {/* Date + Weather forecast */}
          {plannedDateFormatted && (
            <div className="glass-card rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <svg className="w-4 h-4" style={{ color: `${IOS_COLORS.blue}99` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[13px] font-medium text-white/80">{plannedDateFormatted}</span>
              </div>

              {plannedWeather ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <WeatherIcon code={plannedWeather.weatherCode} size="lg" />
                    <div>
                      <p className="text-[14px] font-semibold text-white/80">
                        {weatherInfo?.label || 'Unknown'}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {plannedWeather.tempMin}° / {plannedWeather.tempMax}°C
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center py-1.5 rounded-lg bg-white/[0.03]">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Snow</p>
                      <p className="text-[13px] font-semibold text-white/70 mt-0.5">
                        {plannedWeather.snowfall > 0 ? `${plannedWeather.snowfall}cm` : '—'}
                      </p>
                    </div>
                    <div className="text-center py-1.5 rounded-lg bg-white/[0.03]">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Wind</p>
                      <p
                        className="text-[13px] font-semibold mt-0.5"
                        style={{
                          color: plannedWeather.windSpeedMax > 40
                            ? IOS_COLORS.orange
                            : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {plannedWeather.windSpeedMax}km/h
                      </p>
                    </div>
                    <div className="text-center py-1.5 rounded-lg bg-white/[0.03]">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">0° Level</p>
                      <p className="text-[13px] font-semibold text-white/70 mt-0.5">
                        {plannedWeather.freezingLevel ? `${Math.round(plannedWeather.freezingLevel)}m` : '—'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-white/30 italic">
                  Weather forecast not available for this date
                </p>
              )}
            </div>
          )}

          {/* Key info */}
          {route.keyInfo && (
            <div>
              <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-1.5">
                Details
              </p>
              <p className="text-[12px] text-white/50 leading-relaxed">{route.keyInfo}</p>
            </div>
          )}

          {/* Equipment checklist */}
          <EquipmentChecklist items={equipment} />

          {/* Route: Start → Finish */}
          {route.waypoints.length >= 2 && (
            <div>
              <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-2">
                Route
              </p>
              <div className="space-y-0">
                {/* Start */}
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: '#22c55e' }}
                    >
                      S
                    </div>
                    <div className="w-px h-5" style={{ backgroundColor: IOS_COLORS.separator }} />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[12px] text-white/70 font-medium">{route.waypoints[0].label || 'Start'}</p>
                    {route.waypoints[0].elevation ? (
                      <p className="text-[10px] text-white/25">{route.waypoints[0].elevation}m</p>
                    ) : null}
                  </div>
                </div>
                {/* Finish */}
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: '#ef4444' }}
                    >
                      F
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[12px] text-white/70 font-medium">
                      {route.waypoints[route.waypoints.length - 1].label || 'Summit'}
                    </p>
                    {route.waypoints[route.waypoints.length - 1].elevation ? (
                      <p className="text-[10px] text-white/25">{route.waypoints[route.waypoints.length - 1].elevation}m</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Danger zones */}
          {route.dangerZones.length > 0 && (
            <div>
              <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-2">
                Danger Zones · {route.dangerZones.length}
              </p>
              <div className="space-y-1.5">
                {route.dangerZones.map((dz, i) => (
                  <div
                    key={i}
                    className="glass-card rounded-xl p-2.5"
                    style={{ borderLeft: `2px solid ${DANGER_COLORS[dz.level] || IOS_COLORS.orange}` }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${DANGER_COLORS[dz.level] || IOS_COLORS.orange}20`,
                          color: DANGER_COLORS[dz.level] || IOS_COLORS.orange,
                        }}
                      >
                        Level {dz.level}
                      </span>
                      <span className="text-[10px] text-white/30">{dz.aspect} · {dz.altitude}</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-snug">{dz.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask the Mountain Guide — phone call section */}
          {guidePhoneNumber && (
            <div>
              <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-2">
                Ask the Mountain Guide
              </p>
              <a
                href={`tel:${guidePhoneNumber}`}
                className="glass-card rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-all block"
                style={{ borderColor: `${IOS_COLORS.blue}30` }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${IOS_COLORS.blue}15` }}
                >
                  <svg
                    className="w-5 h-5"
                    style={{ color: IOS_COLORS.blue }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: IOS_COLORS.blue }}>
                    Call Mountain Guide
                  </p>
                  <p className="text-[11px] text-white/35">
                    Ask if this tour is a good idea — AI-powered safety assessment
                  </p>
                </div>
                <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Action buttons — sticky bottom */}
        <div className="flex gap-2 px-4 py-3 border-t flex-shrink-0 bg-black" style={{ borderColor: IOS_COLORS.separator }}>
          <button
            onClick={handleGPXDownload}
            className="py-2.5 px-4 text-[12px] font-medium text-white/60 bg-white/[0.05] rounded-xl hover:bg-white/[0.08] active:scale-[0.98] transition-all border border-white/[0.04]"
          >
            GPX
          </button>

          {onPlanTour && (
            <button
              onClick={handleSavePlannedTour}
              disabled={tourSaved}
              className="py-2.5 px-4 text-[12px] font-semibold text-white rounded-xl active:scale-[0.98] transition-all"
              style={{
                backgroundColor: tourSaved ? `${IOS_COLORS.green}30` : IOS_COLORS.green,
                color: tourSaved ? IOS_COLORS.green : 'white',
              }}
            >
              {tourSaved ? '✓ Saved' : 'Save'}
            </button>
          )}

          <button
            onClick={handleWeGo}
            className="flex-1 py-2.5 text-[12px] font-semibold text-white rounded-xl active:scale-[0.98] transition-all shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${IOS_COLORS.blue}, #0A84FF)`,
              boxShadow: '0 4px 14px rgba(0,122,255,0.3)',
            }}
          >
            We Go! 🎿
          </button>
        </div>
      </div>

      {/* Portal-rendered export modal */}
      {exportModal}
    </>
  );
}
