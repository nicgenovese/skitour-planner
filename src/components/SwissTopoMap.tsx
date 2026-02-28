'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { SWISSTOPO_LAYERS, getTileUrl, SWISSTOPO_TILE_OPTIONS, SWISS_BOUNDS, isVirtualLayer } from '@/lib/swisstopo-layers';
import type { RouteData, TourLogEntry } from '@/types';
import MapLayerControl from './MapLayerControl';
import RouteOverlay from './RouteOverlay';
import PlaceSearch from './PlaceSearch';
import AvalancheZoneOverlay from './AvalancheZoneOverlay';
import PastTourOverlay from './PastTourOverlay';

// Fix default marker icons for Leaflet in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  route: RouteData | null;
  onMapClick?: (lat: number, lon: number) => void;
  tourLog?: TourLogEntry[];
  onViewTour?: (entry: TourLogEntry) => void;
  mapDate?: string | null; // date for avalanche overlay (null = today)
  selectedTourId?: string | null; // hide this tour from PastTourOverlay to avoid duplicate markers
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function FitRouteBounds({ route }: { route: RouteData | null }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.waypoints.length > 0) {
      const bounds = L.latLngBounds(
        route.waypoints.map(w => [w.lat, w.lon] as [number, number])
      );
      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    }
  }, [map, route]);
  return null;
}

export default function SwissTopoMap({ route, onMapClick, tourLog, onViewTour, mapDate, selectedTourId }: Props) {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.entries(SWISSTOPO_LAYERS).forEach(([key, layer]) => {
      initial[key] = layer.defaultOn;
    });
    return initial;
  });
  const [activeBase, setActiveBase] = useState('topoWinter');
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.8, 8.2]);
  const [mapZoom, setMapZoom] = useState(8);

  const handleToggleLayer = (key: string) => {
    const layer = SWISSTOPO_LAYERS[key];
    if (layer.isBase) {
      setActiveBase(key);
    } else {
      setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handlePlaceSelect = (lat: number, lon: number) => {
    setMapCenter([lat, lon]);
    setMapZoom(13);
  };

  // Get overlays that are active (non-base, non-virtual layers for tile rendering)
  const overlays = Object.entries(SWISSTOPO_LAYERS)
    .filter(([key, layer]) => !layer.isBase && activeLayers[key] && !isVirtualLayer(key));

  const baseLayer = SWISSTOPO_LAYERS[activeBase];

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        zoomControl={false}
        className="w-full h-full z-0"
        maxBounds={[
          SWISS_BOUNDS.southWest as [number, number],
          SWISS_BOUNDS.northEast as [number, number],
        ]}
        minZoom={7}
        maxZoom={18}
      >
        <MapController center={mapCenter} zoom={mapZoom} />
        <ZoomControl position="bottomright" />
        <FitRouteBounds route={route} />

        {/* Base layer */}
        <TileLayer
          key={activeBase}
          url={getTileUrl(baseLayer.id, baseLayer.format)}
          {...SWISSTOPO_TILE_OPTIONS}
        />

        {/* Overlay layers */}
        {overlays.map(([key, layer]) => (
          <TileLayer
            key={key}
            url={getTileUrl(layer.id, layer.format)}
            {...SWISSTOPO_TILE_OPTIONS}
            opacity={layer.opacity || 1}
          />
        ))}

        {/* Avalanche zone overlay */}
        {activeLayers['avalancheZones'] && <AvalancheZoneOverlay date={mapDate || undefined} />}

        {/* Past tour routes overlay — hide the currently selected tour to avoid duplicate markers */}
        {activeLayers['pastTours'] && tourLog && (
          <PastTourOverlay
            tours={selectedTourId ? tourLog.filter(t => t.id !== selectedTourId) : tourLog}
            onSelectTour={onViewTour}
          />
        )}

        {/* Route overlay */}
        {route && <RouteOverlay route={route} />}
      </MapContainer>

      {/* Search bar */}
      <div className="absolute top-14 left-3 z-[1000] w-60 md:top-3 md:w-72">
        <PlaceSearch onSelect={handlePlaceSelect} />
      </div>

      {/* Layer control */}
      <div className="absolute top-3 right-3 z-[1000]">
        <MapLayerControl
          activeLayers={activeLayers}
          activeBase={activeBase}
          onToggle={handleToggleLayer}
        />
      </div>
    </div>
  );
}
