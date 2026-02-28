/**
 * AI Context Builder
 *
 * Builds compact text summaries from scraped data sources
 * to include in the Claude system prompt. Keeps context short
 * to preserve token budget for the actual conversation.
 */

import type {
  SnowStationWithMeasurement,
  AvalancheIncident,
  TourReport,
} from '@/types';
import { summarizeIncidents } from './incident-utils';

// ── Snow Station Context ──

export function buildSnowContext(stations: SnowStationWithMeasurement[]): string {
  if (!stations.length) return '';

  const valid = stations
    .filter(s => s.latest && s.latest.snowDepth !== null)
    .sort((a, b) => (b.latest?.snowDepth ?? 0) - (a.latest?.snowDepth ?? 0))
    .slice(0, 8); // top 8 by snow depth

  if (!valid.length) return '';

  const lines = valid.map(s => {
    const m = s.latest!;
    let line = `${s.label} (${s.elevation}m): ${m.snowDepth}cm`;
    if (m.newSnow24h !== null && m.newSnow24h > 0) {
      line += `, +${m.newSnow24h}cm/24h`;
    }
    if (m.temperature !== null) {
      line += `, ${m.temperature}°C`;
    }
    return line;
  });

  return `NEARBY SNOW STATIONS (SLF/IMIS):\n${lines.join('\n')}`;
}

// ── Incident Context ──

export function buildIncidentContext(incidents: AvalancheIncident[]): string {
  if (!incidents.length) return '';
  const summary = summarizeIncidents(incidents);
  return `HISTORICAL AVALANCHE INCIDENTS NEARBY:\n${summary}`;
}

// ── Tour Report Context ──

export function buildReportContext(reports: TourReport[]): string {
  if (!reports.length) return '';

  const lines = reports.slice(0, 6).map(r => {
    const date = r.date ? ` (${r.date})` : '';
    const cond = r.conditionsSummary
      ? ` — ${r.conditionsSummary.slice(0, 120)}`
      : '';
    return `- ${r.title}${date}${cond} [${r.source}]`;
  });

  return `RECENT TOUR REPORTS:\n${lines.join('\n')}`;
}

// ── Combined Context Builder ──

export function buildEnrichedContext(opts: {
  snowStations?: SnowStationWithMeasurement[];
  incidents?: AvalancheIncident[];
  reports?: TourReport[];
}): string {
  const parts: string[] = [];

  if (opts.snowStations?.length) {
    parts.push(buildSnowContext(opts.snowStations));
  }
  if (opts.incidents?.length) {
    parts.push(buildIncidentContext(opts.incidents));
  }
  if (opts.reports?.length) {
    parts.push(buildReportContext(opts.reports));
  }

  return parts.filter(Boolean).join('\n\n');
}
