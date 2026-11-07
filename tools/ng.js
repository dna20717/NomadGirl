#!/usr/bin/env node
// ng – command line for NomadGirl. Same logic as the workshop (engine/project.js + engine/schema.js).
// Ava uses it to check and edit the game data; Daniel uses the workshop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from './loader.js';
import { pretty } from './json.js';
import { AREAS, GROUPS, fields, loadProject, validateProject, usages, renameEntry, removeEntry, rowText, get, set } from '../engine/project.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf('--' + n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const projectDir = path.resolve(flag('project') || path.join(repo, 'projects/nomadgirl'));
const dry = !!flag('dry');
const [cmd, ...rest] = args;

const HELP = `ng – Kommandozeile für NomadGirl (Projekt: ${path.relative(process.cwd(), projectDir) || '.'})

  check                              Spieldaten prüfen (wie „Prüfung“ in der Werkstatt)
  areas                              alle Bereiche mit Anzahl
  fields <area>                      Felder eines Bereichs (Schlüssel, Typ, Einheit)
  show <area> [id]                   Liste bzw. ein Eintrag als JSON
  usages <area> <id>                 wo ein Eintrag verwendet wird
  new <area> <id> ['<json>']         neuer Eintrag (Vorlage + JSON)
  set <area> [id] <field> '<json>'   ein Feld setzen (Punkt-Pfad, z. B. movement.runSpeed); bei Einzel-Bereichen ohne id
  unset <area> [id] <field>          ein Feld entfernen
  rename <area> <old> <new>          ID umbenennen, Verweise ziehen mit
  remove <area> <id>                 Eintrag löschen, Verweise werden geleert

  --project <ordner>  anderes Projekt · --dry  nichts schreiben
Nach jedem Schreiben läuft die Prüfung (Exit 1 bei Fehlern).`;

const p = await loadProject(nodeLoader(projectDir));
p.exists = f => fs.existsSync(path.join(projectDir, f));   // lets the validation check asset files
const json = s => { try { return JSON.parse(s); } catch { return s; } };   // plain words count as text
const needArea = a => { if (!AREAS[a]) { console.error(`Unbekannter Bereich „${a}“. Bereiche: ${Object.keys(AREAS).join(', ')}`); process.exit(2); } return AREAS[a]; };
const needEntry = (a, id) => { const x = p.data[a]?.[id]; if (!x) { console.error(`${AREAS[a].name}: „${id}“ gibt es nicht.`); process.exit(2); } return x; };

function report(m) {
  const sym = { error: '✖', warning: '▲', hint: '·' };
  for (const x of m) console.log(`${sym[x.kind]} ${x.text}`);
  const e = m.filter(x => x.kind === 'error').length, w = m.filter(x => x.kind === 'warning').length, h = m.length - e - w;
  console.log(m.length ? `\n${e} Fehler, ${w} Warnungen, ${h} Hinweise` : 'Alles stimmig.');
  return e;
}
function save(areas) {
  if (dry) { console.log(`(--dry) würde schreiben: ${areas.map(a => p.paths[a]).join(', ')}`); }
  else for (const a of areas) { const f = path.join(projectDir, p.paths[a]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, pretty(p.data[a]) + '\n'); console.log('geschrieben: ' + p.paths[a]); }
  process.exit(report(validateProject(p)) ? 1 : 0);
}

switch (cmd) {
  case 'check': process.exit(report(validateProject(p)) ? 1 : 0); break;
  case 'areas':
    for (const [g, list] of GROUPS) { console.log(g); for (const a of list) console.log(`  ${a.padEnd(12)} ${AREAS[a].name}${AREAS[a].kind === 'catalog' ? ` (${Object.keys(p.data[a] || {}).length})` : ''}`); }
    break;
  case 'fields': {
    const [a] = rest; needArea(a);
    for (const f of fields(a)) console.log(`  ${f.key.padEnd(26)} ${f.type.padEnd(9)} ${f.label}${f.unit ? ` [${f.unit}]` : ''}${f.area ? ` → ${f.area}` : ''}${f.options ? ` (${f.options.map(o => o[0]).join('|')})` : ''}`);
    break;
  }
  case 'show': {
    const [a, id] = rest; const A = needArea(a);
    if (A.kind === 'single' || id) console.log(pretty(id ? needEntry(a, id) : p.data[a]));
    else for (const [k, x] of Object.entries(p.data[a] || {})) console.log(`  ${k.padEnd(22)} ${String(x.name || '').padEnd(28)} ${rowText(p, a, x)}`);
    break;
  }
  case 'usages': {
    const [a, id] = rest; needArea(a); needEntry(a, id);
    const u = usages(p, a, id);
    for (const x of u) console.log(`  ${AREAS[x.area].name} › ${x.name} (${x.path})`);
    if (!u.length) console.log('  nirgends verwendet');
    break;
  }
  case 'new': {
    const [a, id, j] = rest; const A = needArea(a);
    if (A.kind !== 'catalog') { console.error(`${A.name} ist ein Einzel-Bereich.`); process.exit(2); }
    if (!id) { console.log(HELP); process.exit(2); }
    if (p.data[a][id]) { console.error(`„${id}“ gibt es schon.`); process.exit(2); }
    p.data[a][id] = { ...structuredClone(A.template || {}), ...(j ? json(j) : {}) };
    save([a]); break;
  }
  case 'set': case 'unset': {
    const [a, ...r] = rest; const A = needArea(a);
    const [id, key, v] = A.kind === 'single' ? [null, ...r] : r;
    const x = A.kind === 'single' ? p.data[a] : needEntry(a, id);
    if (!key || (cmd === 'set' && v === undefined)) { console.log(HELP); process.exit(2); }
    if (!fields(a).some(f => f.key === key || key.startsWith(f.key + '.'))) console.log(`Hinweis: „${key}“ steht nicht im Schema von ${A.name}.`);
    set(x, key, cmd === 'set' ? json(v) : undefined);
    console.log(`${key} = ${JSON.stringify(get(x, key))}`);
    save([a]); break;
  }
  case 'rename': {
    const [a, old, new_] = rest; needArea(a); needEntry(a, old);
    if (!new_) { console.log(HELP); process.exit(2); }
    save(renameEntry(p, a, old, new_)); break;
  }
  case 'remove': {
    const [a, id] = rest; needArea(a); needEntry(a, id);
    save(removeEntry(p, a, id)); break;
  }
  default: console.log(HELP); process.exit(cmd ? 2 : 0);
}
