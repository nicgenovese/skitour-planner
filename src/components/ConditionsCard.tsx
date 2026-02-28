'use client';

import type { CurrentConditions } from '@/types';
import { DANGER_COLORS } from '@/types';

interface Props {
  conditions: CurrentConditions | null;
}

const DANGER_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'Considerable',
  4: 'High',
  5: 'Very High',
};

export default function ConditionsCard({ conditions }: Props) {
  if (!conditions) {
    return (
      <div className="glass-card rounded-2xl p-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/5 rounded-full w-2/3" />
            <div className="h-2 bg-white/5 rounded-full w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  const dangerColor = conditions.dangerLevel
    ? DANGER_COLORS[conditions.dangerLevel] || '#94a3b8'
    : '#64748b';
  const dangerLabel = conditions.dangerLevel ? DANGER_LABELS[conditions.dangerLevel] || '' : '';

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Top: Danger level hero */}
      {conditions.dangerLevel !== null && conditions.dangerLevel > 0 && (
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${dangerColor}18, ${dangerColor}08)` }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${dangerColor}25`, border: `1.5px solid ${dangerColor}40` }}
          >
            <span className="text-xl font-bold" style={{ color: dangerColor }}>{conditions.dangerLevel}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white tracking-tight">{dangerLabel}</p>
            {conditions.dangerProblems.length > 0 && (
              <p className="text-[11px] text-white/50 mt-0.5">
                {conditions.dangerProblems.slice(0, 2).map(p => p.replace(/_/g, ' ')).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom: Weather metrics grid */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        {conditions.tempMin !== null && conditions.tempMax !== null && (
          <MetricItem
            label="Temp"
            value={`${conditions.tempMin}°/${conditions.tempMax}°`}
          />
        )}
        {conditions.snowfall !== null && (
          <MetricItem
            label="Snow"
            value={`${conditions.snowfall}cm`}
            highlight={conditions.snowfall > 10}
          />
        )}
        {conditions.freezingLevel !== null && (
          <MetricItem
            label="0° Level"
            value={`${conditions.freezingLevel}m`}
          />
        )}
        {conditions.windSpeedMax !== null && (
          <MetricItem
            label="Wind"
            value={`${conditions.windSpeedMax}`}
            unit="km/h"
            highlight={conditions.windSpeedMax > 40}
          />
        )}
      </div>

      {/* Snow station */}
      {conditions.nearestSnowDepth !== null && conditions.nearestStationName && (
        <div className="px-4 pb-3 -mt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className="inline-block w-1 h-1 rounded-full bg-blue-400/60" />
            {conditions.nearestSnowDepth}cm @ {conditions.nearestStationName}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, unit, highlight }: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-sm font-semibold tracking-tight ${highlight ? 'text-blue-300' : 'text-white/90'}`}>
        {value}
        {unit && <span className="text-[9px] text-white/40 ml-0.5">{unit}</span>}
      </p>
      <p className="text-[9px] text-white/30 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}
