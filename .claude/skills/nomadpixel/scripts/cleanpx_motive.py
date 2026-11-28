"""Motive für das Clean-Pixel-LoRA (px8): breite, markenfreie Mischung, reproduzierbar per Seed.
usage: cleanpx_motive.py ANZAHL SEED > charge.json   ->  [{"id", "prompt", "w", "h", "seed"}]"""
import json, random, sys

DINGE = ['old radio', 'treasure chest', 'potion bottle', 'backpack', 'oil lamp', 'toolbox', 'crt monitor', 'wooden barrel', 'rusty robot', 'cactus in a pot',
         'teapot', 'sword', 'shield', 'key', 'mushroom', 'campfire', 'tent', 'bicycle', 'vintage car', 'pickup truck', 'camper van', 'rowing boat', 'hot air balloon',
         'lighthouse', 'windmill', 'small house', 'water tower', 'street lamp', 'vending machine', 'arcade cabinet', 'jukebox', 'typewriter', 'telephone booth',
         'satellite dish', 'gas canister', 'generator', 'crate of apples', 'bread loaf', 'cupcake', 'bowl of ramen', 'fried egg', 'watermelon', 'sushi plate',
         'houseplant', 'bonsai tree', 'sunflower', 'pine tree', 'palm tree', 'crystal cluster', 'gemstone', 'gold coins', 'book stack', 'scroll', 'magic wand',
         'helmet', 'boots', 'jacket', 'umbrella', 'guitar', 'drum', 'camera', 'headphones', 'game controller', 'skateboard', 'kite', 'anchor', 'compass', 'lantern']
WESEN = ['fox', 'cat', 'owl', 'frog', 'turtle', 'crab', 'rabbit', 'bear', 'deer', 'raccoon', 'slime monster', 'tiny dragon', 'ghost', 'mushroom creature',
         'robot companion', 'alien critter', 'golem', 'jellyfish', 'bat', 'snail']
LEUTE = ['knight', 'wizard', 'scavenger in a hooded coat', 'mechanic with goggles', 'farmer', 'chef', 'pilot', 'detective in a trench coat', 'old fisherman',
         'girl with a backpack', 'boy with a cap', 'astronaut', 'ninja', 'pirate', 'archer', 'shopkeeper', 'nurse', 'skater', 'musician', 'explorer']
ORTE = ['cozy living room', 'junkyard', 'desert outpost', 'forest clearing', 'rainy city street at night', 'mountain lake', 'small harbor', 'space station corridor',
        'underground cave with crystals', 'diner interior', 'workshop interior', 'rooftop garden', 'train station', 'snowy village', 'swamp hut', 'beach at sunset']
FARBE = ['warm colors', 'cool colors', 'muted colors', 'vibrant colors', 'earthy tones', 'pastel colors', 'night lighting', 'golden hour light']
ANSICHT_DING = ['front view', 'three-quarter view', 'side view', 'isometric view']
ANSICHT_FIGUR = ['standing, full body, front view', 'standing, full body, side view', 'walking pose, full body', 'idle pose, full body, three-quarter view']


def motiv(r, i):
    art = r.choices(['ding', 'wesen', 'figur', 'ort'], [0.35, 0.2, 0.25, 0.2])[0]
    if art == 'ding':
        p = f"single {r.choice(DINGE)}, game item, {r.choice(ANSICHT_DING)}, isolated on a plain background, {r.choice(FARBE)}"; w, h = 1024, 1024
    elif art == 'wesen':
        p = f"cute {r.choice(WESEN)}, game sprite, {r.choice(ANSICHT_FIGUR)}, isolated on a plain background, {r.choice(FARBE)}"; w, h = 1024, 1024
    elif art == 'figur':
        p = f"{r.choice(LEUTE)}, game character sprite, {r.choice(ANSICHT_FIGUR)}, isolated on a plain background, {r.choice(FARBE)}"; w, h = 832, 1216
    else:
        p = f"{r.choice(ORTE)}, game background scene, detailed, {r.choice(FARBE)}"; w, h = 1216, 832
    return {'id': f'm{i:04d}_{art}', 'prompt': 'pixel art, ' + p, 'caption': 'px8 pixel art, ' + p, 'w': w, 'h': h, 'seed': r.randrange(1 << 30)}


if __name__ == '__main__':
    n, seed = int(sys.argv[1]), int(sys.argv[2])
    r = random.Random(seed)
    print(json.dumps([motiv(r, seed * 10000 + i) for i in range(n)]))
