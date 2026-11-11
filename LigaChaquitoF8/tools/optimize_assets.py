#!/usr/bin/env python3
"""
Liga Chaquito F8 - Optimizador de assets.

Convierte las imágenes pesadas de assets/ a WebP en assets/opt/ (los originales
NO se tocan). game.js carga las versiones de assets/opt/.

Reglas:
  - cancha: se dibuja a 480x640, así que se guarda a 960x1280 (2x, nítido en pantallas retina).
  - ui_goles: el juego recorta regiones por píxel de la imagen original, por eso
    conserva EXACTAMENTE sus dimensiones (solo cambia el formato).
  - resto: máximo 1600 px de lado mayor.

Uso:  python3 tools/optimize_assets.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
OUT = A / "opt"
OUT.mkdir(exist_ok=True)

JOBS = [
    # (original, destino, tamaño máx. o None para conservar, calidad)
    ("SPRAY DE LA CANCHA.jfif",                         "cancha.webp",   (960, 1280), 88),
    ("SPRAY DE GOLES EMPATES VICTORIAS Y TIROS.jfif",   "ui_goles.webp", None,        86),
    ("SPRAY DE RANGOS Y ESTADISTICAS.jfif",             "ui_rangos.webp", 1600,       85),
    ("PANTALLA DE INICIO.jfif",                         "pantalla.webp", 1600,        85),
    ("RETONETA.jfif",                                   "retoneta.webp", None,        88),
]

tot_a = tot_b = 0
for src, dst, size, q in JOBS:
    im = Image.open(A / src).convert("RGB")
    if isinstance(size, tuple):
        im = im.resize(size, Image.LANCZOS)
    elif isinstance(size, int) and max(im.size) > size:
        k = size / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(OUT / dst, "WEBP", quality=q, method=6)
    a, b = (A / src).stat().st_size, (OUT / dst).stat().st_size
    tot_a += a; tot_b += b
    print(f"{src[:42]:42s} {a/1024:7.0f} KB -> {b/1024:6.0f} KB  {im.size}")
print(f"TOTAL imágenes: {tot_a/1048576:.1f} MB -> {tot_b/1048576:.2f} MB")
