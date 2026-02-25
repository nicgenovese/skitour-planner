import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://aws.slf.ch/api/bulletin/caaml/en/json', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`SLF returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Avalanche API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avalanche bulletin', details: error.message },
      { status: 502 }
    );
  }
}
