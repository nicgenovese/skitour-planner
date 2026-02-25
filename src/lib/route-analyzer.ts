/**
 * Route analysis — cross-reference waypoints with avalanche bulletin
 * and compute segment-level risk for map display.
 */

import type { RouteData, Waypoint, DangerZone } from '@/types';
import type { RegionBulletin, RouteSegmentDanger } from './avalanche-parser';
import { analyzeRouteAgainstBulletin } from './avalanche-parser';

export interface AnalyzedRoute {
  route: RouteData;
  segments: RouteSegmentDanger[];
  overallRisk: 'low' | 'moderate' | 'high' | 'very_high';
  summary: string;
}

/**
 * Analyze a route against the current avalanche bulletin
 */
export function analyzeRoute(
  route: RouteData,
  bulletin: RegionBulletin | null
): AnalyzedRoute {
  if (!bulletin) {
    return {
      route,
      segments: [],
      overallRisk: 'moderate',
      summary: 'No avalanche bulletin available — exercise caution.',
    };
  }

  const waypoints = route.waypoints.map(w => ({
    lat: w.lat,
    lon: w.lon,
    elevation: w.elevation,
  }));

  const segments = analyzeRouteAgainstBulletin(waypoints, bulletin);

  // Overall risk = worst segment
  const riskOrder = ['low', 'moderate', 'high', 'very_high'] as const;
  let worstIndex = 0;
  for (const seg of segments) {
    const idx = riskOrder.indexOf(seg.riskLevel);
    if (idx > worstIndex) worstIndex = idx;
  }
  const overallRisk = riskOrder[worstIndex];

  const highRiskSegments = segments.filter(s => s.riskLevel === 'high' || s.riskLevel === 'very_high');
  let summary = '';

  if (highRiskSegments.length === 0) {
    summary = `Route appears manageable with current conditions. Danger level mostly ${segments[0]?.matchingDanger?.levelLabel || 'unknown'}.`;
  } else {
    summary = `${highRiskSegments.length} segment(s) with elevated risk. `;
    summary += highRiskSegments
      .map(s => s.description)
      .join(' ');
  }

  return { route, segments, overallRisk, summary };
}

/**
 * Get color for a route segment based on risk
 */
export function getSegmentColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'low': return '#4ade80';
    case 'moderate': return '#facc15';
    case 'high': return '#fb923c';
    case 'very_high': return '#ef4444';
    default: return '#94a3b8';
  }
}

/**
 * Calculate total distance between waypoints (haversine, km)
 */
export function calculateTotalDistance(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversine(
      waypoints[i].lat, waypoints[i].lon,
      waypoints[i + 1].lat, waypoints[i + 1].lon
    );
  }
  return Math.round(total * 10) / 10;
}

/**
 * Calculate total elevation gain
 */
export function calculateElevationGain(waypoints: Waypoint[]): number {
  let gain = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const diff = (waypoints[i + 1].elevation || 0) - (waypoints[i].elevation || 0);
    if (diff > 0) gain += diff;
  }
  return Math.round(gain);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
