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
  risk?: RiskLevel;
  safetyNote?: string;
  plannedDate?: string;
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
  historicalWeather?: HistoricalWeather;
  historicalAvalanche?: HistoricalAvalanche;
}

// ── Historical Data Types ──

export interface HistoricalWeather {
  tourDate: string;
  days: WeatherDay[];
  fetchedAt: number;
}

export interface HistoricalAvalanche {
  tourDate: string;
  maxDangerLevel: number;
  regionName?: string;
  problems?: string[];
  fetchedAt: number;
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

// ── Snow Depth Station Types (SLF IMIS) ──

export interface SnowStation {
  code: string;
  label: string;
  lat: number;
  lon: number;
  elevation: number;
  canton: string;
}

export interface SnowMeasurement {
  stationCode: string;
  measureDate: string;
  snowDepth: number | null;
  newSnow24h: number | null;
  temperature: number | null;
  windSpeed: number | null;
}

export interface SnowStationWithMeasurement extends SnowStation {
  latest: SnowMeasurement | null;
}

// ── Avalanche Incident Types (EnviDat) ──

export interface AvalancheIncident {
  id: string;
  date: string;
  lat: number;
  lon: number;
  elevation: number;
  aspect: string;
  inclination: number;
  dangerLevel: number;
  caught: number;
  buried: number;
  fatalities: number;
  activity: string;
}

// ── Tour Report Types (Scraped) ──

export interface TourReport {
  title: string;
  date: string;
  author: string;
  conditionsSummary: string;
  url: string;
  source: 'gipfelbuch' | 'hikr' | 'sac';
}

// ── Aggregated Conditions ──

export interface CurrentConditions {
  dangerLevel: number | null;
  dangerProblems: string[];
  tempMin: number | null;
  tempMax: number | null;
  snowfall: number | null;
  freezingLevel: number | null;
  windSpeedMax: number | null;
  nearestSnowDepth: number | null;
  nearestStationName: string | null;
}

// ── Planned Tour Types ──

export interface PlannedTour {
  id: string;
  name: string;
  plannedDate: string;
  route: RouteData;
  equipment: string[];
  participants: string[];
  notes: string;
  createdAt: number;
  currentDangerLevel?: number;
  dangerTrend?: 'better' | 'same' | 'worse';
  originalDangerLevel?: number;
}

// ── Risk Score ──

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  LOW: '#30D158',
  MODERATE: '#FFD60A',
  HIGH: '#FF9F0A',
  CRITICAL: '#FF453A',
};

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
  1: '#30D158',
  2: '#FFD60A',
  3: '#FF9F0A',
  4: '#FF453A',
  5: '#BF0000',
};

export const RISK_COLORS: Record<string, string> = {
  low: '#30D158',
  moderate: '#FFD60A',
  high: '#FF9F0A',
  very_high: '#FF453A',
};

// ── iOS System Colors ──

export const IOS_COLORS = {
  blue: '#007AFF',
  green: '#30D158',
  red: '#FF453A',
  yellow: '#FFD60A',
  orange: '#FF9F0A',
  gray: '#8E8E93',
  separator: 'rgba(255,255,255,0.04)',
} as const;

// ── Equipment parsing ──

export const DEFAULT_EQUIPMENT = ['LVS/Beacon', 'Shovel', 'Probe'];

export function parseEquipmentFromKeyInfo(keyInfo: string): string[] {
  const items = new Set(DEFAULT_EQUIPMENT);
  const lower = keyInfo.toLowerCase();
  if (lower.includes('rope') || lower.includes('seil')) items.add('Rope');
  if (lower.includes('harness') || lower.includes('gurt')) items.add('Harness');
  if (lower.includes('crampon') || lower.includes('steigeisen')) items.add('Crampons');
  if (lower.includes('ice axe') || lower.includes('pickel')) items.add('Ice Axe');
  if (lower.includes('glacier') || lower.includes('gletscher')) {
    items.add('Rope');
    items.add('Harness');
    items.add('Crampons');
  }
  if (lower.includes('helmet') || lower.includes('helm')) items.add('Helmet');
  return Array.from(items);
}
