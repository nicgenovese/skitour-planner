'use client';

import { CircleMarker, Popup, Tooltip, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { RouteData } from '@/types';
import { DANGER_COLORS } from '@/types';

interface Props {
  route: RouteData;
}

function createIcon(type: 'start' | 'finish') {
  const color = type === 'start' ? '#22c55e' : '#ef4444';
  const label = type === 'start' ? 'S' : 'F';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      border: 2.5px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function RouteOverlay({ route }: Props) {
  const start = route.waypoints[0];
  const finish = route.waypoints[route.waypoints.length - 1];
  const routeLine: [number, number][] = route.waypoints.map(wp => [wp.lat, wp.lon]);

  return (
    <>
      {/* Route line */}
      {routeLine.length >= 2 && (
        <Polyline
          positions={routeLine}
          pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8,6' }}
        />
      )}

      {/* Start marker */}
      {start && (
        <Marker position={[start.lat, start.lon]} icon={createIcon('start')}>
          <Tooltip direction="top" offset={[0, -16]} className="route-tooltip">
            <strong>{start.label || 'Start'}</strong>
            {start.elevation ? <span> ({start.elevation}m)</span> : null}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{start.label || 'Start'}</p>
              {start.elevation ? <p>Elevation: {start.elevation}m</p> : null}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Finish marker */}
      {finish && finish !== start && (
        <Marker position={[finish.lat, finish.lon]} icon={createIcon('finish')}>
          <Tooltip direction="top" offset={[0, -16]} className="route-tooltip">
            <strong>{finish.label || 'Summit'}</strong>
            {finish.elevation ? <span> ({finish.elevation}m)</span> : null}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{finish.label || 'Summit'}</p>
              {finish.elevation ? <p>Elevation: {finish.elevation}m</p> : null}
            </div>
          </Popup>
        </Marker>
      )}

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
