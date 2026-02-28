/**
 * Avalanche Incident Utilities
 *
 * Parses the EnviDat CSV of Swiss avalanche accidents and provides
 * filtering + summarisation for AI context.
 *
 * Source: https://www.envidat.ch/dataset/avalanche-accidents-switzerland-since-1970
 * License: ODbL
 */

import type { AvalancheIncident } from '@/types';

// ── CSV Parsing ──

/**
 * Parse the EnviDat avalanche accidents CSV into typed objects.
 * The CSV has a header row; we map columns positionally because
 * the file is stable and well-known.
 */
export function parseIncidentCSV(csv: string): AvalancheIncident[] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect header to find column indices
  const header = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const col = (name: string) => header.indexOf(name);

  // Common column names in the EnviDat dataset
  const iDate = Math.max(col('date'), col('datum'), 0);
  const iLat = Math.max(col('latitude'), col('lat'), col('y'), 1);
  const iLon = Math.max(col('longitude'), col('lon'), col('x'), 2);
  const iElev = Math.max(col('elevation'), col('altitude'), col('hoehe'), 3);
  const iAspect = Math.max(col('aspect'), col('exposition'), 4);
  const iIncl = Math.max(col('inclination'), col('neigung'), 5);
  const iDanger = Math.max(col('dangerlevel'), col('danger_level'), col('gefahrenstufe'), 6);
  const iCaught = Math.max(col('caught'), col('erfasst'), 7);
  const iBuried = Math.max(col('buried'), col('verschuettet'), 8);
  const iFatal = Math.max(col('killed'), col('fatalities'), col('getoetet'), 9);
  const iActivity = Math.max(col('activity'), col('aktivitaet'), 10);

  const incidents: AvalancheIncident[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const parts = lines[i].split(';').map(p => p.trim().replace(/"/g, ''));
      if (parts.length < 6) continue;

      const lat = parseFloat(parts[iLat]);
      const lon = parseFloat(parts[iLon]);
      if (isNaN(lat) || isNaN(lon)) continue;

      // Skip coordinates outside Switzerland bounding box
      if (lat < 45.5 || lat > 48.0 || lon < 5.5 || lon > 10.8) continue;

      incidents.push({
        id: `env-${i}`,
        date: parts[iDate] || '',
        lat,
        lon,
        elevation: parseFloat(parts[iElev]) || 0,
        aspect: parts[iAspect] || '',
        inclination: parseFloat(parts[iIncl]) || 0,
        dangerLevel: parseInt(parts[iDanger], 10) || 0,
        caught: parseInt(parts[iCaught], 10) || 0,
        buried: parseInt(parts[iBuried], 10) || 0,
        fatalities: parseInt(parts[iFatal], 10) || 0,
        activity: parts[iActivity] || '',
      });
    } catch {
      // skip malformed rows
    }
  }

  return incidents;
}

// ── Haversine Distance ──

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Filtering ──

export function filterNearby(
  incidents: AvalancheIncident[],
  lat: number,
  lon: number,
  radiusKm: number
): AvalancheIncident[] {
  return incidents.filter(inc => haversineKm(lat, lon, inc.lat, inc.lon) <= radiusKm);
}

// ── Summary for AI ──

export function summarizeIncidents(incidents: AvalancheIncident[]): string {
  if (incidents.length === 0) return 'No avalanche incidents recorded nearby.';

  const total = incidents.length;
  const fatal = incidents.filter(i => i.fatalities > 0).length;
  const totalFatalities = incidents.reduce((s, i) => s + i.fatalities, 0);

  // Last 10 years
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const recent = incidents.filter(i => new Date(i.date) >= tenYearsAgo);

  // Aspect distribution
  const aspectCounts: Record<string, number> = {};
  incidents.forEach(i => {
    if (i.aspect) aspectCounts[i.aspect] = (aspectCounts[i.aspect] || 0) + 1;
  });
  const topAspects = Object.entries(aspectCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a)
    .join(', ');

  // Elevation range
  const elevations = incidents.map(i => i.elevation).filter(e => e > 0);
  const avgElev = elevations.length > 0
    ? Math.round(elevations.reduce((s, e) => s + e, 0) / elevations.length)
    : 0;

  // Activity breakdown
  const skiTouringCount = incidents.filter(i =>
    i.activity.toLowerCase().includes('tour') ||
    i.activity.toLowerCase().includes('ski')
  ).length;

  let summary = `${total} avalanche incidents recorded within search radius.`;
  if (recent.length > 0) {
    summary += ` ${recent.length} in the last 10 years.`;
  }
  summary += ` ${fatal} fatal events (${totalFatalities} deaths total).`;
  if (topAspects) {
    summary += ` Most common aspects: ${topAspects}.`;
  }
  if (avgElev > 0) {
    summary += ` Average elevation: ${avgElev}m.`;
  }
  if (skiTouringCount > 0) {
    summary += ` ${skiTouringCount} ski touring related.`;
  }

  return summary;
}
