// #112 Hörprobe: renders every voice of Werkstatt › Stimmen saying its sample (offline, in the browser) into WAV files and one
// demo file, and reports peak and loudness per voice. Server must run (npm run serve).
//   node tools/voice_demo.mjs            → output/voices/<id>.wav, output/voices/hoerprobe.wav
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.GAME_URL ? new URL('.', process.env.GAME_URL).href : 'http://localhost:8766/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + 'workshop.html');
const out = await page.evaluate(async () => {
  const { speak } = await import('./game/voice.js');
  const V = await (await fetch('./projects/nomadgirl/data/voices.json')).json(), SR = 44100, res = {};
  for (const [id, v] of Object.entries(V)) {
    const text = v.sample || 'Hallo! Schön, dich zu sehen.', c = new OfflineAudioContext(1, SR * 6, SR);
    const h = speak(c, c.destination, v, text, { volume: 0.8, max: 10 });
    const buf = await c.startRendering(), d = buf.getChannelData(0), end = Math.min(d.length, Math.ceil((h.end + 0.3) * SR));
    let peak = 0, sum = 0; for (let i = 0; i < end; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
    res[id] = { name: v.name, text, peak, rms: Math.sqrt(sum / end), data: Array.from(d.subarray(0, end), x => Math.max(-1, Math.min(1, x))) };
  }
  return res;
});
await browser.close();
const wav = (samples, sr = 44100) => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => b.writeInt16LE(Math.round(x * 32767), 44 + i * 2));
  return b;
};
fs.mkdirSync('output/voices', { recursive: true });
const all = [], gap = new Array(Math.round(44100 * 0.6)).fill(0);
for (const [id, r] of Object.entries(out)) {
  // normalise every voice to the same peak for the demo (the game keeps the volume field)
  const k = r.peak > 0 ? 0.8 / r.peak : 1, s = r.data.map(x => x * k);
  fs.writeFileSync(`output/voices/${id}.wav`, wav(s));
  for (const x of s) all.push(x); for (const x of gap) all.push(x);
  console.log(`${id.padEnd(12)} ${r.name.padEnd(16)} Spitze ${r.peak.toFixed(2)}  Pegel ${r.rms.toFixed(3)}  ${(r.data.length / 44100).toFixed(1)} s  „${r.text}“`);
}
fs.writeFileSync('output/voices/hoerprobe.wav', wav(all));
console.log('→ output/voices/hoerprobe.wav');
