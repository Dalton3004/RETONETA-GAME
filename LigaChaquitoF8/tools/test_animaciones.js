#!/usr/bin/env node
/**
 * Liga Chaquito F8 - Prueba de la capa de animaciones (fx.js), sin pantalla.
 *
 * Comprueba tres cosas:
 *  1) NO ROMPE EL JUEGO: juega los mismos partidos con y sin fx.js y exige que posiciones,
 *     pelota y marcador sean IDÉNTICOS cuadro a cuadro (los efectos solo dibujan).
 *  2) DIBUJO SEGURO: dibuja cada cuadro con un lienzo falso que detecta NaN/Infinity y radios
 *     negativos (que en un navegador real lanzan error) y verifica que fx no se desactive.
 *  3) COBERTURA: pasa por juego, festejo de gol, fin de partido y pausa.
 *
 * Uso:  node tools/test_animaciones.js [partidos=3]
 * Sale con código 1 si algo falla.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const N = parseInt(process.argv[2] || '3', 10);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES_BASE = ['assets/sprites/atlas.js', 'assets/equipos.js', 'assets/movilidad.js', 'game.js'];
const FILES_FX = ['assets/sprites/atlas.js', 'assets/equipos.js', 'assets/movilidad.js', 'assets/animaciones.js', 'fx.js', 'game.js'];

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const problems = [];
function fail(msg) { if (problems.length < 25) problems.push(msg); }

function makeCtx(report) {
    const noop = () => {};
    const bad = (name, args) => {
        for (const v of args) if (typeof v === 'number' && !Number.isFinite(v)) { report(`${name}: valor no finito ${args}`); return; }
    };
    const store = {};
    return new Proxy(store, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'measureText') return () => ({ width: 10 });
            if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
            return (...args) => {
                if (typeof k === 'string') {
                    bad(k, args);
                    if (k === 'arc' && args[2] < 0) report(`arc con radio negativo ${args[2]}`);
                    if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) report(`ellipse con radio negativo ${args[2]},${args[3]}`);
                }
            };
        },
        set(t, k, v) {
            if ((k === 'globalAlpha') && !(v >= 0 && v <= 1)) report(`globalAlpha fuera de rango: ${v}`);
            t[k] = v; return true;
        }
    });
}

function load(files, seed, withAssets) {
    const noop = () => {};
    const sb = { __errs: [] };
    sb.window = sb;
    sb.addEventListener = noop;
    const ctx2d = makeCtx(m => sb.__errs.push(m));
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop,
                     getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }) };
    const el = { style: {}, classList: { add: noop, remove: noop }, textContent: '', addEventListener: noop };
    Object.assign(sb, {
        console: { log: noop, warn: (...a) => sb.__errs.push('console.warn: ' + a.join(' ')), error: console.error },
        document: { getElementById: id => (id === 'gameCanvas' ? canvas : el), createElement: () => canvas, querySelectorAll: () => [] },
        performance: { now: () => 0 }, requestAnimationFrame: noop, setTimeout: noop, Image: function () {},
        Math: Object.create(Math)
    });
    vm.createContext(sb);
    for (const f of files) vm.runInContext(read(f), sb, { filename: f });
    const r = rng(seed);
    sb.__rand = r;
    vm.runInContext('Math.random = () => __rand();', sb);
    const api = vm.runInContext('({ Game, CONFIG, EstadoPartido })', sb);
    const game = new api.Game('gameCanvas');
    game.menuVisible = false;
    if (withAssets) {
        const img = (w, h) => ({ width: w, height: h });
        game.assets = { atlas: img(1200, 1000), cancha: img(480, 640), ui_goles: img(2400, 1792),
            cartel_GOL: img(760, 290), cartel_VICTORIA: img(760, 273), cartel_DERROTA: img(760, 282), cartel_EMPATE: img(760, 256) };
    }
    game._initMatch();
    return { sb, api, game, r };
}

function bot(game, r, st) {
    const p = game.player, ball = game.ball, k = p.keys;
    k.up = k.down = k.left = k.right = false;
    k.shift = r() < 0.5;
    if (st.hesitate > 0) { st.hesitate--; return; }
    if (r() < 0.004) st.hesitate = 20 + Math.floor(r() * 40);
    const tx = ball.owner === p ? 240 + (r() - 0.5) * 60 : ball.pos.x;
    const ty = ball.owner === p ? 70 : ball.pos.y;
    const dx = tx - p.pos.x, dy = ty - p.pos.y;
    if (dx > 6) k.right = true; else if (dx < -6) k.left = true;
    if (dy > 6) k.down = true; else if (dy < -6) k.up = true;
    if (ball.owner === p) {
        if (p.pos.y < 230 && r() < 0.12) { p.actionSpace(ball); if (r() < 0.5) p.releaseShotCharge(ball); }
        else if (r() < 0.01) p.actionPass(ball, game.gestor.getLocalTeammates(p));
        if (p.shotCharging && r() < 0.15) p.releaseShotCharge(ball);
    } else if (p.pos.distanceTo(ball.pos) < 38 && r() < 0.03) p.actionSpace(ball);
}

function snapshot(game) {
    const g = game.gestor;
    const parts = [g.golesLocal, g.golesRival, g.estado, g.framesRestantes,
        game.ball.pos.x.toFixed(4), game.ball.pos.y.toFixed(4), game.ball.owner ? game.players.indexOf(game.ball.owner) : -1,
        game.players.indexOf(game.player)];
    for (const p of game.players) parts.push(p.pos.x.toFixed(4), p.pos.y.toFixed(4), p.hasBall ? 1 : 0, p.isSliding ? 1 : 0);
    return parts.join('|');
}

function playMatch(files, seed, render) {
    const { sb, api, game, r } = load(files, seed, render);
    const snaps = [];
    const st = { hesitate: 0 };
    const dt = 1 / 60;
    const seen = { juego: 0, gol: 0, fin: 0, pausa: 0 };
    let frames = 0, maxParts = 0, poseMin = { sx: 9, sy: 9 }, poseMax = { sx: -9, sy: -9 };
    const total = 60 * 900;          // tope de seguridad
    let finFrames = 0;

    while (frames < total) {
        const fin = game.gestor.estado === api.EstadoPartido.FINALIZADO;
        if (!fin) bot(game, r, st);
        // pausa breve a mitad del partido para comprobar que nada avanza
        if (frames === 3000) game.gestor.pausado = true;
        if (frames === 3060) game.gestor.pausado = false;
        game.update(dt);
        if (render && frames % 2 === 0) {
            try { game.render(); } catch (e) { fail(`seed ${seed}: render lanzó ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); break; }
        }
        if (game.gestor.pausado) seen.pausa++;
        else if (game.gestor.estado === api.EstadoPartido.CELEBRANDO_GOL) seen.gol++;
        else if (fin) seen.fin++;
        else seen.juego++;
        if (render && game.fx) {
            maxParts = Math.max(maxParts, game.fx.parts.length);
            for (const s of game.fx.states.values()) {
                const po = s.pose;
                poseMin.sx = Math.min(poseMin.sx, po.sx); poseMax.sx = Math.max(poseMax.sx, po.sx);
                poseMin.sy = Math.min(poseMin.sy, po.sy); poseMax.sy = Math.max(poseMax.sy, po.sy);
                for (const k of ['sx', 'sy', 'dx', 'dy', 'angle', 'bobMul', 'shadow']) if (!Number.isFinite(po[k])) fail(`pose.${k} no finita (${po[k]})`);
            }
        }
        snaps.push(snapshot(game));
        frames++;
        if (fin && ++finFrames > 60 * 4) break;   // 4 s de pantalla final
    }
    return { snaps, sb, game, seen, maxParts, poseMin, poseMax, frames };
}

let ok = true;
console.log(`Probando ${N} partido(s) completos con y sin fx.js...\n`);

for (let i = 1; i <= N; i++) {
    const seed = 4000 + i;
    const base = playMatch(FILES_BASE, seed, false);
    const withFx = playMatch(FILES_FX, seed, true);

    // 1) idénticos
    let diffAt = -1;
    const n = Math.min(base.snaps.length, withFx.snaps.length);
    for (let f = 0; f < n; f++) if (base.snaps[f] !== withFx.snaps[f]) { diffAt = f; break; }
    if (diffAt >= 0 || base.snaps.length !== withFx.snaps.length) {
        fail(`seed ${seed}: el juego CAMBIÓ con fx.js (primer cuadro distinto: ${diffAt})`);
    }

    // 2) seguro
    for (const m of withFx.sb.__errs) fail(`seed ${seed}: ${m}`);
    if (!withFx.game.fx || !withFx.game.fx.enabled) fail(`seed ${seed}: fx se desactivó solo`);
    if (withFx.maxParts > 240) fail(`seed ${seed}: demasiadas partículas (${withFx.maxParts})`);

    // 3) cobertura
    const s = withFx.seen;
    if (!(s.juego > 0 && s.fin > 0 && s.pausa > 0)) fail(`seed ${seed}: cobertura incompleta ${JSON.stringify(s)}`);
    const g = withFx.game.gestor;
    console.log(`partido ${i} (seed ${seed}): marcador ${g.golesLocal}-${g.golesRival} · cuadros ${withFx.frames} · ` +
        `juego ${s.juego} / festejo ${s.gol} / fin ${s.fin} / pausa ${s.pausa} · partículas máx ${withFx.maxParts} · ` +
        `escala sx ${withFx.poseMin.sx.toFixed(2)}..${withFx.poseMax.sx.toFixed(2)} sy ${withFx.poseMin.sy.toFixed(2)}..${withFx.poseMax.sy.toFixed(2)} · ` +
        `${diffAt < 0 ? 'idéntico al juego sin fx' : 'DIFERENTE'}`);
    if (s.gol === 0) console.log('   (aviso: este partido no tuvo goles, no se vio el festejo)');
}

// 4) Festejo forzado: gol de cada equipo, para ver goleador / alegría / lamento / arquero tendido
for (const team of ['local', 'rival']) {
    const { sb, api, game } = load(FILES_FX, 777, true);
    const g = game.gestor, b = game.ball;
    for (let f = 0; f < 120; f++) game.update(1 / 60);
    const scorer = game.players.find(p => p.mobilityId === (team === 'local' ? 'local_0' : 'rival_2'));
    game.fx.lastOwner = scorer;          // quién metió el gol (en el juego real lo detecta fx solo)
    const goal = team === 'local' ? api.CONFIG.GOAL_NORTH : api.CONFIG.GOAL_SOUTH;
    b.owner = null; b.vel.set(0, 0); b.kickCooldown = 999;   // que el arquero no la ataje en la prueba
    b.pos.set(goal.x + goal.w / 2, team === 'local' ? goal.lineY - 20 : goal.lineY + 20);
    g.update(1 / 60);            // detecta el gol
    let seenLying = false, seenSlide = false, scorerId = 'ninguno';
    for (let f = 0; f < 60 * 3; f++) {
        game.update(1 / 60);
        if (f % 2 === 0) { try { game.render(); } catch (e) { fail(`festejo ${team}: render lanzó ${e}`); break; } }
        if (game.fx.mode === 'gol' && game.fx.celeb.scorer) scorerId = game.fx.celeb.scorer.mobilityId;
        for (const st of game.fx.states.values()) {
            if (st.pose.frameName === 'GK_lying') seenLying = true;
            if (st.pose.slide) seenSlide = true;
        }
    }
    for (const m of sb.__errs) fail(`festejo ${team}: ${m}`);
    console.log(`festejo forzado (${team}): goleador=${scorerId} · arquero tendido=${seenLying} · deslizada de rodillas=${seenSlide}`);
    if (!seenLying) fail(`festejo ${team}: el arquero que recibe el gol no quedó tendido`);
    if (!seenSlide) fail(`festejo ${team}: el goleador no hizo la deslizada`);
}

// 5) Las barras de potencia y resistencia se dibujan DEBAJO de los pies (y dentro del lienzo)
{
    const { game, api } = load(FILES_FX, 9, true);
    const rec = [];
    const spy = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'fillRect' || k === 'fillText'
        ? (...a) => rec.push([k, ...a]) : () => {}), set: () => true });
    for (const y of [150, 330, 520, 600]) {
        const p = game.player;
        p.pos.set(240, y); p.stamina = 40; p.shotCharge = 0.8; p.shotChargeMax = 1.25;
        rec.length = 0; game._drawStaminaBar(spy, p);
        const st = rec.filter(r => r[0] === 'fillRect').map(r => r[2]);
        rec.length = 0; game._drawShotChargeBar(spy, p);
        const ch = rec.filter(r => r[0] === 'fillRect' || r[0] === 'fillText').map(r => (r[0] === 'fillText' ? r[3] : r[2]));
        const H = api.CONFIG.HEIGHT;
        if (Math.min(...st) < y) fail(`barra de resistencia por encima de los pies (jugador y=${y}, barra y=${Math.min(...st)})`);
        if (Math.min(...ch) < y) fail(`barra de potencia por encima de los pies (jugador y=${y}, barra y=${Math.min(...ch)})`);
        if (Math.max(...st) > H || Math.max(...ch) > H) fail(`una barra se sale del lienzo con el jugador en y=${y}`);
    }
    console.log('barras de potencia y resistencia: debajo de los pies y dentro del lienzo');
}

if (problems.length) {
    console.log('\nFALLAS:');
    for (const p of problems) console.log(' - ' + p);
    process.exit(1);
}
console.log('\nTODO BIEN: las animaciones no alteran el juego y se dibujan sin errores.');
