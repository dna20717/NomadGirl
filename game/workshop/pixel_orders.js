// Pixel orders (NomadPixel, Daniel 19.11.2026: "das UI ist für diese Tätigkeit unübersichtlich, die Tooltips funktionieren nicht"):
// a step-by-step, touch-friendly inspector instead of the generic form. Every explanation is visible text (no hover tooltips),
// choices are big buttons, references and results are pictures. Data stays the schema's (area pixelOrders).
import { icon } from '../icons.js';
import { el, openDialogue } from '../ui.js';
import { PIXEL_STATUS } from '../../engine/schema.js';
import { assetThumb } from './asset_preview.js';

const AREA = 'pixelOrders';
const TYPES = [
  ['icons', 'grid', 'Symbole', 'Mehrere kleine Icons in einem Raster, z. B. fürs Inventar oder Rezepte'],
  ['image', 'image', 'Einzelbild', 'Ein Objekt, Möbelstück, Schild oder Porträt'],
  ['tiles', 'tile', 'Kacheln', 'Boden, Wände und Übergänge, nahtlos'],
  ['animation', 'anim', 'Animation', 'Eine Bewegung in mehreren Frames'],
  ['photo', 'upload', 'Foto → Pixel', 'Aus einem Foto eine Pixelgrafik machen'],
  ['edit', 'brush', 'Überarbeiten', 'Eine bestehende Grafik verbessern oder ergänzen'],
];
const SIZES = {
  icons: [[32, 'Standard fürs Inventar'], [64, 'groß']],
  image: [[32, 'klein'], [64, 'mittel'], [128, 'groß']],
  tiles: [[64, 'eine Spiel-Kachel']],
  animation: [[64, 'klein'], [128, 'mittel']],
  photo: [[64, 'Avatar'], [96, 'Porträt'], [128, 'detailreich']],
  edit: [],
};
const VIEWS = ['Frontal', 'Diagonal (45°)', 'Seitlich', 'Von oben'];
const STATUS_ICON = { open: 'clock', working: 'hourglass', done: 'check', question: 'help' };
const REFERENCE_KINDS = new Set(['icons', 'reference', 'image', 'tiles', 'animation', 'source']);

// one step of the form: number, title, a line of help (always visible) and the content
const step = (n, title, help, ...content) => el('section', { class: 'px-card' },
  el('h4', { class: 'px-title' }, el('span', { class: 'px-num' }, String(n)), title),
  help ? el('p', { class: 'px-help' }, help) : null, ...content);

export function pixelOrderInspector(w, x, id) {
  const assets = w.p.data.assets || {};
  const put = (key, val) => w.change(AREA, () => { if (val === undefined || val === '' || (Array.isArray(val) && !val.length)) delete x[key]; else x[key] = val; });
  const textarea = (key, placeholder, rows, toValue = v => v, fromValue = v => v ?? '') => {
    const t = el('textarea', { class: 'ed-field px-text', rows, placeholder }, fromValue(x[key]));
    t.addEventListener('change', () => put(key, toValue(t.value)));
    return t;
  };
  const out = [];

  // status as a row of pills + Claude's answer on top, so the state is clear at a glance
  out.push(el('div', { class: 'px-status' }, ...PIXEL_STATUS.map(([k, name]) =>
    el('button', { class: 'px-pill ' + k + (x.status === k ? ' on' : ''), onclick: () => put('status', k) }, icon(STATUS_ICON[k], 14), ' ' + name))));
  if (x.answer) out.push(el('div', { class: 'px-answer ' + (x.status || '') }, el('b', {}, x.status === 'question' ? 'Rückfrage von Claude' : 'Antwort von Claude'), el('p', {}, x.answer)));

  // 1 what
  const name = el('input', { class: 'ed-field', value: x.name || '', placeholder: 'z. B. Angelzubehör' });
  name.addEventListener('change', () => put('name', name.value.trim() || 'Pixel-Auftrag'));
  out.push(step(1, 'Was soll gezeichnet werden?', 'Kurzer Name für den Auftrag und die Art der Grafik.',
    el('label', { class: 'px-label' }, 'Name', name),
    el('div', { class: 'px-types' }, ...TYPES.map(([k, ic, title, text]) =>
      el('button', { class: 'px-type' + (x.type === k ? ' on' : ''), onclick: () => w.change(AREA, () => { x.type = k; const s = SIZES[k][0]; if (s && !x.size) x.size = [s[0], s[0]]; }) },
        icon(ic, 22), el('b', {}, title), el('small', {}, text))))));

  // 2 description + motifs
  const motifs = x.motifs || [];
  out.push(step(2, 'Beschreibung', 'Wofür ist die Grafik, wo erscheint sie im Spiel, welche Stimmung? Bei Symbolen unten jedes Motiv in eine eigene Zeile.',
    el('label', { class: 'px-label' }, 'Was gebraucht wird', textarea('brief', 'z. B. Zubehör fürs neue Angel-Minispiel, rostig und improvisiert, passend zu den Küchen-Symbolen', 3)),
    x.type === 'icons' || x.type === 'tiles' || motifs.length ? el('label', { class: 'px-label' }, `Motive${motifs.length ? ` (${motifs.length})` : ''}`,
      textarea('motifs', 'Angelrute\nKöder\nFischernetz', Math.min(10, Math.max(3, motifs.length + 1)),
        v => { const l = v.split('\n').map(s => s.trim()).filter(Boolean); return l.length ? l : undefined; }, v => (v || []).join('\n'))) : null));

  // 3 format: presets as buttons, details folded away
  const sizes = SIZES[x.type] || [], size = x.size || [];
  const autoGrid = x.type === 'icons' && motifs.length ? [Math.min(8, motifs.length), Math.ceil(motifs.length / 8)] : null;
  out.push(step(3, 'Format', x.type === 'edit' ? 'Beim Überarbeiten gilt die Größe der Vorlage.' : 'Größe je Grafik in Pixeln. Im Zweifel den ersten Vorschlag nehmen.',
    sizes.length ? el('div', { class: 'px-choices' }, ...sizes.map(([s, text]) =>
      el('button', { class: 'px-choice' + (size[0] === s && size[1] === s ? ' on' : ''), onclick: () => put('size', [s, s]) }, el('b', {}, `${s} × ${s}`), el('small', {}, text)))) : null,
    x.type === 'animation' ? el('div', { class: 'px-row' }, el('span', { class: 'px-label' }, 'Frames'),
      ...[4, 6, 8].map(n => el('button', { class: 'px-choice small' + (x.frames === n ? ' on' : ''), onclick: () => put('frames', n) }, String(n)))) : null,
    el('div', { class: 'px-row' }, el('span', { class: 'px-label' }, 'Ansicht'),
      ...VIEWS.map(v => el('button', { class: 'px-choice small' + (x.view === v ? ' on' : ''), onclick: () => put('view', x.view === v ? undefined : v) }, v))),
    autoGrid ? el('p', { class: 'px-help' }, icon('grid', 13), ` Raster: ${(x.grid || autoGrid).join(' × ')} Felder`, x.grid ? null : ' (ergibt sich aus den Motiven)') : null,
    el('details', { class: 'px-more' }, el('summary', {}, 'Genau einstellen'),
      el('div', { class: 'px-label' }, 'Größe (px)', w.pair(x.size, ['B', 'H'], v => put('size', v))),
      el('div', { class: 'px-label' }, 'Raster (Spalten × Zeilen)', w.pair(x.grid, ['Sp', 'Z'], v => put('grid', v))),
      el('label', { class: 'px-label' }, 'Ansicht (frei)', (() => { const i = el('input', { class: 'ed-field', value: x.view || '' }); i.addEventListener('change', () => put('view', i.value.trim())); return i; })()))));

  // 4 references: pictures, add by tapping, upload a photo directly
  const refs = (x.references || []).filter(r => assets[r]);
  const file = el('input', { type: 'file', accept: 'image/png,image/gif,image/jpeg,image/webp', hidden: true });
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) uploadReference(w, x, id, f); file.value = ''; });
  const targets = Object.entries(assets).filter(([, a]) => a.kind === 'icons');
  out.push(step(4, 'Vorbilder', 'Bestehende Grafiken, an deren Stil sich Claude halten soll, oder ein Foto als Vorlage. Optional, aber hilft sehr.',
    refs.length ? el('div', { class: 'px-thumbs' }, ...refs.map(r => el('div', { class: 'px-thumb' },
      el('button', { class: 'px-thumbPic', title: 'Öffnen', onclick: () => w.go({ area: 'assets', choice: r }) }, assetThumb(w, assets[r], 88)),
      el('span', {}, assets[r].name || r),
      el('button', { class: 'ed-button small', title: 'Entfernen', onclick: () => put('references', (x.references || []).filter(v => v !== r)) }, icon('x', 12))))) : null,
    el('div', { class: 'px-row' },
      el('button', { class: 'ed-button wide', onclick: () => pickReferences(w, x) }, icon('image', 16), ' Vorbild wählen'),
      el('button', { class: 'ed-button wide', onclick: () => file.click() }, icon('upload', 16), ' Foto hochladen'), file),
    w.uploadNote && w.uploadFor === id ? el('p', { class: 'px-help' }, w.uploadNote) : null,
    x.type === 'icons' || x.target ? el('div', { class: 'px-label' }, 'In ein bestehendes Raster einfügen? (optional)',
      el('div', { class: 'px-row' }, x.target && assets[x.target] ? assetThumb(w, assets[x.target], 40) : null,
        w.selection(targets.map(([k, a]) => [k, a.name || k]), x.target, v => put('target', v || undefined), '– neues Raster –'))) : null));

  // 5 result
  const results = (x.results || []).filter(r => assets[r]);
  out.push(step(5, 'Ergebnis', results.length ? 'Antippen öffnet die Grafik groß.' : 'Hier erscheinen die fertigen Grafiken, sobald Claude den Auftrag erledigt hat.',
    results.length ? el('div', { class: 'px-thumbs big' }, ...results.map(r => el('div', { class: 'px-thumb' },
      el('button', { class: 'px-thumbPic', onclick: () => w.go({ area: 'assets', choice: r }) }, assetThumb(w, assets[r], 160)), el('span', {}, assets[r].name || r)))) : null,
    x.date ? el('p', { class: 'px-help' }, `Erledigt am ${x.date}`) : null));

  // next step: what to do now
  if (x.status === 'open' || !x.status) out.push(el('div', { class: 'px-next' },
    el('b', {}, icon('arrow_right', 14), ' So geht’s weiter'),
    el('ol', {}, el('li', {}, 'Speichern (oben, sonst automatisch nach einer Minute).'),
      el('li', {}, 'In Claude Code (Projekt NomadGirl) eintippen: ', el('code', {}, '/pixel Aufträge'),
        el('button', { class: 'ed-button small', title: 'Kopieren', onclick: () => navigator.clipboard?.writeText('/pixel Aufträge').then(() => w.hint('Kopiert: /pixel Aufträge'), () => {}) }, icon('duplicate', 12)))),
    el('small', {}, 'Claude zeichnet in AAP-64, legt die Grafiken als Assets an und trägt sie hier ein.')));
  return out;
}

// dialog with all pictures that make sense as a template; tap toggles, search filters
function pickReferences(w, x) {
  const assets = w.p.data.assets || {};
  let chosen = new Set(x.references || []), q = '';
  const grid = el('div', { class: 'px-pickGrid' });
  const fill = () => grid.replaceChildren(...Object.entries(assets)
    .filter(([k, a]) => REFERENCE_KINDS.has(a.kind) && (!q || (a.name || k).toLowerCase().includes(q)))
    .map(([k, a]) => el('button', { class: 'px-pick' + (chosen.has(k) ? ' on' : ''), onclick: () => { chosen.has(k) ? chosen.delete(k) : chosen.add(k); fill(); } },
      assetThumb(w, a, 72), el('span', {}, a.name || k), chosen.has(k) ? el('i', { class: 'px-tick' }, icon('check', 14)) : null)));
  const search = el('input', { type: 'search', class: 'ed-field', placeholder: 'Suchen, z. B. Küche …' });
  search.addEventListener('input', () => { q = search.value.toLowerCase(); fill(); });
  fill();
  openDialogue({ title: 'Vorbilder wählen', icon: 'image', wide: true, content: [el('p', { class: 'px-help' }, 'Antippen wählt aus oder ab. Am besten 1–3 Grafiken im gewünschten Stil.'), search, grid],
    main: { text: 'Übernehmen', icon: 'check', action: () => w.change(AREA, () => { if (chosen.size) x.references = [...chosen]; else delete x.references; }) } });
}

// a photo as template: becomes an asset of the kind "reference" and is linked right away
function uploadReference(w, x, id, f) {
  const assets = w.p.data.assets;
  let aid = `vorlage_${id}`, n = 2;
  while (assets[aid]) aid = `vorlage_${id}_${n++}`;
  const a = { name: `Vorlage: ${x.name || id}`, kind: 'reference', file: 'assets/', description: `Foto-Vorlage für den Pixel-Auftrag „${x.name || id}“`, date: new Date().toISOString().slice(0, 10) };
  w.change('assets', () => { assets[aid] = a; });
  w.change(AREA, () => { x.references = [...(x.references || []), aid]; });
  w.uploadFor = id;
  w.uploadPicture(aid, a, f);
}
