// Loot on the ground in a run: beaten enemies drop bundles (their loot table), each bundle is a small grid.
// The ground inventory (like XCOM) shows the nearest bundle within reach (Leyla › Inventar › Boden-Reichweite);
// stackable things Leyla already carries are picked up by walking past, as far as the stacks have room.
import { newGrid, add, rollLoot, thing, stackMax, addEntry } from '../inventory.js';

const PILE = [6, 4];

function bagTexture(scene) {
  if (scene.textures.exists('loot_bag')) return 'loot_bag';
  const g = scene.make.graphics({}, false), p = 3;
  const px = (x, y, w, h, c) => g.fillStyle(c).fillRect(x * p, y * p, w * p, h * p);
  px(3, 4, 8, 7, 0x8a6a44); px(2, 6, 10, 5, 0x8a6a44); px(4, 3, 6, 1, 0x6b5030); px(5, 1, 4, 2, 0x8a6a44);   // sack
  px(5, 3, 4, 1, 0xd4a72c);                                                                                  // tie
  px(3, 6, 2, 3, 0xa8865a); px(4, 10, 7, 1, 0x5a4428);                                                       // light + shade
  g.generateTexture('loot_bag', 14 * p, 12 * p); g.destroy();
  return 'loot_bag';
}

export class Loot {
  // camp: the bundles lying around stay in the savegame (save.ground[location]); in a run they are gone afterwards
  constructor(scene, stored = null) {
    this.scene = scene; this.piles = []; this.tick = 0;
    this.I = scene.data_.leyla?.inventory || {};
    this.stored = stored;
    // a bundle without a place (savegame repair: a storage that lost its place) lies next to the van's door
    // the memory chest of a new Durchgang (#012) waits by the fire
    for (const p of stored || []) if (p.x == null && scene.campGeo) { p.x = p.memory && scene.campGeo.fireX ? scene.campGeo.fireX + 150 : scene.campGeo.doorX - 140; p.feet = scene.campGeo.floor * scene.T; }
    for (const p of stored || []) if (p.grid?.items?.length) {
      const pile = { x: p.x, feet: p.feet, grid: p.grid, sprite: null, ...(p.memory ? { memory: true } : {}) };
      this.show(pile, p.x, true);
      if (p.memory && pile.sprite) {
        pile.sprite.setTint(0xffd27a).setScale(1.3);
        pile.tag = scene.add.text(p.x, p.feet - 64, 'Erinnerungskiste', { fontFamily: 'VT323, monospace', fontSize: '26px', color: '#ffd27a', stroke: '#0d0a12', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(19);
      }
    }
  }
  get range() { return this.I.pickupRange ?? 150; }

  // a new bundle somewhere (things that do not fit start another one next to it)
  drop(x, feet, things, spread = this.I.dropSpread ?? 90) {
    let rest = things.map(t => ({ ...t }));
    for (let i = 0; rest.length && i < 6; i++) {
      const pile = this.make(x + (Math.random() - 0.5) * spread + i * 30, feet);
      rest = rest.map(t => ({ ...t, n: add(this.scene.data_, pile.grid, t.a, t.id, t.n) })).filter(t => t.n > 0);
      this.show(pile, x);
    }
  }
  make(x, feet) { return { x, feet, grid: newGrid(...PILE), sprite: null }; }
  // k.o. in a run (design.md › k.o. neu): Leyla's backpack stays where she fell, as it was (same grid), glowing, with a tag.
  // One chance: a knock-out before she picks it up and it is gone for good (forget()).
  dropPack(x, feet, grid) {
    const pile = { x, feet, grid: { w: grid.w, h: grid.h, items: grid.items.map(e => ({ ...e })) }, sprite: null, pack: true };
    if (!pile.grid.items.length) return null;
    this.show(pile, x, true);
    const s = this.scene;
    pile.sprite?.setTint(0xff6ad5).setScale(1.25);
    pile.tag = s.add.text(x, feet - 64, 'Dein Rucksack', { fontFamily: 'VT323, monospace', fontSize: '26px', color: '#ffb3ec', stroke: '#0d0a12', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(19);
    return pile;
  }
  forget(pile) {
    if (!pile) return;
    pile.sprite?.destroy(); pile.tag?.destroy();
    const i = this.piles.indexOf(pile); if (i >= 0) this.piles.splice(i, 1);
    this.store();
  }
  show(pile, fromX = pile.x, still = false) {
    if (pile.sprite || !pile.grid.items.length) return;
    const s = this.scene, sp = s.add.image(still ? pile.x : fromX, pile.feet, bagTexture(s)).setOrigin(0.5, 1).setDepth(4);
    pile.sprite = sp;
    this.piles.push(pile);
    this.store();
    if (still) return;
    s.tweens.add({ targets: sp, x: pile.x, duration: 380, ease: 'Sine.easeOut' });
    s.tweens.add({ targets: sp, y: pile.feet - 70, duration: 190, yoyo: true, ease: 'Quad.easeOut' });
  }
  // after changes in the ground inventory: empty bundles disappear, a new bundle with things appears
  sync(pile) {
    if (pile && pile.grid.items.length && !pile.sprite) this.show(pile);
    for (const p of [...this.piles]) if (!p.grid.items.length) { p.sprite?.destroy(); p.tag?.destroy(); this.piles.splice(this.piles.indexOf(p), 1); if (p.pack && this.scene.lostPack === p) this.scene.lostPack = null; }
    this.store();
  }
  store() { if (this.stored) this.stored.splice(0, this.stored.length, ...this.piles.map(p => ({ x: Math.round(p.x), feet: Math.round(p.feet), grid: p.grid, ...(p.memory ? { memory: true } : {}) }))); }
  // throw something on the ground: into the bundle in reach, otherwise a new one at Leyla's feet → how many did not fit
  throwDown(e) {
    const D = this.scene.data_, l = this.scene.leyla;
    let pile = this.nearest(), left = e.n;
    for (let i = 0; i < 2 && left > 0; i++) {
      if (!pile || i) pile = this.make(l.x + l.facing * 40, l.feet);
      left = addEntry(D, pile.grid, e, left);
      this.show(pile, l.x);
    }
    this.sync();
    return left;
  }
  nearest() {
    const l = this.scene.leyla;
    let best = null, bd = this.range;
    for (const p of this.piles) { const d = Math.hypot(p.x - l.x, (p.feet - l.feet) * 1.5); if (d <= bd) { best = p; bd = d; } }
    return best;
  }
  // every bundle in reach, the nearest first (the ground inventory pages through them: L1/R1 with the cursor on the ground)
  inReach() {
    const l = this.scene.leyla, d = p => Math.hypot(p.x - l.x, (p.feet - l.feet) * 1.5);
    return this.piles.filter(p => d(p) <= this.range && p.grid.items.length).sort((a, b) => d(a) - d(b));
  }
  // the ground inventory: the nearest bundle in reach, otherwise an empty one at Leyla's feet (appears once something lies in it)
  floor() { const l = this.scene.leyla; return this.nearest() || this.make(l.x, l.feet); }

  fromEnemy(e) {
    const t = (e.d.loot && (this.scene.lootRoll ? this.scene.lootRoll(e.d.loot) : rollLoot(this.scene.data_, e.d.loot))) || [];
    // Gegner › Beute › Lässt seine Waffe fallen (#004): what a raider fights with, Leyla can pick up and use
    if (e.d.weapon && this.scene.data_.weapons?.[e.d.weapon] && Math.random() * 100 < (e.d.dropWeapon ?? 0)) t.push({ a: 'weapons', id: e.d.weapon, n: 1 });
    if (t.length) this.drop(e.x, e.feet, t);
  }

  clear() { for (const p of this.piles) { p.sprite?.destroy(); p.tag?.destroy(); } this.piles = []; }

  update(time) {
    const s = this.scene, D = s.data_;
    for (const p of this.piles) if (p.sprite) p.sprite.setAlpha(p.pack ? 0.75 + 0.25 * Math.sin(time / 140) : 0.85 + 0.15 * Math.sin(time / 200 + p.x));
    // walking past: top up stacks Leyla already carries
    if (this.I.autoStack === false || ++this.tick % 6 || !s.box) return;
    const bag = s.box.save.inv.grids.backpack, l = s.leyla;
    for (const p of this.piles) {
      if (p.pack || Math.hypot(p.x - l.x, (p.feet - l.feet) * 1.5) > this.range) continue;
      let moved = false;
      for (const e of [...p.grid.items]) {
        if (stackMax(D, e.a, e.id) <= 1 || !bag.items.some(b => b.a === e.a && b.id === e.id)) continue;
        const left = addEntry(D, bag, e, e.n, { stackOnly: true });
        if (left === e.n) continue;
        s.fx.text(l.x, l.feet - l.height - 20, `+${e.n - left} ${thing(D, e.a, e.id)?.name || e.id}`, { color: '#9be8d8', size: 34, rise: 60, life: 900 });
        e.n = left; moved = true;
        if (!left) p.grid.items.splice(p.grid.items.indexOf(e), 1);
      }
      if (moved) { s.invChanged('floor'); this.sync(); }
    }
  }
  state() { return this.piles.map(p => ({ x: Math.round(p.x), items: p.grid.items.map(e => `${e.id}×${e.n}`) })); }
}
