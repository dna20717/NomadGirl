// Feedback for the test phase (#181, Daniel 23.11.2026: „Feedback konkreter als ‚dieses Level hat mir gut gefallen‘“).
// Self-contained: knows nothing of the game, an adapter tells it how (game/play/feedback_adapter.js).
//   trigger: controller home button (16), Select + Start together, key F8 (all from the config)
//   then: game paused, picture of the moment, window (dialog.js), send (send.js) with the trace of the last seconds (recorder.js)
//   a JS error offers feedback with a small hint (once per error and session)
// To take it out after the test phase: delete game/feedback/ and the adapter, and the two lines that install it.
//
// adapter = { pause(), resume(), shot() → Promise<dataURL|null>, context() → {}, where() → 'short place', reproduce() → 'command line' }
import { Recorder } from './recorder.js';
import { FeedbackDialog } from './dialog.js';
import { sendFeedback, flushQueue, queued } from './send.js';
import { FeedbackBoard } from './board.js';   // #194
import { el } from '../ui.js';
import { icon } from '../icons.js';

export const FEEDBACK_DEFAULTS = { enabled: true, buttons: ['16'], combo: true, key: 'F8', seconds: 30, every: 15, shotWidth: 640, offerOnError: true };

export function installFeedback(adapter, config = {}) {
  const c = { ...FEEDBACK_DEFAULTS, ...config };
  const rec = new Recorder({ seconds: c.seconds, every: c.every });
  if (c.enabled === false) return { rec, open() {}, state: () => ({ enabled: false }) };
  if (!document.querySelector('link[data-feedback]')) document.head.append(el('link', { rel: 'stylesheet', href: new URL('./feedback.css', import.meta.url).href, 'data-feedback': '' }));
  let dialog = null, hint = null, last = null;
  const offered = new Set();

  async function open(preset = {}) {
    if (dialog?.isOpen) return;
    hideHint();
    const at = performance.now(), trace = rec.dump();   // the window ends now, not after typing
    adapter.pause();
    const shot = await adapter.shot(c.shotWidth).catch(() => null);
    const context = adapter.context(), where = adapter.where();
    dialog = new FeedbackDialog({
      shot, where, chip: preset.chip || null, text: preset.text || '',
      onSend: async ({ chip, text }) => {
        const payload = { chip, text, where, context, reproduce: adapter.reproduce(), trace, shot, at: new Date(Date.now() - (performance.now() - at)).toISOString() };
        last = { ...payload, shot: !!shot };
        return sendFeedback(payload, c.url);
      },
      onClose: () => { dialog = null; adapter.resume(); },
    }).mount();
  }

  // ---------- triggers ----------
  window.addEventListener('keydown', e => {
    if (e.key === c.key && !e.repeat && !dialog?.isOpen && !board?.isOpen) { e.preventDefault(); e.stopPropagation(); open(); }
  }, true);
  let prev = new Set();
  const buttons = (c.buttons || []).map(String);
  const poll = () => {
    const g = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
    const now = new Set();
    if (g) g.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) now.add(String(i)); });
    const hit = k => now.has(k) && !prev.has(k);
    const combo = c.combo && now.has('8') && now.has('9') && (hit('8') || hit('9'));
    if (!dialog?.isOpen && !board?.isOpen && (buttons.some(hit) || combo)) open();
    prev = now;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  // ---------- errors ----------
  const onError = message => {
    const fresh = rec.error(message);
    if (fresh && c.offerOnError && !offered.has(message) && !dialog?.isOpen) { offered.add(message); showHint(message); }
  };
  window.addEventListener('error', e => onError(e.message || String(e.error)));
  window.addEventListener('unhandledrejection', e => onError(`Promise: ${e.reason?.message || e.reason}`));
  const err0 = console.error.bind(console);
  console.error = (...a) => { try { rec.error(a.map(x => x?.message || String(x)).join(' ')); } catch { /* never break the console */ } err0(...a); };

  function showHint(message) {
    hideHint();
    hint = el('div', { class: 'fb-hintbox', role: 'status' },
      icon('bug', 18), el('div', {}, el('b', {}, 'Da lief was schief.'), el('div', { class: 'fb-hintmsg' }, message.slice(0, 90))),
      el('button', { class: 'fb-btn fb-send', type: 'button', onclick: () => open({ chip: 'bug' }) }, 'Melden'),
      el('button', { class: 'fb-x', type: 'button', 'aria-label': 'Schließen', onclick: hideHint }, icon('x', 14)));
    document.body.append(hint);
    hint.timer = setTimeout(hideHint, 9000);
  }
  function hideHint() { if (hint) { clearTimeout(hint.timer); hint.remove(); hint = null; } }

  // #194 the board over the paused game (pause menu)
  let board = null;
  function openBoard() {
    if (board?.isOpen || dialog?.isOpen) return;
    adapter.pause();
    board = new FeedbackBoard({ onClose: () => { board = null; adapter.resume(); } }).mount();
  }

  flushQueue(c.url);   // what waited from last time
  return {
    rec, open, openBoard, board: () => board,
    // for tests and Ava: is it open, what was sent last, what waits
    state: () => ({ enabled: true, open: !!dialog?.isOpen, hint: !!hint, last, queued: queued().length, trace: rec.dump() }),
    dialog: () => dialog,
  };
}
