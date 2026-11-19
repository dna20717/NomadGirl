// The notice board at the van (#025, Daniel 15.11.2026: „ein schwarzes Brett zunächst am Van, man kann Aufträge annehmen, erledigen und
// Belohnungen einsammeln. Es geht auch bei den NPCs direkt, aber so kann man das zentralisieren. Später kann daraus eine Werkbank werden,
// in der man fertige Aufträge gegen noch bessere Belohnungen tauscht“). A board on two posts drawn from code, a pinned note per job
// (gold pin = on offer, green stamp = done, grey = running). E opens the board: the notes as cards, a note opens its job.
// Also the quest marks over the companions: a little note instead of a text „!“ / „✓“ (Daniel: „sollen besser in die Spielwelt passen“).
// Mixed into Camp like CampLife.
import { offers, accept, claim, progressOf, qstate } from '../quests.js';

const PX = 3;   // one art pixel
// a little paper note with a pin (offer) or a green stamp (ready), pixel art from code; key: 'qnote_offer' | 'qnote_ready' | 'qnote_run'
export function noteTexture(scene, kind) {
  const key = 'qnote_' + kind;
  if (scene.textures.exists(key)) return key;
  const w = 12, h = 15, t = scene.textures.createCanvas(key, w * PX, h * PX), c = t.getContext();
  const px = (x, y, col, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(x * PX, y * PX, ww * PX, hh * PX); };
  const paper = kind === 'run' ? '#b3b9d1' : '#f2e3c4', shade = kind === 'run' ? '#8b93af' : '#d6bf94', ink = '#3d2b24';
  px(1, 2, '#17111f', 10, 13);           // outline
  px(2, 3, paper, 8, 11);
  px(2, 12, shade, 8, 2); px(8, 3, shade, 2, 2);   // a curled corner and the bottom in the shade
  px(9, 12, '#17111f', 1, 1); px(8, 13, '#17111f', 2, 1);   // torn corner
  for (const y of [6, 8, 10]) px(3, y, ink, y === 10 ? 3 : 5, 1);   // scribbled lines
  if (kind === 'ready') {   // a green stamp with a tick over the lines
    px(4, 6, '#14a02e', 6, 6); px(5, 7, '#9cdb43', 4, 4);
    px(5, 9, '#14a02e'); px(6, 10, '#14a02e'); px(7, 9, '#14a02e'); px(8, 8, '#14a02e');
  }
  const pin = kind === 'ready' ? '#14a02e' : kind === 'run' ? '#6d758d' : '#f9c22b', pinHi = kind === 'ready' ? '#9cdb43' : kind === 'run' ? '#b3b9d1' : '#fbff86';
  px(4, 0, '#17111f', 4, 4); px(5, 1, pin, 2, 2); px(5, 1, pinHi);   // the pin
  t.refresh();
  return key;
}

export class CampBoard {
  // the board itself: from code, two posts, a dark board with a tin roof, notes pinned on it (redrawn when jobs change)
  placeBoard() {
    const s = this.scene, B = this.C.board || {};
    this.board = null;
    if (B.enabled === false) return;
    const x = Math.round(this.geo.fireX + (B.offset ?? -220)), y = this.campY ?? this.ground, w = B.width ?? 132, h = B.height ?? 96, top = y - (B.lift ?? 210);
    const g = s.add.graphics().setDepth(-16);
    g.fillStyle(0x17111f).fillRect(x - w / 2 + 6, top + h - 4, 12, y - top - h + 4).fillRect(x + w / 2 - 18, top + h - 4, 12, y - top - h + 4);   // posts
    g.fillStyle(0x5d4037).fillRect(x - w / 2 + 8, top + h, 8, y - top - h).fillRect(x + w / 2 - 16, top + h, 8, y - top - h);
    g.fillStyle(0x17111f).fillRect(x - w / 2 - 3, top - 3, w + 6, h + 6);                       // board: outline
    g.fillStyle(0x3d2b24).fillRect(x - w / 2, top, w, h);                                        // dark wood
    g.fillStyle(0x4a3528); for (let yy = top + 6; yy < top + h; yy += 12) g.fillRect(x - w / 2, yy, w, 3);   // planks
    g.fillStyle(0x17111f).fillRect(x - w / 2 - 10, top - 14, w + 20, 12);                       // tin roof
    g.fillStyle(0x6d758d).fillRect(x - w / 2 - 8, top - 12, w + 16, 8);
    g.fillStyle(0x8b93af); for (let xx = x - w / 2 - 6; xx < x + w / 2 + 8; xx += 9) g.fillRect(xx, top - 12, 3, 8);
    g.fillStyle(0xb4202a, 0.7).fillRect(x + w / 2 - 30, top - 12, 18, 4);                      // a rust streak
    const title = s.add.text(x, top - 8, 'AUFTRÄGE', { fontFamily: 'VT323, monospace', fontSize: '20px', color: '#17111f' }).setOrigin(0.5).setDepth(-15.9);
    this.board = { x, top, w, h, g, title, notes: [] };
    this.hotspots.push({ x, w: 60, floor: this.geo.campFloor != null ? this.campY : undefined, name: B.name || 'Schwarzes Brett', hint: () => this.boardHint(), act: () => this.boardMenu() });
    this.boardNotes();
  }
  boardJobs() {
    const D = this.D, save = this.box.save, Q = qstate(save);
    const active = Object.keys(Q.active).filter(id => D.quests?.[id]);
    return { offer: offers(D, save), ready: active.filter(id => progressOf(D, save, id).ready), run: active.filter(id => !progressOf(D, save, id).ready) };
  }
  boardHint() {
    const J = this.boardJobs();
    return [J.ready.length ? `${J.ready.length} abgeben` : null, J.offer.length ? `${J.offer.length} neu` : null].filter(Boolean).join(' · ') || 'Aufträge ansehen';
  }
  // the notes on the board follow the jobs: done first, then new, then running; at most 8
  boardNotes() {
    const s = this.scene, b = this.board;
    if (!b) return;
    for (const n of b.notes) n.destroy();
    const J = this.boardJobs(), kinds = [...J.ready.map(() => 'ready'), ...J.offer.map(() => 'offer'), ...J.run.map(() => 'run')].slice(0, 8);
    const cols = 4, cw = (b.w - 12) / cols;
    b.notes = kinds.map((k, i) => s.add.image(b.x - b.w / 2 + 6 + cw * (i % cols + 0.5) + ((i * 7) % 5 - 2), b.top + 8 + Math.floor(i / cols) * 44 + ((i * 5) % 3), noteTexture(s, k))
      .setOrigin(0.5, 0).setScale(0.9).setAngle(((i * 37) % 9) - 4).setDepth(-15.8));
  }
  // E at the board: every job of every companion, as notes; a note opens its job
  boardMenu() {
    const D = this.D, save = this.box.save, s = this.scene, J = this.boardJobs();
    const giver = id => D.companions?.[D.quests[id].giver]?.name || D.quests[id].giver || '';
    const rew = id => { const R = D.quests[id].reward || {}; return [R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean).join(' · '); };
    const note = (id, kind) => {
      const p = progressOf(D, save, id);
      return { label: D.quests[id].name, sub: kind === 'run' ? `${p.n} / ${p.target}` : rew(id), primary: kind === 'ready', note: { kind, from: giver(id), stamp: kind === 'ready' ? 'Erledigt' : kind === 'offer' ? 'Neu' : 'Läuft' },
        act: () => this.boardNote(id, kind) };
    };
    const items = [...J.ready.map(id => note(id, 'ready')), ...J.offer.map(id => note(id, 'offer')), ...J.run.map(id => note(id, 'run'))];
    if (J.ready.length > 1) items.unshift({ label: 'Alles abgeben', sub: `${J.ready.length} Aufträge · Belohnungen einsammeln`, primary: true, note: { kind: 'all', from: 'Brett', stamp: 'Alle' }, act: () => this.claimAll(J.ready) });
    if (!items.length) items.push({ label: 'Gerade nichts', sub: 'Komm morgen wieder, die anderen schreiben neue Zettel.', note: { kind: 'empty', from: '', stamp: '' }, act: () => {} });
    s.hud.menu({ title: this.C.board?.name || 'Schwarzes Brett', sub: 'Aufträge der Crew. Annehmen, abgeben, Belohnung einsammeln: hier oder direkt bei ihnen.', items, board: true });
  }
  boardNote(id, kind) {
    const D = this.D, save = this.box.save, s = this.scene, q = D.quests[id], c = (this.companions || []).find(x => x.id === q.giver);
    const R = q.reward || {}, rew = [R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean).join(' · ');
    const back = { label: 'Zurück zum Brett', act: () => this.boardMenu() };
    const items = kind === 'offer' ? [{ label: 'Annehmen', sub: rew ? `Belohnung: ${rew}` : '', primary: true, act: () => { accept(D, save, id); s.hud.toast(`Auftrag angenommen: ${q.name}`, `${this.talkOf(q.giver).name} · steht im Questlog`, 'info'); if (c) this.say(c, 'Gut. Ich verlass mich auf dich.'); this.jobsChanged(); this.boardMenu(); } }, back]
      : kind === 'ready' ? [{ label: 'Abgeben', sub: rew ? `Belohnung: ${rew}` : '', primary: true, act: () => { this.claimOne(id); this.boardMenu(); } }, back]
      : [{ label: 'Im Questlog verfolgen', act: () => { qstate(save).tracked = id; this.jobsChanged(); } }, back];
    const p = progressOf(D, save, id);
    s.hud.menu({ title: q.name, sub: kind === 'run' ? `${q.text || ''}  Stand: ${p.n} / ${p.target}` : kind === 'ready' ? (q.done || 'Erledigt. Zeit für die Belohnung.') : q.text || '', items, talk: { ...this.talkOf(q.giver), note: kind } });
  }
  claimOne(id) {
    const D = this.D, save = this.box.save, s = this.scene, q = D.quests[id], r = claim(D, save, id), c = (this.companions || []).find(x => x.id === q.giver);
    if (r.ok) { if (c) this.say(c, r.line || 'Danke, Leyla.'); s.hud.toast(`Erledigt: ${q.name}`, r.got.join(' · '), 'good'); }
    this.jobsChanged();
    return r;
  }
  claimAll(ids) {
    const got = [];
    for (const id of ids) { const r = claim(this.D, this.box.save, id); if (r.ok) got.push(...r.got); }
    if (got.length) this.scene.hud.toast(`${ids.length} Aufträge abgegeben`, got.join(' · '), 'good');
    this.jobsChanged();
    this.boardMenu();
  }
  // after any change: save, marks over the companions, notes on the board, the goal line
  jobsChanged() {
    const s = this.scene;
    s.box.persist(); this.questMarks(); this.boardNotes();
    if (s.hud) { s.hud.campKey = null; s.hud.goalAt = 0; }
  }
  // who speaks: name, role, colour, portrait (asset id, later) of a companion
  talkOf(id) {
    const d = this.D.companions?.[id] || {}, name = d.name || id || '';
    const A = d.portrait && this.D.assets?.[d.portrait];
    return { name, role: d.role || '', color: d.color || '#ffd27a', initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(), portrait: A?.file ? new URL(A.file, this.scene.base).href : null };
  }
}
