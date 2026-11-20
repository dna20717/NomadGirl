# #124 Straße und Wüste fürs Cockpit-Hauptmenü (Daniel 20.11.2026: „gönne uns auch ein paar nette Texturen für die Straße und die Wüste
# daneben“; „man fährt auf der falschen Straßenseite“). Builds the ground texture the start page scene rolls towards us:
# PixelLab tiles (asphalt, cracked desert clay, 64 px with a 1 px frame) are cut to 62 px and made seamless (cross-faded with a
# half-shifted copy, snapped back to AAP-64); the markings are code: US two-lane highway, white edge lines, double yellow centre
# (solid on the far side, dashed on our side), worn paint, wheel tracks, patches, potholes, sand drifting onto the shoulders.
# Width 16 m = 310 px (5 tiles), length 12.8 m = 248 px (4 tiles, one dash period). Road centre at 8 m; our lane is the right one.
# Run from the repo root: python3 tools/cockpit_road.py
from PIL import Image
import numpy as np

D = 'projects/nomadgirl/assets/splash/cockpit'
PAL = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in open('projects/nomadgirl/assets/palette/aap-64.hex').read().split()])
rng = np.random.default_rng(124)
T = 62


def snap(a):
    d = ((a[..., None, :].astype(int) - PAL[None, None]) ** 2).sum(-1)
    return PAL[d.argmin(-1)].astype(np.uint8)


def seamless(path):
    t = np.array(Image.open(path).convert('RGB'))[1:63, 1:63].astype(float)
    r = np.roll(t, (T // 2, T // 2), (0, 1))
    i = np.arange(T)
    w1 = np.minimum(i, T - 1 - i) / (T / 2)                     # 0 at the edges, 1 in the middle
    w = np.clip(np.minimum(w1[:, None], w1[None, :]) * 2.2, 0, 1)[..., None]
    return snap(t * w + r * (1 - w))


asph = seamless(f'{D}/src/asphalt.png')
desert = seamless(f'{D}/src/desert.png')
W, H, M = 5 * T, 4 * T, 5 * T / 16          # px, px, px per metre
img = np.zeros((H, W, 3), np.uint8)
xs = np.arange(W)
for y in range(H):
    for x in range(W):
        m = x / M
        img[y, x] = asph[y % T, x % T] if 3.5 <= m < 12.5 else desert[y % T, (x if m < 8 else x - (W - T)) % T]
dark = lambda c, f: snap(np.array(c, float)[None, None] * f)[0, 0]
# wheel tracks: a little darker where the tyres run
for cx in (5.0, 7.0, 9.0, 11.0):
    for y in range(H):
        for x in range(int((cx - 0.35) * M), int((cx + 0.35) * M)):
            if rng.random() < 0.55: img[y, x] = dark(img[y, x], 0.82)
# patches: darker rectangles of newer tar
for _ in range(5):
    x0, y0, w, h = int(rng.uniform(4.5, 11) * M), int(rng.uniform(0, H - 30)), int(rng.uniform(10, 30)), int(rng.uniform(8, 26))
    img[y0:y0 + h, x0:x0 + w] = (34, 28, 26)
    img[y0, x0:x0 + w] = img[y0 + h - 1, x0:x0 + w] = (20, 16, 19)
# paint: white edges, double yellow centre (the far line solid, ours dashed: we may pass), worn
WHITE, YEL, YEL2 = (218, 224, 234), (249, 163, 27), (255, 213, 65)


def paint(m0, m1, col, dashed=False):
    for y in range(H):
        if dashed and not (y % H < 62): continue          # 3.2 m dash, 9.6 m gap
        for x in range(int(m0 * M), int(m1 * M) + 1):
            if rng.random() < 0.86: img[y, x] = col if rng.random() < 0.8 else YEL2 if col == YEL else (179, 185, 209)


paint(3.95, 4.1, WHITE); paint(11.9, 12.05, WHITE)
paint(7.82, 7.93, YEL); paint(8.07, 8.18, YEL, dashed=True)
# potholes with a lit far lip
for cx, cy, r in ((10.3, 40, 5), (6.2, 150, 4), (11.2, 205, 3)):
    X, Y = int(cx * M), cy
    for y in range(Y - r - 1, Y + r + 2):
        for x in range(X - r - 2, X + r + 3):
            d = ((x - X) / (r + 1.5)) ** 2 + ((y - Y) / r) ** 2
            if d < 1: img[y % H, x] = (6, 6, 8) if d < 0.45 else (20, 16, 19)
            elif d < 1.4 and y < Y: img[y % H, x] = (74, 84, 98)
# sand blown onto the shoulders, thinning out towards the lanes
for y in range(H):
    for x in range(W):
        m = x / M
        p = max(0, 1 - (m - 3.3) / 0.8) if 3.3 <= m < 4.1 else max(0, (m - 11.9) / 0.8) if 11.9 <= m < 12.7 else 0
        if p and rng.random() < p * 0.8: img[y, x] = desert[y % T, x % T]
Image.fromarray(img).save(f'{D}/road.png')
Image.fromarray(asph).save(f'{D}/asphalt_tile.png'); Image.fromarray(desert).save(f'{D}/desert_tile.png')
print('road', W, H, 'px/m', M)
