"""AvA as layers (Daniel, 10.11.2026: "modulare Drohne").

From the PixelLab hull (assets/drone/hull_source.png, 128 x 128, AAP-64) this makes:
  hull.png   the hull without the hanging cables (they are code now and swing), screen emptied
  glass.png  only the glare of the screen glass, drawn above the face
  faces.png  one face per frame (FACES order), drawn on the screen, AAP-64 cyan with scanlines
  parts/<name>.png  add-on parts (PixelLab, 64 x 64) cut out, scaled to the hull's pixel size and snapped back onto AAP-64
Run: python3 tools/drone_parts.py
"""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'drone')
SCREEN = (99.5, 60.0, 13.6, 15.2)        # centre x, y and radii of the glass in hull pixels
CABLE_ROW = 83                           # cables hang below this row (the ring's bottom edge stays)
KEEP_ROW = (51, 78)                      # ... of which this run of row 83 is the ring outline

def hx(h, a=255): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (a,)
GLASS_BG = hx('#060608')
MAIN, SCAN, LIGHT, HALO, LINE = hx('#20d6c7'), hx('#249fde'), hx('#a6fcdb'), hx('#143464'), hx('#141013')

def inside(x, y, grow=0):
    cx, cy, rx, ry = SCREEN
    return ((x + 0.5 - cx) / (rx + grow)) ** 2 + ((y + 0.5 - cy) / (ry + grow)) ** 2 <= 1

def hull():
    src = Image.open(os.path.join(ROOT, 'hull_source.png')).convert('RGBA')
    out, glass = src.copy(), Image.new('RGBA', src.size)
    W, H = src.size
    for y in range(H):
        for x in range(W):
            p = src.getpixel((x, y))
            if y > CABLE_ROW or (y == CABLE_ROW and not KEEP_ROW[0] <= x <= KEEP_ROW[1]): out.putpixel((x, y), (0, 0, 0, 0))
            elif inside(x, y) and p[3]:
                if sum(p[:3]) > 90: glass.putpixel((x, y), p)      # glare and reflections
                out.putpixel((x, y), GLASS_BG)
    out.save(os.path.join(ROOT, 'hull.png')); glass.save(os.path.join(ROOT, 'glass.png'))

# faces: 20 x 12 glyphs, eyes in rows 0-7, mouth in rows 8-11 ('#' = light, '+' = highlight)
FACES = {
 'idle': ["....................",
          "...####......####...",
          "..######....######..",
          "..##++##....##++##..",
          "..######....######..",
          "..######....######..",
          "..######....######..",
          "...####......####...",
          "....................",
          ".......#....#.......",
          "........####........",
          "...................."],
 'blink': ["....................",
          "....................",
          "....................",
          "....................",
          "..######....######..",
          "....................",
          "....................",
          "....................",
          "....................",
          ".......#....#.......",
          "........####........",
          "...................."],
 'happy': ["....................",
          "....................",
          "...####......####...",
          "..##..##....##..##..",
          ".##....##..##....##.",
          "....................",
          "....................",
          "....................",
          ".....##########.....",
          ".....#++++++++#.....",
          "......#++++++#......",
          ".......######......."],
 'excited': ["..######....######..",
          ".########..########.",
          ".##++####..##++####.",
          ".##++####..##++####.",
          ".########..########.",
          ".########..########.",
          "..######....######..",
          "....................",
          "......########......",
          "......#++++++#......",
          ".......#++++#.......",
          "........####........"],
 'bored': ["....................",
          "....................",
          "....................",
          ".########..########.",
          "..######....######..",
          "..######....######..",
          "...####......####...",
          "....................",
          "....................",
          "....................",
          ".......######.......",
          "...................."],
 'alert': ["..######....######..",
          ".##....##..##....##.",
          ".#..++..#..#..++..#.",
          ".#..++..#..#..++..#.",
          ".#......#..#......#.",
          ".##....##..##....##.",
          "..######....######..",
          "....................",
          "........####........",
          ".......#....#.......",
          ".......#....#.......",
          "........####........"],
 'curious': ["..######............",
          ".########...........",
          ".##++####....####...",
          ".##++####...######..",
          ".########...##++##..",
          ".########...######..",
          "..######.....####...",
          "....................",
          "....................",
          "........#####.......",
          ".............##.....",
          "...................."],
 'angry': [".##..............##.",
          "..###..........###..",
          "...####......####...",
          "..######....######..",
          "..##++##....##++##..",
          "..######....######..",
          "...####......####...",
          "....................",
          ".....##########.....",
          ".....#.#.#.#.#.#....",
          ".....##########.....",
          "...................."],
 'sleep': ["....................",
          "....................",
          "....................",
          "....................",
          ".##....##..##....##.",
          "..######....######..",
          "....................",
          "....................",
          "....................",
          ".........##.........",
          "........#..#........",
          ".........##........."],
 'down': [".##....##..##....##.",
          "..##..##....##..##..",
          "...####......####...",
          "...####......####...",
          "..##..##....##..##..",
          ".##....##..##....##.",
          "....................",
          "....................",
          "......########......",
          ".....#........#.....",
          "....................",
          "...................."],
 'scan': [".......######.......",
          ".....##......##.....",
          "....#....#.....#....",
          "...#.....#......#...",
          "...#.....#......#...",
          "...#.....###....#...",
          "...#.....#####..#...",
          "....#....######.#...",
          ".....##......##.....",
          ".......######.......",
          "....................",
          "...................."],
 'worried': ["...###......###.....",
          "..##..........##....",
          "....................",
          "..######....######..",
          "..##++##....##++##.+",
          "..######....######.+",
          "...####......####.++",
          "...................+",
          "....................",
          "......##..##..##....",
          ".....#..##..##..#...",
          "...................."],
 'dash': [".##..............##.",
          "...##..........##...",
          ".....##......##.....",
          "...##..........##...",
          ".##..............##.",
          "....................",
          "....................",
          "....................",
          "......########......",
          "......#++++++#......",
          "......########......",
          "...................."],
 'zen': ["....................",
          "....................",
          "....................",
          "....................",
          ".##....##..##....##.",
          "..######....######..",
          "....................",
          "....................",
          "....................",
          ".......#....#.......",
          "........####........",
          "...................."],
}
CELL = (28, 32)                 # face frame: the whole glass, its centre on SCREEN
GLYPH_AT = (4, 10)              # top left of the 20 x 12 glyph in the frame

def faces():
    cw, ch = CELL
    cx, cy = SCREEN[0] - cw / 2, SCREEN[1] - ch / 2       # frame position in hull pixels
    strip = Image.new('RGBA', (cw * len(FACES), ch))
    for i, (name, rows) in enumerate(FACES.items()):
        f = Image.new('RGBA', CELL)
        for y in range(ch):                                # faint scanlines over the whole glass
            if y % 2 and True:
                for x in range(cw):
                    if inside(cx + x, cy + y, -1): f.putpixel((x, y), LINE)
        on = {(GLYPH_AT[0] + x, GLYPH_AT[1] + y): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.'}
        for (x, y) in on:                                  # glow halo first
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in on and 0 <= q[0] < cw and 0 <= q[1] < ch: f.putpixel(q, HALO)
        for (x, y), c in on.items():
            f.putpixel((x, y), LIGHT if c == '+' else SCAN if y % 2 else MAIN)
        strip.alpha_composite(f, (i * cw, 0))
    strip.save(os.path.join(ROOT, 'faces.png'))
    print('faces:', ', '.join(f'{i} {n}' for i, n in enumerate(FACES)), '| frame', CELL, 'origin', (round(SCREEN[0] - cx - cw / 2 + cw / 2, 1), round(ch / 2, 1)))

# add-on parts: source (64 x 64 from PixelLab) → cut, scaled (LANCZOS) and snapped onto AAP-64, origin = middle of the top edge
PARTS = {'lamp': 0.75, 'claw': 0.75}

def palette():
    path = os.path.join(ROOT, '..', 'palette', 'aap-64.hex')
    return [tuple(int(l[i:i + 2], 16) for i in (0, 2, 4)) for l in open(path).read().split()]

def parts():
    pal = palette()
    for name, scale in PARTS.items():
        src = Image.open(os.path.join(ROOT, 'parts', name + '_source.png')).convert('RGBA')
        src = src.crop(src.getbbox())
        r = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
        out = Image.new('RGBA', r.size)
        for y in range(r.height):
            for x in range(r.width):
                p = r.getpixel((x, y))
                if p[3] < 110: continue
                out.putpixel((x, y), min(pal, key=lambda q: sum((q[i] - p[i]) ** 2 for i in range(3))) + (255,))
        out.save(os.path.join(ROOT, 'parts', name + '.png'))
        top = [x for x in range(out.width) if out.getpixel((x, 0))[3]]
        print(f'{name}: {out.size}, origin [{(top[0] + top[-1] + 1) / 2}, 0]')

if __name__ == '__main__':
    hull(); faces(); parts()
