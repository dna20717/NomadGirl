# Generator for the parcours of the test room (Daniel, 07.11.2026: bigger, no enemies, jumps and obstacles).
# python3 tools/parcours_layout.py  prints the layout; then: node tools/ng.js set rooms testraum layout '<json>'
# Leyla jumps 2.7 tiles high / 4.3 far, with double jump ~5 high / ~7 far, slides through 2-tile tunnels.
# Floor top at row F; heights count upwards from the floor.
W, H, F = 170, 24, 18
g = [['.'] * W for _ in range(H)]
def put(c, x, y):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
def block(x0, x1, h0, h1, c='#'):          # columns x0..x1, heights h0..h1 above the floor (h=1 = first row above)
    for x in range(x0, x1 + 1):
        for h in range(h0, h1 + 1): put(c, x, F - h)
def pit(x0, x1, depth):                      # remove floor
    for x in range(x0, x1 + 1):
        for d in range(depth): put('.', x, F + d)
def ladder(x, h_top, h_bottom=1):            # from h_bottom up to h_top (top rung = standable)
    for h in range(h_bottom, h_top + 1): put('H', x, F - h)
for x in range(W): put('#', x, 0)
for y in range(H): put('#', 0, y); put('#', W - 1, y)
for y in range(F, H):
    for x in range(W): put('#', x, y)

put('L', 8, F - 1)                            # van + start
# 1) hurdles: 1 high, 1 high, 2 high
block(16, 16, 1, 1); block(20, 21, 1, 1); block(24, 25, 1, 2)
# 2) pit (3 wide, 3 deep) with a ladder out
pit(30, 33, 3); ladder(33, 0, -2)
# 3) slide tunnel: 2 rows free under a massive block
block(38, 47, 3, 16)
# 4) stairs 2/4 high, a 4-high wall needs the double jump
block(51, 53, 1, 2); block(54, 56, 1, 4); block(57, 66, 1, 6)
# 5) double-jump gap (6 wide) to the next plateau, ladder below to get back up
block(73, 80, 1, 6); ladder(73 - 1, 6)
# 6) rope over a 10-wide gap
put('o', 85, F - 11); block(91, 99, 1, 6); ladder(90, 6)
# 7) zigzag of platforms up to a high ledge, then down
for x0, h in [(103, 2), (106, 4), (103, 6), (106, 8), (103, 10), (106, 12)]:
    for x in range(x0, x0 + 3): put('=', x, F - h)
block(109, 117, 1, 12)
# 8) wide pit (8 wide, 3 deep): double jump + dash; ladder out
pit(124, 131, 3); ladder(131, 0, -2)
# 9) low ceiling run: hurdles under a ceiling (jump carefully), then a platform staircase to the goal
block(136, 150, 6, 16); block(140, 140, 1, 1); block(145, 146, 1, 1)
for i, x0 in enumerate([153, 156, 159]):
    for x in range(x0, x0 + 3): put('=', x, F - 2 * (i + 1))
block(162, 168, 1, 8)
print('\n'.join(''.join(r) for r in g))
