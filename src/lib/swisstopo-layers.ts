/**
 * Swisstopo WMTS Layer Configuration
 * 
 * All layers are free to use (since March 2021).
 * Tiles served in EPSG:3857 (Web Mercator) for Leaflet compatibility.
 * Attribution required: © swisstopo
 * 
 * Full layer list: https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml
 */

export interface SwisstopoLayer {
  id: string;
  format: 'jpeg' | 'png';
  label: string;
  description: string;
  defaultOn: boolean;
  opacity?: number;
  isBase?: boolean;
  category: 'base' | 'terrain' | 'routes' | 'nature' | 'snow';
}

export const SWISSTOPO_LAYERS: Record<string, SwisstopoLayer> = {
  // ── Base Maps ──
  topo: {
    id: 'ch.swisstopo.pixelkarte-farbe',
    format: 'jpeg',
    label: 'Topographic Map',
    description: 'National map with terrain, forests, place names, contours',
    defaultOn: true,
    isBase: true,
    category: 'base',
  },
  topoWinter: {
    id: 'ch.swisstopo.pixelkarte-farbe-winter',
    format: 'jpeg',
    label: 'Winter Topo Map',
    description: 'Winter edition with ski-relevant info highlighted',
    defaultOn: false,
    isBase: true,
    category: 'base',
  },
  aerial: {
    id: 'ch.swisstopo.swissimage',
    format: 'jpeg',
    label: 'Aerial Imagery',
    description: 'High-resolution satellite/aerial photography',
    defaultOn: false,
    isBase: true,
    category: 'base',
  },

  // ── Terrain / Steepness ──
  slopeOver30: {
    id: 'ch.swisstopo.hangneigung-ueber_30',
    format: 'png',
    label: 'Slopes > 30°',
    description: 'Terrain steeper than 30° — critical avalanche threshold',
    defaultOn: true,
    opacity: 0.45,
    category: 'terrain',
  },

  // ── Ski Touring Routes ──
  skiRoutes: {
    id: 'ch.swisstopo-karto.skitouren',
    format: 'png',
    label: 'Ski Touring Routes',
    description: 'Official SAC/swisstopo ski touring routes',
    defaultOn: true,
    category: 'routes',
  },
  snowshoeRoutes: {
    id: 'ch.swisstopo-karto.schneeschuhrouten',
    format: 'png',
    label: 'Snowshoe Routes',
    description: 'Official snowshoe routes',
    defaultOn: false,
    category: 'routes',
  },

  // ── Nature / Wildlife ──
  wildlifeZones: {
    id: 'ch.bafu.wrz-wildruhezonen_portal',
    format: 'png',
    label: 'Wildlife Rest Zones',
    description: 'Protected wildlife areas — respect seasonal closures!',
    defaultOn: true,
    opacity: 0.55,
    category: 'nature',
  },

  // ── Snow ──
  // Note: SLF snow depth maps are not WMTS tiles — they come from
  // the SLF API as separate products. We handle them differently.
};

/**
 * Generate tile URL for a swisstopo layer in EPSG:3857
 */
export function getTileUrl(layerId: string, format: string): string {
  return `https://wmts.geo.admin.ch/1.0.0/${layerId}/default/current/3857/{z}/{x}/{y}.${format}`;
}

/**
 * Common Leaflet options for swisstopo layers
 */
export const SWISSTOPO_TILE_OPTIONS = {
  attribution: '© <a href="https://www.swisstopo.ch" target="_blank">swisstopo</a>',
  maxZoom: 18,
  minZoom: 7,
  tileSize: 256,
};

/**
 * SLF Snow Products (fetched separately, not WMTS)
 * These are image overlays or parsed data, not standard tile layers
 */
export const SLF_PRODUCTS = {
  snowDepth: {
    label: 'Snow Depth',
    description: 'Current estimated snow depth across Switzerland',
    // Fetched from SLF API as a raster overlay
    apiUrl: 'https://aws.slf.ch/api/bulletin/document/',
  },
  newSnow: {
    label: 'New Snow (24h/72h)',
    description: 'Fresh snowfall in last 24 or 72 hours',
  },
  dangerMap: {
    label: 'Avalanche Danger Map',
    description: 'Current SLF danger level map',
    // Icon map from SLF
    iconMapUrl: 'https://aws.slf.ch/api/bulletin/document/iconmap/en',
  },
};

/**
 * Swiss geographic bounds (for restricting map view)
 */
export const SWISS_BOUNDS = {
  southWest: [45.82, 5.95],
  northEast: [47.81, 10.49],
};
