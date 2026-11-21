// Merges generated room blocks (a JSON object { id: room }) into projects/nomadgirl/data/rooms.json, written with pretty().
// Usage: node tools/merge_rooms.mjs /tmp/new.json   (the old generators tools/poi_rooms*.py were deleted on 21.11.2026: rooms.json is the source now)
import { readFileSync, writeFileSync } from 'node:fs';
import { pretty } from './json.js';
const file = new URL('../projects/nomadgirl/data/rooms.json', import.meta.url);
const rooms = JSON.parse(readFileSync(file, 'utf8')), add = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [id, r] of Object.entries(add)) rooms[id] = { ...(rooms[id] || {}), ...r };
writeFileSync(file, pretty(rooms) + '\n');
console.log(`${Object.keys(add).length} Räume eingefügt, jetzt ${Object.keys(rooms).length}`);
