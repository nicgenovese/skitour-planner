'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TourLogEntry } from '@/types';
import { DANGER_COLORS } from '@/types';

interface Props {
  tours: TourLogEntry[];
  onSelectTour?: (tour: TourLogEntry) => void;
}

export default function PastTourOverlay({ tours, onSelectTour }: Props) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Remove existing layers
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }

    const group = L.layerGroup();

    tours.forEach(tour => {
      if (!tour.route.waypoints || tour.route.waypoints.length < 2) return;

      const startWp = tour.route.waypoints[0];
      const peakWp = tour.route.waypoints[tour.route.waypoints.length - 1];

      // Build popup content
      const stars = '\u2605'.repeat(tour.rating) + '\u2606'.repeat(5 - tour.rating);
      const dangerBadge = tour.historicalAvalanche
        ? `<span style="background:${DANGER_COLORS[tour.historicalAvalanche.maxDangerLevel]};color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:bold;">
            Danger ${tour.historicalAvalanche.maxDangerLevel}
          </span>`
        : '';

      const popupContent = `
        <div style="font-family:system-ui;font-size:12px;min-width:150px;">
          <strong>${tour.name}</strong><br/>
          <span style="color:#94a3b8;">${tour.date}</span><br/>
          <span style="color:#60a5fa;">${tour.route.difficulty}</span> · ↑${tour.route.totalElevation}m
          ${dangerBadge ? `<br/>${dangerBadge}` : ''}
          <br/><span style="color:#fbbf24;">${stars}</span>
          <br/><span style="color:#94a3b8;font-size:10px;">${startWp.label} → ${peakWp.label}</span>
        </div>
      `;

      // Start marker — green circle
      const startMarker = L.circleMarker([startWp.lat, startWp.lon], {
        radius: 6,
        fillColor: '#4ade80',
        fillOpacity: 0.8,
        color: '#166534',
        weight: 2,
      });

      // Peak marker — red/orange triangle (using DivIcon for triangle shape)
      const peakIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-bottom: 12px solid #ef4444;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        "></div>`,
        iconSize: [14, 12],
        iconAnchor: [7, 12],
      });
      const peakMarker = L.marker([peakWp.lat, peakWp.lon], { icon: peakIcon });

      startMarker.bindPopup(popupContent, { className: 'avalanche-popup' });
      peakMarker.bindPopup(popupContent, { className: 'avalanche-popup' });

      // Click handler to select tour
      if (onSelectTour) {
        startMarker.on('click', () => onSelectTour(tour));
        peakMarker.on('click', () => onSelectTour(tour));
      }

      group.addLayer(startMarker);
      group.addLayer(peakMarker);
    });

    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [map, tours, onSelectTour]);

  return null;
}
