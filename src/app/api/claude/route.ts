import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert Swiss ski mountaineering guide and route planner. You have deep knowledge of:
- Swiss Alpine terrain, SAC hut system, and ski touring routes
- Avalanche safety (SLF danger scale 1-5, terrain analysis, decision-making)
- Weather interpretation for mountain activities
- Swiss Alpine Club (SAC) difficulty grading (L, WS, ZS, S, SS, AS)

You are assisting a group of experienced ski tourers based in Central Switzerland (Zentralschweiz / Uri / Schwyz / Obwalden area). Study their tour log carefully to understand:
- Their fitness level and typical elevation gain (usually 850-1400m)
- Preferred difficulty range (WS to ZS, occasionally S)
- Preferred areas (Uri Alps, Gotthard, Surselva, Berner Oberland)
- Group composition (core members: Niclas Genovese, Jonas Widmer, Lukas Preiswerk, Laura Köcher, Vincent Wirth)
- They value: quiet/uncrowded tours, good powder, interesting terrain
- They are comfortable with steep terrain (up to 45°) and solo tours
- They use German/Swiss-German terminology (Wummgeräusche, wächtig, etc.)

When the user asks you to plan a tour or suggest a route, you MUST respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing the route data in this exact format:
{
  "name": "Tour Name",
  "waypoints": [
    {"lat": 46.XXXX, "lon": 7.XXXX, "label": "Start Point", "elevation": 1500}
  ],
  "dangerZones": [
    {
      "lat": 46.XXXX, "lon": 7.XXXX,
      "level": 3,
      "aspect": "N/NW",
      "altitude": "above 2400m",
      "slopeAngle": "35-40°",
      "description": "Description of the danger"
    }
  ],
  "totalElevation": 1200,
  "distance": 10,
  "estimatedTime": "4-5h",
  "difficulty": "WS (wenig schwierig)",
  "keyInfo": "Important notes about the tour"
}

Always include realistic Swiss coordinates with at least 4 waypoints for a proper route. After the JSON block, provide additional context, safety tips, and recommendations in natural language. Feel free to mix German and English.

If the user asks a general question (not requesting a specific route), respond normally without JSON.

Important safety rules:
- Always factor in the current avalanche bulletin when suggesting routes
- Never suggest routes through terrain > 35° on danger level 3+ without explicit warnings
- Always mention required equipment (LVS/beacon, shovel, probe, and extras like harness/rope for glacier tours)
- Include emergency numbers: REGA 1414, SLF info +41 81 417 01 11`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, avalancheSummary, weatherSummary, tourLog } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    let contextParts: string[] = [];
    if (avalancheSummary) {
      contextParts.push(`CURRENT AVALANCHE BULLETIN:\n${avalancheSummary}`);
    }
    if (weatherSummary) {
      contextParts.push(`CURRENT WEATHER FORECAST:\n${weatherSummary}`);
    }
    if (tourLog && tourLog.length > 0) {
      const logSummary = tourLog.map((t: any) => {
        let entry = `- ${t.name} (${t.date}, ${t.difficulty || '?'}, ${t.elevation || '?'}m, rated ${t.rating}/5)`;
        if (t.participants) entry += ` — with: ${t.participants}`;
        if (t.conditions) entry += ` — conditions: ${t.conditions}`;
        if (t.notes) entry += ` — notes: ${t.notes}`;
        return entry;
      }).join('\n');
      contextParts.push(`GROUP'S TOUR LOG (use this to understand their experience, preferences, and typical tours):\n${logSummary}`);
    }

    const systemPrompt = contextParts.length > 0
      ? `${SYSTEM_PROMPT}\n\n--- CURRENT CONDITIONS ---\n${contextParts.join('\n\n')}`
      : SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
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
