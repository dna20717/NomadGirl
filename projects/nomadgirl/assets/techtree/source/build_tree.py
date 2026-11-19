# Baut die Techtree-Knoten (#110) aus dem Entwurf (nodes.json), den Wirkungen (effects.py) und den Bildblättern (sheets.json).
import json, sys, subprocess
sys.path.insert(0, 'output/nomadpixel/tt')
from effects import E
T = json.load(open('output/nomadpixel/tt/nodes.json'))
S = json.load(open('output/nomadpixel/tt/sheets.json'))['sheets']
P = 'projects/nomadgirl/data/techtree.json'
cur = json.load(open(P))
RES = {'T': 'technik', 'W': 'wissen', 'B': 'bio', 'D': 'dunkelheit'}
icon_of = {}
for si, sh in enumerate(S):
    for ci, k in enumerate(sh):
        if '~' not in k: icon_of[k] = (f'tt_nodes_{si + 2}', ci)
out = {}
for tab, nodes in T.items():
    # rows: column by column, a node sits near its parents (barycenter of their rows), so → leads from a node to its children
    rowof = {}
    for tier in sorted({n[2] for n in nodes}):
        col = [n for n in nodes if n[2] == tier]
        key = lambda n: (sum(rowof[r] for r in n[3].replace('?', '').split(',') if r in rowof) / max(1, len([r for r in n[3].replace('?', '').split(',') if r in rowof])) if any(r in rowof for r in n[3].replace('?', '').split(',')) else 99, nodes.index(n))
        for i, n in enumerate(sorted(col, key=key)): rowof[n[0]] = i
    for n in nodes:
        nid, name, tier, req, cost, types, text = n[:7]; flags = n[7] if len(n) > 7 else ''
        row = rowof[nid]
        if nid in cur:   # existing: keep its cost, requires, bonus, recipes, look (Balancing v1), only the place changes
            e = dict(cur[nid]); e['pos'] = [tier, row]
            e['requires'] = list(dict.fromkeys((e.get('requires') or []) + [r.replace('?', '') for r in req.split(',') if r]))   # e.g. Heilmittel now also needs the Serum
            out[nid] = e; continue
        e = {'name': name, 'tab': tab}
        if nid in icon_of: e['look'], e['icon'] = icon_of[nid]
        e['pos'] = [tier, row]
        e['cost'] = [{'resource': RES[p[-1]], 'count': int(p[:-1])} for p in cost.split()]
        e['requires'] = [r.replace('?', '') for r in req.split(',') if r]
        x = E.get(nid, {'soon': 1, 'fl': f'dunkel_{nid}'} if tab == 'dunkelheit' else {})
        e['recipes'] = []
        e['bonus'] = [{'stat': s, 'value': v} for s, v in x.get('b', [])]
        if x.get('ws'): e['workshops'] = x['ws']
        if x.get('rp'): e['rigParts'] = x['rp']
        if x.get('fl'): e['flags'] = x['fl']
        if x.get('soon'): e['soon'] = True
        e['description'] = text
        out[nid] = e
for k, v in cur.items():
    if k not in out: out[k] = v   # nodes outside the draft stay
sys.path.insert(0, 'tools')
open(P, 'w').write(subprocess.run(['node', '-e', "import('./tools/json.js').then(j=>process.stdout.write(j.pretty(JSON.parse(require('fs').readFileSync(0,'utf8')))+'\\n'))"], input=json.dumps(out, ensure_ascii=False), capture_output=True, text=True).stdout)
print(len(out), 'Knoten')
