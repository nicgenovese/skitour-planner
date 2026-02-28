/**
 * Build script: Extract Swiss ski tour data from Swisstopo GeoPackage
 * and generate a static JSON database with WGS84 coordinates.
 *
 * Source: ch.swisstopo-karto.skitouren (OGD, free)
 * Run: node scripts/build-tour-db.js
 * Output: public/data/swiss-tours.json
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Swiss LV95 (EPSG:2056) to WGS84 (EPSG:4326) ──
function lv95ToWgs84(east, north) {
  const y = (east - 2600000) / 1000000;
  const x = (north - 1200000) / 1000000;
  let lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  let lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
  return { lat: Math.round(lat * 100 / 36 * 100000) / 100000, lon: Math.round(lon * 100 / 36 * 100000) / 100000 };
}

// ── Parse GeoPackage binary geometry → array of {x, y} points ──
function parseGeom(blob) {
  if (!blob || blob.length < 40 || String.fromCharCode(blob[0], blob[1]) !== 'GP') return null;
  const flags = blob[3];
  const le = (flags & 0x01) === 1;
  const envSizes = [0, 32, 48, 48, 64];
  const wOff = 8 + (envSizes[(flags >> 1) & 0x07] || 0);
  if (wOff >= blob.length) return null;

  const wLE = blob[wOff] === 1;
  const dv = new DataView(blob.buffer, blob.byteOffset + wOff);
  const gt = dv.getUint32(1, wLE);
  const pts = [];

  if (gt === 5) { // MultiLineString
    const nLS = dv.getUint32(5, wLE);
    let p = wOff + 9;
    for (let i = 0; i < nLS; i++) {
      const lLE = blob[p] === 1; p += 5;
      const nP = new DataView(blob.buffer, blob.byteOffset + p).getUint32(0, lLE); p += 4;
      for (let j = 0; j < nP; j++) {
        const d = new DataView(blob.buffer, blob.byteOffset + p);
        pts.push({ x: d.getFloat64(0, lLE), y: d.getFloat64(8, lLE) }); p += 16;
      }
    }
  } else if (gt === 2) { // LineString
    const nP = dv.getUint32(5, wLE);
    let p = wOff + 9;
    for (let j = 0; j < nP; j++) {
      const d = new DataView(blob.buffer, blob.byteOffset + p);
      pts.push({ x: d.getFloat64(0, wLE), y: d.getFloat64(8, wLE) }); p += 16;
    }
  }
  return pts.length >= 2 ? pts : null;
}

// ── Douglas-Peucker simplification ──
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  let mD = 0, mI = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = b.lat - a.lat, dy = b.lon - a.lon, m = Math.sqrt(dx * dx + dy * dy);
    const d = m === 0 ? Math.hypot(pts[i].lat - a.lat, pts[i].lon - a.lon)
      : Math.abs((pts[i].lat - a.lat) * dy - (pts[i].lon - a.lon) * dx) / m;
    if (d > mD) { mD = d; mI = i; }
  }
  if (mD > tol) {
    const l = simplify(pts.slice(0, mI + 1), tol);
    const r = simplify(pts.slice(mI), tol);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRegion(lat, lon) {
  if (lat > 47.1) return 'Voralpen';
  if (lon < 7.0) return 'Waadtländer Alpen';
  if (lon < 7.6 && lat < 46.5) return 'Walliser Alpen';
  if (lon >= 7.6 && lon < 8.1 && lat < 46.8) return 'Berner Oberland';
  if (lon >= 8.1 && lon < 8.8 && lat < 46.7) return 'Gotthard / Uri Alpen';
  if (lon >= 8.1 && lon < 8.8 && lat >= 46.7 && lat < 47.1) return 'Zentralschweiz';
  if (lon >= 8.8 && lon < 9.5 && lat < 46.8) return 'Graubünden West';
  if (lon >= 9.5 && lat < 46.8) return 'Graubünden Ost';
  if (lon >= 8.8 && lat >= 46.8) return 'Ostschweiz';
  if (lon >= 7.0 && lon < 7.6 && lat >= 46.5) return 'Fribourg / Bern';
  return 'Schweiz';
}

// ── GeoAdmin reverse geocode (find peak name near coordinates) ──
function geocodePeak(lat, lon) {
  return new Promise(resolve => {
    const url = `https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&bbox=${lon - 0.003},${lat - 0.003},${lon + 0.003},${lat + 0.003}&sr=4326&limit=3&origins=gazetteer`;
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d).results || [];
          const best = r.find(x => x.attrs && x.attrs.label);
          resolve(best ? best.attrs.label.replace(/<[^>]*>/g, '').trim() : '');
        } catch { resolve(''); }
      });
    }).on('error', () => resolve(''));
  });
}

// ── Process a batch of rows ──
function processBatch(rows) {
  const results = [];
  for (const [fid, geom, nameDe, targetName, targetAlt, ascentAlt, descentAlt, timeLabel, diffDe, diff, sacUrl] of rows) {
    if (!geom || !(geom instanceof Uint8Array)) continue;
    const lv95 = parseGeom(geom);
    if (!lv95) continue;

    const wgs = lv95.map(p => lv95ToWgs84(p.x, p.y));
    const start = wgs[0], end = wgs[wgs.length - 1];
    if (start.lat < 45.5 || start.lat > 48 || start.lon < 5.5 || start.lon > 11) continue;

    // Simplify to max ~15 waypoints
    let simp = simplify(wgs, 0.0008);
    if (simp.length > 15) {
      const s = Math.floor(simp.length / 13);
      const sam = [simp[0]];
      for (let i = s; i < simp.length - 1; i += s) sam.push(simp[i]);
      sam.push(simp[simp.length - 1]);
      simp = sam;
    }

    // Distance
    let dist = 0;
    for (let i = 1; i < wgs.length; i++) dist += haversine(wgs[i - 1].lat, wgs[i - 1].lon, wgs[i].lat, wgs[i].lon);

    // Start label from route name ("Von X", "Ab X")
    let sl = '';
    if (nameDe) {
      const m = nameDe.match(/^(?:Von|Ab|Depuis|Da|From)\s+(.+?)(?:\s*(?:über|via|nach|bis|par)\s|$)/i);
      if (m) sl = m[1].replace(/\s*\(.*?\)\s*$/, '').trim();
    }

    const name = targetName && targetAlt ? `${targetName} ${Math.round(targetAlt)}m`
      : targetName || nameDe || '';

    results.push({
      id: `st-${fid}`,
      name,
      routeDesc: nameDe || '',
      difficulty: diffDe || '',
      startPoint: { lat: start.lat, lon: start.lon, label: sl || 'Start' },
      summit: { lat: end.lat, lon: end.lon, label: targetName || '', elevation: targetAlt ? Math.round(targetAlt) : 0 },
      waypoints: simp.map(p => ({ lat: p.lat, lon: p.lon })),
      totalElevation: ascentAlt || 0,
      distance: Math.round(dist * 10) / 10,
      estimatedTime: timeLabel || '',
      sacUrl: sacUrl || '',
      region: getRegion(end.lat, end.lon),
    });
  }
  return results;
}

async function main() {
  console.log('🏔️  Building Swiss ski tour database...\n');

  const gpkgPath = path.join(__dirname, 'ski_routes_2056.gpkg');
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  const outputPath = path.join(outputDir, 'swiss-tours.json');

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(gpkgPath));

  // ── 1. Named routes (have route description, target name, difficulty) ──
  console.log('  Processing named routes...');
  const namedRes = db.exec(`
    SELECT fid, geom, name_de, target_name, target_altitude,
           ascent_altitude, descent_altitude, ascent_time_label,
           difficulty_de, difficulty, url_sac_de
    FROM ski_routes_2056
    WHERE name_de != 'Keine Routeninfo verfügbar' AND name_de IS NOT NULL
    ORDER BY fid
  `);

  const tours = namedRes.length ? processBatch(namedRes[0].values) : [];
  console.log(`  Named routes: ${tours.length}`);

  // ── 2. Unnamed routes — extract geometry, geocode peaks ──
  console.log('  Processing unnamed routes...');
  const unnamedRes = db.exec(`
    SELECT fid, geom, name_de, target_name, target_altitude,
           ascent_altitude, descent_altitude, ascent_time_label,
           difficulty_de, difficulty, url_sac_de
    FROM ski_routes_2056
    WHERE name_de = 'Keine Routeninfo verfügbar' OR name_de IS NULL
    ORDER BY fid
  `);

  const unnamedTours = unnamedRes.length ? processBatch(unnamedRes[0].values) : [];
  console.log(`  Unnamed routes with geometry: ${unnamedTours.length}`);

  db.close();

  // ── 3. Geocode unnamed peaks in batches ──
  console.log('  Geocoding unnamed peaks (this takes a few minutes)...');
  let geocoded = 0;
  const BATCH_SIZE = 10;
  const DELAY_MS = 3500; // ~20 req/min rate limit

  for (let i = 0; i < unnamedTours.length; i += BATCH_SIZE) {
    const batch = unnamedTours.slice(i, i + BATCH_SIZE);
    const names = await Promise.all(batch.map(t => geocodePeak(t.summit.lat, t.summit.lon)));
    names.forEach((name, j) => {
      if (name) {
        batch[j].name = name;
        batch[j].summit.label = name;
        geocoded++;
      }
    });

    if ((i / BATCH_SIZE) % 10 === 0) {
      process.stdout.write(`\r  Geocoded ${Math.min(i + BATCH_SIZE, unnamedTours.length)}/${unnamedTours.length} (${geocoded} found)`);
    }

    if (i + BATCH_SIZE < unnamedTours.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n  Geocoded ${geocoded}/${unnamedTours.length} unnamed peaks`);

  // Keep only geocoded unnamed tours
  const geocodedTours = unnamedTours.filter(t => t.name && t.name.length > 0);
  const allTours = [...tours, ...geocodedTours];

  console.log(`\n  Total tours: ${allTours.length} (${tours.length} named + ${geocodedTours.length} geocoded)`);

  // ── 4. Write outputs ──
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allTours));
  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ ${outputPath} (${sizeMB} MB, ${allTours.length} tours)`);

  // Compact index for AI prompt injection
  const compact = allTours.map(t => ({
    id: t.id, n: t.name, d: t.difficulty, e: t.totalElevation,
    a: t.summit.elevation, rg: t.region, rd: t.routeDesc,
  }));
  const compactPath = path.join(outputDir, 'swiss-tours-index.json');
  fs.writeFileSync(compactPath, JSON.stringify(compact));
  const cSize = (fs.statSync(compactPath).size / 1024).toFixed(0);
  console.log(`✅ ${compactPath} (${cSize} KB) — for AI context`);
}

main().catch(err => { console.error('❌ Build failed:', err); process.exit(1); });
