# Gefangener (#079) – 64x64 Symbol, NomadPixel Direkt-Modus. Palette AAP-64, Licht oben links.
import sys, math
sys.path.insert(0, ".claude/skills/nomadpixel/scripts")
import zeichnen as Z
Z.T = 64
from zeichnen import C, to_pix, grain, speckle, inner_line, rim

SKIN  = ["#5b3138", "#8e5252", "#ba756a", "#e9b5a3"]
HAIR  = ["#793a80", "#793a80", "#bc4a9b", "#e86a73"]
JACK  = ["#141013", "#322b28", "#71413b", "#bb7547"]
PANTS = ["#242234", "#333941", "#4a5462"]
METAL = ["#6d758d", "#8b93af", "#b3b9d1", "#dae0ea"]
BOOT  = ["#141013", "#322b28", "#71413b"]
ROPE  = ["#a08662", "#a08662", "#c7b08b", "#e4d2aa"]
DARK  = "#060608"

c = C()
# legs crossed (sitting): two thighs + shins as a wide oval
c.rellipse(22, 52, 13, 6, 0.15, PANTS)
c.rellipse(41, 52, 13, 6, -0.15, PANTS)
c.ellipse(31, 55, 16, 5, PANTS)
# boots peeking out left and right
c.rellipse(10, 55, 5, 4, -0.3, BOOT)
c.rellipse(53, 55, 5, 4, 0.3, BOOT)
# torso: leather jacket
c.shade_mask(lambda x, y: 18 <= x <= 44 and 27 <= y <= 49 and ((x-31)/14)**2 + ((y-40)/14)**2 <= 1.15, JACK)
# open collar: dark shirt V
for y in range(28, 38):
    w = max(0, (38 - y) // 2)
    for x in range(31 - w, 32 + w): c.set(x, y, PANTS[0])
# shoulder pads (metal)
c.ellipse(20, 31, 6, 4, METAL)
c.ellipse(42, 31, 6, 4, METAL)
# neck
c.rect(28, 23, 34, 27, SKIN[1])
# head
c.ellipse(31, 16, 8, 9, SKIN)
# shaved sides (stubble a step darker) and a spiky mohawk
for y in range(8, 14):
    for x in range(24, 39):
        if c.get(x, y) in SKIN and abs(x - 31) > 2: c.set(x, y, SKIN[max(0, SKIN.index(c.get(x, y)) - 1)])
spikes = [(28, 3), (30, 0), (32, 1), (34, 4)]
for sx, top in spikes:
    for y in range(top, 11):
        w = (y - top) // 3
        for x in range(sx - w, sx + w + 2):
            if 27 <= x <= 35: c.set(x, y, HAIR[3] if x <= sx - w and y < top + 4 else HAIR[2] if x <= sx else HAIR[1] if y < 9 else HAIR[0])
# arms: upper arms down the sides, forearms in front, wrists crossed at the belly
c.thick(20, 33, 22, 43, 6, JACK)
c.thick(42, 33, 40, 43, 6, JACK)
c.thick(22, 42, 33, 45, 5, JACK)
c.thick(40, 42, 30, 45, 5, JACK)
# forearms: light top edge, dark underside, so they stand off the torso
c.line(22, 41, 28, 42, JACK[3]); c.line(40, 41, 35, 42, JACK[3])
c.line(22, 45, 27, 47, JACK[0]); c.line(40, 45, 36, 47, JACK[0])
c.line(19, 36, 19, 44, JACK[0]); c.line(43, 36, 43, 44, JACK[0])
# fists, knuckles towards us
c.ellipse(26, 45, 4, 3, SKIN)
c.ellipse(37, 45, 4, 3, SKIN)
for kx in (24, 26, 28): c.set(kx, 46, SKIN[0])
for kx in (35, 37, 39): c.set(kx, 46, SKIN[0])
# rope: three turns across both wrists, knot below, loose end over the knee
for k, y in enumerate((42, 44, 46)):
    for x in range(29, 35):
        c.set(x, y, ROPE[3] if x < 31 else ROPE[2] if x < 33 else ROPE[1])
    c.set(28, y, JACK[1]); c.set(35, y, JACK[1])
for y in (43, 45): 
    for x in range(29, 35): c.set(x, y, JACK[1])
c.ellipse(32, 49, 2, 2, ROPE)
c.line(33, 51, 37, 55, ROPE[1]); c.line(37, 55, 41, 61, ROPE[2]); c.set(41, 61, ROPE[3])
# face: angry brows, eyes, gritted teeth, scar
c.line(26, 13, 29, 15, DARK); c.line(36, 13, 33, 15, DARK)
for ex in (27, 34):
    c.set(ex, 16, METAL[3]); c.set(ex + 1, 16, DARK)
c.set(31, 18, SKIN[0]); c.set(31, 19, SKIN[0])
c.rect(28, 21, 34, 21, METAL[3]); c.line(28, 20, 34, 20, DARK); c.line(28, 22, 34, 22, SKIN[0])
for tx in (30, 32): c.set(tx, 21, METAL[1])
c.line(34, 15, 36, 19, SKIN[3])
# ear
c.ellipse(23, 17, 1, 2, SKIN)
# ---------- detail round ----------
grain(c, JACK[1:3], math.radians(75), period=3.0, seed=5, strength=0.35)   # creased leather, only the mid tones
grain(c, PANTS, math.radians(10), period=2.6, seed=8, strength=0.45)   # cloth folds
speckle(c, PANTS, density=0.12, seed=8)
speckle(c, METAL, density=0.12, seed=13)

grain(c, ROPE[1:], math.radians(90), period=2.0, seed=4)   # rope fibres
# trouser folds and knee light
for (x0, y0, x1, y1) in ((14, 52, 22, 49), (40, 49, 48, 52), (24, 57, 31, 55), (33, 55, 39, 57)): c.line(x0, y0, x1, y1, PANTS[0])
for (x, y) in ((17, 49), (18, 49), (19, 48), (44, 48), (45, 48)): c.set(x, y, PANTS[2])
# metal pads: hard highlight + scratches + rivets
for (x, y) in ((17, 29), (18, 29), (39, 29), (40, 29)): c.set(x, y, METAL[3])
c.line(21, 32, 23, 31, METAL[0]); c.line(43, 32, 45, 30, METAL[0])
for (x, y) in ((16, 32), (24, 33), (38, 32), (46, 33)): c.set(x, y, DARK)
# jacket: zipper line and a patch with the gang mark
for y in range(38, 48, 2): c.set(31, y, METAL[1])
c.rect(38, 36, 41, 39, HAIR[1]); c.set(39, 37, HAIR[3]); c.set(40, 38, HAIR[3])
# stubble on the chin, a bruise under the eye
for (x, y) in ((27, 22), (29, 23), (31, 23), (33, 23), (35, 22), (28, 23), (34, 23)): c.set(x, y, SKIN[0])
c.set(35, 17, HAIR[0]); c.set(36, 17, SKIN[0])
# shoulder plates: two seams with rivets
for (x0, x1, y) in ((15, 25, 31), (16, 24, 33), (37, 47, 31), (38, 46, 33)):
    for x in range(x0, x1 + 1):
        if c.get(x, y) in METAL: c.set(x, y, METAL[0] if (x + y) % 5 else DARK)
# jacket: stitches along the lapels, a chest pocket with a flap
for y in range(29, 38):
    for x in (30 - (38 - y) // 2 - 1, 32 + (38 - y) // 2):
        if y % 2 and c.get(x, y) in JACK: c.set(x, y, JACK[3])
c.rect(22, 35, 27, 35, JACK[0]); c.rect(22, 36, 27, 38, JACK[2]); c.line(22, 39, 27, 39, JACK[0]); c.set(24, 36, METAL[2])
# knee patch with cross stitches
c.rect(17, 49, 22, 52, BOOT[2]); c.line(17, 48, 22, 48, PANTS[0]); c.line(16, 49, 16, 52, PANTS[0])
for x in (18, 20, 22): c.set(x, 49, ROPE[2]); c.set(x, 52, ROPE[2])
# mohawk strands
c.line(29, 5, 29, 9, HAIR[0]); c.line(31, 2, 31, 7, HAIR[3]); c.line(33, 5, 33, 9, HAIR[0])
# boots: laces and a lighter sole edge
for (x, y) in ((8, 53), (10, 52), (55, 53), (53, 52)): c.set(x, y, METAL[1])
c.line(6, 58, 13, 59, BOOT[2]); c.line(50, 59, 57, 58, BOOT[2])
# seams between parts
inner_line(c, SKIN, JACK, SKIN[0])
inner_line(c, METAL, JACK, JACK[0])
inner_line(c, JACK, PANTS, JACK[0])
c.outline(DARK)
to_pix([("gefangener", c)], "output/nomadpixel/gefangener/gefangener.pix", "icon = 64\ncols = 1\nbg = #2a2034")
