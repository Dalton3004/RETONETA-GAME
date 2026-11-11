#!/usr/bin/env python3
"""
Liga Chaquito F8 - Potencia de los pases (E = pase corto, R = centro / pase largo).

Cambia PASS_POWER_BOOST en game.js:
  1.0 = potencia original | 2.0 = +100% (actual) | 3.0 = +200%

Un pase más potente sale más rápido y frena para llegar justo al compañero (no se pasa de largo).
El centro (R) mantiene el alcance de siempre pero recorre la distancia mucho más rápido.

Uso (desde la carpeta del proyecto):
  python3 tools/configurar_pases.py --ver
  python3 tools/configurar_pases.py --potencia 2.5
Luego podés comprobarlo con:  node tools/test_pases.js
"""
import argparse
import re
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent / "game.js"
PATRON = re.compile(r"(PASS_POWER_BOOST:\s*)([0-9.]+)")

ap = argparse.ArgumentParser(description="Ajusta la potencia de los pases")
ap.add_argument("--potencia", type=float, help="multiplicador de potencia (1.0 a 4.0)")
ap.add_argument("--ver", action="store_true", help="mostrar el valor actual")
a = ap.parse_args()

src = GAME.read_text(encoding="utf-8")
m = PATRON.search(src)
if not m:
    raise SystemExit("No se encontró PASS_POWER_BOOST en game.js")
actual = float(m.group(2))

if a.potencia is None:
    print(f"Potencia de pases actual: x{actual} ({(actual - 1) * 100:+.0f}% sobre la original)")
else:
    if not 1.0 <= a.potencia <= 4.0:
        ap.error("--potencia debe estar entre 1.0 y 4.0")
    nuevo = PATRON.sub(lambda mm: f"{mm.group(1)}{a.potencia}", src, count=1)
    GAME.write_text(nuevo, encoding="utf-8")
    print(f"Potencia de pases: x{actual} -> x{a.potencia} ({(a.potencia - 1) * 100:+.0f}% sobre la original)")
