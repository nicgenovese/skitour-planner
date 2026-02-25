/**
 * SLF Avalanche Bulletin Parser
 *
 * Parses the CAAML v6 JSON from the SLF API into structured data
 * that can be cross-referenced with route waypoints.
 *
 * API: https://aws.slf.ch/api/bulletin/caaml/en/json
 * License: CC BY 4.0 (source: WSL/SLF)
 */

// ── Types ──

export interface AvalancheDangerRating {
  level: 1 | 2 | 3 | 4 | 5;
  levelLabel: string;
  aspects: string[];
  elevationHigh?: number;
  elevationLow?: number;
  elevationBand?: string;
}

export interface AvalancheProblem {
  type: string;
  aspects: string[];
  elevationHigh?: number;
  elevationLow?: number;
  comment?: string;
}

export interface RegionBulletin {
  regionId: string;
  regionName: string;
  validFrom: string;
  validTo: string;
  dangerRatings: AvalancheDangerRating[];
  problems: AvalancheProblem[];
  snowpackComment?: string;
  tendencyComment?: string;
  tendency?: 'increasing' | 'steady' | 'decreasing';
}

export interface ParsedBulletin {
  publicationTime: string;
  validFrom: string;
  validTo: string;
  regions: RegionBulletin[];
  source: string;
}

// ── Danger level labels and mapping ──

const DANGER_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'Considerable',
  4: 'High',
  5: 'Very High',
};

const DANGER_TEXT_TO_LEVEL: Record<string, number> = {
  low: 1,
  moderate: 2,
  considerable: 3,
  high: 4,
  very_high: 5,
};

const ALL_ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Parse the SLF CAAML v6 JSON response into structured bulletin data
 */
export function parseBulletinJSON(data: any): ParsedBulletin | null {
  try {
    const bulletins = data?.bulletins;
    if (!bulletins || !Array.isArray(bulletins)) return null;

    const regions: RegionBulletin[] = bulletins.map((b: any) => {
      // Extract danger ratings
      const dangerRatings: AvalancheDangerRating[] = (b.dangerRatings || []).map((dr: any) => {
        const level = parseDangerLevel(dr.mainValue);
        const elevation = dr.elevation || {};

        let elevationBand = 'all elevations';
        if (elevation.lowerBound && elevation.upperBound) {
          elevationBand = `${elevation.lowerBound}\u2013${elevation.upperBound}m`;
        } else if (elevation.lowerBound) {
          elevationBand = `above ${elevation.lowerBound}m`;
        } else if (elevation.upperBound) {
          elevationBand = `below ${elevation.upperBound}m`;
        }

        return {
          level: Math.min(5, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5,
          levelLabel: DANGER_LABELS[level] || 'Unknown',
          aspects: dr.aspects || ALL_ASPECTS,
          elevationHigh: elevation.upperBound || undefined,
          elevationLow: elevation.lowerBound || undefined,
          elevationBand,
        };
      });

      // Extract avalanche problems
      const problems: AvalancheProblem[] = (b.avalancheProblems || []).map((p: any) => {
        const elevation = p.elevation || {};
        return {
          type: p.problemType || 'unknown',
          aspects: p.aspects || [],
          elevationHigh: elevation.upperBound || undefined,
          elevationLow: elevation.lowerBound || undefined,
          comment: stripHtml(p.comment || ''),
        };
      });

      // Region info
      const regionNames = (b.regions || []).map((r: any) => r.name).join(', ');
      const regionId = (b.regions || [])[0]?.regionID || b.bulletinID || 'unknown';

      // Tendency
      let tendency: 'increasing' | 'steady' | 'decreasing' | undefined;
      if (b.tendency) {
        const tendencies = Array.isArray(b.tendency) ? b.tendency : [b.tendency];
        const t = tendencies[0];
        if (t?.tendencyType === 'increasing') tendency = 'increasing';
        else if (t?.tendencyType === 'decreasing') tendency = 'decreasing';
        else tendency = 'steady';
      }

      return {
        regionId,
        regionName: regionNames || regionId,
        validFrom: b.validTime?.startTime || '',
        validTo: b.validTime?.endTime || '',
        dangerRatings,
        problems,
        snowpackComment: stripHtml(b.snowpackStructure?.comment || ''),
        tendencyComment: stripHtml(
          Array.isArray(b.tendency) ? b.tendency[0]?.comment || '' : b.tendency?.comment || ''
        ),
        tendency,
      };
    });

    return {
      publicationTime: bulletins[0]?.publicationTime || new Date().toISOString(),
      validFrom: bulletins[0]?.validTime?.startTime || '',
      validTo: bulletins[0]?.validTime?.endTime || '',
      regions,
      source: 'WSL Institute for Snow and Avalanche Research SLF',
    };
  } catch (e) {
    console.error('Failed to parse bulletin JSON:', e);
    return null;
  }
}

/**
 * Analyze a route against the avalanche bulletin
 * Returns danger assessment for each segment
 */
export interface RouteSegmentDanger {
  fromIndex: number;
  toIndex: number;
  aspect: string;
  avgElevation: number;
  matchingDanger: AvalancheDangerRating | null;
  matchingProblems: AvalancheProblem[];
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  description: string;
}

export function analyzeRouteAgainstBulletin(
  waypoints: Array<{ lat: number; lon: number; elevation?: number }>,
  bulletin: RegionBulletin
): RouteSegmentDanger[] {
  const segments: RouteSegmentDanger[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);
    const aspect = bearingToAspect(bearing);
    const avgElev = ((from.elevation || 2000) + (to.elevation || 2000)) / 2;

    let matchingDanger: AvalancheDangerRating | null = null;
    let matchingProblems: AvalancheProblem[] = [];

    for (const dr of bulletin.dangerRatings) {
      const aspectMatch = dr.aspects.includes(aspect) || dr.aspects.length === 0;
      const elevMatch = (
        (!dr.elevationHigh || avgElev <= dr.elevationHigh) &&
        (!dr.elevationLow || avgElev >= dr.elevationLow)
      );
      if (aspectMatch && elevMatch) {
        if (!matchingDanger || dr.level > matchingDanger.level) {
          matchingDanger = dr;
        }
      }
    }

    for (const prob of bulletin.problems) {
      const aspectMatch = prob.aspects.includes(aspect) || prob.aspects.length === 0;
      const elevMatch = (
        (!prob.elevationHigh || avgElev <= prob.elevationHigh) &&
        (!prob.elevationLow || avgElev >= prob.elevationLow)
      );
      if (aspectMatch && elevMatch) matchingProblems.push(prob);
    }

    const level = matchingDanger?.level || 1;
    const riskLevel = level >= 4 ? 'very_high' : level >= 3 ? 'high' : level >= 2 ? 'moderate' : 'low';

    let description = `${aspect}-facing, ~${Math.round(avgElev)}m. `;
    if (matchingDanger) {
      description += `Danger level ${level} (${DANGER_LABELS[level]}). `;
    }
    if (matchingProblems.length > 0) {
      description += `Problems: ${matchingProblems.map(p => p.type.replace(/_/g, ' ')).join(', ')}. `;
    }

    segments.push({
      fromIndex: i,
      toIndex: i + 1,
      aspect,
      avgElevation: Math.round(avgElev),
      matchingDanger,
      matchingProblems,
      riskLevel,
      description: description.trim(),
    });
  }

  return segments;
}

// ── Helpers ──

function parseDangerLevel(value: string | number): number {
  if (typeof value === 'number') return value;
  return DANGER_TEXT_TO_LEVEL[value?.toLowerCase()] || 2;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingToAspect(bearing: number): string {
  const aspects = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return aspects[index];
}
