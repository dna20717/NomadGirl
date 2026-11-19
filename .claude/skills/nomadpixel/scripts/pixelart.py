#!/usr/bin/env python3
"""pixelart.py v2 - Pixel-Art als Text zeichnen, rendern und pruefen.
Tilesets, Charakter-Animationen und Foto -> Pixel-Art.

FORMAT (.pix) - Abschnitte:
  [meta]            name, fps, fps_<anim>, bg, size = 16x24, tile = 16, palette = <preset>, mirror = x
  [palette]         <zeichen> = #rrggbb | #rrggbbaa | transparent      (Kommentare: ' # text')
  [part NAME]       wiederverwendbares Teil (Kopf, Arm, ...), Raster
  [frame NAME]      Animations-Frame. Name 'walk1'/'walk_1' -> Animation 'walk'
  [tile NAME]       Tile eines Tilesets
  [icon NAME]       Grafik eines Themen-Sets (Groesse ueber 'icon = 32' in [meta])
  [map NAME]        Kartenvorschau: 'X = tilename' Legenden-Zeilen + Raster (1 Zeichen = 1 Tile, '.' = leer)

  In part/frame/tile: Rasterzeilen (1 Zeichen = 1 Pixel) und/oder Platzierungen:
      @ NAME x y [fx] [fy]      setzt Part/Frame/Tile NAME bei (x,y), optional gespiegelt
  Raster wird zuerst gezeichnet, Platzierungen danach in Reihenfolge obendrauf.
  Header-Flags: [frame idle1 mirror] spiegelt die Rasterzeilen (linke Haelfte -> voll),
                [part kopf mirror_odd] spiegelt ohne Mittelspalte zu doppeln.

BEFEHLE (Ansicht: grosse Skalierung / Export: --scale 1 fuer Engines):
  check    F                         Validierung
  preview  F [--name N]              Raster + Schachbrett + 1:1  -> zum Ansehen
  render   F [--name N] [--scale 12]
  gif      F [--anim A] [--scale 8]  ohne --anim: ein GIF pro Animation
  onion    F --anim A [--scale 12]   Frames mit Vorher(rot)/Nachher(blau)-Geist
  sheet    F [--anim A] [--scale 1]  Spritesheet (Zeile pro Animation) + .json
  tileset  F [--cols 8] [--scale 1]  alle Tiles als Sheet + .json
  tilecheck F [--name N] [--scale 6] Tiles 3x3 gekachelt -> Naehte pruefen
  map      F [--name M] [--scale 4]  Kartenvorschau aus Tiles
  iconset  F [--cols 4] [--scale 1] [--split DIR]   Set als Raster-Sheet + .json, optional Einzel-PNGs
  contact  F [--cols 4] [--scale 4]  Pruefbogen: jedes Icon auf dunklem + hellem Grund mit Namen
  setcheck F                         Stil-Konsistenz: Groesse, Rand, Farben, Outline, Helligkeit
  refcheck F --ref RASTER.png [--cell 32]   Detaildichte/Farben im Vergleich zu Referenz-Icons
  palcheck F --pal-file PALETTE(.hex|.png|.json) | --palette "#hex,.."   alle Farben aus der Projektpalette?
  autotile F --fill T --base T --edge C [--inner C] [--shadow C] [--border 2] [--radius 3] [--wobble] [--blob]
                                     16 Rand-Tiles (N=1 E=2 S=4 W=8) oder mit --blob 47 Tiles inkl.
                                     Innenecken (N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128) + Demo-Map
  outline  F --char C [--name N] [--diagonal]
  fromimg  BILD --width 48 [--colors 12 | --palette pico8 | --palette "#hex,#hex,.." | --palette-from F.pix]
           [--removebg] [--tol 12] [--contrast 1.1] [--saturation 1.2] [--cleanup 1]
           [--outline auto|#hex] [--dither] [--simplify 0-3]
  palettes
"""
import argparse, json, os, re, sys
from collections import Counter, deque
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

PRESETS = {
    "pico8": ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f",
              "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436",
              "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
    "sweetie16": ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070",
                  "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7",
                  "#f4f4f4", "#94b0c2", "#566c86", "#333c57"],
    "endesga16": ["#e4a672", "#b86f50", "#743f39", "#3f2832", "#9e2835", "#e53b44",
                  "#fb922b", "#ffe762", "#63c64d", "#327345", "#193d3f", "#4f6781",
                  "#afbfd2", "#ffffff", "#2ce8f4", "#0484d1"],
    "gameboy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
}
CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
RASTER = ("part", "frame", "tile", "icon", "map")
TRANSPARENT = (0, 0, 0, 0)


def die(msg):
    sys.exit("FEHLER: " + msg)


def hex2rgba(h):
    h = h.strip().lstrip("#")
    if len(h) == 6:
        h += "ff"
    if len(h) != 8:
        die(f"Ungueltige Farbe: #{h}")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4, 6))


def rgba2hex(c):
    return "#%02x%02x%02x" % c[:3] + ("" if len(c) < 4 or c[3] == 255 else "%02x" % c[3])


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


# ----------------------------------------------------------------------------- Datei
class Elem:
    def __init__(self, kind, name, flags):
        self.kind, self.name, self.flags = kind, name, flags
        self.rows, self.places, self.legend = [], [], {}


class Pix:
    def __init__(self):
        self.meta, self.palette, self.elems = {}, {}, []
        self._cache = {}

    @classmethod
    def load(cls, path):
        p, section, cur = cls(), None, None
        for ln, raw in enumerate(open(path, encoding="utf-8"), 1):
            s = raw.strip()
            m = re.match(r"^\[(\w+)\s*(.*?)\]$", s)
            if m:
                section = m.group(1).lower()
                if section not in ("meta", "palette") + RASTER:
                    die(f"Zeile {ln}: unbekannter Abschnitt [{section}]")
                if section in RASTER:
                    words = m.group(2).split()
                    name = words[0] if words else f"{section}{len(p.of(section))}"
                    cur = Elem(section, name, set(words[1:]))
                    p.elems.append(cur)
                continue
            if not s or s.startswith("#"):
                continue
            if section in RASTER:
                if s.startswith("@"):
                    t = s[1:].split()
                    if len(t) < 3:
                        die(f"Zeile {ln}: '@ NAME x y [fx] [fy]' erwartet")
                    cur.places.append((t[0], int(t[1]), int(t[2]), set(t[3:]), ln))
                elif section == "map" and "=" in s:
                    k, v = (x.strip() for x in s.split("=", 1))
                    cur.legend[k] = v
                else:
                    cur.rows.append(s.split()[0])
                continue
            line = re.sub(r"\s+#\s.*$", "", s)
            if "=" not in line:
                die(f"Zeile {ln}: erwartet 'schluessel = wert'")
            k, v = (x.strip() for x in line.split("=", 1))
            if section == "meta":
                p.meta[k] = v
            elif section == "palette":
                if len(k) != 1 or k in "#@":
                    die(f"Zeile {ln}: Palettenzeichen muss 1 Zeichen sein, nicht # oder @ ('{k}')")
                p.palette[k] = TRANSPARENT if v.lower() in ("transparent", "none") else hex2rgba(v)
        if "palette" in p.meta:
            for c, h in zip(CHARS, PRESETS[p.meta["palette"]]):
                p.palette.setdefault(c, hex2rgba(h))
        p.palette.setdefault(".", TRANSPARENT)
        gm = p.meta.get("mirror")
        for e in p.elems:
            if e.kind == "map":
                continue
            if "mirror_odd" in e.flags or (gm == "x_odd" and "nomirror" not in e.flags):
                e.rows = [r + r[:-1][::-1] for r in e.rows]
            elif "mirror" in e.flags or (gm == "x" and "nomirror" not in e.flags):
                e.rows = [r + r[::-1] for r in e.rows]
        return p

    def of(self, kind):
        return [e for e in self.elems if e.kind == kind]

    def find(self, name, kinds=("part", "frame", "tile", "icon")):
        for k in kinds:
            for e in self.elems:
                if e.kind == k and e.name == name:
                    return e
        return None

    def size_for(self, kind):
        key = kind if kind in ("tile", "icon") else "size"
        v = self.meta.get(key)
        if not v:
            return None
        if "x" in v:
            w, h = v.lower().split("x")
            return int(w), int(h)
        return int(v), int(v)

    def anims(self):
        out = {}
        for e in self.of("frame"):
            m = re.match(r"^(.*?)[_-]?(\d+)$", e.name)
            out.setdefault(m.group(1) if m and m.group(1) else e.name, []).append(e)
        return out

    def default_elem(self, name=None):
        if name:
            e = self.find(name, ("frame", "part", "tile", "icon", "map"))
            if not e:
                die(f"'{name}' nicht gefunden")
            return e
        for k in ("frame", "tile", "icon", "part", "map"):
            if self.of(k):
                return self.of(k)[0]
        die("Datei enthaelt keine Grafik")

    # ------------------------------------------------------------------ Rendern
    def image(self, e, depth=0):
        if e.kind == "map":
            return self.map_image(e)
        if (e.kind, e.name) in self._cache:
            return self._cache[(e.kind, e.name)].copy()
        if depth > 30:
            die(f"Endlose Platzierungs-Schleife bei '{e.name}'")
        if e.rows:
            w, h = max(len(r) for r in e.rows), len(e.rows)
        else:
            sz = self.size_for(e.kind)
            if not sz:
                die(f"'{e.name}' hat kein Raster -> 'size' bzw. 'tile' in [meta] setzen")
            w, h = sz
        img = Image.new("RGBA", (w, h), TRANSPARENT)
        px = img.load()
        for y, r in enumerate(e.rows):
            for x, c in enumerate(r):
                px[x, y] = self.palette.get(c, (255, 0, 255, 255))  # pink = Fehler
        for name, x, y, fl, ln in e.places:
            src = self.find(name)
            if not src:
                die(f"'{e.name}': Platzierung '{name}' (Zeile {ln}) existiert nicht")
            im = self.image(src, depth + 1)
            if "fx" in fl:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if "fy" in fl:
                im = im.transpose(Image.FLIP_TOP_BOTTOM)
            paste(img, im, x, y)
        self._cache[(e.kind, e.name)] = img
        return img.copy()

    def map_image(self, e):
        T = self.size_for("tile") or (self.image(self.of("tile")[0]).size if self.of("tile") else (16, 16))
        w, h = max(len(r) for r in e.rows), len(e.rows)
        img = Image.new("RGBA", (w * T[0], h * T[1]), TRANSPARENT)
        for y, r in enumerate(e.rows):
            for x, c in enumerate(r):
                if c == ".":
                    continue
                t = self.find(e.legend.get(c, ""), ("tile",))
                if t:
                    paste(img, self.image(t), x * T[0], y * T[1])
                else:
                    ImageDraw.Draw(img).rectangle([x * T[0], y * T[1], (x + 1) * T[0] - 1, (y + 1) * T[1] - 1], fill=(255, 0, 255, 255))
        return img

    # ------------------------------------------------------------------ Pruefen
    def check(self):
        errs, warns = [], []
        for e in self.elems:
            if e.kind == "map":
                for i, r in enumerate(e.rows):
                    for j, c in enumerate(r):
                        if c != "." and c not in e.legend:
                            errs.append(f"map '{e.name}' ({j},{i}): '{c}' fehlt in der Legende")
                for k, v in e.legend.items():
                    if not self.find(v, ("tile",)):
                        errs.append(f"map '{e.name}': Tile '{v}' existiert nicht")
                continue
            mw = max((len(r) for r in e.rows), default=0)
            for i, r in enumerate(e.rows):
                if len(r) != mw:
                    errs.append(f"{e.kind} '{e.name}' Zeile {i + 1}: Breite {len(r)} statt {mw}")
                for j, c in enumerate(r):
                    if c not in self.palette:
                        errs.append(f"{e.kind} '{e.name}' ({j},{i}): unbekanntes Zeichen '{c}'")
            for name, *_ , ln in e.places:
                if not self.find(name):
                    errs.append(f"{e.kind} '{e.name}': Platzierung '{name}' (Zeile {ln}) existiert nicht")
        if errs:
            return errs, warns
        for a, frames in self.anims().items():
            sizes = {self.image(f).size for f in frames}
            if len(sizes) > 1:
                errs.append(f"Animation '{a}': Frames haben unterschiedliche Groessen {sizes}")
        for kind in ("tile", "icon"):
            T = self.size_for(kind)
            for t in self.of(kind):
                if T and self.image(t).size != T:
                    errs.append(f"{kind} '{t.name}': Groesse {self.image(t).size} statt {T}")
        return errs, warns


def paste(dst, src, x, y):
    """alpha_composite mit Clipping (auch negative Positionen)."""
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    w = min(src.width - sx0, dst.width - dx0)
    h = min(src.height - sy0, dst.height - dy0)
    if w > 0 and h > 0:
        dst.alpha_composite(src.crop((sx0, sy0, sx0 + w, sy0 + h)), (dx0, dy0))


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def checker(w, h, cell, a=(58, 58, 70), b=(72, 72, 86)):
    bg = Image.new("RGBA", (w, h), a + (255,))
    d = ImageDraw.Draw(bg)
    for y in range(0, h, cell):
        for x in range((y // cell % 2) * cell, w, cell * 2):
            d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=b + (255,))
    return bg


def on_checker(img, s):
    big = up(img, s)
    out = checker(big.width, big.height, max(s // 2, 2))
    out.alpha_composite(big)
    return out


def preview(img, s):
    out = on_checker(img, s)
    d = ImageDraw.Draw(out)
    for x in range(0, out.width + 1, s):
        d.line([(x, 0), (x, out.height)], fill=(0, 0, 0, 60) if (x // s) % 8 else (255, 255, 255, 120))
    for y in range(0, out.height + 1, s):
        d.line([(0, y), (out.width, y)], fill=(0, 0, 0, 60) if (y // s) % 8 else (255, 255, 255, 120))
    small = up(img, max(1, s // 6))
    pad = 16
    canvas = Image.new("RGBA", (out.width + small.width + img.width + pad * 4, max(out.height, small.height) + pad * 2), (30, 30, 38, 255))
    canvas.alpha_composite(out, (pad, pad))
    canvas.alpha_composite(small, (out.width + pad * 2, pad))
    canvas.alpha_composite(img, (out.width + small.width + pad * 3, pad))
    return canvas


def strip(images, gap=8, bg=(30, 30, 38, 255), labels=None):
    w = sum(i.width for i in images) + gap * (len(images) + 1)
    h = max(i.height for i in images) + gap * 2 + (14 if labels else 0)
    out = Image.new("RGBA", (w, h), bg)
    d = ImageDraw.Draw(out)
    x = gap
    for n, im in enumerate(images):
        out.alpha_composite(im, (x, gap))
        if labels:
            d.text((x, gap + im.height + 2), labels[n], fill=(200, 200, 210))
        x += im.width + gap
    return out


def tint(img, rgb, alpha):
    a = img.getchannel("A").point(lambda v: int(v * alpha))
    t = Image.new("RGBA", img.size, rgb + (0,))
    t.putalpha(a)
    return t


# ----------------------------------------------------------------------------- Sets
def icon_stats(p, e):
    im = p.image(e)
    W, H = im.size
    a = np.asarray(im)
    op = a[..., 3] > 0
    if not op.any():
        return {"name": e.name, "leer": True}
    ys, xs = np.where(op)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cols = {tuple(c) for c in a[op][:, :3].tolist()}
    # Rand-Pixel der Silhouette (an Transparenz grenzend)
    pad = np.pad(op, 1)
    edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    lums = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    edge_l = lums[edge]
    rgb = a[..., :3].astype(int)
    return {"name": e.name, "leer": False,
            "breite": int(x1 - x0 + 1), "hoehe": int(y1 - y0 + 1),
            "flaeche": float(op.sum()) / (W * H),
            "rand": int(min(x0, y0, W - 1 - x1, H - 1 - y1)),
            "mitte_dx": float((x0 + x1) / 2 - (W - 1) / 2), "mitte_dy": float((y0 + y1) / 2 - (H - 1) / 2),
            "farben": len(cols),
            "outline": float((edge_l < 70).mean()),
            "hell": float(lums[op].mean()),
            "detail": detail_density(rgb, op & ~edge)}


def detail_density(rgb, inner):
    """Anteil der Nachbarpaare im Inneren mit Farbwechsel (0 = flach, ~0.5 = sehr unruhig)."""
    h = (inner[:, 1:] & inner[:, :-1]); v = (inner[1:, :] & inner[:-1, :])
    dh = (rgb[:, 1:] != rgb[:, :-1]).any(-1) & h
    dv = (rgb[1:, :] != rgb[:-1, :]).any(-1) & v
    n = h.sum() + v.sum()
    return float((dh.sum() + dv.sum()) / n) if n else 0.0


def sheet_stats(path, cell):
    """Kennzahlen aller Felder eines Referenz-Rasters (PNG)."""
    im = np.asarray(Image.open(path).convert("RGBA"))
    H, W = im.shape[:2]
    out = []
    for y in range(0, H - cell + 1, cell):
        for x in range(0, W - cell + 1, cell):
            c = im[y:y + cell, x:x + cell]
            op = c[..., 3] > 0
            if op.sum() < 8:
                continue
            pad = np.pad(op, 1)
            edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
            out.append({"flaeche": float(op.mean()), "farben": len({tuple(p) for p in c[op][:, :3].tolist()}),
                        "detail": detail_density(c[..., :3].astype(int), op & ~edge)})
    return out


def load_palette(src):
    """Palette aus .hex (eine Farbe pro Zeile), .png (alle Pixel), .json (Feld 'palette') oder '#hex,#hex'."""
    if not src:
        die("Palette fehlt: --pal-file DATEI oder --palette '#hex,#hex,..'")
    if os.path.exists(src):
        if src.endswith(".png"):
            a = np.asarray(Image.open(src).convert("RGB")).reshape(-1, 3)
            return {tuple(x) for x in a.tolist()}
        if src.endswith(".json"):
            items = json.load(open(src, encoding="utf-8")).get("palette", [])
        else:
            items = open(src, encoding="utf-8").read().split()
    elif src in PRESETS:
        items = PRESETS[src]
    else:
        items = re.split(r"[,\s]+", src)
    return {hex2rgba(h if h.startswith("#") else "#" + h)[:3] for h in items if h.strip()}


def refcheck(p, ref, cell):
    icons = p.of("icon")
    if not icons:
        die("keine [icon ...]-Abschnitte")
    R = sheet_stats(ref, cell)
    if not R:
        die("Referenz enthaelt keine Felder")
    med = lambda L, k: float(np.median([x[k] for x in L]))
    q = lambda L, k, f: float(np.quantile([x[k] for x in L], f))
    lines = [f"Referenz: {os.path.basename(ref)} ({len(R)} Icons)  Detail {med(R, 'detail'):.2f} "
             f"[{q(R, 'detail', .25):.2f}-{q(R, 'detail', .75):.2f}]  Farben {med(R, 'farben'):.0f} "
             f"[{q(R, 'farben', .25):.0f}-{q(R, 'farben', .75):.0f}]  Flaeche {med(R, 'flaeche') * 100:.0f}%",
             f"{'Icon':<16}{'Detail':>8}{'Farben':>8}{'Fl%':>6}  Hinweise"]
    lo_d, hi_d = q(R, "detail", .25), q(R, "detail", .75)
    lo_c = q(R, "farben", .25)
    for e in icons:
        st = icon_stats(p, e)
        if st["leer"]:
            continue
        h = []
        if st["detail"] < lo_d: h.append("zu glatt -> Detail-Runde")
        if st["detail"] > hi_d * 1.25: h.append("unruhig -> Flaechen beruhigen")
        if st["farben"] < lo_c: h.append("wenig Farbstufen")
        lines.append(f"{e.name:<16}{st['detail']:>8.2f}{st['farben']:>8}{st['flaeche'] * 100:>6.0f}  {'; '.join(h) or 'ok'}")
    return "\n".join(lines)


def setcheck(p):
    icons = p.of("icon")
    if not icons:
        die("keine [icon ...]-Abschnitte")
    st = [icon_stats(p, e) for e in icons]
    full = [s for s in st if not s["leer"]]
    med = lambda k: float(np.median([s[k] for s in full])) if full else 0
    mf, mc, mh, mo = med("flaeche"), med("farben"), med("hell"), med("outline")
    minpad = int(p.meta.get("pad", 1))
    lines = [f"{'Icon':<16}{'BxH':>7}{'Fl%':>6}{'Rand':>5}{'Farb':>5}{'Outl':>6}{'Hell':>6}  Hinweise"]
    warn = 0
    for s in st:
        if s["leer"]:
            lines.append(f"{s['name']:<16}  LEER"); warn += 1; continue
        h = []
        if s["flaeche"] < mf * 0.6: h.append("deutlich kleiner als der Rest")
        if s["flaeche"] > mf * 1.6: h.append("deutlich groesser als der Rest")
        if s["rand"] < minpad: h.append(f"Rand < {minpad}px")
        if abs(s["mitte_dx"]) > 2 or abs(s["mitte_dy"]) > 2: h.append(f"nicht zentriert ({s['mitte_dx']:+.0f},{s['mitte_dy']:+.0f})")
        if s["farben"] > mc + 4: h.append("viele Farben")
        if mo > 0.7 and s["outline"] < 0.5: h.append("Outline fehlt/luckenhaft")
        if abs(s["hell"] - mh) > 45: h.append("Helligkeit weicht ab")
        warn += bool(h)
        lines.append(f"{s['name']:<16}{s['breite']:>3}x{s['hoehe']:<3}{s['flaeche'] * 100:>6.0f}{s['rand']:>5}{s['farben']:>5}"
                     f"{s['outline'] * 100:>5.0f}%{s['hell']:>6.0f}  {'; '.join(h) or 'ok'}")
    lines.append(f"\nMedian: Flaeche {mf * 100:.0f}%, {mc:.0f} Farben, Outline {mo * 100:.0f}%, Helligkeit {mh:.0f}"
                 f"  ->  {warn} von {len(st)} Icons mit Hinweisen")
    return "\n".join(lines)


def contact_sheet(p, cols, s):
    icons = p.of("icon")
    if not icons:
        die("keine [icon ...]-Abschnitte")
    w, h = p.image(icons[0]).size
    cw, ch = w * s, h * s
    gap, lab = 10, 14
    rows = (len(icons) + cols - 1) // cols
    out = Image.new("RGBA", (cols * (cw * 2 + gap * 2) + gap, rows * (ch + lab + gap * 2) + gap), (30, 30, 38, 255))
    d = ImageDraw.Draw(out)
    dark, light = hex2rgba(p.meta.get("bg_dunkel", "#1a1c2c")), hex2rgba(p.meta.get("bg_hell", "#e8e6df"))
    for i, e in enumerate(icons):
        x = gap + (i % cols) * (cw * 2 + gap * 2)
        y = gap + (i // cols) * (ch + lab + gap * 2)
        big = up(p.image(e), s)
        for j, bgc in enumerate((dark, light)):
            cell = Image.new("RGBA", (cw, ch), bgc)
            cell.alpha_composite(big)
            out.alpha_composite(cell, (x + j * cw, y))
        d.text((x, y + ch + 2), e.name, fill=(210, 210, 220))
    return out


# ----------------------------------------------------------------------------- Tiles
BLOB_BITS = {"N": 1, "NE": 2, "E": 4, "SE": 8, "S": 16, "SW": 32, "W": 64, "NW": 128}


def blob_reduce(m):
    """Diagonal-Bits nur behalten, wenn beide angrenzenden Seiten gesetzt sind."""
    for d, (a, b) in (("NE", ("N", "E")), ("SE", ("S", "E")), ("SW", ("S", "W")), ("NW", ("N", "W"))):
        if not (m & BLOB_BITS[a] and m & BLOB_BITS[b]):
            m &= ~BLOB_BITS[d]
    return m


BLOB_MASKS = sorted({blob_reduce(m) for m in range(256)})  # 47 Stueck


def gen_autotile(p, fill, base, edge, inner=None, shadow=None, border=2, radius=3, wobble=False, blob=False):
    """16er-Set (Bitmaske N=1 E=2 S=4 W=8) oder 47er-Blob-Set (N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128).
    Bit gesetzt = Nachbar ist ebenfalls Terrain."""
    ft, bt = p.find(fill, ("tile",)), p.find(base, ("tile",)) if base else None
    if not ft:
        die(f"Tile '{fill}' fehlt")
    if not ft.rows:
        die("--fill braucht ein Tile mit Rasterzeilen")
    T = len(ft.rows)
    Wd = len(ft.rows[0])
    brow = bt.rows if bt else ["." * Wd] * T

    def wob(i, n, side):
        if not wobble or i < border + radius + 1 or i > n - border - radius - 2:
            return 0
        return 1 if ((i + side * 3) // 4) % 2 else 0

    tiles = []
    for mask in (BLOB_MASKS if blob else range(16)):
        if blob:
            opn = {k: not mask & v for k, v in BLOB_BITS.items()}
        else:
            opn = {"N": not mask & 1, "E": not mask & 2, "S": not mask & 4, "W": not mask & 8}
            opn.update(NE=False, SE=False, SW=False, NW=False)
        ins = [[True] * Wd for _ in range(T)]
        # Innenecken: Diagonale offen, beide Seiten zu -> Kerbe in der Ecke
        for d, (v, hh) in (("NW", ("N", "W")), ("NE", ("N", "E")), ("SW", ("S", "W")), ("SE", ("S", "E"))):
            if opn[d] and not opn[v] and not opn[hh]:
                for y in range(T):
                    for x in range(Wd):
                        dx = x if hh == "W" else Wd - 1 - x
                        dy = y if v == "N" else T - 1 - y
                        if dx < border and dy < border:
                            ins[y][x] = False
        for y in range(T):
            for x in range(Wd):
                if opn["N"] and y < border + wob(x, Wd, 0): ins[y][x] = False
                if opn["S"] and y > T - 1 - border - wob(x, Wd, 1): ins[y][x] = False
                if opn["W"] and x < border + wob(y, T, 2): ins[y][x] = False
                if opn["E"] and x > Wd - 1 - border - wob(y, T, 3): ins[y][x] = False
                for v, hh, cx, cy in (("N", "W", border + radius, border + radius),
                                      ("N", "E", Wd - 1 - border - radius, border + radius),
                                      ("S", "W", border + radius, T - 1 - border - radius),
                                      ("S", "E", Wd - 1 - border - radius, T - 1 - border - radius)):
                    if opn[v] and opn[hh] and radius > 0:
                        inx = x < cx if hh == "W" else x > cx
                        iny = y < cy if v == "N" else y > cy
                        if inx and iny and (x - cx) ** 2 + (y - cy) ** 2 > (radius + 0.5) ** 2:
                            ins[y][x] = False

        def inside(x, y):
            if 0 <= x < Wd and 0 <= y < T:
                return ins[y][x]
            side = ("N" if y < 0 else "S" if y >= T else "") + ("W" if x < 0 else "E" if x >= Wd else "")
            return not opn[side]

        rows = []
        for y in range(T):
            r = ""
            for x in range(Wd):
                if ins[y][x]:
                    if not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        r += edge
                    elif inner and not all(inside(x + dx, y + dy) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if abs(dx) + abs(dy) <= 2):
                        r += inner
                    else:
                        r += ft.rows[y][x]
                else:
                    r += shadow if shadow and inside(x, y - 1) else brow[y][x]
            rows.append(r)
        e = Elem("tile", f"{fill}_{'b%03d' % mask if blob else '%02d' % mask}", set())
        e.rows = rows
        tiles.append(e)
    return tiles


def demo_map(fill, base, blob_mode=False, w=16, h=11):
    shape = ["................",
             "..####..........",
             ".######...###...",
             ".##############.",
             ".###.####...###.",
             ".###.####.#.###.",
             ".#######..#.###.",
             "..#####...#####.",
             "...#.#..........",
             "..........##....",
             "................"]
    on = lambda xx, yy: 0 <= xx < w and 0 <= yy < h and shape[yy][xx] == "#"
    masks = BLOB_MASKS if blob_mode else list(range(16))
    e = Elem("map", "autotile_demo", set())
    e.legend = {CHARS[i]: f"{fill}_{'b%03d' % m if blob_mode else '%02d' % m}" for i, m in enumerate(masks)}
    if base:
        e.legend["_"] = base
    for y in range(h):
        r = ""
        for x in range(w):
            if not on(x, y):
                r += "_" if base else "."
                continue
            if blob_mode:
                m = sum(b for d, b in BLOB_BITS.items()
                        if on(x + (1 if "E" in d else -1 if "W" in d else 0), y + (-1 if "N" in d else 1 if "S" in d else 0)))
                r += CHARS[masks.index(blob_reduce(m))]
            else:
                m = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
                r += CHARS[m]
        e.rows.append(r)
    return e


def save_pix(p, path):
    with open(path, "w", encoding="utf-8") as f:
        if p.meta:
            f.write("[meta]\n" + "".join(f"{k} = {v}\n" for k, v in p.meta.items() if k != "mirror") + "\n")
        f.write("[palette]\n")
        for c, col in p.palette.items():
            f.write(f"{c} = transparent\n" if col[3] == 0 else f"{c} = {rgba2hex(col)}\n")
        for e in p.elems:
            f.write(f"\n[{e.kind} {e.name}]\n")
            for k, v in e.legend.items():
                f.write(f"{k} = {v}\n")
            f.write("".join(r + "\n" for r in e.rows))
            for n, x, y, fl, _ in e.places:
                f.write(f"@ {n} {x} {y} {' '.join(sorted(fl))}".rstrip() + "\n")


def outline_rows(rows, ch, transp, diagonal=False):
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (1, -1), (-1, 1), (1, 1)] if diagonal else [])
    w, h = len(rows[0]) + 2, len(rows) + 2
    g = [["."] * w] + [["."] + list(r) + ["."] for r in rows] + [["."] * w]
    out = [row[:] for row in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] in transp and any(0 <= y + dy < h and 0 <= x + dx < w and g[y + dy][x + dx] not in transp for dx, dy in nb):
                out[y][x] = ch
    return ["".join(r) for r in out]


# ----------------------------------------------------------------------------- Foto -> Pixel
def rgb2lab(a):
    a = np.asarray(a, dtype=np.float64) / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    xyz = a @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def kmeans_palette(rgb, k, iters=25, seed=1):
    rng = np.random.default_rng(seed)
    if len(rgb) > 20000:
        rgb = rgb[rng.choice(len(rgb), 20000, replace=False)]
    lab = rgb2lab(rgb)
    cent = [lab[rng.integers(len(lab))]]
    for _ in range(1, k):  # kmeans++
        d = np.min(((lab[:, None] - np.array(cent)[None]) ** 2).sum(-1), 1)
        cent.append(lab[rng.choice(len(lab), p=d / d.sum())] if d.sum() > 0 else lab[rng.integers(len(lab))])
    cent = np.array(cent)
    for _ in range(iters):
        lbl = ((lab[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            if (lbl == i).any():
                cent[i] = lab[lbl == i].mean(0)
    # Detail-Rettung: kleine, aber deutlich andersfarbige Bereiche (Augen, Akzente) bekommen eine eigene Farbe,
    # dafuer werden die zwei aehnlichsten Palettenfarben zusammengelegt.
    for _ in range(3):
        wdiff = (lab[:, None] - cent[None]) * np.array([1.0, 1.6, 1.6])  # Buntheit staerker gewichten
        dist = np.sqrt((wdiff ** 2).sum(-1).min(1))
        far = dist > 15
        if far.sum() < max(8, 0.003 * len(lab)) or len(cent) < 3:
            break
        dd = ((cent[:, None] - cent[None]) ** 2).sum(-1) + np.eye(len(cent)) * 1e9
        i, j = np.unravel_index(dd.argmin(), dd.shape)
        merged = (cent[i] + cent[j]) / 2
        cent = np.vstack([np.delete(cent, [i, j], 0), merged, lab[far].mean(0)])
        for _ in range(5):
            lbl = ((lab[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
            for c in range(len(cent) - 1):  # neue Akzentfarbe bleibt fix
                if (lbl == c).any():
                    cent[c] = lab[lbl == c].mean(0)
    lbl = ((lab[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
    return [tuple(int(v) for v in rgb[lbl == i].mean(0).round()) for i in range(len(cent)) if (lbl == i).any()]


def nearest(lab_px, pal_lab):
    return ((lab_px[..., None, :] - pal_lab) ** 2).sum(-1).argmin(-1)


def fromimg(path, width, colors=12, preset=None, palfile=None, removebg=False, tol=12.0,
            contrast=1.0, saturation=1.0, cleanup=1, outline=None, dither=False, simplify=0):
    img = Image.open(path).convert("RGBA")
    rgb_img = img.convert("RGB")
    if contrast != 1:
        rgb_img = ImageEnhance.Contrast(rgb_img).enhance(contrast)
    if saturation != 1:
        rgb_img = ImageEnhance.Color(rgb_img).enhance(saturation)
    W = width
    H = max(1, round(img.height * W / img.width))
    small = np.asarray(rgb_img.resize((W, H), Image.BOX))
    alpha = np.asarray(img.getchannel("A").resize((W, H), Image.BOX)) >= 128

    # Hintergrund vom Rand aus wegfluten
    if removebg:
        lab = rgb2lab(small)
        border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
        ref = np.median(border, 0)
        seen = np.zeros((H, W), bool)
        q = deque()
        for y in range(H):
            for x in range(W):
                if (y in (0, H - 1) or x in (0, W - 1)) and np.linalg.norm(lab[y, x] - ref) < tol * 2:
                    seen[y, x] = True
                    q.append((y, x))
        while q:
            y, x = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] \
                        and np.linalg.norm(lab[ny, nx] - lab[y, x]) < tol \
                        and np.linalg.norm(lab[ny, nx] - ref) < tol * 3:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        alpha &= ~seen

    # Palette
    chars_fixed = None
    if palfile:
        src = Pix.load(palfile)
        items = [(c, v) for c, v in src.palette.items() if v[3] == 255]
        pal = [v[:3] for _, v in items]
        chars_fixed = [c for c, _ in items]
    elif preset:
        if preset in PRESETS:
            pal = [hex2rgba(h)[:3] for h in PRESETS[preset]]
        else:  # eigene Liste: "#1a1c2c,#ffffff,..." (z. B. Projektpalette aus stil.json)
            pal = [hex2rgba(h)[:3] for h in re.split(r"[,\s]+", preset) if h.strip()]
    else:
        pal = kmeans_palette(small[alpha] if alpha.any() else small.reshape(-1, 3), colors)
    pal_lab = rgb2lab(np.array(pal))

    # Farben zuweisen: Mehrheitsentscheid pro Zelle (scharf) oder geordnetes Dithering
    if dither:
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5
        off = bayer[np.arange(H)[:, None] % 4, np.arange(W)[None] % 4][..., None] * 48
        idx = nearest(rgb2lab(np.clip(small + off, 0, 255)), pal_lab)
    else:
        k = 4
        big = np.asarray(rgb_img.resize((W * k, H * k), Image.LANCZOS)).astype(float)
        bidx = nearest(rgb2lab(big), pal_lab).reshape(H, k, W, k).transpose(0, 2, 1, 3).reshape(H, W, k * k)
        idx = np.array([[np.bincount(bidx[y, x], minlength=len(pal)).argmax() for x in range(W)] for y in range(H)])
    idx = np.where(alpha, idx, -1)

    # Vereinfachen: Pixel uebernimmt klare Nachbarschafts-Mehrheit (>=5 von 8) -> ruhigere Flaechen
    for _ in range(simplify):
        new = idx.copy()
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if idx[y, x] < 0:
                    continue
                nb = [idx[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
                c = Counter(n for n in nb if n >= 0).most_common(1)
                if c and c[0][1] >= 5 and c[0][0] != idx[y, x]:
                    new[y, x] = c[0][0]
        idx = new

    # Aufraeumen: verwaiste Einzelpixel an Nachbarschaft angleichen
    for _ in range(cleanup):
        new = idx.copy()
        for y in range(H):
            for x in range(W):
                if idx[y, x] < 0:
                    continue
                nb = [idx[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W]
                if idx[y, x] not in nb:
                    c = Counter(n for n in nb if n >= 0).most_common(1)
                    if c and c[0][1] >= 4:
                        new[y, x] = c[0][0]
        idx = new

    # .pix bauen: Zeichen nach Helligkeit sortiert (dunkel -> hell)
    used = sorted(set(idx[idx >= 0].tolist()), key=lambda i: lum(pal[i]))
    cmap = {i: (chars_fixed[i] if chars_fixed else CHARS[n]) for n, i in enumerate(used)}
    p = Pix()
    p.palette["."] = TRANSPARENT
    for i in used:
        p.palette[cmap[i]] = tuple(pal[i]) + (255,)
    rows = ["".join("." if v < 0 else cmap[v] for v in r) for r in idx]
    if outline:
        oc = min((pal[i] for i in used), key=lum) if outline == "auto" else hex2rgba(outline)[:3]
        och = next(c for c, v in p.palette.items() if v[:3] == tuple(oc) and v[3]) if tuple(oc) in [v[:3] for v in p.palette.values() if v[3]] else "K"
        p.palette.setdefault(och, tuple(oc) + (255,))
        rows = outline_rows(rows, och, {"."})
    e = Elem("frame", "f0", set())
    e.rows = rows
    p.elems.append(e)
    return p


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd")
    ap.add_argument("file", nargs="?")
    for a in ("--out", "--name", "--anim", "--char", "--palette", "--palette-from", "--fill", "--base", "--split",
              "--edge", "--inner", "--shadow", "--outline", "--ref", "--pal-file"):
        ap.add_argument(a)
    for a, d in (("--scale", None), ("--cols", 8), ("--width", 48), ("--colors", 12), ("--cleanup", 1), ("--simplify", 0),
                 ("--border", 2), ("--radius", 3), ("--cell", 0)):
        ap.add_argument(a, type=int, default=d)
    for a, d in (("--tol", 12.0), ("--contrast", 1.0), ("--saturation", 1.0)):
        ap.add_argument(a, type=float, default=d)
    for a in ("--diagonal", "--wobble", "--removebg", "--dither", "--blob"):
        ap.add_argument(a, action="store_true")
    a = ap.parse_args()
    base = os.path.splitext(a.file)[0] if a.file else "out"
    sc = lambda d: a.scale or d

    if a.cmd == "palettes":
        s, out = 32, a.out or "palettes.png"
        img = Image.new("RGBA", (16 * s + 120, len(PRESETS) * s), (30, 30, 38, 255))
        d = ImageDraw.Draw(img)
        for i, (n, cols) in enumerate(PRESETS.items()):
            d.text((4, i * s + 10), n, fill="white")
            for j, c in enumerate(cols):
                d.rectangle([120 + j * s, i * s, 120 + j * s + s - 2, i * s + s - 2], fill=hex2rgba(c))
                d.text((120 + j * s + 3, i * s + 3), CHARS[j], fill="white" if lum(hex2rgba(c)) < 128 else "black")
        img.save(out); print(out); return
    if a.cmd == "fromimg":
        p = fromimg(a.file, a.width, a.colors, a.palette, a.palette_from, a.removebg, a.tol,
                    a.contrast, a.saturation, a.cleanup, a.outline, a.dither, a.simplify)
        out = a.out or base + ".pix"
        save_pix(p, out)
        w, h = len(p.elems[0].rows[0]), len(p.elems[0].rows)
        print(f"{out}  ({w}x{h}px, {len(p.palette) - 1} Farben)"); return

    p = Pix.load(a.file)
    errs, warns = p.check()
    for w in warns:
        print("WARNUNG:", w)
    if errs:
        for e in errs:
            print("FEHLER:", e)
        sys.exit(1)

    if a.cmd == "check":
        used = {c for e in p.elems if e.kind != "map" for r in e.rows for c in r}
        print(f"OK - {len(p.of('frame'))} Frames in {len(p.anims())} Animation(en) {list(p.anims())}, "
              f"{len(p.of('tile'))} Tiles, {len(p.of('part'))} Parts, {len(p.of('map'))} Maps; "
              f"{len(used - {'.'})} Farben genutzt")
        return
    if a.cmd == "render":
        e = p.default_elem(a.name)
        out = a.out or f"{base}_{e.name}.png"
        up(p.image(e), sc(12 if e.kind != "map" else 4)).save(out)
    elif a.cmd == "preview":
        e = p.default_elem(a.name)
        out = a.out or f"{base}_{e.name}_preview.png"
        img = p.image(e)
        preview(img, sc(max(4, min(24, 640 // max(img.size))))).save(out)
    elif a.cmd in ("gif", "sheet", "onion"):
        anims = p.anims()
        if not anims:
            die("keine [frame ...]-Abschnitte")
        sel = {a.anim: anims[a.anim]} if a.anim else anims
        if a.anim and a.anim not in anims:
            die(f"Animation '{a.anim}' fehlt; vorhanden: {list(anims)}")
        if a.cmd == "gif":
            outs = []
            for name, frames in sel.items():
                fps = float(p.meta.get(f"fps_{name}", p.meta.get("fps", 6)))
                ims = []
                for f in frames:
                    im = p.image(f)
                    bg = Image.new("RGBA", im.size, hex2rgba(p.meta.get("bg", "#2a2a35")))
                    bg.alpha_composite(im)
                    ims.append(up(bg, sc(8)))
                o = a.out if (a.out and len(sel) == 1) else f"{base}_{name}.gif"
                ims[0].save(o, save_all=True, append_images=ims[1:], duration=int(1000 / fps), loop=0, disposal=2)
                outs.append(o)
            out = "\n".join(outs)
        elif a.cmd == "sheet":
            s = sc(1)
            fw, fh = p.image(next(iter(sel.values()))[0]).size
            cols = max(len(v) for v in sel.values())
            sheet = Image.new("RGBA", (cols * fw * s, len(sel) * fh * s), TRANSPARENT)
            meta = {"frame_w": fw * s, "frame_h": fh * s, "animations": {}}
            for row, (name, frames) in enumerate(sel.items()):
                fps = float(p.meta.get(f"fps_{name}", p.meta.get("fps", 6)))
                meta["animations"][name] = {"row": row, "frames": len(frames), "fps": fps}
                for i, f in enumerate(frames):
                    sheet.alpha_composite(up(p.image(f), s), (i * fw * s, row * fh * s))
            out = a.out or f"{base}_sheet.png"
            sheet.save(out)
            json.dump(meta, open(os.path.splitext(out)[0] + ".json", "w"), indent=2)
        else:  # onion
            name, frames = next(iter(sel.items()))
            s = sc(12)
            ims, n = [], len(frames)
            for i, f in enumerate(frames):
                cur = p.image(f)
                layer = Image.new("RGBA", cur.size, TRANSPARENT)
                layer.alpha_composite(tint(p.image(frames[(i - 1) % n]), (255, 70, 70), 0.45))
                layer.alpha_composite(tint(p.image(frames[(i + 1) % n]), (70, 140, 255), 0.30))
                layer.alpha_composite(cur)
                ims.append(on_checker(layer, s))
            out = a.out or f"{base}_{name}_onion.png"
            strip(ims, labels=[f.name for f in frames]).save(out)
    elif a.cmd == "tileset":
        tiles = p.of("tile")
        if not tiles:
            die("keine [tile ...]-Abschnitte")
        s = sc(1)
        tw, th = p.image(tiles[0]).size
        cols = min(a.cols, len(tiles))
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGBA", (cols * tw * s, rows * th * s), TRANSPARENT)
        meta = {"tile_w": tw * s, "tile_h": th * s, "columns": cols, "tiles": {}}
        for i, t in enumerate(tiles):
            sheet.alpha_composite(up(p.image(t), s), ((i % cols) * tw * s, (i // cols) * th * s))
            meta["tiles"][t.name] = i
        out = a.out or f"{base}_tileset.png"
        sheet.save(out)
        json.dump(meta, open(os.path.splitext(out)[0] + ".json", "w"), indent=2)
    elif a.cmd == "tilecheck":
        tiles = [p.default_elem(a.name)] if a.name else p.of("tile")
        s = sc(6)
        ims = []
        for t in tiles:
            im = p.image(t)
            g = Image.new("RGBA", (im.width * 3, im.height * 3), TRANSPARENT)
            for yy in range(3):
                for xx in range(3):
                    g.alpha_composite(im, (xx * im.width, yy * im.height))
            ims.append(on_checker(g, s))
        per = 4
        lines = [strip(ims[i:i + per], labels=[t.name for t in tiles[i:i + per]]) for i in range(0, len(ims), per)]
        out_img = Image.new("RGBA", (max(l.width for l in lines), sum(l.height for l in lines)), (30, 30, 38, 255))
        y = 0
        for l in lines:
            out_img.alpha_composite(l, (0, y)); y += l.height
        out = a.out or f"{base}_tilecheck.png"
        out_img.save(out)
    elif a.cmd == "iconset":
        icons = p.of("icon")
        if not icons:
            die("keine [icon ...]-Abschnitte")
        s = sc(1)
        iw, ih = p.image(icons[0]).size
        cols = min(int(p.meta.get("cols", a.cols if a.cols != 8 else 4)), len(icons))
        rows = (len(icons) + cols - 1) // cols
        sheet = Image.new("RGBA", (cols * iw * s, rows * ih * s), TRANSPARENT)
        meta = {"icon_w": iw * s, "icon_h": ih * s, "columns": cols, "rows": rows, "icons": {}}
        for i, e in enumerate(icons):
            sheet.alpha_composite(up(p.image(e), s), ((i % cols) * iw * s, (i // cols) * ih * s))
            meta["icons"][e.name] = {"index": i, "x": (i % cols) * iw * s, "y": (i // cols) * ih * s}
            if a.split:
                os.makedirs(a.split, exist_ok=True)
                up(p.image(e), s).save(os.path.join(a.split, f"{e.name}.png"))
        out = a.out or f"{base}_set.png"
        sheet.save(out)
        json.dump(meta, open(os.path.splitext(out)[0] + ".json", "w"), indent=2)
    elif a.cmd == "contact":
        out = a.out or f"{base}_contact.png"
        contact_sheet(p, int(p.meta.get("cols", a.cols if a.cols != 8 else 4)), sc(4)).save(out)
    elif a.cmd == "setcheck":
        print(setcheck(p))
        return
    elif a.cmd == "palcheck":
        pal = load_palette(a.pal_file or a.palette)
        bad = {}
        for e in p.elems:
            if e.kind == "map":
                continue
            im = np.asarray(p.image(e))
            for c in {tuple(x) for x in im[im[..., 3] > 0][:, :3].tolist()}:
                if c not in pal:
                    bad.setdefault("#%02x%02x%02x" % c, []).append(e.name)
        if bad:
            for c, names in bad.items():
                print(f"FEHLER: {c} nicht in der Palette ({', '.join(sorted(set(names))[:5])})")
            sys.exit(1)
        print(f"OK - alle Farben aus der Palette ({len(pal)} Farben)")
        return
    elif a.cmd == "refcheck":
        if not a.ref:
            die("refcheck braucht --ref RASTER.png [--cell 32]")
        print(refcheck(p, a.ref, a.cell or int(p.meta.get("icon", 32))))
        return
    elif a.cmd == "map":
        m = p.find(a.name, ("map",)) if a.name else (p.of("map") or [None])[0]
        if not m:
            die("keine [map ...] gefunden")
        out = a.out or f"{base}_{m.name}.png"
        up(p.image(m), sc(4)).save(out)
    elif a.cmd == "autotile":
        if not (a.fill and a.edge):
            die("autotile braucht --fill TILE --edge ZEICHEN (optional --base TILE)")
        for c in filter(None, (a.edge, a.inner, a.shadow)):
            if c not in p.palette:
                die(f"Zeichen '{c}' fehlt in der Palette")
        tiles = gen_autotile(p, a.fill, a.base, a.edge, a.inner, a.shadow, a.border, a.radius, a.wobble, a.blob)
        names = {t.name for t in tiles}
        p.elems = [e for e in p.elems if not e.name.startswith(a.fill + "_") and e.name != "autotile_demo"] + tiles + [demo_map(a.fill, a.base, a.blob)]
        out = a.out or f"{base}_autotile.pix"
        save_pix(p, out)
    elif a.cmd == "outline":
        if not a.char or a.char not in p.palette:
            die("--char muss ein Zeichen aus der Palette sein")
        transp = {c for c, v in p.palette.items() if v[3] == 0}
        targets = [p.default_elem(a.name)] if a.name else [e for e in p.elems if e.kind != "map" and e.rows]
        for e in targets:
            e.rows = outline_rows(e.rows, a.char, transp, a.diagonal)
        out = a.out or f"{base}_outlined.pix"
        save_pix(p, out)
    else:
        die(f"Unbekannter Befehl: {a.cmd}")
    print(out)


if __name__ == "__main__":
    main()
