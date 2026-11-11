#!/usr/bin/env node
/**
 * Liga Chaquito F8 - Prueba de potencia de pases (sin pantalla).
 * Hace muchos pases con distinta potencia (PASS_POWER_BOOST) y mide: velocidad inicial, cuántos
 * llegan al compañero (no se van de largo) y en cuántos cuadros llegan.
 * Uso: node tools/test_pases.js     Sale con código 1 si un pase fuerte deja de llegar.
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function load(seed) {
    const noop = () => {};
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener: noop };
    const el = { style: {}, classList: { add: noop, remove: noop }, addEventListener: noop };
    const sb = { console: { log: noop, warn: noop, error: console.error }, addEventListener: noop,
        document: { getElementById: id => (id === 'gameCanvas' ? canvas : el), createElement: () => canvas, querySelectorAll: () => [] },
        performance: { now: () => 0 }, requestAnimationFrame: noop, setTimeout: noop, Image: function () {} };
    sb.window = sb; vm.createContext(sb);
    for (const f of ['assets/movilidad.js', 'game.js']) vm.runInContext(read(f), sb);
    const r = rng(seed); sb.__rand = r; vm.runInContext('Math.random = () => __rand();', sb);
    const api = vm.runInContext('({ Game, CONFIG })', sb);
    return { api, r };
}

function trials(boost, n) {
    let ok = 0, frames = 0, v0 = 0, fieldHit = 0;
    for (let i = 0; i < n; i++) {
        const { api, r } = load(100 + i);
        api.CONFIG.PASS_POWER_BOOST = boost;
        const game = new api.Game('gameCanvas'); game.menuVisible = false; game._initMatch();
        const p = game.player, ball = game.ball, g = game.gestor;
        p.pos.set(120 + r() * 240, 300 + r() * 220);
        const mates = game.players.filter(q => q.team === 'local' && !q.isGK && q !== p);
        const mate = mates[Math.floor(r() * mates.length)];
        mate.pos.set(Math.max(100, Math.min(380, p.pos.x + (r() - 0.5) * 300)), Math.max(130, Math.min(540, p.pos.y + (r() - 0.5) * 300)));
        ball.owner = p; p.hasBall = true;
        const nearest = mates.reduce((a, b) => (a.pos.distanceTo(p.pos) < b.pos.distanceTo(p.pos) ? a : b));
        p.actionPass(ball, game.gestor.getLocalTeammates(p));
        v0 += ball.vel.length();
        let f = 0, got = false;
        while (f < 240) { g.update(1 / 60); f++; if (ball.owner && ball.owner.team === 'local' && ball.owner !== p) { got = true; break; } }
        if (got) { ok++; frames += f; }
    }
    return { boost, n, recibidos: ok, pct: Math.round(100 * ok / n), cuadros: ok ? +(frames / ok).toFixed(1) : 0, vInicial: +(v0 / n).toFixed(1) };
}

const res = [1.0, 2.0, 3.0].map(b => trials(b, 150));
console.log('boost  pases  recibidos  %    cuadros hasta recibir   velocidad inicial media');
for (const r of res) console.log(`${r.boost.toFixed(1)}    ${r.n}     ${String(r.recibidos).padStart(3)}      ${String(r.pct).padStart(3)}%   ${String(r.cuadros).padStart(6)}                  ${r.vInicial}`);
const [a, b] = res;
let bad = [];
if (b.vInicial < a.vInicial * 1.8) bad.push(`el pase x2 no sale ~el doble de rápido (${a.vInicial} -> ${b.vInicial})`);
if (b.pct < a.pct - 10) bad.push(`con potencia x2 llegan menos pases (${a.pct}% -> ${b.pct}%)`);
if (b.cuadros >= a.cuadros && a.cuadros > 0) bad.push(`con potencia x2 el pase no llega más rápido (${a.cuadros} -> ${b.cuadros} cuadros)`);
if (bad.length) { console.log('\nFALLAS:\n - ' + bad.join('\n - ')); process.exit(1); }
console.log('\nTODO BIEN: los pases fuertes salen más rápido y siguen llegando al compañero.');
