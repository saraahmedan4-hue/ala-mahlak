// يبني js/map-data.js من بلاطات OpenFreeMap (بيانات OpenStreetMap، ODbL).
// التشغيل: cd tools && npm install && node build-map.mjs
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const Z = 13;
const BBOX = { w: 46.53, e: 46.79, s: 24.615, n: 24.885 };
const K = 10000; // وحدة SVG لكل درجة طول
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
const proj = (lon, lat) => [(lon - BBOX.w) * K, (merc(BBOX.n) - merc(lat)) * K];
const [W, H] = proj(BBOX.e, BBOX.s).map(Math.round);

const lon2x = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z);
const lat2y = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z);

const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const url = tj.tiles[0];

function simplify(pts, tol) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const inView = (pts) => pts.some(([x, y]) => x > -50 && x < W + 50 && y > -50 && y < H + 50);
const toPath = (pts, close) => 'M' + pts.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + (close ? 'Z' : '');

const out = { major: [], mid: [], minor: [], rail: [], water: [], park: [] };
const names = {};
const cls = (c) => (['motorway', 'trunk'].includes(c) ? 'major' : ['primary', 'secondary'].includes(c) ? 'mid' : ['tertiary', 'minor'].includes(c) ? 'minor' : ['rail', 'transit'].includes(c) ? 'rail' : null);

for (let x = lon2x(BBOX.w); x <= lon2x(BBOX.e); x++) {
  for (let y = lat2y(BBOX.n); y <= lat2y(BBOX.s); y++) {
    let buf = Buffer.from(await (await fetch(url.replace('{z}', Z).replace('{x}', x).replace('{y}', y))).arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    const vt = new VectorTile(new Pbf(buf));
    const take = (layerName, bucket, filter, close, tol) => {
      const L = vt.layers[layerName]; if (!L) return;
      for (let i = 0; i < L.length; i++) {
        const f = L.feature(i); const b = bucket || filter(f.properties); if (!b) continue;
        if (filter && bucket && !filter(f.properties)) continue;
        for (const ring of f.loadGeometry()) {
          const pts = ring.map((p) => {
            const lon = ((x + p.x / f.extent) / 2 ** Z) * 360 - 180;
            const n = Math.PI - (2 * Math.PI * (y + p.y / f.extent)) / 2 ** Z;
            const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
            return proj(lon, lat);
          });
          const s = simplify(pts, tol);
          if (s.length > 1 && inView(s)) out[b].push(toPath(s, close));
        }
      }
    };
    take('transportation', null, (p) => cls(p.class), false, 1.6);
    const TN = vt.layers.transportation_name;
    if (TN) for (let i = 0; i < TN.length; i++) {
      const f = TN.feature(i), pr = f.properties;
      if (!['motorway', 'trunk', 'primary'].includes(pr.class) || !pr.name) continue;
      for (const ring of f.loadGeometry()) {
        const pts = ring.map((q) => {
          const lon = ((x + q.x / f.extent) / 2 ** Z) * 360 - 180;
          const n = Math.PI - (2 * Math.PI * (y + q.y / f.extent)) / 2 ** Z;
          return proj(lon, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
        });
        let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        const ar = pr['name:ar'] || pr.name, en = pr.name_en || pr['name:en'] || pr['name:latin'] || ar;
        if (!names[ar] || names[ar].len < len) names[ar] = { len, pts, ar, en };
      }
    }
    take('water', 'water', null, true, 2);
    take('park', 'park', null, true, 2);
    take('landcover', 'park', (p) => p.class === 'grass' || p.class === 'wood', true, 2);
  }
}
const labels = Object.values(names).filter((n) => n.len > 120).sort((a, b) => b.len - a.len).slice(0, 22).map((n) => {
  let acc = 0, half = n.len / 2, k = 1;
  for (; k < n.pts.length; k++) { const d = Math.hypot(n.pts[k][0] - n.pts[k - 1][0], n.pts[k][1] - n.pts[k - 1][1]); if (acc + d >= half) break; acc += d; }
  const [p0, p1] = [n.pts[k - 1], n.pts[Math.min(k, n.pts.length - 1)]];
  let ang = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  return { ar: n.ar, en: n.en, x: Math.round((p0[0] + p1[0]) / 2), y: Math.round((p0[1] + p1[1]) / 2), a: Math.round(ang) };
}).filter((l) => l.x > 0 && l.x < W && l.y > 0 && l.y < H);
const js = `/* مولّد من tools/build-map.mjs · © OpenStreetMap contributors (ODbL) · OpenMapTiles */\nwindow.MAPDATA=${JSON.stringify({ W, H, bbox: BBOX, K, labels, layers: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('')])) })};\n`;
writeFileSync(new URL('../js/map-data.js', import.meta.url), js);
console.log('size KB', (js.length / 1024).toFixed(0), Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), W, H);
