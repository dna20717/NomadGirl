# #122 Logo (Daniel 20.11.2026: „die Textur im Schriftzug und der Straße identisch“, „die gestrichelte Linie … durchgezogen“,
# „der Straßenteil, der an das Logo angrenzt, passt von der Breite her noch nicht“). Works on the PixelLab wordmark:
#  - word.png: the dashed yellow centre line becomes one solid line (rows 78–82, across the gaps between the letters too)
#  - road.png: a new piece of road at the wordmark's own pixel size, with the profile of the L's stem (sunset rim, black outline,
#    light bevel, asphalt rows 26–132, line at y 80) and asphalt quilted from the letters themselves; the far end crumbles
# The PixelLab originals stay in candidates/ (word_dashed.png, road_pixellab.png). Run from the repo root: python3 tools/logo_road.py
from PIL import Image
import numpy as np, os, shutil

D = 'projects/nomadgirl/assets/ui/logo'
C = D + '/candidates'
for src, keep in (('word.png', 'word_dashed.png'), ('road.png', 'road_pixellab.png')):
    if not os.path.exists(f'{C}/{keep}'): shutil.copy(f'{D}/{src}', f'{C}/{keep}')

w = np.array(Image.open(f'{C}/word_dashed.png').convert('RGBA'))
H, W = w.shape[:2]
rng = np.random.default_rng(122)

ASPH = [(51, 57, 65), (74, 84, 98), (109, 117, 141), (50, 43, 40), (34, 28, 26), (20, 16, 19)]
YEL = np.array([249, 163, 27, 255], np.uint8)
YEL_HI = np.array([255, 213, 65, 255], np.uint8)
L0, L1 = 78, 82   # the centre line rows


def is_yellow(px): return (px[..., 0] > 200) & (px[..., 1] > 140) & (px[..., 2] < 90) & (px[..., 3] > 0)


def line(img, x0, x1):
    for y in range(L0, L1 + 1):
        img[y, x0:x1] = YEL if y in (L0, L1) else YEL_HI


# 1 · the word: dashes out (yellow → the asphalt next to it), then one solid line
out = w.copy()
yel = is_yellow(out)
for y in range(L0 - 1, L1 + 2):
    for x in np.nonzero(yel[y])[0]:
        above, below = out[L0 - 2, x], out[L1 + 2, x]
        out[y, x] = above if above[3] else below if below[3] else 0   # gap between letters: transparent again
line(out, 0, W)
Image.fromarray(out).save(f'{D}/word.png')

# 2 · the road: rows as the L's stem at x 490
prof = w[:, 490].copy()
top, bot = 19, 140
RW = 300
road = np.zeros((H, RW, 4), np.uint8)
for y in range(top, bot + 1): road[y, :] = prof[y]
# asphalt quilted from the letters: 14 × 14 blocks that are asphalt only (no outline, rim or yellow)
asph = np.zeros((H, W), bool)
for c in ASPH: asph |= (w[..., 0] == c[0]) & (w[..., 1] == c[1]) & (w[..., 2] == c[2]) & (w[..., 3] > 0)
asph &= ~((np.arange(H)[:, None] >= L0 - 1) & (np.arange(H)[:, None] <= L1 + 1))
B = 14
blocks = [(y, x) for y in range(0, H - B) for x in range(0, W - B, 2) if asph[y:y + B, x:x + B].all()]
a0, a1 = 26, 132
for y in range(a0, a1 + 1, B):
    for x in range(0, RW, B):
        sy, sx = blocks[rng.integers(len(blocks))]
        h, wd = min(B, a1 + 1 - y), min(B, RW - x)
        road[y:y + h, x:x + wd] = w[sy:sy + h, sx:sx + wd]
line(road, 0, RW)
# a few potholes: dark blobs with a lit lower lip, like in the letters
for cx, cy, r in ((70, 52, 5), (168, 112, 6), (232, 44, 4)):
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 2, cx + r + 3):
            d = ((x - cx) / (r + 1.5)) ** 2 + ((y - cy) / r) ** 2
            if d < 1: road[y, x] = (20, 16, 19, 255) if d > 0.45 else (6, 6, 8, 255)
            elif d < 1.35 and y > cy: road[y, x] = (74, 84, 98, 255)
# the far end crumbles: the edge eats in, chunks break off
for y in range(H):
    if not road[y, 0, 3]: continue
    end = RW - 26 + int(10 * np.sin(y * 0.21) + 7 * np.sin(y * 0.53 + 1) + rng.integers(-3, 4))
    road[y, end:] = 0
    for x in range(end - 4, end):
        if rng.random() < 0.35: road[y, x] = (6, 6, 8, 255)
for _ in range(26):   # loose pieces of asphalt
    x, y, s = int(RW - 24 + rng.integers(0, 22)), int(rng.integers(top + 6, bot - 6)), int(rng.integers(1, 4))
    if x + s < RW: road[y:y + s, x:x + s] = (51, 57, 65, 255) if rng.random() < 0.6 else (6, 6, 8, 255)
Image.fromarray(road).save(f'{D}/road.png')
print('word', W, H, 'road', RW, H, 'blocks', len(blocks))
