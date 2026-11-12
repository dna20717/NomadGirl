#!/usr/bin/env python3
"""Controller button icons drawn from code (Daniel, 12.11.2026: „die Button-Templates für die Controller sind sehr hässlich …
Funktionstasten Xbox- und Stadia-spezifisch, Sticks generisch, Einträge für Stick drücken, Stick bewegen, linker/rechter Stick“).

Neon glass in the style of the game's UI: dark round caps with a coloured rim and a soft glow, a glossy top, crisp letters.
Drawn 4× larger and scaled down (smooth edges). One cell = 64 × 64 px; the game shows them at 32–40 px.

Rows (names = cells, read by the game through Spiel › Controller › Symbole):
  <kind>_0 … <kind>_9   face buttons (0 bottom, 1 right, 2 left, 3 top), bumpers 4/5, triggers 6/7, select 8, start 9
                        for xbox, stadia, ps, switch
  generic               stick_l, stick_r (move), stick_l_up/down/left/right, stick_r_up/…, stick_l_press, stick_r_press,
                        dpad, dpad_up/down/left/right
Run: python3 tools/pad_icons.py   → projects/nomadgirl/assets/ui/pad_icons.png + the list of names
"""
import os, math, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 4                      # supersampling
C = 64                     # cell
W = C * S
OUT = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'ui', 'pad_icons.png')
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
if not os.path.exists(FONT):
    FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'

INK = (16, 12, 22)          # cap fill (dark glass)
INK2 = (34, 27, 44)
GOLD = (255, 210, 122)
CYAN = (63, 224, 208)
DIM = (120, 106, 140)


def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(px): return ImageFont.truetype(FONT, int(px * S))


def canvas(): return Image.new('RGBA', (W, W), (0, 0, 0, 0))


def glow(img, color, shape, blur=5, alpha=150):
    """soft outer glow in the rim colour behind a shape (shape = function(draw, fill))"""
    g = Image.new('RGBA', img.size, (0, 0, 0, 0))
    shape(ImageDraw.Draw(g), color + (alpha,))
    g = g.filter(ImageFilter.GaussianBlur(blur * S))
    img.alpha_composite(g)


def shadow(img, shape):
    g = Image.new('RGBA', img.size, (0, 0, 0, 0))
    shape(ImageDraw.Draw(g), (0, 0, 0, 170), 0, 2.5 * S)
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(1.5 * S)))


def cap(img, box, rim, kind='circle', r=None, rimw=3.2, fill=INK):
    """a glass cap: shadow, glow, rim, dark body with a vertical shine, glossy top band"""
    x0, y0, x1, y1 = [v * S for v in box]
    rr = (r if r is not None else (box[3] - box[1]) / 2) * S

    def shape(d, f, dx=0, dy=0, inset=0):
        b = (x0 + inset + dx, y0 + inset + dy, x1 - inset + dx, y1 - inset + dy)
        if kind == 'circle': d.ellipse(b, fill=f)
        else: d.rounded_rectangle(b, radius=max(1, rr - inset), fill=f)
    glow(img, rim, lambda d, f: shape(d, f), blur=3.2, alpha=120)
    shadow(img, lambda d, f, dx, dy: shape(d, f, dx, dy))
    d = ImageDraw.Draw(img)
    shape(d, rim + (255,))
    shape(d, fill + (255,), inset=rimw * S)
    # body shine: lighter towards the top
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    shape(sd, INK2 + (255,), inset=rimw * S)
    mask = Image.new('L', img.size, 0); md = ImageDraw.Draw(mask)
    for i in range(int(y0), int(y1)):
        t = (i - y0) / max(1, y1 - y0)
        md.line((0, i, W, i), fill=int(max(0, 1 - t * 1.6) * 255))
    img.alpha_composite(Image.composite(sh, Image.new('RGBA', img.size, (0, 0, 0, 0)), mask))
    # glossy top band
    gl = Image.new('RGBA', img.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    ins = (rimw + 2) * S
    if kind == 'circle':
        gd.ellipse((x0 + ins, y0 + ins, x1 - ins, y0 + (y1 - y0) * 0.55), fill=(255, 255, 255, 34))
    else:
        gd.rounded_rectangle((x0 + ins, y0 + ins, x1 - ins, y0 + (y1 - y0) * 0.5), radius=max(1, rr - ins), fill=(255, 255, 255, 30))
    img.alpha_composite(gl)


def text(img, s, cx, cy, px, color, glowc=None):
    d = ImageDraw.Draw(img)
    f = font(px)
    if glowc:
        g = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).text((cx * S, cy * S), s, font=f, fill=glowc + (200,), anchor='mm')
        img.alpha_composite(g.filter(ImageFilter.GaussianBlur(2 * S)))
    d.text((cx * S, cy * S), s, font=f, fill=color + (255,), anchor='mm')


def face(letter=None, rim=GOLD, ink=None, symbol=None):
    img = canvas()
    cap(img, (8, 8, 56, 56), rim)
    col = ink or rim
    if symbol: symbol(img, col)
    else: text(img, letter, 32, 33, 27, col, glowc=col)
    return img


# PlayStation symbols as lines (no font needed)
def ps_cross(img, c):
    d = ImageDraw.Draw(img); w = 4.2 * S
    d.line((22 * S, 22 * S, 42 * S, 42 * S), fill=c + (255,), width=int(w)); d.line((42 * S, 22 * S, 22 * S, 42 * S), fill=c + (255,), width=int(w))
def ps_circle(img, c):
    ImageDraw.Draw(img).ellipse((21 * S, 21 * S, 43 * S, 43 * S), outline=c + (255,), width=int(4 * S))
def ps_square(img, c):
    ImageDraw.Draw(img).rectangle((22 * S, 22 * S, 42 * S, 42 * S), outline=c + (255,), width=int(4 * S))
def ps_triangle(img, c):
    ImageDraw.Draw(img).polygon([(32 * S, 19 * S), (44 * S, 41 * S), (20 * S, 41 * S)], outline=c + (255,), width=int(4 * S))


def bumper(label, rim, ink=(235, 228, 245)):
    img = canvas()
    cap(img, (4, 18, 60, 46), rim, kind='rect', r=10)
    text(img, label, 32, 32.5, 18, ink)
    return img


def trigger(label, rim, ink=(235, 228, 245)):
    img = canvas()
    cap(img, (12, 6, 52, 58), rim, kind='rect', r=14)
    text(img, label, 32, 35, 18, ink)
    return img


def small(rim, draw):
    img = canvas()
    cap(img, (10, 16, 54, 48), rim, kind='rect', r=16)
    draw(ImageDraw.Draw(img), (235, 228, 245, 255))
    return img


def view_icon(d, c):     # Xbox „Ansicht“: two overlapping windows
    d.rounded_rectangle((22 * S, 23 * S, 36 * S, 34 * S), radius=2 * S, outline=c, width=int(2.6 * S))
    d.rounded_rectangle((28 * S, 29 * S, 42 * S, 40 * S), radius=2 * S, fill=c)
def menu_icon(d, c):     # three lines
    for y in (25, 32, 39): d.line((23 * S, y * S, 41 * S, y * S), fill=c, width=int(3 * S))
def dots_icon(d, c):     # Stadia „Optionen“: three dots
    for x in (23, 32, 41): d.ellipse(((x - 2.6) * S, 29.4 * S, (x + 2.6) * S, 34.6 * S), fill=c)
def create_icon(d, c):   # PlayStation „Create“: three short bars
    for x in (25, 32, 39): d.line((x * S, 25 * S, x * S, 39 * S), fill=c, width=int(3 * S))
def minus_icon(d, c): d.line((22 * S, 32 * S, 42 * S, 32 * S), fill=c, width=int(4 * S))
def plus_icon(d, c): minus_icon(d, c); d.line((32 * S, 22 * S, 32 * S, 42 * S), fill=c, width=int(4 * S))


# ---------- generic: sticks and d-pad ----------
def arrow(d, cx, cy, ang, size, fill):
    a = math.radians(ang)
    pts = [(cx + math.cos(a) * size, cy + math.sin(a) * size),
           (cx + math.cos(a + 2.4) * size * 0.75, cy + math.sin(a + 2.4) * size * 0.75),
           (cx + math.cos(a - 2.4) * size * 0.75, cy + math.sin(a - 2.4) * size * 0.75)]
    d.polygon([(x * S, y * S) for x, y in pts], fill=fill)


def stick(side, lit=None, press=False):
    img = canvas()
    rim = CYAN
    # well around the stick
    if press:
        d = ImageDraw.Draw(img)
        for i, r in enumerate((30, 26)):
            d.ellipse(((32 - r) * S, (34 - r) * S, (32 + r) * S, (34 + r) * S), outline=GOLD + (90 - i * 30,), width=int(2 * S))
    cap(img, (13, 15, 51, 53), rim)
    d = ImageDraw.Draw(img)
    # grip ring
    for k in range(12):
        a = k * math.pi / 6
        x, y = 32 + math.cos(a) * 13.5, 34 + math.sin(a) * 13.5
        d.ellipse(((x - 1.3) * S, (y - 1.3) * S, (x + 1.3) * S, (y + 1.3) * S), fill=(255, 255, 255, 40))
    text(img, side, 32, 34.5, 17, (235, 228, 245))
    if press:
        arrow(d, 32, 8.5, 90, 6.5, GOLD + (255,))     # pointing down onto the stick
    else:
        for ang, name, (x, y) in ((-90, 'up', (32, 6.5)), (90, 'down', (32, 61.5)), (180, 'left', (5, 34)), (0, 'right', (59, 34))):
            arrow(d, x, y, ang, 5.2, (GOLD + (255,)) if lit == name else (DIM + (190,)) if lit else (CYAN + (210,)))
    return img


def dpad(lit=None):
    img = canvas()
    rim = CYAN
    arms = {'up': (24, 6, 40, 30), 'down': (24, 34, 40, 58), 'left': (6, 24, 30, 40), 'right': (34, 24, 58, 40)}

    def shape(d, f, dx=0, dy=0, inset=0):
        d.rounded_rectangle((24 * S + inset + dx, 6 * S + inset + dy, 40 * S - inset + dx, 58 * S - inset + dy), radius=4 * S, fill=f)
        d.rounded_rectangle((6 * S + inset + dx, 24 * S + inset + dy, 58 * S - inset + dx, 40 * S - inset + dy), radius=4 * S, fill=f)
    glow(img, rim, lambda d, f: shape(d, f), blur=3, alpha=110)
    shadow(img, lambda d, f, dx, dy: shape(d, f, dx, dy))
    d = ImageDraw.Draw(img)
    shape(d, rim + (255,))
    shape(d, INK + (255,), inset=3 * S)
    if lit:
        x0, y0, x1, y1 = arms[lit]
        d.rounded_rectangle(((x0 + 4) * S, (y0 + 4) * S, (x1 - 4) * S, (y1 - 4) * S), radius=3 * S, fill=GOLD + (230,))
    for name, ang, (x, y) in (('up', -90, (32, 15)), ('down', 90, (32, 49)), ('left', 180, (15, 32)), ('right', 0, (49, 32))):
        arrow(d, x, y, ang, 4.6, (INK + (255,)) if lit == name else (DIM + (200,)) if lit else (CYAN + (220,)))
    d.ellipse((29 * S, 29 * S, 35 * S, 35 * S), fill=INK2 + (255,))
    return img


def main():
    X = {'a': hexc('#7ed957'), 'b': hexc('#ff5a5f'), 'x': hexc('#4aa3ff'), 'y': hexc('#ffd23f')}
    ST = hexc('#ff5a1f')        # Stadia orange
    PS = {'x': hexc('#8fb6ff'), 'o': hexc('#ff6f86'), 'sq': hexc('#ff8fe0'), 'tr': hexc('#4fe0b0')}
    SW = hexc('#e8e4f0')
    WHITE = (240, 236, 248)
    cells = []
    # Xbox: A bottom, B right, X left, Y top
    cells += [('xbox_0', face('A', X['a'])), ('xbox_1', face('B', X['b'])), ('xbox_2', face('X', X['x'])), ('xbox_3', face('Y', X['y'])),
              ('xbox_4', bumper('LB', DIM)), ('xbox_5', bumper('RB', DIM)), ('xbox_6', trigger('LT', DIM)), ('xbox_7', trigger('RT', DIM)),
              ('xbox_8', small(DIM, lambda d, c: view_icon(d, c))), ('xbox_9', small(DIM, lambda d, c: menu_icon(d, c)))]
    # Stadia: white letters on graphite, orange rim
    cells += [('stadia_0', face('A', ST, WHITE)), ('stadia_1', face('B', ST, WHITE)), ('stadia_2', face('X', ST, WHITE)), ('stadia_3', face('Y', ST, WHITE)),
              ('stadia_4', bumper('L1', ST)), ('stadia_5', bumper('R1', ST)), ('stadia_6', trigger('L2', ST)), ('stadia_7', trigger('R2', ST)),
              ('stadia_8', small(ST, lambda d, c: dots_icon(d, c))), ('stadia_9', small(ST, lambda d, c: menu_icon(d, c)))]
    # PlayStation and Switch in the same style (so every controller looks the same family)
    cells += [('ps_0', face(None, PS['x'], symbol=ps_cross)), ('ps_1', face(None, PS['o'], symbol=ps_circle)), ('ps_2', face(None, PS['sq'], symbol=ps_square)), ('ps_3', face(None, PS['tr'], symbol=ps_triangle)),
              ('ps_4', bumper('L1', DIM)), ('ps_5', bumper('R1', DIM)), ('ps_6', trigger('L2', DIM)), ('ps_7', trigger('R2', DIM)),
              ('ps_8', small(DIM, lambda d, c: create_icon(d, c))), ('ps_9', small(DIM, lambda d, c: menu_icon(d, c)))]
    cells += [('switch_0', face('B', SW, WHITE)), ('switch_1', face('A', SW, WHITE)), ('switch_2', face('Y', SW, WHITE)), ('switch_3', face('X', SW, WHITE)),
              ('switch_4', bumper('L', DIM)), ('switch_5', bumper('R', DIM)), ('switch_6', trigger('ZL', DIM)), ('switch_7', trigger('ZR', DIM)),
              ('switch_8', small(DIM, lambda d, c: minus_icon(d, c))), ('switch_9', small(DIM, lambda d, c: plus_icon(d, c)))]
    # generic
    for side in ('l', 'r'):
        L = side.upper()
        cells += [(f'stick_{side}', stick(L))] + [(f'stick_{side}_{d}', stick(L, lit=d)) for d in ('up', 'down', 'left', 'right')] + [(f'stick_{side}_press', stick(L, press=True))]
    cells += [('dpad', dpad())] + [(f'dpad_{d}', dpad(d)) for d in ('up', 'down', 'left', 'right')]
    cols = 10
    rows = math.ceil(len(cells) / cols)
    sheet = Image.new('RGBA', (cols * C, rows * C), (0, 0, 0, 0))
    for i, (name, im) in enumerate(cells):
        sheet.alpha_composite(im.resize((C, C), Image.LANCZOS), ((i % cols) * C, (i // cols) * C))
    sheet.save(OUT)
    print(json.dumps({'grid': [cols, rows], 'cell': [C, C], 'names': [n for n, _ in cells]}))


if __name__ == '__main__':
    main()
