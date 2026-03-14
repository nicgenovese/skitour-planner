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

let tourIndex: TourIndex[] | null = null;

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
  try {
    const fullPath = join(process.cwd(), 'public', 'data', 'swiss-tours.json');
    if (existsSync(fullPath)) {
      const tours = JSON.parse(readFileSync(fullPath, 'utf8'));
      tourIndex = tours.map((t: any) => ({
        id: t.id, n: t.name, d: t.difficulty, e: t.totalElevation,
        a: t.summit.elevation, rg: t.region, rd: t.routeDesc,
      }));
      return tourIndex!;
    }
  } catch { /* ignore */ }

  return [];
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
- RISK: LOW | MODERATE | HIGH | CRITICAL
- 2-3 sentence safety narrative using avalanche bulletin + weather + snow data
- LOW: Danger 1-2, stable, good reports
- MODERATE: Danger 2-3, avoidable problems
- HIGH: Danger 3+, critical aspects, incidents nearby
- CRITICAL: Danger 4-5, don't recommend
- Always mention equipment: LVS, Schaufel, Sonde (+ extras for glacier/steep)
- Emergency: REGA 1414

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
    const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop();
    const relevantTours = lastUserMsg
      ? preFilterTours(lastUserMsg.content, allTours)
      : allTours.slice(0, 50);

    // Build tour database context
    const tourDbContext = relevantTours.length > 0
      ? `TOUR DATABASE (select from these using tourId — coordinates are verified):\n${relevantTours.map(t =>
          `[${t.id}] ${t.n} | ${t.d || '?'} | ↑${t.e || '?'}m | ${t.a || '?'}m alt | ${t.rg} | ${t.rd}`
        ).join('\n')}`
      : '';

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
