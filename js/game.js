(() => {
'use strict';
const W = window.WORLD, META = window.META;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPop = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' млрд' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' млн'
  : n >= 1e3 ? Math.round(n / 1e3) + ' тыс.' : String(Math.round(n));
const fmtNum = n => Math.round(n).toLocaleString('ru-RU');

// ======================= Экраны меню =======================
function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); if (id === 'screen-game') resize(); }
let creativeMode = false;
$('#btn-play').onclick = () => { creativeMode = false; show('screen-diff'); };
$('#btn-creative').onclick = () => { creativeMode = true; chosenDiff = 'normal'; buildFlagGrid(); show('screen-country'); };
$$('[data-back]').forEach(b => (b.onclick = () => show(b.dataset.back)));
let chosenDiff = 'normal';
$$('.diff').forEach(b => (b.onclick = () => { chosenDiff = b.dataset.diff; buildFlagGrid(); show('screen-country'); }));

const flagUrl = iso => `https://flagcdn.com/w160/${iso.toLowerCase()}.png`;
function setFlagImg(img, c) {
  img.onerror = () => { img.onerror = null; img.src = c.fallbackFlag || (c.fallbackFlag = makeFlag(c.id)); };
  img.src = c.flag;
}

function buildFlagGrid() {
  const grid = $('#flag-grid');
  if (!grid.childElementCount) {
    const list = Object.entries(W.countries).sort((a, b) => a[1].name.localeCompare(b[1].name, 'ru'));
    for (const [iso, c] of list) {
      const card = document.createElement('div');
      card.className = 'flag-card';
      card.dataset.q = (c.name + ' ' + c.en).toLowerCase();
      card.dataset.iso = iso;
      card.innerHTML = `<img class="flag" loading="lazy" alt=""><div class="name"></div><div class="meta">${fmtPop(c.pop)}</div>`;
      card.querySelector('.name').textContent = c.name;
      setFlagImg(card.querySelector('img'), { id: iso, flag: flagUrl(iso) });
      card.onclick = () => onPickCountry(iso);
      grid.appendChild(card);
    }
  }
  $('#country-search').value = '';
  $('#screen-country [data-back]').dataset.back = creativeMode ? 'screen-menu' : 'screen-diff';
  $('#screen-country h2').textContent = creativeMode ? 'Творческий режим — выберите страну' : 'Выберите страну';
  filterGrid('');
  $$('.flag-card').forEach(card => card.classList.toggle('taken', MP.role === 'guest' && MP.taken.includes(card.dataset.iso)));
  setTimeout(() => $('#country-search').focus(), 50);
}
function filterGrid(q) { q = q.trim().toLowerCase(); $$('.flag-card').forEach(c => (c.style.display = !q || c.dataset.q.includes(q) ? '' : 'none')); }
$('#country-search').oninput = e => filterGrid(e.target.value);

// ======================= Генератор флагов =======================
const FLAG_COLORS = ['#c8102e', '#ffffff', '#0033a0', '#009739', '#ffd100', '#000000', '#ff8200', '#5bc2e7', '#7a1f3d', '#00543c', '#1d2b6b'];
function makeFlag(seed) {
  const cv = document.createElement('canvas'); cv.width = 150; cv.height = 100;
  const g = cv.getContext('2d');
  let s = 0; for (const ch of String(seed) + Math.random()) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const pick = () => FLAG_COLORS[Math.floor(r() * FLAG_COLORS.length)];
  const cols = []; while (cols.length < 3) { const c = pick(); if (c !== cols[cols.length - 1]) cols.push(c); }
  const type = Math.floor(r() * 5);
  if (type === 0) cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 100 / 3, 150, 100 / 3 + 1); });
  else if (type === 1) cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * 50, 0, 51, 100); });
  else if (type === 2) { g.fillStyle = cols[0]; g.fillRect(0, 0, 150, 50); g.fillStyle = cols[1]; g.fillRect(0, 50, 150, 50);
    g.fillStyle = cols[2]; g.beginPath(); g.moveTo(0, 0); g.lineTo(60, 50); g.lineTo(0, 100); g.fill(); }
  else if (type === 3) { g.fillStyle = cols[0]; g.fillRect(0, 0, 150, 100); g.fillStyle = cols[1];
    g.fillRect(0, 38, 150, 24); g.fillRect(45, 0, 24, 100); }
  else { g.fillStyle = cols[0]; g.fillRect(0, 0, 150, 100); }
  if (r() < 0.55) {
    g.fillStyle = '#fff';
    const cx = type === 2 ? 22 : 75, cy = 50, R = 16;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.42 : R; g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    g.fill();
  }
  return cv.toDataURL();
}

// ======================= Растровая карта мира =======================
// Мир разбит на сетку клеток (~12 км). Каждая клетка принадлежит стране — так фронт двигается плавно.
const VW = 2000, VH = 1040, RS = 1.5, RW = VW * RS, RH = VH * RS, NCELL = RW * RH, SEA = 0xFFFF, CAP = 1024;
const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [VW - 10, VH - 10]], { type: 'Sphere' });
const P = W.provinces, NP = P.length;
const features = topojson.feature(W.topo, W.topo.objects.p).features;
const ISO = Object.keys(W.countries);
const isoIx = Object.fromEntries(ISO.map((k, i) => [k, i]));
const provCore = Uint16Array.from(P, p => isoIx[p.core]);
const provOwner0 = Uint16Array.from(P, p => isoIx[p.owner]);
const provXY = P.map((p, i) => projection([p.lon, p.lat]) || d3.geoPath(projection).centroid(features[i]));

const provOf = new Uint16Array(NCELL).fill(SEA);
(function rasterize() {
  for (let pid = 0; pid < NP; pid++) {
    const rings = []; let cur = null;
    const rec = { moveTo(x, y) { cur = [[x * RS, y * RS]]; rings.push(cur); }, lineTo(x, y) { cur.push([x * RS, y * RS]); }, closePath() {}, arc() {} };
    d3.geoPath(projection, rec)(features[pid]);
    const rows = new Map();
    for (const r of rings) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      if (a[1] === b[1]) continue;
      const ylo = Math.min(a[1], b[1]), yhi = Math.max(a[1], b[1]);
      const k = (b[0] - a[0]) / (b[1] - a[1]);
      for (let row = Math.ceil(ylo - 0.5); row + 0.5 < yhi; row++) {
        let l = rows.get(row); if (!l) rows.set(row, (l = []));
        l.push(a[0] + (row + 0.5 - a[1]) * k);
      }
    }
    for (const [row, xs] of rows) {
      if (row < 0 || row >= RH) continue;
      xs.sort((u, v) => u - v);
      const base = row * RW;
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(RW - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
        for (let x = xa; x <= xb; x++) provOf[base + x] = pid;
      }
    }
  }
})();
const cellAt = (x, y) => clamp(y | 0, 0, RH - 1) * RW + clamp(x | 0, 0, RW - 1);
// клетка города (гарантируем, что у каждой провинции есть хотя бы одна клетка)
const cityCell = new Int32Array(NP);
const cityAtCell = new Map();
for (let pid = 0; pid < NP; pid++) {
  const cx = provXY[pid][0] * RS, cy = provXY[pid][1] * RS;
  let c = cellAt(cx, cy);
  if (provOf[c] !== pid) {
    let found = -1;
    for (let r = 1; r <= 14 && found < 0; r++)
      for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const j = cellAt(cx + dx, cy + dy);
        if (provOf[j] === pid) { found = j; break; }
      }
    if (found >= 0) c = found; else provOf[c] = pid;
  }
  cityCell[pid] = c; cityAtCell.set(c, pid);
}
const provCount = new Int32Array(NP);
for (let i = 0; i < NCELL; i++) if (provOf[i] !== SEA) provCount[provOf[i]]++;
const provStart = new Int32Array(NP + 1);
for (let p = 0; p < NP; p++) provStart[p + 1] = provStart[p] + provCount[p];
const provCells = new Int32Array(provStart[NP]);
{ const fillPos = provStart.slice(0, NP); for (let i = 0; i < NCELL; i++) if (provOf[i] !== SEA) provCells[fillPos[provOf[i]]++] = i; }
const provDens = Float64Array.from(P, (p, i) => p.pop / Math.max(1, provCount[i]));

// векторные слои (контуры) для красоты
const spherePath = new Path2D(); d3.geoPath(projection, spherePath)({ type: 'Sphere' });
const gratPath = new Path2D(); d3.geoPath(projection, gratPath)(d3.geoGraticule10());
const coastPath = new Path2D(); d3.geoPath(projection, coastPath)(topojson.mesh(W.topo, W.topo.objects.p, (a, b) => a === b));
const provLinePath = new Path2D(); d3.geoPath(projection, provLinePath)(topojson.mesh(W.topo, W.topo.objects.p, (a, b) => a !== b));

// ======================= Состояние партии =======================
const owner = new Uint16Array(NCELL);
let C = [];          // страны (по индексу)
let G = null;        // состояние игры
let PL = -1;         // индекс страны игрока (-1 — наблюдатель)
// Сетевая игра: role — 'host' (считает мир) или 'guest' (друг); guests — подключённые друзья (до двух) на стороне хоста
const MP = { role: null, peer: null, conn: null, code: '', guests: [], maxGuests: 1, humans: [], cellBuf: [], warsSig: '', flagSent: {},
  pendingHost: false, live: false, waiting: false, taken: [], humansTotal: 0 };
let swapDepth = 0, swapKeep = -1, deferRecolor = false;
const isHuman = ix => ix >= 0 && (ix === (swapDepth ? swapKeep : PL) || (MP.role === 'host' && MP.guests.some(g => g.pl === ix)));
// выполнить код «от лица» другого живого игрока (для приказов друга и сообщений ему)
function asPlayer(h, fn) {
  if (h === PL) return fn();
  const keep = PL, g = MP.guests.find(x => x.pl === h);
  if (!swapDepth) swapKeep = keep;
  swapDepth++; PL = h;
  try { return fn(); } finally {
    if (g) g.pl = PL; // друг мог сменить страну (независимость) или уйти
    PL = keep; swapDepth--;
    if (!swapDepth && deferRecolor) { deferRecolor = false; recolorAll(); }
    hudDirty = true;
  }
}
function forHumans(fn) {
  const list = [PL];
  if (MP.role === 'host') for (const g of MP.guests) if (g.pl >= 0 && g.pl !== PL) list.push(g.pl);
  for (const h of list) if (h >= 0 && C[h] && C[h].alive) asPlayer(h, () => fn(h));
}
const enemyM = new Uint8Array(CAP * CAP);
const inWB = new Uint8Array(NCELL);
let WB = [];         // клетки на линии фронта
const DIFF = {
  easy: { atk: 1.6, enemy: 0.6, aggr: 0.0006, reclaim: 0.35, accept: 0.15 },
  normal: { atk: 1.0, enemy: 1.0, aggr: 0.002, reclaim: 0.6, accept: 0 },
  hard: { atk: 0.8, enemy: 1.35, aggr: 0.005, reclaim: 0.85, accept: -0.1 },
};
const PALETTE = ['#7f9a5c', '#c4a35a', '#a85a6b', '#5b7fa9', '#8b6ba9', '#5ca99b', '#b97b4b', '#9b9b5b', '#6b8ba1'];
const COLOR_OVERRIDE = { RU: '#8f3d3d', US: '#3d6fb0', CN: '#c9a548', GB: '#c24a5a', FR: '#3c5ba8', DE: '#5e6a6e', UA: '#d1b64a',
  JP: '#e8e2d0', IN: '#d48a3c', BR: '#4a9a5a', CA: '#b85656', AU: '#4f8f82', KZ: '#5aa4b8', TR: '#a84848', PL: '#c97b8c', IR: '#6a9a5a' };
function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function baseColor(iso, m) {
  if (COLOR_OVERRIDE[iso]) return COLOR_OVERRIDE[iso];
  const c = d3.hsl(PALETTE[((m || 1) - 1) % 9]);
  const h = hashStr(iso);
  c.h += (h % 24) - 12; c.l += ((h >> 5) % 14 - 7) / 100;
  return c.formatHex();
}
const pack = col => { const c = d3.rgb(col); return (255 << 24 | c.b << 16 | c.g << 8 | c.r) >>> 0; };
function setColor(c, hex) { c.color = hex; c.rgb = pack(hex); c.drgb = pack(d3.color(hex).darker(0.7)); }

function makeCountry(o) {
  const c = Object.assign({ cells: 0, pop: 0, cities: 0, alive: true, morale: 1, bomb: 0, popF: 1, econ: 1, econUntil: 0,
    epiUntil: 0, aid: 0, aidFrom: new Set(), warBase: 0, enemies: 0, capProv: -1, strMul: 1, overlord: -1 }, o);
  c.ix = C.length; setColor(c, c.color);
  C.push(c);
  return c;
}

function newGame(iso, diff, creative) {
  C = [];
  for (const id of ISO) {
    const m = W.countries[id];
    const basePower = (Math.sqrt(m.gdp) + Math.sqrt(m.pop / 1000) * 0.5) * (META.military[id] || 1);
    makeCountry({ id, name: m.name, flag: flagUrl(id), color: baseColor(id, m.color), cont: m.cont,
      leader: META.leaders[id] || null, currency: META.currencyName(META.currency[id] || 'USD'),
      pc: basePower / Math.max(m.pop, 1), gdpPc: m.gdp * 1e6 / Math.max(m.pop, 1), capProv: m.cap == null ? -1 : m.cap });
  }
  for (let i = 0; i < NCELL; i++) {
    const p = provOf[i];
    if (p === SEA) { owner[i] = SEA; continue; }
    const o = provOwner0[p]; owner[i] = o; C[o].cells++; C[o].pop += provDens[p];
  }
  for (let p = 0; p < NP; p++) C[owner[cityCell[p]]].cities++;
  PL = isoIx[iso];
  G = { diff, D: DIFF[diff], day: new Date(2026, 0, 1), dayN: 0, paused: false, speed: 1, growth: 1, watching: PL,
    wars: [], alliances: [], newId: 1, mode: null, flights: [], strikes: [], pings: [], arrows: [], orders: {}, epi: null,
    pendingCap: [], modalPause: false, cityToast: {}, creative: !!creative, pmax: 1 };
  for (const a of META.alliances) G.alliances.push({ name: a.name, members: new Set(a.members.map(m => isoIx[m]).filter(m => m != null)) });
  for (const [k, list] of Object.entries(META.aid)) for (const s of list) if (isoIx[s] != null) C[isoIx[k]].aidFrom.add(isoIx[s]);
  for (const c of C) c.warBase = c.cells;
  for (const c of C) G.pmax = Math.max(G.pmax, power0(c));
  const w = makeWar(isoIx.RU, isoIx.UA, 'Российско-украинская война');
  G.wars.push(w);
  warsChanged();
  updateAid();
}

// ======================= Отрисовка клеток =======================
const ownCv = document.createElement('canvas'); ownCv.width = RW; ownCv.height = RH;
const octx = ownCv.getContext('2d');
const img = octx.createImageData(RW, RH);
const pix = new Uint32Array(img.data.buffer);
// отдельный слой границ — его можно рисовать мягче при приближении
const bordCv = document.createElement('canvas'); bordCv.width = RW; bordCv.height = RH;
const bctx = bordCv.getContext('2d');
const bimg = bctx.createImageData(RW, RH);
const bpix = new Uint32Array(bimg.data.buffer);
const TS = 128, TW = Math.ceil(RW / TS), TH = Math.ceil(RH / TS);
const dirtyTiles = new Uint8Array(TW * TH);
let anyDirty = false;
const COL_BORDER = pack('#16191e'), COL_PLAYER = pack('#f6e7a6'), COL_FRONT = pack('#ff3b2f'), COL_FRONT_AI = pack('#7a2219');
function borderKind(o, n, bd) {
  if (n === SEA || n === o) return bd;
  let k = 1;
  if (enemyM[o * CAP + n]) k = (o === PL || n === PL) ? 4 : 2;
  else if (o === PL || n === PL) k = 3;
  return k > bd ? k : bd;
}
function colorCell(i) {
  const o = owner[i];
  if (o === SEA) { pix[i] = 0; bpix[i] = 0; return; }
  const x = i % RW, y = (i / RW) | 0;
  let bd = 0;
  if (x > 0) bd = borderKind(o, owner[i - 1], bd);
  if (x < RW - 1) bd = borderKind(o, owner[i + 1], bd);
  if (y > 0) bd = borderKind(o, owner[i - RW], bd);
  if (y < RH - 1) bd = borderKind(o, owner[i + RW], bd);
  bpix[i] = bd === 4 ? COL_FRONT : bd === 3 ? COL_PLAYER : bd === 2 ? COL_FRONT_AI : bd ? COL_BORDER : 0;
  const core = provCore[provOf[i]];
  // оккупированная территория — штриховка цветом законного владельца
  pix[i] = core !== o && C[core].alive && (x + y) % 10 < 3 ? C[core].drgb : C[o].rgb;
  dirtyTiles[((y / TS) | 0) * TW + ((x / TS) | 0)] = 1; anyDirty = true;
}
function recolorAll() { if (swapDepth) { deferRecolor = true; return; } for (let i = 0; i < NCELL; i++) colorCell(i); }
function flushTiles() {
  if (!anyDirty) return;
  for (let t = 0; t < dirtyTiles.length; t++) if (dirtyTiles[t]) {
    const tx = (t % TW) * TS, ty = ((t / TW) | 0) * TS;
    octx.putImageData(img, 0, 0, tx, ty, Math.min(TS, RW - tx), Math.min(TS, RH - ty));
    bctx.putImageData(bimg, 0, 0, tx, ty, Math.min(TS, RW - tx), Math.min(TS, RH - ty));
    dirtyTiles[t] = 0;
  }
  anyDirty = false;
}

// ======================= Смена владельца клеток =======================
let labelsDirty = true;
const capLog = new Map(); // журнал захватов для стрелок наступления
function wbAdd(i) { if (!inWB[i] && owner[i] !== SEA) { inWB[i] = 1; WB.push(i); } }
function setOwner(i, n, quiet) {
  const o = owner[i];
  if (o === n || o === SEA) return;
  owner[i] = n;
  if (MP.live) MP.cellBuf.push(i, n);
  const co = C[o], cn = C[n], pp = provDens[provOf[i]];
  co.cells--; cn.cells++; co.pop -= pp; cn.pop += pp;
  colorCell(i);
  const x = i % RW;
  if (x > 0) { colorCell(i - 1); wbAdd(i - 1); }
  if (x < RW - 1) { colorCell(i + 1); wbAdd(i + 1); }
  if (i >= RW) { colorCell(i - RW); wbAdd(i - RW); }
  if (i + RW < NCELL) { colorCell(i + RW); wbAdd(i + RW); }
  wbAdd(i);
  if (!quiet) {
    const key = (((i / RW) / 36) | 0) * 1000 + ((x / 36) | 0);
    let e = capLog.get(key); if (!e) capLog.set(key, (e = new Map()));
    const pk = n * CAP + o; e.set(pk, (e.get(pk) || 0) + 1);
  }
  const pid = cityAtCell.get(i);
  if (pid !== undefined) cityCaptured(pid, o, n, quiet);
  labelsDirty = true;
  if (co.cells <= 0) eliminate(o);
}
function cityCaptured(pid, from, to, quiet) {
  C[from].cities--; C[to].cities++;
  if (!quiet && (isHuman(to) || isHuman(from))) forHumans(h => {
    const k = h + ':' + pid;
    if ((to === h || from === h) && !(G.cityToast[k] > G.dayN - 14) && (G.cityToast[k] = G.dayN + 1))
      say(`${to === h ? 'Взят' : 'Потерян'} город <b>${esc(P[pid].name)}</b>`, to === h ? 'good' : 'war', [to === h ? from : to]);
  });
  if (C[from].capProv === pid) {
    if (enemyM[from * CAP + to]) G.pendingCap.push([from, to, 'capital']);
    else relocateCapital(from);
  }
}
function relocateCapital(ix) {
  let best = -1;
  for (let p = 0; p < NP; p++) if (owner[cityCell[p]] === ix && (best < 0 || P[p].pop > P[best].pop)) best = p;
  C[ix].capProv = best;
}
function captureBlob(cell, by, r, victim) {
  const cx = cell % RW, cy = (cell / RW) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const j = cellAt(cx + dx, cy + dy);
    if (owner[j] === victim) setOwner(j, by);
  }
}

// ======================= Войны и коалиции =======================
function makeWar(a, b, name) {
  return { id: (G.warSeq = (G.warSeq || 0) + 1), sides: [new Set([a]), new Set([b])], start: G.dayN, name: name || `${C[a].name} против ${C[b].name}`, leaders: [a, b] };
}
const atWar = (a, b) => a >= 0 && b >= 0 && !!enemyM[a * CAP + b];
const allied = (a, b) => a !== b && G.alliances.some(al => al.members.has(a) && al.members.has(b));
const FRIENDS = new Set(META.friends.flatMap(([a, b]) => [a + b, b + a]));
const friendly = (a, b) => allied(a, b) || FRIENDS.has(C[a].id + C[b].id) || C[a].aidFrom.has(b) || C[b].aidFrom.has(a);
const alliancesOf = ix => G.alliances.filter(al => al.members.has(ix));
function inWar(w, ix) { return w.sides[0].has(ix) ? 0 : w.sides[1].has(ix) ? 1 : -1; }
function warsOf(ix) { return G.wars.filter(w => inWar(w, ix) >= 0); }
function rivalsBloc(a, b) {
  const na = alliancesOf(a).map(x => x.name), nb = alliancesOf(b).map(x => x.name);
  return META.rivals.some(([x, y]) => (na.includes(x) && nb.includes(y)) || (na.includes(y) && nb.includes(x)));
}

function warsChanged() {
  G.wars = G.wars.filter(w => w.sides[0].size && w.sides[1].size);
  enemyM.fill(0);
  for (const c of C) c.enemies = 0;
  for (const w of G.wars) for (const a of w.sides[0]) for (const b of w.sides[1]) {
    if (!enemyM[a * CAP + b]) { C[a].enemies++; C[b].enemies++; }
    enemyM[a * CAP + b] = enemyM[b * CAP + a] = 1;
  }
  // перестроить линию фронта
  WB = []; inWB.fill(0);
  for (let i = 0; i < NCELL; i++) {
    const o = owner[i]; if (o === SEA) continue;
    const r = (i % RW) < RW - 1 ? owner[i + 1] : SEA, d = i + RW < NCELL ? owner[i + RW] : SEA;
    if (r !== SEA && r !== o && enemyM[o * CAP + r]) { wbAdd(i); wbAdd(i + 1); }
    if (d !== SEA && d !== o && enemyM[o * CAP + d]) { wbAdd(i); wbAdd(i + RW); }
  }
  recolorAll();
  if ($('#screen-game').classList.contains('active')) renderHud();
}

function declareWar(att, def) {
  if (att === def || atWar(att, def) || !C[att].alive || !C[def].alive) return;
  if (allied(att, def)) for (const al of alliancesOf(att)) if (al.members.has(def)) al.members.delete(att);
  const w = makeWar(att, def);
  G.wars.push(w);
  toast(`<b>${esc(C[att].name)}</b> объявляет войну стране <b>${esc(C[def].name)}</b>!`, 'war', [att, def]);
  ping(cityXY(C[def].capProv), '#ff3b2f', '⚔');
  // защитники: вассалы и союзники по оборонительным договорам
  for (const c of C) if (c.alive && c.overlord === def && inWar(w, c.ix) < 0 && c.ix !== att) joinWar(w, 1, c.ix, 'вассал');
  for (const al of alliancesOf(def)) for (const m of al.members) {
    if (m === def || !C[m].alive || inWar(w, m) >= 0 || allied(m, att)) continue;
    if (Math.random() < (m === PL ? 1 : 0.9)) joinWar(w, 1, m, al.name);
  }
  // нападающий зовёт своих вассалов и союзников
  for (const c of C) if (c.alive && c.overlord === att && inWar(w, c.ix) < 0 && c.ix !== def && Math.random() < 0.75) joinWar(w, 0, c.ix, 'вассал');
  for (const al of alliancesOf(att)) for (const m of al.members) {
    if (m === att || !C[m].alive || inWar(w, m) >= 0 || allied(m, def)) continue;
    if (Math.random() < (isHuman(att) ? 0.75 : 0.25)) joinWar(w, 0, m, al.name);
  }
  warsChanged();
}
function joinWar(w, side, m, why) {
  if (inWar(w, m) >= 0) return;
  w.sides[side].add(m);
  const lead = w.leaders[side];
  toast(`<b>${esc(C[m].name)}</b> вступает в войну на стороне <b>${esc(C[lead].name)}</b>${why ? ' (' + esc(why) + ')' : ''}`, 'war', [m, lead]);
}
function leaveAllWars(ix) { for (const w of G.wars) { w.sides[0].delete(ix); w.sides[1].delete(ix); } }
function endWar(w, msg) {
  G.wars = G.wars.filter(x => x !== w);
  if (msg) toast(msg, 'good', w.leaders.filter(l => C[l].alive));
  warsChanged();
}

function capitulate(loser, winner, why) {
  const L = C[loser];
  if (!L.alive || !C[winner].alive) return;
  toast(`<b>${esc(L.name)}</b> капитулирует${why === 'capital' ? ' — пала столица' : ''}! Победитель: <b>${esc(C[winner].name)}</b>`, 'war', [loser, winner]);
  ping(cityXY(L.capProv >= 0 ? L.capProv : 0), '#ffd76a', '🏳');
  leaveAllWars(loser);
  for (let i = 0; i < NCELL; i++) if (owner[i] === loser) setOwner(i, winner, true);
}
let warsTimer = 0;
function eliminate(ix) {
  const c = C[ix];
  if (!c.alive) return;
  c.alive = false;
  leaveAllWars(ix);
  for (const al of G.alliances) al.members.delete(ix);
  toast(`Страна <b>${esc(c.name)}</b> перестала существовать`, 'war', [ix]);
  if (!warsTimer) warsTimer = setTimeout(() => { warsTimer = 0; warsChanged(); }, 0);
  const mpGame = MP.role === 'host' && MP.humansTotal >= 2;
  if (MP.role === 'host') mpOnEliminated(ix);
  if (ix === PL && mpGame) {
    PL = -1;
  } else if (ix === PL) {
    PL = -1;
    setTimeout(() => modal(`<h2>Ваша страна пала</h2><p>${esc(c.name)} больше не существует. Можно наблюдать за миром или вернуться в меню.</p>
      <div class="actions"><button class="btn" data-a="menu">В главное меню</button><button class="btn" data-a="ok">Наблюдать</button></div>`,
    { menu: () => toMenu() }), 50);
  }
}

// ======================= Сила армий =======================
const powC = new Float64Array(CAP);
function basePow(c) { return c.pc * c.pop * c.popF * G.growth; }
function power0(c) { return basePow(c) * (0.4 + 0.6 * c.morale) * (c.epiUntil > G.dayN ? 0.85 : 1) * c.econ; }
function power(ix) {
  const c = C[ix];
  if (!c || !c.alive) return 0.01;
  let p = power0(c) * c.strMul;
  if (isHuman(ix)) { if (ix === PL) p *= G.D.atk; p *= 1 - 0.03 * C.filter(o => o.aidFrom.has(ix)).length; }
  return Math.max(p + c.aid, 0.01);
}
function updateAid() {
  for (const c of C) {
    c.aid = 0;
    if (!c.alive || !c.enemies) continue;
    for (const s of c.aidFrom) if (C[s].alive && !atWar(s, c.ix)) c.aid += basePow(C[s]) * 0.05;
  }
  for (const c of C) powC[c.ix] = power(c.ix);
}
// Сила страны по шкале 0–100 (логарифмическая: 100 — как у самой сильной державы мира)
const strength = ix => clamp(Math.round(100 * Math.log1p(power(ix)) / Math.log1p(G.pmax)), 0, 100);
function setStrength(ix, v) {
  const c = C[ix];
  const want = Math.expm1(v / 100 * Math.log1p(G.pmax));
  const now = power(ix) / c.strMul;
  c.strMul = Math.max(0.0005, want / Math.max(now, 0.01));
  updateAid();
}
const sidePower = (w, s) => [...w.sides[s]].reduce((t, m) => t + power(m), 0);

// ======================= Симуляция фронта =======================
const RATE = 0.6; // попыток наступления на клетку фронта в день
function intensity(o, e) {
  if (isHuman(o) || isHuman(e)) return 1;
  if (PL >= 0 && (enemyM[PL * CAP + o] || enemyM[PL * CAP + e])) return 0.6;
  return 0.13;
}
function strikeWeak(i, holder) {
  if (!G.strikes.length) return 1;
  const x = i % RW, y = (i / RW) | 0;
  for (const s of G.strikes) if (s.victim === holder && (x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r) return 0.45;
  return 1;
}
function targetBias(i, att, def) {
  let t = G.orders[att];
  if (t == null || owner[cityCell[t]] !== def) { const cp = C[def].capProv; t = cp >= 0 ? cp : null; if (isHuman(att)) t = null; }
  if (t == null) return 1;
  const tc = cityCell[t];
  const d = Math.hypot(i % RW - tc % RW, ((i / RW) | 0) - ((tc / RW) | 0));
  return 1 + (isHuman(att) && G.orders[att] != null ? 3 : 1.2) * Math.exp(-d / 70);
}
function tryCapture(cell, by) {
  const x = cell % RW;
  let cnt = 0;
  for (let dy = -RW; dy <= RW; dy += RW) for (let dx = -1; dx <= 1; dx++) {
    if ((x === 0 && dx < 0) || (x === RW - 1 && dx > 0)) continue;
    const j = cell + dy + dx; if (j >= 0 && j < NCELL && owner[j] === by) cnt++;
  }
  // правило большинства держит линию фронта ровной; города держатся дольше
  const need = cityAtCell.has(cell) ? 5 : 3;
  if ((cnt >= need || (need === 3 && Math.random() < 0.1)) && Math.random() < 0.6) setOwner(cell, by);
}
function simulate(days) {
  let n = WB.length * RATE * days;
  n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  n = Math.min(n, 60000);
  const cand = [0, 0, 0, 0];
  for (let k = 0; k < n && WB.length; k++) {
    const idx = (Math.random() * WB.length) | 0, i = WB[idx], o = owner[i];
    let m = 0;
    if (o !== SEA) {
      const x = i % RW;
      if (x > 0 && owner[i - 1] !== SEA && enemyM[o * CAP + owner[i - 1]]) cand[m++] = i - 1;
      if (x < RW - 1 && owner[i + 1] !== SEA && enemyM[o * CAP + owner[i + 1]]) cand[m++] = i + 1;
      if (i >= RW && owner[i - RW] !== SEA && enemyM[o * CAP + owner[i - RW]]) cand[m++] = i - RW;
      if (i + RW < NCELL && owner[i + RW] !== SEA && enemyM[o * CAP + owner[i + RW]]) cand[m++] = i + RW;
    }
    if (!m) { WB[idx] = WB[WB.length - 1]; WB.pop(); inWB[i] = 0; continue; }
    const j = cand[(Math.random() * m) | 0], e = owner[j];
    if (Math.random() > intensity(o, e)) continue;
    // e атакует клетку i, o — клетку j
    const defO = provCore[provOf[i]] === o ? 1.6 : provCore[provOf[i]] === e ? 0.95 : 1;
    const defE = provCore[provOf[j]] === e ? 1.6 : provCore[provOf[j]] === o ? 0.95 : 1;
    let ae = powC[e] * targetBias(i, e, o) / (defO * strikeWeak(i, o));
    let ao = powC[o] * targetBias(j, o, e) / (defE * strikeWeak(j, e));
    if (o === PL) ae *= G.D.enemy; if (e === PL) ao *= G.D.enemy;
    if (Math.random() < ae / (ae + ao)) tryCapture(i, e); else tryCapture(j, o);
  }
  processCapitulations();
}
function processCapitulations() {
  while (G.pendingCap.length) {
    const [l, w, why] = G.pendingCap.shift();
    if (C[l].alive && C[w].alive) capitulate(l, w, why);
  }
}

// ======================= Соседство стран =======================
let adj = [], adjScan = null;
// проход по растру частями (несколько строк за тик), чтобы не было подвисаний
function adjStep(rows) {
  if (!adjScan) adjScan = { y: 0, sets: [] };
  const sets = adjScan.sets, y1 = Math.min(RH, adjScan.y + rows);
  const add = (a, b) => { (sets[a] || (sets[a] = new Set())).add(b); (sets[b] || (sets[b] = new Set())).add(a); };
  for (let y = adjScan.y; y < y1; y++) {
    const base = y * RW;
    for (let x = 0; x < RW; x++) {
      const i = base + x, o = owner[i]; if (o === SEA) continue;
      const r = x < RW - 1 ? owner[i + 1] : SEA, d = y < RH - 1 ? owner[i + RW] : SEA;
      if (r !== SEA && r !== o) add(o, r);
      if (d !== SEA && d !== o) add(o, d);
    }
  }
  adjScan.y = y1;
  if (y1 >= RH) { adj = sets; adjScan = null; }
}
function computeAdj() { adjScan = null; adjStep(RH); }
const EMPTY = new Set();
const neighborsOf = ix => adj[ix] || EMPTY;

// ======================= Ежедневная логика =======================
function cityXY(pid) { return pid >= 0 ? provXY[pid] : [VW / 2, VH / 2]; }
function nearestCity(fromIx, toXY) {
  let best = -1, bd = Infinity;
  for (let p = 0; p < NP; p++) if (owner[cityCell[p]] === fromIx) {
    const d = Math.hypot(provXY[p][0] - toXY[0], provXY[p][1] - toXY[1]);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
// вероятность события «p в день» за шаг из G.dt дней
const chance = p => Math.random() < (G.dt > 1 ? 1 - Math.pow(1 - Math.min(p, 1), G.dt) : p);
const cosmic = () => G.speed > 365; // «космическая» скорость — больше года в секунду
function dayTick(d = 1) {
  G.dt = d;
  if (G.dayN + d < 2.9e6) G.day = new Date(G.day.getFullYear(), G.day.getMonth(), G.day.getDate() + d);
  G.dayN += d;
  G.growth = Math.min(2.5, G.growth * Math.pow(1.000025, d)); // население растёт, но не бесконечно
  G.strikes = G.strikes.filter(s => s.until > G.dayN);
  for (const c of C) {
    if (!c.alive) continue;
    if (c.econUntil && c.econUntil < G.dayN) { c.econ = 1; c.econUntil = 0; }
    c.bomb *= Math.pow(0.97, d);
    // после бедствий и эпидемий население постепенно восстанавливается
    c.popF = clamp(c.popF + (1 - c.popF) * (1 - Math.pow(0.999, d)), 0.3, 1.5);
    if (c.enemies) {
      const lost = 1 - c.cells / Math.max(1, c.warBase);
      const target = clamp(1 - lost * 1.15 - c.bomb, 0.05, 1);
      c.morale += (target - c.morale) * (1 - Math.pow(0.92, d));
      // сильный натиск — капитуляция
      if (lost > 0.68 && chance(0.08)) {
        let best = -1;
        for (const n of neighborsOf(c.ix)) if (atWar(n, c.ix) && (best < 0 || power(n) > power(best))) best = n;
        if (best < 0) for (const w of warsOf(c.ix)) for (const m of w.sides[1 - inWar(w, c.ix)]) if (best < 0 || power(m) > power(best)) best = m;
        if (best >= 0) G.pendingCap.push([c.ix, best, 'losses']);
      }
    } else { c.warBase = c.cells; c.morale += (1 - c.morale) * (1 - Math.pow(0.97, d)); }
  }
  processCapitulations();
  updateAid();
  navalAndAir();
  aiDiplomacy();
  worldEvents();
  G.dt = 1;
  hudDirty = true;
}

// Морские десанты (если у врагов нет общей границы) и вражеская авиация
function navalAndAir() {
  for (const w of G.wars) for (const a of w.sides[0]) for (const b of w.sides[1]) for (const [x, y] of [[a, b], [b, a]]) {
    if (!C[x].alive || !C[y].alive || neighborsOf(x).has(y)) continue;
    const inten = (isHuman(x) || isHuman(y)) ? 1 : 0.2;
    if (isHuman(x)) continue; // игрок высаживается сам — через «Десант»
    const share = power(x) / (power(x) + power(y));
    if (chance(0.03 * share * inten) && C[x].capProv >= 0) {
      const t = nearestCity(y, cityXY(C[x].capProv));
      if (t < 0) continue;
      const from = nearestCity(x, provXY[t]);
      if (from >= 0) launchFlight(x, from, t, 'para');
    }
  }
  // враги бомбят игроков
  forHumans(() => { for (const w of warsOf(PL)) {
    const s = inWar(w, PL);
    for (const e of w.sides[1 - s]) {
      if (chance(0.03 * Math.min(1, power(e) / power(PL)))) {
        const t = rndCityOf(PL); if (t < 0) continue;
        const from = nearestCity(e, provXY[t]); if (from >= 0) launchFlight(e, from, t, 'strike');
      }
    }
  } });
}
function rndCityOf(ix) {
  const list = []; for (let p = 0; p < NP; p++) if (owner[cityCell[p]] === ix) list.push(p);
  return list.length ? rnd(list) : -1;
}

function aiDiplomacy() {
  const D = G.D;
  // мир между ИИ
  for (const w of [...G.wars]) {
    if ([...w.sides[0], ...w.sides[1]].some(isHuman)) continue;
    const days = G.dayN - w.start;
    const p0 = sidePower(w, 0), p1 = sidePower(w, 1);
    const ruUa = w.name === 'Российско-украинская война';
    let ch = days > 60 ? (ruUa ? 0.0003 : 0.002) : 0;
    if (days > 30 && Math.min(p0, p1) < 0.2 * Math.max(p0, p1)) ch += 0.004;
    if (chance(ch)) endWar(w, `Заключён мир: <b>${esc(w.name)}</b>`);
  }
  const hostNow = PL;
  forHumans(h => humanDiplomacy(h === hostNow));
}
function humanDiplomacy(isHost) {
  const D = G.D;
  // войны против игрока «просто так»
  if (chance(D.aggr)) {
    const cands = [...neighborsOf(PL)].filter(n => C[n].alive && !atWar(n, PL) && !friendly(n, PL) && power(n) > power(PL) * 0.7);
    if (cands.length) {
      const a = rnd(cands);
      declareWar(a, PL);
      if (!cosmic()) modal(`<h2>⚠ Нам объявили войну!</h2><p><b>${esc(C[a].name)}</b> внезапно напала на нашу страну. Готовьте оборону!</p>
        <div class="actions"><button class="btn" data-a="ok">К оружию!</button></div>`);
    }
  }
  // враг ищет союзников или объединяется с другой страной, чтобы нам было тяжелее
  for (const w of warsOf(PL)) {
    if (!chance(0.005)) continue;
    const ps = inWar(w, PL), es = 1 - ps, lead = w.leaders[es];
    if (!C[lead].alive) continue;
    const cands = [];
    for (const c of C) {
      const n = c.ix;
      if (!c.alive || n === PL || inWar(w, n) >= 0 || friendly(n, PL) || power(n) < 40) continue;
      let score = 0;
      if (allied(n, lead)) score += 3;
      if (C[lead].aidFrom.has(n)) score += 2;
      if (rivalsBloc(n, PL)) score += 2;
      if (neighborsOf(lead).has(n)) score += 0.6;
      if (neighborsOf(PL).has(n)) score += 0.4;
      if (score >= 1) cands.push([n, score]);
    }
    if (!cands.length) continue;
    let t = Math.random() * cands.reduce((s, x) => s + x[1], 0), pick = cands[0][0];
    for (const [n, sc] of cands) if ((t -= sc) <= 0) { pick = n; break; }
    if (neighborsOf(lead).has(pick) && power(pick) < power(lead) * 0.6 && !alliancesOf(pick).length && Math.random() < 0.25) {
      say(`<b>${esc(C[pick].name)}</b> и <b>${esc(C[lead].name)}</b> объединились в одно государство против вас!`, 'war', [pick, lead]);
      leaveAllWars(pick);
      for (let i = 0; i < NCELL; i++) if (owner[i] === pick) setOwner(i, lead, true);
      warsChanged();
    } else {
      joinWar(w, es, pick, 'союз против вас');
      warsChanged();
    }
  }
  // ИИ сам предлагает союз игроку
  if (isHost && !MP.live && !G.modalOpen && !cosmic() && chance((C[PL].enemies ? 0.005 : 0.0015))) {
    const cands = C.filter(c => c.alive && c.ix !== PL && !allied(c.ix, PL) && !atWar(c.ix, PL) && !rivalsBloc(c.ix, PL)
      && (neighborsOf(PL).has(c.ix) || [...Array(C.length).keys()].some(e => atWar(e, PL) && atWar(e, c.ix))));
    if (cands.length) {
      const c = rnd(cands);
      modal(`<h2>🤝 Предложение союза</h2><div class="center">${flagTag(c.ix, 'big')}</div>
        <p><b>${esc(c.name)}</b> предлагает заключить военный союз с нашей страной.</p>
        <div class="actions"><button class="btn" data-a="no">Отказаться</button><button class="btn" data-a="yes">Принять союз</button></div>`,
      { yes: () => formAlliance(c.ix), no: () => toast(`Вы отклонили союз с ${esc(c.name)}`) });
    }
  }
  // бывшие владельцы пытаются вернуть отколовшиеся территории
  for (const c of C) {
    if (!c.alive || !c.reclaimDay || G.dayN < c.reclaimDay) continue;
    c.reclaimDay = 0;
    const parent = C[c.breakFrom];
    if (parent && parent.alive && !isHuman(c.breakFrom) && !atWar(c.ix, c.breakFrom) && power(c.breakFrom) > power(c.ix)) declareWar(c.breakFrom, c.ix);
  }
}

// ======================= Живой мир: события =======================
const EPIDEMICS = ['Птичий грипп H5N1', 'Лихорадка Марбург', 'Холера', 'Новый коронавирус', 'Лихорадка денге', 'Мпокс', 'Лихорадка Эбола'];
const DISASTERS = [['Землетрясение', '🌋'], ['Наводнение', '🌊'], ['Ураган', '🌀'], ['Лесные пожары', '🔥'], ['Засуха', '☀'], ['Извержение вулкана', '🌋'], ['Цунами', '🌊']];
function worldEvents() {
  const alive = C.filter(c => c.alive);
  const rpop = () => { let t = Math.random() * alive.reduce((s, c) => s + c.pop, 0); for (const c of alive) if ((t -= c.pop) <= 0) return c; return alive[0]; };
  // Эпидемия
  if (!G.epi && chance(1 / 220)) {
    const c = rpop();
    G.epi = { name: rnd(EPIDEMICS), infected: new Set([c.ix]) };
    c.epiUntil = G.dayN + 40 + Math.random() * 80;
    toast(`☣ Вспышка заболевания <b>${esc(G.epi.name)}</b> в стране ${esc(c.name)}!`, 'war', [c.ix]);
    ping(cityXY(c.capProv), '#7dff6a', '☣');
  }
  if (G.epi) {
    for (const ix of [...G.epi.infected]) {
      const c = C[ix];
      if (!c.alive || c.epiUntil < G.dayN) { G.epi.infected.delete(ix); forHumans(h => { if (h === ix) say('Эпидемия в нашей стране закончилась', 'good'); }); continue; }
      c.popF *= Math.pow(0.99994, G.dt);
      for (const n of neighborsOf(ix)) if (!G.epi.infected.has(n) && C[n].epiUntil < G.dayN && chance(0.012)) infect(n);
      if (chance(0.002)) infect(rpop().ix); // авиаперелёты
    }
    if (!G.epi.infected.size) { toast(`Эпидемия «${esc(G.epi.name)}» побеждена`, 'good'); G.epi = null; }
  }
  // Стихийные бедствия
  if (chance(1 / 35)) {
    const pid = Math.floor(Math.random() * NP), c = C[owner[cityCell[pid]]];
    const [kind, icon] = rnd(DISASTERS);
    const dead = Math.round(20 + Math.random() ** 3 * 8000);
    c.popF *= 1 - dead / Math.max(c.pop, 1);
    toast(`${icon} ${kind} у города ${esc(P[pid].name)} (${esc(c.name)}): погибших — ${fmtNum(dead)}`, c.ix === PL ? 'war' : '', [c.ix]);
    ping(provXY[pid], '#ffb347', icon);
  }
  // Экономика
  if (chance(1 / 80)) {
    const c = rpop(), crisis = Math.random() < 0.55;
    c.econ = crisis ? 0.86 : 1.12; c.econUntil = G.dayN + 120 + Math.random() * 120;
    toast(crisis ? `📉 Экономический кризис в стране ${esc(c.name)}` : `📈 Экономический бум в стране ${esc(c.name)}`, crisis && c.ix === PL ? 'war' : 'good', [c.ix]);
  }
  // Выборы и перевороты
  if (chance(1 / 45)) {
    const c = rnd(alive.filter(x => !isHuman(x.ix) && (!META.leaders[x.id] || Math.random() < 0.15)));
    if (c) {
      const coup = (c.cont === 'Africa' || c.cont === 'Asia') && Math.random() < 0.3;
      c.leader = META.randomLeader(c.id || 'XX', c.cont);
      toast(coup ? `🎖 Военный переворот в стране ${esc(c.name)}! Власть захватил генерал ${esc(c.leader)}`
        : `🗳 Выборы в стране ${esc(c.name)}: победил ${esc(c.leader)}`, coup ? 'war' : '', [c.ix]);
      if (coup) c.morale = 0.7;
    }
  }
  // Сепаратисты
  if (chance(1 / 420)) {
    const c = rnd(alive.filter(x => !isHuman(x.ix) && x.cities >= 6));
    if (c) {
      const cities = []; for (let p = 0; p < NP; p++) if (owner[cityCell[p]] === c.ix && p !== c.capProv) cities.push(p);
      if (cities.length) {
        const p = rnd(cities);
        const n = declareIndependence(p, 'Республика ' + P[p].name, makeFlag(P[p].name), false, true);
        if (n && Math.random() < 0.5) declareWar(c.ix, n.ix);
      }
    }
  }
  // Конфликты в горячих точках
  if (chance(1 / 260)) {
    const pairs = META.tensions.map(([a, b]) => [isoIx[a], isoIx[b]]).filter(([a, b]) => a != null && b != null && C[a].alive && C[b].alive && !atWar(a, b) && !isHuman(a) && !isHuman(b));
    if (pairs.length) { const [a, b] = rnd(pairs); declareWar(a, b); }
  }
}
function infect(ix) {
  const c = C[ix];
  if (!c.alive || !G.epi) return;
  G.epi.infected.add(ix);
  c.epiUntil = G.dayN + 40 + Math.random() * 90;
  if (isHuman(ix)) forHumans(h => { if (h === ix) say(`☣ ${esc(G.epi.name)} добрался до нашей страны!`, 'war', [ix]); });
  else if (c.pop > 5e7) toast(`☣ ${esc(G.epi.name)} добрался до страны ${esc(c.name)}`, '', [ix]);
}

// ======================= Союзы =======================
function allianceChance(t) {
  if (atWar(t, PL)) return 0;
  let s = 0.22 + G.D.accept;
  if (rivalsBloc(t, PL)) s -= 0.6;
  s += clamp(Math.log10(power(PL) / power(t)) * 0.2, -0.25, 0.3);
  for (let e = 0; e < C.length; e++) {
    if (atWar(e, PL) && atWar(e, t)) s += 0.45;          // общий враг
    if (allied(e, PL) && atWar(e, t)) s -= 0.6;          // воюет с нашим союзником
  }
  if (neighborsOf(PL).has(t)) s += 0.05;
  if (C[PL].enemies && !C[t].enemies) s -= 0.12;          // не хотят ввязываться в чужую войну
  return clamp(s, 0.02, 0.95);
}
function proposeAlliance(t) {
  const ok = Math.random() < allianceChance(t);
  if (ok) formAlliance(t);
  else {
    say(`<b>${esc(C[t].name)}</b> отказалась от союза`, 'war', [t]);
    modal(`<h2>Отказ</h2><div class="center">${flagTag(t, 'big')}</div><p><b>${esc(C[t].name)}</b> отклонила предложение о союзе.</p>
      <div class="actions"><button class="btn" data-a="ok">Понятно</button></div>`);
  }
}
function formAlliance(t) {
  let al = G.alliances.find(a => a.mine) || alliancesOf(PL)[0];
  if (!al) { al = { name: 'Союз ' + C[PL].name, members: new Set([PL]), mine: true }; G.alliances.push(al); }
  for (const a of alliancesOf(t)) if (META.rivals.some(([x, y]) => (x === a.name && alliancesOf(PL).some(b => b.name === y)) || (y === a.name && alliancesOf(PL).some(b => b.name === x)))) a.members.delete(t);
  al.members.add(t);
  toast(`🤝 <b>${esc(C[t].name)}</b> вступила в союз «${esc(al.name)}»!`, 'good', [t, PL]);
  // новый союзник вступает в наши войны
  for (const w of warsOf(PL)) { const s = inWar(w, PL); if (inWar(w, t) < 0 && ![...w.sides[1 - s]].some(e => allied(e, t))) joinWar(w, s, t, 'союзный долг'); }
  warsChanged();
}
function breakAlliance(t) {
  for (const al of G.alliances) if (al.members.has(t) && al.members.has(PL)) (al.mine ? al.members.delete(t) : al.members.delete(PL));
  say(`Союз с <b>${esc(C[t].name)}</b> расторгнут`, 'war', [t]);
  renderHud();
}

// ======================= Самолёты, десант, приказы =======================
function launchFlight(by, fromPid, toPid, kind) {
  G.flights.push({ by, from: provXY[fromPid], to: provXY[toPid], target: toPid, kind, t: 0, victim: owner[cityCell[toPid]] });
}
function flightArrived(f) {
  const victim = owner[cityCell[f.target]];
  if (!atWar(f.by, victim)) return;
  const [x, y] = [f.to[0] * RS, f.to[1] * RS];
  if (f.kind === 'strike') {
    G.strikes.push({ x, y, r: 18, until: G.dayN + 20, victim });
    C[victim].bomb += 0.05;
    C[victim].popF *= 0.99995;
    ping(f.to, '#ff7b39', '💥');
    forHumans(() => {
      if (f.by === PL) say(`✈ Авиаудар по городу <b>${esc(P[f.target].name)}</b> — оборона ослаблена`, 'good', [victim]);
      else if (victim === PL) say(`💥 Вражеская авиация бомбит город <b>${esc(P[f.target].name)}</b>`, 'war', [f.by]);
    });
  } else {
    const share = power(f.by) / (power(f.by) + power(victim));
    if (Math.random() < 0.25 + 0.7 * share) {
      captureBlob(cityCell[f.target], f.by, 4, victim);
      ping(f.to, '#9fd3ff', '🪂');
      forHumans(() => { if (f.by === PL || victim === PL) say(`🪂 Десант ${esc(C[f.by].name)} высадился у города <b>${esc(P[f.target].name)}</b>`, f.by === PL ? 'good' : 'war', [f.by]); });
      warsChanged();
    } else forHumans(() => { if (f.by === PL) say(`Десант у города ${esc(P[f.target].name)} уничтожен`, 'war', [victim]); });
  }
}
function playerFlight(pid, kind) {
  const mine = G.flights.filter(f => f.by === PL).length;
  if (mine >= 3) return say('Все самолёты в воздухе — подождите их возвращения', 'war');
  const from = nearestCity(PL, provXY[pid]);
  if (from < 0) return;
  launchFlight(PL, from, pid, kind);
  say(kind === 'strike' ? `✈ Самолёты вылетели на город ${esc(P[pid].name)}` : `🪂 Транспортники с десантом летят к городу ${esc(P[pid].name)}`, 'good');
}

// ======================= Холст и масштаб =======================
const cv = $('#map'), ctx = cv.getContext('2d');
let DPR = 1, cssW = 1, cssH = 1, s0 = 1, ox = 0, oy = 0, zt = d3.zoomIdentity;
const zoom = d3.zoom().scaleExtent([1, 60]).on('zoom', e => { zt = e.transform; needDraw = true; });
d3.select(cv).call(zoom).on('dblclick.zoom', null);
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cssW = cv.clientWidth || innerWidth; cssH = cv.clientHeight || innerHeight;
  cv.width = Math.round(cssW * DPR); cv.height = Math.round(cssH * DPR);
  s0 = Math.min(cssW / VW, cssH / VH);
  ox = (cssW - VW * s0) / 2; oy = (cssH - VH * s0) / 2;
  needDraw = true; globe.dirty = true;
  zoom.extent([[0, 0], [cssW, cssH]]).translateExtent([[ox - 80, oy - 80], [ox + VW * s0 + 80, oy + VH * s0 + 80]]);
}
window.addEventListener('resize', () => { resize(); if (G) renderHud(); });
const toScreen = (x, y) => [zt.x + zt.k * (ox + x * s0), zt.y + zt.k * (oy + y * s0)];
const toMap = (sx, sy) => [((sx - zt.x) / zt.k - ox) / s0, ((sy - zt.y) / zt.k - oy) / s0];
function cellFromEvent(e) {
  const r = cv.getBoundingClientRect();
  if (globe.on) return globeCell(e.clientX - r.left, e.clientY - r.top);
  const [x, y] = toMap(e.clientX - r.left, e.clientY - r.top);
  if (x < 0 || y < 0 || x >= VW || y >= VH) return -1;
  return cellAt(x * RS, y * RS);
}
function focusCountry(ix) {
  const cap = C[ix].capProv >= 0 ? provXY[C[ix].capProv] : null;
  const pts = [];
  for (let p = 0; p < NP; p++) if (owner[cityCell[p]] === ix && (!cap || Math.hypot(provXY[p][0] - cap[0], provXY[p][1] - cap[1]) < 260)) pts.push(provXY[p]);
  if (!pts.length) return;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
  const k = clamp(0.6 / Math.max((x1 - x0) / VW, (y1 - y0) / VH), 1, 12);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const t = d3.zoomIdentity.translate(cssW / 2 - k * (ox + cx * s0), cssH / 2 - k * (oy + cy * s0)).scale(k);
  d3.select(cv).transition().duration(900).call(zoom.transform, t);
}

// ======================= Глобус («макет Земли») =======================
// Если отдалить карту до упора, она превращается в вращаемый глобус.
const globe = { on: false, lon: 30, lat: 30, zoom: 1.3, dirty: true, pending: false, moved: false, drag: null, lastRender: 0, intent: 0 };
const LW = 1440, LH = 720, D2R = Math.PI / 180;
let LUT = null; // равнопромежуточная текстура → клетка растра
function buildLUT() {
  LUT = new Int32Array(LW * LH);
  for (let v = 0; v < LH; v++) {
    const lat = 90 - (v + 0.5) * 180 / LH;
    for (let u = 0; u < LW; u++) {
      const pp = projection([-180 + (u + 0.5) * 360 / LW, lat]);
      LUT[v * LW + u] = pp ? cellAt(pp[0] * RS, pp[1] * RS) : -1;
    }
  }
}

// ---------- Дрейф материков ----------
// Плиты и их полюса вращения (приблизительно по модели NNR-MORVEL56): [широта, долгота, градусов за млн лет]
const PLATES = [
  { id: 0, name: 'Евразийская', pole: [48.85, -106.5, 0.223] },
  { id: 1, name: 'Северо-Американская', pole: [-4.85, -80.64, 0.209] },
  { id: 2, name: 'Южно-Американская', pole: [-22.62, -112.83, 0.109] },
  { id: 3, name: 'Африканская', pole: [47.68, -68.44, 0.292] },
  { id: 4, name: 'Аравийская', pole: [48.88, -8.49, 0.559] },
  { id: 5, name: 'Индийская', pole: [50.37, -3.29, 0.544] },
  { id: 6, name: 'Австралийская', pole: [33.86, 37.94, 0.632] },
  { id: 7, name: 'Тихоокеанская', pole: [-63.58, 114.7, 0.651] },
];
const PLATE_OF_ISO = {};
'IN PK BD NP BT LK MV'.split(' ').forEach(c => (PLATE_OF_ISO[c] = 5));
'SA YE OM AE QA KW BH JO IQ SY'.split(' ').forEach(c => (PLATE_OF_ISO[c] = 4));
'AU PG NZ SB VU'.split(' ').forEach(c => (PLATE_OF_ISO[c] = 6));
const CONT_PLATE = { Europe: 0, Asia: 0, Africa: 3, 'North America': 1, 'South America': 2, Oceania: 6, Antarctica: 7 };
const provPlate = Uint8Array.from(P, p => {
  if (p.core === 'DK' && p.lon < -10) return 1;            // Гренландия
  if (p.core === 'US' && p.lon < -150 && p.lat < 30) return 7; // Гавайи
  if (PLATE_OF_ISO[p.core] != null) return PLATE_OF_ISO[p.core];
  const c = W.countries[p.core];
  return CONT_PLATE[c && c.cont] != null ? CONT_PLATE[c.cont] : 0;
});
let plateTex = null;
function buildPlateTex() {
  if (!LUT) buildLUT();
  plateTex = new Uint8Array(LW * LH).fill(255);
  for (let t = 0; t < LUT.length; t++) { const c = LUT[t]; if (c >= 0 && provOf[c] !== SEA) plateTex[t] = provPlate[provOf[c]]; }
}
const driftMyr = () => G ? G.dayN / 365.2425 / 1e6 : 0;
function rotMatrix(pole, deg) { // поворот вокруг оси полюса (формула Родрига)
  const la = pole[0] * D2R, lo = pole[1] * D2R;
  const x = Math.cos(la) * Math.cos(lo), y = Math.cos(la) * Math.sin(lo), z = Math.sin(la);
  const a = deg * D2R, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
          t * x * y + s * z, t * y * y + c, t * y * z - s * x,
          t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
function driftLL(ll, plate) { // сдвинуть точку вместе с её плитой
  const my = driftMyr(); if (my < 0.05) return ll;
  const M = rotMatrix(PLATES[plate].pole, PLATES[plate].pole[2] * my);
  const la = ll[1] * D2R, lo = ll[0] * D2R;
  const x = Math.cos(la) * Math.cos(lo), y = Math.cos(la) * Math.sin(lo), z = Math.sin(la);
  const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
  return [Math.atan2(Y, X) / D2R, Math.asin(clamp(Z, -1, 1)) / D2R];
}
const driftKm = () => Math.round(driftMyr() * 0.4 * 111); // для подсказки: средний сдвиг (~0.4°/млн лет)
const gbCv = document.createElement('canvas'), gbCtx = gbCv.getContext('2d');
let gbImg = null, gbPix = null;
const STARS = Array.from({ length: 180 }, () => [Math.random(), Math.random(), 0.15 + Math.random() * 0.6]);
const globeR = () => Math.min(cssW, cssH) * 0.42 * globe.zoom;
function globeBasis() {
  const l = globe.lon * D2R, p = globe.lat * D2R, cl = Math.cos(l), sl = Math.sin(l), cp = Math.cos(p), sp = Math.sin(p);
  return [-sl, cl, 0, -sp * cl, -sp * sl, cp, cp * cl, cp * sl, sp]; // восток, север, на зрителя
}
function globeCell(sx, sy) {
  const R = globeR(), x = (sx - cssW / 2) / R, y = -(sy - cssH / 2) / R, r2 = x * x + y * y;
  if (r2 > 1) return -1;
  if (!LUT) buildLUT();
  const B = globeBasis(), z = Math.sqrt(1 - r2);
  const wx = x * B[0] + y * B[3] + z * B[6], wy = x * B[1] + y * B[4] + z * B[7], wz = y * B[5] + z * B[8];
  const u = Math.min(LW - 1, ((Math.atan2(wy, wx) / Math.PI + 1) * 0.5 * LW) | 0);
  const v = Math.min(LH - 1, ((0.5 - Math.asin(clamp(wz, -1, 1)) / Math.PI) * LH) | 0);
  return LUT[v * LW + u];
}
function renderGlobeTex() {
  if (!LUT) buildLUT();
  const myr = driftMyr(), drifting = myr >= 0.05;
  const Dm = Math.max(64, Math.min(Math.round(2 * globeR() * DPR), globe.drag ? 400 : drifting ? 520 : 760));
  let inv = null;
  if (drifting) {
    if (!plateTex) buildPlateTex();
    inv = PLATES.map(pl => rotMatrix(pl.pole, -pl.pole[2] * myr)); // обратный поворот каждой плиты
  }
  let lastPl = 0;
  if (gbCv.width !== Dm) { gbCv.width = gbCv.height = Dm; gbImg = gbCtx.createImageData(Dm, Dm); gbPix = new Uint32Array(gbImg.data.buffer); }
  const B = globeBasis(), h = Dm / 2;
  for (let py = 0; py < Dm; py++) {
    const y = -(py + 0.5 - h) / h, row = py * Dm;
    for (let px = 0; px < Dm; px++) {
      const x = (px + 0.5 - h) / h, r2 = x * x + y * y;
      if (r2 > 1) { gbPix[row + px] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      const wx = x * B[0] + y * B[3] + z * B[6], wy = x * B[1] + y * B[4] + z * B[7], wz = y * B[5] + z * B[8];
      let cell = -1;
      if (!drifting) {
        let u = ((Math.atan2(wy, wx) / Math.PI + 1) * 0.5 * LW) | 0; if (u >= LW) u = LW - 1;
        const v = ((0.5 - Math.asin(wz > 1 ? 1 : wz) / Math.PI) * LH) | 0;
        cell = LUT[v * LW + u];
      } else {
        for (let q = 0; q < 8; q++) {
          const pl = q === 0 ? lastPl : (q <= lastPl ? q - 1 : q);
          const M = inv[pl];
          const X = M[0] * wx + M[1] * wy + M[2] * wz, Y = M[3] * wx + M[4] * wy + M[5] * wz, Z = M[6] * wx + M[7] * wy + M[8] * wz;
          let u = ((Math.atan2(Y, X) / Math.PI + 1) * 0.5 * LW) | 0; if (u >= LW) u = LW - 1;
          const v = ((0.5 - Math.asin(Z > 1 ? 1 : Z < -1 ? -1 : Z) / Math.PI) * LH) | 0;
          const t = v * LW + u;
          if (plateTex[t] === pl) { cell = LUT[t]; lastPl = pl; break; }
        }
      }
      const col = cell >= 0 ? (bpix[cell] || pix[cell]) : 0;
      const sh = 0.45 + 0.55 * z; // освещение — объём шара
      let r = 28, g = 58, b = 84;
      if (col) { r = col & 255; g = (col >> 8) & 255; b = (col >> 16) & 255; }
      gbPix[row + px] = (0xff000000 | ((b * sh) << 16) | ((g * sh) << 8) | (r * sh)) >>> 0;
    }
  }
  gbCtx.putImageData(gbImg, 0, 0);
  globe.dirty = false; globe.pending = false;
}
function drawGlobe(now) {
  if (anyDirty) { flushTiles(); globe.pending = true; }
  if (labelsDirty && now - lastLabels > 1500) { computeLabels(); lastLabels = now; }
  if (G.speed > 365e3 && !G.paused && now - globe.lastRender > 300) globe.pending = true;
  if (globe.dirty || (globe.pending && now - globe.lastRender > 300)) { renderGlobeTex(); globe.lastRender = now; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04070c'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const st of STARS) { ctx.fillStyle = `rgba(255,255,255,${st[2]})`; ctx.fillRect(st[0] * cssW, st[1] * cssH, 1.3, 1.3); }
  const R = globeR(), cx = cssW / 2, cy = cssH / 2;
  const atm = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
  atm.addColorStop(0, 'rgba(100,180,255,.5)'); atm.addColorStop(1, 'rgba(100,180,255,0)');
  ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, 7); ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gbCv, cx - R, cy - R, 2 * R, 2 * R);
  const op = d3.geoOrthographic().translate([cx, cy]).scale(R).rotate([-globe.lon, -globe.lat]).clipAngle(90);
  ctx.beginPath(); d3.geoPath(op, ctx)(d3.geoGraticule10());
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 0.7; ctx.stroke();
  // столицы и названия стран
  const center = [globe.lon, globe.lat];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const L of countryLabels) {
    let ll = projection.invert([L.x, L.y]);
    if (!ll) continue;
    const lc = cellAt(L.x * RS, L.y * RS);
    if (provOf[lc] !== SEA) ll = driftLL(ll, provPlate[provOf[lc]]);
    if (d3.geoDistance(ll, center) > 1.35) continue;
    const px = Math.min(28, L.fs * R / 260);
    if (px < 9) continue;
    const [x, y] = op(ll);
    ctx.font = `700 ${px.toFixed(1)}px "Segoe UI", Arial, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(L.name, x, y);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(L.name, x, y);
  }
  for (const c of C) {
    if (!c.alive || c.capProv < 0 || (R < 230 && c.ix !== PL)) continue;
    const p = P[c.capProv], ll = driftLL([p.lon, p.lat], provPlate[c.capProv]);
    if (d3.geoDistance(ll, center) > 1.5) continue;
    const [x, y] = op(ll);
    ctx.beginPath(); ctx.arc(x, y, c.ix === PL ? 3.5 : 2.2, 0, 7);
    ctx.fillStyle = c.ix === PL ? '#ffd23f' : '#d4a94a'; ctx.fill();
  }
  // самолёты над глобусом
  const my = driftMyr();
  const hint = my >= 0.05 ? `🌍 Дрейф материков: прошло ${my.toFixed(my < 10 ? 2 : 0).replace('.', ',')} млн лет, плиты сдвинулись на ~${fmtNum(driftKm())} км · колёсико вперёд — к карте`
    : '🌍 Тяните мышью, чтобы вращать Землю · колёсико вперёд — вернуться к карте · ⋯ — космическая скорость';
  if (globe.hintText !== hint) { globe.hintText = hint; $('#globe-hint').textContent = hint; }
  for (const f of G.flights) {
    const a = projection.invert(f.from), b = projection.invert(f.to);
    if (!a || !b) continue;
    const m = d3.geoInterpolate(a, b)(Math.min(1, f.t));
    if (d3.geoDistance(m, center) > 1.5) continue;
    const [x, y] = op(m);
    ctx.font = '16px "Segoe UI Emoji", sans-serif'; ctx.fillStyle = f.by === PL ? '#9fd3ff' : '#ff8577'; ctx.fillText('✈', x, y);
  }
}
function enterGlobe() {
  const [mx, my] = toMap(cssW / 2, cssH / 2);
  const ll = projection.invert([clamp(mx, 1, VW - 1), clamp(my, 1, VH - 1)]);
  if (ll && isFinite(ll[0])) { globe.lon = ll[0]; globe.lat = clamp(ll[1], -60, 70); }
  globe.on = true; globe.zoom = 1.25; globe.dirty = true; needDraw = true;
  d3.select(cv).on('.zoom', null);
  cv.classList.add('globe'); $('#globe-hint').classList.remove('hidden');
  hideOverlays();
  syncSpeedUI(); renderTime();
}
function exitGlobe(silent) {
  globe.on = false; globe.drag = null;
  cv.classList.remove('globe'); $('#globe-hint').classList.add('hidden');
  d3.select(cv).call(zoom).on('dblclick.zoom', null);
  if (G && G.paint) d3.select(cv).on('mousedown.zoom', null);
  needDraw = true;
  // вернулись на Землю — космическая скорость больше недоступна
  if (G && G.speed > 100) { G.speed = 100; say('Вы вернулись к карте — скорость снижена до 100×'); }
  if (G) { syncSpeedUI(); renderTime(); }
  if (silent) return;
  // возвращаемся в обычную карту — в то место, куда повернули Землю
  const pp = projection([globe.lon, globe.lat]) || [VW / 2, VH / 2], k = 2;
  d3.select(cv).call(zoom.transform, d3.zoomIdentity.translate(cssW / 2 - k * (ox + pp[0] * s0), cssH / 2 - k * (oy + pp[1] * s0)).scale(k));
}
cv.addEventListener('wheel', e => {
  if (!G) return;
  if (globe.on) {
    e.preventDefault(); e.stopImmediatePropagation();
    globe.zoom *= Math.exp(-e.deltaY * 0.0015);
    if (globe.zoom > 2.2) return exitGlobe();
    globe.zoom = Math.max(0.45, globe.zoom); globe.dirty = true; needDraw = true;
    return;
  }
  if (zt.k <= 1.001 && e.deltaY > 0) { globe.intent += e.deltaY; if (globe.intent > 240) { globe.intent = 0; enterGlobe(); } }
  else globe.intent = 0;
}, { capture: true, passive: false });
cv.addEventListener('mousedown', e => { if (globe.on && e.button === 0) { globe.drag = [e.clientX, e.clientY]; globe.moved = false; } });
window.addEventListener('mousemove', e => {
  if (!globe.on || !globe.drag) return;
  const dx = e.clientX - globe.drag[0], dy = e.clientY - globe.drag[1];
  if (Math.abs(dx) + Math.abs(dy) > 3) globe.moved = true;
  const R = globeR();
  globe.lon = ((globe.lon - dx / R / D2R + 540) % 360) - 180;
  globe.lat = clamp(globe.lat + dy / R / D2R, -85, 85);
  globe.drag = [e.clientX, e.clientY];
  globe.dirty = true; needDraw = true;
});
window.addEventListener('mouseup', () => {
  if (globe.drag) { globe.drag = null; globe.dirty = true; needDraw = true; } // перерисовать в полном качестве
  setTimeout(() => (globe.moved = false), 0);
});

// ======================= Творческий режим и империя =======================
function takeCountry(t) {
  const name = C[t].name;
  leaveAllWars(t);
  for (let i = 0; i < NCELL; i++) if (owner[i] === t) setOwner(i, PL, true);
  warsChanged();
  toast(`🏴 Страна <b>${esc(name)}</b> теперь ваша`, 'good', [PL]);
}
function makeVassal(t) {
  const c = C[t];
  c.overlord = PL; c.origColor = c.origColor || c.color;
  // вассалы окрашиваются в оттенок цвета сюзерена — как в HOI4
  const h = d3.hsl(C[PL].color); h.l = clamp(h.l + 0.18, 0.3, 0.8); h.s *= 0.8; h.h += (hashStr(c.id) % 30) - 15;
  setColor(c, h.formatHex());
  for (const w of warsOf(t)) if (inWar(w, PL) >= 0 && inWar(w, PL) !== inWar(w, t)) leaveAllWars(t);
  warsChanged();
  toast(`👑 <b>${esc(c.name)}</b> стала вассалом страны ${esc(C[PL].name)}`, 'good', [t, PL]);
}
function releaseVassal(t) {
  const c = C[t];
  c.overlord = -1; if (c.origColor) setColor(c, c.origColor);
  recolorAll();
  toast(`<b>${esc(c.name)}</b> снова независима`, '', [t]);
}
const vassalsOf = ix => C.filter(c => c.alive && c.overlord === ix);
function orderAttack(actor, target) {
  const a = C[actor];
  if (actor === target || atWar(actor, target)) return toast(`${esc(a.name)} уже воюет с этой страной`, 'war');
  if (target === PL || allied(target, actor) || C[target].overlord === PL) return toast('Нельзя натравить на себя или своих', 'war');
  const obey = G.creative || a.overlord === PL || (power(actor) > power(target) * 0.6 && Math.random() < 0.6);
  if (!obey) return toast(`<b>${esc(a.name)}</b> отказывается нападать на ${esc(C[target].name)}`, 'war', [actor]);
  declareWar(actor, target);
}
function strengthDialog(t) {
  const v0 = strength(t);
  modal(`<h2>💪 Сила страны</h2><div class="p-head">${flagTag(t, 'small')}<b>${esc(C[t].name)}</b></div>
    <p>0 — армии нет, 100 — как у самой сильной державы мира.</p>
    <div class="str-row"><input type="range" id="str-range" min="0" max="100" value="${v0}"><b id="str-val">${v0}</b></div>
    <div class="actions"><button class="btn" data-a="cancel">Отмена</button><button class="btn" data-a="ok">Применить</button></div>`,
  { ok: () => { setStrength(t, +$('#str-range').value); renderHud(); toast(`Сила страны ${esc(C[t].name)}: <b>${strength(t)}/100</b>`, 'good', [t]); } },
  () => { $('#str-range').oninput = e => ($('#str-val').textContent = e.target.value); });
}
function empireDialog() {
  const c = C[PL];
  modal(`<h2>👑 Провозгласить империю</h2><p>Ваша страна станет империей. Делайте другие страны вассалами — они будут воевать за вас.</p>
    <div class="row"><input id="emp-name" type="text" maxlength="40" value="${esc(c.empire ? c.name : 'Империя ' + c.name)}"></div>
    <div class="actions"><button class="btn" data-a="cancel">Отмена</button><button class="btn" data-a="ok">Провозгласить</button></div>`,
  { ok: () => {
    const n = $('#emp-name').value.trim(); if (!n) return;
    c.name = n; c.empire = true; labelsDirty = true; needDraw = true; renderHud();
    toast(`👑 Провозглашена <b>${esc(n)}</b>!`, 'good', [PL]);
  } }, () => $('#emp-name').select());
}

// Закрашивание: кисть перекрашивает только клетки выбранной страны
let painting = false, lastPaint = null;
function startPaint(t) {
  G.paint = { target: t, size: G.paint ? G.paint.size : 14 };
  d3.select(cv).on('mousedown.zoom', null).on('touchstart.zoom', null);
  cv.classList.add('painting');
  const b = $('#mode-banner');
  b.innerHTML = `🖌 Закрашивание: <b>${esc(C[t].name)}</b> — зажмите ЛКМ и водите. За границей страны кисть не красит.<br>
    <small>Кисть: <input type="range" id="brush" min="3" max="60" value="${G.paint.size}"> · колёсико — масштаб · Esc — выход</small>
    <button class="btn small" id="paint-done">Готово</button>`;
  b.classList.remove('hidden');
  $('#brush').oninput = e => (G.paint.size = +e.target.value);
  $('#paint-done').onclick = stopPaint;
}
function stopPaint() {
  if (!G || !G.paint) return;
  G.paint = null; painting = false;
  d3.select(cv).call(zoom).on('dblclick.zoom', null);
  cv.classList.remove('painting');
  $('#mode-banner').classList.add('hidden');
}
function paintAt(sx, sy) {
  const t = G.paint.target;
  if (!C[t].alive) return stopPaint();
  const [mx, my] = toMap(sx, sy);
  const cx = mx * RS, cy = my * RS, r = G.paint.size / 2 / (zt.k * s0) * RS;
  const r2 = r * r, ir = Math.ceil(r);
  for (let dy = -ir; dy <= ir; dy++) for (let dx = -ir; dx <= ir; dx++) {
    if (dx * dx + dy * dy > r2) continue;
    const x = Math.round(cx + dx), y = Math.round(cy + dy);
    if (x < 0 || y < 0 || x >= RW || y >= RH) continue;
    const j = y * RW + x;
    if (owner[j] === t) setOwner(j, PL, true);
  }
}
cv.addEventListener('mousedown', e => {
  if (!G || !G.paint || e.button !== 0 || globe.on) return;
  painting = true;
  const r = cv.getBoundingClientRect();
  lastPaint = [e.clientX - r.left, e.clientY - r.top];
  paintAt(...lastPaint);
});
window.addEventListener('mousemove', e => {
  if (!painting || !G || !G.paint) return;
  const r = cv.getBoundingClientRect();
  const p = [e.clientX - r.left, e.clientY - r.top];
  const d = Math.hypot(p[0] - lastPaint[0], p[1] - lastPaint[1]), step = Math.max(2, G.paint.size / 3);
  for (let k = step; k < d; k += step) paintAt(lastPaint[0] + (p[0] - lastPaint[0]) * k / d, lastPaint[1] + (p[1] - lastPaint[1]) * k / d);
  paintAt(...p);
  lastPaint = p;
});
window.addEventListener('mouseup', () => { painting = false; });

// ======================= Подписи стран и стрелки =======================
let countryLabels = [];
function computeLabels() {
  const n = C.length, sx = new Float64Array(n), sy = new Float64Array(n), cnt = new Float64Array(n);
  const ST = 3;
  for (let y = 1; y < RH; y += ST) for (let x = 1; x < RW; x += ST) {
    const o = owner[y * RW + x]; if (o === SEA) continue;
    sx[o] += x; sy[o] += y; cnt[o]++;
  }
  const need = [];
  const res = [];
  for (let o = 0; o < n; o++) {
    if (!cnt[o] || !C[o].alive) continue;
    const L = { ix: o, x: sx[o] / cnt[o], y: sy[o] / cnt[o], cnt: cnt[o], bd: Infinity };
    if (owner[cellAt(L.x, L.y)] !== o) need.push(L);
    res.push(L);
  }
  if (need.length) {
    const byIx = new Map(need.map(L => [L.ix, L]));
    for (let y = 1; y < RH; y += ST) for (let x = 1; x < RW; x += ST) {
      const L = byIx.get(owner[y * RW + x]); if (!L) continue;
      const d = (x - L.x) ** 2 + (y - L.y) ** 2;
      if (d < L.bd) { L.bd = d; L.nx = x; L.ny = y; }
    }
    for (const L of need) { L.x = L.nx; L.y = L.ny; }
  }
  countryLabels = res.map(L => {
    const name = C[L.ix].name;
    const area = L.cnt * ST * ST / (RS * RS);
    return { ix: L.ix, x: L.x / RS, y: L.y / RS, name: name.toUpperCase(), fs: Math.min(34, Math.sqrt(area) / Math.max(4, name.length * 0.72)) };
  });
  labelsDirty = false;
}
function computeArrows() {
  const out = [];
  for (const [key, m] of capLog) {
    const by = (key / 1000) | 0, bx = key % 1000;
    let best = null, bestN = 0, total = 0;
    for (const [pk, v] of m) { total += v; if (v > bestN) { bestN = v; best = pk; } }
    for (const [pk, v] of m) { const nv = v * 0.55; if (nv < 0.3) m.delete(pk); else m.set(pk, nv); }
    if (!m.size) capLog.delete(key);
    if (bestN < 1.2) continue;
    const att = (best / CAP) | 0, def = best % CAP;
    if (!C[att].alive || !C[def].alive || !atWar(att, def)) continue;
    // направление: от «центра» своих клеток к вражеским в этой области
    let ax = 0, ay = 0, an = 0, dx = 0, dy = 0, dn = 0;
    const x0 = bx * 36, y0 = by * 36;
    for (let y = y0; y < y0 + 36 && y < RH; y += 3) for (let x = x0; x < x0 + 36 && x < RW; x += 3) {
      const o = owner[y * RW + x];
      if (o === att) { ax += x; ay += y; an++; } else if (o === def) { dx += x; dy += y; dn++; }
    }
    if (!an || !dn) continue;
    ax /= an; ay /= an; dx /= dn; dy /= dn;
    let vx = dx - ax, vy = dy - ay; const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L;
    const mx = (ax + dx) / 2, my = (ay + dy) / 2;
    const side = att === PL || (PL >= 0 && allied(att, PL) && atWar(def, PL)) ? 'mine' : def === PL || (PL >= 0 && allied(def, PL)) ? 'enemy' : 'other';
    out.push({ x: mx / RS, y: my / RS, vx, vy, w: Math.min(3, total / 3), side });
  }
  // приказ игрока «наступать сюда»
  if (PL >= 0 && G.orders[PL] != null) {
    const t = G.orders[PL], te = owner[cityCell[t]];
    if (!atWar(PL, te)) delete G.orders[PL];
    else {
      const f = nearestCity(PL, provXY[t]);
      if (f >= 0) out.push({ order: true, from: provXY[f], to: provXY[t] });
    }
  }
  G.arrows = out;
}

// ======================= Рендер кадра =======================
const ARROW_COL = { mine: '#ffd23f', enemy: '#ff3b2f', other: 'rgba(255,255,255,.65)' };
function ping(xy, color, icon) {
  if (!G || !xy) return;
  G.pings.push({ x: xy[0], y: xy[1], t: 0, color, icon });
  if (MP.live) mpBroadcast({ t: 'ping', xy, color, icon });
}
let lastFrame = performance.now(), lastLabels = 0, lastArrows = 0;
let hudDirty = false, lastHud = 0, needDraw = true, lastDraw = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!G || !$('#screen-game').classList.contains('active')) return;
  if (hudDirty && now - lastHud > 250) { hudDirty = false; lastHud = now; renderHud(); }
  // перерисовываем только когда что-то поменялось; анимации — не чаще 30 кадров/с
  const animate = G.arrows.length || G.flights.length || G.pings.length || globe.on;
  if (!needDraw && !anyDirty && !(animate && now - lastDraw > 33)) return;
  needDraw = false; lastDraw = now;
  const tStart = performance.now();
  if (globe.on) drawGlobe(now); else drawFrame(now);
  window.__frameMs = performance.now() - tStart;
}
function drawFrame(now) {
  const dt = Math.min(100, now - lastFrame); lastFrame = now;
  if (labelsDirty && now - lastLabels > 1200) { computeLabels(); lastLabels = now; }
  if (now - lastArrows > 900) { computeArrows(); lastArrows = now; }
  flushTiles();
  const k = zt.k, u = 1 / (k * s0), run = !G.paused && !G.modalPause;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1620'; ctx.fillRect(0, 0, cv.width, cv.height);
  const s = DPR * k * s0;
  ctx.setTransform(s, 0, 0, s, DPR * (zt.x + k * ox), DPR * (zt.y + k * oy));
  ctx.fillStyle = '#1c3a52'; ctx.fill(spherePath);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 0.6 * u; ctx.stroke(gratPath);
  // земля из клеток, по контуру береговой линии
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = k < 2 ? 'medium' : 'low';
  ctx.drawImage(ownCv, 0, 0, VW, VH);
  ctx.globalAlpha = k < 3 ? 1 : k < 8 ? 0.8 : 0.6;
  ctx.drawImage(bordCv, 0, 0, VW, VH);
  ctx.globalAlpha = 1;
  ctx.restore();
  if (k > 3.5) { ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 0.5 * u; ctx.stroke(provLinePath); }
  ctx.strokeStyle = 'rgba(8,16,24,.75)'; ctx.lineWidth = 0.9 * u; ctx.stroke(coastPath);

  // всё остальное — в экранных координатах
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  // подписи стран
  for (const L of countryLabels) {
    const px = Math.min(110, L.fs * k * s0);
    if (px < 8) continue;
    const [x, y] = toScreen(L.x, L.y);
    if (x < -300 || x > cssW + 300 || y < -50 || y > cssH + 50) continue;
    ctx.font = `700 ${px.toFixed(1)}px "Segoe UI", Arial, sans-serif`;
    ctx.globalAlpha = k >= 5 ? 0.5 : 0.9;
    ctx.lineWidth = Math.max(2, px * 0.14); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(L.name, x, y);
    ctx.fillStyle = '#fff'; ctx.fillText(L.name, x, y);
    if (G.epi && G.epi.infected.has(L.ix)) { ctx.font = `${Math.max(12, px * 0.8)}px sans-serif`; ctx.fillText('☣', x, y - px * 1.1); }
  }
  ctx.globalAlpha = 1;
  // стрелки наступления (марш войск)
  const tt = now / 1000;
  for (const A of G.arrows) {
    if (A.order) { drawArrow(...toScreen(...A.from), ...toScreen(...A.to), '#ffd23f', 4, tt, true); continue; }
    const len = clamp(14 * k * s0, 22, 90);
    const [cx, cy] = toScreen(A.x, A.y);
    if (cx < -100 || cx > cssW + 100 || cy < -100 || cy > cssH + 100) continue;
    drawArrow(cx - A.vx * len * 0.7, cy - A.vy * len * 0.7, cx + A.vx * len * 0.5, cy + A.vy * len * 0.5, ARROW_COL[A.side], 1.5 + A.w, tt, A.side !== 'other');
  }
  // города
  const showAll = k >= 3, showNames = k >= 2.2;
  ctx.font = '600 11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'left';
  for (let p = 0; p < NP; p++) {
    const cap = C[owner[cityCell[p]]].capProv === p;
    if (!cap && !showAll) continue;
    const [x, y] = toScreen(...provXY[p]);
    if (x < -40 || x > cssW + 40 || y < -20 || y > cssH + 20) continue;
    ctx.beginPath(); ctx.arc(x, y, cap ? 3.4 : 2.3, 0, 7);
    ctx.fillStyle = cap ? '#d4a94a' : '#f2efe6'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#111'; ctx.stroke();
    if (showNames && (cap || k >= 5)) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(P[p].name, x + 5, y + 1);
      ctx.fillStyle = '#fff'; ctx.fillText(P[p].name, x + 5, y + 1);
    }
  }
  ctx.textAlign = 'center';
  // самолёты
  for (const f of G.flights) {
    const [x0, y0] = toScreen(...f.from), [x1, y1] = toScreen(...f.to);
    const col = f.by === PL ? '#9fd3ff' : '#ff8577';
    ctx.setLineDash([4, 5]); ctx.lineDashOffset = -tt * 30;
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    const t = Math.min(1, f.t), px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) + Math.PI / 4);
    ctx.font = '18px "Segoe UI Emoji", sans-serif'; ctx.fillStyle = col; ctx.fillText(f.kind === 'para' ? '🛩' : '✈', 0, 0);
    ctx.restore();
  }
  // вспышки событий
  for (const pg of [...G.pings]) {
    pg.t += dt / 2600;
    if (pg.t >= 1) { G.pings.splice(G.pings.indexOf(pg), 1); continue; }
    const [x, y] = toScreen(pg.x, pg.y);
    ctx.globalAlpha = 1 - pg.t;
    ctx.strokeStyle = pg.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 6 + pg.t * 40, 0, 7); ctx.stroke();
    ctx.font = '20px "Segoe UI Emoji", sans-serif'; ctx.fillText(pg.icon, x, y - 4);
  }
  ctx.globalAlpha = 1;
}
function drawArrow(x0, y0, x1, y1, col, w, tt, march) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = w + 2.5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.setLineDash([7, 5]); ctx.lineDashOffset = -tt * 22;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  const h = 6 + w * 2;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(a) * h * 0.6, y1 + Math.sin(a) * h * 0.6);
  ctx.lineTo(x1 + Math.cos(a + 2.5) * h, y1 + Math.sin(a + 2.5) * h);
  ctx.lineTo(x1 + Math.cos(a - 2.5) * h, y1 + Math.sin(a - 2.5) * h);
  ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
  if (march && L > 20) { // солдаты на марше
    ctx.fillStyle = '#fff';
    for (let s = 0; s < 3; s++) {
      const t = ((tt * 0.35 + s / 3) % 1);
      ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.max(1.5, w * 0.45), 0, 7); ctx.fill();
    }
  }
}
requestAnimationFrame(frame);

// ======================= Время =======================
let acc = 0, last = Date.now(), lastCosmic = 0;
setInterval(() => {
  const now = Date.now(), dt = Math.min(now - last, 2000); last = now;
  if (G && MP.role !== 'guest' && !G.paused && (!G.modalPause || MP.live) && !MP.waiting && $('#screen-game').classList.contains('active')) {
    const days = G.speed > 100 ? dt * G.speed / 1000 : Math.min(dt * G.speed / 1000, 20);
    simulate(Math.min(days, 25));
    adjStep(48);
    for (const f of [...G.flights]) { f.t += days / 2.6; if (f.t >= 1) { G.flights.splice(G.flights.indexOf(f), 1); flightArrived(f); } }
    acc += days;
    let n = Math.floor(acc);
    if (n >= 1 && (!cosmic() || now - lastCosmic > 250)) {
      acc -= n; lastCosmic = now;
      const per = cosmic() ? n : Math.max(1, Math.ceil(n / 6));
      while (n > 0 && G) { const d = Math.min(per, n); dayTick(d); n -= d; }
    }
  }
}, 50);
function setPaused(p) { G.paused = p; renderTime(); }
const MAX_SPEED = () => (globe.on ? 365e6 : 100); // в космосе — до миллиона лет за секунду
const sliderToSpeed = v => +(0.1 * Math.pow(MAX_SPEED() / 0.1, v / 1000)).toPrecision(2);
const speedToSlider = sp => Math.round(1000 * Math.log(Math.min(sp, MAX_SPEED()) / 0.1) / Math.log(MAX_SPEED() / 0.1));
function fmtSpeed(sp) {
  if (sp < 365) return sp + '×';
  const y = sp / 365;
  if (y >= 1e6) return (y / 1e6).toFixed(y < 1e7 ? 1 : 0).replace('.', ',') + ' млн лет/с';
  if (y >= 1e4) return Math.round(y / 1000) + ' тыс. лет/с';
  return (y < 10 ? y.toFixed(1).replace('.', ',') : Math.round(y)) + ' ' + (y < 2 ? 'год' : y < 5 ? 'года' : 'лет') + '/с';
}
function setSpeed(sp) { G.speed = sp; setPaused(false); $('#speed-range').value = speedToSlider(sp); }
function syncSpeedUI() {
  $('#speed-range').value = speedToSlider(G.speed);
  $('#speed-presets').classList.toggle('hidden', !globe.on);
  $('#speed-marks').innerHTML = globe.on ? '<span>0,1×</span><span>1 год/с</span><span>1000 лет/с</span><span>1 млн лет/с</span>'
    : '<span>0,1×</span><span>1×</span><span>10×</span><span>100×</span>';
  $('#speed-title').textContent = globe.on ? '🚀 Космическая скорость:' : 'Скорость времени:';
}
$$('#speed-presets [data-years]').forEach(b => (b.onclick = () => setSpeed(+b.dataset.years * 365)));
$('#btn-more').onclick = e => { e.stopPropagation(); $('#speed-pop').classList.toggle('hidden'); syncSpeedUI(); renderTime(); };
$('#speed-range').oninput = e => { G.speed = sliderToSpeed(+e.target.value); setPaused(false); };
document.addEventListener('mousedown', e => { if (!e.target.closest('.time-box')) $('#speed-pop').classList.add('hidden'); });
$('#btn-pause').onclick = () => act('pause', !G.paused);
$$('.spd').forEach(b => (b.onclick = () => act('speed', +b.dataset.spd)));
function renderTime() {
  const d = $('#hud-date');
  const yr = 2026 + Math.floor(G.dayN / 365.2425);
  d.textContent = yr < 9000 ? G.day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '')
    : yr < 1e6 ? fmtNum(yr) + ' год' : (yr / 1e6).toFixed(2).replace('.', ',') + ' млн лет';
  d.classList.toggle('paused', G.paused);
  $('#btn-pause').textContent = G.paused ? '▶' : '❚❚';
  $('#btn-pause').classList.toggle('on', G.paused);
  $$('.spd').forEach(b => b.classList.toggle('on', !G.paused && +b.dataset.spd === G.speed));
  $('#btn-more').style.display = !MP.role && (G.creative || globe.on) ? '' : 'none';
  $('#btn-more').classList.toggle('on', !G.paused && ![1, 2, 5].includes(G.speed));
  $('#speed-val').textContent = fmtSpeed(G.speed);
  $('#btn-more').textContent = G.speed >= 365 ? '🚀' : '⋯';
}

// ======================= HUD =======================
function flagTag(ix, cls = 'tiny') { const c = C[ix]; return c ? `<img class="flag ${cls}" data-flag="${ix}" src="${esc(c.flag)}" alt="">` : ''; }
function fixFlags(rootEl) { rootEl.querySelectorAll('img[data-flag]').forEach(img => setFlagImg(img, C[+img.dataset.flag])); }

function oppTag() {
  if (MP.role === 'host' && MP.waiting) return `<span>👥 <b>ждём друзей (${MP.guests.filter(g => g.ready).length}/${MP.maxGuests})…</b></span>`;
  const list = (MP.role === 'host' ? humanPls() : MP.role === 'guest' ? MP.humans : []).filter(h => h !== PL && C[h]);
  return list.length ? `<span>👥 Соперники: ${list.map(h => `${flagTag(h)} <b>${esc(C[h].name)}</b>${C[h].alive ? '' : ' ✝'}`).join(', ')}</span>` : '';
}
function renderHud() {
  if (swapDepth) { hudDirty = true; return; }
  renderTime();
  const ix = PL >= 0 ? PL : G.watching, c = C[ix];
  setFlagImg($('#hud-flag'), c);
  $('#hud-name').innerHTML = esc(c.name + (c.alive ? '' : ' (уничтожена)')) + (G.creative ? '<span class="creative-badge">ТВОРЧЕСКИЙ</span>' : '');
  const nv = vassalsOf(ix).length;
  $('#hud-leader').textContent = PL >= 0 ? 'Лидер: ' + (c.leader || 'глава государства')
    : 'Вы наблюдаете за миром' + (c.leader ? ' · новый лидер: ' + c.leader : '');
  const als = alliancesOf(ix).map(a => a.name);
  $('#hud-stats').innerHTML = `<span>Население: <b>${fmtPop(c.pop * c.popF * G.growth)}</b></span>
    <span>ВВП: <b>$${fmtNum(Math.max(0, c.gdpPc * c.pop * c.popF * c.econ / 1e9))} млрд</b></span>
    <span>Сила: <b>${strength(ix)}/100</b></span><span>Армия: <b>${fmtNum(power(ix))}</b></span><span>Боевой дух: <b>${Math.round(c.morale * 100)}%</b></span>
    <span>Валюта: <b>${esc(c.currency)}</b></span>${als.length ? `<span>Союзы: <b>${esc(als.join(', '))}</b></span>` : ''}${nv ? `<span>👑 Вассалов: <b>${nv}</b></span>` : ''}${oppTag()}
    ${c.epiUntil > G.dayN ? '<span style="color:#9f9">☣ <b>эпидемия</b></span>' : ''}${c.aid > 1 ? `<span>Помощь: <b>+${fmtNum(c.aid)}</b></span>` : ''}`;
  fixFlags($('#hud-stats'));
  $('#btn-settings').textContent = PL >= 0 ? '⚙ Настроить страну' : '☰ Главное меню';
  $('#hud-wars').innerHTML = warsOf(ix).map(w => {
    const s = inWar(w, ix), pm = sidePower(w, s), pe = sidePower(w, 1 - s);
    const enemies = [...w.sides[1 - s]], friends = [...w.sides[s]].filter(m => m !== ix);
    return `<div class="war-chip"><span>⚔</span>${enemies.slice(0, 6).map(e => flagTag(e)).join('')}
      <span class="wn">${esc(w.name)}${friends.length ? ` · союзники: ${friends.length}` : ''}</span>
      <span class="war-bar" title="Соотношение сил"><i style="width:${(100 * pm / (pm + pe)).toFixed(0)}%"></i></span></div>`;
  }).join('');
  fixFlags($('#hud-wars'));
  $('#hud-wars').style.top = $('#hud-country').getBoundingClientRect().bottom + 6 + 'px';
}

const toastBox = $('#toasts');
let lastToast = 0;
function toast(html, kind = '', flags = []) {
  if (!G) return;
  if (MP.live) mpBroadcast({ t: 'toast', html, kind, flags });
  showToast(html, kind, flags);
}
function say(html, kind = '', flags = []) {
  if (!G) return;
  if (MP.role === 'host' && swapDepth && guestByPl(PL)) return sendTo(guestByPl(PL), { t: 'toast', html, kind, flags });
  showToast(html, kind, flags);
}
function showToast(html, kind = '', flags = []) {
  if (!G) return;
  if (cosmic()) { const t = performance.now(); if (t - lastToast < 500) return; lastToast = t; }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = flags.filter(f => C[f]).map(f => flagTag(f)).join('') + `<span>${html}</span>`;
  fixFlags(el);
  toastBox.prepend(el);
  while (toastBox.children.length > 5) toastBox.lastChild.remove();
  setTimeout(() => el.classList.add('fade'), 6000);
  setTimeout(() => el.remove(), 6700);
}

// ======================= Клики по карте =======================
const popup = $('#popup'), ctxm = $('#ctx');
function hideOverlays() { popup.classList.add('hidden'); ctxm.classList.add('hidden'); }
function placeAt(el, e) {
  el.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(e.clientX + 12, innerWidth - r.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(e.clientY + 12, innerHeight - r.height - 8)) + 'px';
}

cv.addEventListener('click', e => {
  if (!G || G.paint || globe.moved) return;
  const cell = cellFromEvent(e);
  hideOverlays();
  if (cell < 0 || owner[cell] === SEA) { if (G.mode) setMode(null); return; }
  const o = owner[cell], pid = provOf[cell];
  if (G.mode === 'war') {
    if (o === PL) return say('Это ваша страна — выберите другую', 'war');
    if (atWar(PL, o)) return say(`Вы уже воюете со страной ${esc(C[o].name)}`, 'war');
    setMode(null);
    return act('war', o);
  }
  if (G.mode === 'order') {
    setMode(null);
    return act('orderAttack', G.orderActor, o);
  }
  const cOwn = owner[cityCell[pid]], c = C[o], p = P[pid];
  const core = C[provCore[pid]];
  let html = `<div class="p-head">${flagTag(o, 'small')}<div><div class="p-title">${esc(p.name)}</div><div class="p-row">${esc(c.name)}</div></div></div>
    <div class="p-row">Население региона: <b>${fmtPop(p.pop)}</b></div>`;
  if (cOwn !== o) html += `<div class="p-row">Сам город удерживает: <b>${esc(C[cOwn].name)}</b></div>`;
  if (C[cOwn].capProv === pid) html += `<div class="p-row"><b>★ Столица</b> страны ${esc(C[cOwn].name)}</div>`;
  if (provCore[pid] !== o && core.alive) html += `<div class="p-row">Оккупировано. Законный владелец: <b>${esc(core.name)}</b></div>`;
  const als = alliancesOf(o).map(a => a.name);
  if (als.length) html += `<div class="p-row">Союзы: <b>${esc(als.join(', '))}</b></div>`;
  if (c.enemies) html += `<div class="p-row">Воюет с: <b>${esc(C.filter(x => atWar(x.ix, o)).slice(0, 5).map(x => x.name).join(', '))}</b></div>`;
  if (c.epiUntil > G.dayN) html += `<div class="p-row" style="color:#9f9">☣ Эпидемия: ${esc(G.epi ? G.epi.name : '')}</div>`;
  html += `<div class="p-row">Сила: <b>${strength(o)}/100</b> · Армия: <b>${fmtNum(power(o))}</b> · Дух: <b>${Math.round(c.morale * 100)}%</b></div>`;
  if (c.overlord >= 0 && C[c.overlord].alive) html += `<div class="p-row">👑 Вассал страны <b>${esc(C[c.overlord].name)}</b></div>`;
  if (C[cOwn].cities > 1) html += `<button class="btn" id="btn-indep">🏳 Независимость</button>`;
  else html += `<div class="p-row" style="margin-top:6px">Последний город страны — отделяться некуда</div>`;
  popup.innerHTML = html;
  fixFlags(popup);
  placeAt(popup, e);
  const b = $('#btn-indep'); if (b) b.onclick = () => { hideOverlays(); independenceDialog(pid); };
});

cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  hideOverlays();
  if (!G || PL < 0) return;
  if (G.mode) return setMode(null);
  if (G.paint) return stopPaint();
  if (globe.moved) return;
  const cell = cellFromEvent(e);
  if (cell < 0 || owner[cell] === SEA) return;
  const o = owner[cell], pid = provOf[cell], city = P[pid].name;
  const items = [];
  if (o === PL) {
    items.push(['war', '⚔ Война', () => setMode('war')]);
    for (const w of warsOf(PL)) items.push(['', `🕊 Предложить мир: ${w.name}`, () => act('peace', w.id)]);
    if (G.orders[PL] != null) items.push(['', '✋ Отменить приказ наступления', () => act('cancelOrder')]);
    if (G.creative) {
      items.push(['creative', '👑 Провозгласить империю', empireDialog]);
      items.push(['creative', '💪 Сила страны', () => strengthDialog(PL)]);
    }
  } else if (atWar(o, PL)) {
    items.push(['war', `➜ Наступать на город ${city}`, () => act('order', pid)]);
    items.push(['war', `✈ Авиаудар по городу ${city}`, () => act('flight', pid, 'strike')]);
    items.push(['war', `🪂 Десант к городу ${city}`, () => act('flight', pid, 'para')]);
    for (const w of warsOf(PL).filter(w => inWar(w, o) >= 0)) items.push(['', '🕊 Предложить мир', () => act('peace', w.id)]);
  } else {
    items.push(['war', '⚔ Объявить войну', () => act('war', o)]);
    if (allied(o, PL)) items.push(['', '💔 Разорвать союз', () => act('breakAlliance', o)]);
    else if (C[o].overlord !== PL) items.push(['', '🤝 Союз', () => act('alliance', o)]);
    if (allied(o, PL) || C[o].overlord === PL)
      items.push(['war', '🎯 Приказать напасть…', () => { G.orderActor = o; setMode('order'); }]);
    if (C[o].enemies) {
      if (C[o].aidFrom.has(PL)) items.push(['', '📦 Прекратить военную помощь', () => act('aid', o, false)]);
      else items.push(['', '📦 Отправить военную помощь', () => act('aid', o, true)]);
    }
  }
  if (G.creative && o !== PL) {
    items.push(['creative', '🏴 Забрать страну', () => takeCountry(o)]);
    items.push(['creative', '🖌 Закрашивать', () => startPaint(o)]);
    if (C[o].overlord === PL) items.push(['creative', '🔓 Освободить вассала', () => releaseVassal(o)]);
    else items.push(['creative', '👑 Сделать вассалом', () => makeVassal(o)]);
    items.push(['creative', '💪 Сила страны', () => strengthDialog(o)]);
    if (C[o].cities > 1) items.push(['creative', `🏳 Создать государство в ${city}`, () => independenceDialog(pid)]);
  }
  ctxm.innerHTML = `<div class="c-head">${flagTag(o)} ${esc(C[o].name)} · ${esc(city)}</div>` +
    items.map(([cls, label], i) => `<button class="${cls}" data-i="${i}">${esc(label)}</button>`).join('');
  fixFlags(ctxm);
  ctxm.querySelectorAll('button').forEach(b => (b.onclick = () => { hideOverlays(); items[+b.dataset.i][2](); }));
  placeAt(ctxm, e);
});

function proposePeace(w) {
  if (!w || !G.wars.includes(w)) return;
  const s = inWar(w, PL), mine = sidePower(w, s), theirs = sidePower(w, 1 - s);
  const human = [...w.sides[1 - s]].find(x => isHuman(x) && x !== PL);
  if (human != null) return askPeace(w, PL, human); // против друга — решает он сам
  const days = G.dayN - w.start;
  if (theirs < mine * 0.8 || (days > 90 && Math.random() < 0.35) || Math.random() < 0.1) endWar(w, `Заключён мир: <b>${esc(w.name)}</b>`);
  else say(`<b>${esc(C[w.leaders[1 - s]].name)}</b> отвергает мирное предложение`, 'war', [w.leaders[1 - s]]);
}
function setMode(m) {
  G.mode = m;
  cv.classList.toggle('targeting', !!m);
  const b = $('#mode-banner');
  if (m === 'war') { b.innerHTML = '⚔ Нажмите на страну, которой хотите объявить войну<br><small>Esc или правая кнопка — отмена</small>'; b.classList.remove('hidden'); }
  else if (m === 'order') { b.innerHTML = `🎯 На кого должна напасть страна <b>${esc(C[G.orderActor].name)}</b>?<br><small>Нажмите на цель · Esc — отмена</small>`; b.classList.remove('hidden'); }
  else if (!G.paint) b.classList.add('hidden');
}
document.addEventListener('keydown', e => {
  if (!G || !$('#screen-game').classList.contains('active') || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); act('pause', !G.paused); }
  if (e.key === 'Escape') { hideOverlays(); setMode(null); stopPaint(); }
});

// ======================= Независимость =======================
function independenceDialog(pid) {
  const p = P[pid], parent = owner[cityCell[pid]];
  let flag = makeFlag(p.name);
  modal(`<h2>Независимость: ${esc(p.name)}</h2>
    <p>Регион отделится от страны «${esc(C[parent].name)}» и станет новым государством. Как назовём страну?</p>
    <div class="center"><img class="flag big" id="ind-flag" src="${flag}"></div>
    <div class="row"><input id="ind-name" type="text" maxlength="40" placeholder="Например: Республика ${esc(p.name)}"><button class="btn small" id="ind-reroll" title="Другой флаг">🎲</button></div>
    <label class="chk"><input type="checkbox" id="ind-play" ${PL >= 0 ? 'checked' : ''}> Играть за новую страну</label>
    <div class="actions"><button class="btn" data-a="cancel">Отмена</button><button class="btn" data-a="ok" id="ind-ok">🏳 Объявить независимость</button></div>`,
  { ok: () => act('indep', pid, $('#ind-name').value.trim() || 'Республика ' + p.name, flag, $('#ind-play').checked) },
  () => {
    $('#ind-reroll').onclick = () => { flag = makeFlag(p.name); $('#ind-flag').src = flag; };
    $('#ind-name').focus();
    $('#ind-name').onkeydown = e => { if (e.key === 'Enter') $('#ind-ok').click(); };
  });
}
function declareIndependence(pid, name, flag, play, auto) {
  const parentIx = owner[cityCell[pid]], parent = C[parentIx];
  if (C.length >= CAP - 1) return null;
  const col = d3.hsl(Math.random() * 360, 0.35 + Math.random() * 0.25, 0.45 + Math.random() * 0.15).formatHex();
  const c = makeCountry({ id: 'N' + G.newId++, name, flag, color: col, cont: parent.cont, leader: META.randomLeader(parent.id, parent.cont),
    currency: parent.currency, pc: parent.pc * 0.85, gdpPc: parent.gdpPc, capProv: pid, breakFrom: parentIx, popF: parent.popF, econ: 1 });
  for (let k = provStart[pid]; k < provStart[pid + 1]; k++) { const i = provCells[k]; if (owner[i] === parentIx) setOwner(i, c.ix, true); }
  c.capProv = pid; c.warBase = c.cells;
  toast(`🏳 <b>${esc(name)}</b> провозгласила независимость от страны ${esc(parent.name)}!`, 'good', [c.ix]);
  ping(provXY[pid], '#ffffff', '🏳');
  if (play && !auto) { PL = c.ix; G.watching = c.ix; }
  if (!auto && parentIx !== PL && Math.random() < G.D.reclaim) c.reclaimDay = G.dayN + 30 + Math.random() * 90;
  warsChanged();
  return c;
}

// ======================= Модальные окна =======================
function modal(html, actions = {}, after) {
  if (MP.role === 'host' && swapDepth && guestByPl(PL)) return sendTo(guestByPl(PL), { t: 'modal', html });
  $('#modal-card').innerHTML = html;
  fixFlags($('#modal-card'));
  $('#modal').classList.remove('hidden');
  if (G) { G.modalPause = true; G.modalOpen = true; }
  $('#modal-card').querySelectorAll('[data-a]').forEach(b => (b.onclick = () => { const fn = actions[b.dataset.a]; closeModal(); if (fn) fn(); }));
  if (after) after();
}
function closeModal() { $('#modal').classList.add('hidden'); if (G) { G.modalPause = false; G.modalOpen = false; } }

// ======================= Настройки страны =======================
const S = $('#settings');
$('#btn-settings').onclick = () => {
  if (PL < 0) return modal(`<h2>Меню</h2><p>Вы наблюдаете за миром.</p>
    <div class="actions"><button class="btn" data-a="cancel">Продолжить наблюдать</button><button class="btn" data-a="menu">В главное меню</button></div>`, { menu: toMenu });
  openSettings();
};
$('#hud-flag').onclick = () => PL >= 0 && openSettings();
function openSettings() {
  hideOverlays();
  const c = C[PL];
  setFlagImg($('#set-flag'), c);
  $('#set-name').value = c.name;
  $('#set-cur').value = '';
  $('#set-cur-now').textContent = '(сейчас: ' + c.currency + ')';
  $('#set-color').value = c.color;
  $('#set-flag-url').value = '';
  const dl = $('#cur-list');
  if (!dl.childElementCount) [...new Set(Object.values(META.currency))].map(META.currencyName).sort((a, b) => a.localeCompare(b, 'ru'))
    .forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
  S.classList.remove('hidden');
  G.modalPause = true;
}
function closeSettings() { S.classList.add('hidden'); if (G) G.modalPause = false; }
$('#settings-close').onclick = closeSettings;
S.onclick = e => { if (e.target === S) closeSettings(); };
function applyFlag(src) {
  $('#set-flag').onerror = null; $('#set-flag').src = src;
  act('setFlag', src);
}
$('#set-flag-file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => applyFlag(r.result);
  r.readAsDataURL(f);
  e.target.value = '';
};
$('#set-flag-url-btn').onclick = () => {
  const url = $('#set-flag-url').value.trim();
  if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) return say('Вставьте ссылку на картинку (http/https)', 'war');
  const im = new Image();
  im.onload = () => applyFlag(url);
  im.onerror = () => say('Не удалось загрузить картинку по ссылке', 'war');
  im.src = url;
};
$('#set-flag-random').onclick = () => applyFlag(makeFlag(PL));
$('#set-name-btn').onclick = () => {
  const n = $('#set-name').value.trim(); if (!n) return;
  act('setName', n);
};
$('#set-name').onkeydown = e => { if (e.key === 'Enter') $('#set-name-btn').click(); };
$('#set-cur-btn').onclick = () => {
  const n = $('#set-cur').value.trim(); if (!n) return;
  $('#set-cur-now').textContent = '(сейчас: ' + n + ')';
  $('#set-cur').value = '';
  act('setCurrency', n);
};
$('#set-cur').onkeydown = e => { if (e.key === 'Enter') $('#set-cur-btn').click(); };
let colorTimer = 0;
$('#set-color').oninput = e => { const v = e.target.value; clearTimeout(colorTimer); colorTimer = setTimeout(() => act('setColor', v), 120); };
$('#btn-leave').onclick = () => {
  const c = C[PL];
  closeSettings();
  modal(`<h2>Покинуть страну?</h2><p>Вы уйдёте с поста. Страной «${esc(c.name)}» будет управлять новый президент, а вы будете наблюдать за миром.</p>
    <div class="actions"><button class="btn" data-a="cancel">Остаться</button><button class="btn danger" style="width:auto" data-a="leave">🚪 Покинуть страну</button></div>`,
  { leave: () => { setMode(null); act('leave'); } });
};

// ======================= Игра с друзьями по сети =======================
// Хост считает весь мир и шлёт друзьям (до двух) изменения; друзья присылают свои приказы.
// Соединение — напрямую между браузерами (WebRTC через PeerJS). Каждый сам за себя.
const PEER_PREFIX = 'countryfail-2026-';
// PeerJS может прислать буфер как ArrayBuffer или как Uint8Array-представление с отступом
function asBuf(x) {
  if (x instanceof ArrayBuffer) return x;
  if (ArrayBuffer.isView(x)) return x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
  return new Uint8Array(x).buffer;
}
function sendTo(g, msg) { if (g && g.conn && g.conn.open) try { g.conn.send(msg); } catch (e) { console.warn(e); } }
function mpBroadcast(msg) { for (const g of MP.guests) if (g.ready) sendTo(g, msg); }
function mpSend(msg) { if (MP.role === 'guest') sendTo({ conn: MP.conn }, msg); else mpBroadcast(msg); }
const guestByPl = pl => MP.guests.find(g => g.pl === pl && pl >= 0);
const humanPls = () => [PL, ...MP.guests.map(g => g.pl)].filter(x => x >= 0);
function mpRefresh() { MP.live = MP.role === 'host' && MP.guests.some(g => g.ready); }
function mpCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }
function mpReset() {
  try { MP.conn && MP.conn.close(); } catch (e) {}
  for (const g of MP.guests) try { g.conn.close(); } catch (e) {}
  try { MP.peer && MP.peer.destroy(); } catch (e) {}
  Object.assign(MP, { role: null, peer: null, conn: null, code: '', guests: [], maxGuests: 1, humans: [], cellBuf: [], warsSig: '',
    flagSent: {}, pendingHost: false, live: false, waiting: false, taken: [], humansTotal: 0 });
}
const mpStatus = t => ($('#mp-status').textContent = t);

// ---------- действия игрока: у хоста выполняются сразу, у друга уходят хосту ----------
const ACTIONS = {
  war: t => {
    if (t === PL) return say('Это ваша страна — выберите другую', 'war');
    if (atWar(PL, t)) return say(`Вы уже воюете со страной ${esc(C[t].name)}`, 'war');
    declareWar(PL, t);
  },
  orderAttack: (a, t) => orderAttack(a, t),
  peace: id => proposePeace(G.wars.find(w => w.id === id)),
  peaceAnswer: (id, yes) => answerPeace(id, yes),
  order: pid => { G.orders[PL] = pid; computeArrows(); say(`Войска выдвигаются к городу <b>${esc(P[pid].name)}</b>`, 'good'); },
  cancelOrder: () => { delete G.orders[PL]; computeArrows(); },
  flight: (pid, kind) => playerFlight(pid, kind),
  alliance: t => {
    // союз с живым игроком — по его согласию
    const g = guestByPl(t);
    if (g || (t !== PL && isHuman(t))) return askAlliance(PL, t);
    proposeAlliance(t);
  },
  allianceAnswer: (from, yes) => {
    if (!C[from] || !C[from].alive) return;
    if (yes) formAlliance(from);
    else toast(`<b>${esc(C[PL].name)}</b> отказывается от союза с ${esc(C[from].name)}`, 'war', [PL, from]);
  },
  breakAlliance: t => breakAlliance(t),
  aid: (t, on) => {
    if (on) { C[t].aidFrom.add(PL); say(`Вы помогаете оружием стране <b>${esc(C[t].name)}</b>`, 'good', [t]); }
    else C[t].aidFrom.delete(PL);
    updateAid(); hudDirty = true;
  },
  indep: (pid, name, flag, play) => declareIndependence(pid, name, flag, play),
  setName: n => { C[PL].name = n; labelsDirty = true; hudDirty = true; say(`Страна переименована в <b>${esc(n)}</b>`, 'good', [PL]); },
  setCurrency: n => { const c = C[PL], old = c.currency; c.currency = n; hudDirty = true; say(`Валюта: ${esc(old)} → <b>${esc(n)}</b>`, 'good', [PL]); },
  setColor: hex => { setColor(C[PL], hex); recolorAll(); },
  setFlag: src => { const c = C[PL]; c.flag = src; c.fallbackFlag = null; c.flagVer = (c.flagVer || 0) + 1; hudDirty = true; say('Флаг изменён', 'good', [PL]); },
  leave: () => {
    const c = C[PL], old = c.leader;
    c.leader = META.randomLeader(c.id, c.cont);
    G.watching = c.ix; PL = -1;
    toast(`${old ? esc(old) + ' покидает пост. ' : ''}Новый президент страны ${esc(c.name)} — <b>${esc(c.leader)}</b>`, 'good', [c.ix]);
    recolorAll(); hudDirty = true;
  },
  pause: p => setPaused(p),
  speed: sp => { G.speed = clamp(+sp || 1, 0.1, MP.role ? 5 : 365e6); setPaused(false); },
};
function act(name, ...args) {
  if (MP.role === 'guest') return mpSend({ t: 'cmd', name, args });
  ACTIONS[name](...args);
}

// ---------- предложение живому игроку (мир / союз) — решает он сам ----------
function offerTo(toIx, msg, hostModalHtml, onYes, onNo) {
  const g = guestByPl(toIx);
  if (g) return sendTo(g, msg);
  // адресат — хост: показываем окно после выхода из «чужого» хода
  setTimeout(() => modal(hostModalHtml, { yes: onYes, no: onNo }), 0);
}
function askPeace(w, fromIx, toIx) {
  offerTo(toIx, { t: 'peaceOffer', id: w.id, from: C[fromIx].name, fromIx },
    `<h2>🕊 Предложение мира</h2><div class="center">${flagTag(fromIx, 'big')}</div>
      <p>Игрок (<b>${esc(C[fromIx].name)}</b>) предлагает заключить мир.</p>
      <div class="actions"><button class="btn" data-a="no">Отказать</button><button class="btn" data-a="yes">Заключить мир</button></div>`,
    () => answerPeace(w.id, true), () => answerPeace(w.id, false));
  say(`Предложение мира отправлено игроку (${esc(C[toIx].name)})`, '', [toIx]);
}
function answerPeace(id, yes) {
  const w = G.wars.find(x => x.id === id);
  if (!w) return;
  if (yes) endWar(w, `🕊 Игроки заключили мир: <b>${esc(w.name)}</b>`);
  else toast(`<b>${esc(C[PL].name)}</b> отвергает мир — война продолжается!`, 'war', [PL]);
}
function askAlliance(fromIx, toIx) {
  offerTo(toIx, { t: 'allianceOffer', from: C[fromIx].name, fromIx },
    `<h2>🤝 Предложение союза</h2><div class="center">${flagTag(fromIx, 'big')}</div>
      <p>Игрок (<b>${esc(C[fromIx].name)}</b>) предлагает военный союз против остальных.</p>
      <div class="actions"><button class="btn" data-a="no">Отказать</button><button class="btn" data-a="yes">Принять союз</button></div>`,
    () => ACTIONS.allianceAnswer(fromIx, true), () => ACTIONS.allianceAnswer(fromIx, false));
  say(`Предложение союза отправлено игроку (${esc(C[toIx].name)})`, '', [toIx]);
}

// ---------- конец игры: побеждает последний выживший игрок ----------
function mpOnEliminated(ix) {
  if (MP.role !== 'host' || MP.humansTotal < 2) return;
  const g = guestByPl(ix);
  if (g) { sendTo(g, { t: 'gameover', win: false }); g.pl = -1; }
  if (ix === PL) setTimeout(() => gameOverModal(false), 60);
  const alive = humanPls().filter(h => h !== ix && C[h].alive);
  if (alive.length === 1 && !MP.winnerSent) {
    MP.winnerSent = true;
    const wg = guestByPl(alive[0]);
    if (wg) sendTo(wg, { t: 'gameover', win: true });
    else setTimeout(() => gameOverModal(true), 80);
    toast(`🏆 Победитель: <b>${esc(C[alive[0]].name)}</b> — последний выживший игрок!`, 'good', [alive[0]]);
  }
}

// ---------- сериализация ----------
const NUMF = ['cells', 'pop', 'cities', 'morale', 'popF', 'econ', 'epiUntil', 'aid', 'capProv', 'overlord', 'strMul', 'bomb'];
function serWars() { return G.wars.map(w => ({ id: w.id, name: w.name, start: w.start, leaders: w.leaders, sides: [[...w.sides[0]], [...w.sides[1]]] })); }
function serMeta(allFlags) {
  const flags = {};
  for (const c of C) {
    if (allFlags) flags[c.ix] = c.flag;
    else if ((c.flagVer || 0) !== (MP.flagSent[c.ix] || 0)) { flags[c.ix] = c.flag; MP.flagSent[c.ix] = c.flagVer || 0; }
  }
  return {
    t: 'meta', flags,
    list: C.map(c => [c.id, c.name, c.color, c.leader, c.currency, c.cont, c.pc, c.gdpPc, c.breakFrom == null ? -1 : c.breakFrom, [...c.aidFrom], c.empire ? 1 : 0]),
    alliances: G.alliances.map(a => [a.name, [...a.members], a.mine ? 1 : 0]),
  };
}
function serState(forceWars) {
  const num = new Float64Array(C.length * (NUMF.length + 1));
  C.forEach((c, i) => { const b = i * (NUMF.length + 1); NUMF.forEach((f, k) => (num[b + k] = +c[f] || 0)); num[b + NUMF.length] = c.alive ? 1 : 0; });
  const st = {
    t: 'state', dayN: G.dayN, date: [G.day.getFullYear(), G.day.getMonth(), G.day.getDate()], speed: G.speed,
    paused: G.paused || MP.waiting, growth: G.growth, humans: humanPls(), n: C.length, num: num.buffer,
    flights: G.flights.map(f => [f.by, f.from, f.to, f.target, f.kind, f.t]), orders: G.orders,
    epi: G.epi ? [G.epi.name, [...G.epi.infected]] : null,
  };
  const sig = JSON.stringify(serWars());
  if (forceWars || sig !== MP.warsSig) { MP.warsSig = sig; st.wars = JSON.parse(sig); }
  return st;
}
function broadcastState() {
  const st = serState(false);
  for (const g of MP.guests) if (g.ready) sendTo(g, Object.assign({}, st, { you: g.pl }));
}
function flushCells() {
  if (!MP.cellBuf.length) return;
  mpBroadcast({ t: 'cells', d: new Int32Array(MP.cellBuf).buffer });
  MP.cellBuf = [];
}
let mpTick = 0;
setInterval(() => {
  if (!MP.live || !G) return;
  flushCells();
  mpTick++;
  if (mpTick % 2 === 0) broadcastState();
  if (mpTick % 14 === 0) mpBroadcast(serMeta(false));
}, 150);

// ---------- хост ----------
function mpStartHost(maxGuests) {
  MP.role = 'host'; MP.code = mpCode(); MP.maxGuests = maxGuests; MP.waiting = true;
  const peer = MP.peer = new Peer(PEER_PREFIX + MP.code);
  hostWaitModal('Подключаемся к серверу связи…');
  peer.on('open', () => hostWaitModal());
  peer.on('error', err => {
    if (err.type === 'unavailable-id') { try { peer.destroy(); } catch (e) {} return mpStartHost(maxGuests); }
    hostWaitModal('Ошибка связи: ' + (err.type || err.message) + '. Проверьте интернет.');
  });
  peer.on('connection', conn => {
    if (MP.guests.length >= MP.maxGuests) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
    const g = { conn, pl: -1, ready: false };
    MP.guests.push(g);
    conn.on('open', () => conn.send({ t: 'hello', host: C[PL].id, hostName: C[PL].name, taken: takenIsos() }));
    conn.on('data', m => onHostData(g, m));
    conn.on('close', () => {
      const i = MP.guests.indexOf(g); if (i < 0) return;
      MP.guests.splice(i, 1); mpRefresh();
      if (g.ready) toast(`🔌 Игрок (${esc(g.pl >= 0 ? C[g.pl].name : '…')}) отключился. Его страной теперь управляет ИИ.`, 'war');
      else if (MP.waiting) hostWaitModal();
      hudDirty = true;
    });
  });
}
const takenIsos = () => humanPls().map(ix => C[ix].id);
function hostWaitModal(note) {
  if (!MP.waiting) return;
  const joined = MP.guests.filter(g => g.ready);
  const list = joined.map(g => `<div class="mp-joined">${flagTag(g.pl)} <b>${esc(C[g.pl].name)}</b> — готов</div>`).join('');
  modal(`<h2>👥 Ждём друзей (${joined.length}/${MP.maxGuests})</h2>
    <p>Отправьте друзьям этот код. Они откроют игру, нажмут «Играть с друзьями» → «Подключиться» и введут код:</p>
    <div class="mp-code">${MP.code}</div>
    ${list}
    <p class="muted">${esc(note || 'Время стоит на паузе, пока все не выберут страны.')}</p>
    <div class="actions"><button class="btn" data-a="cancel">Отменить</button><button class="btn" data-a="copy">📋 Код</button>
    ${joined.length ? '<button class="btn" data-a="go">▶ Начать сейчас</button>' : ''}</div>`,
  { cancel: () => { mpReset(); toast('Игра по сети отменена — играете один'); renderHud(); },
    copy: () => { try { navigator.clipboard.writeText(MP.code); } catch (e) {} hostWaitModal('Код скопирован!'); },
    go: () => startMatch() });
}
function startMatch() {
  MP.waiting = false; MP.humansTotal = humanPls().length;
  closeModal();
  const names = MP.guests.filter(g => g.ready).map(g => C[g.pl].name).join(', ');
  toast(`⚔ Игра началась! Игроки: <b>${esc(C[PL] ? C[PL].name : '')}</b>, <b>${esc(names)}</b>. Каждый сам за себя — побеждает последний выживший!`, 'good', humanPls());
  hudDirty = true;
}
function onHostData(g, m) {
  if (!m || !G) return;
  if (m.t === 'pick') {
    const ix = isoIx[m.iso];
    if (ix == null || !C[ix].alive || humanPls().includes(ix)) return sendTo(g, { t: 'pickFail', reason: 'Эта страна уже занята — выберите другую', taken: takenIsos() });
    flushCells(); // остальные друзья получают накопленное до снимка мира
    g.pl = ix; g.ready = true; mpRefresh();
    const diff = [];
    for (let i = 0; i < NCELL; i++) { const p = provOf[i]; if (p !== SEA && owner[i] !== provOwner0[p]) diff.push(i, owner[i]); }
    sendTo(g, { t: 'init', iso: m.iso, meta: serMeta(true), state: Object.assign(serState(true), { you: ix }), cells: new Int32Array(diff).buffer });
    MP.warsSig = ''; // остальным тоже переслать войны
    showToast(`👥 Игрок подключился и выбрал страну <b>${esc(C[ix].name)}</b>`, 'good', [ix]);
    if (MP.waiting) { if (MP.guests.filter(x => x.ready).length >= MP.maxGuests) startMatch(); else hostWaitModal(); }
    else MP.humansTotal = Math.max(MP.humansTotal, humanPls().length);
    hudDirty = true;
  } else if (m.t === 'cmd' && ACTIONS[m.name] && g.pl >= 0) {
    if ((m.name === 'pause' || m.name === 'speed') && MP.waiting) return;
    asPlayer(g.pl, () => ACTIONS[m.name](...(m.args || [])));
    hudDirty = true;
  }
}

// ---------- друг (гость) ----------
function mpJoin(code) {
  code = code.trim().toUpperCase();
  if (code.length < 4) return mpStatus('Введите код, который прислал друг');
  mpReset();
  MP.role = 'guest'; MP.code = code;
  mpStatus('Подключаемся…');
  const peer = MP.peer = new Peer();
  peer.on('open', () => {
    const conn = MP.conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    const to = setTimeout(() => { if (!conn.open) mpStatus('Не удалось найти игру с таким кодом. Проверьте код и что друг ждёт подключения.'); }, 9000);
    conn.on('open', () => { clearTimeout(to); mpStatus('Подключено! Ждём ответ…'); });
    conn.on('data', onGuestData);
    conn.on('close', () => {
      if (MP.role !== 'guest') return;
      if ($('#screen-game').classList.contains('active'))
        modal(`<h2>🔌 Связь потеряна</h2><p>Хост закрыл игру или пропал интернет.</p><div class="actions"><button class="btn" data-a="menu">В главное меню</button></div>`, { menu: toMenu });
      else mpStatus('Связь потеряна');
      MP.role = null;
    });
  });
  peer.on('error', err => mpStatus(err.type === 'peer-unavailable' ? 'Игра с таким кодом не найдена' : 'Ошибка связи: ' + (err.type || err.message)));
}
function onGuestData(m) {
  if (!m) return;
  if (m.t === 'full') return mpStatus('В этой игре уже нет свободных мест');
  if (m.t === 'hello') {
    MP.taken = m.taken || [m.host];
    creativeMode = false;
    buildFlagGrid();
    $('#screen-country h2').textContent = `Выберите страну · хост играет за: ${m.hostName}`;
    $('#screen-country [data-back]').dataset.back = 'screen-mp';
    show('screen-country');
    return;
  }
  if (m.t === 'pickFail') {
    MP.taken = m.taken || MP.taken;
    $$('.flag-card').forEach(card => card.classList.toggle('taken', MP.taken.includes(card.dataset.iso)));
    $('#screen-country h2').textContent = 'Эта страна занята — выберите другую';
    return showToast(m.reason, 'war');
  }
  if (m.t === 'init') return guestStart(m);
  if (!G) return;
  if (m.t === 'cells') {
    const d = new Int32Array(asBuf(m.d));
    for (let k = 0; k < d.length; k += 2) guestSetOwner(d[k], d[k + 1]);
  } else if (m.t === 'state') applyState(m);
  else if (m.t === 'meta') applyMeta(m);
  else if (m.t === 'toast') showToast(m.html, m.kind, m.flags || []);
  else if (m.t === 'modal') modal(m.html);
  else if (m.t === 'ping') ping(m.xy, m.color, m.icon);
  else if (m.t === 'peaceOffer') modal(`<h2>🕊 Предложение мира</h2><div class="center">${flagTag(m.fromIx, 'big')}</div>
      <p>Игрок (<b>${esc(m.from)}</b>) предлагает заключить мир.</p>
      <div class="actions"><button class="btn" data-a="no">Отказать</button><button class="btn" data-a="yes">Заключить мир</button></div>`,
    { yes: () => act('peaceAnswer', m.id, true), no: () => act('peaceAnswer', m.id, false) });
  else if (m.t === 'allianceOffer') modal(`<h2>🤝 Предложение союза</h2><div class="center">${flagTag(m.fromIx, 'big')}</div>
      <p>Игрок (<b>${esc(m.from)}</b>) предлагает военный союз против остальных.</p>
      <div class="actions"><button class="btn" data-a="no">Отказать</button><button class="btn" data-a="yes">Принять союз</button></div>`,
    { yes: () => act('allianceAnswer', m.fromIx, true), no: () => act('allianceAnswer', m.fromIx, false) });
  else if (m.t === 'gameover') gameOverModal(m.win);
}
function guestSetOwner(i, n) {
  const o = owner[i];
  if (o === n || o === SEA) return;
  owner[i] = n;
  while (C.length <= n) makeCountry({ id: 'N?', name: '…', flag: '', color: '#888888' });
  colorCell(i);
  const x = i % RW;
  if (x > 0) colorCell(i - 1);
  if (x < RW - 1) colorCell(i + 1);
  if (i >= RW) colorCell(i - RW);
  if (i + RW < NCELL) colorCell(i + RW);
  const key = (((i / RW) / 36) | 0) * 1000 + ((x / 36) | 0);
  let e = capLog.get(key); if (!e) capLog.set(key, (e = new Map()));
  const pk = n * CAP + o; e.set(pk, (e.get(pk) || 0) + 1);
  labelsDirty = true;
}
function applyMeta(m) {
  let recolor = false;
  m.list.forEach((r, ix) => {
    const c = C[ix] || makeCountry({ id: r[0], name: r[1], flag: '', color: r[2] });
    Object.assign(c, { id: r[0], name: r[1], leader: r[3], currency: r[4], cont: r[5], pc: r[6], gdpPc: r[7], breakFrom: r[8] >= 0 ? r[8] : undefined, empire: !!r[10] });
    c.aidFrom = new Set(r[9]);
    if (c.color !== r[2]) { setColor(c, r[2]); recolor = true; }
  });
  for (const [ix, f] of Object.entries(m.flags || {})) { C[ix].flag = f; C[ix].fallbackFlag = null; }
  G.alliances = m.alliances.map(([name, members, mine]) => ({ name, members: new Set(members), mine: !!mine }));
  labelsDirty = true; hudDirty = true;
  if (recolor) recolorAll();
}
function applyState(m) {
  G.dayN = m.dayN; G.day = new Date(m.date[0], m.date[1], m.date[2]); G.speed = m.speed; G.paused = m.paused; G.growth = m.growth;
  while (C.length < m.n) makeCountry({ id: 'N?', name: '…', flag: '', color: '#888888' });
  const num = new Float64Array(asBuf(m.num)), W1 = NUMF.length + 1;
  for (let i = 0; i < m.n; i++) {
    const c = C[i], b = i * W1;
    NUMF.forEach((f, k) => (c[f] = num[b + k]));
    c.alive = num[b + NUMF.length] === 1;
  }
  const newPL = m.you;
  if (newPL !== PL) { if (newPL < 0 && PL >= 0) G.watching = PL; PL = newPL; recolorAll(); }
  MP.humans = m.humans || [];
  G.flights = m.flights.map(([by, from, to, target, kind, t]) => ({ by, from, to, target, kind, t }));
  G.orders = m.orders || {};
  G.epi = m.epi ? { name: m.epi[0], infected: new Set(m.epi[1]) } : null;
  if (m.wars) { G.wars = m.wars.map(w => ({ id: w.id, name: w.name, start: w.start, leaders: w.leaders, sides: [new Set(w.sides[0]), new Set(w.sides[1])] })); warsChanged(); }
  hudDirty = true;
}
function guestStart(m) {
  newGame(m.iso, 'normal', false);
  G.wars = [];
  applyMeta(m.meta);
  const d = new Int32Array(asBuf(m.cells));
  for (let k = 0; k < d.length; k += 2) owner[d[k]] = d[k + 1];
  applyState(m.state);
  recolorAll();
  hideOverlays(); setMode(null); closeModal();
  toastBox.innerHTML = '';
  show('screen-game');
  labelsDirty = true; computeLabels(); computeAdj();
  renderHud();
  d3.select(cv).call(zoom.transform, d3.zoomIdentity);
  setTimeout(() => focusCountry(PL), 100);
  const others = MP.humans.filter(h => h !== PL).map(h => C[h].name).join(', ');
  showToast(`👥 Вы играете за страну <b>${esc(C[PL].name)}</b>. Соперники: ${esc(others)}. Каждый сам за себя!`, 'good', [PL]);
  if (m.state.paused) showToast('⏳ Ждём остальных игроков — время пока стоит');
}
function gameOverModal(win) {
  modal(win ? `<h2>🏆 Победа!</h2><p>Все соперники пали. Вы — последний выживший игрок!</p>
      <div class="actions"><button class="btn" data-a="menu">В главное меню</button><button class="btn" data-a="ok">Продолжить</button></div>`
    : `<h2>💀 Поражение</h2><p>Ваша страна пала. Можно наблюдать, чем закончится битва остальных.</p>
      <div class="actions"><button class="btn" data-a="menu">В главное меню</button><button class="btn" data-a="ok">Наблюдать</button></div>`, { menu: toMenu });
}

// ---------- меню ----------
$('#btn-mp').onclick = () => { mpReset(); mpStatus(''); show('screen-mp'); setTimeout(() => $('#mp-code').focus(), 50); };
$$('.mp-host').forEach(b => (b.onclick = () => {
  if (typeof Peer === 'undefined') return mpStatus('Не загрузилась библиотека связи — нужен интернет');
  mpReset(); MP.pendingHost = +b.dataset.guests; creativeMode = false; chosenDiff = 'normal';
  buildFlagGrid();
  $('#screen-country h2').textContent = `Игра ${MP.pendingHost === 2 ? 'на троих' : 'на двоих'} — выберите свою страну`;
  $('#screen-country [data-back]').dataset.back = 'screen-mp';
  show('screen-country');
}));
$('#mp-join').onclick = () => { if (typeof Peer === 'undefined') return mpStatus('Не загрузилась библиотека связи — нужен интернет'); mpJoin($('#mp-code').value); };
$('#mp-code').onkeydown = e => { if (e.key === 'Enter') $('#mp-join').click(); };
function onPickCountry(iso) {
  if (MP.role === 'guest') {
    if (MP.taken.includes(iso)) return showToast('Эту страну уже выбрал другой игрок', 'war');
    mpSend({ t: 'pick', iso });
    $('#screen-country h2').textContent = 'Подключаемся к миру…';
    return;
  }
  const host = MP.pendingHost;
  if (!host && MP.role) mpReset();
  startGame(iso, chosenDiff, creativeMode);
  if (host) { MP.pendingHost = false; mpStartHost(host); }
}

// ======================= Старт / меню =======================
function startGame(iso, diff, creative) {
  if (G && G.paint) stopPaint();
  if (globe.on) exitGlobe(true);
  newGame(iso, diff, creative);
  hideOverlays(); setMode(null); closeModal();
  $('#speed-pop').classList.add('hidden');
  toastBox.innerHTML = '';
  show('screen-game');
  labelsDirty = true; computeLabels(); computeAdj();
  renderHud();
  d3.select(cv).call(zoom.transform, d3.zoomIdentity);
  setTimeout(() => focusCountry(PL), 100);
  say(`Вы управляете страной <b>${esc(C[PL].name)}</b>. 1 секунда = 1 день. Пробел — пауза.`, 'good', [PL]);
  setTimeout(() => say('ЛКМ — информация и независимость. ПКМ по своей стране — война, по чужой — союз, по врагу — наступление, авиаудар, десант.'), 1200);
  if (creative) setTimeout(() => say('Творческий режим: ПКМ по стране — забрать, закрашивать, вассал, сила. ⋯ у времени — скорость до 100×.', 'good'), 2400);
  setTimeout(() => say('Отдалите карту колёсиком до упора — карта превратится в глобус.'), 3600);
}
function toMenu() { closeModal(); closeSettings(); mpReset(); if (G) G.paused = true; show('screen-menu'); }
resize();
// для отладки из консоли
window.__cf = { get C() { return C; }, get G() { return G; }, get PL() { return PL; }, power, powC, owner, get WB() { return WB; }, toScreen, provXY };
})();
