#!/usr/bin/env node
/**
 * Liga Chaquito F8 - Simulador sin pantalla.
 * Carga game.js tal cual (con el DOM simulado), juega N partidos completos con un
 * "jugador bot" para el equipo azul y guarda métricas en tools/sim_results.json.
 *
 * Uso:  node tools/simulate.js [partidos=20] [dificultad=normal|facil|dificil] [bot=basico|habil]
 *   basico = bot simple de siempre; habil = conduce, esquiva, esprinta, patea cargado y barre (sirve para calibrar dificultades).
 * Luego: python3 tools/analyze_sim.py
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const N = parseInt(process.argv[2] || '20', 10);
const DIF = process.argv[3] || 'normal';       // nivel del equipo rival
const BOT = process.argv[4] || 'basico';       // tipo de jugador simulado
const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

function rng(seed) {                    // mulberry32: reproducible
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function loadGame(seed) {
    const noop = () => {};
    const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }) };
    const el = { style: {}, classList: { add: noop, remove: noop }, textContent: '', addEventListener: noop };
    const sb = {
        console: { log: noop, warn: noop, error: console.error },
        window: { addEventListener: noop },
        document: { getElementById: id => (id === 'gameCanvas' ? canvas : el), createElement: () => canvas, querySelectorAll: () => [] },
        performance: { now: () => 0 }, requestAnimationFrame: noop, setTimeout: noop, Image: function () {},
    };
    vm.createContext(sb);
    vm.runInContext(SRC, sb);
    const r = rng(seed);
    sb.__rand = r;
    vm.runInContext('Math.random = () => __rand();', sb);
    return { sb, api: vm.runInContext('({ Game, CONFIG, EstadoPartido })', sb), r };
}

function botHuman(game, r, state) {
    // Bot sencillo para el jugador azul: va a la pelota, conduce al arco norte, patea cerca.
    const p = game.player, ball = game.ball, k = p.keys;
    k.up = k.down = k.left = k.right = false;
    k.shift = r() < 0.5;
    let tx, ty;
    if (ball.owner === p) { tx = 240 + (r() - 0.5) * 60; ty = 40; }
    else { tx = ball.pos.x; ty = ball.pos.y; }
    // ruido: a veces duda
    if (state.hesitate > 0) { state.hesitate--; return; }
    if (r() < 0.004) state.hesitate = 20 + Math.floor(r() * 40);
    const dx = tx - p.pos.x, dy = ty - p.pos.y;
    if (dx > 6) k.right = true; else if (dx < -6) k.left = true;
    if (dy > 6) k.down = true; else if (dy < -6) k.up = true;
    if (ball.owner === p) {
        if (p.pos.y < 190 && r() < 0.12) { p.actionSpace(ball); state.shots++; }
        else if (r() < 0.004) p.actionPass(ball, game.gestor.getLocalTeammates(p));
    } else if (!p.hasBall && p.pos.distanceTo(ball.pos) < 38 && r() < 0.02) p.actionSpace(ball);
}

function botHabil(game, r, state) {
    const p = game.player, ball = game.ball, k = p.keys;
    k.up = k.down = k.left = k.right = false;
    k.shift = false;
    if (state.charge > 0) {
        state.charge--;
        if (state.charge === 0) { p.releaseShotCharge(ball); state.shots++; }
    }
    let tx, ty;
    if (ball.owner === p) {
        tx = 240; ty = 70;
        const rivals = game.players.filter(q => q.team === 'rival' && !q.isGK);
        let near = null, nd = 1e9;
        for (const q of rivals) { const d = q.pos.distanceTo(p.pos); if (d < nd) { nd = d; near = q; } }
        if (near && nd < 85 && near.pos.y < p.pos.y + 12) tx = p.pos.x + (p.pos.x >= near.pos.x ? 75 : -75);
        k.shift = p.stamina > 20;
        if (p.pos.y < 260 && Math.abs(p.pos.x - 240) < 130 && !p.shotCharging && r() < 0.15) {
            p.actionSpace(ball); state.charge = 4 + Math.floor(r() * 14);
        }
    } else {
        tx = ball.pos.x; ty = ball.pos.y;
        k.shift = p.stamina > 20 && ball.pos.distanceTo(p.pos) > 40;
        if (ball.owner && ball.owner.team === 'rival' && p.pos.distanceTo(ball.pos) < 48 && r() < 0.05) p.actionSpace(ball);
    }
    const dx = tx - p.pos.x, dy = ty - p.pos.y;
    if (dx > 6) k.right = true; else if (dx < -6) k.left = true;
    if (dy > 6) k.down = true; else if (dy < -6) k.up = true;
}

function playMatch(seed) {
    const { api, r, sb } = loadGame(seed);
    // Ajuste fino opcional del perfil de dificultad (para calibrar): DIFF_OVERRIDE='{"shotPower":1.1}'
    if (process.env.DIFF_OVERRIDE) vm.runInContext(`Object.assign(DIFICULTADES.${DIF}, ${process.env.DIFF_OVERRIDE})`, sb);
    if (process.env.GK_OVERRIDE) vm.runInContext(`Object.assign(DIFICULTADES.${DIF}.gk, ${process.env.GK_OVERRIDE})`, sb);
    const game = new api.Game('gameCanvas');
    game.seleccion.dificultad = DIF;
    game._initMatch();
    const { ball, players, gestor } = game;
    // jitter inicial para tener variedad entre partidos
    for (const p of players) { p.pos.x += (r() - 0.5) * 14; p.pos.y += (r() - 0.5) * 14; }

    const kicks = { local: 0, rival: 0 };
    const origKick = ball.kick.bind(ball);
    let lastKickTeam = null;
    ball.kick = (d, pw) => { if (ball.owner) { kicks[ball.owner.team]++; lastKickTeam = ball.owner.team; } return origKick(d, pw); };

    const m = { seed, frames: 0, possession: { local: 0, rival: 0, none: 0 }, thirds: { rivalThird: 0, mid: 0, ownThird: 0 },
                ballStillFrames: 0, ballSpeedSum: 0, humanDist: 0, rivalFieldDrift: 0, rivalFieldSamples: 0,
                localMateDrift: 0, localMateSamples: 0, goals: { local: 0, rival: 0 }, kicks, shots: 0,
                rivalGoalsFromLocalKick: 0, rivalGoalsOther: 0 };
    let prevRG = 0;
    m.rivalGoalsCarried = 0;      // goles del rival con la pelota en los pies (conduciéndola adentro)
    const origReg = gestor._registrarGol.bind(gestor);
    gestor._registrarGol = () => { if (ball.owner && ball.owner.team === 'rival') m.rivalGoalsCarried++; return origReg(); };
    const state = { hesitate: 0, shots: 0, charge: 0 };
    let last = game.player.pos.clone();
    const dt = 1 / 60;

    while (gestor.estado !== api.EstadoPartido.FINALIZADO && m.frames < 60 * 400) {
        (BOT === 'habil' ? botHabil : botHuman)(game, r, state);
        gestor.update(dt);
        m.frames++;
        if (gestor.golesRival > prevRG) {
            prevRG = gestor.golesRival;
            if (lastKickTeam === 'local') m.rivalGoalsFromLocalKick++; else m.rivalGoalsOther++;
        }
        const o = ball.owner;
        m.possession[o ? o.team : 'none']++;
        const y = ball.pos.y;
        if (y < 220) m.thirds.rivalThird++; else if (y > 420) m.thirds.ownThird++; else m.thirds.mid++;
        const sp = ball.vel.length(); m.ballSpeedSum += sp;
        if (!o && sp < 0.01) m.ballStillFrames++;
        m.humanDist += game.player.pos.distanceTo(last); last.copy(game.player.pos);
        for (const p of players) {
            if (p === game.player || p.isGK) continue;
            const d = p.pos.distanceTo(p.homePos);
            if (p.team === 'rival') { m.rivalFieldDrift += d; m.rivalFieldSamples++; }
            else { m.localMateDrift += d; m.localMateSamples++; }
        }
    }
    m.goals = { local: gestor.golesLocal, rival: gestor.golesRival };
    m.shots = state.shots;
    m.seconds = +(m.frames / 60).toFixed(1);
    return m;
}

const results = [];
for (let i = 1; i <= N; i++) results.push(playMatch(1000 + i));
fs.writeFileSync(path.join(__dirname, 'sim_results.json'), JSON.stringify(results, null, 1));
const W = results.filter(m => m.goals.local > m.goals.rival).length, D = results.filter(m => m.goals.local === m.goals.rival).length;
const carried = results.reduce((a, m) => a + m.rivalGoalsCarried, 0) / N;
const kr = results.reduce((a, m) => a + m.kicks.rival, 0) / N;
const gl = results.reduce((a, m) => a + m.goals.local, 0), gr = results.reduce((a, m) => a + m.goals.rival, 0);
console.log(`OK: ${N} partidos simulados (rival ${DIF}, bot ${BOT}) -> tools/sim_results.json`);
console.log(`Bot humano: ${W} ganados, ${D} empatados, ${N - W - D} perdidos | goles ${gl} a favor, ${gr} en contra (promedio ${(gl / N).toFixed(1)} - ${(gr / N).toFixed(1)}) | patadas/pases del rival por partido: ${kr.toFixed(0)} | goles del rival conduciendo la pelota: ${carried.toFixed(1)}`);
