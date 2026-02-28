'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { TourLogEntry, CurrentConditions, PlannedTour, RiskLevel } from '@/types';
import { RISK_LEVEL_COLORS, DANGER_COLORS, IOS_COLORS } from '@/types';
import ConditionsCard from './ConditionsCard';

interface Props {
  tourLog: TourLogEntry[];
  plannedTours: PlannedTour[];
  conditions: CurrentConditions | null;
  onViewTour: (entry: TourLogEntry) => void;
  onViewPlannedTour: (tour: PlannedTour) => void;
  onCompleteTour: (tour: PlannedTour, rating: number, conditions: string) => void;
  onPlanTour: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  L: '#4ade80',
  WS: '#60a5fa',
  'WS+': '#818cf8',
  ZS: '#f59e0b',
  'ZS+': '#f97316',
  S: '#ef4444',
  'S+': '#dc2626',
  SS: '#991b1b',
  AS: '#7f1d1d',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="transition-colors"
          style={{
            fontSize: '9px',
            color: i <= rating ? IOS_COLORS.yellow : 'rgba(255,255,255,0.1)',
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function InteractiveStarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className="p-0.5 active:scale-110 transition-transform"
        >
          <span
            className="text-lg"
            style={{ color: i <= rating ? IOS_COLORS.yellow : 'rgba(255,255,255,0.12)' }}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function TrendIndicator({ trend }: { trend?: 'better' | 'same' | 'worse' }) {
  if (!trend || trend === 'same') {
    return <span className="text-[10px] text-white/20">→</span>;
  }
  if (trend === 'better') {
    return <span className="text-[10px]" style={{ color: IOS_COLORS.green }}>↓ better</span>;
  }
  return <span className="text-[10px]" style={{ color: IOS_COLORS.orange }}>↑ worse</span>;
}

function RiskBadgeSmall({ risk }: { risk?: RiskLevel }) {
  if (!risk) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
      style={{
        backgroundColor: `${RISK_LEVEL_COLORS[risk]}15`,
        color: RISK_LEVEL_COLORS[risk],
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

function CompleteTourModal({
  tour,
  onComplete,
  onCancel,
}: {
  tour: PlannedTour;
  onComplete: (rating: number, conditions: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(3);
  const [conditionsText, setConditionsText] = useState('');

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
      style={{ zIndex: 5000 }}
      onClick={onCancel}
    >
      <div
        className="glass-card-elevated rounded-2xl p-5 w-full max-w-sm slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-1">Complete Tour</h3>
        <p className="text-xs text-white/40 mb-4">
          How was {tour.name}? Log it to your tour history.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-white/30 block mb-2 uppercase tracking-wider font-medium">
              Rating
            </label>
            <InteractiveStarRating rating={rating} onChange={setRating} />
          </div>

          <div>
            <label className="text-[11px] text-white/30 block mb-1 uppercase tracking-wider font-medium">
              Conditions
            </label>
            <textarea
              value={conditionsText}
              onChange={e => setConditionsText(e.target.value)}
              placeholder="Great powder, firm base, some wind crust above 2800m..."
              rows={3}
              className="w-full bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.04] resize-none transition-colors"
              onFocus={e => (e.target.style.borderColor = `${IOS_COLORS.blue}50`)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.04)')}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-white/50 bg-white/[0.05] rounded-xl hover:bg-white/[0.08] active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(rating, conditionsText)}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl active:scale-[0.98] transition-all"
            style={{ backgroundColor: IOS_COLORS.green }}
          >
            Log Tour
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function HomeScreen({
  tourLog,
  plannedTours,
  conditions,
  onViewTour,
  onViewPlannedTour,
  onCompleteTour,
  onPlanTour,
}: Props) {
  const [completingTour, setCompletingTour] = useState<PlannedTour | null>(null);

  const sortedTours = [...tourLog].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const sortedPlanned = [...plannedTours].sort((a, b) => {
    const dateA = new Date(a.plannedDate).getTime();
    const dateB = new Date(b.plannedDate).getTime();
    return dateA - dateB; // nearest date first
  });

  const handleComplete = (rating: number, conditionsText: string) => {
    if (completingTour) {
      onCompleteTour(completingTour, rating, conditionsText);
      setCompletingTour(null);
    }
  };

  return (
    <div className="flex flex-col h-full ios-scroll overflow-y-auto">
      <div className="px-4 pt-2 pb-24 space-y-5">
        {/* Conditions */}
        <section>
          <SectionLabel>Conditions</SectionLabel>
          <ConditionsCard conditions={conditions} />
        </section>

        {/* Plan a tour CTA */}
        <button
          onClick={onPlanTour}
          className="w-full group relative overflow-hidden rounded-2xl p-[1px] transition-all active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${IOS_COLORS.blue}80, ${IOS_COLORS.blue}40, ${IOS_COLORS.blue}20)`,
          }}
        >
          <div className="relative flex items-center gap-4 rounded-[15px] bg-black/90 backdrop-blur-xl px-5 py-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${IOS_COLORS.blue}, #0A84FF)`,
                boxShadow: `0 4px 14px ${IOS_COLORS.blue}30`,
              }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="text-[15px] font-semibold text-white tracking-tight">Plan a Tour</p>
              <p className="text-[11px] text-white/40 mt-0.5">AI-powered route suggestions</p>
            </div>
            <svg className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Planned tours */}
        {sortedPlanned.length > 0 && (
          <section>
            <SectionLabel>Planned Tours · {sortedPlanned.length}</SectionLabel>
            <div className="space-y-2">
              {sortedPlanned.map((tour, index) => {
                const dangerWorsened = tour.dangerTrend === 'worse';
                const dangerLevel = tour.currentDangerLevel || tour.originalDangerLevel;
                const dangerColor = dangerLevel ? DANGER_COLORS[dangerLevel] : null;
                const plannedDate = new Date(tour.plannedDate + 'T12:00:00');
                const isUpcoming = plannedDate >= new Date(new Date().toDateString());
                const dateLabel = plannedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={tour.id}
                    className="glass-card rounded-2xl overflow-hidden fade-up"
                    style={{
                      animationDelay: `${index * 40}ms`,
                      borderLeft: dangerWorsened ? `2px solid ${IOS_COLORS.orange}` : undefined,
                    }}
                  >
                    <button
                      onClick={() => onViewPlannedTour(tour)}
                      className="w-full text-left p-3.5 transition-all active:scale-[0.98] hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3">
                        {/* Danger level indicator */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: dangerColor
                              ? `linear-gradient(135deg, ${dangerColor}15, ${dangerColor}08)`
                              : 'rgba(255,255,255,0.04)',
                            border: dangerColor
                              ? `1px solid ${dangerColor}30`
                              : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {dangerLevel ? (
                            <span
                              className="text-[14px] font-bold"
                              style={{ color: dangerColor || 'rgba(255,255,255,0.4)' }}
                            >
                              {dangerLevel}
                            </span>
                          ) : (
                            <span className="text-[14px] text-white/20">—</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-white/90 truncate tracking-tight">
                              {tour.name}
                            </p>
                            <RiskBadgeSmall risk={tour.route.risk} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: isUpcoming ? IOS_COLORS.blue : 'rgba(255,255,255,0.25)' }}
                            >
                              {dateLabel}
                            </span>
                            <span className="text-white/10">·</span>
                            <span className="text-[10px] text-white/25">↑{tour.route.totalElevation}m</span>
                            <span className="text-white/10">·</span>
                            <span className="text-[10px] text-white/25">
                              🎿 {tour.equipment.length} items
                            </span>
                            {tour.dangerTrend && tour.dangerTrend !== 'same' && (
                              <>
                                <span className="text-white/10">·</span>
                                <TrendIndicator trend={tour.dangerTrend} />
                              </>
                            )}
                          </div>
                          {dangerWorsened && (
                            <p
                              className="text-[10px] font-medium mt-1"
                              style={{ color: IOS_COLORS.orange }}
                            >
                              ⚠ Danger increased since planning
                            </p>
                          )}
                        </div>

                        <svg className="w-4 h-4 text-white/10 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    {/* Complete tour button */}
                    <div className="px-3.5 pb-3 pt-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setCompletingTour(tour);
                        }}
                        className="w-full py-2 text-[11px] font-semibold rounded-lg active:scale-[0.98] transition-all"
                        style={{
                          backgroundColor: `${IOS_COLORS.green}12`,
                          color: IOS_COLORS.green,
                        }}
                      >
                        ✓ Complete Tour
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tour log */}
        <section>
          <SectionLabel>Your Tours · {sortedTours.length}</SectionLabel>

          {sortedTours.length === 0 ? (
            <div className="glass-card rounded-2xl text-center py-10">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl opacity-40">⛷️</span>
              </div>
              <p className="text-white/40 text-sm font-medium">No tours yet</p>
              <p className="text-white/20 text-xs mt-1">Plan your first tour with AI</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTours.map((tour, index) => {
                const diffColor = DIFFICULTY_COLORS[tour.route.difficulty] || '#94a3b8';
                const startWp = tour.route.waypoints[0];
                const endWp = tour.route.waypoints[tour.route.waypoints.length - 1];

                return (
                  <button
                    key={tour.id}
                    onClick={() => onViewTour(tour)}
                    className="w-full text-left glass-card rounded-2xl p-3.5 transition-all active:scale-[0.98] hover:bg-white/[0.03] fade-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Difficulty pill */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${diffColor}15, ${diffColor}08)`,
                          border: `1px solid ${diffColor}30`,
                        }}
                      >
                        <span className="text-[11px] font-bold tracking-tight" style={{ color: diffColor }}>
                          {tour.route.difficulty || '?'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-white/90 truncate tracking-tight">{tour.name}</p>
                          <StarRating rating={tour.rating} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-white/25 font-medium">{tour.date}</span>
                          <span className="text-white/10">·</span>
                          <span className="text-[10px] text-white/25">↑{tour.route.totalElevation}m</span>
                          <span className="text-white/10">·</span>
                          <span className="text-[10px] text-white/25">{tour.route.distance}km</span>
                        </div>
                        {startWp && endWp && startWp.label !== endWp.label && (
                          <p className="text-[10px] text-white/15 mt-0.5 truncate">
                            {startWp.label} → {endWp.label}
                          </p>
                        )}
                      </div>

                      <svg className="w-4 h-4 text-white/10 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Complete tour modal */}
      {completingTour && (
        <CompleteTourModal
          tour={completingTour}
          onComplete={handleComplete}
          onCancel={() => setCompletingTour(null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-white/25 uppercase font-semibold tracking-[0.15em] mb-2">
      {children}
    </p>
  );
}
