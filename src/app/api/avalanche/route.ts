import { NextRequest, NextResponse } from 'next/server';

// Removed force-dynamic to allow CDN caching

/**
 * GET /api/avalanche?format=json|geojson
 * Proxies current SLF avalanche bulletin.
 * format=json (default): parsed bulletin data
 * format=geojson: polygon danger zones for map overlay
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    let url: string;
    if (format === 'geojson') {
      url = 'https://aws.slf.ch/api/bulletin/caaml/en/geojson';
    } else {
      url = 'https://aws.slf.ch/api/bulletin/caaml/en/json';
    }

    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        'Accept': format === 'geojson' ? 'application/geo+json' : 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`SLF returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error: any) {
    console.error('Avalanche API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avalanche bulletin', details: error.message },
      { status: 502 }
    );
  }
}
