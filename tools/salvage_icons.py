# Symbole der Bergungsteile (#023): 4 × 4 à 64 px, aus dem LKW-Teileblatt (truck_parts) und aus Code, auf AAP-64.
# python3 tools/salvage_icons.py  →  projects/nomadgirl/assets/items/icons_salvage.png
from PIL import Image, ImageDraw
import os
root = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets')
pal = [tuple(int(l.strip()[i:i + 2], 16) for i in (0, 2, 4)) for l in open(os.path.join(root, 'palette', 'aap-64.hex')) if l.strip()]
H = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
sheet = Image.open(os.path.join(root, 'vehicles', 'truck_parts.png')).convert('RGBA')
CELL, P = 64, 2   # code art: 2 px per art pixel inside a 64 px cell (32 × 32 art)
NAMES = ['felge', 'reifen', 'achse', 'motorblock', 'dieselkanister', 'auspuff', 'kettenglied', 'laufrolle',
         'hydraulikzylinder', 'rotorblatt', 'ballonstoff', 'gasventil', 'bordrechner', 'bordwerkzeug']
out = Image.new('RGBA', (CELL * 4, CELL * 4), (0, 0, 0, 0))

def crop(box):
    x, y, w, h = box
    im = sheet.crop((x, y, x + w, y + h))
    k = max(1, int(min(64 / w, 64 / h)))   # whole pixels, as big as the cell allows
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.NEAREST)

def art(draw_fn):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im); draw_fn(d)
    return im.resize((64, 64), Image.NEAREST)

ink, dark, grey, steel, silver, pale, white = H('#141013'), H('#242234'), H('#4a5462'), H('#6d758d'), H('#8b93af'), H('#b3b9d1'), H('#dae0ea')
red, rust, copper, yellow, gold, cyan, brown = H('#b4202a'), H('#71413b'), H('#bb7547'), H('#f9a31b'), H('#ffd541'), H('#20d6c7'), H('#322b28')

def achse(d):
    d.rectangle([3, 14, 28, 17], fill=steel); d.rectangle([3, 14, 28, 14], fill=pale)
    for x in (1, 26): d.rectangle([x, 10, x + 4, 21], fill=grey); d.rectangle([x + 1, 11, x + 3, 20], fill=silver)
    d.rectangle([13, 12, 18, 19], fill=dark); d.rectangle([14, 13, 17, 18], fill=grey)
def diesel(d):
    d.rectangle([7, 6, 25, 28], fill=ink); d.rectangle([8, 7, 24, 27], fill=red); d.rectangle([8, 7, 24, 8], fill=H('#df3e23'))
    d.rectangle([10, 3, 15, 6], fill=ink); d.rectangle([17, 4, 22, 6], fill=grey)
    d.line([9, 10, 23, 26], fill=H('#73172d'), width=1); d.line([23, 10, 9, 26], fill=H('#73172d'), width=1); d.rectangle([12, 15, 20, 19], fill=gold)
def reifen(d):
    d.ellipse([1, 1, 30, 30], fill=ink); d.ellipse([3, 3, 28, 28], fill=brown); d.ellipse([10, 10, 21, 21], fill=ink)
    for a in range(0, 360, 30):
        import math
        x, y = 15.5 + 13 * math.cos(math.radians(a)), 15.5 + 13 * math.sin(math.radians(a)); d.rectangle([x - 1, y - 1, x, y], fill=grey)
    d.arc([3, 3, 28, 28], 200, 280, fill=steel)
def kette(d):
    for x in (2, 16):
        d.rectangle([x, 11, x + 13, 21], fill=ink); d.rectangle([x + 1, 12, x + 12, 20], fill=brown)
        for i in range(x + 2, x + 12, 3): d.rectangle([i, 12, i + 1, 13], fill=grey); d.rectangle([i, 19, i + 1, 20], fill=grey)
        d.rectangle([x + 5, 15, x + 7, 17], fill=steel)
def rolle(d):
    d.ellipse([3, 3, 28, 28], fill=ink); d.ellipse([5, 5, 26, 26], fill=grey); d.ellipse([9, 9, 22, 22], fill=steel); d.ellipse([13, 13, 18, 18], fill=dark)
    d.arc([5, 5, 26, 26], 200, 290, fill=pale)
def hydraulik(d):
    d.rectangle([13, 2, 18, 18], fill=ink); d.rectangle([14, 3, 17, 17], fill=yellow); d.rectangle([14, 3, 14, 17], fill=gold)
    d.rectangle([15, 18, 16, 28], fill=silver); d.rectangle([12, 28, 19, 30], fill=grey); d.rectangle([12, 0, 19, 2], fill=grey)
def rotor(d):
    d.polygon([(1, 17), (14, 13), (30, 14), (30, 17), (14, 19)], fill=ink); d.polygon([(2, 16), (14, 14), (29, 15), (29, 16), (14, 18)], fill=steel)
    d.line([3, 15, 28, 15], fill=pale); d.rectangle([12, 12, 16, 20], fill=yellow); d.rectangle([13, 13, 15, 19], fill=gold)
def stoff(d):
    d.polygon([(3, 22), (8, 8), (26, 6), (29, 20), (22, 27), (6, 27)], fill=steel)
    d.polygon([(5, 21), (9, 9), (25, 8), (27, 19), (21, 25), (7, 25)], fill=silver)
    for y in (12, 16, 20): d.line([8, y, 25, y - 2], fill=pale)
    d.line([10, 22, 24, 21], fill=H('#249fde'))
def ventil(d):
    d.rectangle([13, 12, 18, 28], fill=ink); d.rectangle([14, 13, 17, 27], fill=copper)
    d.ellipse([7, 3, 24, 11], fill=ink); d.ellipse([8, 4, 23, 10], fill=red); d.rectangle([15, 8, 16, 13], fill=grey)
    d.rectangle([9, 20, 22, 22], fill=grey)

ART = {'reifen': reifen, 'achse': achse, 'dieselkanister': diesel, 'kettenglied': kette, 'laufrolle': rolle, 'hydraulikzylinder': hydraulik,
       'rotorblatt': rotor, 'ballonstoff': stoff, 'gasventil': ventil}
CROP = {'felge': (113, 40, 32, 32), 'motorblock': (186, 45, 32, 36), 'auspuff': (171, 40, 11, 49),
        'bordrechner': (7, 8, 32, 23), 'bordwerkzeug': (42, 8, 36, 23)}
for i, n in enumerate(NAMES):
    im = crop(CROP[n]) if n in CROP else art(ART[n])
    cx, cy = (i % 4) * CELL, (i // 4) * CELL
    out.alpha_composite(im, (cx + (CELL - im.width) // 2, cy + (CELL - im.height) // 2))

px = out.load(); cache = {}
for y in range(out.height):
    for x in range(out.width):
        r, g, b, a = px[x, y]
        if a < 128: px[x, y] = (0, 0, 0, 0); continue
        k = (r, g, b)
        if k not in cache: cache[k] = min(pal, key=lambda p: (p[0] - r) ** 2 * 2 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 3)
        px[x, y] = cache[k] + (255,)
out.save(os.path.join(root, 'items', 'icons_salvage.png'))
print('ok', NAMES)
