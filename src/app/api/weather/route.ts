import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code');
    url.searchParams.set('hourly', 'freezing_level_height');
    url.searchParams.set('timezone', 'Europe/Zurich');
    url.searchParams.set('forecast_days', '7');

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error: any) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data', details: error.message },
      { status: 502 }
    );
  }
}
