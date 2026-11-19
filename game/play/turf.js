// Revier-Camp (#061, Daniel 18.11.2026: „Der POI wird dann zu einem Camp mit dem Hinweis zu Beginn, dass das Revier der Gang XY ist
// und man mit ihnen in welcher Beziehung steht. ABER man kann immer auch kämpfen und töten. Was im Zweifel den Ruf beschädigt.“
// Beute: „Klauen kostet Ruf“). With Ruf from „Frieden ab“ (Ereignis-Baukasten › Ruf) the gang of a POI lets Leyla be: their people
// (plunderers, their drones, the boss) do not attack, do not come to noise or calls. Their chests are theirs: opening one while one of
// them sees it costs Ruf. The vault only by breaking the peace. A friend can talk to them: trade (a few things from the POI's loot at
// Ruf prices) and a job (clear the turf of mutants and vermin). Any hit on one of them breaks the peace: all of them fight, Ruf drops.
import { addRep, repOf, levelOf, levelName, repConfig, repPrice, REP_LEVELS } from '../reputation.js';
import { rollLoot } from '../inventory.js';
import { give } from '../crafting.js';
import { pay } from '../pricing.js';
import { gangJobs, accept, claim, progressOf } from '../quests.js';

const rank = id => REP_LEVELS.findIndex(([k]) => k === id);
const GANG_FAMILIES = ['raider', 'machine'];

export class Turf {
  // → a Turf when the POI has a gang, else null (peace or not: the hint at the start is for every gang)
  static make(scene) {
    const G = scene.mode === 'run' && scene.level ? scene.gang() : null;
    return G?.name && scene.box?.save ? new Turf(scene, G) : null;
  }
  constructor(scene, G) {
    this.scene = scene; this.G = G; this.gang = G.name;
    const C = repConfig(scene.data_), lvl = levelOf(scene.data_, this.rep());
    this.peace = rank(lvl) >= rank(C.peace);   // a truce while the Ruf holds
    this.friend = lvl === 'freund';
    this.broken = false; this.thefts = 0; this.stock = null; this.job = null;
  }
  get D() { return this.scene.data_; }
  get save() { return this.scene.box.save; }
  rep() { return repOf(this.scene.box?.save, this.gang); }
  get active() { return this.peace && !this.broken; }
  // is this enemy one of the gang's people, held by the truce?
  member(e) { return !!e && (GANG_FAMILIES.includes(e.d.family) || e.d.behavior === 'boss'); }
  calm(e) { return this.active && this.member(e) && e.alive; }

  // the card at the start: whose turf, how they stand to Leyla, what it means
  hint() {
    const n = this.rep(), lvl = levelOf(this.D, n), sign = n > 0 ? '+' : '';
    const what = this.active
      ? (this.friend ? 'Freunde: sie lassen dich in Ruhe, handeln mit dir und haben einen Auftrag. Ihre Kisten gehören ihnen: wer dich beim Öffnen sieht, nimmt es dir übel. Der Tresor nur mit Gewalt.'
        : 'Waffenstillstand: sie lassen dich in Ruhe, solange du friedlich bleibst. Kisten öffnen unter Zeugen kostet Ruf. Der Tresor nur mit Gewalt.')
      : lvl === 'feind' ? 'Feinde: sie schießen, sobald sie dich sehen, und rufen Verstärkung.' : 'Sie kennen dich nicht. Wer ihr Revier betritt, wird angegriffen. Jeder Kill kostet Ruf.';
    this.scene.hud.toast(`Revier der ${this.gang} · ${levelName(lvl)} (${sign}${n})`, what, this.active ? 'good' : 'warn', 7000);
  }

  // who of them sees Leyla right now
  witnesses() { const l = this.scene.leyla; return this.scene.enemies.filter(e => this.calm(e) && e.sees(l)); }

  // a chest of theirs was opened → seen = theft
  chestOpened() {
    if (!this.active) return;
    const w = this.witnesses();
    if (!w.length) return;
    w[0].say('Hey! Finger weg!', '#ff9040');
    this.thefts++;
    this.change(-repConfig(this.D).theft, 'Beim Klauen gesehen');
  }
  // Leyla hit one of them: the peace is over (once), they all fight; kills cost Ruf like everywhere
  attacked(e) {
    if (!this.active) return;
    this.breakPeace('Du hast angegriffen');
  }
  breakPeace(why) {
    if (this.broken) return;
    this.broken = true;
    const s = this.scene, l = s.leyla, now = s.now ?? s.time.now;
    this.change(-repConfig(this.D).breakPeace, why, true);
    for (const e of s.enemies) if (e.alive && this.member(e)) { e.lastKnown = { x: l.x, y: l.chest, at: now }; e.alarmed?.(now, e.lastKnown); }
    const near = s.enemies.filter(e => e.alive && this.member(e)).sort((a, b) => Math.abs(a.x - l.x) - Math.abs(b.x - l.x))[0];
    near?.say('Verrat!', '#ff4060');
    s.hud.toast(`Frieden gebrochen: ${this.gang}`, 'Sie greifen an', 'warn', 4200);
  }
  change(n, why, quiet = false) {
    const r = addRep(this.D, this.save, this.gang, n);
    if (!r) return;
    if (!quiet) this.scene.hud.toast(`${why}: Ruf ${this.gang} ${r.n > 0 ? '+' : '−'}${Math.abs(r.n)}`, r.changed ? `Jetzt: ${levelName(r.level)}` : '', r.n > 0 ? 'good' : 'warn', 3600);
    // the Ruf falls below the peace: no more truce
    if (this.active && rank(r.level) < rank(repConfig(this.D).peace)) this.breakPeace('Jetzt reicht es ihnen');
    if (r.level !== 'freund') this.friend = false;
  }

  // ---------- E near the vault / near one of them ----------
  vault(open) {
    const s = this.scene;
    s.hud.menu({ title: `Tresor der ${this.gang}`, sub: `Das ist ihr Tresor. Wer ihn knackt, bricht den Frieden: Ruf −${repConfig(this.D).breakPeace}, alle greifen an.`, items: [
      { label: 'Aufbrechen', sub: 'bricht den Frieden', icon: 'warning', act: () => { this.breakPeace('Tresor geknackt'); open(); } },
      { label: 'Lassen', icon: 'x', primary: true, act: () => {} }] });
  }
  near() {
    if (!this.active) return null;
    const s = this.scene, l = s.leyla, range = (this.D.camp?.interactRange ?? 130) * 1.2;
    const e = s.enemies.find(x => this.calm(x) && Math.abs(x.x - l.x) < range && Math.abs(x.body.bottom - l.feet) < 80);
    const J = gangJobs(this.D, this.save, this.gang), news = J.offers.length + J.ready.length;   // #088
    return e ? { text: `Reden · ${this.gang}${this.friend ? ' (Handel, Auftrag)' : news ? ' (Auftrag)' : ''}${news ? ' !' : ''}`, act: () => this.talk(e) } : null;
  }
  talk(e) {
    const s = this.scene, D = this.D, items = [];
    if (this.friend) {
      items.push({ label: 'Handeln', icon: 'coins', primary: true, act: () => this.trade() });
      const J = this.jobState();
      if (J) items.push(J);
    }
    items.push(...this.questItems(e));   // #088 the gang's own jobs (Aufträge mit Gang), from Geduldet
    items.push({ label: 'Plaudern', icon: 'speechBubble', act: () => e.say(this.G.motto || 'Hm.', '#ffd27a') });
    items.push({ label: 'Tschüss', icon: 'x', act: () => {} });
    s.hud.menu({ title: this.gang, sub: this.friend ? `„${this.G.motto || 'Willkommen, Freundin.'}“ · ${levelName(levelOf(D, this.rep()))} (+${this.rep()})` : items.length > 2 ? `Geduldet (+${this.rep()}): für Handel reicht es nicht, für einen Auftrag schon.` : 'Sie mustern dich. Mehr als ein Nicken gibt es nicht.', items });
  }
  // #088 Gangs als Auftraggeber: offers to take, done jobs to hand in (Ruf, Δ, Dinge), running ones say how far
  questItems(e) {
    const D = this.D, save = this.save, s = this.scene, J = gangJobs(D, save, this.gang), out = [];
    for (const id of J.ready) { const q = D.quests[id]; out.push({ label: `Abgeben: ${q.name}`, sub: [q.reward?.deltas ? `${q.reward.deltas} Δ` : '', q.reward?.rep ? `Ruf +${q.reward.rep}` : ''].filter(Boolean).join(' · '), icon: 'gift', primary: true,
      act: () => { const r = claim(D, save, id); if (!r.ok) return; if (q.done) e.say(q.done, '#ffd27a'); s.hud.toast(`Erledigt: ${q.name}`, r.got.join(' · '), 'good', 4200);
        if (r.rep?.changed) { s.hud.toast(`${this.gang}: ${levelName(r.rep.level)}`, r.rep.level === 'freund' ? 'Freunde: Handel und Revier-Auftrag offen' : 'Dein Ruf bei ihnen steigt', 'good', 4200); this.friend = r.rep.level === 'freund'; }
        } });
    }
    for (const id of J.active.filter(x => !J.ready.includes(x))) { const q = D.quests[id], p = progressOf(D, save, id); out.push({ label: `${q.name}: ${p.n} / ${p.target}`, icon: 'clock', act: () => e.say(q.text ? 'Na? Läuft es?' : 'Hm.', '#ffd27a') }); }
    for (const id of J.offers) { const q = D.quests[id]; out.push({ label: `Auftrag: ${q.name}`, sub: [q.text, q.reward?.rep ? `Ruf +${q.reward.rep}` : '', q.reward?.deltas ? `${q.reward.deltas} Δ` : ''].filter(Boolean).join(' · '), icon: 'sign',
      act: () => { if (!accept(D, save, id)) return; s.hud.toast(`Auftrag angenommen: ${q.name}`, `${this.gang} · steht im Questlog`, 'info', 4200); } }); }
    return out;
  }
  // a few things from the POI's loot, at Ruf prices (once rolled per run)
  trade() {
    const s = this.scene, D = this.D, save = this.save;
    if (!this.stock) {
      const table = s.level?.lootTable, seen = new Map();
      for (let i = 0; i < 6 && seen.size < 4; i++) for (const t of rollLoot(D, table)) if (t.a === 'items' && D.items?.[t.id] && !seen.has(t.id)) seen.set(t.id, { id: t.id, n: t.n });
      this.stock = [...seen.values()].slice(0, 4);
    }
    const price = t => Math.max(5, pay(D, save, D.items[t.id].value || 5, { gang: this.gang, markup: 1.5, brand: D.items[t.id].brand }));   // #069 one price function (Ruf, Influencer #064)
    const items = this.stock.map(t => ({ label: `${D.items[t.id].name}${t.n > 1 ? ` ×${t.n}` : ''}`, sub: `${price(t) * t.n} Δ`, icon: 'coins', disabled: t.sold ? 'verkauft' : (save.deltas || 0) < price(t) * t.n ? 'zu wenig Δ' : null,
      act: () => { const cost = price(t) * t.n, rest = give(D, save, t.id, t.n); if (rest >= t.n) return s.hud.toast('Kein Platz', 'Rucksack, Kiste und Lager sind voll', 'warn'); save.deltas -= cost; t.sold = true; s.hud.toast(`Gekauft: ${D.items[t.id].name}`, `−${cost} Δ`, 'loot', 2600); this.trade(); } }));
    items.push({ label: 'Fertig', icon: 'x', act: () => {} });
    s.hud.menu({ title: `Handel · ${this.gang}`, sub: `Freundschaftspreise · ${save.deltas || 0} Δ`, items });
  }
  // the job: clear the turf of what is not theirs (mutants, vermin)
  vermin() { return this.scene.enemies.filter(e => e.alive && !this.member(e)); }
  jobState() {
    const D = this.D, reward = 40 + 20 * (this.scene.threat?.()?.level ?? 1), left = this.vermin().length;
    if (!this.job && !left) return null;
    if (!this.job) return { label: 'Auftrag: Revier säubern', sub: `${left} Viecher und Mutanten · ${reward} Δ, Ruf +${repConfig(D).job}`, icon: 'sign', act: () => { this.job = { reward, done: false }; this.scene.hud.toast('Auftrag: Revier säubern', `${left} übrig · steht im Questlog nicht, sie merken es sich`, 'info'); } };
    if (this.job.done) return null;
    if (left) return { label: `Auftrag: noch ${left} übrig`, icon: 'clock', act: () => {} };
    return { label: 'Auftrag abgeben', sub: `${this.job.reward} Δ · Ruf +${repConfig(D).job}`, icon: 'check', primary: true, act: () => { this.job.done = true; this.save.deltas = (this.save.deltas || 0) + this.job.reward; this.change(repConfig(D).job, 'Revier gesäubert'); } };
  }
  state() { return { gang: this.gang, rep: this.rep(), peace: this.peace, active: this.active, friend: this.friend, broken: this.broken, thefts: this.thefts, job: this.job ? { ...this.job } : null, stock: this.stock?.map(t => t.id) || null }; }
}
