// Salvage in the camp (#023): the wreck stands at the end of the camp where it was found (design.md: „Das Wrack taucht am Ende des
// Camps an der Location auf, wo es gefunden wurde“). E shows the salvage list, builds in the parts the camp holds, the last step is the
// test start. Mixed into Camp like CampLife and CampActions.
import { here, progress, missing, install, finish, sstate } from '../salvage.js';
import { advance, clockText, swapTractor } from '../save.js';
import { buildMegarig } from '../../engine/megarig.js';
import { activate, activeMega, owned } from '../mega.js';
import { MegarigView } from './megarig_view.js';

const col = c => parseInt(String(c).slice(1), 16);
const lerp = (a, b, t) => { const A = col(a), B = col(b), m = (s) => Math.round(((A >> s) & 255) + ((((B >> s) & 255) - ((A >> s) & 255)) * t)); return (m(16) << 16) | (m(8) << 8) | m(0); };

export class CampSalvage {
  placeWreck() {
    const g = this.geo, s = this.scene, D = this.D, save = this.box.save;
    if (!g.wreck) return;
    const id = g.wreck.id, x = D.salvage[id], P = progress(D, save, id), T = s.T;
    const x0 = g.wreck.x0, x1 = g.wreck.x1, ground = this.ground, mid = (x0 + x1) / 2;
    this.wreckArt?.forEach(o => o.destroy());
    this.wreckArt = [];
    // the further it is, the less rust: tint from rust-dark to clean, a tilt that straightens once the running gear is in
    const t = P.share, gear = P.sections[0]?.done && (P.sections[1]?.done ?? true);
    const tint = lerp('#71413b', '#ffffff', 0.25 + 0.75 * t);
    if (x.look && s.textures.exists(x.look)) {
      const im = s.add.image(mid, ground + (gear ? 0 : 0.35 * T), x.look).setOrigin(0.5, 1).setScale(x.scale || 4).setDepth(-3.2).setTint(tint).setAngle(gear ? 0 : -3);
      this.wreckArt.push(im);
    } else if (x.megarig && D.megarigs?.[x.megarig]) this.wreckArt.push(...this.wreckRig(x.megarig, x0, x1, ground, t));
    else this.wreckArt.push(this.wreckCode(x.art || 'crawler', mid, ground, x1 - x0, tint, t));
    // sand drift in front, scattered parts while it is not finished
    const sand = s.add.graphics().setDepth(-3);
    sand.fillStyle(0xbb7547, 0.95).fillEllipse(mid - (x1 - x0) * 0.25, ground + 6, (x1 - x0) * 0.55 * (1 - t * 0.7), 46);
    sand.fillStyle(0xdba463, 0.9).fillEllipse(mid - (x1 - x0) * 0.25, ground + 2, (x1 - x0) * 0.42 * (1 - t * 0.7), 26);
    this.wreckArt.push(sand);
    // a sign with the project and the share
    const sx = x1 - 1.2 * T, sign = s.add.graphics().setDepth(-3.1);
    sign.fillStyle(0x322b28).fillRect(sx - 4, ground - 1.6 * T, 8, 1.6 * T);
    sign.fillStyle(0x141013).fillRect(sx - 1.1 * T, ground - 2.6 * T, 2.2 * T, 1.1 * T);
    sign.fillStyle(t >= 1 ? 0x5daf8d : 0xf9a31b).fillRect(sx - 1.05 * T, ground - 2.55 * T, 2.1 * T * Math.max(0.04, t), 0.2 * T);
    const txt = s.add.text(sx, ground - 2.2 * T, `${x.name.replace(/^(Der|Die|Das) /, '').toUpperCase()}\n${Math.round(t * 100)} %`, { fontFamily: 'VT323, monospace', fontSize: '24px', color: '#fef3c0', align: 'center', lineSpacing: -6 }).setOrigin(0.5, 0.2).setDepth(-3);
    this.wreckArt.push(sign, txt);
    if (!this.wreckSpot) {
      this.wreckSpot = { x: mid, w: Math.max(160, (x1 - x0) / 2), name: x.name, hint: () => (progress(D, this.box.save, id).ready ? 'Probestart' : 'Bergen'), act: () => this.wreckMenu(id) };
      this.hotspots.push(this.wreckSpot);
    }
    // the first time here: what Leyla says
    const S = sstate(save);
    if (!S.seen[id]) { S.seen[id] = true; this.box.persist?.(); s.time.delayedCall(1800, () => s.hud.toast(`Ein Wrack: ${x.name}`, x.text || 'Das könnte man wieder flottmachen.', 'drama', 6000)); }
  }

  // a mega rig as a wreck: its real drawing (megarig_view.js, first stage) scaled into the wreck's width, sunk, tilted, rusty
  wreckRig(mid, x0, x1, ground, t) {
    const s = this.scene, T = s.T, b = buildMegarig(this.D, mid, 0);
    if (!b) return [];
    const before = new Set(s.children.list);
    new MegarigView(s, b, T, { id: mid });
    const made = s.children.list.filter(o => !before.has(o)).sort((a, c) => (a.depth || 0) - (c.depth || 0));
    const k = (x1 - x0) / (b.len * T), air = b.kind === 'airship';
    // a wreck lies on the ground: the airship's hover height goes away, both sink into the sand
    const sink = (1 - t) * 0.5 * T + (air ? b.pieces[0].under * T * k : 0);
    // turn around the bottom middle (an inner container shifts the vehicle so its ground line runs through the pivot)
    const inner = s.add.container(-(b.x0 + b.len / 2) * T, -b.G * T, made);
    const box = s.add.container((x0 + x1) / 2, ground + sink, [inner]).setScale(k).setDepth(-3.25).setAngle(t >= 1 ? 0 : air ? 2 : -1.5);
    const rust = s.add.graphics().setDepth(-3.2).setBlendMode(Phaser.BlendModes.MULTIPLY);
    rust.fillStyle(0x8e5252, 0.55 * (1 - t)).fillRect(x0 - 40, ground - 40 * T * k, x1 - x0 + 80, 40 * T * k);
    return [box, rust];
  }

  // wrecks without a picture: a buried crawler (cab, track, toppled containers) or a collapsed airship (empty envelope, rotor)
  wreckCode(art, mid, ground, w, tint, t) {
    const g = this.scene.add.graphics().setDepth(-3.2), T = this.scene.T, P = 4, r = (x, y, ww, hh, c) => g.fillStyle(c, 1).fillRect(Math.round(x / P) * P, Math.round(y / P) * P, Math.round(ww / P) * P, Math.round(hh / P) * P);
    const sink = (1 - t) * 0.6 * T;
    if (art === 'airship') {
      g.fillStyle(0x6d758d).fillEllipse(mid + w * 0.08, ground - 1.3 * T + sink * 0.5, w * 0.9, 2.8 * T);
      g.fillStyle(0x8b93af).fillEllipse(mid + w * 0.08, ground - 1.5 * T + sink * 0.5, w * 0.82, 2.2 * T);
      for (let i = -3; i <= 3; i++) g.fillStyle(0x4a5462, 1).fillRect(mid + w * 0.08 + i * w * 0.11, ground - 2.3 * T, 4, 1.6 * T);
      r(mid - w * 0.48, ground - 2.6 * T + sink, 4.5 * T, 2.6 * T, 0xf9a31b); r(mid - w * 0.47, ground - 2.2 * T + sink, 1.6 * T, 1 * T, 0x141013);
      r(mid - w * 0.47 + 4, ground - 2.2 * T + sink + 4, 1.6 * T - 8, T - 8, t > 0.6 ? 0xffd541 : 0x242234);
      r(mid + w * 0.3, ground - 3.2 * T, 3.4 * T, 1 * T, 0x333941); r(mid + w * 0.3 + 1.4 * T, ground - 3.2 * T, 0.6 * T, T, 0xf9a31b);
      g.lineStyle(8, 0x242234).lineBetween(mid + w * 0.3 + 1.7 * T, ground - 2.2 * T, mid + w * 0.2, ground - 1.4 * T);
    } else {
      // two toppled containers behind, the cab and a track unit in front
      r(mid - w * 0.05, ground - 3.4 * T, 6 * T, 2.6 * T, 0x285cc4); r(mid - w * 0.05, ground - 3.4 * T, 6 * T, 8, 0x143464);
      r(mid + w * 0.2, ground - 2.6 * T, 5 * T, 2.6 * T, 0x8e5252); r(mid + w * 0.2, ground - 2.6 * T, 5 * T, 8, 0x5b3138);
      r(mid - w * 0.47, ground - 1.6 * T + sink, w * 0.9, 1.6 * T, 0x221c1a);
      for (let i = 0; i < 7; i++) { const cx = mid - w * 0.43 + i * w * 0.13; g.fillStyle(0x4a5462).fillCircle(cx, ground - 0.8 * T + sink, 0.6 * T); g.fillStyle(0x6d758d).fillCircle(cx, ground - 0.8 * T + sink, 0.2 * T); }
      r(mid - w * 0.48, ground - 4.2 * T + sink, 5 * T, 2.8 * T, 0xf9a31b); r(mid - w * 0.48, ground - 4.2 * T + sink, 5 * T, 8, 0x403353);
      r(mid - w * 0.48 + 1.6 * T, ground - 3.7 * T + sink, 3 * T, 1 * T, 0x141013); r(mid - w * 0.48 + 1.6 * T + 4, ground - 3.7 * T + sink + 4, 3 * T - 8, T - 8, t > 0.6 ? 0xffd541 : 0x242234);
    }
    g.setAlpha(1);
    if (tint !== 0xffffff) { const shade = this.scene.add.graphics().setDepth(-3.15); shade.fillStyle(0x3b1725, 0.35 * (1 - t)).fillRect(mid - w / 2, ground - 4.6 * T, w, 4.6 * T); this.wreckArt.push(shade); }
    return g;
  }

  wreckMenu(id) {
    const s = this.scene, D = this.D, save = this.box.save, x = D.salvage[id], P = progress(D, save, id);
    if (P.ready) {
      return s.hud.menu({ title: `${x.name}: Probestart`, sub: 'Alle Teile sind drin. Jetzt oder nie.', items: [
        { label: 'Starten', sub: x.tractor ? `${D.tractors?.[x.tractor]?.name || x.tractor} wird deine Zugmaschine, der Van bleibt hier als Basis` : x.megarig ? `${D.megarigs?.[x.megarig]?.name || x.megarig} ist freigeschaltet` : '', primary: true, act: () => this.wreckStart(id) },
        { label: 'Zurück', act: () => {} }] });
    }
    const sec = P.sections[P.current], miss = missing(D, save, id), canBuild = miss.some(m => m.have > 0);
    const rows = sec.rows.map(r => ({ label: `${r.name}  ${r.built}/${r.count}`, sub: r.built >= r.count ? 'eingebaut' : `${r.have} im Lager${r.whereNames.length ? ` · liegt in ${r.whereNames.join(', ')}` : ''}`, disabled: r.built >= r.count ? '✓' : r.have ? null : 'fehlt', act: () => this.wreckMenu(id) }));
    s.hud.menu({ title: `${x.name} · ${sec.name}`, sub: `Abschnitt ${P.current + 1} von ${P.sections.length} · ${Math.round(P.share * 100)} % · ${P.sections.map((q, i) => (q.done ? '✓' : i === P.current ? '▸' : '○') + ' ' + q.name).join('  ')}`, items: [
      { label: 'Einbauen', sub: canBuild ? 'Was im Lager, in der Kiste und im Rucksack liegt' : 'Noch keine passenden Teile dabei', primary: canBuild, disabled: canBuild ? null : 'keine Teile', act: () => this.wreckBuild(id) },
      ...rows,
      { label: 'Questlog', sub: 'Alle Abschnitte und Fundorte', act: () => s.hud.quests?.open('active') },
      { label: 'Zurück', act: () => {} }] });
  }

  wreckBuild(id) {
    const s = this.scene, D = this.D, save = this.box.save, res = install(D, save, id);
    if (!res.ok) return;
    advance(save, res.hours);
    s.fx?.sparks?.(this.wreckSpot.x, this.ground - 80, 0xffd27a, 18);
    s.cam?.shake?.(160, 0.003);
    this.box.persist?.();
    s.hud.toast(res.sectionDone ? `${res.section}: fertig!` : `Eingebaut: ${res.built.map(b => `${b.n}× ${b.name}`).join(', ')}`, `${res.hours} h geschraubt · ${clockText(save)}${res.ready ? ' · bereit zum Probestart' : ''}`, res.sectionDone ? 'good' : 'camp', 3600);
    this.placeWreck();
    s.hud.changed?.();
  }

  wreckStart(id) {
    const s = this.scene, D = this.D, save = this.box.save, x = D.salvage[id];
    const res = finish(D, save, id, swapTractor);
    if (!res.ok) return;
    s.achieve?.('salvage', 1, [id, ...(x.megarig ? ['megarig'] : []), ...(x.tractor ? ['tractor'] : [])]);
    this.box.persist?.();
    s.cam?.shake?.(900, 0.008);
    s.hud.toast(`${x.name} läuft!`, res.text, 'trophy', 6500);
    const sub = res.tractor ? `${D.tractors[res.tractor].name} zieht jetzt dein Rig` : res.megarig ? `Mega-Rig ${D.megarigs?.[res.megarig]?.name || res.megarig} freigeschaltet` : '';
    // #029: a mega rig asks right away whether Leyla moves aboard (the rig goes into its loading bay); later via the map's header
    if (res.megarig) s.time.delayedCall(2600, () => this.moveAboard(res.megarig, `${x.name} geborgen`));
    else s.time.delayedCall(2600, () => s.goCamp({ banner: [`${x.name} geborgen`, sub, 'trophy'], fade: 800, keepPlace: true }));
  }
}

// #029 moving into a mega rig (from the test start or the map): the rig parks in the loading bay, the workshops move aboard
CampSalvage.prototype.moveAboard = function (id, title = null) {
  const s = this.scene, D = this.D, save = this.box.save, V = D.megarigs?.[id] || {}, bay = D.tractors?.[save.rig.tractor]?.name || 'Rig';
  const go = () => {
    const r = activate(D, save, id);
    if (!r.ok) return s.hud.toast('Umzug geht nicht', r.why, 'warn');
    s.box.persist?.(true);
    s.goCamp({ banner: [`Willkommen an Bord: ${V.name || id}`, r.lost ? `${r.lost} Container passen noch nicht, sie warten im Lager` : `Dein ${bay} parkt in der Ladebucht`, 'trophy'], fade: 900 });
  };
  s.hud.menu({ title: title || `Umziehen: ${V.name || id}`, sub: `Ziehst du in ${V.name || id} um? Dein ${bay} fährt in die Ladebucht, alle Container und Werkstätten kommen mit an Bord. Zurück geht es jederzeit über die Ladebucht.`,
    items: [{ label: 'An Bord gehen', primary: true, act: go }, { label: 'Später (über die Karte)', act: () => s.goCamp({ fade: 600, keepPlace: true }) }],
    onClose: () => s.goCamp({ fade: 600, keepPlace: true }) });
};

// the wreck of this place for campLayout: id + width in tiles, if one stands here and is not done yet
export function wreckHere(D, save) {
  const id = here(D, save);
  if (!id || sstate(save).done[id]) return null;
  return { id, width: Math.max(6, D.salvage[id].width || 16) };
}
