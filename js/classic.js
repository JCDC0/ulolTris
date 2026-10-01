/**
 * classic.js - Rules and pixel art for the Classic mode (original 8-bit rules).
 *
 * Pure logic with no DOM, so tests can run it in Node: the gravity table, the line
 * score, level progression, the one-reroll randomizer, the no-kick rotation system
 * with its spawn orientations, and the level palettes with the block art.
 *
 * The numbers follow the 1989 console release (NTSC): 60.0988 frames per second,
 * gravity in frames per row, points of 40, 100, 300 and 1200 times level + 1, and a
 * level up every ten lines. The code and art here are original.
 */

import { COLS, BUFFER_ROWS, VISIBLE_ROWS, SHAPES, rotateMatrix } from './piece.js';

export const NES_FPS = 60.0988;
export const NES_FRAME_MS = 1000 / NES_FPS;

/** Soft drop moves one row every 2 frames, or at gravity speed once that is faster. */
export const SOFT_DROP_FRAMES = 2;

/** Frames per row for levels 0 to 18. Levels 19 to 28 use 2, level 29 and up use 1. */
const GRAVITY_FRAMES = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3];

export const MAX_START_LEVEL = 19;

/**
 * Frames between gravity drops at a level.
 * @param {number} level - 0 or higher
 */
export function classicGravityFrames(level) {
    if (level < GRAVITY_FRAMES.length) return GRAVITY_FRAMES[Math.max(0, level)];
    return level < 29 ? 2 : 1;
}

/** Milliseconds between gravity drops at a level. */
export function classicGravityMs(level) {
    return classicGravityFrames(level) * NES_FRAME_MS;
}

// --- Scoring ---

/** Points for clearing 0 to 4 lines at once, before the level multiplier. */
export const CLASSIC_LINE_POINTS = [0, 40, 100, 300, 1200];
const CLEAR_ACTIONS = [null, 'single', 'double', 'triple', 'tetris'];
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

/**
 * Score a clear the classic way: line points times (level + 1). T-spins, combos,
 * back-to-back and perfect clears are worth nothing extra. The result has the same
 * shape as calculateScore() in scoring.js so the HUD and sounds can share it.
 *
 * @param {number} lines - Lines cleared by this piece (0 to 4)
 * @param {number} level - Level the lines were cleared at (starts at 0)
 */
export function calculateClassicScore(lines, level) {
    const n = Math.max(0, Math.min(4, lines));
    return {
        points: CLASSIC_LINE_POINTS[n] * (level + 1),
        action: CLEAR_ACTIONS[n],
        actionName: CLEAR_NAMES[n],
        combo: 0,
        b2b: false,
        b2bCount: 0,
        perfectClear: false,
        isClearAction: n > 0,
        allActions: n > 0 ? [CLEAR_NAMES[n]] : [],
    };
}

// --- Levels ---

/**
 * Lines needed for the first level up. Starting on a high level makes you clear more
 * lines before it advances: min(start * 10 + 10, max(100, start * 10 - 50)).
 */
export function classicFirstLevelUp(startLevel) {
    return Math.min(startLevel * 10 + 10, Math.max(100, startLevel * 10 - 50));
}

/** Level after a number of cleared lines, counting from the start level. */
export function classicLevel(lines, startLevel) {
    const first = classicFirstLevelUp(startLevel);
    if (lines < first) return startLevel;
    return startLevel + 1 + Math.floor((lines - first) / 10);
}

/** Fraction (0 to 1) of the way to the next level, for the progress meter. */
export function classicLevelProgress(lines, startLevel) {
    const first = classicFirstLevelUp(startLevel);
    if (lines < first) return lines / first;
    return ((lines - first) % 10) / 10;
}

// --- Randomizer ---

/** The order the console game indexes its pieces in. */
const NES_ORDER = ['T', 'J', 'Z', 'O', 'S', 'L', 'I'];

/**
 * Pick the next piece: roll one of 8 slots, and if that is the spare slot or repeats
 * the previous piece, roll again once. Repeats are rarer than pure random but still
 * possible, and droughts are far more common than with a 7-bag.
 *
 * @param {string|null} prev - The piece before this one
 * @param {() => number} [rand] - Random source (0 to 1), replaceable for tests
 */
export function nextClassicPiece(prev, rand = Math.random) {
    let i = Math.floor(rand() * 8);
    if (i === 7 || NES_ORDER[i] === prev) i = Math.floor(rand() * 7);
    return NES_ORDER[i];
}

/**
 * Top up a queue with the classic randomizer.
 * @param {string[]} queue - Upcoming pieces, mutated
 * @param {string|null} last - The piece that is in play, when the queue is empty
 */
export function fillClassicQueue(queue, last = null, minSize = 7, rand = Math.random) {
    while (queue.length < minSize) {
        queue.push(nextClassicPiece(queue.length ? queue[queue.length - 1] : last, rand));
    }
}

// --- Spawn and rotation ---

const rotate180 = m => rotateMatrix(rotateMatrix(m, 1), 1);

/** Spawn orientation: T, J and L start flat side up with the stub below, like the original. */
const SPAWN_MATRICES = {
    I: SHAPES.I.matrix,
    J: rotate180(SHAPES.J.matrix),
    L: rotate180(SHAPES.L.matrix),
    O: SHAPES.O.matrix,
    S: SHAPES.S.matrix,
    T: rotate180(SHAPES.T.matrix),
    Z: SHAPES.Z.matrix,
};

/** I, S and Z flip between two orientations; O does not rotate. */
const TWO_STATE = new Set(['I', 'S', 'Z']);

/** The matrix a piece spawns with (also what the next preview shows). */
export function classicMatrix(shape) {
    return SPAWN_MATRICES[shape];
}

/**
 * Spawn position: horizontally centered left of middle, with the top filled row on the
 * first row of the field. Pieces appear inside the field, not above it.
 */
export function getClassicSpawnPos(matrix) {
    const top = Math.max(0, matrix.findIndex(row => row.some(v => v !== 0)));
    return {
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: BUFFER_ROWS - VISIBLE_ROWS - top,
    };
}

/**
 * Rotate without wall kicks: if the rotated piece overlaps anything it stays put.
 * Same contract as tryRotate() in piece.js.
 *
 * @returns {{ success: boolean, kickIndex: number }}
 */
export function tryRotateClassic(player, arena, collide, dir) {
    if (player.shape === 'O') return { success: false, kickIndex: -1 };

    const matrix = player.matrix;
    const rotation = player.rotation;
    if (TWO_STATE.has(player.shape)) {
        player.matrix = rotateMatrix(matrix, rotation === 0 ? 1 : -1);
        player.rotation = rotation === 0 ? 1 : 0;
    } else {
        player.matrix = rotateMatrix(matrix, dir);
        player.rotation = (rotation + dir + 4) % 4;
    }

    if (collide(arena, player)) {
        player.matrix = matrix;
        player.rotation = rotation;
        return { success: false, kickIndex: -1 };
    }
    return { success: true, kickIndex: 0 };
}

// --- Block art ---

/**
 * Block colors for each level, a light and a dark shade, cycling every ten levels like
 * the original's palettes. Hand-picked, in the spirit of the 8-bit look.
 */
export const NES_PALETTES = [
    ['#3cbcfc', '#0058f8'],
    ['#b8f818', '#00a800'],
    ['#f8a8f8', '#b800b8'],
    ['#6888fc', '#6844fc'],
    ['#58f898', '#e40058'],
    ['#58f898', '#6888fc'],
    ['#f87858', '#7c7c7c'],
    ['#9878f8', '#a80020'],
    ['#3cbcfc', '#a80020'],
    ['#fca044', '#d82800'],
];

/** Palette for a level (levels past 9 repeat the cycle). */
export function nesPalette(level) {
    return NES_PALETTES[((level % NES_PALETTES.length) + NES_PALETTES.length) % NES_PALETTES.length];
}

/**
 * 8 x 8 block sprites. '.' black, 'W' white, '1' the light color, '2' the dark color.
 * Each has a white edge on the top and left, a black edge on the bottom and right, and
 * a small shine, so adjacent blocks keep a crisp seam.
 */
export const NES_BLOCK_ART = {
    light: [
        'WWWWWWW.',
        'W111111.',
        'W1WW111.',
        'W1WW111.',
        'W111111.',
        'W111111.',
        'W111111.',
        '........',
    ],
    dark: [
        'WWWWWWW.',
        'W222222.',
        'W2WW222.',
        'W2WW222.',
        'W222222.',
        'W222222.',
        'W222222.',
        '........',
    ],
    ring: [
        'WWWWWWW.',
        'WWWWWWW.',
        'WW1111W.',
        'WW1111W.',
        'WW1111W.',
        'WW1111W.',
        'WWWWWWW.',
        '........',
    ],
};

/** Which art each piece wears. */
export const NES_BLOCK_KIND = { T: 'light', O: 'light', I: 'light', J: 'dark', S: 'dark', Z: 'ring', L: 'ring' };

/**
 * Paint one block into a context. The 8 x 8 art is scaled by whole-pixel edges, so it
 * stays crisp at any size without smoothing.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Left edge
 * @param {number} y - Top edge
 * @param {number} size - Width and height in pixels
 * @param {string} kind - Key of NES_BLOCK_ART
 * @param {string[]} palette - [light, dark]
 */
export function paintNesBlock(ctx, x, y, size, kind, palette) {
    const colors = { '.': '#000000', W: '#ffffff', 1: palette[0], 2: palette[1] };
    const art = NES_BLOCK_ART[kind];
    const edge = i => Math.round((i * size) / 8);
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            ctx.fillStyle = colors[art[row][col]];
            ctx.fillRect(x + edge(col), y + edge(row), edge(col + 1) - edge(col), edge(row + 1) - edge(row));
        }
    }
}
