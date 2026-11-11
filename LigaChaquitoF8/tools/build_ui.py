#!/usr/bin/env python3
"""
Liga Chaquito F8 - Recortador de carteles (GOL / VICTORIA / DERROTA / EMPATE).

Problema que resuelve: la hoja "SPRAY DE GOLES EMPATES VICTORIAS Y TIROS" mide 2400x1792 px
y el juego la recortaba con coordenadas fijas pensadas para otro tamaño, así que el cartel
de GOL salía cortado. Este script detecta cada cartel solo (sin coordenadas a mano), le quita
el fondo gris y guarda un PNG transparente por cartel en assets/ui/.

Uso:  python3 tools/build_ui.py
Salida: assets/ui/gol.png, victoria.png, derrota.png, empate.png  (+ tools/preview_ui.png)
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "SPRAY DE GOLES EMPATES VICTORIAS Y TIROS.jfif"
OUT = ROOT / "assets" / "ui"
MAX_W = 760          # ancho máximo del PNG final (se dibuja a ~340 px en pantalla)
PAD = 10             # margen transparente alrededor del cartel

T_LOW, T_HIGH = 26.0, 52.0   # distancia de color al fondo: <T_LOW = fondo, >T_HIGH = tinta


def main():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    H, W, _ = a.shape

    # Color de fondo = mediana del borde de la hoja
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                             a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(a - bg, axis=2)
    ink = dist > T_HIGH

    # Los 4 carteles están en la mitad de arriba de la hoja (abajo hay barras de "TIRO/POTENCIA")
    top_limit = int(H * 0.50)
    mask = ink.copy()
    mask[top_limit:] = False

    # Une letras + estrellas/destellos de cada cartel en un solo bloque
    blobs, n = ndi.label(ndi.binary_dilation(mask, iterations=28))
    boxes = []
    for i, sl in enumerate(ndi.find_objects(blobs), start=1):
        area = int((blobs[sl] == i).sum())
        if area < 20000:          # ruido
            continue
        boxes.append(sl)
    if len(boxes) != 4:
        raise SystemExit(f"Se esperaban 4 carteles y se detectaron {len(boxes)}. Revisá la imagen.")

    # Orden de lectura: fila de arriba (GOL, VICTORIA) y fila de abajo (DERROTA, EMPATE)
    cy = lambda s: (s[0].start + s[0].stop) / 2
    cx = lambda s: (s[1].start + s[1].stop) / 2
    boxes.sort(key=cy)
    row1 = sorted(boxes[:2], key=cx)
    row2 = sorted(boxes[2:], key=cx)
    names = ["gol", "victoria", "derrota", "empate"]
    ordered = row1 + row2

    OUT.mkdir(parents=True, exist_ok=True)
    previews = []
    for name, sl in zip(names, ordered):
        y0, y1 = max(0, sl[0].start - PAD), min(H, sl[0].stop + PAD)
        x0, x1 = max(0, sl[1].start - PAD), min(W, sl[1].stop + PAD)
        crop = a[y0:y1, x0:x1]
        d = dist[y0:y1, x0:x1]

        # Alfa suave según qué tan lejos del fondo está cada píxel
        alpha = np.clip((d - T_LOW) / (T_HIGH - T_LOW), 0, 1)
        # Saca restos sueltos del fondo (puntitos aislados)
        solid = ndi.binary_opening(alpha > 0.5, iterations=1)
        near = ndi.binary_dilation(solid, iterations=3)
        alpha = alpha * near

        # Quita el tinte gris del fondo en los bordes semitransparentes
        al = np.maximum(alpha, 1e-3)[..., None]
        rgb = np.where(alpha[..., None] < 0.999, (crop - (1 - al) * bg) / al, crop)
        rgb = np.clip(rgb, 0, 255)

        out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
        img = Image.fromarray(out, "RGBA")
        if img.width > MAX_W:
            k = MAX_W / img.width
            img = img.resize((MAX_W, round(img.height * k)), Image.LANCZOS)
        img.save(OUT / f"{name}.png", optimize=True)
        previews.append(img)
        print(f"  OK   assets/ui/{name}.png  {img.width}x{img.height}")

    # Vista previa sobre césped para revisar a ojo
    pw = max(i.width for i in previews)
    ph = sum(i.height for i in previews) + 20 * (len(previews) + 1)
    sheet = Image.new("RGBA", (pw + 40, ph), (34, 120, 52, 255))
    y = 20
    for i in previews:
        sheet.alpha_composite(i, (20 + (pw - i.width) // 2, y))
        y += i.height + 20
    sheet.convert("RGB").save(ROOT / "tools" / "preview_ui.png")
    print("  OK   tools/preview_ui.png (vista previa sobre césped)")


if __name__ == "__main__":
    main()
