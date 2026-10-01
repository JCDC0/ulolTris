/**
 * neon-demo.js - A block stacker that plays itself, for the Neon Fall scene.
 *
 * It is a looping show, not a bot. Each cycle fills the bottom four rows of a ten wide
 * well except for the right-hand column (a tiling of that strip with tetrominoes, found by
 * search and dropped bottom-first, so every piece lands where it was planned), sets one or
 * two flat pieces on top, then drops an I piece down the well. Four rows clear at once (a
 * Tetris), and whatever was sitting on top falls four rows and becomes the start of the
 * next cycle. The last cycle sets nothing on top, so the board is empty again when the
 * loop restarts and the show never jumps.
 *
 * This file is plain logic with no canvas, so `npm test` can replay it: frame(t) says
 * what to draw at a moment, and events(t0, t1) says which sounds fall in a span of time.
 */

import { rng } from './pixel.js';

export const COLS = 10;
export const ROWS = 20;
export const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const WELL = COLS - 1;
const STACK_TOP = ROWS - 4;

const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
};

const rotateCw = m => m[0].map((_, i) => m.map(row => row[i]).reverse());

/** All four clockwise rotations of a kind, as { cells: [[dx, dy]], w, h }, in row-major cell order. */
const ROTATIONS = Object.fromEntries(KINDS.map(kind => {
    const list = [];
    let m = SHAPES[kind];
    for (let i = 0; i < 4; i++) {
        const cells = [];
        m.forEach((row, dy) => row.forEach((v, dx) => { if (v) cells.push([dx, dy]); }));
        list.push({ cells, w: m[0].length, h: m.length });
        m = rotateCw(m);
    }
    return [kind, list];
}));

/** The distinct orientations of a kind, each with the number of rotations that makes it. */
const ORIENTS = Object.fromEntries(KINDS.map(kind => {
    const seen = new Set();
    const list = [];
    ROTATIONS[kind].forEach((o, rot) => {
        const key = o.cells.join(';');
        if (!seen.has(key)) { seen.add(key); list.push({ ...o, rot }); }
    });
    return [kind, list];
}));

const flatBottom = o => Array.from({ length: o.w }, (_, dx) => o.cells.some(([x, y]) => x === dx && y === o.h - 1)).every(Boolean);
/** Pieces that can sit on a flat stack without leaving a hole under them, and stay low. */
const TOPPERS = KINDS.flatMap(kind => ORIENTS[kind].filter(o => o.h <= 2 && flatBottom(o)).map(o => ({ kind, o })));

const at = (x, y) => y * COLS + x;

function fits(board, cells, x, y) {
    return cells.every(([dx, dy]) => {
        const cx = x + dx, cy = y + dy;
        return cx >= 0 && cx < COLS && cy < ROWS && (cy < 0 || board[at(cx, cy)] === 0);
    });
}

/**
 * The row a piece comes to rest on when dropped straight down from the top.
 * @param {Uint8Array} board - COLS x ROWS cells, 0 for empty
 * @param {number[][]} cells - [dx, dy] offsets of the piece
 * @param {number} x - the column of the piece's left edge
 * @returns {number} the row of the piece's top edge, or -1 if it does not fit at the top
 */
export function landing(board, cells, x) {
    if (!fits(board, cells, x, 0)) return -1;
    let y = 0;
    while (fits(board, cells, x, y + 1)) y++;
    return y;
}

function paint(board, move) {
    const v = KINDS.indexOf(move.kind) + 1;
    for (const [dx, dy] of move.o.cells) board[at(move.x + dx, move.y + dy)] = v;
}

function shuffle(list, r) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

/** Tile the empty cells of the bottom four rows (columns left of the well) with tetrominoes. */
function tile(board, r) {
    const cover = new Int8Array(COLS * ROWS).fill(-1);
    const pieces = [];
    let nodes = 0;
    const options = KINDS.flatMap(kind => ORIENTS[kind].map(o => ({ kind, o })));
    const firstEmpty = () => {
        for (let y = STACK_TOP; y < ROWS; y++) for (let x = 0; x < WELL; x++) if (board[at(x, y)] === 0 && cover[at(x, y)] < 0) return [x, y];
        return null;
    };
    const solve = () => {
        const spot = firstEmpty();
        if (!spot) return true;
        if (++nodes > 4000) return false;
        const [x, y] = spot;
        for (const { kind, o } of shuffle(options.slice(), r)) {
            // The first cell of an orientation (row-major) sits on the scan's first empty cell
            const ox = x - o.cells[0][0], oy = y - o.cells[0][1];
            const ok = o.cells.every(([dx, dy]) => {
                const cx = ox + dx, cy = oy + dy;
                return cx >= 0 && cx < WELL && cy >= STACK_TOP && cy < ROWS && board[at(cx, cy)] === 0 && cover[at(cx, cy)] < 0;
            });
            if (!ok) continue;
            for (const [dx, dy] of o.cells) cover[at(ox + dx, oy + dy)] = pieces.length;
            pieces.push({ kind, o, x: ox, y: oy });
            if (solve()) return true;
            pieces.pop();
            for (const [dx, dy] of o.cells) cover[at(ox + dx, oy + dy)] = -1;
        }
        return false;
    };
    return solve() ? pieces : null;
}

/**
 * Put tiles in an order they can be dropped in: a piece goes down once every cell under it
 * is filled (or is part of it), so it stops exactly where the tiling wants it.
 */
function dropOrder(board, pieces, r) {
    const filled = board.slice();
    const left = pieces.slice();
    const order = [];
    const supported = p => p.o.cells.every(([dx, dy]) => {
        const cx = p.x + dx, cy = p.y + dy + 1;
        return cy >= ROWS || p.o.cells.some(([ex, ey]) => ex === dx && ey === dy + 1) || filled[at(cx, cy)] !== 0;
    });
    while (left.length) {
        const ready = left.filter(supported);
        if (!ready.length) return null;
        const p = ready[Math.floor(r() * ready.length)];
        paint(filled, p);
        order.push(p);
        left.splice(left.indexOf(p), 1);
    }
    return order;
}

/** A tiling of the strip over `board`, in drop order, or null if the search gives up. */
function planStack(board, r) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const pieces = tile(board, r);
        const order = pieces && dropOrder(board, pieces, r);
        if (order) return order;
    }
    return null;
}

/** One or two flat pieces to set on top of the finished strip. */
function chooseToppers(block, r) {
    const board = block.slice();
    const moves = [];
    const count = r() < 0.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 30; tries++) {
            const { kind, o } = TOPPERS[Math.floor(r() * TOPPERS.length)];
            const x = Math.floor(r() * (COLS - o.w));        // never reaches the well column
            const y = landing(board, o.cells, x);
            if (y < 0 || y > STACK_TOP - 1) continue;
            const holeFree = o.cells.every(([dx, dy]) => dy < o.h - 1 || y + dy + 1 >= ROWS || board[at(x + dx, y + dy + 1)] !== 0);
            if (!holeFree) continue;
            const move = { kind, o, x, y };
            paint(board, move);
            moves.push(move);
            break;
        }
    }
    return moves;
}

/** Drop everything above the bottom four rows down by four, as a Tetris does. */
function afterClear(board) {
    const next = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < STACK_TOP; y++) for (let x = 0; x < COLS; x++) next[at(x, y + 4)] = board[at(x, y)];
    return next;
}

/** Plan the cycles: the pieces of each, and the board each one starts from. */
function planCycles(r, count) {
    const cycles = [];
    let left = new Uint8Array(COLS * ROWS);
    let stack = planStack(left, r);
    for (let c = 0; c < count; c++) {
        const last = c === count - 1;
        const block = left.slice();
        for (const m of stack) paint(block, m);
        let toppers = [];
        let nextLeft = new Uint8Array(COLS * ROWS);
        let nextStack = null;
        for (let attempt = 0; attempt < 120 && !last; attempt++) {
            toppers = chooseToppers(block, r);
            const after = block.slice();
            for (const m of toppers) paint(after, m);
            nextLeft = afterClear(after);
            nextStack = planStack(nextLeft, r);
            if (nextStack) break;
        }
        if (!last && !nextStack) throw new Error('neon demo: no plan for the next cycle');
        const well = { kind: 'I', o: ORIENTS.I.find(o => o.h === 4), x: WELL, y: STACK_TOP };
        cycles.push({ left, stack, toppers, well, nextLeft });
        left = nextLeft;
        stack = nextStack;
    }
    return cycles;
}

/**
 * The spawn shape of a kind, for a "next" preview.
 * @param {string} kind - one of KINDS
 * @returns {{ cells: number[][], w: number, h: number }}
 */
export function shapeOf(kind) {
    return ROTATIONS[kind][0];
}

const easeIn = u => u * u;
const clamp01 = u => Math.max(0, Math.min(1, u));

/**
 * Build the show.
 * @param {number} [seed]
 * @param {number} [cycleCount] - Tetrises before the loop restarts
 * @returns {{ period: number, cycles: Object[], moves: Object[], frame: (t: number) => Object,
 *             events: (t0: number, t1: number) => Array<{t: number, kind: string}> }}
 *   frame(t) returns { cells: [{x, y, k, flash}], piece: {k, cells: [[x, y]]} | null,
 *   ghost: [[x, y]] | null, sparks: [{x, y, k, a}], title: 0..1, next: number, lines, level, score }
 *   with x and y in cells (y may be fractional while something moves) and k an index into KINDS.
 */
export function createDemo(seed = 9, cycleCount = 6) {
    const r = rng(seed);
    const cycles = planCycles(r, cycleCount);

    // Lay every piece on a timeline
    const moves = [];
    const events = [];
    const bursts = [];
    let cursor = 0;
    cycles.forEach((cycle, ci) => {
        const board = cycle.left.slice();
        const list = [
            ...cycle.stack.map(m => ({ ...m, role: 'stack' })),
            ...cycle.toppers.map(m => ({ ...m, role: 'topper' })),
            { ...cycle.well, role: 'well' },
        ];
        for (const m of list) {
            const spawnX = Math.floor((COLS - ROTATIONS[m.kind][0].w) / 2);
            // Rotate the short way round: one step back for a three-quarter turn
            const steps = m.o.rot === 3 ? [3] : Array.from({ length: m.o.rot }, (_, i) => i + 1);
            const t0 = cursor;
            let t = t0 + 0.16 + r() * 0.08;
            const rotTimes = steps.map(() => { const at0 = t; t += 0.11; return at0; });
            const slideAt = t;
            const cols = Math.abs(m.x - spawnX);
            t += cols * 0.05 + 0.05;
            const dropAt = t;
            t += Math.max(0.1, m.y / 55);
            const move = {
                ...m, cycle: ci, before: board.slice(), spawnX, steps, rotTimes, slideAt, cols, dropAt, lockAt: t, spawnAt: t0,
            };
            moves.push(move);
            rotTimes.forEach(rt => events.push({ t: rt, kind: 'rotate' }));
            if (cols > 0) events.push({ t: slideAt, kind: 'move' });
            events.push({ t: dropAt, kind: 'drop' }, { t: t, kind: 'lock' });
            paint(board, m);
            cursor = t + 0.14 + r() * 0.2;
            if (m.role === 'well') {
                move.clear = { flashEnd: t + 0.6, burstAt: t + 0.6, collapseStart: t + 0.62, collapseEnd: t + 0.95, settled: cycle.toppers.length > 0 };
                move.after = board.slice();
                events.push({ t, kind: 'tetris' });
                bursts.push(t + 0.6);
                if (move.clear.settled) events.push({ t: t + 0.95, kind: 'land' });
                cursor = t + (ci === cycles.length - 1 ? 1.6 : 1.4);
            }
        }
    });
    const period = cursor;
    events.sort((a, b) => a.t - b.t);

    // Score and level: every Tetris is four lines, and the level rises every ten
    const scores = [0];
    const scoreAfter = n => {
        while (scores.length <= n) {
            const i = scores.length - 1;
            scores.push(scores[i] + 800 * (1 + Math.floor((i * 4) / 10)));
        }
        return scores[n];
    };

    const sparkSeed = rng(seed * 31 + 7);
    const sparkVel = Array.from({ length: COLS * ROWS * 2 }, () => [(sparkSeed() - 0.5) * 30, -6 - sparkSeed() * 22]);

    function frame(t) {
        const loops = Math.floor(t / period);
        const tt = t - loops * period;
        let idx = 0;
        for (let lo = 0, hi = moves.length - 1; lo <= hi;) {
            const mid = (lo + hi) >> 1;
            if (moves[mid].spawnAt <= tt) { idx = mid; lo = mid + 1; } else hi = mid - 1;
        }
        const m = moves[idx];
        const out = { cells: [], piece: null, ghost: null, sparks: [], title: 0, next: 0, lines: 0, level: 1, score: 0 };

        const addBoard = (board, from, to, dy = 0, flash = false) => {
            for (let y = from; y < to; y++) for (let x = 0; x < COLS; x++) {
                const v = board[at(x, y)];
                if (v) out.cells.push({ x, y: y + dy, k: v - 1, flash });
            }
        };

        out.next = KINDS.indexOf(moves[(idx + 1) % moves.length].kind);

        if (tt < m.lockAt) {
            addBoard(m.before, 0, ROWS);
            // The piece: waiting at the top, rotating, sliding, then falling
            const k = KINDS.indexOf(m.kind);
            let rot = 0;
            m.rotTimes.forEach((rt, i) => { if (tt >= rt) rot = m.steps[i]; });
            const shape = ROTATIONS[m.kind][rot].cells;
            let px = m.spawnX;
            let py = 0;
            if (tt >= m.slideAt) {
                const moved = Math.min(m.cols, Math.floor((tt - m.slideAt) / 0.05) + 1);
                px = m.spawnX + Math.sign(m.x - m.spawnX) * moved;
            }
            if (tt >= m.dropAt) py = m.y * easeIn(clamp01((tt - m.dropAt) / (m.lockAt - m.dropAt)));
            // After a rotation the piece is placed by its top-left corner, which is also where it lands
            if (tt >= m.dropAt) px = m.x;
            out.piece = { k, cells: shape.map(([dx, dy]) => [px + dx, py + dy]) };
            if (tt >= m.slideAt + Math.max(0, m.cols * 0.05) - 0.01) {
                out.ghost = m.o.cells.map(([dx, dy]) => [m.x + dx, m.y + dy]);
            }
        } else if (!m.clear) {
            addBoard(m.before, 0, ROWS);
            const lockedFor = tt - m.lockAt;
            for (const [dx, dy] of m.o.cells) out.cells.push({ x: m.x + dx, y: m.y + dy, k: KINDS.indexOf(m.kind), flash: lockedFor < 0.06 });
        } else {
            const c = m.clear;
            const since = tt - m.lockAt;
            if (tt < c.flashEnd) {
                const flash = Math.floor(since / 0.05) % 2 === 0;
                addBoard(m.after, 0, STACK_TOP);
                addBoard(m.after, STACK_TOP, ROWS, 0, flash);
            } else {
                const u = clamp01((tt - c.collapseStart) / (c.collapseEnd - c.collapseStart));
                addBoard(m.after, 0, STACK_TOP, 4 * easeIn(u));
                // Sparks from the four cleared rows
                const age = tt - c.burstAt;
                if (age < 0.9) {
                    for (let y = STACK_TOP; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                        const v = m.after[at(x, y)];
                        if (!v) continue;
                        for (let s = 0; s < 2; s++) {
                            const [vx, vy] = sparkVel[at(x, y) * 2 + s];
                            out.sparks.push({ x: x + 0.5 + (vx * age) / 7, y: y + 0.5 + (vy * age + 38 * age * age) / 7, k: v - 1, a: 1 - age / 0.9 });
                        }
                    }
                }
            }
            if (since < 1.5) out.title = Math.min(1, since / 0.12) * (since > 1.1 ? (1.5 - since) / 0.4 : 1);
        }

        // Counters go up for ever, across loops
        const done = bursts.filter(b => b <= tt).length;
        const tetrises = loops * cycles.length + done;
        out.lines = tetrises * 4;
        out.level = 1 + Math.floor(out.lines / 10);
        out.score = scoreAfter(tetrises);
        return out;
    }

    return {
        period,
        cycles,
        moves,
        frame,
        events(t0, t1) {
            const found = [];
            for (let p = Math.floor(t0 / period); p <= Math.floor(t1 / period); p++) {
                for (const e of events) {
                    const at0 = p * period + e.t;
                    if (at0 > t0 && at0 <= t1) found.push({ t: at0, kind: e.kind });
                }
            }
            return found;
        },
    };
}
