// ── Core Route Types ──

export interface Waypoint {
  lat: number;
  lon: number;
  label: string;
  elevation?: number;
}

export interface DangerZone {
  lat: number;
  lon: number;
  level: 1 | 2 | 3 | 4 | 5;
  aspect: string;
  altitude: string;
  slopeAngle?: string;
  description: string;
}

export interface RouteData {
  name: string;
  waypoints: Waypoint[];
  dangerZones: DangerZone[];
  totalElevation: number;
  distance: number;
  estimatedTime: string;
  difficulty: string;
  keyInfo: string;
}

// ── Chat Types ──

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  route?: RouteData;
  timestamp: number;
}

// ── Tour Log Types ──

export interface TourLogEntry {
  id: string;
  name: string;
  date: string;
  participants: string[];
  route: RouteData;
  conditions: string;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
}

// ── Weather Types ──

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  snowfall: number;
  windSpeedMax: number;
  weatherCode: number;
  freezingLevel?: number;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  days: WeatherDay[];
}

// ── Avalanche Types (re-exported from parser) ──

export type {
  AvalancheDangerRating,
  AvalancheProblem,
  RegionBulletin,
  ParsedBulletin,
  RouteSegmentDanger,
} from '@/lib/avalanche-parser';

// ── Geocoding Types ──

export interface GeoResult {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

// ── Map State ──

export interface MapState {
  center: [number, number];
  zoom: number;
  activeRoute: RouteData | null;
}

// ── Weather code descriptions ──

export const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud' },
  48: { label: 'Rime fog', icon: 'cloud' },
  51: { label: 'Light drizzle', icon: 'cloud-rain' },
  53: { label: 'Moderate drizzle', icon: 'cloud-rain' },
  55: { label: 'Dense drizzle', icon: 'cloud-rain' },
  61: { label: 'Slight rain', icon: 'cloud-rain' },
  63: { label: 'Moderate rain', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', icon: 'cloud-rain' },
  71: { label: 'Slight snow', icon: 'snowflake' },
  73: { label: 'Moderate snow', icon: 'snowflake' },
  75: { label: 'Heavy snow', icon: 'snowflake' },
  77: { label: 'Snow grains', icon: 'snowflake' },
  80: { label: 'Slight showers', icon: 'cloud-rain' },
  81: { label: 'Moderate showers', icon: 'cloud-rain' },
  82: { label: 'Violent showers', icon: 'cloud-rain' },
  85: { label: 'Slight snow showers', icon: 'snowflake' },
  86: { label: 'Heavy snow showers', icon: 'snowflake' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm + hail', icon: 'cloud-lightning' },
  99: { label: 'Thunderstorm + heavy hail', icon: 'cloud-lightning' },
};

// ── Danger level colors ──

export const DANGER_COLORS: Record<number, string> = {
  1: '#4ade80',
  2: '#facc15',
  3: '#fb923c',
  4: '#ef4444',
  5: '#991b1b',
};

export const RISK_COLORS: Record<string, string> = {
  low: '#4ade80',
  moderate: '#facc15',
  high: '#fb923c',
  very_high: '#ef4444',
};
