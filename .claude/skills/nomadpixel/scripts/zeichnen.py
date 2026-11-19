"""zeichnen.py – Zeichenhelfer für größere Pixel-Art (ab ca. 24 px).

Nutzung in einem eigenen Skript:
    import sys; sys.path.insert(0, ".claude/skills/nomadpixel/scripts")
    from zeichnen import C, to_pix, grain, speckle, inner_line, rim
    c = C()                                   # 32x32-Leinwand (T ändern für andere Größen)
    c.ellipse(16, 16, 8, 6, RAMPE)            # Kugel-Schattierung, Licht oben links
    c.thick(4, 28, 20, 12, 3, RAMPE)          # dicker Stab, quer schattiert
    c.rellipse(...), c.rbox(...), c.rect(...), c.line(...), c.shade_mask(maske, RAMPE)
    # Detail-Runde (siehe SKILL.md):
    grain(c, HOLZ, winkel), speckle(c, FLEISCH, 0.2), inner_line(c, HUT, LAMELLEN, DUNKEL), rim(c, HUT, GLOW)
    c.outline("#060608")
    to_pix([("name", c)], "ausgabe.pix", "icon = 32")
Rampen sind Listen von Hex-Farben von dunkel nach hell (nur Farben der Projektpalette verwenden!).
"""

import math
T = 32
class C:
    def __init__(s): s.g = [[None]*T for _ in range(T)]
    def set(s, x, y, col):
        if 0 <= x < T and 0 <= y < T: s.g[y][x] = col
    def get(s, x, y): return s.g[y][x] if 0 <= x < T and 0 <= y < T else None
    def shade_mask(s, mask, ramp, cx=None, cy=None, rx=None, ry=None, bias=0.0, light=(-0.7, -0.7)):
        pts = [(x, y) for y in range(T) for x in range(T) if mask(x, y)]
        if not pts: return
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        cx = cx if cx is not None else (min(xs)+max(xs))/2; cy = cy if cy is not None else (min(ys)+max(ys))/2
        rx = rx or max(1, (max(xs)-min(xs))/2+0.5); ry = ry or max(1, (max(ys)-min(ys))/2+0.5)
        lx, ly = light; ln = math.hypot(lx, ly); lx, ly = lx/ln, ly/ln
        for x, y in pts:
            nx, ny = (x-cx)/rx, (y-cy)/ry
            nz = math.sqrt(max(0, 1-min(1, nx*nx+ny*ny)))
            d = max(0, -(nx*lx+ny*ly)*0.75 + nz*0.55) + bias   # 0..~1.3
            i = int(round(min(1, max(0, d/1.15)) * (len(ramp)-1)))
            s.set(x, y, ramp[i])
    def ellipse(s, cx, cy, rx, ry, ramp, **k):
        s.shade_mask(lambda x, y: ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1.0, ramp, cx, cy, rx, ry, **k)
    def rellipse(s, cx, cy, a, b, ang, ramp, **k):
        ca, sa = math.cos(ang), math.sin(ang)
        def m(x, y):
            dx, dy = x-cx, y-cy
            u, v = dx*ca+dy*sa, -dx*sa+dy*ca
            return (u/a)**2+(v/b)**2 <= 1
        s.shade_mask(m, ramp, cx, cy, max(a, b), max(a, b), **k)
    def rbox(s, cx, cy, h, ramp, r=1.5, **k):
        """abgerundeter Würfel (Kantenlänge 2h)"""
        def m(x, y):
            dx, dy = abs(x-cx), abs(y-cy)
            if dx > h or dy > h: return False
            ex, ey = max(0, dx-(h-r)), max(0, dy-(h-r))
            return ex*ex+ey*ey <= r*r
        s.shade_mask(m, ramp, cx, cy, h+0.5, h+0.5, **k)
    def rect(s, x0, y0, x1, y1, col):
        for y in range(y0, y1+1):
            for x in range(x0, x1+1): s.set(x, y, col)
    def line(s, x0, y0, x1, y1, col, w=1):
        n = max(abs(x1-x0), abs(y1-y0), 1)
        for i in range(n+1):
            x = round(x0+(x1-x0)*i/n); y = round(y0+(y1-y0)*i/n)
            for dx in range(w):
                for dy in range(w): s.set(x+dx-w//2, y+dy-w//2, col)
    def thick(s, x0, y0, x1, y1, w, ramp):
        """Dicker Stab, quer schattiert (Licht oben links)."""
        L = math.hypot(x1-x0, y1-y0); ux, uy = (x1-x0)/L, (y1-y0)/L; px, py = -uy, ux
        if px+py > 0: px, py = -px, -py   # Normale zeigt nach oben links
        for y in range(T):
            for x in range(T):
                t = ((x-x0)*ux+(y-y0)*uy); d = ((x-x0)*px+(y-y0)*py)
                if -0.5 <= t <= L+0.5 and abs(d) <= w/2:
                    f = (d + w/2) / w   # 1 = Lichtseite
                    s.set(x, y, ramp[min(len(ramp)-1, int(f*len(ramp)))])
    def outline(s, col="#060608"):
        src = [r[:] for r in s.g]
        for y in range(T):
            for x in range(T):
                if src[y][x] is None and any(0 <= y+dy < T and 0 <= x+dx < T and src[y+dy][x+dx] is not None for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    s.g[y][x] = col
    def drop(s, col="#060608"):
        """Schatten-Pixel unten rechts außerhalb der Outline (wie in den Referenzen nicht nötig: optional)."""
        pass

def to_pix(icons, path, meta):
    cols = {}
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJLMNOPQRSTUVWXYZ0123456789"
    out_icons = []
    for name, c in icons:
        rows = []
        for r in c.g:
            line = ""
            for v in r:
                if v is None: line += "."
                else:
                    if v not in cols: cols[v] = "K" if v == "#060608" else chars[len([k for k in cols if cols[k] != "K"])]
                    line += cols[v]
            rows.append(line)
        out_icons.append((name, rows))
    with open(path, "w") as f:
        f.write("[meta]\n" + meta + "\n\n[palette]\n. = transparent\n")
        for v, ch in cols.items(): f.write(f"{ch} = {v}\n")
        for name, rows in out_icons:
            f.write(f"\n[icon {name}]\n" + "\n".join(rows) + "\n")

# ---------------------------------------------------------------- Detail-Runde
def _h(x, y, seed=0):
    v = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return (v ^ (v >> 16)) / 0xFFFFFFFF

def _step(ramp, col, d):
    i = ramp.index(col)
    return ramp[max(0, min(len(ramp) - 1, i + d))]

def grain(c, ramp, angle, period=3.0, seed=1, strength=0.55):
    """Maserung/Fasern entlang einer Richtung: Streifen +-1 Rampenstufe, unregelmäßig unterbrochen."""
    ca, sa = math.cos(angle), math.sin(angle)
    for y in range(T):
        for x in range(T):
            col = c.g[y][x]
            if col not in ramp: continue
            v = -x * sa + y * ca            # quer zur Faser
            u = x * ca + y * sa             # entlang der Faser
            w = math.sin(v * 2 * math.pi / period + _h(int(u // 3), int(v), seed) * 2.2)
            if w > 1 - strength and _h(x, y, seed + 7) > 0.25: c.g[y][x] = _step(ramp, col, -1)
            elif w < -1 + strength * 0.6 and _h(x, y, seed + 9) > 0.45: c.g[y][x] = _step(ramp, col, +1)

def speckle(c, ramp, density=0.18, seed=3, up=True):
    """Sprenkel: kleine Tupfer (1–2 px) eine Stufe heller/dunkler."""
    for y in range(T):
        for x in range(T):
            col = c.g[y][x]
            if col in ramp and _h(x, y, seed) < density:
                d = 1 if (up and _h(x, y, seed + 1) > 0.5) else -1
                c.g[y][x] = _step(ramp, col, d)
                if _h(x, y, seed + 2) > 0.6 and c.get(x + 1, y) == col: c.g[y][x + 1] = _step(ramp, col, d)

def inner_line(c, ramp_a, ramp_b, col):
    """Dunkle Innenlinie: Pixel aus A, die unten/rechts an B grenzen."""
    src = [r[:] for r in c.g]
    for y in range(T):
        for x in range(T):
            if src[y][x] in ramp_a and any(0 <= y + dy < T and 0 <= x + dx < T and src[y + dy][x + dx] in ramp_b for dx, dy in ((1, 0), (0, 1))):
                c.g[y][x] = col

def rim(c, ramp, col, side=(1, 1), every=1):
    """Randlicht auf der Schattenseite: Pixel aus ramp, deren Nachbar in Richtung side transparent ist."""
    src = [r[:] for r in c.g]
    n = 0
    for y in range(T):
        for x in range(T):
            if src[y][x] in ramp:
                nx, ny = x + side[0], y + side[1]
                if not (0 <= nx < T and 0 <= ny < T) or src[ny][nx] is None:
                    n += 1
                    if n % every == 0: c.g[y][x] = col


# ---------------------------------------------------------------- Stilbibel-Rampen
def rampen_laden(stil_json):
    """Gemessene Farbrampen der Stilbibel (analyse.py rampen --stil …) als {name: [hex dunkel → hell]}."""
    import json
    d = json.load(open(stil_json, encoding="utf-8"))
    return {r["name"]: r["farben"] for r in d.get("rampen", [])}


# ---------------------------------------------------------------- Feinschliff
def _l(h):
    return 0.299 * int(h[1:3], 16) + 0.587 * int(h[3:5], 16) + 0.114 * int(h[5:7], 16)

def clean(c, outline="#060608"):
    """Saubere Kanten: (1) Doppelpixel in Outline-Treppen entfernen (pixel-perfekte Linien),
    (2) Rauschen: Einzelpixel, die rundum von EINER Farbe umgeben sind und sich kaum von ihr abheben.
    Bewusste Lichter und dunkle Details (Helligkeitsabstand > 25) bleiben. → Anzahl Änderungen"""
    n = 0
    g = c.g
    for y in range(T):
        for x in range(T):
            if g[y][x] != outline:
                continue
            nb = {d: c.get(x + d[0], y + d[1]) for d in ((1, 0), (-1, 0), (0, 1), (0, -1))}
            hs = [d for d in ((1, 0), (-1, 0)) if nb[d] == outline]
            vs = [d for d in ((0, 1), (0, -1)) if nb[d] == outline]
            if len(hs) == 1 and len(vs) == 1:
                ox, oy = (-hs[0][0], 0), (0, -vs[0][1])          # die beiden anderen Seiten
                a, b = c.get(x + ox[0], y + ox[1]), c.get(x + oy[0], y + oy[1])
                diag = c.get(x + hs[0][0] + vs[0][0], y + hs[0][1] + vs[0][1])
                if diag == outline:
                    continue                                      # 2x2-Block: dicke Stelle, nicht anfassen
                if a is None and b is None:
                    g[y][x] = None; n += 1                         # Außenecke einer Treppe
                elif a is not None and a == b and a != outline:
                    g[y][x] = a; n += 1                            # Innenecke
    # (3) Spitzen: Outline-Pixel, das nur an EINEM gefüllten Pixel hängt (Nippel an Kreispolen) → glätten
    for y in range(T):
        for x in range(T):
            if g[y][x] != outline:
                continue
            nbs = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            filled = [(xx, yy) for xx, yy in nbs if c.get(xx, yy) is not None]
            if len(filled) == 1:
                fx_, fy_ = filled[0]
                if c.get(fx_, fy_) != outline:
                    ox, oy = fx_ - x, fy_ - y          # Seiten quer zur Spitze müssen Outline sein
                    side = [c.get(fx_ + oy, fy_ + ox), c.get(fx_ - oy, fy_ - ox)]
                    if all(v == outline for v in side):
                        g[y][x] = None; g[fy_][fx_] = outline; n += 2
    src = [r[:] for r in g]
    for y in range(1, T - 1):
        for x in range(1, T - 1):
            v = src[y][x]
            if v is None or v == outline:
                continue
            ring = {src[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
            if len(ring) == 1:
                o = next(iter(ring))
                if o is not None and o != outline and o != v and abs(_l(o) - _l(v)) <= 25:
                    g[y][x] = o; n += 1
    return n

def rotate(c, deg):
    """Saubere Drehung (RotSprite-Prinzip): 8-fach vergrößern, drehen, pro Zelle Mehrheitsfarbe zurück.
    Hält Farben exakt (keine Mischfarben) und Linien geschlossener als einfaches Drehen. → neue Leinwand"""
    from PIL import Image
    S = 8
    cols = sorted({v for r in c.g for v in r if v})
    idx = {v: i + 1 for i, v in enumerate(cols)}
    im = Image.new("L", (T, T), 0)
    for y in range(T):
        for x in range(T):
            if c.g[y][x]:
                im.putpixel((x, y), idx[c.g[y][x]])
    big = im.resize((T * S, T * S), Image.NEAREST).rotate(-deg, resample=Image.NEAREST, center=(T * S / 2, T * S / 2))
    px = big.load()
    out = C()
    from collections import Counter
    for y in range(T):
        for x in range(T):
            cnt = Counter(px[x * S + i, y * S + j] for i in range(1, S, 2) for j in range(1, S, 2))
            v, k = cnt.most_common(1)[0]
            if v == 0 and k < 0.6 * sum(cnt.values()):
                v = next((vv for vv, _ in cnt.most_common() if vv), 0)   # dünne Linien nicht verlieren
            out.g[y][x] = cols[v - 1] if v else None
    return out


# ---------------------------------------------------------------- Bibliothek
def stamp(c, pixfile, name, x=0, y=0, fx=False, fy=False, recolor=None):
    """Baustein aus einer .pix-Datei (part/icon/tile) auf die Leinwand setzen. recolor: {alt_hex: neu_hex}."""
    from pixelart import Pix
    p = Pix.load(pixfile)
    e = p.find(name, ("part", "icon", "tile", "frame"))
    if not e:
        raise KeyError(f"Baustein '{name}' fehlt in {pixfile}")
    im = p.image(e)
    W, H = im.size
    for yy in range(H):
        for xx in range(W):
            r, gg, b, a = im.getpixel((xx, yy))
            if not a:
                continue
            h = "#%02x%02x%02x" % (r, gg, b)
            if recolor:
                h = recolor.get(h, h)
            tx = x + (W - 1 - xx if fx else xx)
            ty = y + (H - 1 - yy if fy else yy)
            c.set(tx, ty, h)


# ---------------------------------------------------------------- feine Schattierung (für Figuren ab ~48 px)
def _lab(h):
    import math
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda v: ((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92
    r, g, b = f(r), f(g), f(b)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047; y = r * 0.2126 + g * 0.7152 + b * 0.0722; z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    t = lambda v: v ** (1 / 3) if v > 0.008856 else 7.787 * v + 16 / 116
    return (116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z)))

def rampe_fein(ramp, palette, max_abstand=14):
    """Feinere Rampe: setzt Palettenfarben ein, die zwischen zwei Rampenstufen liegen (Helligkeit dazwischen,
    nah an der Verbindungslinie im Farbraum). palette: Liste Hex-Farben (z. B. AAP-64). → längere Rampe"""
    import math
    L = {h: _lab(h) for h in set(palette) | set(ramp)}
    out = [ramp[0]]
    for a, b in zip(ramp, ramp[1:]):
        A, B = L[a], L[b]
        seg = [B[i] - A[i] for i in range(3)]; n2 = sum(v * v for v in seg) or 1
        mid = []
        for h in palette:
            if h in ramp:
                continue
            P = L[h]
            t = sum((P[i] - A[i]) * seg[i] for i in range(3)) / n2
            if not 0.15 < t < 0.85:
                continue
            Q = [A[i] + t * seg[i] for i in range(3)]
            if math.dist(P, Q) <= max_abstand:
                mid.append((t, h))
        out += [h for _, h in sorted(mid)][:2] + [b]
    return out

BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def _shade_dither(self, mask, ramp, cx=None, cy=None, rx=None, ry=None, bias=0.0, light=(-0.7, -0.7), dither=False, tief=0.0):
    """wie shade_mask; dither=True mischt benachbarte Stufen im Bayer-Muster (weicher Verlauf),
    tief>0 zieht die Schattenseite zusätzlich nach unten (Figuren wirken plastischer)."""
    import math
    pts = [(x, y) for y in range(T) for x in range(T) if mask(x, y)]
    if not pts:
        return
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx = cx if cx is not None else (min(xs) + max(xs)) / 2; cy = cy if cy is not None else (min(ys) + max(ys)) / 2
    rx = rx or max(1, (max(xs) - min(xs)) / 2 + 0.5); ry = ry or max(1, (max(ys) - min(ys)) / 2 + 0.5)
    lx, ly = light; ln = math.hypot(lx, ly); lx, ly = lx / ln, ly / ln
    for x, y in pts:
        nx, ny = (x - cx) / rx, (y - cy) / ry
        nz = math.sqrt(max(0, 1 - min(1, nx * nx + ny * ny)))
        d = max(0, -(nx * lx + ny * ly) * 0.75 + nz * 0.55) + bias - tief * max(0, ny)
        f = min(1, max(0, d / 1.15)) * (len(ramp) - 1)
        i = int(f)
        if dither and i < len(ramp) - 1 and (f - i) > (BAYER4[y % 4][x % 4] + 0.5) / 16:
            i += 1
        elif not dither:
            i = int(round(f))
        self.set(x, y, ramp[i])
C.shade_mask = _shade_dither


# ---------------------------------------------------------------- Bewegungsgerüst
def kapsel(c, a, b, ra, rb, ramp, light=(-0.7, -0.7), dither=False):
    """Glied von Gelenk a=(x,y) nach b, Radius ra → rb (verjüngt), rund schattiert (Licht oben links)."""
    import math
    (ax, ay), (bx, by) = a, b
    vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1e-6
    lx, ly = light; ln = math.hypot(lx, ly); lx, ly = lx / ln, ly / ln
    for y in range(int(min(ay, by) - max(ra, rb) - 1), int(max(ay, by) + max(ra, rb) + 2)):
        for x in range(int(min(ax, bx) - max(ra, rb) - 1), int(max(ax, bx) + max(ra, rb) + 2)):
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2))
            px, py = ax + t * vx, ay + t * vy
            r = ra + (rb - ra) * t
            dx, dy = x - px, y - py
            dist = math.hypot(dx, dy)
            if dist > r + 0.35:
                continue
            nx, ny = (dx / r, dy / r) if r > 0 else (0, 0)
            nz = math.sqrt(max(0, 1 - min(1, nx * nx + ny * ny)))
            dval = max(0, -(nx * lx + ny * ly) * 0.75 + nz * 0.55)
            f = min(1, dval / 1.15) * (len(ramp) - 1)
            i = int(f)
            if dither and i < len(ramp) - 1 and (f - i) > (BAYER4[y % 4][x % 4] + 0.5) / 16:
                i += 1
            elif not dither:
                i = int(round(f))
            c.set(x, y, ramp[i])

def glied_kette(start, winkel, laengen):
    """Vorwärtskinematik: Startgelenk, Winkel in Grad (0 = nach unten, positiv = nach vorn/rechts, jeder relativ
    zum vorigen Glied), Längen → Liste der Gelenkpunkte [start, knie, fuß, …]."""
    import math
    pts = [start]; a = 0.0
    for w, l in zip(winkel, laengen):
        a += w
        x, y = pts[-1]
        pts.append((x + math.sin(math.radians(a)) * l, y + math.cos(math.radians(a)) * l))
    return pts

def bein(c, start, winkel, laengen, radien, ramp, dither=False):
    """Bein/Arm aus Gelenkwinkeln zeichnen; radien je Gelenk (len(laengen)+1). → Gelenkpunkte"""
    pts = glied_kette(start, winkel, laengen)
    for i in range(len(pts) - 1):
        kapsel(c, pts[i], pts[i + 1], radien[i], radien[i + 1], ramp, dither=dither)
    return pts
