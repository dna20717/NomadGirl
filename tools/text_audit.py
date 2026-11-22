#!/usr/bin/env python3
"""#177 (Daniel, 21.11.2026: "Texte sollen niemals in der Grafik sein"): contact sheets to look for baked text.

No OCR: the script cuts every picture the game shows as a tile, inclusion, decal, clutter, back-wall decor, sign, door,
facade, trope or wow motif into a few big contact sheets (cells enlarged, name under each cell), so one look finds
letters and digits. Which pictures: every asset of data/assets.json that a world data file names (terrain, decor,
doors, hulls, tropes, pois, parallax, life, game …), symbol grids cut into their named cells. Leyla, raiders, sounds,
videos and the tutorial clips stay out (figures and screenshots of the game).

  python3 tools/text_audit.py                 all sheets → output/text_audit/<group>_<n>.png
  python3 tools/text_audit.py props bunker    only cells/assets whose id or name contains one of the words
  python3 tools/text_audit.py --list          print the pictures, write nothing

Known text (removed, laid over from code, or kept on purpose): docs/assets.md › Text entfernt (#170, #177).
"""
import json, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PROJ = os.path.join(ROOT, 'projects', 'nomadgirl')
OUT = os.path.join(ROOT, 'output', 'text_audit')
WORLD = ['terrain', 'decor', 'decor_sets', 'doors', 'hulls', 'tropes', 'pois', 'parallax', 'life', 'rooms', 'game',
         'atmosphere', 'locations', 'room_stories', 'containers', 'loot', 'poi_sets', 'dressing_rules', 'brands']
SKIP = re.compile(r'^(tut_|leyla|raider|snd_|sound)')
CELL = 176          # box per entry on the sheet (picture fits inside, enlarged up to ×3)
COLS = 8
PER_SHEET = 64


def world_assets():
    assets = json.load(open(os.path.join(PROJ, 'data', 'assets.json')))
    used = {}
    for f in WORLD:
        p = os.path.join(PROJ, 'data', f + '.json')
        if not os.path.exists(p): continue
        for m in re.finditer(r'"([a-z0-9_]+)"', open(p).read()):
            k = m.group(1)
            if k in assets and not SKIP.match(k): used.setdefault(k, set()).add(f)
    return assets, used


def entries(assets, used):
    """(group, label, PIL image) for every cell or picture"""
    for aid in sorted(used):
        a = assets[aid]
        kind, file = a.get('kind'), a.get('file')
        if kind in ('sound', 'video', 'source', 'reference') or not file or not file.endswith('.png'): continue
        path = os.path.join(PROJ, file)
        if not os.path.exists(path): continue
        img = Image.open(path).convert('RGBA')
        group = 'tiles' if 'terrain' in used[aid] or aid.startswith('tileset') else \
                'doors' if aid.startswith('door_') else 'facade' if aid.startswith('facade_') else \
                'decor' if 'decor' in used[aid] else 'poi'
        if kind == 'icons' and a.get('cell') and a.get('grid'):
            (cw, ch), (gx, gy) = a['cell'], a['grid']
            names = a.get('names') or []
            for i in range(gx * gy):
                x, y = (i % gx) * cw, (i // gx) * ch
                if y + ch > img.height or x + cw > img.width: break
                cell = img.crop((x, y, x + cw, y + ch))
                if cell.getbbox() is None: continue
                yield group, f'{aid}:{names[i] if i < len(names) else i}', cell
        elif kind == 'animation' and a.get('frame'):
            fw, fh = a['frame']
            yield group, aid, img.crop((0, 0, fw, fh))
        else:
            yield group, aid, img


def sheet(items, path):
    rows = (len(items) + COLS - 1) // COLS
    W, H = COLS * CELL, rows * (CELL + 14)
    out = Image.new('RGBA', (W, H), (54, 58, 66, 255))
    d = ImageDraw.Draw(out)
    for n, (label, img) in enumerate(items):
        x0, y0 = (n % COLS) * CELL, (n // COLS) * (CELL + 14)
        # checker so dark and light pixels both show
        for yy in range(0, CELL, 16):
            for xx in range(0, CELL, 16):
                if (xx + yy) // 16 % 2: d.rectangle((x0 + xx, y0 + yy, x0 + xx + 15, y0 + yy + 15), fill=(66, 70, 80, 255))
        s = min(3.0, (CELL - 4) / img.width, (CELL - 4) / img.height)
        im = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.NEAREST)
        out.alpha_composite(im, (x0 + (CELL - im.width) // 2, y0 + (CELL - im.height) // 2))
        d.text((x0 + 2, y0 + CELL + 1), label[-28:], fill=(240, 230, 200, 255))
    out.save(path)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    assets, used = world_assets()
    groups = {}
    for group, label, img in entries(assets, used):
        if args and not any(w in label for w in args): continue
        groups.setdefault(group, []).append((label, img))
    if '--list' in sys.argv:
        for g, items in groups.items():
            print(g, len(items)); [print('  ', l, i.size) for l, i in items]
        return
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    for g, items in groups.items():
        for k in range(0, len(items), PER_SHEET):
            p = os.path.join(OUT, f'{g}_{k // PER_SHEET + 1}.png')
            sheet(items[k:k + PER_SHEET], p)
            print(p, len(items[k:k + PER_SHEET]))


if __name__ == '__main__':
    main()
