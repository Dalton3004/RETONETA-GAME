#!/usr/bin/env python3
"""Ajusta parámetros tácticos de la IA para el juego.
El navegador ejecuta la lógica en game.js; este script permite guardar
perfiles reproducibles de balance para desarrollo y pruebas.
"""
import argparse, json, re
from pathlib import Path
root = Path(__file__).resolve().parent.parent
path = root / "tools" / "tactica_ia.json"
p = argparse.ArgumentParser(description="Configurar transiciones de ataque y defensa")
p.add_argument("--avance", type=int, help="Avance del bloque al atacar (40-110)")
p.add_argument("--repliegue", type=int, help="Retroceso defensivo (25-75)")
p.add_argument("--suavizado", type=float, help="Suavizado de objetivos (0.04-0.20)")
a = p.parse_args()
data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"avance":76,"repliegue":48,"suavizado":0.10}
for key, value, lo, hi in [("avance",a.avance,40,110),("repliegue",a.repliegue,25,75),("suavizado",a.suavizado,0.04,0.20)]:
    if value is not None:
        if not lo <= value <= hi: p.error(f"{key} debe estar entre {lo} y {hi}")
        data[key] = value
path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
# Aplicar el perfil directamente a las constantes que consume el juego.
game = root / "game.js"
source = game.read_text(encoding="utf-8")
for key, js_name in [("avance", "ATTACK_ADVANCE"), ("repliegue", "DEFENSE_RETREAT")]:
    source, count = re.subn(rf"({js_name}:\s*)[0-9.]+", rf"\g<1>{data[key]}", source, count=1)
    if count != 1: raise SystemExit(f"No se encontró la constante {js_name} en game.js")
source, count = re.subn(r"(AI_TARGET_SMOOTHING:\s*)[0-9.]+", rf"\g<1>{data['suavizado']}", source, count=1)
if count != 1: raise SystemExit("No se encontró AI_TARGET_SMOOTHING en game.js")
game.write_text(source, encoding="utf-8")
print("Perfil aplicado a game.js:")
print(json.dumps(data, indent=2, ensure_ascii=False))
