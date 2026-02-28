import { NextRequest, NextResponse } from 'next/server';
import type { TourReport } from '@/types';

/**
 * GET /api/tour-reports?query=Rossstock&days=30
 *
 * Scrapes recent tour reports from Gipfelbuch.ch.
 * Returns structured report data for AI context.
 *
 * Fallback: returns empty array if scraping fails (non-critical).
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const days = parseInt(searchParams.get('days') || '30', 10);

  if (!query) {
    return NextResponse.json({ error: 'query parameter required' }, { status: 400 });
  }

  try {
    const reports = await scrapeGipfelbuch(query, days);
    return NextResponse.json({ reports }, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' },
    });
  } catch (error: any) {
    console.error('Tour reports API error:', error);
    // Non-critical — return empty array rather than error
    return NextResponse.json({ reports: [] });
  }
}

async function scrapeGipfelbuch(query: string, days: number): Promise<TourReport[]> {
  // Gipfelbuch search URL
  const url = `https://www.gipfelbuch.ch/tourberichte/suche?suchbegriff=${encodeURIComponent(query)}&zeitraum=${days}`;

  const res = await fetch(url, {
    next: { revalidate: 21600 }, // 6 hours
    headers: {
      'User-Agent': 'SkitourPlaner/1.0 (educational project)',
      Accept: 'text/html',
    },
  });

  if (!res.ok) {
    console.warn(`Gipfelbuch returned ${res.status} for query "${query}"`);
    return [];
  }

  const html = await res.text();
  return parseGipfelbuchHTML(html);
}

function parseGipfelbuchHTML(html: string): TourReport[] {
  const reports: TourReport[] = [];

  // Match tour report entries — Gipfelbuch uses a list of tour cards
  // We look for common patterns in their HTML structure
  const entryRegex = /<div[^>]*class="[^"]*report[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const titleRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/i;
  const dateRegex = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/;
  const authorRegex = /(?:von|by|author)[:\s]*([^<,]+)/i;

  // Simpler fallback: extract all links that look like tour reports
  const linkRegex = /<a[^>]*href="(\/touren\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = `https://www.gipfelbuch.ch${match[1]}`;
    const title = match[2].trim();
    if (!title || title.length < 3) continue;

    // Try to find a date near this link
    const surroundingStart = Math.max(0, match.index - 200);
    const surroundingEnd = Math.min(html.length, match.index + match[0].length + 200);
    const surrounding = html.slice(surroundingStart, surroundingEnd);

    const dateMatch = surrounding.match(dateRegex);
    let date = '';
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      if (year.length === 2) year = `20${year}`;
      date = `${year}-${month}-${day}`;
    }

    const authorMatch = surrounding.match(authorRegex);
    const author = authorMatch ? authorMatch[1].trim() : '';

    // Extract condition snippets (text between tags near the link)
    const snippetRegex = /<p[^>]*>([^<]{10,200})<\/p>/i;
    const snippetMatch = surrounding.match(snippetRegex);
    const conditionsSummary = snippetMatch ? snippetMatch[1].trim() : '';

    reports.push({
      title,
      date,
      author,
      conditionsSummary,
      url,
      source: 'gipfelbuch',
    });

    if (reports.length >= 10) break;
  }

  // Fallback: if no /touren/ links found, try broader pattern
  if (reports.length === 0) {
    const broadRegex = /<a[^>]*href="([^"]*(?:tour|bericht|report)[^"]*)"[^>]*>([^<]{3,})<\/a>/gi;
    while ((match = broadRegex.exec(html)) !== null && reports.length < 10) {
      const href = match[1];
      const title = match[2].trim();
      const fullUrl = href.startsWith('http') ? href : `https://www.gipfelbuch.ch${href}`;

      reports.push({
        title,
        date: '',
        author: '',
        conditionsSummary: '',
        url: fullUrl,
        source: 'gipfelbuch',
      });
    }
  }

  return reports;
}
