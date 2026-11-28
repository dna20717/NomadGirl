"""Probe NomadPixel x SDXL, Weg A: Avas Entwürfe als Code-Pixel-Art (AAP-64)."""
import sys, math
sys.path.insert(0, '/home/claude/ng/.claude/skills/nomadpixel/scripts')
import zeichnen
zeichnen.T = 192
from zeichnen import C, clean, speckle, grain
from PIL import Image

P = ['#' + l.strip() for l in open('/home/claude/ng/projects/nomadgirl/assets/palette/aap-64.hex') if l.strip()]
R = lambda *i: [P[k] for k in i]
K = '#060608'

def save(c, w, h, name):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            v = c.g[y][x]
            if v: im.putpixel((x, y), tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    im.save(f'/tmp/npx/A_{name}_draft.png')
    # .pix source
    cols, chars, rows = {}, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJLMNOPQRSTUVWXYZ0123456789', []
    for y in range(h):
        line = ''
        for x in range(w):
            v = c.g[y][x]
            if v is None: line += '.'; continue
            if v not in cols: cols[v] = 'K' if v == K else chars[len([k for k in cols if cols[k] != 'K'])]
            line += cols[v]
        rows.append(line)
    with open(f'/tmp/npx/A_{name}.pix', 'w') as f:
        f.write(f'[meta]\nsize = {w}x{h}\n\n[palette]\n. = transparent\n' + ''.join(f'{ch} = {v}\n' for v, ch in cols.items()))
        f.write(f'\n[frame {name}]\n' + '\n'.join(rows) + '\n')

def vgrad(c, x0, x1, y0, y1, ramp):
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        for x in range(x0, x1 + 1):
            # ordered dither between steps
            f = t * (len(ramp) - 1); i = int(f); fr = f - i
            th = [[0, 2], [3, 1]][y % 2][x % 2] / 4 + 0.125
            c.set(x, y, ramp[min(len(ramp) - 1, i + (1 if fr > th else 0))])

# ------------------------------------------------ 1) Ava, 64x64
def ava():
    c = C()
    W = H = 64
    vgrad(c, 0, 63, 0, 63, R(17, 30, 29))
    for (x, y) in [(6, 8), (54, 12), (10, 40), (57, 44), (48, 4)]: c.set(x, y, P[21])
    c.ellipse(32, 66, 22, 14, R(16, 17, 18, 19))                 # shoulders, hoodie
    c.rect(28, 46, 36, 54, P[46]); c.rect(28, 46, 29, 54, P[33])  # neck
    c.ellipse(32, 31, 15, 17, R(33, 46, 47, 24))                 # face
    # hair: bob, violet, asymmetric fringe
    hair = lambda x, y: ((x - 32) / 19) ** 2 + ((y - 27) / 19) ** 2 <= 1 and y < 47 and (y < 21 or x < 19 or x > 45 or (y < 27 and x < 33 and y < 21 + (33 - x) * 0.5))
    c.shade_mask(hair, R(30, 29, 28, 27), 32, 24, 19, 19)
    for y in range(12, 40): c.set(44 - (y - 12) // 6, y, P[20]) if y < 24 else None   # cyan streak
    for y in range(14, 30, 2): c.set(43 - (y - 14) // 5, y, P[21])
    # eyes: big, cyan, with highlight
    for ex in (25, 39):
        c.ellipse(ex, 33, 3.2, 3.6, R(18, 19, 20))
        c.set(ex, 33, K); c.set(ex + 1, 33, K); c.set(ex, 34, K)
        c.set(ex - 1, 31, P[22])
        c.line(ex - 3, 28, ex + 2, 28, P[30])                     # brow
    c.set(32, 38, P[33]); c.set(31, 39, P[46])                    # nose
    c.line(28, 42, 35, 42, P[44]); c.set(27, 41, P[44]); c.set(36, 41, P[44]); c.line(29, 43, 34, 43, P[26])  # smile
    for ex in (21, 43): c.set(ex, 38, P[25]); c.set(ex + 1, 38, P[25])   # blush
    # headphones
    c.ellipse(15, 34, 4, 6, R(41, 40, 39)); c.ellipse(49, 34, 4, 6, R(41, 40, 39))
    c.set(49, 34, P[20]); c.set(15, 34, P[20])
    for x in range(15, 50):
        y = int(13 - 12 * math.sin(math.pi * (x - 15) / 34)) + 2
        c.set(x, y, P[41]); c.set(x, y + 1, P[40])
    c.outline(K); clean(c)
    save(c, W, H, 'ava')

# ------------------------------------------------ 2) Stromleitungen + UFO, 128x80
def ufo():
    c = C(); W, H = 128, 80
    vgrad(c, 0, 127, 0, 52, R(17, 29, 28, 26, 25, 7))          # sunset sky
    c.ellipse(92, 50, 9, 9, R(7, 8, 9))                         # sun
    for (x, y) in [(10, 5), (30, 9), (60, 3), (75, 12), (110, 6), (120, 15), (45, 14)]: c.set(x, y, P[23])
    # hills
    for x in range(W):
        h1 = 46 + int(5 * math.sin(x / 13) + 3 * math.sin(x / 5.3)); h2 = 56 + int(4 * math.sin(x / 9 + 1) + 2 * math.sin(x / 4))
        for y in range(h1, H): c.set(x, y, P[29] if y < h1 + 2 else P[30])
        for y in range(h2, H): c.set(x, y, P[16] if y > h2 + 1 else P[15])
    speckle(c, R(16, 15), 0.08, seed=5)
    # cozy house with lit window
    c.rect(18, 54, 30, 63, P[31]);
    for i in range(8): c.line(16 + i, 54 - i if i < 7 else 47, 32 - i, 54 - i if i < 7 else 47, P[1])
    c.rect(21, 57, 24, 60, P[8]); c.rect(26, 57, 28, 63, P[33]); c.set(22, 58, P[9])
    # poles + wires
    poles = [(8, 36), (52, 30), (100, 34)]
    for px, top in poles:
        c.rect(px, top, px + 1, 72, P[31]); c.rect(px - 5, top + 2, px + 6, top + 2, P[31]); c.set(px - 5, top + 1, P[41]); c.set(px + 6, top + 1, P[41])
    for (a, ta), (b, tb) in zip(poles, poles[1:]):
        for off in (-5, 6):
            for x in range(a + off, b + off + 1):
                t = (x - a - off) / (b - a); y = ta + 1 + (tb - ta) * t + 6 * math.sin(math.pi * t)
                c.set(x, int(y), K)
    # UFO with dome, lights and beam
    for y in range(30, 62):
        w = (y - 30) * 0.45 + 2
        for x in range(int(70 - w), int(70 + w) + 1):
            if (x + y) % 2 == 0 and c.get(x, y) not in (K,): c.set(x, y, P[57])
    c.ellipse(70, 23, 13, 4, R(42, 41, 40, 39, 38)); c.ellipse(70, 19, 6, 4, R(18, 19, 20, 21))
    for i, x in enumerate(range(60, 82, 5)): c.set(x, 24, [P[8], P[20], P[26]][i % 3])
    c.outline(K); clean(c)
    save(c, W, H, 'ufo')

# ------------------------------------------------ 3) Peters Wohnzimmer nach Original, 192x66
def room():
    c = C(); W, H = 192, 66; s = 192 / 1431; Y = lambda y: int((y - 60) * s); X = lambda x: int(x * s)
    c.rect(0, 0, W - 1, H - 1, P[36])                           # wall
    for y in range(0, Y(92)): c.rect(0, y, W - 1, y, P[58])       # ceiling
    c.rect(0, Y(430), W - 1, H - 1, P[56])                        # floor
    for x in range(W): c.set(x, Y(92), K)
    # side walls (perspective lines)
    c.line(X(205), Y(92), X(205), Y(430), K); c.line(X(1225), Y(92), X(1225), Y(430), K)
    c.line(0, 0, X(205), Y(92), K); c.line(W - 1, 0, X(1225), Y(92), K)
    c.line(0, Y(500), X(205), Y(430), K); c.line(W - 1, Y(500), X(1225), Y(430), K)
    for x in range(0, X(205)):
        for y in range(Y(92) - 1, H):
            yb = Y(500) + (Y(430) - Y(500)) * x / X(205)
            if y > yb: c.set(x, y, P[56])
    for x in range(X(1225) + 1, W):
        for y in range(Y(92), H):
            yb = Y(430) + (Y(500) - Y(430)) * (x - X(1225)) / (W - X(1225))
            if y > yb: c.set(x, y, P[56])
    for x in range(X(205), X(1225)): c.set(x, Y(430), P[55])
    # door left
    c.rect(X(35), Y(118), X(142), Y(485), P[33]); c.rect(X(55), Y(130), X(125), Y(480), P[34]); c.set(X(75), Y(322), P[38])
    # safe
    c.rbox(X(517), Y(188), 8, R(41, 40, 39, 38), r=1); c.set(X(517), Y(170), P[19]); c.set(X(517), Y(171), P[19])
    c.rect(X(510), Y(210), X(522), Y(240), P[39]); c.set(X(515), Y(212), P[19])
    # shelf with books
    c.rect(X(663), Y(192), X(972), Y(205), P[33]); c.line(X(663), Y(205), X(972), Y(205), P[31])
    for i, x in enumerate(range(X(680), X(840), 2)): c.rect(x, Y(152), x, Y(190), [P[3], P[44], P[1], P[33]][i % 4])
    # sofa
    c.rect(X(245), Y(290), X(770), Y(455), P[63]); c.rect(X(280), Y(300), X(740), Y(360), P[62]); c.rect(X(300), Y(385), X(720), Y(420), P[61])
    for x0 in (X(312), X(585), X(615)): c.rect(x0, Y(322), x0 + 9, Y(380), P[3]); c.rect(x0 + 1, Y(323), x0 + 7, Y(330), P[4])
    # side table
    c.rect(X(780), Y(362), X(952), Y(445), P[33]); c.rect(X(795), Y(385), X(938), Y(440), P[34]); c.line(X(820), Y(410), X(910), Y(410), P[38])
    for i, x in enumerate(range(X(895), X(935), 2)): c.rect(x, Y(322), x, Y(360), [P[3], P[44]][i % 2])
    # arch doorway
    for y in range(Y(105), Y(430)):
        for x in range(X(1000), X(1202)):
            cx = (X(1000) + X(1202)) / 2; r = (X(1202) - X(1000)) / 2
            if y < Y(105) + r and (x - cx) ** 2 + (y - Y(105) - r) ** 2 > r * r: continue
            inner = abs(x - cx) < r - 3 and (y > Y(105) + 3 + (r - math.sqrt(max(0, (r - 3) ** 2 - (x - cx) ** 2)) if y < Y(105) + r else 0))
            c.set(x, y, (P[22] if y < Y(385) else P[55]) if inner else P[34])
    # window right
    c.rect(X(1272), Y(125), X(1415), Y(350), P[34]); c.rect(X(1290), Y(140), X(1395), Y(330), P[37])
    for y in (Y(160), Y(185), Y(210)): c.line(X(1290), y, X(1395), y, P[39])
    # TV (back side) in front
    c.rect(X(402), Y(505), X(608), H - 1, P[31]); c.ellipse(X(507), Y(445), 12, 9, R(42, 41, 40, 39))
    # mess: pizza box, cans, tissues, stain
    c.rect(X(706), Y(422), X(792), Y(485), P[58]); c.line(X(712), Y(450), X(786), Y(450), P[4])
    for (x, y) in [(X(845), Y(462)), (X(815), Y(487))]: c.rect(x - 1, y - 2, x + 1, y + 1, P[4])
    for (x, y) in [(X(210), Y(452)), (X(312), Y(498)), (X(355), Y(478))]: c.rect(x - 2, y - 1, x + 1, y, P[22])
    c.rect(X(232), Y(462), X(340), Y(472), P[3])
    clean(c)
    save(c, W, H, 'room')

ava(); ufo(); room()
print('ok')
