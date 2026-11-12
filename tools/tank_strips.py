#!/usr/bin/env python3
"""The cryo tank (Daniel, 12.11.2026): stills per phase and their loops, from the raw PixelLab frames in
projects/nomadgirl/assets/workshops/cryotank/source/ (256 x 256 each).

  still_<n>.png        the phase pictures (1 stable … 5 alarm, dead), copied as cryotank_<n>.png
  loop_<n>_<i>.png     animate_image frames of a phase (frame 0 = the still); `take` picks and orders them
  hand_<n>.png         overlay: only the pixels of her hand at the glass (phase 1) / the handprint in the frost (phase 2),
                       cut from hand_variant_<n>.png against the still; faded in by the game now and then

The frame of the tank must not shimmer: inside `mask` (picture pixels) the animated frame is used, outside the still.
Run: python3 tools/tank_strips.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'workshops')
SRC = os.path.join(ROOT, 'cryotank', 'source')
GLASS = (84, 57, 173, 188)
# name: (still, frames to take, mask or None = whole frame, fps)
LOOPS = {
    'loop_1': ('still_1', [0, 1, 2, 3, 4, 6, 7], GLASS, 4),        # frame 5 had a dark glitch at the rim
    'loop_2': ('still_2', [0, 1, 2, 3, 4, 5, 6, 7], GLASS, 4),
    'loop_3': ('still_3', [0, 1, 2, 3, 2, 1], GLASS, 4),           # the bright flash in the middle stays out
    'loop_4': ('still_4', [0, 1, 2, 3, 4, 5, 6, 7], None, 6),      # drips run down to the puddle: whole frame
    'loop_5': ('still_5', [0, 1, 2, 3, 4, 5, 6, 7], None, 6),
}


def frame(path, still, mask):
    f = Image.open(path).convert('RGBA')
    if not mask:
        return f
    out = still.copy()
    out.paste(f.crop(mask), mask[:2])
    return out


def main():
    for n in ['1', '2', '3', '4', '5', 'dead']:
        p = os.path.join(SRC, f'still_{n}.png')
        if os.path.exists(p):
            Image.open(p).convert('RGBA').save(os.path.join(ROOT, f'cryotank_{n}.png'))
    for n in ['1', '2']:
        p = os.path.join(SRC, f'hand_{n}.png')
        if os.path.exists(p):
            Image.open(p).convert('RGBA').save(os.path.join(ROOT, f'cryotank_hand_{n}.png'))
    for name, (still, take, mask, fps) in LOOPS.items():
        files = [os.path.join(SRC, f'{name}_{i}.png') for i in take]
        if not all(os.path.exists(f) for f in files):
            print(name, 'fehlt'); continue
        S = Image.open(os.path.join(SRC, still + '.png')).convert('RGBA')
        frames = [frame(f, S, mask) for f in files]
        strip = Image.new('RGBA', (256 * len(frames), 256))
        for i, f in enumerate(frames):
            strip.paste(f, (i * 256, 0))
        strip.save(os.path.join(ROOT, f'cryotank_{name}.png'))
        print(f'cryotank_{name}: {len(frames)} frames, {fps} fps')


if __name__ == '__main__':
    main()
