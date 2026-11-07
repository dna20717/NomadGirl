# Leyla's van from Daniel's GIF: python3 tools/van_strips.py projects/nomadgirl/assets/vehicles/van_door_source.gif projects/nomadgirl/assets/vehicles
# builds van strip (dish removed), dish rotation strip, roof foreground strip
import sys, math
import numpy as np
from PIL import Image
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src)
F = []
for i in range(im.n_frames):
    im.seek(i); F.append(np.array(im.convert('RGBA')))
SHIFT = [(0, 0), (0, 0), (2, 2), (2, 1), (0, 0)]   # body bob per frame (wheels stay)
CX, CY, W, H = 4, 33, 248, 172                      # crop box
# dish in frame 0: box x 95..123, y 40..62 minus the stand (x 97..104, y >= 59)
def dish_mask(dx, dy):
    m = np.zeros(F[0].shape[:2], bool)
    for y in range(40, 63):
        for x in range(95, 124):
            if 97 <= x <= 104 and y >= 59: continue
            m[y + dy, x + dx] = True
    return m
m0 = dish_mask(0, 0) & (F[0][:, :, 3] > 0)
ys, xs = np.nonzero(m0)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
print('dish box', bx0, bx1, by0, by1)
dish = np.zeros_like(F[0][by0:by1 + 1, bx0:bx1 + 1]); 
sub = F[0][by0:by1 + 1, bx0:bx1 + 1].copy(); sub[~m0[by0:by1 + 1, bx0:bx1 + 1]] = 0
PIV = 101            # vertical axis (stand)
# van frames without dish
strip = Image.new('RGBA', (W * len(F), H))
for i, f in enumerate(F):
    f = f.copy(); dx, dy = SHIFT[i]
    f[dish_mask(dx, dy)] = 0
    strip.paste(Image.fromarray(f[CY:CY + H, CX:CX + W]), (i * W, 0))
strip.save(f'{outdir}/van_door.png')
# dish rotation: frames of equal size, pivot column in the middle
N = 16
half = max(PIV - bx0, bx1 - PIV) + 1
DW, DH = 2 * half + 1, sub.shape[0]
ds = Image.new('RGBA', (DW * N, DH))
for k in range(N):
    th = 2 * math.pi * k / N; c = math.cos(th)
    out = np.zeros((DH, DW, 4), np.uint8)
    cc = c if abs(c) >= 0.14 else math.copysign(0.14, c if c else 1)
    for X in range(DW):
        sx = PIV + (X - half) / cc          # source column
        sxi = int(round(sx)) - bx0
        if 0 <= sxi < sub.shape[1]:
            col = sub[:, sxi].copy()
            if c < 0: col[:, :3] = (col[:, :3] * 0.72).astype(np.uint8)   # back side darker
            out[:, X] = np.where(col[:, 3:4] > 0, col, out[:, X])
    ds.paste(Image.fromarray(out), (k * DW, 0))
ds.save(f'{outdir}/van_dish.png')
print('dish frame', DW, DH, 'origin', half + 0.5, DH, 'at (crop px)', PIV + 0.5 - CX, by1 + 1 - CY)
# roof foreground: front rail rows 76..80, x 26..127, per frame shifted with the body
fg = Image.new('RGBA', (W * len(F), H))
for i, f in enumerate(F):
    dx, dy = SHIFT[i]; g = np.zeros_like(f)
    g[76 + dy:81 + dy, 26 + dx:128 + dx] = f[76 + dy:81 + dy, 26 + dx:128 + dx]
    fg.paste(Image.fromarray(g[CY:CY + H, CX:CX + W]), (i * W, 0))
fg.save(f'{outdir}/van_roof_front.png')
