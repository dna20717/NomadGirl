"""Feinschliff für gesnappte SDXL-Pixel-Art: Rauschen beruhigen, clean(), optional Outline.
usage: finish.py in.png out.png [--outline]"""
import sys
from collections import Counter
sys.path.insert(0, '/home/claude/ng/.claude/skills/nomadpixel/scripts')
import zeichnen
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); w, h = im.size
zeichnen.T = max(w, h)
c = zeichnen.C()
hexc = lambda p: '#%02x%02x%02x' % p[:3]
for y in range(h):
    for x in range(w):
        p = im.getpixel((x, y))
        if p[3] > 0: c.set(x, y, hexc(p))
# 1) calm noise: a pixel that matches none of its 4 neighbours takes the 3x3 majority (if clear)
for _ in range(2):
    g = [row[:] for row in c.g]
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            v = g[y][x]
            n4 = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]]
            if v in n4: continue
            cnt = Counter(g[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
            col, k = cnt.most_common(1)[0]
            if k >= 4: c.set(x, y, col)
if '--outline' in sys.argv: c.outline('#060608')
zeichnen.clean(c)
out = Image.new('RGBA', (w, h))
for y in range(h):
    for x in range(w):
        v = c.g[y][x]
        if v: out.putpixel((x, y), tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
out.save(dst)
print(dst, len({c.g[y][x] for y in range(h) for x in range(w)}), 'Farben')
