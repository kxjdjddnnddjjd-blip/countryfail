// Генерация провинций (по городам) из данных Natural Earth.
// Запуск: node build-map.js <папка с countries.geojson и places_full.geojson>
const fs = require('fs');
const path = require('path');
const { Delaunay } = require('d3-delaunay');
const pc = require('polygon-clipping');
const topojson = require('topojson-server');
const simplify = require('topojson-simplify');
const d3geo = require('d3-geo');

const SRC = process.argv[2];
const countries = JSON.parse(fs.readFileSync(path.join(SRC, 'countries.geojson')));
const places = JSON.parse(fs.readFileSync(path.join(SRC, 'places_full.geojson')));

// ---------- 1. Владелец каждой территории (суверенная страна, ISO2) ----------
const OVERRIDE = { PSX: 'PS', SAH: 'MA', KAS: 'IN', CYN: 'CY', SOL: 'SO', KOS: 'XK', ATA: null };
const sovIso = {};
for (const f of countries.features) {
  const p = f.properties;
  if (p.ADMIN === p.SOVEREIGNT && p.ISO_A2_EH !== '-99') sovIso[p.SOVEREIGNT] = p.ISO_A2_EH;
}
const a3owner = {};
const owners = {}; // iso2 -> {polys:[], props}
for (const f of countries.features) {
  const p = f.properties;
  let iso = p.ADM0_A3 in OVERRIDE ? OVERRIDE[p.ADM0_A3]
    : (p.TYPE === 'Sovereign country' || p.TYPE === 'Sovereignty' || p.TYPE === 'Disputed' && p.ADM0_A3 !== 'IOT' && p.ADM0_A3 !== 'FLK')
      ? p.ISO_A2_EH : sovIso[p.SOVEREIGNT] || p.ISO_A2_EH;
  if (p.ADMIN === p.SOVEREIGNT) iso = OVERRIDE[p.ADM0_A3] !== undefined ? OVERRIDE[p.ADM0_A3] : p.ISO_A2_EH;
  if (!iso || iso === '-99') continue;
  a3owner[p.ADM0_A3] = iso;
  const o = owners[iso] || (owners[iso] = { polys: [], main: null, extra: [] });
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  o.polys.push(...polys);
  const isMain = sovIso[p.SOVEREIGNT] === iso && p.ADMIN === p.SOVEREIGNT || OVERRIDE[p.ADM0_A3] === iso && iso === p.ISO_A2_EH;
  if (isMain || !o.main) o.main = p;
  else o.extra.push(p);
}
// Для стран без "ADMIN==SOVEREIGNT" (Израиль, Косово и т.п.) main уже установлен первым признаком.
for (const f of countries.features) {
  const p = f.properties;
  const iso = a3owner[p.ADM0_A3];
  if (iso && p.ISO_A2_EH === iso) owners[iso].main = p;
}

// ---------- помощники ----------
const R = 6371;
function ringArea(r) { // приблизительная площадь в км²
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [x1, y1] = r[j], [x2, y2] = r[i];
    a += (x2 - x1) * Math.PI / 180 * (2 + Math.sin(y1 * Math.PI / 180) + Math.sin(y2 * Math.PI / 180));
  }
  return Math.abs(a * R * R / 2);
}
function polyArea(mp) { return mp.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((t, h) => t + ringArea(h), 0), 0); }
function shiftLon(mp, fn) { return mp.map(poly => poly.map(ring => ring.map(([x, y]) => [fn(x), y]))); }

// ---------- 2. Города ----------
const cityByOwner = {};
for (const f of places.features) {
  const p = f.properties;
  const iso = a3owner[p.ADM0_A3] || a3owner[p.SOV_A3];
  if (!iso) continue;
  (cityByOwner[iso] || (cityByOwner[iso] = [])).push({
    name: p.NAME_RU || p.NAME, en: p.NAME, lon: p.LONGITUDE, lat: p.LATITUDE,
    pop: p.POP_MAX || 0, cap: p.ADM0CAP === 1 && (p.ADM0_A3 === owners[iso].main.ADM0_A3 || p.ADM0_A3 === p.SOV_A3) ? 1 : 0,
  });
}
// Крымские города в данных помечены как российские, а полигон Крыма — украинский: переносим их в UA
{
  const inCrimea = c => c.lat > 44 && c.lat < 46.2 && c.lon > 32.4 && c.lon < 36.7;
  cityByOwner.UA.push(...cityByOwner.RU.filter(inCrimea));
  cityByOwner.RU = cityByOwner.RU.filter(c => !inCrimea(c));
}
function km(a, b) {
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- 3. Провинции ----------
const provinces = [];
const provGeoms = [];
const countryMeta = {};
// Территории, которые в 2026 году контролирует Россия (Крым и часть востока Украины)
const RU_CONTROLLED = ['Симферополь', 'Севастополь', 'Донецк', 'Луганск', 'Мариуполь', 'Мелитополь', 'Керчь', 'Евпатория', 'Алчевск', 'Макеевка', 'Горловка', 'Бердянск', 'Енакиево', 'Стаханов', 'Северодонецк', 'Красный Луч', 'Ялта', 'Феодосия', 'Джанкой', 'Свердловск', 'Антрацит'];

for (const iso of Object.keys(owners).sort()) {
  const o = owners[iso];
  let mp = o.polys;
  // антимеридиан: собираем страну на одной стороне
  const xs = mp.flat(2).map(c => c[0]);
  let shift = null;
  if (Math.max(...xs) > 170 && Math.min(...xs) < -170) {
    const east = mp.filter(poly => poly[0][0][0] > 0).reduce((s, p) => s + ringArea(p[0]), 0);
    const west = mp.filter(poly => poly[0][0][0] < 0).reduce((s, p) => s + ringArea(p[0]), 0);
    shift = east >= west ? (x => x < -100 ? x + 360 : x) : (x => x > 100 ? x - 360 : x);
    mp = shiftLon(mp, shift);
  }
  mp = pc.union(...mp.map(p => [p]));
  const area = polyArea(mp);
  const pop = o.main.POP_EST || 0;
  let K = Math.round(Math.sqrt(area) / 85 + pop / 14e6);
  K = Math.max(1, Math.min(55, K));
  if (area < 3000) K = 1;
  const cities = (cityByOwner[iso] || []).map(c => ({ ...c, lon: shift ? shift(c.lon) : c.lon }));
  cities.sort((a, b) => b.cap - a.cap || b.pop - a.pop);
  let chosen = [];
  let spacing = Math.sqrt(area / K) * 0.55;
  for (let tries = 0; tries < 6 && chosen.length < K; tries++) {
    chosen = [];
    for (const c of cities) {
      if (chosen.length >= K) break;
      if (chosen.every(d => km(c, d) >= spacing)) chosen.push(c);
    }
    spacing *= 0.7;
  }
  // обязательно включаем подконтрольные России города, если это Украина
  if (iso === 'UA') {
    for (const n of ['Симферополь', 'Севастополь', 'Донецк', 'Луганск', 'Мариуполь', 'Мелитополь']) {
      const c = cities.find(x => x.name === n);
      if (c && !chosen.includes(c)) chosen.push(c);
    }
  }
  if (!chosen.length) {
    // нет городов: одна провинция по центроиду
    const ctr = d3geo.geoCentroid({ type: 'MultiPolygon', coordinates: mp });
    chosen = [{ name: o.main.NAME_RU || o.main.NAME, lon: ctr[0], lat: ctr[1], pop, cap: 1 }];
  }
  if (!chosen.some(c => c.cap)) chosen[0].cap = 1;

  const meanLat = chosen.reduce((s, c) => s + c.lat, 0) / chosen.length;
  const kx = Math.cos(meanLat * Math.PI / 180) || 1;
  const allx = mp.flat(2).map(c => c[0]), ally = mp.flat(2).map(c => c[1]);
  const bbox = [Math.min(...allx) * kx - 5, Math.min(...ally) - 5, Math.max(...allx) * kx + 5, Math.max(...ally) + 5];
  let cells;
  if (chosen.length === 1) cells = [mp];
  else {
    const del = Delaunay.from(chosen.map(c => [c.lon * kx, c.lat]));
    const vor = del.voronoi(bbox);
    cells = chosen.map((c, i) => {
      const poly = vor.cellPolygon(i);
      if (!poly) return [];
      const ring = poly.map(([x, y]) => [x / kx, y]);
      try { return pc.intersection(mp, [[ring]]); } catch (e) { return []; }
    });
  }
  const capIdx = chosen.findIndex(c => c.cap);
  const totalCityPop = chosen.reduce((s, c) => s + Math.max(c.pop, 1000) ** 0.6, 0);
  countryMeta[iso] = {
    name: o.main.NAME_RU || o.main.NAME, en: o.main.NAME, pop, gdp: o.main.GDP_MD > 0 ? o.main.GDP_MD : 50,
    color: o.main.MAPCOLOR9, cont: o.main.CONTINENT, area: Math.round(area), cap: null,
  };
  chosen.forEach((c, i) => {
    if (!cells[i] || !cells[i].length) return;
    const id = provinces.length;
    let owner = iso;
    if (iso === 'UA' && RU_CONTROLLED.includes(c.name)) owner = 'RU';
    provinces.push({
      id, name: c.name, owner, core: iso, lon: +c.lon.toFixed(3), lat: +c.lat.toFixed(3),
      pop: Math.round(pop * Math.max(c.pop, 1000) ** 0.6 / totalCityPop), cap: i === capIdx ? 1 : 0,
    });
    if (i === capIdx) countryMeta[iso].cap = id;
    provGeoms.push(cells[i]);
  });
  process.stdout.write(iso + ':' + chosen.length + ' ');
}
console.log('\nprovinces', provinces.length);

// ---------- 4. Снап координат + устранение T-стыков, чтобы границы были общими ----------
const Q = 1e4;
const qv = v => Math.round(v * Q) / Q;
for (const g of provGeoms) for (const poly of g) for (const ring of poly) for (const c of ring) { c[0] = qv(c[0]); c[1] = qv(c[1]); }
const GRID = 0.5;
const grid = new Map();
const key = (x, y) => Math.floor(x / GRID) + ',' + Math.floor(y / GRID);
for (const g of provGeoms) for (const poly of g) for (const ring of poly) for (const c of ring) {
  const k = key(c[0], c[1]);
  let s = grid.get(k); if (!s) grid.set(k, s = new Map());
  s.set(c[0] + ',' + c[1], c);
}
let inserted = 0;
for (const g of provGeoms) for (const poly of g) for (let r = 0; r < poly.length; r++) {
  const ring = poly[r];
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    const minx = Math.min(a[0], b[0]), maxx = Math.max(a[0], b[0]), miny = Math.min(a[1], b[1]), maxy = Math.max(a[1], b[1]);
    const found = [];
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    if (L2 > 0) {
      for (let gx = Math.floor(minx / GRID); gx <= Math.floor(maxx / GRID); gx++)
        for (let gy = Math.floor(miny / GRID); gy <= Math.floor(maxy / GRID); gy++) {
          const s = grid.get(gx + ',' + gy); if (!s) continue;
          for (const c of s.values()) {
            if (c[0] < minx || c[0] > maxx || c[1] < miny || c[1] > maxy) continue;
            const t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / L2;
            if (t <= 1e-9 || t >= 1 - 1e-9) continue;
            const px = a[0] + t * dx, py = a[1] + t * dy;
            if (Math.abs(px - c[0]) < 1.5 / Q && Math.abs(py - c[1]) < 1.5 / Q) found.push([t, c]);
          }
        }
    }
    found.sort((u, v) => u[0] - v[0]);
    for (const [, c] of found) out.push([c[0], c[1]]);
    inserted += found.length;
    out.push(b);
  }
  poly[r] = out;
}
console.log('inserted T-junction vertices', inserted);
// polygon-clipping выдаёт внешние кольца против часовой стрелки, а d3-geo ждёт по часовой
for (const g of provGeoms) for (const poly of g) for (const ring of poly) ring.reverse();

// ---------- 5. TopoJSON ----------
const fc = {
  type: 'FeatureCollection',
  features: provGeoms.map((g, i) => ({ type: 'Feature', id: i, properties: {}, geometry: { type: 'MultiPolygon', coordinates: g } })),
};
let topo = topojson.topology({ p: fc }, 1e5);
topo = simplify.presimplify(topo);
topo = simplify.simplify(topo, simplify.quantile(topo, 0.35));
for (const g of topo.objects.p.geometries) delete g.properties;

fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
const out = 'window.WORLD=' + JSON.stringify({ topo, provinces, countries: countryMeta }) + ';';
fs.writeFileSync(path.join(__dirname, '..', 'data', 'world.js'), out);
console.log('written', (out.length / 1e6).toFixed(2), 'MB, countries', Object.keys(countryMeta).length);
