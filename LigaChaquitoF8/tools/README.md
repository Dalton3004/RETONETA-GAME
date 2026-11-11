# Herramientas de Liga Chaquito F8

Se ejecutan desde la carpeta del proyecto. Nada de esto hace falta para *jugar*, solo para preparar el juego.

| Comando | Qué hace |
|---|---|
| `python3 tools/build_sprites.py` | Recorta la hoja `SPRAYS DE DEFENSAS Y MOVIMIENTOS DE ARQUEROS.png` (barrida y arquero), genera la vista de espaldas y los pasos, y arma `atlas.png` + `atlas.js` en alta resolución (4 equipaciones) y `tools/preview_atlas.png` para revisarlo. **Correr cada vez que cambies un sprite.** |
| `python3 tools/build_sprites.py` (equipos) | Además de lo anterior, lee `tools/equipos.json` y genera las 12 camisetas de equipo en el atlas (`team_<id>`) y `assets/equipos.js`. |
| `python3 tools/optimize_assets.py` | Convierte las imágenes pesadas a WebP en `assets/opt/` (los originales no se tocan). |
| `python3 tools/build_ui.py` | Recorta de la hoja de goles los carteles ¡GOL!, VICTORIA, DERROTA y EMPATE, les quita el fondo y los guarda en `assets/ui/` (el cartel de gol ya no sale con un recuadro gris). |
| `python3 tools/configurar_animaciones.py` | Genera `assets/animaciones.js`: personalidad de animación de cada jugador y curvas de resorte horneadas (ver abajo). |
| `python3 tools/check_project.py` | Verifica sintaxis, assets, atlas, animaciones y orden de scripts antes de abrir el juego. |
| `python3 tools/make_all.py` | Corre sprites + carteles + animaciones + optimización + verificación de una vez. |
| `python3 tools/configurar_pases.py --potencia 2.5` | Cambia la potencia de los pases E y R (1.0 = original, 2.0 = +100%, hasta 4.0). `--ver` muestra el valor actual. |
| `node tools/test_pases.js` | Mide si los pases fuertes salen más rápido y siguen llegando al compañero. |
| `node tools/test_animaciones.js 3` | Juega 3 partidos con y sin `fx.js`, exige que el juego sea idéntico y que el dibujo no tenga errores. |
| `node tools/simulate.js 20` | Juega 20 partidos sin pantalla usando tu `game.js` y guarda `tools/sim_results.json`. Acepta `[partidos] [facil\|normal\|dificil] [basico\|habil]` (ej. `node tools/simulate.js 12 dificil habil`). |
| `python3 tools/analyze_sim.py` | Resume los resultados y marca problemas de la IA. |

Requisitos: Python 3 con `pillow`, `numpy`, `scipy`; Node 18+.

## Ajustar la movilidad de cada jugador (Python)

Cada jugador tiene un perfil individual en `tools/movilidad_jugadores.json`.
Para cambiarlo, ejecutá desde la carpeta del proyecto:

```bash
python3 tools/configurar_movilidad.py --jugador local_1 --velocidad 1.30 --sprint 1.25
```

IDs activos en el formato 3v3: `local_0`, `local_1`, `local_gk`, `rival_0`, `rival_1` y `rival_gk`.
`1.0` equivale a la velocidad base; `1.30` aumenta un 30%. El script actualiza el JSON y genera `assets/movilidad.js`, que el juego carga automáticamente. Los valores permitidos van de `0.5` a `2.5`.

## Resistencia
Los jugadores de campo consumen energía al esprintar; al bajar la resistencia pierden velocidad y recuperan energía al caminar o descansar. Los arqueros no usan el sistema de sprint.

## Música
`assets/MUSICA-SOUNDTRACK.mp3` se reproduce en bucle. Si el navegador bloquea la reproducción automática, comienza al primer clic o pulsación de tecla (política de autoplay del navegador).

### Defensa de la IA (actualización)
La IA de campo ahora utiliza presión escalonada: el jugador más cercano presiona
al poseedor y puede ejecutar una barrida si está a distancia de quite; los demás
jugadores toman referencias de marcaje zonal sobre atacantes rivales. Se añadió
un límite defensivo para impedir que los jugadores de campo entren en su propia
área de gol/red, incluso durante una barrida. Los arqueros mantienen su lógica
independiente.

## Animaciones y game feel (fx.js)

`fx.js` agrega animaciones a cada jugador **sin tocar la lógica del juego**: solo lee el estado
(posición, velocidad, acciones) y dibuja encima. Si falla, se apaga sola y el juego sigue igual.
Si borrás `fx.js` o `assets/animaciones.js` del `index.html`, el juego vuelve a verse como antes.

Qué se agregó: carrera con rebote e inclinación, cansancio visible (sudor), patada y pase con estirón,
carga de tiro (se agacha y tiembla al máximo), control de pelota, frenada con derrape, quiebres de
dirección, barrida con polvo y levantarse, respiración, tics al estar parado (saltito, estirarse,
sacudirse, mirar), la IA parada mira la pelota, arquero con balanceo/estirada con polvo y tendido
tras un gol, festejo de gol por jugador (el goleador se desliza de rodillas) y lamento del rival,
festejo/lamento al final del partido, polvo/pasto/estrellas/confeti, sacudida de pantalla en goles
y tiros fuertes, estela y giro de la pelota, y una onda en el indicador al cambiar de jugador activo.
Con "reducir movimiento" activado en el sistema operativo, se apaga la sacudida y se suavizan los efectos.

Ajustes desde Python (cada jugador tiene su personalidad):

```bash
python3 tools/configurar_animaciones.py --listar
python3 tools/configurar_animaciones.py --preset exagerado          # sobrio | dinamico | exagerado
python3 tools/configurar_animaciones.py --jugador local_1 --festejo giro --estilo elastico --nervio 1.4
python3 tools/configurar_animaciones.py --sacudida 0.5 --particulas 0.6 --sin-estela
```

Festejos: `salto`, `giro`, `baile`, `punos`, `rodillas`. Estilos de carrera: `normal`, `elastico`, `pesado`, `ligero`.
La config queda en `tools/animaciones_jugadores.json` y se genera `assets/animaciones.js`.

### Pases y barras (actualización)
- Los pases (E y R) salen con el doble de potencia (`PASS_POWER_BOOST: 2.0` en `game.js`). Un pase fuerte sale más rápido y frena para llegar justo al compañero, así no se pasa de largo; el centro (R) conserva su alcance pero lo recorre mucho más rápido. Se ajusta con `tools/configurar_pases.py`.
- Las barras de resistencia y de potencia ahora se dibujan debajo de los pies del jugador (nunca se salen del lienzo). La barra de potencia parpadea con ¡MAX! al llegar al tope.
- Animaciones nuevas: arranque explosivo al empezar a esprintar, saltito de "listos" al reanudar tras un gol, jugadores que piden la pelota cuando un compañero la tiene, encorvarse con las manos en las rodillas al estar muy cansado, pelota que se estira cuando va rápido y chispas en los pases fuertes.

## Equipos y colores
`tools/equipos.json` es la fuente de los 12 equipos (nombre, siglas, colores del escudo y de la camiseta). Para cambiar un color:
editá el JSON (`franja` = rayas de color, `franja2` = rayas oscuras y mangas, `short`, `medias`, `numero` opcional) y corré `python3 tools/build_sprites.py`.
Para darle un logo propio a otro equipo, agregá `"logo": "opt/archivo.webp"` (como hace Retoneta) con la imagen en `assets/opt/`.

## Dificultades (FÁCIL · NORMAL · DIFÍCIL)

Después de elegir equipo y rival aparece **ELEGÍ LA DIFICULTAD**. El nivel se aplica al equipo **rival** (cualquiera de los 12) y se ve bajo el reloj durante el partido. Revancha conserva el nivel.

| Nivel | Cómo juega el rival |
|---|---|
| FÁCIL | Lento, remata poco y flojo, casi no pasa ni barre; su arquero reacciona tarde. |
| NORMAL | Rápido, presiona, pasa cuando lo marcan, remata con puntería y anticipa la pelota. |
| DIFÍCIL | Veloz e incansable (casi no se cansa), presión doble, anticipa pases y tiros, esquiva al que lo marca, pasa al compañero libre, remata fuerte a la esquina contraria al arquero, barre mejor y tiene un arquero de primera. |

Todo está en `DIFICULTADES` (arriba de `game.js`): velocidades, energía, reflejos, remate, pases, presión, barridas y arquero de cada nivel. Para ajustar un nivel basta cambiar esos números.
El arquero del jugador usa siempre el perfil de arquero NORMAL (antes era demasiado débil: con un rival que remata bien no se podía ni jugar).

Calibración (`node tools/simulate.js 12 <nivel> habil`, un bot que conduce, esquiva, esprinta, patea cargado y barre). Con `DIFF_OVERRIDE='{"shotPower":1.1}'` y `GK_OVERRIDE='{"reach":1.2}'` se prueban cambios sin editar el juego:

| Nivel | Resultado promedio del bot hábil (a favor - en contra) |
|---|---|
| FÁCIL | ~11 - 0 (gana siempre) |
| NORMAL | ~1.3 - 1.0 (parejo) |
| DIFÍCIL | ~1.4 - 6 (pierde casi todos) |

## Camisetas (diseños)

Cada equipo tiene un `diseno` en `tools/equipos.json` (`kit`): `rayas`, `lisa`, `mitades`, `aros`, `banda` o `franja_central`, con `franja` (color A), `franja2` (color B), `mangas`, `short`, `medias`, `medias2` (puño de las medias) y `numero` (`#hex` o `auto` = contraste automático). Después de cambiar algo: `python3 tools/build_sprites.py`.
Mejoras: las medias ahora tienen el mismo color de frente y de costado, el short ya no pinta los zapatos, los negros conservan los pliegues, las mangas son un color aparte y el número siempre se lee.
