// Extra views per area for the workshop inspector: derived values and small previews.
// SUMMARY[area](w, x, id) → { title, body } | null. Only reads, never changes data.
import { el } from '../ui.js';
import { WEAR_SLOTS, TROPHY_GEAR } from '../../engine/schema.js';
import { ROOM_TAGS } from '../../engine/project.js';
import { buildPoi, poiReady } from '../../engine/poi.js';
import { parseRoom } from '../../engine/room.js';
import { generateMap, neighbours } from '../worldmap.js';
import { makeRoad, landscapeOf, ROADSIDE, BW, BH } from '../road.js';
import { mapBrands } from '../brands.js';
import { generateEncounter, eventsConfig } from '../road_events.js';
import { gangs } from '../reputation.js';
import { generate, brandOf } from '../glitchlings.js';
import { characterOf, characters } from '../banter.js';
import { faceCanvas } from '../glitch_face.js';
import { drawMap } from '../map_render.js';

const ROOM_COLORS = { '#': '#8b919c', '=': '#d4a72c', H: '#5fb4d9', o: '#e45aa8', L: '#3fe0d0', C: '#c08a4a', S: '#7ee0a0', D: '#5b8a6a', B: '#6e5a7a', Z: '#ffd27a', 1: '#ff8a5c', A: '#b0b8c4', '^': '#3fe0d0', v: '#3fe0d0', '*': '#fff2a8', '%': '#9a7ab8', $: '#8a6e9a' };
const ROOM_LEGEND = [['#', 'Wand'], ['=', 'Plattform'], ['H', 'Leiter'], ['o', 'Seil'], ['L', 'Start'], ['x', 'Gegner'], ['C', 'Kiste'], ['S', 'Schalter'], ['D', 'Tür'], ['B', 'Brüchig'], ['%', 'Scheinwand'], ['$', 'Getarnt brüchig'], ['Z', 'Ziel'], ['^', 'Abkürzung'], ['*', 'Lampe']];
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

// #074 Verzahnungs-Ansichten: who sets a Merker, who reads it (answers, quests → situations, quests, answers)
const listOf = v => String(v || '').split(',').map(t => t.trim()).filter(Boolean);
export function flagGraph(D) {
  const G = new Map(), at = f => { if (!G.has(f)) G.set(f, { set: [], clear: [], read: [], not: [] }); return G.get(f); };
  const E = D.roadEvents || {};
  for (const a of E.answers || []) for (const f of listOf(a.flag)) (f.startsWith('-') ? at(f.slice(1)).clear : at(f).set).push(`Antwort „${a.id}“`);
  for (const [id, q] of Object.entries(D.quests || {})) if (q.flag) at(q.flag).set.push(`Quest „${q.name || id}“ (beim Annehmen)`);
  for (const s of E.situations || []) { for (const f of [...listOf(s.needs), ...listOf(s.needsFlag)]) at(f).read.push(`Lage „${s.id}“`); for (const f of [...listOf(s.not), ...listOf(s.notFlag)]) at(f).not.push(`Lage „${s.id}“`); }
  for (const [id, q] of Object.entries(D.quests || {})) { for (const f of listOf(q.needsFlag)) at(f).read.push(`Quest „${q.name || id}“`); for (const f of listOf(q.notFlag)) at(f).not.push(`Quest „${q.name || id}“`); }
  return G;
}
// story chains: situation —answer→ next situation
export function chainEdges(D) {
  const out = [];
  for (const s of D.roadEvents?.situations || []) for (const r of listOf(s.answers)) { const [a, next] = r.split('>').map(t => t.trim()); if (next) out.push({ from: s.id, answer: a, to: next }); }
  return out;
}
const tag = (t, cls = '') => el('span', { class: 'ng-xtag ' + cls }, t);

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
        ['Aufbau', L.stack === 'tower' ? 'Turm: vom Eingang nach oben' : L.stack === 'deep' ? 'Tiefe: vom Eingang nach unten' : 'Nebeneinander'],
        ['Abkürzung', !L.shortcut ? 'keine' : L.shortcut.kind === 'shaft' ? 'Schacht mit Leiter neben dem Stapel, Tür unten' : 'Tunnel vom Ausgang zum Eingang'],
        ['Kisten · Secrets · Gegner', `${r.marks.C.length} · ${new Set([...r.marks.B, ...r.marks['%'], ...r.marks.$].map(([bx]) => bx)).size} · ${r.spawns.length}`],
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

  // Entities (#047): one rolled Durchgang as cards, „Neu würfeln“ rolls another (the game will roll one per Durchgang)
  glitchlings(w) {
    const D = w.p.data, box = el('div', { class: 'ng-glitch' }), info = el('p', { class: 'ed-small' });
    let seed = w.glitchSeed ??= 1 + Math.floor(Math.random() * 1e6);
    const paint = () => {
      const list = generate(D, seed);
      box.replaceChildren(...list.map(g => el('div', { style: 'border:1px solid var(--ui-line,#333);border-radius:8px;padding:8px 10px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:start' + (g.unique ? ';border-color:#ffd27a' : '') },
        el('div', { style: 'grid-row:span 5' }, faceCanvas(g, 120)),
        el('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, el('b', { style: 'font:22px/1 VT323,monospace;letter-spacing:.03em' }, g.name), el('span', { title: `${g.bits} Bits`, style: 'color:#20d6c7;letter-spacing:2px' }, '▮'.repeat(g.bits) + '▯'.repeat(5 - g.bits))),
        el('small', {}, `${g.talent}${g.unique ? ' · Unikat' : ''} · `, (b => b ? el('b', { style: `color:${b.color || 'inherit'}` }, b.name) : 'ohne Hersteller')(D.brands?.[brandOf(D, g)]), ` · wohnt in: ${g.home}`), el('span', {}, g.effect), el('small', { style: 'opacity:.75' }, `Macke: ${g.quirk} · Charakter: ${characters(D).find(c => c.id === characterOf(D, g))?.name || '–'}`), el('small', { style: 'opacity:.6;font-style:italic' }, `„${g.wish}“`))));
      const by = {}; for (const g of list) by[g.bits] = (by[g.bits] || 0) + 1;
      info.textContent = `Seed ${seed} · ${list.length} Entities · Stärke ${[1, 2, 3, 4, 5].map(b => `${b} Bit: ${by[b] || 0}`).join(', ')}`;
    };
    paint();
    const again = el('button', { class: 'ed-button wide', onclick: () => { seed = w.glitchSeed = 1 + Math.floor(Math.random() * 1e6); paint(); } }, 'Neu würfeln');
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:8px';
    return { title: 'Ein Durchgang', body: el('div', {}, box, info, again) };
  },
  // a brand (#046): its plate like the tooltip shows it (logo from the raster, name in the brand's colour, slogan) and what it makes
  brands(w, x, id) {
    const D = w.p.data, L = D.assets?.[D.worldmap?.logos], base = new URL('../../projects/nomadgirl/', import.meta.url);
    const [c, r] = L?.grid || [1, 1], i = x.icon, pos = (k, n) => n > 1 ? (k / (n - 1)) * 100 : 0;
    const logo = L?.file && i != null && i < c * r ? el('span', { style: `display:inline-block;width:72px;height:72px;image-rendering:pixelated;background:url("${new URL(L.file, base).href}");background-size:${c * 100}% ${r * 100}%;background-position:${pos(i % c, c)}% ${pos(Math.floor(i / c), r)}%` }) : el('span', { class: 'ed-small' }, 'kein Logo');
    const made = [...Object.values(D.weapons || {}), ...Object.values(D.items || {})].filter(t => t.brand === id).map(t => t.name);
    const kids = Object.entries(D.brands || {}).filter(([, b]) => b.parent === id).map(([, b]) => b.name);
    const ais = [...(D.glitchlings?.talents || []).filter(t => t.brand === id).map(t => t.name), ...(D.glitchlings?.unique || []).filter(u => u.brand === id).map(u => u.name)];
    return { title: 'Markenschild', body: el('div', {},
      el('div', { style: 'display:flex;gap:14px;align-items:center' }, logo, el('div', {}, el('b', { style: `font:26px/1 VT323,monospace;color:${x.color || '#ffd27a'};text-transform:uppercase` }, x.name || id), x.slogan ? el('div', { style: 'font-style:italic;opacity:.8' }, `„${x.slogan}“`) : null)),
      el('p', { class: 'ed-small' }, made.length ? `Stellt her (${made.length}): ${made.join(', ')}` : 'Stellt (noch) nichts her, was Leyla findet.'),
      ais.length ? el('p', { class: 'ed-small' }, `Baut KIs (Entities): ${ais.join(', ')}`) : null,
      kids.length ? el('p', { class: 'ed-small' }, `Töchter: ${kids.join(', ')}`) : null) };
  },
  // #074 Markentreue: what of this brand can be worn at once (one per place, weapons per slot) and what the set gives
  brandSet(w, x, id) {
    const D = w.p.data, S = x.set, wear = Object.entries(D.items || {}).filter(([, t]) => t.brand === id && t.wear), arms = Object.entries(D.weapons || {}).filter(([, t]) => t.brand === id);
    const places = new Map(); for (const [k, t] of wear) { if (!places.has(t.wear)) places.set(t.wear, []); places.get(t.wear).push(t.name || k); }
    const slots = places.size + new Set(arms.map(([, t]) => t.kind || 'ranged')).size, need = Math.max(2, S?.count ?? 3);
    if (!S?.stat && !wear.length && !arms.length) return null;
    return { title: 'Markentreue', body: el('div', {},
      facts([['Set-Bonus', S?.stat ? `${TROPHY_GEAR.find(g => g[0] === S.stat)?.[1] || S.stat} ${S.value > 0 ? '+' : ''}${S.value} ab ${need} Teilen` : '–'], ['Gleichzeitig tragbar', `${slots} Teile`], S?.stat && slots < need ? ['Achtung', 'Der Bonus ist nicht erreichbar'] : null]),
      el('div', { class: 'ng-xlist' }, ...[...places].map(([pl, names]) => el('div', { class: 'ng-xrow' }, el('b', {}, WEAR_SLOTS.find(s => s[0] === pl)?.[1] || pl), el('small', {}, names.join(', ')))),
        arms.length ? el('div', { class: 'ng-xrow' }, el('b', {}, 'Waffen'), el('small', {}, arms.map(([k, t]) => t.name || k).join(', '))) : null)) };
  },
  // #074 a quest: when it is offered (one condition language #068) and where its pieces lie (#057)
  quests(w, x) {
    const D = w.p.data, c = [['Erst mit Merker', x.needsFlag], ['Nicht mit Merker', x.notFlag], ['Ab Tag', x.minDay], ['Nach Auftrag', x.after && (D.quests?.[x.after]?.name || x.after)], ['Erst wenn ein Stück da ist', x.whenHas ? 'ja' : ''],
      ['Companion an Bord', x.needCompanion && (D.companions?.[x.needCompanion]?.name || x.needCompanion)], ['Werkstatt im Rig', x.needWorkshop], ['Rig-Teil', x.needRigPart || x.needRigSlot], ['Implantat', x.needItem || x.needWear], ['Setzt Merker', x.flag]].filter(([, v]) => v);
    const where = id => [
      ...Object.entries(D.pois || {}).flatMap(([pid, P]) => (P.treasure || []).filter(t => t.item === id).map(t => `${P.name || pid} (${t.where === 'chest' ? 'Kiste' : 'Tresor'}${t.chance != null && t.chance < 100 ? `, ${t.chance} %` : ''})`)),
      ...(D.roadEvents?.answers || []).filter(a => a.item === id).map(a => `unterwegs: ${a.id}${a.deltas < 0 ? ` (${-a.deltas} Δ)` : ''}`)];
    const pieces = (x.pieces || []).map(id => el('div', { class: 'ng-xrow' + (where(id).length ? '' : ' warn') }, el('b', {}, D.items?.[id]?.name || id), el('small', {}, where(id).join(' · ') || 'nirgends zu finden')));
    if (!c.length && !pieces.length) return null;
    return { title: 'Wann und wo', body: el('div', {}, c.length ? facts(c) : el('p', { class: 'ed-small' }, 'Immer im Angebot.'), pieces.length ? el('div', { class: 'ng-xlist' }, ...pieces) : null) };
  },
  // #074 which Entities would work here (Begabung › Werkbank / Auch), at full strength or as a stranger
  workshops(w, x) {
    const D = w.p.data, fn = x.function, T = D.glitchlings?.talents || [], off = D.glitchlings?.off ?? 35;
    if (fn === 'bitfarm') return { title: 'Bit-Farm', body: el('p', { class: 'ed-small' }, 'Hier wohnen gefangene Entities. Im Spiel: Inventar › Entity in der Farm › „Als Worker einsetzen“ an eine Werkstatt im Rig (#060).') };
    const own = T.filter(t => t.function === fn || t.also === fn);
    if (!fn || ['storage', 'tank'].includes(fn)) return null;
    return { title: 'Worker', body: el('div', {}, own.length ? el('div', { class: 'ng-xlist' }, ...own.map(t => el('div', { class: 'ng-xrow' }, el('b', {}, t.name), el('small', {}, `${String(t.effect || '').replace('{n}', `${t.perBit} je Bit`)}${t.function === fn ? '' : ' (Auch)'}`))))
      : el('p', { class: 'ed-small' }, 'Keine Begabung gehört hierher.'), el('p', { class: 'ed-small' }, `Fremde Entities arbeiten hier mit ${off} % ihrer Stärke.`)) };
  },
  // the travel map (#007): one rolled map with the current values, „Neu würfeln“ rolls another (the game rolls one per Durchgang)
  worldmap(w, x) {
    const D = w.p.data, c = el('canvas', { class: 'ng-worldmap', width: 960, height: 540, style: 'width:100%;border-radius:6px' });
    let seed = w.mapSeed ??= 1 + Math.floor(Math.random() * 1e6);
    const base = new URL('../../projects/nomadgirl/', import.meta.url), imgs = {};
    const img = id => { const A = D.assets?.[id]; if (!A?.file) return null; if (!imgs[id]) { const i = new Image(); i.onload = paint; i.src = new URL(A.file, base).href; imgs[id] = i; } return imgs[id].complete ? imgs[id] : null; };
    const info = el('p', { class: 'ed-small' });
    function paint() {
      const map = generateMap(D, seed), here = map.start, ctx = c.getContext('2d');
      drawMap(ctx, c.width, c.height, D, map, { paper: img(x.paper), logos: img(x.logos), here, sel: neighbours(map, here)[0], reveal: 99 });
      info.textContent = `Seed ${seed} · ${map.nodes.length} Orte (${map.nodes.filter(n => n.landmark).length} Wahrzeichen) · ${map.edges.length} Straßen · Plakate ${map.signs.length}. Im Spiel sind Orte weiter als „Namen sichtbar bis“ noch „?“.`;
    }
    document.fonts?.load('20px VT323').then(paint); paint();
    const again = el('button', { class: 'ed-button wide', onclick: () => { seed = w.mapSeed = 1 + Math.floor(Math.random() * 1e6); paint(); } }, 'Neu würfeln');
    return { title: 'Vorschau', body: el('div', {}, c, info, again) };
  },

  // the drive (#053): the landscape of a region at an hour and in a weather, moving; the rig is the game's own (here only its lights)
  travel(w, x) {
    const D = w.p.data, c = el('canvas', { width: 960, height: 540, style: 'width:100%;border-radius:6px;background:#060508' }), bg = Object.assign(document.createElement('canvas'), { width: BW, height: BH });
    const base = new URL('../../projects/nomadgirl/', import.meta.url), L = D.assets?.[D.worldmap?.logos];
    let logos = null; if (L?.file) { const i = new Image(); i.onload = () => { logos = i; }; i.src = new URL(L.file, base).href; }
    const P = w.drivePreview ??= { region: '', hour: 18.4, weather: 'clear', stop: '' };
    const road = makeRoad(D, { seed: 7, logos: () => logos, brands: mapBrands(D) });
    const regions = ['', ...(x.landscapes || []).map(r => r.region).filter(Boolean)];
    const sel = (key, opts) => { const s = el('select', { class: 'ed-input', onchange: e => { P[key] = e.target.value; } }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(P[key]) === String(v)) o.selected = true; return o; })); return s; };
    const hour = el('input', { type: 'range', min: 0, max: 24, step: 0.1, value: P.hour, oninput: e => { P.hour = +e.target.value; } }), clock = el('span', { class: 'ed-small' });
    const st = { dist: 0, t: 0, dt: 0, v: 0, hour: P.hour, land: null, wet: 0, dust: 0, fog: 0, flash: 0, stop: null };
    let last = performance.now();
    const tick = now => {
      if (!c.isConnected && st.t > 1) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const C = D.travel?.drive || {}, v = C.speed ?? 120, Lr = landscapeOf(D, P.region);
      st.t += dt; st.dt = dt; st.v = v; st.dist += v * dt; st.hour = P.hour; st.land = [Lr, Lr, 0];
      const k = Math.min(1, dt * 2); st.wet += ((P.weather === 'rain') - st.wet) * k; st.dust += ((P.weather === 'dust') * 0.8 - st.dust) * k; st.fog += ((P.weather === 'fog') * 0.8 - st.fog) * k;
      st.flash = Math.max(0, st.flash - dt * 4); if (st.wet > 0.6 && Math.random() < dt * 0.15) { st.flash = 1; road.strike(); }
      if (P.stop) { st.stop ??= { kind: P.stop, x: BW * 0.75 }; st.stop.kind = P.stop; st.stop.x = BW * 0.75; } else st.stop = null;
      road.draw(bg.getContext('2d'), st);
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, c.width, c.height); road.ads(ctx, c.width, c.height, st);
      road.light(ctx, c.width, c.height, st, { front: c.width * 0.62, lampY: c.height * 0.78, back: c.width * 0.3, tailY: c.height * 0.8 });
      road.front(ctx, c.width, c.height, st);
      clock.textContent = `${String(Math.floor(P.hour)).padStart(2, '0')}:${String(Math.floor((P.hour % 1) * 60)).padStart(2, '0')} Uhr`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { title: 'Fahrt-Vorschau', body: el('div', {}, c,
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px' },
        sel('region', regions.map(r => [r, r || 'Andere Regionen'])), sel('weather', [['clear', 'Klar'], ['rain', 'Regen'], ['dust', 'Staub'], ['fog', 'Nebel']]),
        sel('stop', ROADSIDE.map(([v, n]) => [v, v ? n : 'Kein Zwischenfall'])), hour, clock),
      el('p', { class: 'ed-small' }, 'Landschaft, Licht und Wetter aus Code. Im Spiel fährt davor das echte Rig, die Figuren am Rand sind die Gegner-Bausätze.')) };
  },

  // the Ereignis-Baukasten (#054): six incidents rolled from the parts, with danger and night; „Neu würfeln“ rolls six others
  roadEvents(w, x) {
    const D = w.p.data, P = w.eventPreview ??= { seed: 1 + Math.floor(Math.random() * 1e6), danger: 1, night: false, gang: gangs(D)[0]?.name || '', rep: 0 };
    const box = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px' }), info = el('p', { class: 'ed-small' });
    const cost = o => { const p = []; const de = n => String(n).replace('.', ',');
      if (o.use) p.push(`−${o.useCount || 1} ${D.items?.[o.use]?.name || o.use}`); if (o.hours) p.push(`+${de(o.hours)} h`); if (o.fuel) p.push(`${o.fuel > 0 ? '−' : '+'}${de(Math.abs(o.fuel))} l`);
      if (o.food) p.push(`${o.food > 0 ? '−' : '+'}${Math.abs(o.food)} Vorräte`); if (o.deltas) p.push(`${o.deltas > 0 ? '+' : '−'}${Math.abs(o.deltas)} Δ`); if (o.health) p.push(`−${o.health} Leben`);
      if (o.item) p.push(`+${o.count || 1} ${D.items?.[o.item]?.name || o.item}`); if (o.loot) p.push('Beute'); if (o.risk) p.push(`Risiko ${o.risk} %`);
      if (o.rep) p.push(`Ruf ${o.rep > 0 ? '+' : ''}${o.rep}`); if (o.repRival) p.push(`Rivalen ${o.repRival > 0 ? '+' : ''}${o.repRival}`); if (o.chain?.next) p.push(`→ ${o.chain.next}`); if (o.flag) p.push(`Merker ${o.flag}`); if (o.buff) p.push(`Buff ${D.buffs?.[o.buff]?.name || o.buff}`);
      return p.join(' · '); };
    function paint() {
      let s = P.seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const save = { rep: P.gang ? { [P.gang]: P.rep } : {}, road: { flags: [], seen: [], chain: null } };   // #055: Ruf with the destination's gang
      const list = Array.from({ length: 6 }, () => generateEncounter(D, r, { danger: P.danger, night: P.night, place: 'Rustvale Truck Stop', region: 'Crow Valley', save, here: P.gang || null })).filter(Boolean);
      box.replaceChildren(...list.map(e => el('div', { style: 'padding:10px 12px;border-radius:8px;border:1px solid var(--ui-border, #3a2f45);background:var(--ui-field, #1f1729)' },
        el('b', {}, e.name), el('div', { class: 'ed-small' }, [ROADSIDE.find(([k]) => k === e.roadside)?.[1] || 'nichts am Rand', e.figures.map(f => D.enemies?.[f]?.name || f).join(', '), e.gang ? `Gang ${e.gang}` : '', e.mood ? `Stimmung ${e.mood}` : ''].filter(Boolean).join(' · ')),
        el('p', { style: 'margin:6px 0' }, e.description),
        el('ul', { style: 'margin:0;padding-left:18px' }, ...e.options.map(o => el('li', {}, el('span', {}, o.label), el('small', { class: 'ed-small' }, ` ${cost(o)}`)))))));
      const C = eventsConfig(D);
      info.textContent = `${C.situations.length} Lagen × ${C.moods.length} Stimmungen × ${C.answers.length} Antworten · ${C.share} % der Zwischenfälle kommen aus dem Baukasten · Seed ${P.seed}`;
    }
    paint();
    const danger = el('select', { class: 'ed-input', onchange: e => { P.danger = +e.target.value; paint(); } }, ...[1, 2, 3, 4, 5].map(n => { const o = el('option', { value: n }, `Gefahr ${n}`); if (n === P.danger) o.selected = true; return o; }));
    const night = el('label', { class: 'ed-small' }, el('input', { type: 'checkbox', checked: P.night, onchange: e => { P.night = e.target.checked; paint(); } }), ' Nacht');
    const again = el('button', { class: 'ed-button', onclick: () => { P.seed = 1 + Math.floor(Math.random() * 1e6); paint(); } }, 'Neu würfeln');
    const opt = (v, n, on) => { const o = el('option', { value: v }, n); if (on) o.selected = true; return o; };
    const gang = el('select', { class: 'ed-input', onchange: e => { P.gang = e.target.value; paint(); } }, opt('', 'Ziel ohne Gang', !P.gang), ...gangs(D).map(g => opt(g.name, `Ziel: ${g.name}`, g.name === P.gang)));
    const rep = el('select', { class: 'ed-input', onchange: e => { P.rep = +e.target.value; paint(); } }, ...[[-90, 'Feind'], [-40, 'Unbeliebt'], [0, 'Neutral'], [40, 'Geduldet'], [90, 'Freund']].map(([v, n]) => opt(v, `Ruf: ${n}`, v === P.rep)));
    const rolled = { title: 'Gewürfelte Zwischenfälle', body: el('div', {}, el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px' }, danger, night, gang, rep, again), box, info) };
    // #074 Merker and chains: who sets a Merker, who reads it; a Merker nobody reads (or nobody sets) is marked
    const G = flagGraph(D), rows = [...G].sort(([a], [b]) => a.localeCompare(b)).map(([f, x]) => {
      const lonely = !x.set.length ? 'Liest jemand, setzt niemand' : !x.read.length && !x.not.length ? 'Setzt jemand, liest niemand' : '';
      return el('div', { class: 'ng-xrow' + (lonely ? ' warn' : '') }, el('b', {}, f), lonely ? tag(lonely, 'warn') : null,
        el('small', {}, [x.set.length ? `setzt: ${x.set.join(', ')}` : null, x.clear.length ? `löscht: ${x.clear.join(', ')}` : null, x.read.length ? `braucht: ${x.read.join(', ')}` : null, x.not.length ? `nicht mit: ${x.not.join(', ')}` : null].filter(Boolean).join(' · ')));
    });
    const flags = { title: `Merker (${G.size})`, body: el('div', { class: 'ng-xlist' }, el('p', { class: 'ed-small' }, 'Welt-Merker: Antworten und Quests setzen sie, Lagen und Quests fragen sie ab (#062, #068).'), ...rows) };
    const E = chainEdges(D), byFrom = new Map(); for (const e of E) { if (!byFrom.has(e.from)) byFrom.set(e.from, []); byFrom.get(e.from).push(e); }
    const starts = [...byFrom.keys()].filter(id => !E.some(e => e.to === id));
    const walk = (id, seen = new Set()) => seen.has(id) ? [] : (seen.add(id), (byFrom.get(id) || []).flatMap(e => { const more = walk(e.to, new Set(seen)); return more.length ? more.map(m => [`${id} —${e.answer}→`, ...m]) : [[`${id} —${e.answer}→`, e.to]]; }));
    const chains = { title: `Geschichten-Ketten (${starts.length})`, body: el('div', { class: 'ng-xlist' }, ...starts.map(st => el('div', { class: 'ng-xrow' }, el('b', {}, st), el('small', {}, walk(st).map(p => p.join(' ')).join(' · ')))) ) };
    return [rolled, flags, chains];
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
// #074 the brand shows its sign and its Markentreue
{ const sign = SUMMARY.brands, set = SUMMARY.brandSet; delete SUMMARY.brandSet; SUMMARY.brands = (w, x, id) => [sign(w, x, id), set(w, x, id)]; }
