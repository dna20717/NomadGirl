// Node loader for projects: reads JSON from the file system (same interface as game/browser_loader.js).
import fs from 'node:fs';
import path from 'node:path';

export function nodeLoader(root) {
  const full = p => path.resolve(root, p);
  return {
    root,
    full,
    async json(p) {
      const text = fs.readFileSync(full(p), 'utf8');
      try { return JSON.parse(text); } catch (e) { throw new Error(`${p}: kein gültiges JSON (${e.message})`); }
    },
    async has(p) { return fs.existsSync(full(p)); },
  };
}
