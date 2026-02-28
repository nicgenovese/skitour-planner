import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/snow-stations?lat=X&lon=X&radius=30
 *
 * Proxies the SLF IMIS measurement API to return snow depth stations
 * near the given coordinates. Joins station metadata with latest
 * measurements by station code.
 *
 * Source: https://measurement-api.slf.ch/
 * ~189 automatic IMIS stations, updated every 30 minutes.
 */

const SLF_BASE = 'https://measurement-api.slf.ch/public/api';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lon = parseFloat(searchParams.get('lon') || '');
  const radius = parseFloat(searchParams.get('radius') || '30');

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    // Fetch station list + latest snow measurements in parallel
    const [stationsRes, measurementsRes] = await Promise.all([
      fetch(`${SLF_BASE}/station?type=snow`, {
        next: { revalidate: 86400 }, // stations rarely change, cache 24h
        headers: { Accept: 'application/json' },
      }),
      fetch(`${SLF_BASE}/measurement/snow?station_code=all&latest=true`, {
        next: { revalidate: 1800 }, // 30-min refresh like SLF
        headers: { Accept: 'application/json' },
      }),
    ]);

    if (!stationsRes.ok) {
      throw new Error(`SLF stations API returned ${stationsRes.status}`);
    }

    const stations: any[] = await stationsRes.json();
    let measurements: any[] = [];
    if (measurementsRes.ok) {
      measurements = await measurementsRes.json();
    }

    // Build measurement lookup by station code
    const measureMap = new Map<string, any>();
    for (const m of measurements) {
      const code = m.station_code || m.stationCode || m.code;
      if (code) measureMap.set(code, m);
    }

    // Filter stations by radius and join with measurements
    const result = stations
      .filter(s => {
        const sLat = s.latitude || s.lat;
        const sLon = s.longitude || s.lon;
        if (!sLat || !sLon) return false;
        return haversineKm(lat, lon, sLat, sLon) <= radius;
      })
      .map(s => {
        const code = s.station_code || s.code;
        const m = measureMap.get(code);
        return {
          code,
          label: s.name || s.label || code,
          lat: s.latitude || s.lat,
          lon: s.longitude || s.lon,
          elevation: s.elevation || s.altitude || 0,
          canton: s.canton || '',
          latest: m
            ? {
                stationCode: code,
                measureDate: m.measure_date || m.measureDate || '',
                snowDepth: m.snow_depth ?? m.snowDepth ?? m.HS ?? null,
                newSnow24h: m.new_snow_24h ?? m.newSnow24h ?? m.HN24 ?? null,
                temperature: m.air_temperature ?? m.temperature ?? m.TA ?? null,
                windSpeed: m.wind_speed ?? m.windSpeed ?? m.VW ?? null,
              }
            : null,
        };
      })
      .sort((a, b) => {
        // Sort by distance
        const dA = haversineKm(lat, lon, a.lat, a.lon);
        const dB = haversineKm(lat, lon, b.lat, b.lon);
        return dA - dB;
      });

    return NextResponse.json({ stations: result }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error: any) {
    console.error('Snow stations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snow station data', details: error.message },
      { status: 502 }
    );
  }
}
