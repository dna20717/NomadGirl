# #118 Innen-Deko: cuts the PixelLab sheets into piece sheets by connected pixels (the items do not always sit in a clean grid).
# Parts of one item (a lamp and its wire, a shelf and its jars) are merged when their boxes nearly touch. Items are ordered row by row,
# then packed into equal cells, bottom-aligned and centred. PICK chooses (and orders) the items of each source.
# Run from the repo root: python3 tools/camp_inside.py  → assets/camp/kit/<sheet>.png, prints cell / grid for data/assets.json
from PIL import Image
import numpy as np, json

K = 'projects/nomadgirl/assets/camp/kit'
# sheet: [(source, [item numbers in reading order, 1 = first])]  (Daniel's Abnahme 20.11.2026: shelves only from the new, straight sheet)
PICK = {
    'inside_lamps':     [('inside_lights_0', [1, 2]), ('inside_fix_0', [3]), ('inside_lights_0', [4, 5, 6, 7, 8])],
    'inside_shelves':   [('inside_shelves_0', [1, 2, 3, 4, 5, 6, 7, 8])],
    # Daniel 20.11.2026: „Denk bei der Deko an die orthogonale Perspektive!“ → TV, record rack, headlight, beanbag, monstera, table and
    # cushions from the straight sheet inside_fix_0
    'inside_wall':      [('inside_wall_0', [2, 3, 4]), ('inside_fix_0', [1]), ('inside_wall_0', [6]), ('inside_fix_0', [2]), ('inside_wall_0', [8]),
                         ('inside_world_0', [1, 2, 3, 4, 5, 6, 7, 8]), ('inside_fix_0', [4])],
    'inside_furniture': [('inside_fix_0', [5]), ('inside_floor_0', [3]), ('inside_fix_0', [6, 7, 8]), ('inside_furniture_0', [1, 2, 3, 4, 5, 6, 7, 8])],
    'inside_pinboard':  [('inside_pinboard_0', [1, 2, 3])],
}


def items(src, gap=4):
    im = np.array(Image.open(f'{K}/candidates/{src}.png').convert('RGBA'))
    a = im[:, :, 3] > 40
    h, w = a.shape
    lab = np.zeros((h, w), int); boxes = []
    for y in range(h):
        for x in range(w):
            if a[y, x] and not lab[y, x]:
                n = len(boxes) + 1; st = [(y, x)]; lab[y, x] = n; x0 = x1 = x; y0 = y1 = y; c = 0
                while st:
                    cy, cx = st.pop(); c += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; st.append((ny, nx))
                boxes.append([x0, y0, x1, y1, c, {n}])
    boxes = [b for b in boxes if b[4] >= 12]
    merged = True
    while merged:   # parts of one item: boxes closer than gap
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                A, B = boxes[i], boxes[j]
                if min(A[4], B[4]) < 450 and A[0] - gap <= B[2] and B[0] - gap <= A[2] and A[1] - gap <= B[3] and B[1] - gap <= A[3]:   # only small parts join a piece
                    boxes[i] = [min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3]), A[4] + B[4], A[5] | B[5]]; boxes.pop(j); merged = True; break
            if merged: break
    boxes = [b for b in boxes if b[4] >= 60]
    # reading order: rows by the box centre, then left to right
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[1] + b[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > 24: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    out = []
    for r in rows:
        for b in sorted(r, key=lambda b: b[0]):
            x0, y0, x1, y1, _, ids = b
            piece = im[y0:y1 + 1, x0:x1 + 1].copy()
            mask = np.isin(lab[y0:y1 + 1, x0:x1 + 1], list(ids))
            piece[~mask] = 0
            out.append(piece)
    return out


res = {}
for name, srcs in PICK.items():
    ims = []
    for src, pick in srcs:
        its = items(src)
        ims += [its[i - 1] for i in pick if i - 1 < len(its)]
    cw = max(i.shape[1] for i in ims); ch = max(i.shape[0] for i in ims); cw += cw % 2
    sheet = np.zeros((ch, cw * len(ims), 4), np.uint8)
    for n, p in enumerate(ims): sheet[ch - p.shape[0]:, n * cw + (cw - p.shape[1]) // 2: n * cw + (cw - p.shape[1]) // 2 + p.shape[1]] = p
    Image.fromarray(sheet).save(f'{K}/{name}.png')
    res[name] = {'cell': [cw, ch], 'grid': [len(ims), 1]}
print(json.dumps(res))
