# #116 Ziehen zum Wachsen: cuts the PixelLab pictures of tall/long camp pieces into modules.
# Every piece was painted extra tall (posts, tower) or extra long (tents) with evenly repeating sections. For each variant this
# script isolates it (connected pixels), finds a repeating middle section whose seams match (rows for 'up', columns for 'side'),
# drops the surplus repeats and writes a sheet: one cell per variant = head + ONE middle section + foot, bottom-aligned.
# It prints the decor rows for data/decor.json: Deko › Wachsen › Mittelstück je Variante (y = rows, x = columns, in cell pixels).
# Run from the repo root: python3 tools/camp_modules.py
from PIL import Image
import numpy as np, json

K = 'projects/nomadgirl/assets/camp/kit'
C = K + '/candidates'

# piece: (axis, [ (source, x-centre range of the variant, y range or None) ], period range, keep extra repeats for the default look)
PIECES = {
    'mod_lantern': ('up', [('mod_lantern_b', (40, 135), None), ('mod_lantern_b', (149, 240), None), ('mod_lantern_a', (60, 135), None)], (40, 72)),
    'mod_poles':   ('up', [('mod_poles_b', (40, 80), None), ('mod_poles_b', (172, 240), None), ('mod_poles_a', (62, 130), None)], (40, 72)),
    'mod_tower':   ('up', [('mod_tower', (0, 192), None)], (70, 74)),
    'mod_trophies': ('up', [('mod_trophies', (0, 128), None)], (36, 70)),   # #118 trophy stand: identical tiers
    'mod_tent_a':  ('side', [('mod_tents', (0, 512), (0, 128))], (55, 60)),
    'mod_tent_b':  ('side', [('mod_tents', (0, 512), (128, 256))], (48, 53)),
}


def components(a):
    """label 8-connected opaque pixels → (labels, count)"""
    h, w = a.shape
    lab = np.zeros((h, w), int)
    n = 0
    for y in range(h):
        for x in range(w):
            if a[y, x] and not lab[y, x]:
                n += 1
                stack = [(y, x)]
                lab[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                stack.append((ny, nx))
    return lab, n


def isolate(src, xr, yr):
    im = np.array(Image.open(f'{C}/{src}.png').convert('RGBA'))
    if yr: im = im[yr[0]:yr[1]]
    a = im[:, :, 3] > 40
    lab, n = components(a)
    keep = np.zeros_like(a)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 6: continue
        cx = (xs.min() + xs.max()) / 2
        if xr[0] <= cx <= xr[1]: keep |= lab == i
    im = im.copy()
    im[~keep] = 0
    im[:, :, 3] = np.where(keep, 255, 0)
    ys, xs = np.nonzero(keep)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def diff(a, b): return np.abs(a.astype(int) - b.astype(int)).mean()


def cut(im, axis, pr):
    """→ (compact image with one middle section, start, length) along the axis"""
    if axis == 'side': im = im.transpose(1, 0, 2)   # columns as rows
    L = im.shape[0]
    alpha = (im[:, :, 3] > 0).sum(1)
    core = np.median(alpha[L // 3: 2 * L // 3])
    # head ends / foot starts where the width is the shaft's (for posts); for tower/tents the whole middle repeats
    lo, hi = int(L * 0.18), int(L * 0.82)
    if axis == 'up' and core < 40:
        head = next(y for y in range(L // 6, L) if abs(alpha[y] - core) <= 2 and abs(alpha[y + 4] - core) <= 2)
        foot = next(y for y in range(L - L // 8, 0, -1) if abs(alpha[y] - core) <= 2 and abs(alpha[y - 4] - core) <= 2)
        lo, hi = head + 2, foot - 2
    best = None
    for p in range(pr[0], pr[1] + 1):
        for s in range(lo, min(hi - p, lo + pr[1])):   # the first section below the head: short pieces stay possible
            d = diff(im[s], im[s + p]) + diff(im[s + 1], im[s + p + 1])
            if best is None or d < best[0]: best = (d, s, p)
    _, s, p = best
    # the foot: the last row near the bottom that matches row s+p (drops the surplus repeats in between)
    cand = [(diff(im[e], im[s + p]) + diff(im[e + 1], im[s + p + 1]), e) for e in range(max(s + p, hi - pr[1]), hi)]
    dmin = min(d for d, _ in cand)
    e = max(e for d, e in cand if d <= dmin * 1.3 + 1)   # as close to the foot as a clean seam allows
    out = np.concatenate([im[:s + p], im[e:]], 0)
    if axis == 'side': out = out.transpose(1, 0, 2)
    return out, s, p


res = {}
for name, (axis, variants, pr) in PIECES.items():
    parts = []
    for src, xr, yr in variants:
        im = isolate(src, xr, yr)
        out, s, p = cut(im, axis, pr)
        parts.append((out, s, p))
    cw = max(o.shape[1] for o, _, _ in parts); ch = max(o.shape[0] for o, _, _ in parts)
    cw += cw % 2
    sheet = np.zeros((ch, cw * len(parts), 4), np.uint8)
    rows = []
    for i, (o, s, p) in enumerate(parts):
        oy, ox = ch - o.shape[0], (cw - o.shape[1]) // 2
        sheet[oy:, i * cw + ox: i * cw + ox + o.shape[1]] = o
        if axis == 'up': rows.append({'y': [oy + s, oy + s + p]})
        else:   # tents also grow a little in height: a thin band of their wall repeats (Daniel: „eingeschränkt in Höhe“)
            H = o.shape[0]
            band = min(((diff(o[t], o[t + q]) + diff(o[t + 1], o[t + q + 1]), t, q) for q in range(6, 20) for t in range(int(H * 0.45), int(H * 0.85) - q)))
            rows.append({'x': [ox + s, ox + s + p], 'y': [oy + band[1], oy + band[1] + band[2]]})
    Image.fromarray(sheet).save(f'{K}/{name}.png')
    res[name] = {'cell': [cw, ch], 'grid': [len(parts), 1], 'slices': rows}
print(json.dumps(res))
