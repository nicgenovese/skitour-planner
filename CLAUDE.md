# Skitour Planer — Swiss Ski Mountaineering Planning App

## Project Overview

A web app for planning weekend ski mountaineering tours in Switzerland. Uses swisstopo official map layers, SLF avalanche bulletins, Open-Meteo weather, and Claude Sonnet AI for route planning and safety analysis.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Map**: Leaflet + react-leaflet (with swisstopo WMTS tiles)
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude Sonnet API (server-side route handler)
- **Storage**: localStorage for tour log (or SQLite via better-sqlite3 for persistence)
- **Export**: jsPDF + gpxparser for tour downloads

## Architecture

```
src/
├── app/
│   ├── page.tsx                 # Main layout: map + phone AI panel
│   ├── layout.tsx               # Root layout with fonts
│   ├── api/
│   │   ├── claude/route.ts      # POST — Claude Sonnet for route planning
│   │   ├── weather/route.ts     # GET — proxy Open-Meteo (avoid CORS)
│   │   ├── avalanche/route.ts   # GET — proxy SLF CAAML bulletin
│   │   └── geocode/route.ts     # GET — proxy GeoAdmin search
│   └── globals.css
├── components/
│   ├── SwissTopoMap.tsx         # Leaflet map with all layers
│   ├── MapLayerControl.tsx      # Toggle layers on/off
│   ├── RouteOverlay.tsx         # Draw route + danger zones on map
│   ├── SlopeAngleOverlay.tsx    # Steepness visualization
│   ├── PhoneAIChat.tsx          # Phone-shaped Claude chat
│   ├── TourLog.tsx              # Tour log CRUD
│   ├── WeatherPanel.tsx         # 5-day forecast
│   ├── AvalancheBulletin.tsx    # Parsed SLF bulletin display
│   ├── TourExport.tsx           # PDF + GPX download
│   └── PlaceSearch.tsx          # GeoAdmin place autocomplete
├── lib/
│   ├── swisstopo-layers.ts      # WMTS layer configs
│   ├── avalanche-parser.ts      # Parse CAAML XML into structured data
│   ├── route-analyzer.ts        # Analyze route vs avalanche bulletin
│   ├── gpx-generator.ts         # Generate GPX from waypoints
│   └── pdf-generator.ts         # Generate tour plan PDF
└── types/
    └── index.ts                 # TypeScript types
```

## Swisstopo WMTS Layers (all free, no API key needed)

Base URL: `https://wmts.geo.admin.ch/1.0.0/{layer}/default/current/3857/{z}/{x}/{y}.{format}`

### Required Layers:

```typescript
const SWISSTOPO_LAYERS = {
  // Base maps
  topo: {
    id: 'ch.swisstopo.pixelkarte-farbe',
    format: 'jpeg',
    label: 'Topographic Map',
    description: 'Official Swiss national map with terrain, names, forests, etc.',
    defaultOn: true,
  },
  aerial: {
    id: 'ch.swisstopo.swissimage',
    format: 'jpeg', 
    label: 'Aerial Imagery',
    description: 'Satellite/aerial photos',
    defaultOn: false,
  },
  
  // Overlays
  slopeOver30: {
    id: 'ch.swisstopo.hangneigung-ueber_30',
    format: 'png',
    label: 'Slopes > 30°',
    description: 'Terrain steeper than 30° — critical for avalanche assessment',
    defaultOn: true,
    opacity: 0.5,
  },
  skiRoutes: {
    id: 'ch.swisstopo-karto.skitouren',
    format: 'png',
    label: 'Ski Touring Routes',
    description: 'Official SAC/swisstopo ski touring routes',
    defaultOn: true,
  },
  wildlifeZones: {
    id: 'ch.bafu.wrz-wildruhezonen_portal',
    format: 'png',
    label: 'Wildlife Rest Zones',
    description: 'Protected wildlife areas — respect closures!',
    defaultOn: true,
    opacity: 0.6,
  },
  snowshoeRoutes: {
    id: 'ch.swisstopo-karto.schneeschuhrouten',
    format: 'png',
    label: 'Snowshoe Routes',
    description: 'Official snowshoe routes',
    defaultOn: false,
  },
};
```

### Tile URL pattern for Leaflet:

```typescript
// For Leaflet TileLayer:
const tileUrl = (layerId: string, format: string) =>
  `https://wmts.geo.admin.ch/1.0.0/${layerId}/default/current/3857/{z}/{x}/{y}.${format}`;

// Example:
L.tileLayer(tileUrl('ch.swisstopo.pixelkarte-farbe', 'jpeg'), {
  attribution: '© <a href="https://www.swisstopo.ch">swisstopo</a>',
  maxZoom: 18,
  minZoom: 7,
})
```

## GeoAdmin Search API (geocoding Swiss places)

```
GET https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText={query}&type=locations&limit=8
```

Response includes `attrs.lat`, `attrs.lon`, `attrs.label`, `attrs.detail`.

## SLF Avalanche Bulletin API

```
GET https://aws.slf.ch/api/bulletin/caaml
```

Returns CAAML XML. Parse it to extract:
- Danger level per region (1-5)
- Avalanche problems (persistent weak layers, wind slabs, wet snow, gliding snow, new snow)
- Critical aspects (N, NE, E, SE, S, SW, W, NW)
- Critical altitude bands (e.g., "above 2400m")
- Trend (increasing, steady, decreasing)

### Parsing approach:
The CAAML XML contains `<BulletinMeasurements>` with `<DangerRating>` elements per region.
Each has `<mainValue>` (danger level), `<validAspect>`, `<validElevation>`.

## Open-Meteo Weather API (free, no key)

```
GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code&hourly=freezing_level_height&timezone=Europe/Zurich&forecast_days=7
```

## Claude Sonnet Route Planning

Server-side API route (`/api/claude`) calls Anthropic API with:

### System prompt includes:
- User's tour log for personalized suggestions
- Current avalanche bulletin summary (parsed from SLF)
- Current weather forecast summary
- Instructions to output route JSON with waypoints + danger zones

### Route JSON format Claude should return:

```json
{
  "name": "Wildhorn via Iffigenalp",
  "waypoints": [
    {"lat": 46.3889, "lon": 7.4167, "label": "Iffigenalp", "elevation": 1584},
    {"lat": 46.3750, "lon": 7.4000, "label": "Iffigsee", "elevation": 2065},
    {"lat": 46.3556, "lon": 7.3778, "label": "Chilchli Glacier", "elevation": 2800},
    {"lat": 46.3500, "lon": 7.3667, "label": "Wildhorn Summit", "elevation": 3248}
  ],
  "dangerZones": [
    {
      "lat": 46.3600, "lon": 7.3850,
      "level": 3,
      "aspect": "N/NW",
      "altitude": "above 2400m",
      "slopeAngle": "35-40°",
      "description": "Persistent weak layer, avoid steep north-facing slopes above treeline"
    }
  ],
  "totalElevation": 1664,
  "distance": 12,
  "estimatedTime": "5-6h",
  "difficulty": "WS+ (wenig schwierig plus)",
  "keyInfo": "Classic Bernese Oberland tour. Glacier crossing required — bring rope, harness, crampons."
}
```

## Route + Avalanche Analysis Logic

When a route is generated:

1. **For each route segment**, determine:
   - Aspect (N/S/E/W) from bearing between waypoints
   - Altitude range
   - Whether it crosses terrain > 30° (from slope layer)

2. **Cross-reference with SLF bulletin**:
   - Get the danger level for the region the route is in
   - Check if the route's aspects match the bulletin's critical aspects
   - Check if the route's altitude matches the bulletin's critical elevation bands
   - Flag segments where ALL THREE match (aspect + altitude + danger level ≥ 3)

3. **Display on map**:
   - Route line colored by risk: green (low), yellow (moderate), red (high)
   - Danger zone circles at critical points
   - Popup on click with detailed info

## "We Go" Button + Export

When user clicks "We go on this tour!":

### Generate PDF containing:
- Tour name, date, participants (user input)
- Route map screenshot (use leaflet-image or html2canvas)
- Elevation profile
- Waypoint list with coordinates
- Current avalanche bulletin summary for the region
- Danger zones along route
- Weather forecast for the day
- Equipment checklist
- Emergency contacts (REGA: 1414, SLF: +41 81 417 01 11)

### Generate GPX file:
- Standard GPX with all waypoints
- Can be loaded into any GPS device or phone app (e.g., SwissTrails, Swisstopo app)

## Phone-Style AI Chat

Right side of the screen. Styled like a phone (rounded corners, notch, etc.)

Features:
- Chat with Claude about tour planning
- Auto-populates with tour log context
- When Claude generates a route, it appears on the map automatically
- Quick action buttons for common queries
- Shows route cards inline in chat

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
```

That's the only required env var. All other APIs (swisstopo, GeoAdmin, Open-Meteo, SLF) are free and keyless.

## Getting Started

```bash
npm install
npm run dev
```

## Key npm packages

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "leaflet": "^1.9",
    "react-leaflet": "^4",
    "@anthropic-ai/sdk": "latest",
    "jspdf": "^2",
    "html2canvas": "^1",
    "fast-xml-parser": "^4",
    "tailwindcss": "^3"
  }
}
```
