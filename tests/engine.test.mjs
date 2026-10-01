// Drives the real game engine headlessly: fake DOM, canvas, clock and timers, real key events.
// Covers what Classic mode changes in js/game.js (rules from js/modes.js), with the modern
// modes as controls so a rule that leaks into every mode shows up too.
import { createGame } from '../js/game.js';
import { normalizeSettings } from '../js/settings.js';

const F = 1000 / 60;
let now = 0;
let rafQueue = [];
let timers = [];
let listeners = { keydown: new Set(), keyup: new Set() };

globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; };

// A callable object that answers every property and call with itself: stands in for any
// canvas 2D API (gradients, paths, transforms) without drawing.
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });

function fakeCanvas() {
    const draws = [];
    const canvas = {
        width: 0, height: 0, style: {}, draws,
        classes: new Set(), classLog: [],
        classList: {
            toggle(name, on) { on ? canvas.classes.add(name) : canvas.classes.delete(name); canvas.classLog.push([name, !!on]); },
            add(name) { canvas.classes.add(name); },
            remove(name) { canvas.classes.delete(name); },
        },
    };
    const ctx = new Proxy({ canvas }, {
        get(target, key) {
            if (key === 'drawImage') return (img, x, y) => draws.push({ x, y });
            if (key === 'clearRect') return () => { draws.length = 0; };
            return key in target ? target[key] : noop;
        },
        set(target, key, value) { target[key] = value; return true; },
    });
    canvas.getContext = () => ctx;
    return canvas;
}

function fakeElement() {
    const el = {
        innerHTML: '', style: {}, offsetWidth: 0,
        classList: { add() {}, remove() {}, toggle() {} },
        querySelector: () => fakeElement(),
    };
    return el;
}

const hudEls = {};
globalThis.document = {
    addEventListener: (type, fn) => listeners[type]?.add(fn),
    removeEventListener: (type, fn) => listeners[type]?.delete(fn),
    createElement: () => fakeCanvas(),
    getElementById: id => (hudEls[id] ??= fakeElement()),
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

// Under the classic randomizer a constant roll gives a constant piece: 0.01 is always T,
// 0.45 always O, 0.9 always I. The 7-bag in the modern modes just shuffles with it.
const T = 0.01, O = 0.45, I = 0.9;

/** Start a game in a mode and return handles to drive and inspect it. */
function rig(modeId, { random = O, settings = {} } = {}) {
    now = 0; rafQueue = []; timers = []; listeners = { keydown: new Set(), keyup: new Set() };
    for (const k of Object.keys(hudEls)) delete hudEls[k];
    Math.random = () => random;

    const sounds = [];
    const packs = [];
    const tracks = [];
    let results = null;
    const canvases = { board: fakeCanvas(), hold: fakeCanvas(), next: fakeCanvas() };
    const game = createGame({
        modeId, canvases, playfield: fakeElement(),
        settings: { ...normalizeSettings({}), ...settings },
        soundEngine: { play: name => sounds.push(name), setPack: name => packs.push(name) },
        music: { setTrack: name => tracks.push(name), setTempoScale() {}, setPaused() {} },
        onGameOver: r => { results = r; },
        onPause() {}, onLevelUp() {},
    });
    game.start();

    const frames = (n = 1) => {
        for (let i = 0; i < n; i++) {
            now += F;
            const q = rafQueue; rafQueue = [];
            q.forEach(fn => fn(now));
            const due = timers.filter(t => t.at <= now);
            timers = timers.filter(t => t.at > now);
            due.forEach(t => t.fn());
        }
    };
    const send = (type, code) => [...listeners[type]].forEach(fn => fn({ code, repeat: false, preventDefault() {} }));
    const r = {
        game, sounds, packs, tracks, canvases, frames,
        results: () => results,
        press: code => send('keydown', code),
        release: code => send('keyup', code),
        tap(code, n = 1) { for (let i = 0; i < n; i++) { r.press(code); frames(1); r.release(code); frames(1); } },
        /** Cells of the piece in play as "col,row" in field coordinates (row 0 is the top row of the field). */
        piece() {
            return canvases.board.draws.slice(-4).map(d => `${d.x / 30},${d.y / 30}`).sort();
        },
        hud(name) { return hudEls[name]?.innerHTML ?? ''; },
        score: () => Number(/under-value">([\d,]+)/.exec(r.hud('hud-under'))?.[1].replace(/,/g, '') ?? NaN),
        stat: label => new RegExp(`${label}</div><div class="stat-value">(\\d+)`).exec(r.hud('hud-stats'))?.[1],
        /** Soft drop the piece in play to the floor and let it lock, then wait out the entry delay. */
        dropPiece() { r.press('ArrowDown'); frames(45); r.release('ArrowDown'); frames(20); },
    };
    frames(2);
    return r;
}

const realRandom = Math.random;

// --- Rules wiring ---
{
    const c = rig('og');
    check('Classic forces the 8-bit sound pack', c.packs[0] === 'nes', `packs ${JSON.stringify(c.packs)}`);
    c.frames(1);
    check('Classic plays the chip track', c.tracks.includes('chip'), c.tracks.join());
    c.game.destroy();
    check('leaving Classic hands the sound pack back', c.packs.at(-1) === null);

    const m = rig('sprint');
    check('modern modes keep the player\'s sound pack', m.packs[0] === null || m.packs[0] === undefined);
}

// --- Spawn and orientation ---
{
    const c = rig('og', { random: T });
    check('T spawns flat side up, stub down, inside the field',
        c.piece().join(' ') === '3,0 4,0 4,1 5,0', c.piece().join(' '));
    const o = rig('og', { random: O });
    check('O spawns centered on the first two rows', o.piece().join(' ') === '4,0 4,1 5,0 5,1', o.piece().join(' '));
    const i = rig('og', { random: I });
    check('I spawns flat on the first row', i.piece().join(' ') === '3,0 4,0 5,0 6,0', i.piece().join(' '));
}

// --- No hold, no hard drop ---
{
    const c = rig('og', { random: T });
    c.press('KeyC'); c.frames(2);
    check('hold does nothing in Classic', !c.sounds.includes('hold') && c.piece().join(' ') === '3,0 4,0 4,1 5,0');
    c.press('Space'); c.frames(2);
    check('hard drop does nothing in Classic', !c.sounds.includes('harddrop') && c.piece().join(' ') === '3,0 4,0 4,1 5,0');

    const m = rig('sprint');
    m.press('KeyC'); m.frames(1); m.press('Space'); m.frames(1);
    check('control: the modern modes still hold and hard drop', m.sounds.includes('hold') && m.sounds.includes('harddrop'));
}

// --- Rotation without kicks ---
{
    const c = rig('og', { random: T });
    c.tap('ArrowUp'); // T flat-down, once clockwise: the stub points left
    check('T rotates clockwise from its spawn orientation (stub points left)',
        c.piece().join(' ') === '3,0 4,-1 4,0 4,1', c.piece().join(' '));
    const i = rig('og', { random: I });
    i.tap('ArrowUp');
    check('I turns vertical', new Set(i.piece().map(p => p.split(',')[0])).size === 1, i.piece().join(' '));
    i.tap('ArrowRight', 4); // vertical I against the right wall
    const against = i.piece().join(' ');
    i.tap('ArrowUp'); // turning flat again would poke out of the field: no kick, so nothing happens
    check('a rotation blocked by the wall fails, with no kick', i.piece().join(' ') === against, i.piece().join(' '));

    const m = rig('sprint', { random: 0 });
    check('control: the modern engine still builds', m.game.isRunning());
}

// --- Gravity and lock ---
{
    const c = rig('og', { random: O });
    const topRow = () => Math.min(...c.piece().map(p => Number(p.split(',')[1])));
    check('level 0 gravity: 48 frames per row', topRow() === 0);
    c.frames(40);
    check('still on the first row before the 48th frame', topRow() === 0, `row ${topRow()}`);
    c.frames(10);
    check('drops one row on the 48th frame', topRow() === 1, `row ${topRow()}`);

    const fast = rig('og', { random: O, settings: { classicStartLevel: 9 } });
    const fastRow = () => Math.min(...fast.piece().map(p => Number(p.split(',')[1])));
    fast.frames(8);
    check('level 9 gravity: 6 frames per row', fastRow() === 1, `row ${fastRow()}`);
    check('the start level shows on the HUD', fast.stat('LEVEL') === '9', fast.stat('LEVEL'));
}
{
    // Lock timing: one gravity interval after landing, and moving does not reset it
    const c = rig('og', { random: O });
    const bottom = () => Math.max(...c.piece().map(p => Number(p.split(',')[1])));
    let landedAt = 0;
    for (let f = 0; f < 2000 && bottom() < 19; f++) { c.frames(1); landedAt = f; }
    const before = c.sounds.filter(s => s === 'lock').length;
    c.frames(20);
    c.tap('ArrowRight');
    let waited = 22;
    while (c.sounds.filter(s => s === 'lock').length === before && waited < 200) { c.frames(1); waited++; }
    check('locks about 48 frames after landing even though the piece was moved', waited >= 44 && waited <= 52, `${waited} frames`);
}
{
    // Soft drop: 1 point per cell, lock at once on the floor, and the key must be pressed again
    const c = rig('og', { random: O });
    c.press('ArrowDown'); c.frames(45);
    const first = c.score();
    check('soft drop scores 1 point per cell (18 rows to the floor)', first === 18, `score ${first}`);
    c.frames(40); // next piece is in play with the key still held
    check('a held soft drop does not carry over to the next piece', c.score() === first, `score ${c.score()}`);
    c.release('ArrowDown'); c.press('ArrowDown'); c.frames(45);
    check('pressing it again soft drops the new piece', c.score() > first, `score ${c.score()}`);
}

// --- Scoring ---
{
    // Five O pieces side by side fill two rows: a double is 100 x (level + 1)
    const c = rig('og', { random: O });
    c.tap('ArrowLeft', 4); c.dropPiece();
    c.tap('ArrowLeft', 2); c.dropPiece();
    c.dropPiece();
    c.tap('ArrowRight', 2); c.dropPiece();
    const before = c.score();
    c.tap('ArrowRight', 4); c.press('ArrowDown'); c.frames(45); c.release('ArrowDown'); c.frames(60);
    check('a double scores 100 at level 0', c.score() - before === 18 + 100, `+${c.score() - before}`);
    check('two lines are counted', c.stat('LINES') === '2', c.stat('LINES'));
}
{
    // Ten vertical I pieces fill four rows: a tetris is 1200 x (level + 1)
    const c = rig('og', { random: I, settings: { classicStartLevel: 0 } });
    const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const col of cols) {
        c.frames(25);
        c.tap('ArrowUp');
        const x = Number(c.piece()[0].split(',')[0]);
        const dir = col < x ? 'ArrowLeft' : 'ArrowRight';
        c.tap(dir, Math.abs(col - x));
        c.dropPiece();
    }
    check('four lines at once count as a tetris', c.stat('LINES') === '4', c.stat('LINES'));
    const soft = 10 * 17; // each vertical I travels up to 17 rows from the top to the floor
    check('a tetris scores 1200 at level 0', c.score() >= 1200 && c.score() <= 1200 + soft, `score ${c.score()}`);
    check('tetris rate reaches 100%', c.stat('TETRIS RATE') === '100', c.stat('TETRIS RATE'));
}

// --- Top out, and what Classic leaves out ---
{
    const c = rig('og', { random: O });
    for (let i = 0; i < 12 && !c.results(); i++) c.dropPiece();
    c.frames(60);
    const r = c.results();
    check('a stack reaching the spawn area ends the game', !!r && r.gameOver, r && `pieces ${r.piecesPlaced}`);
    check('the game over sound plays', c.sounds.includes('gameOver'));
    check('Classic never raises the danger warning', !c.canvases.board.classLog.some(([n, on]) => n === 'board-danger' && on));
    check('results carry the tetris rate', r && r.tetrisRate === 0);
}

Math.random = realRandom;
console.log(failures ? `\n${failures} FAILED` : '\nAll engine checks passed');
process.exit(failures ? 1 : 0);
