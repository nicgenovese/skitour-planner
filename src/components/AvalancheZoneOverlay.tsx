'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// SLF GeoJSON danger level name → number mapping
const DANGER_LEVEL_MAP: Record<string, number> = {
  'no_snow': 0,
  'no_rating': 0,
  'low': 1,
  'moderate': 2,
  'considerable': 3,
  'high': 4,
  'very_high': 5,
};

const DANGER_LABEL: Record<number, string> = {
  0: 'No rating',
  1: '1 – Low',
  2: '2 – Moderate',
  3: '3 – Considerable',
  4: '4 – High',
  5: '5 – Very High',
};

/**
 * Extract danger level number from SLF GeoJSON feature properties.
 * SLF structure: { dangerRatings: [{ mainValue: "considerable", validTimePeriod: "all_day" }] }
 */
function getDangerLevel(props: any): number {
  const ratings = props.dangerRatings;
  if (Array.isArray(ratings) && ratings.length > 0) {
    // Use the highest rating if there are multiple (AM/PM)
    let max = 0;
    for (const r of ratings) {
      const level = DANGER_LEVEL_MAP[r.mainValue] ?? 0;
      if (level > max) max = level;
    }
    return max;
  }
  return 0;
}

/**
 * Extract region names from SLF GeoJSON feature properties.
 * SLF structure: { regions: [{ regionID: "CH-5212", name: "südliches Tujetsch" }, ...] }
 */
function getRegionNames(props: any): string {
  const regions = props.regions;
  if (Array.isArray(regions) && regions.length > 0) {
    const names = regions.map((r: any) => r.name).filter(Boolean);
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
  }
  return props.bulletinID || 'Region';
}

interface Props {
  date?: string; // optional: fetch historical data for specific date
}

export default function AvalancheZoneOverlay({ date }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchGeoJSON = async () => {
      try {
        const url = date
          ? `/api/avalanche-historical?date=${date}&format=geojson`
          : '/api/avalanche?format=geojson';

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled || !data.features) return;

        // Remove previous layer
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }

        const layer = L.geoJSON(data, {
          style: (feature) => {
            if (!feature?.properties) return {};
            // SLF provides a fill color directly — use it as the primary source
            const slfColor = feature.properties.fill;
            const level = getDangerLevel(feature.properties);

            // Fallback to our own colors if SLF doesn't provide one
            const color = slfColor || (level >= 1 ? ['', '#4CAF50', '#FFEB3B', '#FF9800', '#F44336', '#880E4F'][level] : '#94a3b8');

            return {
              fillColor: color,
              fillOpacity: 0.25,
              color: color,
              weight: 1.5,
              opacity: 0.6,
            };
          },
          onEachFeature: (feature, featureLayer) => {
            if (!feature.properties) return;
            const level = getDangerLevel(feature.properties);
            const regionName = getRegionNames(feature.properties);
            const dangerLabel = DANGER_LABEL[level] || 'Unknown';
            const slfColor = feature.properties.fill || '#94a3b8';

            featureLayer.bindPopup(
              `<div style="font-family: system-ui; font-size: 13px; max-width: 220px;">
                <strong style="color: ${slfColor};">${dangerLabel}</strong><br/>
                <span style="color: #e2e8f0; font-size: 11px;">${regionName}</span>
                ${date ? `<br/><span style="color: #94a3b8; font-size: 10px;">Date: ${date}</span>` : ''}
              </div>`,
              { className: 'avalanche-popup' }
            );
          },
        });

        if (!cancelled) {
          layer.addTo(map);
          layerRef.current = layer;
        }
      } catch (err) {
        console.error('Failed to load avalanche GeoJSON:', err);
      }
    };

    fetchGeoJSON();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, date]);

  return null;
}
