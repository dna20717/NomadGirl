# What every new node does (#110). b = bonus [(stat, value)], ws = workshops, rp = rig parts, fl = Merker, rv = Ort, soon = Wirkung folgt
E = {
 # Technik
 "schweissgeraet": dict(rp=["bleche"]), "werkzeugwand": dict(b=[("refund", 10)]), "rostschutz": dict(soon=1, fl="tt_rostschutz"),
 "stachelgitter": dict(rp=["stachelgitter"]), "werkbank2": dict(soon=1, fl="tt_werkbank2"), "drohnenwerkstatt": dict(ws=["drohnenwerkstatt"]),
 "akku2": dict(b=[("droneBattery", 20)]), "ladeluft": dict(b=[("fuel", 10)]), "lichtmaschine": dict(b=[("power", 1)]), "funkbake": dict(soon=1, fl="tt_funkbake"),
 "waffenmods": dict(b=[("ranged", 8)]), "solarfeld": dict(rp=["solarpaneel"], b=[("power", 2)]), "reaktor": dict(ws=["reaktor"]),
 "dachgeschuetz": dict(rp=["dachgeschuetz"]), "panzerplatten": dict(b=[("defense", 8)]), "greifarm": dict(soon=1, fl="tt_greifarm"),
 "heavy_duty": dict(ws=["heavy_duty"]), "crawler": dict(fl="crawler_lizenz", soon=1), "fatbird": dict(fl="fatbird_lizenz", soon=1),
 "schrottalchemie": dict(soon=1, fl="tt_schrottalchemie"), "overdrive": dict(b=[("fuel", 15)], soon=1, fl="tt_overdrive"),
 # Wissen
 "kartograf": dict(soon=1, fl="tt_kartograf"), "feilschen": dict(soon=1, fl="tt_feilschen"), "funkscanner": dict(fl="tt_funkscanner", soon=1),
 "marktkenntnis": dict(b=[("sell", 10)]), "navigator": dict(soon=1, fl="tt_navigator"), "kryptographie": dict(b=[("hack", 5)]),
 "sprachen": dict(fl="tt_sprachen", soon=1), "bitfarm": dict(ws=["bitfarm"]), "auftragsbuero": dict(ws=["auftragsbuero"]),
 "diplomatie": dict(soon=1, fl="tt_diplomatie"), "gangcodes": dict(soon=1, fl="tt_gangcodes"), "schaltplaene": dict(b=[("refund", 5)], soon=1),
 "netzwerk": dict(soon=1, fl="tt_netzwerk"), "tresorknacker": dict(b=[("loot", 10)], soon=1), "ripperdoc": dict(ws=["ripperdoc"]),
 "archaeologie": dict(fl="tt_archaeologie", soon=1), "schwarzmarkt": dict(fl="tt_schwarzmarkt", soon=1), "stoersender": dict(soon=1, fl="tt_stoersender"),
 "deltaarchiv": dict(fl="tt_deltaarchiv", soon=1), "bitlehre": dict(b=[("hack", 10)]), "stadtplan": dict(fl="tt_stadtplan", soon=1),
 "grossesbild": dict(soon=1, fl="tt_grossesbild"), "haendlerkoenig": dict(b=[("sell", 20)], soon=1),
 # Bio
 "hydrokultur": dict(ws=["hydrokultur"]), "feldsani": dict(b=[("heal", 20)]), "zisterne": dict(ws=["zisterne"]), "wildkraeuter": dict(soon=1, fl="tt_wildkraeuter"),
 "kompost": dict(b=[("growth", 15)]), "saatgut": dict(soon=1, fl="tt_saatgut"), "wasserfilter": dict(soon=1, fl="tt_wasserfilter"), "medkit": dict(soon=1, fl="tt_medkit"),
 "kueche": dict(ws=["kueche"]), "gewuerze": dict(b=[("perfect", 10)]), "pilzzucht": dict(soon=1, fl="tt_pilzzucht"), "mutantenbio": dict(soon=1, fl="tt_mutantenbio"),
 "schlaf": dict(b=[("sleepHeal", 25)]), "imkerei": dict(b=[("growth", 10)], soon=1), "fennekfreund": dict(fl="fennek_zahm", soon=1),
 "konservieren": dict(ws=["kuehlraum"]), "antitoxin": dict(soon=1, fl="tt_antitoxin"), "regeneration": dict(b=[("health", 10), ("regen", 1)]),
 "cryomedizin": dict(b=[("tankRescue", -25)]), "chirurgie": dict(soon=1, fl="tt_chirurgie"), "blutbank": dict(soon=1, fl="tt_blutbank"),
 "genlabor": dict(fl="tt_genlabor", soon=1), "serum": dict(fl="tt_serum", soon=1), "avaskoerper": dict(fl="ava_koerper", soon=1),
 "garten_eden": dict(b=[("growth", 25)], soon=1), "symbiose": dict(b=[("regen", 2)], soon=1),
}
# Dunkelheit: alles kommt mit #080 (eigener Tab, Warnung, Preis)
