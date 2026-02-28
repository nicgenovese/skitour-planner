import { NextRequest, NextResponse } from 'next/server';
import { parseIncidentCSV, filterNearby, summarizeIncidents } from '@/lib/incident-utils';
import type { AvalancheIncident } from '@/types';

/**
 * GET /api/avalanche-incidents?lat=X&lon=X&radius=10
 *
 * Fetches the EnviDat CSV of Swiss avalanche accidents since 1970,
 * parses it, and returns incidents near the given coordinates.
 *
 * The CSV is cached in a module-level variable so it only gets
 * fetched once per warm serverless instance.
 *
 * Source: https://www.envidat.ch/dataset/avalanche-accidents-switzerland-since-1970
 */

const ENVIDAT_URL =
  'https://www.envidat.ch/dataset/avalanche-accidents-switzerland-since-1970/resource/e73bf9ab-4930-413c-a34a-0c78c541e356/download/avalanche_accidents_all_switzerland_since_1970.csv';

// Module-level cache: persists across warm serverless invocations
let cachedIncidents: AvalancheIncident[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getIncidents(): Promise<AvalancheIncident[]> {
  const now = Date.now();
  if (cachedIncidents && now - cacheTimestamp < CACHE_TTL) {
    return cachedIncidents;
  }

  const res = await fetch(ENVIDAT_URL, {
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`EnviDat returned ${res.status}`);
  }

  const csv = await res.text();
  cachedIncidents = parseIncidentCSV(csv);
  cacheTimestamp = now;
  return cachedIncidents;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lon = parseFloat(searchParams.get('lon') || '');
  const radius = parseFloat(searchParams.get('radius') || '10');

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    const allIncidents = await getIncidents();
    const nearby = filterNearby(allIncidents, lat, lon, radius);
    const summary = summarizeIncidents(nearby);

    return NextResponse.json({
      incidents: nearby,
      total: nearby.length,
      summary,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    });
  } catch (error: any) {
    console.error('Avalanche incidents API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incident data', details: error.message },
      { status: 502 }
    );
  }
}
