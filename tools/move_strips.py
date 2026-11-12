#!/usr/bin/env python3
"""Leyla's moves, round 2 (Daniel, 12.11.2026: „Doppelsprung mit einer vernünftigen, hübschen Animation, Slide dynamischer,
Leiter runterrutschen in der Pose, die Menschen im U-Boot einnehmen“).

Sources (assets/leyla/*_source.png): the raw PixelLab frames, 256 × 256 each, one after another, feet at (128, 244)
(ladder: 250). Made with Edit Pro Flash (key poses: somersault tuck, floor slide, submarine pose) and Animate Image
(transitions with the first and last frame pinned, loops pinned on the same pose).
This script snaps the frames onto Leyla's colours (tools/rifle_strips.py), cuts the empty border that no frame uses
and writes the strips. Prints frame size, frames and anchor for assets.json.

    python3 tools/move_strips.py
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from rifle_strips import palette, snap, L  # noqa: E402

# out: (source, frames, anchor x, anchor y in the 256 frame, frames to put down on the ground (PixelLab lifted the slide pose ~21 px))
STRIPS = {
    # entry 1–3, tuck 4–5 (turned by code), opening up 6–8
    'flip2_side': ('flip2_side_source.png', range(0, 8), 128, 244),
    # drop in 1–3, slide loop 4–9, get up 10–13
    'slide2_side': ('slide2_side_source.png', range(0, 13), 128, 244, range(3, 11)),
    # take the pose 1–3, sliding loop 4–7
    'ladder_slide_back': ('ladder_slide_back_source.png', range(0, 7), 128, 250),
}


def main():
    pal, cache = palette(), {}
    for out, (src, take, ax, ay, *rest) in STRIPS.items():
        ground = set(rest[0]) if rest else set()
        im = Image.open(os.path.join(L, src)).convert('RGBA')
        n = im.width // 256
        frames = [snap(im.crop((i * 256, 0, i * 256 + 256, 256)), pal, cache) for i in take if i < n]
        for i in ground:   # bottom of the picture onto the feet line
            b = frames[i].getbbox()
            if b and b[3] < ay:
                g = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); g.paste(frames[i], (0, ay - b[3])); frames[i] = g
        box = None
        for f in frames:
            b = f.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        x0, y0, x1, y1 = box[0] - 2, box[1] - 2, box[2] + 2, max(box[3], ay + 2)
        w, h = x1 - x0, y1 - y0
        strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f.crop((x0, y0, x1, y1)), (i * w, 0))
        strip.save(os.path.join(L, out + '.png'))
        print(f'{out}: frame {w} x {h}, {len(frames)} frames, anchor [{ax - x0}, {ay - y0}]')


if __name__ == '__main__':
    main()
