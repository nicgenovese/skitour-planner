import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL('https://api3.geo.admin.ch/rest/services/ech/SearchServer');
    url.searchParams.set('searchText', query);
    url.searchParams.set('type', 'locations');
    url.searchParams.set('limit', '8');

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`GeoAdmin returned ${res.status}`);
    }

    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      label: stripHtml(r.attrs?.label || ''),
      detail: r.attrs?.detail || '',
      lat: r.attrs?.lat,
      lon: r.attrs?.lon,
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Geocode API error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode', details: error.message },
      { status: 502 }
    );
  }
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}
