import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fallback: read .env.local directly (for local dev if env loading fails)
  try {
    const envPath = join(process.cwd(), '.env.local');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
      if (match) {
        return match[1].trim();
      }
    }
  } catch { /* ignore */ }

  throw new Error('ANTHROPIC_API_KEY not found');
}

// ── Load tour database on server side ──
interface TourIndex {
  id: string;
  n: string;    // name
  d: string;    // difficulty
  e: number;    // totalElevation
  a: number;    // summit altitude
  rg: string;   // region
  rd: string;   // routeDesc
}

interface FullTour {
  id: string;
  name: string;
  difficulty: string;
  startPoint: { lat: number; lon: number; label: string };
  summit: { lat: number; lon: number; label: string; elevation: number };
  waypoints: { lat: number; lon: number }[];
  totalElevation: number;
  distance: number;
  region: string;
  routeDesc: string;
}

let tourIndex: TourIndex[] | null = null;
let fullTours: FullTour[] | null = null;

function loadFullTours(): FullTour[] {
  if (fullTours) return fullTours;
  try {
    const fullPath = join(process.cwd(), 'public', 'data', 'swiss-tours.json');
    if (existsSync(fullPath)) {
      fullTours = JSON.parse(readFileSync(fullPath, 'utf8'));
      return fullTours!;
    }
  } catch { /* ignore */ }
  return [];
}

function loadTourIndex(): TourIndex[] {
  if (tourIndex) return tourIndex;
  try {
    const indexPath = join(process.cwd(), 'public', 'data', 'swiss-tours-index.json');
    if (existsSync(indexPath)) {
      tourIndex = JSON.parse(readFileSync(indexPath, 'utf8'));
      return tourIndex!;
    }
  } catch { /* ignore */ }

  // Fallback: load full DB and create index
  const tours = loadFullTours();
  if (tours.length > 0) {
    tourIndex = tours.map((t: any) => ({
      id: t.id, n: t.name, d: t.difficulty, e: t.totalElevation,
      a: t.summit.elevation, rg: t.region, rd: t.routeDesc,
    }));
    return tourIndex!;
  }

  return [];
}

// ── Terrain analysis: compute aspect & steepness for risk assessment ──

/** SAC difficulty → estimated max slope angle */
function difficultyToSteepness(diff: string): { minAngle: number; maxAngle: number; label: string } {
  const d = diff.replace(/[+-]/g, '');
  switch (d) {
    case 'L': return { minAngle: 15, maxAngle: 30, label: '<30° gentle slopes' };
    case 'WS': return { minAngle: 25, maxAngle: 35, label: '30-35° moderate slopes' };
    case 'ZS': return { minAngle: 30, maxAngle: 40, label: '35-40° steep slopes' };
    case 'S': return { minAngle: 35, maxAngle: 45, label: '40-45° very steep' };
    case 'SS': return { minAngle: 40, maxAngle: 50, label: '45°+ extreme steep' };
    default: return { minAngle: 25, maxAngle: 35, label: 'unknown steepness' };
  }
}

/** Compute bearing from point A to point B (degrees) */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/** Convert bearing to 8-point compass aspect */
function bearingToAspect(deg: number): string {
  const aspects = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return aspects[Math.round(deg / 45) % 8];
}

/** Compute dominant aspects of a tour from its waypoints (upper half = summit approach) */
function computeTourAspects(tour: FullTour): string[] {
  const wps = tour.waypoints;
  if (wps.length < 2) return ['N'];

  // Focus on the upper half of the route (summit approach — most exposed)
  const upperStart = Math.floor(wps.length / 2);
  const aspects = new Map<string, number>();

  for (let i = upperStart; i < wps.length - 1; i++) {
    // Route direction = direction of travel; slope aspect = perpendicular to contour
    // For ski tours going UP, the slope they're on faces roughly OPPOSITE to travel direction
    const b = bearing(wps[i].lat, wps[i].lon, wps[i + 1].lat, wps[i + 1].lon);
    // Slope faces opposite to uphill travel direction (if going north, slope faces south)
    const slopeAspectDeg = (b + 180) % 360;
    const aspect = bearingToAspect(slopeAspectDeg);
    aspects.set(aspect, (aspects.get(aspect) || 0) + 1);
  }

  // Also add the direct start→summit aspect (dominant exposure)
  const directBearing = bearing(tour.startPoint.lat, tour.startPoint.lon, tour.summit.lat, tour.summit.lon);
  const directAspect = bearingToAspect((directBearing + 180) % 360);
  aspects.set(directAspect, (aspects.get(directAspect) || 0) + 3); // weight direct aspect higher

  // Return top 2 most common aspects
  return [...aspects.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([asp]) => asp);
}

/** Assess tour risk against parsed avalanche bulletin data */
interface BulletinDanger {
  level: number;
  aspects: string[];
  elevationHigh?: number;
  elevationLow?: number;
}

interface BulletinProblem {
  type: string;
  aspects: string[];
  elevationHigh?: number;
  elevationLow?: number;
}

function assessTourRisk(
  tour: FullTour,
  tourAspects: string[],
  dangerRatings: BulletinDanger[],
  problems: BulletinProblem[],
): { riskLevel: string; details: string } {
  const steepness = difficultyToSteepness(tour.difficulty);
  const summitAlt = tour.summit.elevation;
  const startAlt = summitAlt - tour.totalElevation;

  // Find the highest danger level that matches this tour's aspects and elevation
  let matchedDanger = 1;
  let matchedBand = '';

  for (const dr of dangerRatings) {
    // Check aspect overlap
    const aspectMatch = tourAspects.some(a => dr.aspects.includes(a)) || dr.aspects.length === 0;
    if (!aspectMatch) continue;

    // Check elevation overlap
    const elevLow = dr.elevationLow || 0;
    const elevHigh = dr.elevationHigh || 5000;
    const tourOverlaps = summitAlt >= elevLow || startAlt <= elevHigh;
    if (!tourOverlaps) continue;

    if (dr.level > matchedDanger) {
      matchedDanger = dr.level;
      matchedBand = elevLow > 0 ? `above ${elevLow}m` : elevHigh < 5000 ? `below ${elevHigh}m` : '';
    }
  }

  // Find matching problems
  const matchedProblems: string[] = [];
  for (const p of problems) {
    const aspectMatch = tourAspects.some(a => p.aspects.includes(a)) || p.aspects.length === 0;
    const elevLow = p.elevationLow || 0;
    const elevHigh = p.elevationHigh || 5000;
    const elevMatch = summitAlt >= elevLow || startAlt <= elevHigh;
    if (aspectMatch && elevMatch) {
      matchedProblems.push(p.type.replace(/_/g, ' '));
    }
  }

  // Compute composite risk: danger level + steepness factor
  let riskLevel: string;
  if (matchedDanger >= 4) {
    riskLevel = 'CRITICAL';
  } else if (matchedDanger >= 3 && steepness.maxAngle >= 35) {
    riskLevel = 'HIGH';
  } else if (matchedDanger >= 3 && steepness.maxAngle < 35) {
    riskLevel = 'MODERATE';
  } else if (matchedDanger >= 2 && steepness.maxAngle >= 40) {
    riskLevel = 'HIGH';
  } else if (matchedDanger >= 2) {
    riskLevel = 'MODERATE';
  } else {
    riskLevel = 'LOW';
  }

  // Build details string
  const parts = [
    `Danger ${matchedDanger}${matchedBand ? ' ' + matchedBand : ''}`,
    `aspects ${tourAspects.join('/')}`,
    steepness.label,
    `${startAlt.toFixed(0)}-${summitAlt}m`,
  ];
  if (matchedProblems.length > 0) {
    parts.push(`problems: ${matchedProblems.join(', ')}`);
  }

  return { riskLevel, details: parts.join(' | ') };
}

/** Pre-filter tours relevant to the user's message */
function preFilterTours(userMessage: string, allTours: TourIndex[]): TourIndex[] {
  const msg = userMessage.toLowerCase();

  // Extract region hints
  const regionKeywords: Record<string, string[]> = {
    'Gotthard / Uri Alpen': ['andermatt', 'gotthard', 'uri', 'furka', 'oberalp', 'realp', 'göschenen', 'vermigel', 'maighels', 'hospental'],
    'Zentralschweiz': ['zentralschweiz', 'schwyz', 'engelberg', 'titlis', 'pilatus', 'brunni', 'unterschächen', 'isenthal', 'muotathal'],
    'Berner Oberland': ['berner oberland', 'grindelwald', 'jungfrau', 'lauterbrunnen', 'kandersteg', 'adelboden', 'lenk', 'gstaad'],
    'Walliser Alpen': ['wallis', 'zermatt', 'saas', 'simplon', 'aletsch', 'verbier', 'val d\'anniviers'],
    'Graubünden West': ['graubünden', 'davos', 'lenzerheide', 'arosa', 'flüela', 'julier', 'albula'],
    'Graubünden Ost': ['engadin', 'st. moritz', 'bernina', 'silvretta', 'samnaun', 'val müstair'],
    'Voralpen': ['voralpen', 'appenzell', 'toggenburg', 'glarner'],
    'Ostschweiz': ['ostschweiz', 'alpstein', 'säntis', 'churfirsten'],
  };

  let matchedRegion: string | null = null;
  for (const [region, keywords] of Object.entries(regionKeywords)) {
    if (keywords.some(k => msg.includes(k))) {
      matchedRegion = region;
      break;
    }
  }

  // Extract difficulty hints
  const diffHints: string[] = [];
  if (msg.includes('leicht') || msg.includes('easy') || msg.includes('anfänger')) diffHints.push('L');
  if (msg.includes('ws') || msg.includes('wenig schwierig')) diffHints.push('WS');
  if (msg.includes('zs') || msg.includes('ziemlich schwierig')) diffHints.push('ZS');
  if (msg.includes('schwer') || msg.includes('steil') || msg.includes('steep')) diffHints.push('S', 'ZS');

  // Extract name/peak hints
  const nameWords = msg.split(/\s+/).filter(w => w.length > 3 && /^[a-zäöü]/.test(w));

  let filtered = allTours;

  // Apply region filter
  if (matchedRegion) {
    filtered = filtered.filter(t => t.rg === matchedRegion);
  }

  // Apply difficulty filter
  if (diffHints.length > 0) {
    filtered = filtered.filter(t => diffHints.some(d => t.d.startsWith(d)));
  }

  // If we have specific name matches, prioritize those
  const nameMatches = allTours.filter(t => {
    const text = `${t.n} ${t.rd}`.toLowerCase();
    return nameWords.some(w => text.includes(w));
  });

  // Combine: name matches first, then region-filtered, deduplicated
  const seen = new Set<string>();
  const result: TourIndex[] = [];

  for (const t of [...nameMatches, ...filtered]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      result.push(t);
    }
    if (result.length >= 50) break;
  }

  // If still too few, add more from the full database
  if (result.length < 20) {
    // Default to group's preferred areas
    const preferred = allTours.filter(t =>
      ['Gotthard / Uri Alpen', 'Zentralschweiz', 'Berner Oberland'].includes(t.rg)
      && !seen.has(t.id)
    );
    for (const t of preferred) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        result.push(t);
      }
      if (result.length >= 50) break;
    }
  }

  return result.slice(0, 50);
}

const SYSTEM_PROMPT = `You are an expert Swiss ski mountaineering guide. You help plan safe ski tours using REAL, VERIFIED tour data.

IMPORTANT — TOUR DATABASE:
You have access to a database of real Swiss ski tours with verified coordinates from Swisstopo. When suggesting tours, you MUST select from this database using tour IDs. NEVER invent or guess coordinates.

When the user asks for tour suggestions, ALWAYS suggest exactly 5 different tours. Respond with a \`\`\`suggestions\`\`\` block containing a JSON array of 5 options. Each suggestion MUST reference a tour from the database by its ID:
{
  "tourId": "st-1234",
  "risk": "LOW",
  "safetyNote": "2-3 sentence safety narrative",
  "keyInfo": "Why this tour is a good pick — conditions, highlights, comparison to past tours"
}

Pick 5 varied options: mix different difficulties, regions, and styles (e.g. one easy/scenic, one challenging/steep, one hidden gem, one classic, one with best current conditions). This gives the group real choice.

When the user asks to plan ONE specific tour, use a \`\`\`json\`\`\` block with the same format (single object, not array).

YOUR ROLE — BE CREATIVE AND SMART:
- Study the tour database AND current conditions to find the best matches
- Consider: avalanche bulletin, weather, snow depths, aspect, elevation, difficulty
- The group loves quiet/uncrowded tours, good powder, and interesting terrain
- Don't just suggest the obvious classics — find hidden gems and creative options
- Explain WHY each tour is good for this specific day/conditions
- Compare with tours the group has done before ("Ähnlich wie euer Stotzigen Firsten...")

GROUP CONTEXT:
- Based in Central Switzerland (Uri/Schwyz/Obwalden)
- Core members: Niclas Genovese, Jonas Widmer, Lukas Preiswerk, Laura Köcher, Vincent Wirth
- Typical elevation: 850-1400m, difficulty: WS to ZS (occasionally S)
- Values: quiet tours, good powder, interesting terrain, comfortable with 45° slopes
- Uses Swiss-German (Wummgeräusche, wächtig, etc.)

SAFETY — MANDATORY for every suggestion:
- Each tour in the database includes pre-computed RISK assessment: slope aspects (N/NE/E/SE/S/SW/W/NW), steepness from SAC grade, and cross-reference with today's avalanche bulletin
- USE the pre-computed RISK level (LOW/MODERATE/HIGH/CRITICAL) — it factors in slope exposure, elevation bands, and bulletin danger ratings
- NEVER suggest a CRITICAL risk tour. For HIGH risk tours, only suggest if explicitly asked for challenging options, and add strong warnings
- In your safetyNote, ALWAYS mention: the specific dangerous aspects, elevation bands, and avalanche problems (wind slab, persistent weak layer, etc.)
- Example: "Nordhänge über 2400m bei Stufe 3 kritisch — Triebschnee auf NE/N-Expositionen. Route verläuft hauptsächlich auf SW-Hängen, daher vertretbar."
- Always mention equipment: LVS, Schaufel, Sonde (+ extras for glacier/steep)
- Emergency: REGA 1414
- Prefer tours where the dominant slope aspects AVOID the bulletin's critical aspects

FORMATTING:
- Reference Gipfelbuch/SAC/Hikr reports naturally (1-2 sentences)
- After the JSON block, add conversational context and tips
- If the user asks a general question (not a tour), respond normally without JSON`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      avalancheSummary,
      weatherSummary,
      tourLog,
      snowSummary,
      incidentSummary,
      recentReports,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    // Load and pre-filter tour database
    const allTours = loadTourIndex();
    const allFullTours = loadFullTours();
    const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop();
    const relevantTours = lastUserMsg
      ? preFilterTours(lastUserMsg.content, allTours)
      : allTours.slice(0, 50);

    // Parse bulletin danger ratings for risk assessment
    let bulletinDangerRatings: BulletinDanger[] = [];
    let bulletinProblems: BulletinProblem[] = [];
    if (avalancheSummary) {
      // Also accept raw bulletin data from body for richer analysis
      const rawBulletin = body.rawBulletin;
      if (rawBulletin && rawBulletin.regions) {
        for (const region of rawBulletin.regions) {
          if (region.dangerRatings) bulletinDangerRatings.push(...region.dangerRatings);
          if (region.problems) bulletinProblems.push(...region.problems);
        }
      }
    }

    // Build full tour map for aspect computation
    const fullTourMap = new Map<string, FullTour>();
    for (const ft of allFullTours) {
      fullTourMap.set(ft.id, ft);
    }

    // Build tour database context WITH risk assessment
    let tourDbContext = '';
    if (relevantTours.length > 0) {
      const tourLines = relevantTours.map(t => {
        let line = `[${t.id}] ${t.n} | ${t.d || '?'} | ↑${t.e || '?'}m | ${t.a || '?'}m alt | ${t.rg} | ${t.rd}`;

        // Compute terrain exposure and risk if we have bulletin + full tour data
        const fullTour = fullTourMap.get(t.id);
        if (fullTour) {
          const aspects = computeTourAspects(fullTour);
          const steepness = difficultyToSteepness(t.d || 'WS');
          line += ` | exposure: ${aspects.join('/')} | ${steepness.label}`;

          if (bulletinDangerRatings.length > 0) {
            const risk = assessTourRisk(fullTour, aspects, bulletinDangerRatings, bulletinProblems);
            line += ` | RISK: ${risk.riskLevel} (${risk.details})`;
          }
        }

        return line;
      });

      tourDbContext = `TOUR DATABASE (select from these using tourId — coordinates are verified):\n` +
        `Each tour includes computed slope exposure (dominant aspects), steepness from SAC grade, and risk assessment cross-referenced with today's avalanche bulletin.\n` +
        tourLines.join('\n');
    }

    let contextParts: string[] = [];
    if (tourDbContext) contextParts.push(tourDbContext);
    if (avalancheSummary) contextParts.push(`CURRENT AVALANCHE BULLETIN:\n${avalancheSummary}`);
    if (weatherSummary) contextParts.push(`CURRENT WEATHER FORECAST:\n${weatherSummary}`);
    if (snowSummary) contextParts.push(snowSummary);
    if (incidentSummary) contextParts.push(incidentSummary);
    if (recentReports) contextParts.push(recentReports);
    if (tourLog && tourLog.length > 0) {
      const logSummary = tourLog.map((t: any) => {
        let entry = `- ${t.name} (${t.date}, ${t.difficulty || '?'}, ${t.elevation || '?'}m, rated ${t.rating}/5)`;
        if (t.participants) entry += ` — with: ${t.participants}`;
        if (t.conditions) entry += ` — conditions: ${t.conditions}`;
        if (t.notes) entry += ` — notes: ${t.notes}`;
        return entry;
      }).join('\n');
      contextParts.push(`GROUP'S TOUR LOG:\n${logSummary}`);
    }

    const systemPrompt = contextParts.length > 0
      ? `${SYSTEM_PROMPT}\n\n--- CURRENT CONDITIONS ---\n${contextParts.join('\n\n')}`
      : SYSTEM_PROMPT;

    const apiKey = getApiKey();

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Anthropic API returned ${anthropicRes.status}`);
    }

    const data = await anthropicRes.json();

    const text = (data.content || [])
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return NextResponse.json({ content: text });
  } catch (error: any) {
    console.error('Claude API error:', error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: 'Failed to get AI response', details: error.message },
      { status }
    );
  }
}
