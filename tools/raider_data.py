#!/usr/bin/env python3
# Raider-Bausatz (#004): übernimmt das Ergebnis von tools/raider_strips.py (assets/raider/source/strips.json) in die
# Spieldaten: Animations-Assets (raider_<klasse>_<zustand>), Kopf-Assets (raider_head_<id>) und die Listen „Animationen“
# und „Köpfe“ im Bausatz raider. Alles andere am Bausatz (Farbtausch, Hauttöne, Versatz …) bleibt, wie es in der
# Werkstatt eingestellt ist. Danach: node tools/ng.js check
import json, subprocess

DATA = 'projects/nomadgirl/data/'
S = json.load(open('projects/nomadgirl/assets/raider/source/strips.json'))
A = json.load(open(DATA + 'assets.json'))
K = json.load(open(DATA + 'kits.json'))
NAMES = {'alert': 'Alarm', 'walk': 'Gehen', 'run': 'Rennen', 'crouch': 'Ducken', 'attack': 'Angriff', 'hit': 'Treffer', 'death': 'Tod'}
CLS = {'light': 'leicht', 'heavy': 'beidhändig', 'pistol': 'Pistole', 'long': 'Langwaffe', 'none': 'ohne Waffe'}
HN = {'mohawk': 'Irokese', 'gasmask': 'Gasmaske', 'topknot': 'Haarknoten + Cyberauge', 'dreads': 'Dreadlocks', 'hood': 'Kapuze mit Visier', 'helmet': 'Stachelhelm'}

for k, v in S['assets'].items():
    c, st = k[7:].split('_', 1)
    old = A.get(k, {})
    v.update(name=f'Raider · {CLS[c]} · {NAMES.get(st, st)}', height=old.get('height', 182), derivedFrom='raider_base',
             description='Bausatz-Animation (#004): Körper ohne Waffe, grüner Platzhalter vermessen (Ebenen je Frame), Finger davor im Streifen „Hände davor“.')
    if 'fps' in old: v['fps'] = old['fps']
    A[k] = v
for h in S['meta']['heads']:
    A.setdefault(f'raider_head_{h}', {'name': f'Raider · Kopf {HN.get(h, h)}', 'kind': 'image', 'file': f'assets/raider/head_{h}.png', 'origin': [0, 0],
        'source': 'KI (PixelLab, Edit Pro Flash: nur der Kopf) + Code (tools/raider_strips.py: geänderte Pixel über dem Hals)', 'derivedFrom': 'raider_base', 'date': '12.11.2026'})
kit = K.setdefault('raider', {})
kit['poses'] = [{'class': 'any' if k[7:].split('_')[0] == 'none' else k[7:].split('_')[0], 'state': k[7:].split('_', 1)[1], 'look': k} for k in S['assets']]
old_heads = {h['id']: h for h in kit.get('heads', [])}
kit['heads'] = [{**old_heads.get(h, {}), 'id': h, 'name': old_heads.get(h, {}).get('name', HN.get(h, h)), 'look': f'raider_head_{h}', 'at': info['at']} for h, info in S['meta']['heads'].items()]
json.dump(A, open(DATA + 'assets.json', 'w'), ensure_ascii=False)
json.dump(K, open(DATA + 'kits.json', 'w'), ensure_ascii=False)
subprocess.run(['node', '-e', "import('./tools/json.js').then(m=>{const fs=require('fs');for(const f of ['assets','kits']){const p='projects/nomadgirl/data/'+f+'.json';fs.writeFileSync(p,m.pretty(JSON.parse(fs.readFileSync(p,'utf8'))))}})"], check=True)
print(len(S['assets']), 'Animationen,', len(S['meta']['heads']), 'Köpfe übernommen')
