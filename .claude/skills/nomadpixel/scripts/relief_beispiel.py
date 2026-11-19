"""Beispiele für Relief-Licht (relief.py): Ölfass, Gasflaschen, Schaltkasten, Zahnrad, Feuerlöscher, Rohr mit Handrad.
Ausführen schreibt relief_beispiel.png (+ _x4) ins aktuelle Verzeichnis. Als Vorlage für eigene Objekte."""
import sys, math
import numpy as np
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from relief import Relief
from PIL import Image
STAHL = ["#141013", "#221c1a", "#333941", "#4a5462", "#6d758d", "#8b93af", "#b3b9d1"]
ROST = ["#221c1a", "#322b28", "#5b3138", "#71413b", "#8e5252", "#bb7547", "#dba463"]
ORANGE = ["#3b1725", "#73172d", "#b4202a", "#df3e23", "#fa6a0a", "#f9a31b"]
GRUEN = ["#122020", "#24523b", "#23674e", "#328464", "#5daf8d"]
ROT = ["#221c1a", "#3b1725", "#73172d", "#b4202a", "#df3e23"]
GELB = ["#322b28", "#71413b", "#bb7547", "#dba463", "#f4d29c"]

def fass():
    r = Relief()
    r.mat("rost", ROST, glanz=0.25, rau=0.5, hart=18)
    r.mat("lack", ORANGE, glanz=0.35, rau=0.1, hart=20)
    r.mat("rost2", ["#221c1a", "#3b1725", "#71413b", "#bb7547"], glanz=0.1)
    r.zylinder(12, 8, 51, 62, "rost", tiefe=16)
    r.farbe(lambda X, Y: (Y > 29) & (Y < 41) & ((X < 40) | (Y < 33) | (Y > 38)), "lack")
    for y in (25, 44): r.wulst(12, y, 51, y, hoehe=2.2, breite=2)
    r.wulst(12, 9, 51, 9, hoehe=2.5, breite=2); r.wulst(12, 61, 51, 61, hoehe=2.5, breite=2)
    r.struktur("rost", 0.2, korn=3, seed=3)
    r.struktur("lack", 0.1, korn=4, seed=4)
    for (x, y) in ((30, 34), (31, 35), (32, 34), (31, 33)): r.fest(x, y, "#141013")
    for (x, y, L) in ((18, 26, 6), (44, 45, 9), (26, 45, 4)):      # Rostläufer: Material, Höhe leicht eingedrückt
        r.farbe(lambda X, Y, x=x, y=y, L=L: (abs(X - x - .5) < 1) & (Y > y) & (Y < y + L), "rost2")
    return r

def gas():
    r = Relief()
    r.mat("gruen", GRUEN, glanz=0.45, rau=0.15, hart=30)
    r.mat("stahl", STAHL, glanz=0.6, rau=0.15, hart=26)
    r.mat("gelb", GELB, glanz=0.3, rau=0.1)
    for x0, m in ((16, "gruen"), (33, "stahl")):
        r.zylinder(x0, 12, x0 + 13, 62, m, tiefe=7)
        r.kugel(x0 + 7, 13, 7, 5, m, tiefe=7)
        r.kasten(x0 + 4, 2, x0 + 9, 8, "stahl", tiefe=4, fase=1, z=5)
        r.linie(x0 + 9, 5, x0 + 12, 5, "stahl", dicke=2, tiefe=2, z=6)
        r.farbe(lambda X, Y, x0=x0: (Y >= 15) & (Y < 17) & (X >= x0) & (X <= x0 + 14), "gelb")
        r.struktur(m, 0.2, korn=3, seed=x0)
    for x in range(14, 49, 3): r.linie(x, 31, x + 2, 31, "stahl", dicke=1.6, tiefe=1.5, z=9)
    return r

def kasten():
    r = Relief()
    r.mat("blech", STAHL[:-1], glanz=0.35, rau=0.15, hart=20)
    r.mat("dunkel", ["#141013", "#242234", "#333941", "#4a5462"], glanz=0.3)
    r.mat("glas", ["#4a5462", "#8b93af", "#b3b9d1", "#dae0ea", "#ffffff"], glanz=0.9, hart=40)
    r.mat("gelb", GELB, glanz=0.2)
    r.kasten(28, 50, 35, 62, "blech", tiefe=4, fase=1)          # Fuß
    r.kasten(21, 59, 42, 62, "blech", tiefe=5, fase=1)
    r.kasten(13, 5, 50, 50, "blech", tiefe=8, fase=2)           # Gehäuse
    r.kasten(17, 9, 46, 46, "blech", tiefe=2, fase=1, z=7)      # Tür steht etwas vor
    r.rille(17, 9, 46, 9, tiefe=2); r.rille(17, 46, 46, 46, tiefe=2); r.rille(17, 9, 17, 46, tiefe=2); r.rille(46, 9, 46, 46, tiefe=2)
    for gx in (25, 38):                                          # Rundinstrumente
        r.ring(gx, 18, 4.2, 6, "dunkel", tiefe=2, z=9)
        r.scheibe(gx, 18, 4.2, "glas", tiefe=1, fase=1, z=8)
    for x in range(22, 43, 5):
        r.kasten(x, 34, x + 3, 38, "dunkel", tiefe=2, fase=1, z=9)
    r.linie(43, 24, 43, 32, "dunkel", dicke=2.5, tiefe=2, z=10)   # Griff
    r.kasten(33, 40, 42, 45, "gelb", tiefe=1, fase=0, z=9)
    for (x, y) in ((15, 7), (48, 7), (15, 48), (48, 48)): r.niete(x, y, "blech")
    r.struktur("blech", 0.15, korn=4, seed=7)
    r.fest(23, 28, "#59c135"); r.fest(23, 29, "#14a02e"); r.fest(29, 28, "#df3e23"); r.fest(29, 29, "#b4202a")
    r.fest(25, 18, "#141013"); r.fest(26, 17, "#b4202a"); r.fest(27, 16, "#b4202a")
    r.fest(38, 18, "#141013"); r.fest(39, 19, "#b4202a"); r.fest(40, 20, "#b4202a")
    for (x, y) in ((36, 44), (37, 43), (38, 42), (39, 43), (40, 44)): r.fest(x, y, "#141013")
    return r

def zahnrad():
    r = Relief()
    r.mat("guss", ["#221c1a", "#322b28", "#5b3138", "#71413b", "#8e5252", "#bb7547", "#dba463"], glanz=0.3, rau=0.3)
    r.mat("kante", ["#141013", "#221c1a", "#322b28", "#5b3138"], glanz=0.1)
    r.mat("stahl", STAHL[:-1], glanz=0.5)
    cx, cy, R = 31, 29, 19
    def m(X, Y, ox=0, oy=0):
        a = np.arctan2(Y - cy - oy, X - cx - ox); d = np.hypot(X - cx - ox, Y - cy - oy)
        f = (a / (2 * math.pi) * 10) % 1                       # 10 Zähne
        breit = np.abs(f - 0.5) * 2                              # 0 Mitte des Zahns … 1 Lücke
        zahn = d <= R - 3 + 6 * np.clip((0.75 - breit) / 0.35, 0, 1) * (d > R - 4)
        loch = np.zeros_like(d, bool)
        for k in range(5):
            b = math.radians(k * 72 - 90); loch |= np.hypot(X - cx - ox - math.cos(b) * 10.5, Y - cy - oy - math.sin(b) * 10.5) < 3.3
        return ((d <= R - 3) | zahn) & ~loch
    r.kasten(12, 53, 51, 62, "stahl", tiefe=6, fase=2)          # Bock: Fuß
    r.kasten(25, 44, 38, 54, "stahl", tiefe=5, fase=2)           # Bock: Stütze
    r.scheibe(cx + 2, cy + 2, R, "kante", tiefe=4, fase=1, z=2, maske=lambda X, Y: m(X, Y, 2, 2))   # Seitenkante = Dicke
    r.scheibe(cx, cy, R, "guss", tiefe=5, fase=2, z=6, maske=m)
    r.ring(cx, cy, 5, 7.5, "guss", tiefe=2, z=10)
    r.scheibe(cx, cy, 4.5, "stahl", tiefe=3, fase=2, z=11)
    r.struktur("guss", 0.25, korn=2, seed=5)
    r.fest(31, 29, "#141013"); r.fest(30, 29, "#141013")
    return r

def loescher():
    r = Relief()
    r.mat("rot", ROT, glanz=0.6, hart=30, rau=0.1)
    r.mat("dunkel", ["#141013", "#242234", "#333941", "#4a5462", "#6d758d"], glanz=0.5)
    r.mat("etikett", ["#8b93af", "#b3b9d1", "#dae0ea", "#ffffff"], glanz=0.1)
    r.zylinder(25, 18, 38, 62, "rot", tiefe=7)
    r.kugel(31.5, 18, 7, 5, "rot", tiefe=7)
    r.kasten(29, 8, 34, 14, "dunkel", tiefe=4, fase=1, z=7)
    r.linie(34, 9, 40, 7, "dunkel", dicke=2, tiefe=2, z=10)
    r.linie(29, 12, 22, 20, "dunkel", dicke=2, tiefe=2, z=9); r.linie(22, 20, 22, 42, "dunkel", dicke=2, tiefe=2, z=9)
    r.farbe(lambda X, Y: (X >= 26) & (X <= 37) & (Y >= 34) & (Y <= 44), "etikett")
    for x in range(27, 37): r.fest(x, 36, "#b4202a")
    for x in range(27, 34): r.fest(x, 40, "#4a5462")
    return r

def handrad():
    r = Relief()
    r.mat("stahl", STAHL[:-1], glanz=0.5, rau=0.15)
    r.mat("rot", ROT, glanz=0.5, hart=24)
    r.zylinder(26, 6, 37, 62, "stahl", tiefe=6)
    r.kasten(22, 56, 41, 62, "stahl", tiefe=8, fase=2); r.kasten(22, 3, 41, 9, "stahl", tiefe=8, fase=2)
    r.kasten(22, 26, 41, 32, "stahl", tiefe=9, fase=2)
    for x in (24, 30, 36): r.niete(x, 58, "stahl"); r.niete(x, 5, "stahl")
    cx, cy = 31.5, 19
    r.linie(31.5, 19, 31.5, 26, "stahl", dicke=3, tiefe=3, z=9)
    for a in range(0, 360, 60):
        r.linie(cx, cy, cx + math.cos(math.radians(a)) * 10, cy + math.sin(math.radians(a)) * 10, "rot", dicke=2, tiefe=2, z=11)
    r.ring(cx, cy, 9.5, 12.5, "rot", tiefe=3, z=11)
    r.scheibe(cx, cy, 3, "stahl", tiefe=2, fase=1, z=12)
    r.struktur("stahl", 0.2, korn=3, seed=9)
    return r

ALTER = 0.8

def sheet(objs, path):
    im = Image.new("RGBA", (64 * len(objs), 64), (0, 0, 0, 0))
    for i, o in enumerate(objs):
        o.render(alter=ALTER); t = o.png("/tmp/_o.png"); im.alpha_composite(t, (64 * i, 0))
    im.save(path)
    bg = Image.new("RGBA", im.size, (58, 52, 64, 255)); bg.alpha_composite(im); bg.resize((im.width * 4, 256), Image.NEAREST).save(path.replace(".png", "_x4.png"))

if __name__ == "__main__":
    sheet([fass(), gas(), kasten(), zahnrad(), loescher(), handrad()], "relief_beispiel.png")
