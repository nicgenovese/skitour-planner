import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/voice-context?area=Andermatt
 *
 * Returns a compact plain-text summary of current conditions
 * for the Vapi.ai voice agent (AI Mountain Guide phone call).
 *
 * The voice agent calls this endpoint as a "tool" during conversation
 * to get real-time avalanche, weather, and snow data.
 *
 * Cached for 30 minutes via CDN.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get('area') || 'Central Switzerland';

  try {
    const baseUrl = request.nextUrl.origin;

    // Fetch conditions in parallel
    const [bulletinRes, weatherRes, snowRes] = await Promise.all([
      fetch(`${baseUrl}/api/avalanche?format=json`).catch(() => null),
      fetch(`${baseUrl}/api/weather?lat=46.8&lon=8.2`).catch(() => null),
      fetch(`${baseUrl}/api/snow-stations?lat=46.8&lon=8.2&radius=50`).catch(() => null),
    ]);

    const parts: string[] = [];
    parts.push(`Current conditions for ${area} as of ${new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}:`);
    parts.push('');

    // Avalanche bulletin
    if (bulletinRes?.ok) {
      try {
        const data = await bulletinRes.json();
        if (data.bulletins && data.bulletins.length > 0) {
          const b = data.bulletins[0];
          const maxLevel = extractMaxDangerLevel(b);
          parts.push(`AVALANCHE BULLETIN:`);
          parts.push(`- Danger level: ${maxLevel}/5`);
          if (b.avalancheProblems && b.avalancheProblems.length > 0) {
            const problems = b.avalancheProblems.map((p: any) => p.problemType || p.type).filter(Boolean);
            if (problems.length > 0) {
              parts.push(`- Problems: ${problems.join(', ')}`);
            }
          }
          parts.push('');
        }
      } catch { /* ignore parse errors */ }
    }

    // Weather
    if (weatherRes?.ok) {
      try {
        const data = await weatherRes.json();
        if (data.daily) {
          const d = data.daily;
          parts.push('WEATHER TODAY:');
          if (d.temperature_2m_max?.[0] != null) {
            parts.push(`- Temperature: ${d.temperature_2m_min[0]}°C to ${d.temperature_2m_max[0]}°C`);
          }
          if (d.snowfall_sum?.[0] != null && d.snowfall_sum[0] > 0) {
            parts.push(`- New snow expected: ${d.snowfall_sum[0]}cm`);
          }
          if (d.wind_speed_10m_max?.[0] != null) {
            parts.push(`- Wind: up to ${d.wind_speed_10m_max[0]}km/h`);
          }

          // Freezing level from hourly
          if (data.hourly?.freezing_level_height) {
            const levels = data.hourly.freezing_level_height.filter((v: any) => v != null);
            if (levels.length > 0) {
              const avgLevel = Math.round(levels.reduce((a: number, b: number) => a + b, 0) / levels.length);
              parts.push(`- Freezing level: around ${avgLevel}m`);
            }
          }
          parts.push('');
        }
      } catch { /* ignore */ }
    }

    // Snow stations
    if (snowRes?.ok) {
      try {
        const data = await snowRes.json();
        if (data.stations?.length > 0) {
          const withSnow = data.stations.filter((s: any) => s.latest?.snowDepth != null);
          if (withSnow.length > 0) {
            parts.push('SNOW DEPTH (nearest stations):');
            withSnow.slice(0, 3).forEach((s: any) => {
              parts.push(`- ${s.label} (${s.elevation}m): ${s.latest.snowDepth}cm snow depth`);
              if (s.latest.newSnow24h != null && s.latest.newSnow24h > 0) {
                parts.push(`  New snow last 24h: ${s.latest.newSnow24h}cm`);
              }
            });
            parts.push('');
          }
        }
      } catch { /* ignore */ }
    }

    parts.push('SAFETY REMINDERS:');
    parts.push('- Always check the SLF avalanche bulletin at slf.ch before going out');
    parts.push('- Always carry LVS/beacon, shovel, and probe');
    parts.push('- Emergency: REGA helicopter rescue 1414');
    parts.push('- SLF avalanche info: +41 81 417 01 11');

    const text = parts.join('\n');

    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error: any) {
    console.error('Voice context API error:', error);
    return new NextResponse(
      `Unable to fetch current conditions. Please check the SLF bulletin at slf.ch for the latest avalanche information. Emergency number: REGA 1414.`,
      {
        status: 200, // Still return 200 so voice agent has something to say
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  }
}

function extractMaxDangerLevel(bulletin: any): number {
  try {
    if (bulletin.dangerRatings) {
      return Math.max(...bulletin.dangerRatings.map((r: any) => r.mainValue || r.level || 0));
    }
    if (bulletin.maxDangerRating) {
      return bulletin.maxDangerRating.mainValue || bulletin.maxDangerRating.level || 0;
    }
  } catch { /* ignore */ }
  return 0;
}
