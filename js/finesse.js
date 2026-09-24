/**
 * finesse.js - The fewest inputs that reach each placement, for finesse faults.
 *
 * On an empty board, a breadth-first search from the spawn position finds the minimum
 * number of key presses to reach every orientation and column. Inputs are: tap left,
 * tap right, hold left or right to the wall (DAS, one press), rotate clockwise and
 * counterclockwise. A placement is identified by the shape of its filled cells and its
 * leftmost column, so the two equivalent orientations of I, S and Z count as one.
 */

import { COLS, BUFFER_ROWS, SHAPES, getSpawnPos, tryRotate } from './piece.js';
import { createMatrix, collide } from './board.js';

const EMPTY = createMatrix(COLS, BUFFER_ROWS);
const tables = new Map();

/** Key for a placement: trimmed cell pattern plus its leftmost absolute column. */
export function placementKey(matrix, x) {
    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
    matrix.forEach((row, y) => row.forEach((v, cx) => {
        if (v) { minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }));
    const rows = [];
    for (let y = minY; y <= maxY; y++) {
        rows.push(matrix[y].slice(minX, maxX + 1).map(v => (v ? 1 : 0)).join(''));
    }
    return `${rows.join('/')}@${x + minX}`;
}

function buildTable(shape) {
    const start = { shape, matrix: SHAPES[shape].matrix, rotation: 0, pos: getSpawnPos(SHAPES[shape].matrix) };
    const best = new Map();
    const seen = new Set();
    const queue = [[start, 0]];
    const stateKey = p => `${p.rotation}|${p.pos.x}|${p.pos.y}`;
    seen.add(stateKey(start));

    const copy = p => ({ shape: p.shape, matrix: p.matrix, rotation: p.rotation, pos: { ...p.pos } });
    const move = (p, dir, toWall) => {
        const n = copy(p);
        let moved = false;
        do {
            n.pos.x += dir;
            if (collide(EMPTY, n)) { n.pos.x -= dir; break; }
            moved = true;
        } while (toWall);
        return moved ? n : null;
    };
    const rotate = (p, dir) => {
        const n = copy(p);
        return tryRotate(n, EMPTY, collide, dir).success ? n : null;
    };

    while (queue.length) {
        const [p, d] = queue.shift();
        const key = placementKey(p.matrix, p.pos.x);
        if (!best.has(key) || best.get(key) > d) best.set(key, d);
        for (const next of [move(p, -1, false), move(p, 1, false), move(p, -1, true), move(p, 1, true), rotate(p, 1), rotate(p, -1)]) {
            if (!next) continue;
            const k = stateKey(next);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push([next, d + 1]);
        }
    }
    return best;
}

/**
 * Minimum inputs to place `shape` with the given final matrix at column x,
 * or null if that placement is not reachable on an empty board (for example a
 * piece tucked under an overhang).
 */
export function minimumInputs(shape, matrix, x) {
    if (!tables.has(shape)) tables.set(shape, buildTable(shape));
    return tables.get(shape).get(placementKey(matrix, x)) ?? null;
}
