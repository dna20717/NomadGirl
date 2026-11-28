"""cleanpx.py – Prüfstraße für das Clean-Pixel-LoRA (px8, Plan: ../nachtschicht.md).

  python3 cleanpx.py ROH_ORDNER CHARGE.json ZIEL_ORDNER [--faktor 6] [--bogen bogen.png]

Für jedes Rohbild (SDXL + Pixel Art XL, Dateiname beginnt mit der Motiv-ID):
  1. auf das 8-px-Raster bringen (Breite/8), Projektpalette, Rauschen beruhigen, Farben begrenzen (veredeln.py snap)
  2. Prüfen: Rasterpassung des Rohbilds, Einzelpixel-Rauschen, Farbanzahl, Doppelte (Farb-Miniatur 16x16)
  3. Bestandenes als Trainingsbild: ×FAKTOR nearest hochskaliert (128 px -> 768 px) + .txt mit Bildunterschrift
Schreibt ZIEL_ORDNER/pruefung.json und einen Kontaktbogen (bestanden grün, durchgefallen rot).
"""
import argparse, glob, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

HIER = os.path.dirname(os.path.abspath(__file__))
STIL = os.path.abspath(os.path.join(HIER, '..', '..', '..', 'nomadpixel-stil.json'))


def rasterpassung(im, w):
    k = im.resize((w, round(im.height * w / im.width)), Image.BOX)
    back = np.asarray(k.resize(im.size, Image.NEAREST), float)
    return float(np.clip(1 - np.abs(np.asarray(im, float) - back).mean() / 40, 0, 1))


def rauschen(a):
    """Anteil Pixel, die zu keinem ihrer 4 Nachbarn passen."""
    c = a[1:-1, 1:-1]
    gleich = [(c == a[:-2, 1:-1]).all(2), (c == a[2:, 1:-1]).all(2), (c == a[1:-1, :-2]).all(2), (c == a[1:-1, 2:]).all(2)]
    return float((~np.any(gleich, axis=0)).mean())


def dhash(im):
    return np.asarray(im.convert('RGB').resize((16, 16), Image.BOX), float)   # Farb-Miniatur statt Bit-Hash


def motive_zahl(a):
    """Wie viele getrennte Motive stehen auf dem Bild? (Hintergrund = häufigste Randfarbe)"""
    from scipy import ndimage
    rand = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    farben, n = np.unique(rand, axis=0, return_counts=True); bg = farben[n.argmax()].astype(float)
    vorne = np.sqrt(((a.astype(float) - bg) ** 2).sum(2)) > 30
    lab, k = ndimage.label(ndimage.binary_closing(vorne, iterations=2))
    groesse = ndimage.sum(vorne, lab, range(1, k + 1)) if k else []
    return int(sum(g >= vorne.size * 0.015 for g in groesse))


ap = argparse.ArgumentParser(); ap.add_argument('roh'); ap.add_argument('charge'); ap.add_argument('ziel')
ap.add_argument('--faktor', type=int, default=6); ap.add_argument('--bogen'); ap.add_argument('--grenzen', default='raster=0.80,rauschen=0.06,farben_min=6,farben_max=32')
a = ap.parse_args()
G = {k: float(v) for k, v in (x.split('=') for x in a.grenzen.split(','))}
os.makedirs(a.ziel, exist_ok=True); tmp = os.path.join(a.ziel, '_tmp'); os.makedirs(tmp, exist_ok=True)
charge = {m['id'] if isinstance(m, dict) else m[0]: m for m in json.load(open(a.charge))}
cap = lambda m: m['caption'] if isinstance(m, dict) else 'px8 pixel art, ' + m[1]
hashes, ergebnis = [], []
for f in sorted(glob.glob(os.path.join(a.roh, '*.png'))):
    mid = os.path.basename(f).split('_0')[0]
    mid = next((k for k in charge if os.path.basename(f).startswith(k)), None)
    if not mid: continue
    im = Image.open(f).convert('RGB'); breite = im.width // 8
    r = {'datei': os.path.basename(f), 'id': mid, 'raster': round(rasterpassung(im, breite), 3)}
    snap = os.path.join(tmp, mid + '.png')
    subprocess.run([sys.executable, os.path.join(HIER, 'veredeln.py'), 'snap', f, snap, '--breite', str(breite), '--farben', str(int(G['farben_max'])), '--stil', STIL], check=True, capture_output=True)
    px = Image.open(snap).convert('RGB'); arr = np.asarray(px)
    r['rauschen'] = round(rauschen(arr), 4); r['farben'] = len(np.unique(arr.reshape(-1, 3), axis=0))
    h = dhash(px); r['doppelt'] = any(np.abs(h - o).mean() < 2.5 for o in hashes)
    r['motive'] = 1 if mid.endswith('_ort') else motive_zahl(arr)
    fehler = [n for n, bad in [('raster', r['raster'] < G['raster']), ('rauschen', r['rauschen'] > G['rauschen']),
                                ('farben', not G['farben_min'] <= r['farben'] <= G['farben_max']), ('doppelt', r['doppelt']), ('mehrfach', r['motive'] >= 3)] if bad]
    r['ok'] = not fehler; r['fehler'] = fehler
    if r['ok']:
        hashes.append(h)
        px.resize((px.width * a.faktor, px.height * a.faktor), Image.NEAREST).save(os.path.join(a.ziel, mid + '.png'))
        open(os.path.join(a.ziel, mid + '.txt'), 'w').write(cap(charge[mid]))
    ergebnis.append(r)
json.dump(ergebnis, open(os.path.join(a.ziel, 'pruefung.json'), 'w'), indent=1)
ok = sum(r['ok'] for r in ergebnis)
print(f'{ok}/{len(ergebnis)} bestanden ->', a.ziel)
for r in ergebnis:
    if not r['ok']: print('  raus:', r['id'], ','.join(r['fehler']), r['raster'], r['rauschen'], r['farben'])
if a.bogen:
    T, cols = 192, 8; rows = (len(ergebnis) + cols - 1) // cols
    b = Image.new('RGB', (cols * T, rows * (T + 14)), (18, 16, 20)); d = ImageDraw.Draw(b)
    for i, r in enumerate(ergebnis):
        p = Image.open(os.path.join(tmp, r['id'] + '.png')).convert('RGB'); s = T / max(p.size)
        p = p.resize((max(1, int(p.width * s)), max(1, int(p.height * s))), Image.NEAREST)
        x, y = (i % cols) * T, (i // cols) * (T + 14); b.paste(p, (x + (T - p.width) // 2, y + (T - p.height) // 2))
        d.rectangle([x, y, x + T - 1, y + T - 1], outline=(60, 200, 90) if r['ok'] else (220, 60, 60), width=2)
        d.text((x + 3, y + T + 1), (r['id'][-9:] + ' ' + ','.join(r['fehler']))[:30], fill=(220, 220, 220))
    b.save(a.bogen); print('Bogen:', a.bogen)
