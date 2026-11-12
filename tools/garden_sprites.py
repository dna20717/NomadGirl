#!/usr/bin/env python3
"""Plants for the hydroponics (Daniel, 12.11.2026: „dass man erkennen kann, welche Pflanzen da wachsen“).

Four PixelLab candidates (assets/workshops/hydro/source/plants_<n>.png, 4 × 4 cells of 32 px: rows = crop, columns = stage)
are mixed into one sheet: cabbage, basil and chili from candidate 0; the tomato gets a sprout, a young plant, green (unripe)
tomatoes (the red fruit of a candidate recoloured in code) and the ripe one.
Run: python3 tools/garden_sprites.py → assets/workshops/hydro/plants.png
"""
import os
from PIL import Image

D = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'workshops', 'hydro')
C = 32
GREENS = [(36, 82, 59), (26, 122, 62), (20, 160, 46), (89, 193, 53), (156, 219, 67)]   # AAP-64 greens


def cell(n, row, col):
    im = Image.open(os.path.join(D, 'source', f'plants_{n}.png')).convert('RGBA')
    return im.crop((col * C, row * C, col * C + C, row * C + C))


def unripe(im):
    """red / orange fruit → green, keeping light and shade"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r > 60 and r > g * 1.35 and r > b * 1.2:
                lum = (r * 3 + g * 4 + b) / 8 / 255
                px[x, y] = (*GREENS[min(len(GREENS) - 1, int(lum * len(GREENS) * 1.3))], a)
    return im


def main():
    rows = [
        [cell(0, 0, c) for c in range(4)],                                  # mutant cabbage
        [cell(0, 1, c) for c in range(4)],                                  # basil
        [cell(0, 2, c) for c in range(4)],                                  # chili
        [cell(2, 0, 0), cell(0, 2, 0), unripe(cell(0, 3, 1)), cell(0, 3, 3)],   # tomato: sprout, young, green, ripe
    ]
    out = Image.new('RGBA', (4 * C, len(rows) * C), (0, 0, 0, 0))
    for r, cells in enumerate(rows):
        for c, im in enumerate(cells):
            out.paste(im, (c * C, r * C))
    out.save(os.path.join(D, 'plants.png'))
    print('plants.png', out.size)


if __name__ == '__main__':
    main()
