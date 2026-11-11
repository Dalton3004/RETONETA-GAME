#!/usr/bin/env python3
"""Ajusta la movilidad individual y genera assets/movilidad.js.
Uso: python3 tools/configurar_movilidad.py --jugador local_1 --velocidad 1.30 --sprint 1.25
Jugadores: local_0..local_3, local_gk, rival_0..rival_3, rival_gk.
Los multiplicadores 1.0 mantienen la velocidad base; 1.3 = 30% más rápido.
"""
import argparse, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / 'tools' / 'movilidad_jugadores.json'
OUTPUT = ROOT / 'assets' / 'movilidad.js'
parser = argparse.ArgumentParser(description='Configurar velocidad por jugador')
parser.add_argument('--jugador', required=True, help='ID individual, por ejemplo local_1 o rival_gk')
parser.add_argument('--velocidad', type=float, help='Multiplicador de velocidad normal')
parser.add_argument('--sprint', type=float, help='Multiplicador adicional de sprint')
args = parser.parse_args()
data = json.loads(CONFIG.read_text(encoding='utf-8'))
if args.jugador not in data:
    parser.error(f"Jugador desconocido: {args.jugador}. IDs: {', '.join(data)}")
for key, value in [('velocidad', args.velocidad), ('sprint', args.sprint)]:
    if value is not None:
        if not 0.5 <= value <= 2.5:
            parser.error(f'{key} debe estar entre 0.5 y 2.5')
        data[args.jugador][key] = round(value, 3)
CONFIG.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
OUTPUT.write_text('// Generado por tools/configurar_movilidad.py. No editar a mano.\n' +
                   'window.MOVILIDAD_JUGADORES = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(f"Movilidad actualizada: {args.jugador} -> {data[args.jugador]}")
