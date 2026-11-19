"""relief.py – Relief-Licht für Pixel-Art (NomadPixel).

Statt Flächen einzeln „anzumalen“, bekommt jedes Objekt eine Höhenkarte (wie weit ragt jeder Pixel nach vorn)
und eine Materialkarte. render() beleuchtet das daraus: Licht + Glanz aus den Flächennormalen, Umgebungsschatten
in Fugen und Ecken (AO), Schlagschatten innerhalb des Objekts, Randlicht, Verlauf auf die Rampe des Materials
(nur an den Stufengrenzen gedithert), Umriss. Damit wirken Objekte rund und schwer statt flach.

    import sys; sys.path.insert(0, ".claude/skills/nomadpixel/scripts")
    from relief import Relief, material
    r = Relief(64, 64)
    r.mat("rost", ["#322b28", "#5b3138", "#71413b", "#bb7547", "#dba463"], glanz=0.3, rau=0.35)
    r.zylinder(12, 8, 51, 62, "rost", tiefe=14)          # senkrechter Zylinder
    r.rille(12, 25, 51, 25, tiefe=2)                       # Sicke
    r.kasten(...), r.kugel(...), r.scheibe(...), r.niete(...), r.linie(...), r.struktur("rost", 0.6)
    bild = r.render()                                      # → Liste von Zeilen mit "#rrggbb" oder None
    r.nach_c(c)                                            # in eine zeichnen.C-Leinwand übertragen

Licht kommt standardmäßig von oben links vorn. Höhe in Pixeln (etwa so viel wie das Objekt tief ist).
"""
import math
import numpy as np

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def _hash(x, y, s):
    v = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return (v & 0xffff) / 65535.0


def _blur(a, r):
    if r <= 0: return a.copy()
    k = 2 * r + 1
    p = np.pad(a, r, mode="edge")
    c = np.cumsum(np.cumsum(p, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def _abstand(m, n):
    """Abstand zum Rand der Maske in Pixeln (bis n), durch wiederholtes Abtragen."""
    d = np.zeros(m.shape); cur = m.copy()
    for k in range(int(n) + 1):
        d[cur] = k + 1
        nb = cur.copy()
        nb[1:, :] &= cur[:-1, :]; nb[:-1, :] &= cur[1:, :]; nb[:, 1:] &= cur[:, :-1]; nb[:, :-1] &= cur[:, 1:]
        cur = nb
    return d - 0.5


class Relief:
    def __init__(s, w=64, h=64):
        s.w, s.h = w, h
        s.H = np.zeros((h, w))            # Höhe (nach vorn)
        s.M = np.full((h, w), -1, int)    # Material-Index, -1 = leer
        s.F = np.zeros((h, w))            # feste Farbe statt Licht (Index in s.fix), 0 = keine
        s.mats, s.names, s.fix = [], {}, [None]
        s.licht = np.array([-0.55, -0.75, 0.65])
        s.licht /= np.linalg.norm(s.licht)

    # -------------------------------------------------- Materialien
    def mat(s, name, rampe, glanz=0.2, rau=0.2, hart=24, rand=0.0):
        """rampe dunkel → hell; glanz 0–1 (Metall 0.4–0.8, Stoff 0), rau = Relief-Rauschen der Oberfläche (0–1)."""
        s.names[name] = len(s.mats)
        s.mats.append(dict(rampe=rampe, glanz=glanz, rau=rau, hart=hart, rand=rand))
        return name

    def _m(s, name): return s.names[name]

    # -------------------------------------------------- Formen (überschreiben, was dahinter liegt)
    def _put(s, mask, height, name, add=False, basis=None):
        b = s.H if basis is None else basis
        if add:
            s.H[mask] = b[mask] + height[mask]
        else:
            s.H[mask] = height[mask]
        if name is not None:
            s.M[mask] = s._m(name)
            s.F[mask] = 0

    def _grid(s):
        y, x = np.mgrid[0:s.h, 0:s.w]
        return x + 0.5, y + 0.5

    def zylinder(s, x0, y0, x1, y1, name, tiefe=10, z=0, waagerecht=False):
        """Zylinder von der Seite (senkrecht), gewölbt quer zur Achse."""
        X, Y = s._grid()
        m = (X >= x0) & (X <= x1 + 1) & (Y >= y0) & (Y <= y1 + 1)
        if waagerecht:
            u = (Y - (y0 + y1 + 1) / 2) / ((y1 - y0 + 1) / 2)
        else:
            u = (X - (x0 + x1 + 1) / 2) / ((x1 - x0 + 1) / 2)
        hgt = z + tiefe * np.sqrt(np.clip(1 - u * u, 0, 1))
        s._put(m, hgt, name)

    def kasten(s, x0, y0, x1, y1, name, tiefe=6, fase=2, z=0, add=False):
        """Quader von vorn mit abgeschrägten Kanten (fase in px)."""
        X, Y = s._grid()
        m = (X >= x0) & (X <= x1 + 1) & (Y >= y0) & (Y <= y1 + 1)
        d = np.minimum.reduce([X - x0, x1 + 1 - X, Y - y0, y1 + 1 - Y])
        hgt = z + tiefe * np.clip(d / max(fase, 0.01), 0, 1) if fase else np.full_like(X, z + tiefe)
        s._put(m, hgt, name, add=add)

    def kugel(s, cx, cy, rx, ry, name, tiefe=None, z=0):
        X, Y = s._grid()
        u = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
        m = u <= 1
        t = tiefe if tiefe is not None else min(rx, ry)
        s._put(m, z + t * np.sqrt(np.clip(1 - u, 0, 1)), name)

    def scheibe(s, cx, cy, r, name, tiefe=4, fase=2, z=0, maske=None):
        """Flache runde Scheibe (Zahnrad, Ventilrad, Deckel) mit Fase; maske(X, Y) optional (Zähne, Löcher)."""
        X, Y = s._grid()
        d = np.hypot(X - cx, Y - cy)
        m = d <= r if maske is None else maske(X, Y)
        edge = r - d if maske is None else _abstand(m, fase + 1)
        hgt = z + tiefe * np.clip(edge / max(fase, 0.01), 0, 1)
        s._put(m, hgt, name)

    def ring(s, cx, cy, r0, r1, name, tiefe=3, z=0):
        X, Y = s._grid()
        d = np.hypot(X - cx, Y - cy)
        m = (d >= r0) & (d <= r1)
        mid, half = (r0 + r1) / 2, max((r1 - r0) / 2, 0.5)
        s._put(m, z + tiefe * np.sqrt(np.clip(1 - ((d - mid) / half) ** 2, 0, 1)), name)

    def linie(s, x0, y0, x1, y1, name, dicke=2, tiefe=2, z=0):
        """Runder Stab (Rohr, Kabel, Speiche, Griff)."""
        X, Y = s._grid()
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy or 1e-6
        t = np.clip(((X - x0 - .5) * vx + (Y - y0 - .5) * vy) / L2, 0, 1)
        d = np.hypot(X - .5 - (x0 + t * vx), Y - .5 - (y0 + t * vy))
        r = dicke / 2
        m = d <= r
        s._put(m, z + tiefe * np.sqrt(np.clip(1 - (d / max(r, .5)) ** 2, 0, 1)), name)

    def niete(s, x, y, name, r=1.4, tiefe=1.5):
        X, Y = s._grid()
        d = np.hypot(X - x - .5, Y - y - .5)
        m = (d <= r) & (s.M >= 0)
        s._put(m, tiefe * np.sqrt(np.clip(1 - (d / r) ** 2, 0, 1)), name, add=True)

    def rille(s, x0, y0, x1, y1, tiefe=2, breite=1):
        """Fuge/Sicke/Spalt: drückt die Höhe entlang einer Linie ein (Material bleibt)."""
        X, Y = s._grid()
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy or 1e-6
        t = np.clip(((X - x0 - .5) * vx + (Y - y0 - .5) * vy) / L2, 0, 1)
        d = np.hypot(X - .5 - (x0 + t * vx), Y - .5 - (y0 + t * vy))
        m = (d <= breite / 2 + .2) & (s.M >= 0)
        s.H[m] -= tiefe

    def wulst(s, x0, y0, x1, y1, hoehe=1.5, breite=2):
        """Erhabene Kante (Bördelrand, Schweißnaht)."""
        X, Y = s._grid()
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy or 1e-6
        t = np.clip(((X - x0 - .5) * vx + (Y - y0 - .5) * vy) / L2, 0, 1)
        d = np.hypot(X - .5 - (x0 + t * vx), Y - .5 - (y0 + t * vy))
        r = breite / 2 + .2
        m = (d <= r) & (s.M >= 0)
        s.H[m] += hoehe * np.sqrt(np.clip(1 - (d[m] / r) ** 2, 0, 1))

    def farbe(s, maske_fn, name):
        """Material in einem Bereich wechseln, Höhe bleibt (Lackstreifen, Etikett, Rostfleck)."""
        X, Y = s._grid()
        m = maske_fn(X, Y) & (s.M >= 0)
        s.M[m] = s._m(name)

    def fest(s, x, y, col):
        """Einzelpixel mit fester Farbe (Lampe, Glanzpunkt, Kreide) – wird nicht beleuchtet."""
        if 0 <= x < s.w and 0 <= y < s.h:
            s.fix.append(col); s.F[y, x] = len(s.fix) - 1
            if s.M[y, x] < 0: s.M[y, x] = 0

    def struktur(s, name, staerke=None, korn=2, seed=1):
        """Oberflächenrelief (Rost, Gussnarben, Stoff): wird mitbeleuchtet, wirkt dadurch als Material statt als Rauschen."""
        i = s._m(name)
        a = s.mats[i]["rau"] if staerke is None else staerke
        n = np.array([[_hash(x // korn, y // korn, seed) for x in range(s.w)] for y in range(s.h)])
        n = _blur(n, 1) - 0.5
        m = s.M == i
        s.H[m] += n[m] * a * 3

    # -------------------------------------------------- Licht
    def render(s, umriss="#060608", ao=1.0, schatten=0.55, umgebung=0.18, alter=0.0, dither=False,
               rost=("#221c1a", "#3b1725", "#71413b", "#bb7547"), dreck=("#221c1a", "#322b28", "#423934", "#5a4e44")):
        """alter 0–1: Abnutzung – Rost/Dreck in Fugen, Ecken und am Fuß, helle Schrammen an Lichtkanten.
        dither: schmale Dither-Zone an Stufengrenzen (Standard aus: ruhigere Flächen)."""
        H, M = s.H, s.M
        inside = M >= 0
        Hp = np.where(inside, H, np.nan)
        # Normalen (am Rand: Höhe außen = 0 → Rand kippt nach außen, wirkt rund)
        Hz = np.where(inside, H, 0.0)
        gx = (np.roll(Hz, -1, 1) - np.roll(Hz, 1, 1)) / 2
        gy = (np.roll(Hz, -1, 0) - np.roll(Hz, 1, 0)) / 2
        n = np.stack([-gx, -gy, np.ones_like(H)], -1)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        L = s.licht
        diff = np.clip((n * L).sum(-1), 0, 1)
        # Glanz (Blinn): Halbvektor zwischen Licht und Blick (0,0,1)
        hv = L + np.array([0, 0, 1.0]); hv /= np.linalg.norm(hv)
        nh = np.clip((n * hv).sum(-1), 0, 1)
        # Umgebungsschatten: tiefer als die Umgebung → dunkler
        occ = np.clip((Hz - _blur(Hz, 3)) * 0.12 * ao + 1, 0.55, 1.15)
        # Schlagschatten innerhalb des Objekts: Richtung Licht marschieren
        sh = np.ones_like(H)
        dx, dy, dz = -L[0], -L[1], L[2] / math.hypot(L[0], L[1])
        for y in range(s.h):
            for x in range(s.w):
                if not inside[y, x]: continue
                for t in range(1, 12):
                    xx, yy = int(round(x + dx / math.hypot(dx, dy) * t)), int(round(y + dy / math.hypot(dx, dy) * t))
                    if not (0 <= xx < s.w and 0 <= yy < s.h): break
                    if inside[yy, xx] and Hz[yy, xx] > H[y, x] + t * dz * 0.9 + 0.6:
                        sh[y, x] = schatten; break
        out = [[None] * s.w for _ in range(s.h)]
        wear = np.zeros_like(H); chip = np.zeros(H.shape, bool)
        if alter:
            nz = np.array([[_hash(x // 2, y // 2, 77) for x in range(s.w)] for y in range(s.h)])
            nz = _blur(nz, 1)
            cav = np.clip((_blur(Hz, 2) - Hz) * 0.5, 0, 1)                  # Fugen, Ecken
            fuss = np.zeros_like(H)
            for x in range(s.w):                                            # unterste 4 Pixel je Spalte
                ys = np.where(inside[:, x])[0]
                if len(ys): fuss[max(ys[-1] - 3, 0):ys[-1] + 1, x] = np.linspace(0.3, 1, min(4, ys[-1] + 1))
            w = (cav * 1.6 + fuss * 0.8) * alter
            wear = np.where(inside & (w > 0.25 + nz * 0.6), 1, 0)
            for y in range(1, s.h):                                         # Schrammen: Lichtkante oben/links
                for x in range(1, s.w):
                    if inside[y, x] and (not inside[y - 1, x] or not inside[y, x - 1]) and _hash(x, y, 91) < 0.35 * alter:
                        chip[y, x] = True
        for y in range(s.h):
            for x in range(s.w):
                if not inside[y, x]: continue
                if s.F[y, x]:
                    out[y][x] = s.fix[int(s.F[y, x])]; continue
                mt = s.mats[M[y, x]]
                v = umgebung + (1 - umgebung) * diff[y, x] * sh[y, x]
                v *= occ[y, x]
                v += mt["glanz"] * (nh[y, x] ** mt["hart"]) * sh[y, x] * 1.2
                if mt["rand"] and n[y, x, 0] > 0.35:              # Randlicht rechts (Gegenlicht)
                    v += mt["rand"] * (n[y, x, 0] - 0.35)
                R = mt["rampe"]; k = len(R) - 1
                f = np.clip(v, 0, 1) * k
                i = int(f); fr = f - i
                if dither and 0.35 < fr < 0.65 and fr > BAYER[y % 4, x % 4] * 0.3 + 0.35:
                    i += 1
                elif fr >= 0.5 + (0.15 if dither else 0):
                    i += 1
                i = min(k, max(0, i))
                if alter:
                    wl = wear[y, x]
                    if wl > 0:                                        # Rost (Metall) bzw. Dreck in Fugen und am Fuß
                        W = rost if mt["glanz"] >= 0.3 else dreck
                        j = min(len(W) - 1, max(0, int(round(i / max(k, 1) * (len(W) - 1)))))
                        out[y][x] = W[j]; continue
                    if chip[y, x]:                                    # Schramme: hellste Stufe an der Lichtkante
                        i = k
                out[y][x] = R[i]
        if umriss:
            res = [row[:] for row in out]
            for y in range(s.h):
                for x in range(s.w):
                    if out[y][x] is None and any(0 <= x + a < s.w and 0 <= y + b < s.h and out[y + b][x + a] is not None
                                                 for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        res[y][x] = umriss
            out = res
        s.bild = out
        return out

    def nach_c(s, c, dx=0, dy=0):
        b = getattr(s, "bild", None) or s.render()
        for y in range(s.h):
            for x in range(s.w):
                if b[y][x]: c.set(x + dx, y + dy, b[y][x])
        return c

    def png(s, pfad, scale=1, bg=None):
        from PIL import Image
        b = getattr(s, "bild", None) or s.render()
        im = Image.new("RGBA", (s.w, s.h), bg or (0, 0, 0, 0))
        for y in range(s.h):
            for x in range(s.w):
                if b[y][x]: im.putpixel((x, y), tuple(int(b[y][x][i:i + 2], 16) for i in (1, 3, 5)) + (255,))
        if scale > 1: im = im.resize((s.w * scale, s.h * scale), Image.NEAREST)
        im.save(pfad)
        return im
