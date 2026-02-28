import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/avalanche-historical?date=2025-01-02&format=json|geojson
 * Proxies SLF historical bulletin with ?activeAt= parameter.
 * Supports both JSON (parsed bulletin) and GeoJSON (map polygons) formats.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const format = searchParams.get('format') || 'json';

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'date must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // SLF expects activeAt in ISO format with time
    const activeAt = `${date}T12:00:00Z`;

    let url: string;
    if (format === 'geojson') {
      url = `https://aws.slf.ch/api/bulletin/caaml/en/geojson?activeAt=${activeAt}`;
    } else {
      url = `https://aws.slf.ch/api/bulletin/caaml/en/json?activeAt=${activeAt}`;
    }

    const res = await fetch(url, {
      headers: {
        'Accept': format === 'geojson' ? 'application/geo+json' : 'application/json',
      },
    });

    if (!res.ok) {
      // SLF may return 404 for very old dates
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'No bulletin available for this date' },
          { status: 404 }
        );
      }
      throw new Error(`SLF returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Historical avalanche API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical avalanche data', details: error.message },
      { status: 502 }
    );
  }
}
