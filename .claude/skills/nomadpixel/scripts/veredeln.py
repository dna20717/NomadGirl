"""veredeln.py – SDXL-Veredelung für NomadPixel (Abschnitt 17 im SKILL.md).

Weg A+ (Entwurf veredeln):   .pix/PNG-Entwurf -> vorbelichten -> SDXL img2img (~0,6) -> snap -> feinschliff
Weg B  (SDXL-Rohling):       SDXL txt2img/img2img -> snap -> feinschliff

Befehle (VE = python3 .claude/skills/nomadpixel/scripts/veredeln.py):
  VE vorbelichten ENTWURF.png OUT.png [--ziel 1024]   Entwurf hochskalieren (nearest), weichzeichnen,
                                                      Licht von oben links, Korn; Kanten auf Vielfache von 8
  VE workflow aplus|b --bild NAME --prompt TEXT [--denoise 0.62] [--lora pixel-art-xl.safetensors:0.8]
                 [--breite 1024 --hoehe 1024] [--seed 1] [--prefix npx/x]
                                                      ComfyUI-API-Workflow als JSON (für POST /prompt)
  VE snap ROH.png OUT.png --breite W [--farben 24] [--crop BxH] [--stil .claude/nomadpixel-stil.json] [--outline]
                                                      auf Raster + Projektpalette, dann Feinschliff (Rauschen,
                                                      clean); schreibt OUT.png und OUT.pix
"""
import argparse, json, os, subprocess, sys
from collections import Counter

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)


def vorbelichten(a):
    import numpy as np
    from PIL import Image, ImageFilter
    im = Image.open(a.ein).convert('RGB')
    k = max(1, round(a.ziel / max(im.size)))
    im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    W, H = (im.width + 7) // 8 * 8, (im.height + 7) // 8 * 8
    pad = Image.new('RGB', (W, H)); pad.paste(im, (0, 0))
    x = np.asarray(pad.filter(ImageFilter.GaussianBlur(a.blur)), float)
    yy, xx = np.mgrid[0:H, 0:W]
    licht = 1.15 - 0.55 * np.sqrt((xx / W - 0.35) ** 2 + (yy / H - 0.3) ** 2)   # Licht von oben links
    x = x * licht[..., None] + np.random.default_rng(a.seed).normal(0, a.korn, x.shape)
    Image.fromarray(np.clip(x, 0, 255).astype('uint8')).save(a.aus)
    print(a.aus, f'{W}x{H}', f'Faktor {k}')


def workflow(a):
    lora, st = (a.lora.split(':') + ['0.8'])[:2]
    wf = {
        '4': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': a.ckpt}},
        '20': {'class_type': 'LoraLoader', 'inputs': {'model': ['4', 0], 'clip': ['4', 1], 'lora_name': lora, 'strength_model': float(st), 'strength_clip': float(st)}},
        '6': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['20', 1], 'text': a.prompt}},
        '7': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['20', 1], 'text': a.negativ}},
        '8': {'class_type': 'VAEDecode', 'inputs': {'samples': ['3', 0], 'vae': ['4', 2]}},
        '9': {'class_type': 'SaveImage', 'inputs': {'images': ['8', 0], 'filename_prefix': a.prefix}},
    }
    if a.bild:
        wf['1'] = {'class_type': 'LoadImage', 'inputs': {'image': a.bild}}
        wf['2'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['1', 0], 'vae': ['4', 2]}}
        d = a.denoise if a.denoise is not None else (0.62 if a.weg == 'aplus' else 0.55)
    else:
        wf['2'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': a.breite, 'height': a.hoehe, 'batch_size': 1}}
        d = 1.0
    wf['3'] = {'class_type': 'KSampler', 'inputs': {'model': ['20', 0], 'positive': ['6', 0], 'negative': ['7', 0], 'latent_image': ['2', 0],
                                                    'seed': a.seed, 'steps': 30, 'cfg': 6.5, 'sampler_name': 'dpmpp_2m', 'scheduler': 'karras', 'denoise': d}}
    print(json.dumps({'prompt': wf}))


def snap(a):
    from PIL import Image
    import zeichnen
    stil = json.load(open(a.stil, encoding='utf-8'))
    root = os.path.abspath(os.path.join(os.path.dirname(a.stil), '..'))
    pal = ['#' + l.strip().lstrip('#') for l in open(os.path.join(root, stil['paletteDatei'])) if l.strip()]
    roh = Image.open(a.ein).convert('RGB')
    if a.crop:
        cw, ch = map(int, a.crop.split('x')); roh = roh.crop((0, 0, cw, ch))
    tmp = a.aus + '.roh.png'; roh.save(tmp)
    pix = os.path.splitext(a.aus)[0] + '.pix'
    pa = [sys.executable, os.path.join(HIER, 'pixelart.py')]
    subprocess.run(pa + ['fromimg', tmp, '--width', str(a.breite), '--palette', ','.join(pal), '--colors', str(a.farben), '--simplify', '1', '--out', pix], check=True, capture_output=True)
    subprocess.run(pa + ['render', pix, '--scale', '1', '--out', a.aus], check=True, capture_output=True)
    os.remove(tmp)
    # Feinschliff: Einzelpixel, die zu keinem Nachbarn passen, nehmen die klare 3x3-Mehrheit; dann clean()
    im = Image.open(a.aus).convert('RGBA'); w, h = im.size
    zeichnen.T = max(w, h); c = zeichnen.C()
    for y in range(h):
        for x in range(w):
            p = im.getpixel((x, y))
            if p[3]: c.set(x, y, '#%02x%02x%02x' % p[:3])
    for _ in range(2):
        g = [r[:] for r in c.g]
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                v = g[y][x]
                if v in (g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]): continue
                col, n = Counter(g[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy).most_common(1)[0]
                if n >= 4: c.set(x, y, col)
    # Farben begrenzen: seltene Farben auf die nächste der häufigsten N legen (fromimg rastet nur auf die Palette ein)
    cnt = Counter(v for r in c.g[:h] for v in r[:w] if v)
    if len(cnt) > a.farben:
        keep = [k for k, _ in cnt.most_common(a.farben)]
        rgb = lambda v: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
        near = {v: min(keep, key=lambda k: sum((p - q) ** 2 for p, q in zip(rgb(v), rgb(k)))) for v in cnt if v not in keep}
        for y in range(h):
            for x in range(w):
                if c.g[y][x] in near: c.g[y][x] = near[c.g[y][x]]
    if a.outline: c.outline(stil.get('outlineFarbe', '#060608'))
    zeichnen.clean(c)
    out = Image.new('RGBA', (w, h))
    for y in range(h):
        for x in range(w):
            v = c.g[y][x]
            if v: out.putpixel((x, y), tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    out.save(a.aus)
    print(a.aus, f'{w}x{h}', len({c.g[y][x] for y in range(h) for x in range(w)}), 'Farben;', pix, '(vor Feinschliff)')


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sp = ap.add_subparsers(dest='cmd', required=True)
p = sp.add_parser('vorbelichten'); p.add_argument('ein'); p.add_argument('aus'); p.add_argument('--ziel', type=int, default=1024)
p.add_argument('--blur', type=float, default=3); p.add_argument('--korn', type=float, default=10); p.add_argument('--seed', type=int, default=1); p.set_defaults(f=vorbelichten)
p = sp.add_parser('workflow'); p.add_argument('weg', choices=['aplus', 'b']); p.add_argument('--bild'); p.add_argument('--prompt', required=True)
p.add_argument('--negativ', default='text, letters, logo, watermark, signature, blurry, smooth gradients, 3d render, photo, jpeg artifacts, deformed')
p.add_argument('--denoise', type=float); p.add_argument('--lora', default='pixel-art-xl.safetensors:0.8'); p.add_argument('--ckpt', default='sd_xl_base_1.0.safetensors')
p.add_argument('--breite', type=int, default=1024); p.add_argument('--hoehe', type=int, default=1024); p.add_argument('--seed', type=int, default=1); p.add_argument('--prefix', default='npx/veredelt'); p.set_defaults(f=workflow)
p = sp.add_parser('snap'); p.add_argument('ein'); p.add_argument('aus'); p.add_argument('--breite', type=int, required=True); p.add_argument('--farben', type=int, default=24)
p.add_argument('--crop'); p.add_argument('--stil', default='.claude/nomadpixel-stil.json'); p.add_argument('--outline', action='store_true'); p.set_defaults(f=snap)
a = ap.parse_args(); a.f(a)
