# Cut Daniel's Leyla GIFs (256 x 256, feet at row 251) into strips with a shared box per animation.
# python3 tools/leyla_strips.py <src.gif> <out.png> <x0> <y0> <w> <h>
import sys
from PIL import Image
src, out, x0, y0, w, h = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
im = Image.open(src)
strip = Image.new('RGBA', (w * im.n_frames, h))
for i in range(im.n_frames):
    im.seek(i); strip.paste(im.convert('RGBA').crop((x0, y0, x0 + w, y0 + h)), (i * w, 0))
strip.save(out); print(out, im.n_frames, 'frames', w, 'x', h)
