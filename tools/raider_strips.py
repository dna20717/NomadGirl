#!/usr/bin/env python3
# Raider-Bausatz (#004, Daniel, 12.11.2026: „so modular wie sinnvoll, Köpfe und Waffen flexibel austauschen,
# ohne dass die Qualität der Animationen drunter leidet“).
#
# Die PixelLab-Animationen tragen statt einer echten Waffe einen flachen grünen Platzhalter (#00FF00). Dieses
# Skript macht daraus je Animation:
#   <name>.png        Körper-Streifen ohne Platzhalter (Löcher im Körper hinter dem Platzhalter aufgefüllt)
#   <name>_hands.png  was vor dem Platzhalter liegt (Finger am Griff, ein Arm davor): wird über die Waffe gelegt
#   layers            je Frame: Griff [x, y], Winkel (Grad, Griff → Spitze), Waffe vorn/hinten, Kopf [x, y]
# Alle Frames liegen danach im selben Rahmen mit demselben Anker (Fußmitte der Grundpose), egal wie PixelLab
# die Leinwand der einzelnen Animation zugeschnitten hat (Ausrichtung: erster Frame ↔ Schlüsselpose).
#
#   python3 tools/raider_strips.py            → Streifen nach assets/raider/, JSON-Zeilen für data/assets.json auf stdout
#
# Quellen: assets/raider/source/base_east.png (Grundpose, Kopf-Vorlage), pose_<klasse>.png (Schlüsselposen),
# anims/<klasse>_<zustand>/*.png (tools/raider_fetch.sh).
import glob, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import Delaunay

ROOT = 'projects/nomadgirl/assets/raider/'
SRC = ROOT + 'source/'
CANVAS = 256
FPS = {'walk': 10, 'run': 12, 'alert': 6, 'crouch': 14, 'attack': 12, 'hit': 14, 'death': 10}
LOOP = {'walk': True, 'run': True, 'alert': True, 'crouch': False, 'attack': False, 'hit': False, 'death': False}

def rgba(path):
    return np.array(Image.open(path).convert('RGBA')).astype(np.int32)

def green(a):
    # the placeholder and everything PixelLab smeared from it: clearly green (also pale or dark green)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (a[:, :, 3] > 0) & (((g > 120) & (g > r + 50) & (g > b + 50)) | ((g > 60) & (g > r + 30) & (g > b + 30)))

def solid(g, min_size=20):
    """the placeholder without crumbs (for measuring)"""
    lab, n = ndimage.label(g, structure=np.ones((3, 3)))
    if not n: return g
    sizes = ndimage.sum(g, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_size])

def no_flash(a):
    """muzzle flashes PixelLab painted although asked not to (bright yellow/white stars): the code draws its own"""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    m = (a[:, :, 3] > 0) & (r > 215) & (g > 190) & (b < 140)
    if m.any():
        m = ndimage.binary_dilation(m, iterations=1) & (a[:, :, 3] > 0) & (r + g > 380)
        a = a.copy(); a[m] = 0
    return a

def lerp_angle(a, b, t):
    d = (b - a + 180) % 360 - 180
    return a + d * t

def place(a, dx, dy, size=CANVAS):
    """a on a size×size canvas, shifted by dx, dy"""
    out = np.zeros((size, size, 4), np.int32)
    h, w = a.shape[:2]
    x0, y0 = max(0, dx), max(0, dy)
    x1, y1 = min(size, dx + w), min(size, dy + h)
    if x1 > x0 and y1 > y0: out[y0:y1, x0:x1] = a[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return out

def align(frame, key):
    """offset (dx, dy) that puts frame onto the key pose (both without green), feet first"""
    fa, ka = frame[:, :, 3] > 0, key[:, :, 3] > 0
    fy, fx = np.where(fa); ky, kx = np.where(ka)
    # start: bottoms on the same row, centres of the lowest 30 rows on the same column
    dy0 = ky.max() - fy.max()
    fl = fx[fy > fy.max() - 30]; kl = kx[ky > ky.max() - 30]
    dx0 = int(round(kl.mean() - fl.mean()))
    best, bd = None, 1e18
    for dy in range(dy0 - 6, dy0 + 7):
        for dx in range(dx0 - 10, dx0 + 11):
            p = place(frame, dx, dy)
            d = np.abs(p[:, :, :3] - key[:, :, :3]).sum(2)
            both = (p[:, :, 3] > 0) | ka
            score = d[both].mean() if both.any() else 1e9
            if score < bd: bd, best = score, (dx, dy)
    return best

def head_template(base):
    a = base[:, :, 3] > 0
    ys, xs = np.where(a)
    top = ys.min()
    rows = slice(top, top + 46)
    m = np.zeros_like(a); m[rows] = a[rows]
    hy, hx = np.where(m)
    box = (hx.min(), top, hx.max() + 1, top + 46)
    return base[box[1]:box[3], box[0]:box[2]], m[box[1]:box[3], box[0]:box[2]], box

def find_head(frame, tpl, tmask, box, prev=None):
    """best match of the head template in the frame (search around prev or the base position)"""
    th, tw = tmask.shape
    cx, cy = prev if prev else (box[0], box[1])
    best, bd = (cx, cy), 1e18
    rng = 14 if prev else 60
    for y in range(max(0, cy - rng), min(CANVAS - th, cy + rng) + 1, 1):
        for x in range(max(0, cx - rng), min(CANVAS - tw, cx + rng) + 1, 1 if prev else 2):
            win = frame[y:y + th, x:x + tw]
            sol = win[:, :, 3] > 0
            d = np.abs(win[:, :, :3] - tpl[:, :, :3]).sum(2)
            miss = tmask & ~sol
            score = d[tmask & sol].sum() + miss.sum() * 300
            if score < bd: bd, best = score, (x, y)
    if not prev:   # refine with step 1
        return find_head(frame, tpl, tmask, box, best)
    return best

def find_head_turned(frame, tpl, tmask, prev, prev_ang):
    """death: the head falls and turns; search rotated templates around the last place (centre + angle)"""
    best, bd = (prev[0], prev[1], prev_ang), 1e18
    for ang in range(int(prev_ang) - 40, int(prev_ang) + 41, 10):
        rt = ndimage.rotate(tpl, ang, reshape=True, order=0, mode='constant', cval=0)
        rm = ndimage.rotate(tmask.astype(np.uint8), ang, reshape=True, order=0) > 0
        th, tw = rm.shape
        n = rm.sum() or 1
        for step, rng, cx0, cy0 in ((2, 50, prev[0], prev[1]), ):
            for cy in range(cy0 - rng, cy0 + rng + 1, step):
                for cx in range(cx0 - rng, cx0 + rng + 1, step):
                    x, y = cx - tw // 2, cy - th // 2
                    if x < 0 or y < 0 or x + tw > CANVAS or y + th > CANVAS: continue
                    win = frame[y:y + th, x:x + tw]
                    sol = win[:, :, 3] > 0
                    d = np.abs(win[:, :, :3] - rt[:, :, :3]).sum(2)
                    score = (d[rm & sol].sum() + (rm & ~sol).sum() * 300) / n
                    if score < bd: bd, best = score, (cx, cy, ang)
    return best

def weapon(frame, g, torso_x):
    """grip, angle, length from the green placeholder g (mask); hands = opaque non-green pixels inside its hull"""
    ys, xs = np.where(g)
    if len(xs) < 15: return None, np.zeros(g.shape, bool)
    pts = np.stack([xs, ys], 1).astype(float)
    mean = pts.mean(0)
    u = np.linalg.svd(pts - mean, full_matrices=False)[2][0]
    t = (pts - mean) @ u
    # hull of the placeholder: what lies inside it and is not green is in front of the weapon (fingers, an arm)
    hands = np.zeros(g.shape, bool)
    try:
        hull = Delaunay(pts)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        gy, gx = np.mgrid[y0:y1, x0:x1]
        inside = hull.find_simplex(np.stack([gx.ravel(), gy.ravel()], 1)) >= 0
        sub = np.zeros(g.shape, bool); sub[y0:y1, x0:x1] = inside.reshape(gy.shape)
        hands = sub & ~g & (frame[:, :, 3] > 0)
    except Exception:
        pass
    # grip: hand pixels right next to the placeholder, else the end nearest the torso
    near = hands & ndimage.binary_dilation(g, iterations=2)
    if near.sum() >= 6:
        hy, hx = np.where(near)
        grip = np.array([hx.mean(), hy.mean()])
        loose = False
    else:   # no fingers over it (PixelLab let it drift off the hand): the end nearest the body, drawn behind the body
        ends = [mean + u * t.min(), mean + u * t.max()]
        grip = min(ends, key=lambda e: abs(e[0] - torso_x))
        loose = True
    tg = (grip - mean) @ u
    tip = mean + u * (t.max() if abs(t.max() - tg) >= abs(t.min() - tg) else t.min())
    ang = float(np.degrees(np.arctan2(tip[1] - grip[1], tip[0] - grip[0])))
    return {'grip': [round(float(grip[0]), 1), round(float(grip[1]), 1)], 'angle': round(ang, 1),
            'len': round(float(t.max() - t.min()), 1), **({'back': True} if loose else {})}, hands

def fill_holes(a, g):
    """green pixels inside the body get the colour of the nearest body pixel; green in the air becomes empty"""
    body = (a[:, :, 3] > 0) & ~g
    out = a.copy(); out[g] = 0
    if not g.any(): return out
    closed = ndimage.binary_closing(body, iterations=6)
    fill = g & ndimage.binary_fill_holes(closed)
    if fill.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~body, return_indices=True)
        out[fill] = a[iy[fill], ix[fill]]
    return out

def main():
    base = rgba(SRC + 'base_east.png')
    tpl, tmask, hbox = head_template(base)
    by, bx = np.where(base[:, :, 3] > 0)
    feet_y = int(by.max())
    feet_x = float(bx[by > by.max() - 30].mean())
    head0 = [hbox[0], hbox[1]]
    keys = {}
    anims = sorted(glob.glob(SRC + 'anims/*/'))
    frames_all = {}
    for d in anims:
        name = os.path.basename(os.path.dirname(d))
        cls = name.split('_')[0]
        if cls not in keys:
            kp = SRC + f'pose_{cls}.png'
            k = rgba(kp) if os.path.exists(kp) else base
            k = k.copy(); k[green(k)] = 0
            keys[cls] = k
        files = sorted(glob.glob(d + '*.png'))
        fr = [no_flash(rgba(f)) for f in files]
        f0 = fr[0].copy(); f0[green(f0)] = 0
        dx, dy = align(f0, keys[cls])
        frames_all[name] = [place(f, dx, dy) for f in fr]
    # one frame box for everything (union of all frames), anchor = feet of the base pose
    union = np.zeros((CANVAS, CANVAS), bool)
    for fr in frames_all.values():
        for f in fr: union |= f[:, :, 3] > 0
    uy, ux = np.where(union)
    pad = 2
    x0, y0, x1, y1 = 0, 0, CANVAS, CANVAS   # whole canvas: heads (mohawk, spikes) reach above the painted body
    W, H = x1 - x0, y1 - y0
    origin = [round(feet_x - x0, 1), feet_y - y0 + 1]
    rows = {}
    for name, fr in frames_all.items():
        state = name.split('_', 1)[1] if '_' in name else name
        body = Image.new('RGBA', (W * len(fr), H)); hands = Image.new('RGBA', (W * len(fr), H))
        layers, prev_head = [], None
        any_hands = False
        # smears (PixelLab paints motion blur in green on fast swings): far more green than usual → the weapon of that
        # frame is interpolated from its neighbours, the smear itself goes (fx.slash draws the swing in the game)
        areas = [int(solid(green(f)).sum()) for f in fr]
        normal = [a for a in areas if a > 0]
        med = float(np.median(normal)) if normal else 0
        raw = []
        for i, f in enumerate(fr):
            g = green(f)
            smear = med and areas[i] > med * 1.8
            if smear or areas[i] < max(15, med * 0.25):
                raw.append((None, np.zeros(g.shape, bool), 'smear' if smear else 'gone'))
            else:
                w, hm = weapon(f, solid(g), feet_x)
                raw.append((w, hm, 'ok' if w else 'gone'))
        # partly painted (PixelLab fades the weapon out or paints it pale): too little green → also interpolated
        for i, r in enumerate(raw):
            if r[2] == 'ok' and areas[i] < med * 0.6: raw[i] = (None, np.zeros(r[1].shape, bool), 'gone')
        # a jump of the angle against both neighbours (the tip measured at the wrong end) → interpolated
        loop = LOOP.get(state, True)
        n = len(raw)
        def nb(i, d):
            j = i + d
            while 0 <= j < n or loop:
                j %= n
                if j == i: return None
                if raw[j][2] == 'ok': return j
                j += d
                if not loop and not 0 <= j < n: return None
            return None
        for i, r in enumerate(raw):
            if r[2] != 'ok': continue
            js = [j for j in (nb(i, -1), nb(i, 1)) if j is not None]
            diffs = [abs((r[0]['angle'] - raw[j][0]['angle'] + 180) % 360 - 180) for j in js]
            if diffs and all(d > (110 if state == 'attack' else 70) for d in diffs): raw[i] = (None, r[1], 'gone')
        # loops (alert, walk, run) hold the weapon roughly the same way: far off the circular mean = measured wrong
        if state in ('alert', 'walk', 'run'):
            ok_ = [r[0]['angle'] for r in raw if r[2] == 'ok']
            if ok_:
                ref = np.degrees(np.arctan2(np.mean(np.sin(np.radians(ok_))), np.mean(np.cos(np.radians(ok_)))))
                for i, r in enumerate(raw):
                    if r[2] == 'ok' and abs((r[0]['angle'] - ref + 180) % 360 - 180) > 75: raw[i] = (None, r[1], 'gone')
        good = [i for i, r in enumerate(raw) if r[2] == 'ok']
        ws = []
        for i, (w, hm, kind) in enumerate(raw):
            if kind == 'ok' or not good: ws.append(w); continue
            bi, ai = nb(i, -1), nb(i, 1)
            a, b = (raw[bi][0] if bi is not None else None), (raw[ai][0] if ai is not None else None)
            if a and b:
                span = (ai - bi) % n if loop else ai - bi
                t = ((i - bi) % n if loop else i - bi) / (span or 1)
                w = {'grip': [round(a['grip'][0] + (b['grip'][0] - a['grip'][0]) * t, 1), round(a['grip'][1] + (b['grip'][1] - a['grip'][1]) * t, 1)],
                     'angle': round(lerp_angle(a['angle'], b['angle'], t), 1)}
            else:
                w = dict(a or b)
            w.pop('back', None)
            ws.append(w)
        head_ang = 0
        th0, tw0 = tmask.shape
        for i, f in enumerate(fr):
            g = green(f)
            if raw[i][2] != 'ok':   # pale or half painted weapon: every greenish pixel goes
                r_, g_, b_ = f[:, :, 0], f[:, :, 1], f[:, :, 2]
                g = g | ((f[:, :, 3] > 0) & (g_ > r_ + 15) & (g_ > b_ + 15))
            w, hm = ws[i], raw[i][1]
            if state == 'death' and i > 0:
                cx, cy, head_ang = find_head_turned(f, tpl, tmask, (prev_head[0] + tw0 // 2, prev_head[1] + th0 // 2), head_ang)
                hx, hy = cx - tw0 // 2, cy - th0 // 2
            else:
                hx, hy = find_head(f, tpl, tmask, hbox, prev_head)
            prev_head = (hx, hy)
            b = fill_holes(f, g)
            hpix = np.zeros_like(f); hpix[hm] = f[hm]
            if hm.any(): any_hands = True
            body.paste(Image.fromarray(b[y0:y1, x0:x1].astype(np.uint8)), (i * W, 0))
            hands.paste(Image.fromarray(hpix[y0:y1, x0:x1].astype(np.uint8)), (i * W, 0))
            row = {'frame': i + 1, 'head': [int(hx - head0[0]), int(hy - head0[1])]}
            if head_ang: row['headAngle'] = int(head_ang)
            if w:
                row['grip'] = [round(w['grip'][0] - x0, 1), round(w['grip'][1] - y0, 1)]
                row['angle'] = w['angle']
                if w.get('back'): row['back'] = True
            layers.append(row)
        body.save(ROOT + f'{name}.png')
        if any_hands: hands.save(ROOT + f'{name}_hands.png')
        elif os.path.exists(ROOT + f'{name}_hands.png'): os.remove(ROOT + f'{name}_hands.png')
        rows[f'raider_{name}'] = {
            'name': f'Raider · {name}', 'kind': 'animation', 'file': f'assets/raider/{name}.png',
            **({'hands': f'assets/raider/{name}_hands.png'} if any_hands else {}),
            'frameSize': [W, H], 'frames': len(fr), 'fps': FPS.get(state, 10), 'loop': LOOP.get(state, True),
            'origin': origin, 'layers': layers,
            'source': 'KI (PixelLab, animate_character v3 mit grünem Platzhalter) + Code (tools/raider_strips.py)',
            'date': '12.11.2026'}
    # heads: edits of the base pose where only the head changed (assets/raider/source/head_<id>.png) → the changed pixels
    # above the neck plus the old head, cropped; 'at' = top left in the strip frame at the base pose (head offset 0, 0)
    heads = {}
    bm = base[:, :, 3] > 0
    top = int(np.where(bm)[0].min())
    neck = top + 52
    head_mask = np.zeros_like(bm); head_mask[top:top + 46] = bm[top:top + 46]
    for f in sorted(glob.glob(SRC + 'head_*.png')):
        hid = os.path.basename(f)[5:-4]
        e = rgba(f)
        diff = (np.abs(e - base).sum(2) > 24) & (e[:, :, 3] > 0)
        m = (diff | (head_mask & (e[:, :, 3] > 0)))
        m[neck:] = False
        lab, n = ndimage.label(m)
        if n:
            sizes = ndimage.sum(m, lab, range(1, n + 1))
            m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 6])
        ys, xs = np.where(m)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        out = np.zeros_like(e); out[m] = e[m]
        Image.fromarray(out[by0:by1, bx0:bx1].astype(np.uint8)).save(ROOT + f'head_{hid}.png')
        heads[hid] = {'at': [int(bx0 - x0 + 0), int(by0 - y0)], 'size': [int(bx1 - bx0), int(by1 - by0)]}
    meta = {'frameSize': [W, H], 'origin': origin, 'heads': heads, 'headPivot': [int(hbox[0] + (hbox[2] - hbox[0]) // 2 - x0), int(hbox[1] + 23 - y0)], 'head': {'box': [int(hbox[0] - x0), int(hbox[1] - y0), int(hbox[2] - hbox[0]), int(hbox[3] - hbox[1])]},
            'crop': [int(x0), int(y0)]}
    json.dump({'meta': meta, 'assets': rows}, open(SRC + 'strips.json', 'w'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print(json.dumps(meta, default=lambda o: o.item()))
    for k, v in rows.items():
        print(k, v['frames'], 'Frames', 'Hände' if 'hands' in v else '', sum(1 for r in v['layers'] if 'grip' in r), 'mit Waffe')

if __name__ == '__main__':
    main()
