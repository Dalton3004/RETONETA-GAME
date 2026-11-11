#!/usr/bin/env python3
"""
Liga Chaquito F8 - Verificador del proyecto.
Revisa que no falte nada antes de abrir el juego:
  1. game.js tiene sintaxis válida (node --check)
  2. todos los assets del manifest existen
  3. atlas.js es válido, sus rectángulos entran en atlas.png y las animaciones apuntan a cuadros que existen
  4. index.html carga atlas.js, animaciones.js y fx.js ANTES que game.js
  5. fx.js y assets/animaciones.js son válidos
  6. prueba sin pantalla de las animaciones (node tools/test_animaciones.js)
  7. prueba de la potencia de los pases (node tools/test_pases.js)
Uso:  python3 tools/check_project.py      (código de salida 1 si algo falla)
"""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
errors = []
def ok(msg): print("  OK  ", msg)
def bad(msg): print(" FALLA", msg); errors.append(msg)

# 1) sintaxis
r = subprocess.run(["node", "--check", str(ROOT / "game.js")], capture_output=True, text=True)
ok("game.js: sintaxis válida") if r.returncode == 0 else bad("game.js: " + r.stderr.strip().splitlines()[0])

# 2) assets del manifest
js = (ROOT / "game.js").read_text(encoding="utf-8")
srcs = re.findall(r"src:\s*'([^']+)'", js)
missing = [s for s in srcs if not (ROOT / "assets" / s).exists()]
ok(f"manifest: {len(srcs)} assets, todos existen") if not missing else bad("faltan assets: " + ", ".join(missing))

# 3) atlas
try:
    txt = (ROOT / "assets/sprites/atlas.js").read_text(encoding="utf-8")
    A = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    W, H = Image.open(ROOT / "assets/sprites/atlas.png").size
    n = 0
    for kit, k in A["kits"].items():
        for name, f in A["groups"][k["group"]]["frames"].items():
            n += 1
            if f["x"] + f["w"] > W or k["y"] + f["y"] + f["h"] > H:
                bad(f"atlas: {kit}/{name} se sale de la imagen")
    for g, anims in A["anims"].items():
        frames = A["groups"][g]["frames"]
        for an, lst in anims.items():
            for fr in lst:
                if fr not in frames:
                    bad(f"atlas: animación {g}/{an} usa cuadro inexistente '{fr}'")
    if not errors:
        ok(f"atlas: {n} cuadros dentro de {W}x{H}, animaciones consistentes")
except Exception as e:
    bad(f"atlas: {e}")

# 3b) equipos: assets/equipos.js, camisetas en el atlas y logo
try:
    et = (ROOT / "assets/equipos.js").read_text(encoding="utf-8")
    E = json.loads(et[et.index("["): et.rindex("]") + 1])
    ids = [e["id"] for e in E]
    miss_kit = [e["id"] for e in E if e["kit"] not in A["kits"]]
    miss_logo = [e["logo"] for e in E if e.get("logo") and not (ROOT / "assets" / e["logo"]).exists()]
    if len(set(ids)) != len(ids):
        bad("equipos: ids repetidos")
    elif miss_kit:
        bad("equipos: sin camiseta en el atlas: " + ", ".join(miss_kit) + " (correr tools/build_sprites.py)")
    elif miss_logo:
        bad("equipos: faltan logos: " + ", ".join(miss_logo))
    else:
        ok(f"equipos: {len(E)} equipos, todos con camiseta en el atlas")
except Exception as e:
    bad(f"equipos: {e}")

# 4) orden de scripts
html = (ROOT / "index.html").read_text(encoding="utf-8")
if "equipos.js" in html and html.index("equipos.js") < html.index("game.js"):
    ok("index.html: equipos.js se carga antes que game.js")
else:
    bad("index.html: falta equipos.js o está después de game.js")
if "atlas.js" in html and html.index("atlas.js") < html.index("game.js"):
    ok("index.html: atlas.js se carga antes que game.js")
else:
    bad("index.html: falta atlas.js o está después de game.js")
for extra in ("animaciones.js", "fx.js"):
    if extra in html and html.index(extra) < html.index("game.js"):
        ok(f"index.html: {extra} se carga antes que game.js")
    else:
        bad(f"index.html: falta {extra} o está después de game.js (las animaciones no se verían)")

# 5) animaciones: sintaxis de fx.js, config generada y cuadros que usa
r = subprocess.run(["node", "--check", str(ROOT / "fx.js")], capture_output=True, text=True)
ok("fx.js: sintaxis válida") if r.returncode == 0 else bad("fx.js: " + r.stderr.strip().splitlines()[0])
try:
    txt = (ROOT / "assets/animaciones.js").read_text(encoding="utf-8")
    AN = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    for c in ("rebote", "asentar", "salto", "pulso"):
        if len(AN["curvas"].get(c, [])) < 2:
            bad(f"animaciones.js: falta la curva '{c}' (corré tools/configurar_animaciones.py)")
    ok(f"animaciones.js: {len(AN['jugadores'])} jugadores, preset {AN['global'].get('preset')}")
    if "GK_lying" not in A["groups"]["gk"]["frames"]:
        bad("atlas: falta el cuadro GK_lying (arquero tendido tras un gol)")
except Exception as e:
    bad(f"animaciones.js: {e}")

# 6) prueba sin pantalla: las animaciones no deben alterar el juego ni fallar al dibujar
r = subprocess.run(["node", str(ROOT / "tools" / "test_animaciones.js"), "1"], capture_output=True, text=True)
if r.returncode == 0:
    ok("animaciones: el juego es idéntico con y sin fx.js y se dibuja sin errores")
else:
    bad("animaciones: " + (r.stdout.strip().splitlines() or ["falló"])[-1])

# 7) potencia de pases: salen más rápido y siguen llegando al compañero
r = subprocess.run(["node", str(ROOT / "tools" / "test_pases.js")], capture_output=True, text=True)
if r.returncode == 0:
    ok("pases: los pases fuertes llegan al compañero")
else:
    bad("pases: " + (r.stdout.strip().splitlines() or ["falló"])[-1])

print("\nTODO BIEN" if not errors else f"\n{len(errors)} problema(s)")
sys.exit(1 if errors else 0)
