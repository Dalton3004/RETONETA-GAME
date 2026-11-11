#!/usr/bin/env python3
"""Lee tools/sim_results.json (de simulate.js) y resume cómo se comporta la IA."""
import json
from pathlib import Path
from statistics import mean

R = json.loads((Path(__file__).parent / "sim_results.json").read_text())
n = len(R)
F = lambda k: [r[k] for r in R]

def pct(r, key):
    tot = r["frames"]
    return {k: 100 * v / tot for k, v in r[key].items()}

gl = mean(r["goals"]["local"] for r in R)
gr = mean(r["goals"]["rival"] for r in R)
poss = {k: mean(pct(r, "possession")[k] for r in R) for k in ("local", "rival", "none")}
thirds = {k: mean(pct(r, "thirds")[k] for r in R) for k in ("rivalThird", "mid", "ownThird")}
still = mean(100 * r["ballStillFrames"] / r["frames"] for r in R)
rk = mean(r["kicks"]["rival"] for r in R); lk = mean(r["kicks"]["local"] for r in R)
own = mean(r["rivalGoalsFromLocalKick"] for r in R); oth = mean(r["rivalGoalsOther"] for r in R)
rd = mean(r["rivalFieldDrift"] / max(1, r["rivalFieldSamples"]) for r in R)
ld = mean(r["localMateDrift"] / max(1, r["localMateSamples"]) for r in R)

print(f"=== {n} partidos simulados ({mean(F('seconds')):.0f} s de juego c/u) ===")
print(f"Goles promedio      azul {gl:.2f}  |  rojo {gr:.2f}")
print(f"Goles rojos: tras patada azul {own:.2f} | sin patada previa (conducción/rebote) {oth:.2f}")
print(f"Patadas promedio    azul {lk:.1f}  |  rojo {rk:.1f}")
print(f"Posesión            azul {poss['local']:.0f}%  rojo {poss['rival']:.0f}%  suelta {poss['none']:.0f}%")
print(f"Pelota en           tercio rival {thirds['rivalThird']:.0f}%  medio {thirds['mid']:.0f}%  tercio propio {thirds['ownThird']:.0f}%")
print(f"Pelota quieta       {still:.0f}% del tiempo (sin dueño y detenida)")
print(f"Alejamiento medio de la posición base (px): rivales {rd:.0f}  compañeros {ld:.0f}")
print()
print("=== Diagnóstico ===")
if rk == 0:
    print("- Los rivales NUNCA patean ni pasan: solo el jugador humano tiene acciones (actionSpace/Pass).")
if gr == 0:
    print("- El rival no puede hacer goles: el partido es siempre 'azul vs. nadie'.")
if gr > 0 and rk == 0:
    print(f"- Los {gr:.1f} goles rojos por partido NO son jugadas del rival: son rebotes/autogoles tras patadas azules o pelota conducida hacia atrás.")
if poss["rival"] < 15:
    print(f"- Posesión rival muy baja ({poss['rival']:.0f}%): llegan a la pelota pero no hacen nada con ella.")
if rd < 25:
    print("- Los rivales casi no se mueven de su posición base (IA reactiva de 90 px).")
if still > 8:
    print(f"- La pelota queda quieta y sin dueño el {still:.0f}% del tiempo.")
