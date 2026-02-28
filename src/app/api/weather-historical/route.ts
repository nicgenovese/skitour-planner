import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/weather-historical?lat=46.6&lon=8.5&date=2025-01-02
 * Proxies Open-Meteo Archive API for historical weather data.
 * Returns weather for the tour date ±1 day (3 days total).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const date = searchParams.get('date');

    if (!lat || !lon || !date) {
      return NextResponse.json(
        { error: 'lat, lon, and date parameters required' },
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'date must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Get date range: tour date ±1 day
    const tourDate = new Date(date + 'T12:00:00Z');
    const startDate = new Date(tourDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(tourDate);
    endDate.setDate(endDate.getDate() + 1);

    // Don't fetch future dates
    const now = new Date();
    if (tourDate > now) {
      return NextResponse.json(
        { error: 'Cannot fetch historical weather for future dates' },
        { status: 400 }
      );
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code&timezone=Europe/Zurich`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Open-Meteo Archive returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Historical weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical weather', details: error.message },
      { status: 502 }
    );
  }
}
