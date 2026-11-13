#!/usr/bin/env python3
"""Cyberware (#006): builds the symbol sheets icons_cyberware_<w>x<h>.png from the single pictures in
assets/items/cyberware/<id>.png (PixelLab, one chosen candidate per implant). Order and cell come from items.json
(look + icon), so the sheet always matches the data. Cells are 64 px per inventory field.
  python3 tools/cyberware_icons.py
"""
import json, os
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(REPO, 'projects/nomadgirl/assets')
items = json.load(open(os.path.join(REPO, 'projects/nomadgirl/data/items.json'), encoding='utf-8'))
CELL = 64
sheets = {}
for iid, t in items.items():
    look = t.get('look') or ''
    if look.startswith('icons_cyberware_'):
        sheets.setdefault(look, []).append((t.get('icon', 0), iid, t.get('size', [1, 1])))
for look, entries in sorted(sheets.items()):
    entries.sort()
    w, h = entries[0][2]
    cw, ch = w * CELL, h * CELL
    cols = min(len(entries), 6 if w == 1 else 5)
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
    for icon, iid, _ in entries:
        im = Image.open(os.path.join(ASSETS, 'items/cyberware', iid + '.png')).convert('RGBA')
        bb = im.getbbox() or (0, 0, im.width, im.height)
        im = im.crop(bb)
        k = 1 if im.width <= cw and im.height <= ch else min(cw / im.width, ch / im.height)   # pixel art stays 1:1 when it fits
        if k != 1:
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
        x, y = (icon % cols) * cw, (icon // cols) * ch
        sheet.alpha_composite(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
    out = os.path.join(ASSETS, 'items', look.replace('icons_', 'icons_') + '.png')
    sheet.save(out)
    print(look, f'{cols}x{rows}', f'cell {cw}x{ch}', len(entries))
