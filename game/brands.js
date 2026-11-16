// Lore › Marken (#045, Daniel 16.11.2026: „eine Lore-Datenbank in der Werkstatt, wo wir Brands sammeln und mit sinnvollen Eigenschaften
// versehen können“). No DOM: browser and Node. A thing names its maker (Gegenstände › Hersteller); the maker's Spielwerte work:
//   Qualität  → the bonuses of its implants (not the drawbacks), game/inventory.js gearStats
//   Preis     → the value of its products (tooltip, Δ sums, jobs)
//   In der Beute → how often its products fall from loot tables (game/inventory.js rollLoot)
export const brandOf = (D, t) => (t?.brand && D.brands?.[t.brand]) || null;
export const qualityOf = (D, t) => 1 + (brandOf(D, t)?.quality ?? 0) / 100;
export const priceOf = (D, t) => (brandOf(D, t)?.price ?? 100) / 100;
export const lootOf = (D, t) => Math.max(0, (brandOf(D, t)?.loot ?? 100) / 100);
// the value of a thing in Δ with its maker's price
export const valueOf = (D, t) => Math.round((t?.value || 0) * priceOf(D, t));
// the brands of the travel map (worldmap.js): every brand with „Auf der Karte“, in the shape the map has always used
export const mapBrands = D => Object.entries(D.brands || {}).filter(([, b]) => b.map?.on && b.name)
  .map(([id, b]) => ({ id, name: b.name, short: b.short || b.name, slogan: b.slogan || '', kind: b.map.kind || '', icon: b.map.icon ?? 0, color: b.color || '#ffd27a', weight: b.map.weight ?? 1 }));
