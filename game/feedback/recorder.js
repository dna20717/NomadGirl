// Feedback for the test phase (#181): the trace of the last seconds, without DOM and without the game.
// The adapter (game/play/feedback_adapter.js) feeds it once per frame; dump() hands out what lies in the window.
//   samples  a small state every `every` frames (default 4× per second at 60 fps)
//   inputs   only the frames where the held keys change ({ t, held: 'left+jump' })
//   events   what the adapter reports (room, mode, health, kills, window) and console errors
// Times are milliseconds of the game clock (performance.now() for errors), relative to the moment of dump().

export class Recorder {
  constructor({ seconds = 30, every = 15, maxEvents = 400 } = {}) {
    this.ms = seconds * 1000; this.every = Math.max(1, every); this.maxEvents = maxEvents;
    this.samples = []; this.inputs = []; this.events = []; this.errors = [];
    this.frames = 0; this.lastHeld = null; this.lastT = 0; this.fps = [];
  }
  // once per frame: t = clock in ms, held = names of the held inputs, sample = () => small state (only called when due)
  frame(t, held, sample) {
    this.frames++;
    if (this.lastT && t > this.lastT) { this.fps.push([t, t - this.lastT]); }
    this.lastT = t;
    const h = held.join('+');
    if (h !== this.lastHeld) { this.inputs.push({ t, held: h }); this.lastHeld = h; }
    if (this.frames % this.every === 0) { const s = sample(); if (s) this.samples.push({ t, s }); }
    this.trim(t);
  }
  event(t, type, data = {}) { this.events.push({ t, type, ...data }); if (this.events.length > this.maxEvents) this.events.shift(); }
  error(message, t = performance.now()) {
    const m = String(message).slice(0, 500);
    const last = this.errors.at(-1);
    if (last && last.message === m) { last.count++; last.t = t; return false; }
    this.errors.push({ t, message: m, count: 1 }); if (this.errors.length > 30) this.errors.shift();
    return true;
  }
  trim(t) {
    const from = t - this.ms;
    const cut = list => { let i = 0; while (i < list.length && list[i].t < from) i++; if (i) list.splice(0, i); };
    cut(this.samples); cut(this.events);
    // keep the input that was held when the window starts
    let i = 0; while (i + 1 < this.inputs.length && this.inputs[i + 1].t < from) i++; if (i) this.inputs.splice(0, i);
    let k = 0; while (k < this.fps.length && this.fps[k][0] < from) k++; if (k) this.fps.splice(0, k);
  }
  // fps over the window: average and the worst frame
  fpsInfo() {
    if (!this.fps.length) return null;
    const d = this.fps.map(f => f[1]), avg = d.reduce((a, b) => a + b, 0) / d.length;
    return { avg: Math.round(1000 / avg), worstMs: Math.round(Math.max(...d)) };
  }
  dump(t = this.lastT) {
    this.trim(t);
    const rel = x => Math.round(x - t);
    return {
      seconds: this.ms / 1000,
      fps: this.fpsInfo(),
      samples: this.samples.map(x => ({ t: rel(x.t), ...x.s })),
      inputs: this.inputs.map(x => ({ t: Math.max(rel(x.t), -this.ms), held: x.held })),
      events: this.events.map(x => ({ ...x, t: rel(x.t) })),
      errors: this.errors.map(x => ({ ...x, t: Math.round(x.t - performance.now()) })),
    };
  }
}
