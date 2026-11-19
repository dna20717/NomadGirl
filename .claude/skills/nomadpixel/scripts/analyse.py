#!/usr/bin/env python3
"""analyse.py – Stil aus bestehenden Grafiken messen und prüfen (NomadPixel).

  rampen  --ref A.png [--ref B.png ...] [--png rampen.png] [--stil stil.json]
          Misst, welche Farbstufen die Referenzen fürs Schattieren benutzen: Ketten dunkel → hell aus
          benachbarten Pixeln (inkl. Farbverschiebung), benannt nach Farbfamilie. Mit --stil werden sie
          als "rampen" in die Stilbibel geschrieben, mit --png als Farbtafel gezeigt.
  bibliothek ORDNER [--out uebersicht.png]
          Übersichtsbogen aller Bausteine (.pix: part/icon/tile) eines Bibliotheks-Ordners mit Namen,
          dazu eine Liste „datei: baustein (BxH)“ zum Nachschlagen.
  profil  NAME --ref PFAD[:BxH] [--ref …] --stil stil.json
          Misst ein Stil-Profil einer Kategorie (z. B. symbole, figuren, kacheln) aus Referenzen
          (bei Rastern/Streifen die Feld- bzw. Framegröße angeben) und speichert es in der Stilbibel.
  pruefe  DATEI(.pix|.png[:BxH]) --profil NAME --stil stil.json
          Vergleicht eine Grafik mit dem Profil: Helligkeit, Lichter/Schatten, Stufensprung (wie fein
          schattiert), Sättigung, Einzelpixel, Farben – mit konkreten Hinweisen.
  grau    DATEI.pix [--scale 6] [--out grau.png]
          Helligkeits-Check: jede Grafik farbig | in Graustufen | 1:1, dazu Kontrastwerte. Eine gute
          Grafik ist auch ohne Farbe lesbar.
"""
import argparse, json, math, os, sys
from collections import Counter, defaultdict
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def lab(c):
    a = np.asarray(c, dtype=float) / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    x, y, z = a @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    x, z = x / 0.95047, z / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


FAMILIEN = [(345, 360, "rot"), (0, 45, "rot"), (45, 75, "orange"), (75, 105, "gelb"), (105, 165, "gruen"),
            (165, 230, "tuerkis"), (230, 300, "blau"), (300, 345, "violett")]


def familie(c):
    L, A, B = lab(c)
    chroma = math.hypot(A, B)
    h = math.degrees(math.atan2(B, A)) % 360
    if chroma < 12:
        return "stahl" if 180 <= h < 330 else "sand" if 30 <= h < 120 else "grau"
    name = next(n for lo, hi, n in FAMILIEN if lo <= h < hi)
    if chroma < 26 and 35 <= h < 115:
        return "sand"        # Holz, Stoff, Pappe, Rost-Beige
    if chroma < 24 and 200 <= h < 320:
        return "stahl"       # Metall, Kunststoff, Beton
    if name in ("orange", "rot") and L < 50 and chroma < 40:
        return "braun"
    if name in ("orange", "rot") and chroma < 45:
        return "haut"        # Fleisch, Haut, Leder
    return name


def hexc(c):
    return "#%02x%02x%02x" % tuple(c[:3])


def rampen(refs, min_anteil=0.001):
    freq, pairs, total = Counter(), Counter(), 0
    edge_cols = Counter()
    for path in refs:
        a = np.asarray(Image.open(path).convert("RGBA"))
        op = a[..., 3] > 0
        rgb = [[tuple(int(v) for v in a[y, x, :3]) for x in range(a.shape[1])] for y in range(a.shape[0])]
        H, W = op.shape
        for y in range(H):
            for x in range(W):
                if not op[y, x]:
                    continue
                c = rgb[y][x]
                freq[c] += 1
                total += 1
                if any(not (0 <= y + dy < H and 0 <= x + dx < W) or not op[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge_cols[c] += 1
                for dx, dy in ((1, 0), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < W and ny < H and op[ny, nx]:
                        d = rgb[ny][nx]
                        if d != c:
                            lo, hi = (c, d) if lum(c) < lum(d) else (d, c)
                            if lum(hi) - lum(lo) > 4:
                                pairs[(lo, hi)] += 1
    outline = edge_cols.most_common(1)[0][0] if edge_cols else None
    keep = {c for c, n in freq.items() if n >= max(12, total * min_anteil) and c != outline}
    lighter = {}
    for c in keep:
        cand = [(n, d) for (lo, d), n in pairs.items() if lo == c and d in keep]
        if not cand:
            continue
        tot = sum(n for n, _ in cand)
        n, d = max(cand)
        if n >= max(4, 0.12 * tot):
            lighter[c] = d
    incoming = set(lighter.values())
    ketten = []
    for start in keep:
        if start in incoming or start not in lighter:
            continue
        k = [start]
        while k[-1] in lighter and lighter[k[-1]] not in k and len(k) < 8:
            k.append(lighter[k[-1]])
        if len(k) >= 3:
            ketten.append(k)
    # Teilketten weglassen, nach Gewicht sortieren, je Familie höchstens 3
    ketten.sort(key=lambda k: -sum(freq[c] for c in k))
    out, seen = [], []
    per = Counter()
    for k in ketten:
        fam = familie(k[len(k) // 3])   # Grundton der Kette, nicht die hellen Lichter
        core = set(k[:max(2, len(k) - 3)])   # ohne die hellen Lichter, die sich viele Materialien teilen
        if any(set(k) <= set(s) or len(core & set(s[:max(2, len(s) - 3)])) >= 0.5 * len(core) for s, f in seen):
            continue   # Teilkette oder fast dieselbe Kette (gleicher Grundton)

        if per[fam] >= 3:
            continue
        per[fam] += 1
        seen.append((k, fam))
        out.append({"name": f"{fam}-{per[fam]}", "familie": fam, "farben": [hexc(c) for c in k],
                    "anteil": round(sum(freq[c] for c in k) / total, 3)})
    return {"outline": hexc(outline) if outline else None, "rampen": out,
            "farben_gesamt": len(freq), "quellen": [os.path.basename(r) for r in refs]}


def tafel(res, path):
    rows = res["rampen"]
    s, w = 28, 120
    img = Image.new("RGB", (w + 8 * s + 90, max(1, len(rows)) * (s + 6) + 10), (30, 30, 38))
    d = ImageDraw.Draw(img)
    for i, r in enumerate(rows):
        y = 6 + i * (s + 6)
        d.text((6, y + 8), r["name"], fill=(220, 220, 230))
        for j, h in enumerate(r["farben"]):
            c = tuple(int(h[k:k + 2], 16) for k in (1, 3, 5))
            d.rectangle([w + j * s, y, w + j * s + s - 2, y + s - 1], fill=c)
        d.text((w + 8 * s + 6, y + 8), f"{r['anteil'] * 100:.1f} %", fill=(160, 160, 175))
    img.save(path)


def grau(pixfile, scale, out):
    from pixelart import Pix, up
    p = Pix.load(pixfile)
    elems = [e for e in p.elems if e.kind in ("icon", "tile", "frame")] or [e for e in p.elems if e.kind != "map"]
    cells, lines = [], []
    for e in elems:
        im = p.image(e)
        a = np.asarray(im)
        op = a[..., 3] > 0
        L = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])
        inner = L[op]
        spread = float(np.percentile(inner, 90) - np.percentile(inner, 10)) if inner.size else 0
        stufen = len(np.unique((inner // 16).astype(int))) if inner.size else 0
        hint = []
        if spread < 70:
            hint.append("wenig Helligkeitskontrast -> Licht/Schatten verstärken")
        if stufen < 5:
            hint.append("wenige Helligkeitsstufen")
        lines.append(f"{e.name:<16} Kontrast {spread:5.0f}  Stufen {stufen:2d}  {'; '.join(hint) or 'ok'}")
        g = Image.fromarray(np.dstack([L, L, L, a[..., 3]]).astype("uint8"), "RGBA")
        cells.append((e.name, im, g))
    w, h = cells[0][1].size
    W = w * scale * 2 + w + 40
    sheet = Image.new("RGBA", (W, len(cells) * (h * scale + 20) + 10), (36, 34, 52, 255))
    d = ImageDraw.Draw(sheet)
    for i, (n, im, g) in enumerate(cells):
        y = 10 + i * (h * scale + 20)
        sheet.alpha_composite(up(im, scale), (10, y))
        sheet.alpha_composite(up(g, scale), (20 + w * scale, y))
        sheet.alpha_composite(im, (30 + 2 * w * scale, y))
        d.text((10, y + h * scale + 2), n, fill=(200, 200, 210))
    sheet.save(out)
    return "\n".join(lines)


def bibliothek(ordner, out):
    from pixelart import Pix, up
    items = []
    for f in sorted(os.listdir(ordner)):
        if not f.endswith(".pix"):
            continue
        p = Pix.load(os.path.join(ordner, f))
        for e in p.elems:
            if e.kind in ("part", "icon", "tile"):
                items.append((f, e.name, p.image(e)))
    if not items:
        return "Bibliothek ist leer."
    S, cols = 3, 6
    cw = max(max(i.width for *_, i in items) * S, 110)
    ch = max(i.height for *_, i in items) * S + 30
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * (cw + 10) + 10, rows * (ch + 10) + 10), (36, 34, 52, 255))
    d = ImageDraw.Draw(sheet)
    lines = []
    for i, (f, n, im) in enumerate(items):
        x, y = 10 + (i % cols) * (cw + 10), 10 + (i // cols) * (ch + 10)
        sheet.alpha_composite(up(im, S), (x, y))
        d.text((x, y + im.height * S + 4), n[:18], fill=(210, 210, 220))
        lines.append(f"{f}: {n} ({im.width}x{im.height})")
    sheet.save(out)
    return "\n".join(lines)


# ---------------------------------------------------------------- Stil-Profile
from collections import deque


def kennzahlen(im):
    a = np.asarray(im.convert("RGBA")).astype(float)
    op = a[..., 3] > 0
    pad = np.pad(op, 1)
    edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    inner = op & ~edge
    if inner.sum() < 10:
        return None
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    v = L[inner]
    dh = np.abs(L[:, 1:] - L[:, :-1])[inner[:, 1:] & inner[:, :-1]]
    dv = np.abs(L[1:, :] - L[:-1, :])[inner[1:, :] & inner[:-1, :]]
    d = np.concatenate([dh, dv]); d = d[d > 0]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    sat = ((mx - mn) / np.maximum(mx, 1))[inner]
    key = (a[..., 0].astype(int) << 16) | (a[..., 1].astype(int) << 8) | a[..., 2].astype(int)
    seen = np.zeros_like(inner); sizes = []
    H, W = inner.shape
    for y in range(H):
        for x in range(W):
            if inner[y, x] and not seen[y, x]:
                k = key[y, x]; q = deque([(y, x)]); seen[y, x] = True; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and inner[ny, nx] and not seen[ny, nx] and key[ny, nx] == k:
                            seen[ny, nx] = True; q.append((ny, nx))
                sizes.append(n)
    s_ = np.array(sizes)
    return {"helligkeit": float(np.median(v)), "schatten": float(np.percentile(v, 10)), "licht": float(np.percentile(v, 90)),
            "stufensprung": float(np.median(d)) if d.size else 0.0, "saettigung": float(np.median(sat)),
            "einzelpixel": float((s_ == 1).sum() / s_.sum()), "farben": int(len(np.unique(key[op])))}


def zellen(spec):
    path, _, size = spec.partition(":")
    im = Image.open(path).convert("RGBA")
    if not size:
        return [im]
    cw, ch = (int(v) for v in size.lower().split("x"))
    out = []
    for y in range(0, im.height - ch + 1, ch):
        for x in range(0, im.width - cw + 1, cw):
            c = im.crop((x, y, x + cw, y + ch))
            if (np.asarray(c)[..., 3] > 0).sum() > 30:
                out.append(c)
    return out


TEXTE = {"helligkeit": ("zu dunkel", "zu hell", "Grundtöne eine bis zwei Rampenstufen {r}"),
         "schatten": ("Schatten zu tief", "Schatten zu flach", "dunkelste Stufen {r}"),
         "licht": ("Lichter zu schwach", "Lichter zu grell", "hellste Stufen {r}"),
         "stufensprung": ("Schattierung feiner als üblich", "Schattierung zu grob", "{r}"),
         "saettigung": ("zu grau", "zu bunt", "Farben {r}"),
         "einzelpixel": ("sehr glatt", "zu viel Pixelrauschen", "{r}"),
         "farben": ("zu wenige Farbstufen", "zu viele Farben", "{r}")}
RAT = {("helligkeit", 0): "heller wählen", ("helligkeit", 1): "dunkler wählen", ("schatten", 0): "anheben", ("schatten", 1): "tiefer ziehen",
       ("licht", 0): "kräftiger setzen", ("licht", 1): "zurücknehmen", ("stufensprung", 0): "ruhig so lassen oder Kontrast erhöhen",
       ("stufensprung", 1): "mehr Zwischenstufen (feine Rampe, zeichnen.rampe_fein) oder sanfteres Dithering",
       ("saettigung", 0): "kräftiger", ("saettigung", 1): "entsättigter (Rampen der Referenz nehmen)", ("einzelpixel", 0): "Struktur ergänzen",
       ("einzelpixel", 1): "Einzelpixel zu Clustern zusammenfassen, Flächen beruhigen", ("farben", 0): "mehr Zwischentöne", ("farben", 1): "Farben zusammenlegen"}


def profil(refs):
    K = [k for spec in refs for c in zellen(spec) if (k := kennzahlen(c))]
    out = {"anzahl": len(K), "quellen": [os.path.basename(r.split(":")[0]) for r in refs]}
    for m in TEXTE:
        vals = np.array([k[m] for k in K], dtype=float)
        out[m] = [round(float(np.percentile(vals, 25)), 3), round(float(np.median(vals)), 3), round(float(np.percentile(vals, 75)), 3)]
    return out


def pruefe(spec, prof):
    if spec.endswith(".pix"):
        from pixelart import Pix
        p = Pix.load(spec)
        items = [(e.name, p.image(e)) for e in p.elems if e.kind in ("icon", "tile", "frame", "part")]
    else:
        items = [(f"{os.path.basename(spec)}#{i}", c) for i, c in enumerate(zellen(spec))]
    lines, schlecht = [], 0
    for name, im in items:
        k = kennzahlen(im)
        if not k:
            continue
        hints = []
        for m, (lo_t, hi_t, _) in TEXTE.items():
            q1, med, q3 = prof[m]
            spanne = max(q3 - q1, abs(med) * 0.15, 1e-6)
            if k[m] < q1 - 0.5 * spanne:
                hints.append(f"{lo_t} ({k[m]:.2f} statt ~{med:.2f}) → {RAT[(m, 0)]}")
            elif k[m] > q3 + 0.5 * spanne:
                hints.append(f"{hi_t} ({k[m]:.2f} statt ~{med:.2f}) → {RAT[(m, 1)]}")
        schlecht += bool(hints)
        lines.append(f"{name}: " + ("passt zum Profil" if not hints else "\n   - " + "\n   - ".join(hints)))
    lines.append(f"\n{len(items) - schlecht} von {len(items)} passen zum Profil.")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd")
    ap.add_argument("datei", nargs="?")
    ap.add_argument("--ref", action="append", default=[])
    ap.add_argument("--png")
    ap.add_argument("--stil")
    ap.add_argument("--scale", type=int, default=6)
    ap.add_argument("--out")
    ap.add_argument("--profil")
    a = ap.parse_args()
    if a.cmd == "rampen":
        if not a.ref:
            sys.exit("rampen braucht mindestens ein --ref RASTER.png")
        res = rampen(a.ref)
        if a.png:
            tafel(res, a.png)
        if a.stil:
            d = json.load(open(a.stil, encoding="utf-8")) if os.path.exists(a.stil) else {}
            d["rampen"] = res["rampen"]
            d["outlineFarbe"] = res["outline"]
            json.dump(d, open(a.stil, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(json.dumps(res, ensure_ascii=False, indent=1))
    elif a.cmd == "profil":
        if not (a.datei and a.ref and a.stil):
            sys.exit("profil NAME --ref PFAD[:BxH] … --stil stil.json")
        pr = profil(a.ref)
        d = json.load(open(a.stil, encoding="utf-8")) if os.path.exists(a.stil) else {}
        d.setdefault("profile", {})[a.datei] = pr
        json.dump(d, open(a.stil, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(json.dumps(pr, ensure_ascii=False, indent=1))
    elif a.cmd == "pruefe":
        if not (a.datei and a.profil and a.stil):
            sys.exit("pruefe DATEI --profil NAME --stil stil.json")
        prof = json.load(open(a.stil, encoding="utf-8")).get("profile", {}).get(a.profil)
        if not prof:
            sys.exit(f"Profil '{a.profil}' fehlt in {a.stil} (erst: analyse.py profil {a.profil} --ref … --stil …)")
        print(pruefe(a.datei, prof))
    elif a.cmd == "bibliothek":
        out = a.out or os.path.join(a.datei, "uebersicht.png")
        print(bibliothek(a.datei, out))
        print(out)
    elif a.cmd == "grau":
        out = a.out or os.path.splitext(a.datei)[0] + "_grau.png"
        print(grau(a.datei, a.scale, out))
        print(out)
    else:
        sys.exit(f"Unbekannter Befehl: {a.cmd}")


if __name__ == "__main__":
    main()
