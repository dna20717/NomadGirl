// Camp aboard a mega rig (#029, Daniel 15.11.2026: „Camp an Bord“): the crawler or the fatbird stands where the rig and the van
// stood, the campsite (fire, chest, board, companions) lies on the ground beside it. Workshops in its rooms and containers are used
// with E like in the rig (same places `<unit>:<at>`, same storages), the bridge (crawler) or the cockpit (fatbird) takes the role of
// the van door: E opens the map, its own workshops sit in the map's header. The old rig waits in the loading bay at the stern.
// campMegaLayout() is called by campLayout (camp.js); CampMega is mixed into Camp like CampLife.
import { activeMega, buildOwn, mstate, deactivate } from '../mega.js';
import { wreckHere } from './camp_salvage.js';
import { MegarigView } from './megarig_view.js';
import { VERB } from './camp.js';

// the front of the bridge (tiles): the helm with the map; the workshops of the tractor stand behind it
export const BRIDGE_HELM = 3;

export function campMegaLayout(D, save, T = 64) {
  const C = D.camp || {}, margin = C.margin ?? 6, Y = C.yard || {}, yardT = Y.enabled === false ? 0 : Math.max(4, Y.width ?? 9);
  const left = margin + yardT + 2, b = buildOwn(D, save, { margin: left });
  const wr = wreckHere(D, save), campW = Math.max(8, C.campWidth ?? 20);
  const end = b.x0 + b.len + 3, campCol = end + 1, W = campCol + campW + (wr ? wr.width + 2 : 0) + 1, H = b.H, floor = b.G;
  const S = C.shaft || {}, shaft = S.enabled === false ? null : { from: Math.max(1, S.at ?? 1), to: Math.max(1, S.at ?? 1) + Math.max(1, S.width ?? 3) - 1 };
  const blocked = x => x === 0 || x === W - 1 || (shaft && x <= shaft.to);
  const layout = b.rows.map((r, y) => {
    let row = '';
    for (let x = 0; x < W; x++) {
      const c = x < r.length ? r[x] : '.';
      if (y >= floor) row += shaft && x >= shaft.from && x <= shaft.to ? '.' : '#';
      else if (blocked(x)) row += '#';
      else row += c === 'L' ? '.' : c;
    }
    return row;
  });
  const sx = campCol + 2;   // Leyla wakes up beside the vehicle, at the campsite
  layout[floor - 1] = layout[floor - 1].slice(0, sx) + 'L' + layout[floor - 1].slice(sx + 1);
  const bridge = b.pieces.find(p => p.type === 'bridge'), x0 = b.x0 * T, x1 = (b.x0 + b.len) * T;
  // the bridge (crawler) or the nose (fatbird) is where the van door was: E there opens the map
  const doorX = bridge ? (bridge.x + BRIDGE_HELM / 2) * T : x0 + 4 * T, doorFloor = bridge ? bridge.floorRow * T : null;
  const tractor = save.rig.units.find(u => u.kind === 'tractor');
  return { layout, W, H, floor, vanCol: campCol, shaft, hidden: (x, y) => y < floor && blocked(x), doorX, doorFloor, vanLeft: x0, vanRight: x1, units: [], tractor,
    yard: yardT ? { x0: ((shaft ? shaft.to + 1 : 1) + 0.5) * T, x1: (margin + yardT) * T } : null, rigRoom: [x0, x0],
    fireX: (campCol + (C.fire?.at ?? 9) + 0.5) * T, campCol,
    companionX: [(campCol + (C.companions?.at?.[0] ?? 6) + 0.5) * T, (campCol + (C.companions?.at?.[1] ?? 13) + 0.5) * T],
    wreck: wr ? { id: wr.id, x0: (campCol + campW + 1) * T, x1: (campCol + campW + 1 + wr.width) * T } : null,
    mega: { id: activeMega(D, save), b } };
}

export class CampMega {
  // the vehicle, its workshops (E spots on their own floor), the bay and the bridge; redrawn after building like the rig
  drawMega() {
    const s = this.scene, D = this.D, T = s.T, save = this.box.save, geo = this.geo, b = geo.mega.b;
    const before = new Set(s.children.list);
    // the tractor's own workshops (bridge/cockpit) stand in the bridge room
    const br = b.pieces.find(p => p.type === 'bridge');
    if (br) br.workshops = (save.rig.units[0]?.workshops || []).map(w => w.id);
    this.megaView = new MegarigView(s, b, T, { id: geo.mega.id, lights: (mstate(save).lights || []).map(l => ({ from: l.from, fromCorner: String(l.fromCorner), to: l.to, toCorner: String(l.toCorner) })), walk: true });
    this.megaView.ladders(s.ladders.filter(l => !l.rig));
    s.megaView = this.megaView;
    this.rigObjs.push(...s.children.list.filter(o => !before.has(o)));
    // E spots: every workshop of every module on its floor (rooms and containers), storages open their grid
    for (const p of b.pieces.filter(q => (q.type === 'container' || q.type === 'room') && q.module != null)) {
      const ui = p.module + 1, u = save.rig.units[ui];
      if (!u) continue;
      const places = D.containers?.[u.id]?.places || 1, x = (p.x + 0.35) * T, w = (p.w - 0.7) * T, cell = w / places, floor = p.floorRow * T;
      for (const ws of u.workshops) {
        const def = D.workshops?.[ws.id] || {}, n = def.places || 1;
        this.megaSpot(ui, ws, def, x + ws.at * cell, n * cell, floor);
      }
    }
    if (br) {
      const tw = save.rig.units[0]?.workshops || [], x = (br.x + BRIDGE_HELM) * T, w = (br.w - BRIDGE_HELM - 0.3) * T, cell = w / Math.max(1, D.tractors?.[save.rig.tractor]?.places || 1);
      for (const ws of tw) this.megaSpot(0, ws, D.workshops?.[ws.id] || {}, x + ws.at * cell, (D.workshops?.[ws.id]?.places || 1) * cell, br.floorRow * T);
    }
    // the loading bay at the stern: the old rig waits there (back into it = leave the mega rig)
    const bay = mstate(save).bay;
    if (bay?.tractor) {
      const bx = (b.x0 + b.len - 2) * T;
      this.hotspots.push({ rig: true, x: bx, w: 90, name: `Ladebucht · ${D.tractors?.[bay.tractor]?.name || bay.tractor}`, hint: 'Ansehen', act: () => this.bayMenu() });
    }
  }
  // the middle of a workshop aboard (for the synergy links)
  megaBenchAt({ ui, at }) {
    const T = this.scene.T, b = this.geo.mega.b, D = this.D, u = this.box.save.rig.units[ui];
    const p = b.pieces.find(q => (q.type === 'container' || q.type === 'room') && q.module === ui - 1);
    if (!p || !u) return null;
    const n = D.containers?.[u.id]?.places || 1, cell = (p.w - 0.7) / n, w = u.workshops.find(x => x.at === at), k = D.workshops?.[w?.id]?.places || 1;
    return { x: (p.x + 0.35 + (at + k / 2) * cell) * T, y: (p.floorRow - (p.h || 5) * 0.45) * T };
  }
  megaSpot(ui, w, def, cx, cw, floor) {
    const store = def.grid && `store:${ui}:${w.at}`;
    this.hotspots.push({ rig: true, place: `${ui}:${w.at}`, x: cx + cw / 2, w: Math.max(40, cw / 2), floor, name: def.name || w.id,
      hint: this.synHint(`${ui}:${w.at}`, store ? 'Öffnen' : this.noPower && def.power < 0 ? 'Kein Strom' : VERB[def.function] || 'Benutzen'), ws: w.id,
      act: () => store ? this.scene.openContainer(store) : this.use(w.id, `${ui}:${w.at}`) });
  }
  bayMenu() {
    const s = this.scene, D = this.D, save = this.box.save, bay = mstate(save).bay, name = D.tractors?.[bay.tractor]?.name || bay.tractor;
    const V = D.megarigs?.[activeMega(D, save)] || {};
    s.hud.menu({ title: 'Ladebucht', sub: `Hier parkt dein ${name}. ${V.name || 'Das Mega-Rig'} ist jetzt deine Basis; die Werkstätten sind an Bord.`,
      items: [{ label: `Zurück ins ${name}-Rig`, sub: 'Die Container reihen sich wieder hinter ihm auf, was nicht passt, kommt ins Lager', act: () => s.hud.menu({ title: 'Wirklich umziehen?', sub: `Das ${V.name || 'Mega-Rig'} bleibt geborgen, du kannst jederzeit zurück.`, items: [
        { label: 'Umziehen', primary: true, act: () => { const r = deactivate(D, save); if (r.ok) { s.box.persist(true); s.goCamp({ banner: [`Zurück im ${name}`, r.lost ? `${r.lost} Container ins Lager` : 'Alles an seinem Platz'], fade: 700 }); } } },
        { label: 'Hierbleiben', act: () => {} }] }) },
        { label: 'Zurück', act: () => {} }] });
  }
}
