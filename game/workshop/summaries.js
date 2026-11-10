// Extra views per area for the workshop inspector: derived values and small previews.
// SUMMARY[area](w, x, id) → { title, body } | null. Only reads, never changes data.
import { el } from '../ui.js';
import { ROOM_TAGS } from '../../engine/project.js';
import { buildPoi, poiReady } from '../../engine/poi.js';
import { parseRoom } from '../../engine/room.js';

const ROOM_COLORS = { '#': '#8b919c', '=': '#d4a72c', H: '#5fb4d9', o: '#e45aa8', L: '#3fe0d0', C: '#c08a4a', S: '#7ee0a0', D: '#5b8a6a', B: '#6e5a7a', Z: '#ffd27a', 1: '#ff8a5c', A: '#b0b8c4', '^': '#3fe0d0', v: '#3fe0d0' };
const ROOM_LEGEND = [['#', 'Wand'], ['=', 'Plattform'], ['H', 'Leiter'], ['o', 'Seil'], ['L', 'Start'], ['x', 'Gegner'], ['C', 'Kiste'], ['S', 'Schalter'], ['D', 'Tür'], ['B', 'Brüchig'], ['Z', 'Ziel'], ['^', 'Abkürzung']];
// a layout as a small map (rooms and POI levels)
function roomMap(r, maxW = 300) {
  const px = Math.max(2, Math.min(8, Math.floor(maxW / Math.max(1, r.w))));
  const c = el('canvas', { class: 'ng-roomMap', width: r.w * px, height: r.h * px }), g = c.getContext('2d');
  for (let y = 0; y < r.h; y++) for (let x2 = 0; x2 < r.w; x2++) {
    const t = r.tiles[y][x2];
    if (t === '.') continue;
    g.fillStyle = ROOM_COLORS[t] || '#e5484d';
    if (t === '=') g.fillRect(x2 * px, y * px, px, Math.max(1, px / 3));
    else if (t === 'H') g.fillRect(x2 * px + px / 4, y * px, px / 2, px);
    else g.fillRect(x2 * px, y * px, px, px);
  }
  return c;
}
const roomLegend = () => el('div', { class: 'ng-legend' }, ...ROOM_LEGEND.map(([k, n]) => el('span', {}, el('i', { style: `background:${ROOM_COLORS[k] || '#e5484d'}` }), n)));

const f1 = n => (Math.round(n * 10) / 10).toLocaleString('de-DE');
const facts = rows => el('div', { class: 'ng-facts' }, ...rows.filter(Boolean).map(([k, v]) => el('div', {}, el('span', {}, k), el('b', {}, v))));

// Backpack-style grid: w × h fields, optionally with a highlighted block
function grid(w, h, block = null, cell = 16) {
  w = Math.max(1, Math.min(12, w | 0)); h = Math.max(1, Math.min(12, h | 0));
  const g = el('div', { class: 'ng-grid', style: `grid-template-columns:repeat(${w},${cell}px)` });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.append(el('i', { class: block && x < block[0] && y < block[1] ? 'on' : '' }));
  return g;
}
const sizeView = (x, base = [4, 3]) => {
  const [w, h] = x.size || [1, 1];
  return { title: 'Im Rucksack', body: el('div', {}, grid(Math.max(base[0], w), Math.max(base[1], h), [w, h]), el('p', { class: 'ed-small' }, `Belegt ${w}×${h} = ${w * h} Felder.`)) };
};

export const SUMMARY = {
  leyla(w, x) {
    const g = w.p.data.game?.gravity || 1800, t = w.p.data.game?.tileSize || 32, m = x.movement || {};
    const jump = (m.jumpVelocity || 0) ** 2 / (2 * g);
    return { title: 'Abgeleitet', body: el('div', {}, facts([
      ['Sprunghöhe', `${Math.round(jump)} px · ${f1(jump / t)} Kacheln`],
      m.airJumps ? ['mit Luftsprüngen', `${Math.round(jump * (1 + m.airJumps))} px · ${f1(jump * (1 + m.airJumps) / t)} Kacheln`] : null,
      ['Zeit in der Luft', `${f1(2 * (m.jumpVelocity || 0) / g)} s`],
      ['Rennen', `${f1((m.runSpeed || 0) / t)} Kacheln/s`],
      ['Dash', `${f1((m.dashDistance || 0) / t)} Kacheln`],
      ['Slide', `${f1((m.slideSpeed || 0) * (m.slideDuration || 0) / 1000 / t)} Kacheln`],
    ]), el('p', { class: 'ed-small' }, `Mit Schwerkraft ${g} px/s² und Kacheln zu ${t} px (Bereich „Spiel“).`)) };
  },

  game(w, x) {
    const D = w.p.data, s = x.start || {}, tr = D.tractors?.[s.tractor];
    const containers = (s.containers || []).map(c => D.containers?.[c]).filter(Boolean), shops = (s.workshops || []).map(k => D.workshops?.[k]).filter(Boolean);
    const places = containers.reduce((n, c) => n + (c.places || 0), 0), used = shops.reduce((n, k) => n + (k.places || 0), 0);
    const power = (tr?.power || 0) + shops.reduce((n, k) => n + (k.power || 0), 0), weight = containers.reduce((n, c) => n + (c.weight || 0), 0);
    // doll house: tractor on the left, containers with their places filled by workshops
    const queue = shops.flatMap(k => Array(k.places || 1).fill(k.name));   // one name per occupied place
    const house = el('div', { class: 'ng-rig' }, el('div', { class: 'ng-rig-tractor' }, tr?.name || '–'),
      ...containers.map(c => el('div', { class: 'ng-rig-container' }, el('small', {}, c.name), el('div', { class: 'ng-rig-places' }, ...Array.from({ length: c.places || 0 }, () => {
        const k = queue.shift();
        return el('span', { class: k ? 'on' : '' }, k || 'frei');
      })))));
    const z = x.camera?.zoom || 1, [rw, rh] = x.resolution || [1920, 1080], t = x.tileSize || 64;
    const view = { title: 'Kamera', body: facts([['Sichtbar', `${Math.round(rw / z)} × ${Math.round(rh / z)} px · ${f1(rw / z / t)} × ${f1(rh / z / t)} Kacheln`]]) };
    return [view, { title: 'Start-Rig', body: el('div', {}, house, facts([
      ['Werkstatt-Plätze', `${used} von ${places}`], ['Energie', `${power >= 0 ? '+' : ''}${power} ⚡`], ['Gewicht', `${weight} kg von ${tr?.pull ?? '?'} kg Zugkraft`]])) }];
  },

  splash(w, x) {
    const url = new URL('../../index.html?preview', import.meta.url).href;
    const frame = el('iframe', { src: url, class: 'ng-splash', title: 'Startseite', loading: 'lazy' });
    const reload = el('button', { class: 'ed-button wide', title: 'Speichert und lädt die Vorschau neu', onclick: async () => { if (w.dirty.size) await w.persist(); frame.src = url + '#' + Date.now(); } }, 'Speichern und neu laden');
    return { title: 'Vorschau', body: el('div', {}, frame, el('p', { class: 'ed-small' }, 'Zeigt den gespeicherten Stand. Maus über die Vorschau bewegen = Tiefe der Ebenen.'), reload) };
  },

  ranking(w, x) {
    const max = (x.points?.time || 0) + (x.points?.kills || 0) + (x.points?.secrets || 0) || 1, g = x.grades || [];
    return { title: `Leiter · ${max} Punkte möglich`, body: el('div', { class: 'ng-ladder' }, ...g.map((r, i) => {
      const to = g[i + 1]?.minPoints ?? max;
      return el('div', { class: 'ng-ladder-step', style: `left:${(r.minPoints || 0) / max * 100}%;width:${Math.max(0, to - (r.minPoints || 0)) / max * 100}%` }, el('b', {}, r.grade), el('small', {}, `+${r.bonus ?? 0} %`));
    })) };
  },

  travel(w, x) {
    const D = w.p.data, s = D.game?.start || {}, tr = D.tractors?.[s.tractor];
    if (!tr) return null;
    const tons = (s.containers || []).reduce((n, c) => n + (D.containers?.[c]?.weight || 0), 0) / 1000;
    const fuel = (tr.fuelUse || 0) * (1 + tons * (x.weightFuelFactor || 0) / 100), hours = 100 / (x.speed || 1), heads = 1 + (s.companions || []).length;
    return { title: 'Beispiel: 100 km mit dem Start-Rig', body: facts([['Sprit', `${f1(fuel)} l (Tank ${tr.tank} l)`], ['Fahrzeit', `${f1(hours)} Spiel-h`], ['Vorräte', `${f1(hours / (x.dayLength || 24) * (x.foodPerDay || 0) * heads)} Rationen`],
      ['Encounter', `ca. ${f1((x.encounterChance || 0) / 10)} erwartet`]]) };
  },

  backpacks: (w, x) => { const [a, b] = x.size || [1, 1]; return { title: 'Raster', body: el('div', {}, grid(a, b), el('p', { class: 'ed-small' }, `${a * b} Felder.`)) }; },
  items: (w, x) => sizeView(x),
  weapons: (w, x) => sizeView(x),

  lootTables(w, x) {
    const e = x.entries || [], sum = e.reduce((n, r) => n + (r.weight || 0), 0) || 1;
    return { title: 'Chance pro Wurf', body: el('div', { class: 'ng-bars' }, ...[...e].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map(r =>
      el('div', {}, el('span', {}, w.p.data.items?.[r.item]?.name || r.item), el('i', { style: `--p:${(r.weight || 0) / sum * 100}%` }), el('b', {}, `${Math.round((r.weight || 0) / sum * 100)} %`)))) };
  },

  recipes(w, x) {
    const I = w.p.data.items || {}, n = id => I[id]?.name || id || '?';
    const value = (x.ingredients || []).reduce((s, i) => s + (I[i.item]?.value || 0) * (i.count || 0), 0), out = (I[x.result]?.value || 0) * (x.count || 1);
    return { title: 'Bilanz', body: el('div', {}, el('p', { class: 'ng-formula' }, (x.ingredients || []).map(i => `${i.count}× ${n(i.item)}`).join(' + ') || '–', ' → ', el('b', {}, `${x.count || 1}× ${n(x.result)}`)),
      facts([['Wert der Zutaten', `${value} Δ`], ['Wert des Ergebnisses', `${out} Δ`], ['Gewinn', `${out - value >= 0 ? '+' : ''}${out - value} Δ`]])) };
  },

  tractors(w, x) {
    const C = Object.values(w.p.data.containers || {});
    return { title: 'Payload', body: el('div', {}, facts([['Container-Plätze', `${x.length || 0} hintereinander × ${x.stack || 1} hoch`]]),
      el('p', { class: 'ed-small' }, 'Zieht allein: ' + (C.filter(c => (c.weight || 0) <= (x.pull || 0)).map(c => c.name).join(', ') || 'nichts'))) };
  },

  pois(w, x, id) {
    const R = w.p.data.rooms || {}, tags = new Set((x.rooms || []).flatMap(r => R[r]?.tags || []));
    const tagBox = el('div', { class: 'da-tags' }, ...ROOM_TAGS.map(([k, n]) => el('span', { class: 'da-tag' + (tags.has(k) ? ' ng-yes' : ' ng-no') }, (tags.has(k) ? '✓ ' : '– ') + n)));
    const ready = poiReady(w.p.data, id);
    if (!ready.ok) return { title: 'Level', body: el('div', {}, tagBox, el('p', { class: 'ed-small' }, `Noch kein Level: ${ready.why}.`)) };
    // the generated level as a map; „Neu würfeln“ shows another one, „Im Spiel testen“ plays exactly this one
    const box = el('div', {});
    let seed = x.seed || 1;
    const draw = () => {
      const L = buildPoi(w.p.data, id, seed), r = parseRoom(L.def), main = L.rooms.filter(o => o.band === 'main').map(o => R[o.id]?.name || o.id);
      box.replaceChildren(roomMap(r, 320), roomLegend(), facts([
        ['Hauptweg', main.join(' → ')],
        ['Abzweige', L.rooms.filter(o => o.band === 'branch').map(o => R[o.id]?.name || o.id).join(', ') || 'keine'],
        ['Abkürzung', L.shortcut ? 'Tunnel vom Ausgang zum Eingang' : 'keine'],
        ['Kisten · Secrets · Gegner', `${r.marks.C.length} · ${new Set(r.marks.B.map(([bx]) => bx)).size} · ${r.spawns.length}`],
        ['Größe', `${r.w} × ${r.h} Kacheln · Seed ${seed}`],
        ...L.problems.map(t => ['Hinweis', t])]),
      el('div', { style: 'display:flex;gap:8px;margin-top:8px' },
        el('button', { class: 'ed-button', onclick: () => { seed = 1 + Math.floor(Math.random() * 1e6); draw(); } }, 'Neu würfeln'),
        el('button', { class: 'ed-button wide', title: 'Speichert vorher, damit das Spiel deinen Stand hat', onclick: () => w.play(null, `?poi=${encodeURIComponent(id)}&seed=${seed}`) }, 'Im Spiel testen')));
    };
    draw();
    return { title: 'Level', body: el('div', {}, tagBox, box) };
  },

  rooms(w, x, id) {
    if (!x.layout?.length) return { title: 'Layout', body: el('p', { class: 'ed-small' }, 'Noch kein Layout. Ein Zeichen pro Kachel, siehe Hinweis beim Feld „Kacheln“.') };
    const r = parseRoom(x), c = roomMap(r);
    const enemies = r.spawns.map(s => w.p.data.enemies?.[s.enemy]?.name || s.enemy);
    const count = enemies.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
    const legend = roomLegend();
    const play = el('button', { class: 'ed-button wide', title: 'Speichert vorher, damit das Spiel deinen Stand hat', onclick: () => w.play(id) }, 'Im Spiel testen');
    return { title: `Layout · ${r.w}×${r.h} Kacheln`, body: el('div', {}, c, legend, facts([
      ['Gegner', Object.entries(count).map(([n, k]) => `${k}× ${n}`).join(', ') || 'keine'],
      ['Leitern · Seile · Plattformen', `${r.ladders.length} · ${r.anchors.length} · ${r.platforms.length} Kacheln`],
      ['In Pixeln', `${r.w * (w.p.data.game?.tileSize || 64)} × ${r.h * (w.p.data.game?.tileSize || 64)}`]]), play) };
  },

  locations(w, x, id) {
    const L = Object.entries(w.p.data.locations || {}), xs = L.map(([, l]) => l.position?.[0] || 0), ys = L.map(([, l]) => l.position?.[1] || 0);
    const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, y0 = Math.min(...ys) - 5, y1 = Math.max(...ys) + 5, W = 300, H = Math.max(120, W * (y1 - y0) / (x1 - x0 || 1));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'ng-map');
    svg.innerHTML = L.map(([k, l]) => {
      const px = ((l.position?.[0] || 0) - x0) / (x1 - x0) * W, py = ((l.position?.[1] || 0) - y0) / (y1 - y0) * H, on = k === id;
      return `<circle cx="${px}" cy="${py}" r="${on ? 6 : 4}" class="${on ? 'on' : ''}"/><text x="${px + 8}" y="${py + 4}" class="${on ? 'on' : ''}">${(l.name || k).replace(/[<&]/g, '')}</text>`;
    }).join('');
    return { title: 'Oberwelt', body: el('div', {}, svg, el('p', { class: 'ed-small' }, `Region: ${x.region || '–'} · POI: ${w.p.data.pois?.[x.poi]?.name || x.poi || '–'}`)) };
  },
};
