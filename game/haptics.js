// Haptics of the Bit-Stapel, the same everywhere (Daniel, 18.11.2026: „es soll immer die Standalone-Variante und die Ingame-Version betreffen“):
// the board (stack_view.js) buzzes on its moments in the demo (/duel), on the phone (/mobile) and in the game's duel window.
//   phone: the vibrate API (Android); iOS has none, there a user's own tap gives the system switch tick (Safari 18+)
//   controller: the gamepad's rumble (vibrationActuator), e.g. in the game with a pad
// One switch for all: localStorage „nomad.haptics“ (the phone's toggle, the game's Optionen › Vibration).
export const BUZZ = { pick: 8, send: 14, wipe: [12, 40, 22], hit: 35, heavy: [60, 40, 60], overflow: [10, 30, 10, 30, 10], win: [20, 60, 20, 60, 90], lose: [220] };
const KEY = 'nomad.haptics';
const log = [];   // what was buzzed (tests)
export const buzzLog = () => log;

export function hapticsOn() {
  try { const v = localStorage.getItem(KEY) ?? localStorage.getItem('bitstapel.buzz'); return v !== '0'; } catch { return true; }
}
export function setHaptics(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } if (on) buzz('pick', { user: true }); }

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
let iosSwitch = null;
function iosTick() {
  if (canVibrate() || typeof document === 'undefined') return;
  if (!iosSwitch) { const l = document.createElement('label'); l.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.append(i); document.body.append(l); iosSwitch = l; }
  iosSwitch.click();
}
// rumble on every connected pad: the pattern's on-times as one effect, stronger for heavy things
function rumble(pattern) {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  if (!pads.length) return;
  const on = [].concat(pattern).filter((_, i) => i % 2 === 0), ms = on.reduce((a, b) => a + b, 0), k = Math.min(1, ms / 120);
  for (const p of pads) p.vibrationActuator?.playEffect?.('dual-rumble', { duration: Math.max(20, ms), strongMagnitude: 0.25 + 0.6 * k, weakMagnitude: 0.4 + 0.5 * k }).catch?.(() => {});
}
// one moment → the phone buzzes and the pad rumbles; user = it came from the player's own tap (iOS can only tick then)
export function buzz(kind, { user = false } = {}) {
  log.push(kind);
  if (!hapticsOn() || !BUZZ[kind]) return;
  if (canVibrate()) navigator.vibrate(BUZZ[kind]); else if (user) iosTick();
  rumble(BUZZ[kind]);
}
// what a placed bit means for Leyla's hands: her own bit (send, wipe), the opponent's (hit, heavy), an overflow
export function buzzPlace(ev) {
  if (ev.side === 'player') buzz(ev.destroyed ? 'wipe' : 'send', { user: true });
  else { const hurt = (ev.damage || 0) + (ev.fire || 0); if (hurt >= 10) buzz('heavy'); else if (hurt) buzz('hit'); }
  if (ev.overflow) setTimeout(() => buzz('overflow'), 120);
}
