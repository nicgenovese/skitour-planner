'use client';

import { Polyline, CircleMarker, Popup, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { RouteData } from '@/types';
import { DANGER_COLORS } from '@/types';

interface Props {
  route: RouteData;
}

function createNumberedIcon(index: number, isStart: boolean, isEnd: boolean) {
  const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#3b82f6';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    ">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function RouteOverlay({ route }: Props) {
  const positions = route.waypoints.map(
    w => [w.lat, w.lon] as [number, number]
  );

  return (
    <>
      {/* Route line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#3b82f6',
          weight: 4,
          opacity: 0.9,
          dashArray: undefined,
        }}
      />

      {/* Waypoint markers */}
      {route.waypoints.map((wp, i) => (
        <Marker
          key={`wp-${i}`}
          position={[wp.lat, wp.lon]}
          icon={createNumberedIcon(i, i === 0, i === route.waypoints.length - 1)}
        >
          <Tooltip
            direction="top"
            offset={[0, -14]}
            className="route-tooltip"
            permanent={false}
          >
            <strong>{wp.label}</strong>
            {wp.elevation && <span> ({wp.elevation}m)</span>}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{wp.label}</p>
              {wp.elevation && <p>Elevation: {wp.elevation}m</p>}
              <p className="text-xs text-gray-500">
                {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Danger zones */}
      {route.dangerZones.map((dz, i) => (
        <CircleMarker
          key={`dz-${i}`}
          center={[dz.lat, dz.lon]}
          radius={20}
          pathOptions={{
            color: DANGER_COLORS[dz.level] || '#fb923c',
            fillColor: DANGER_COLORS[dz.level] || '#fb923c',
            fillOpacity: 0.25,
            weight: 2,
            dashArray: '5,5',
          }}
          className="risk-pulse"
        >
          <Popup>
            <div className="text-sm max-w-[220px]">
              <p className="font-bold" style={{ color: DANGER_COLORS[dz.level] }}>
                Danger Level {dz.level}
              </p>
              <p><strong>Aspect:</strong> {dz.aspect}</p>
              <p><strong>Altitude:</strong> {dz.altitude}</p>
              {dz.slopeAngle && <p><strong>Slope:</strong> {dz.slopeAngle}</p>}
              <p className="mt-1 text-xs">{dz.description}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
