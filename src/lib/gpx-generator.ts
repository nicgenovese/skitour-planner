/**
 * GPX Generator for ski tour routes
 * Creates standard GPX files loadable in any GPS app
 * (Swisstopo app, Gaia GPS, Strava, Garmin, etc.)
 */

export interface GPXWaypoint {
  lat: number;
  lon: number;
  elevation?: number;
  name?: string;
  description?: string;
}

export interface GPXRoute {
  name: string;
  description?: string;
  waypoints: GPXWaypoint[];
  author?: string;
  date?: string;
}

export function generateGPX(route: GPXRoute): string {
  const now = route.date || new Date().toISOString();

  const wptElements = route.waypoints
    .filter(w => w.name) // Only named waypoints become <wpt>
    .map(w => `  <wpt lat="${w.lat}" lon="${w.lon}">
${w.elevation ? `    <ele>${w.elevation}</ele>` : ''}
    <name>${escapeXml(w.name || '')}</name>
${w.description ? `    <desc>${escapeXml(w.description)}</desc>` : ''}
  </wpt>`)
    .join('\n');

  const trkptElements = route.waypoints
    .map(w => `      <trkpt lat="${w.lat}" lon="${w.lon}">
${w.elevation ? `        <ele>${w.elevation}</ele>` : ''}
${w.name ? `        <name>${escapeXml(w.name)}</name>` : ''}
      </trkpt>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     version="1.1"
     creator="Skitour Planer">
  <metadata>
    <name>${escapeXml(route.name)}</name>
${route.description ? `    <desc>${escapeXml(route.description)}</desc>` : ''}
    <author><name>${escapeXml(route.author || 'Skitour Planer')}</name></author>
    <time>${now}</time>
  </metadata>
${wptElements}
  <trk>
    <name>${escapeXml(route.name)}</name>
${route.description ? `    <desc>${escapeXml(route.description)}</desc>` : ''}
    <trkseg>
${trkptElements}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trigger a GPX file download in the browser
 */
export function downloadGPX(route: GPXRoute): void {
  const gpxContent = generateGPX(route);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
