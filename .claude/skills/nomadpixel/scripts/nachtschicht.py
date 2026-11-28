"""nachtschicht.py – Bewerten und Auslesen für die Auto-Schleife (Plan: nachtschicht.md).

  NS = python3 .claude/skills/nomadpixel/scripts/nachtschicht.py
  NS bewerten ORDNER --breite W [--ref REF_ORDNER] [--entwurf ENTWURF.png] [--top 3] [--gruppe 10]
      Bewertet alle PNGs eines Durchgangs, schreibt ORDNER/bewertung.json und ORDNER/top.png (Kontaktbogen).
      Je Gruppe (Bilder desselben Motivs, Dateiname bis zum letzten '_') bleiben die besten --top.
  NS datensatz ORDNER... ZIEL --min 0.55 [--max-je-motiv 3] [--echt ECHT_ORDNER]
      Sammelt die von Ava freigegebenen Bilder (bewertung.json: "freigabe": true) als Trainingsdaten
      mit Bildunterschrift (.txt aus dem Prompt) und mischt immer die echten Originale dazu (gegen Modellkollaps).

Teilnoten (0..1, höher = besser):
  raster   wie sauber das Bild auf ein Pixelraster der Zielbreite passt (Fehler nach Box-Verkleinern + Vergrößern)
  palette  wie nah die Farben an der Projektpalette liegen
  farben   Anzahl der Farben nach dem Einrasten im Zielbereich (Figuren 12–20, Szenen bis 32)
  stil     Nähe zum Referenz-Ordner (Bild-Einbettung, sobald ein Bildmodell da ist; sonst Farb- und Helligkeitsprofil)
  volumen  Licht und Struktur statt Flächen: Helligkeits-Abstufungen im Pixelbild (flach = schlecht)
  treue    nur Weg A+: Ähnlichkeit der Grobform zum Entwurf (Graustufen 32 px)
  einmalig Abzug, wenn ein Bild einem besseren derselben Gruppe fast gleicht (Vielfalt)
"""
import argparse, glob, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HIER = os.path.dirname(os.path.abspath(__file__))
STIL = os.path.join(HIER, '..', '..', '..', 'nomadpixel-stil.json')
GEWICHT = {'raster': 0.15, 'palette': 0.1, 'farben': 0.1, 'volumen': 0.25, 'stil': 0.25, 'treue': 0.15}   # vorläufig, wird an Avas/Daniels Auswahl geeicht


def palette():
    s = json.load(open(STIL, encoding='utf-8'))
    root = os.path.abspath(os.path.join(os.path.dirname(STIL), '..'))
    return np.array([[int(l.strip()[i:i + 2], 16) for i in (0, 2, 4)] for l in open(os.path.join(root, s['paletteDatei'])) if l.strip()], float)


def klein(im, w):
    h = max(1, round(im.height * w / im.width))
    return im.convert('RGB').resize((w, h), Image.BOX)


def profil(im):
    """Stil-Ersatz ohne Bildmodell: Farbhistogramm (4x4x4) + Helligkeitsverteilung + Kantendichte."""
    a = np.asarray(im.convert('RGB').resize((128, 128), Image.BOX), float)
    hist = np.histogramdd(a.reshape(-1, 3), bins=(4, 4, 4), range=[(0, 256)] * 3)[0].ravel()
    g = a.mean(2); lum = np.histogram(g, bins=8, range=(0, 256))[0]
    kante = np.abs(np.diff(g, axis=0)).mean() / 64
    v = np.concatenate([hist / hist.sum(), lum / lum.sum(), [kante]])
    return v / (np.linalg.norm(v) + 1e-9)


_onnx = None
def einbettung(im):
    """Bildmodell (CLIP/DINOv2 als ONNX), falls vorhanden: AVA_BEWERTER=pfad/zum/model.onnx."""
    global _onnx
    pfad = os.environ.get('AVA_BEWERTER')
    if not pfad or not os.path.exists(pfad):
        return profil(im)
    import onnxruntime as ort
    _onnx = _onnx or ort.InferenceSession(pfad, providers=['CPUExecutionProvider'])
    x = np.asarray(im.convert('RGB').resize((224, 224), Image.BICUBIC), np.float32) / 255
    x = (x - [0.4815, 0.4578, 0.4082]) / [0.2686, 0.2613, 0.2758]
    inp = _onnx.get_inputs()[0]
    x = x.transpose(2, 0, 1)[None].astype(np.float16 if 'float16' in inp.type else np.float32)
    out = _onnx.run(None, {inp.name: x})
    v = out[0].reshape(out[0].shape[0], -1)[0].astype(float) if out[0].ndim <= 2 else out[0][0].mean(0).astype(float)
    return v / (np.linalg.norm(v) + 1e-9)


def bewerten(a):
    pal = palette()
    dateien = sorted(f for f in glob.glob(os.path.join(a.ordner, '*.png')) if not os.path.basename(f).startswith(('top', 'bogen')))
    ref = [einbettung(Image.open(f)) for f in sorted(glob.glob(os.path.join(a.ref, '*.png')))] if a.ref else []
    ent = np.asarray(Image.open(a.entwurf).convert('L').resize((32, 32), Image.BOX), float) if a.entwurf else None
    zeilen = []
    for f in dateien:
        im = Image.open(f).convert('RGB')
        k = klein(im, a.breite); back = np.asarray(k.resize(im.size, Image.NEAREST), float); raw = np.asarray(im, float)
        raster = float(np.clip(1 - np.abs(raw - back).mean() / 40, 0, 1))
        px = np.asarray(k, float).reshape(-1, 3)
        d = np.sqrt(((px[:, None] - pal[None]) ** 2).sum(2)).min(1)
        palette_n = float(np.clip(1 - d.mean() / 60, 0, 1))
        idx = ((px[:, None] - pal[None]) ** 2).sum(2).argmin(1)
        n = len(np.unique(idx))
        farben = float(np.clip(1 - max(0, n - a.farben) / a.farben, 0, 1))
        gk = np.asarray(k.convert('L'), float)
        lap = np.abs(4 * gk[1:-1, 1:-1] - gk[:-2, 1:-1] - gk[2:, 1:-1] - gk[1:-1, :-2] - gk[1:-1, 2:])
        stufen = (lap > 6).mean()                                   # Anteil Pixel mit Abstufung
        volumen = float(np.clip(1 - abs(stufen - 0.45) / 0.45, 0, 1))  # Ziel ~45 %, flach und Rauschen verlieren
        emb = einbettung(im)
        stil = float(np.mean(sorted([emb @ r for r in ref])[-3:])) if ref else 0.5
        treue = 0.5
        if ent is not None:
            g = np.asarray(im.convert('L').resize((32, 32), Image.BOX), float)
            treue = float(np.clip(np.corrcoef(g.ravel(), ent.ravel())[0, 1], 0, 1))
        teile = {'raster': raster, 'palette': palette_n, 'farben': farben, 'volumen': volumen, 'stil': stil, 'treue': treue}
        note = sum(GEWICHT[t] * v for t, v in teile.items())
        gruppe = os.path.basename(f).rsplit('_', 2)[0]
        zeilen.append({'datei': os.path.basename(f), 'gruppe': gruppe, 'note': round(note, 4), 'teile': {t: round(v, 3) for t, v in teile.items()}, 'emb': emb})
    # Vielfalt: fast gleiche Bilder einer Gruppe bekommen Abzug
    for g in {z['gruppe'] for z in zeilen}:
        zs = sorted([z for z in zeilen if z['gruppe'] == g], key=lambda z: -z['note'])
        for i, z in enumerate(zs):
            nah = max([float(z['emb'] @ o['emb']) for o in zs[:i]] or [0])
            if os.environ.get('AVA_BEWERTER') and nah > 0.97: z['note'] = round(z['note'] - 0.15, 4); z['teile']['einmalig'] = 0
    for z in zeilen: z.pop('emb')
    zeilen.sort(key=lambda z: -z['note'])
    best = []
    for g in sorted({z['gruppe'] for z in zeilen}):
        best += [z for z in zeilen if z['gruppe'] == g][:a.top]
    for z in zeilen: z['top'] = z in best; z.setdefault('freigabe', None)
    json.dump(zeilen, open(os.path.join(a.ordner, 'bewertung.json'), 'w'), indent=1, ensure_ascii=False)
    # Kontaktbogen der Besten (für Avas Sichtung)
    T = 256; cols = 6; rows = (len(best) + cols - 1) // cols
    bogen = Image.new('RGB', (cols * T, rows * (T + 18)), (20, 18, 22)); dr = ImageDraw.Draw(bogen)
    for i, z in enumerate(best):
        im = Image.open(os.path.join(a.ordner, z['datei'])).convert('RGB'); im.thumbnail((T, T))
        x, y = (i % cols) * T, (i // cols) * (T + 18)
        bogen.paste(im, (x + (T - im.width) // 2, y)); dr.text((x + 4, y + T + 2), f"{i + 1}. {z['datei'][:26]} {z['note']:.2f}", fill=(255, 210, 120))
    bogen.save(os.path.join(a.ordner, 'top.png'))
    print(f"{len(zeilen)} Bilder bewertet, {len(best)} oben, Bogen: {os.path.join(a.ordner, 'top.png')}")


def datensatz(a):
    os.makedirs(a.ziel, exist_ok=True)
    n = 0
    for o in a.ordner:
        zs = json.load(open(os.path.join(o, 'bewertung.json')))
        prompts = json.load(open(os.path.join(o, 'prompts.json'))) if os.path.exists(os.path.join(o, 'prompts.json')) else {}
        je = {}
        for z in zs:
            if not z.get('freigabe') or z['note'] < a.min: continue
            if je.get(z['gruppe'], 0) >= a.max_je_motiv: continue
            je[z['gruppe']] = je.get(z['gruppe'], 0) + 1
            name = f"syn_{os.path.basename(o)}_{z['datei'][:-4]}"
            Image.open(os.path.join(o, z['datei'])).convert('RGB').save(os.path.join(a.ziel, name + '.png'))
            open(os.path.join(a.ziel, name + '.txt'), 'w').write(prompts.get(z['gruppe'], z['gruppe'].replace('_', ' ')))
            n += 1
    m = 0
    if a.echt:   # echte Originale immer mit hinein (Mischung statt Ersatz)
        for f in glob.glob(os.path.join(a.echt, '*.png')):
            b = os.path.basename(f)
            Image.open(f).save(os.path.join(a.ziel, b)); m += 1
            t = f[:-4] + '.txt'
            if os.path.exists(t): open(os.path.join(a.ziel, b[:-4] + '.txt'), 'w').write(open(t).read())
    print(f'{n} synthetische + {m} echte Bilder in {a.ziel} (Anteil echt {m / max(1, n + m):.0%})')


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sp = ap.add_subparsers(dest='cmd', required=True)
p = sp.add_parser('bewerten'); p.add_argument('ordner'); p.add_argument('--breite', type=int, required=True); p.add_argument('--ref'); p.add_argument('--entwurf')
p.add_argument('--top', type=int, default=3); p.add_argument('--farben', type=int, default=24); p.set_defaults(f=bewerten)
p = sp.add_parser('datensatz'); p.add_argument('ordner', nargs='+'); p.add_argument('ziel'); p.add_argument('--min', type=float, default=0.55)
p.add_argument('--max-je-motiv', dest='max_je_motiv', type=int, default=3); p.add_argument('--echt'); p.set_defaults(f=datensatz)
a = ap.parse_args(); a.f(a)
