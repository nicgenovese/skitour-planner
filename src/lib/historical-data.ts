/**
 * Historical data fetching utilities for enriching tour log entries
 * with weather and avalanche data from the day of the tour.
 */

import type { TourLogEntry, WeatherDay, HistoricalWeather, HistoricalAvalanche } from '@/types';
import { parseBulletinJSON } from '@/lib/avalanche-parser';

const CACHE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Fetch historical weather for a tour entry
 */
export async function fetchHistoricalWeather(
  entry: TourLogEntry
): Promise<HistoricalWeather | null> {
  try {
    // Use first waypoint coordinates
    const wp = entry.route.waypoints[0];
    if (!wp) return null;

    const res = await fetch(
      `/api/weather-historical?lat=${wp.lat}&lon=${wp.lon}&date=${entry.date}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.error || !data.daily?.time) return null;

    const days: WeatherDay[] = data.daily.time.map((date: string, i: number) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitation: data.daily.precipitation_sum[i],
      snowfall: data.daily.snowfall_sum[i],
      windSpeedMax: data.daily.wind_speed_10m_max[i],
      weatherCode: data.daily.weather_code[i],
    }));

    return {
      tourDate: entry.date,
      days,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('Failed to fetch historical weather:', err);
    return null;
  }
}

/**
 * Fetch historical avalanche bulletin for a tour entry
 */
export async function fetchHistoricalAvalanche(
  entry: TourLogEntry
): Promise<HistoricalAvalanche | null> {
  try {
    const res = await fetch(
      `/api/avalanche-historical?date=${entry.date}&format=json`
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.error) return null;

    const parsed = parseBulletinJSON(data);
    if (!parsed || parsed.regions.length === 0) return null;

    // Find the region closest to the tour's first waypoint
    // For simplicity, use max danger level across all regions
    let maxLevel = 1;
    let regionName = parsed.regions[0]?.regionName || 'Unknown';
    const allProblems: string[] = [];

    for (const region of parsed.regions) {
      for (const dr of region.dangerRatings) {
        if (dr.level > maxLevel) {
          maxLevel = dr.level;
          regionName = region.regionName;
        }
      }
      for (const p of region.problems) {
        const type = p.type.replace(/_/g, ' ');
        if (!allProblems.includes(type)) {
          allProblems.push(type);
        }
      }
    }

    return {
      tourDate: entry.date,
      maxDangerLevel: maxLevel,
      regionName,
      problems: allProblems,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('Failed to fetch historical avalanche:', err);
    return null;
  }
}

/**
 * Enrich a tour entry with historical data (weather + avalanche).
 * Uses cached data if available and not expired.
 */
export async function enrichTourWithHistoricalData(
  entry: TourLogEntry
): Promise<TourLogEntry> {
  const now = Date.now();
  const enriched = { ...entry };

  // Check if we need to fetch weather
  if (
    !entry.historicalWeather ||
    now - entry.historicalWeather.fetchedAt > CACHE_VALIDITY_MS
  ) {
    const weather = await fetchHistoricalWeather(entry);
    if (weather) {
      enriched.historicalWeather = weather;
    }
  }

  // Check if we need to fetch avalanche
  if (
    !entry.historicalAvalanche ||
    now - entry.historicalAvalanche.fetchedAt > CACHE_VALIDITY_MS
  ) {
    const avalanche = await fetchHistoricalAvalanche(entry);
    if (avalanche) {
      enriched.historicalAvalanche = avalanche;
    }
  }

  return enriched;
}
