/**
 * blocks.js - Retro Blocks: the basic blocks of the original look (Classic). Stacks of
 * 8-bit blocks rise on both sides over a dotted lattice, and pieces tick down one cell at
 * a time. The colors are the palette of the game's current level, so the wall and the
 * pieces on the board change together.
 */

import { W, H, rng, layer, rect, parseColor } from './pixel.js';
import { SHAPES, rotateMatrix } from '../piece.js';
import { NES_PALETTES, NES_BLOCK_KIND, paintNesBlock } from '../classic.js';

const CELL = 8;
const STACK_COLS = 9;
const STACK_ROWS = 14;
const LETTERS = Object.keys(SHAPES);

const cache = new Map();

/** The three block sprites in a palette, as small canvases. */
function sprites(p) {
    if (!cache.has(`s${p}`)) {
        const out = {};
        for (const kind of ['light', 'dark', 'ring']) {
            const c = layer(CELL, CELL);
            paintNesBlock(c.ctx, 0, 0, CELL, kind, NES_PALETTES[p]);
            out[kind] = c.canvas;
        }
        cache.set(`s${p}`, out);
    }
    return cache.get(`s${p}`);
}

/** Mix a hex color toward black. */
function dim(hex, k) {
    const [r, g, b] = parseColor(hex);
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

/**
 * Drop random pieces into a narrow well and return what settled, as rows of letters
 * (or null) from the top, so the stacks look like real play.
 */
function buildStack(seed, pieces) {
    const r = rng(seed);
    const board = Array.from({ length: STACK_ROWS }, () => new Array(STACK_COLS).fill(null));
    const fits = (m, x, y) => m.every((row, dy) => row.every((v, dx) => {
        if (!v) return true;
        const bx = x + dx;
        const by = y + dy;
        return bx >= 0 && bx < STACK_COLS && by < STACK_ROWS && (by < 0 || !board[by][bx]);
    }));
    for (let i = 0; i < pieces; i++) {
        const letter = LETTERS[Math.floor(r() * LETTERS.length)];
        let m = SHAPES[letter].matrix;
        for (let k = Math.floor(r() * 4); k > 0; k--) m = rotateMatrix(m, 1);
        const x = Math.floor(r() * (STACK_COLS - m[0].length + 1));
        let y = -m.length;
        if (!fits(m, x, y)) continue;
        while (fits(m, x, y + 1)) y++;
        m.forEach((row, dy) => row.forEach((v, dx) => {
            if (v && y + dy >= 0) board[y + dy][x + dx] = letter;
        }));
    }
    return board;
}

/** Static layer for one palette: black, a dotted lattice, and the two stacks. */
function buildLayer(p, stacks) {
    const l = layer();
    const ctx = l.ctx;
    const [light, dark] = NES_PALETTES[p];
    rect(ctx, 0, 0, W, H, '#000000');

    const dot = dim(dark, 0.42);
    const faint = dim(light, 0.16);
    for (let row = 0; row * CELL < H; row++) {
        for (let col = 0; col * CELL < W; col++) {
            const ox = col * CELL + (row % 2 ? 4 : 0);
            rect(ctx, ox + 2, row * CELL + 3, 2, 2, dot);
            if ((row + col) % 5 === 0) rect(ctx, ox + 3, row * CELL + 2, 1, 4, faint);
        }
    }
    // A darker band in the middle keeps the playfield readable on top
    const shade = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    const s = sprites(p);
    stacks.forEach(({ board, x }) => {
        board.forEach((row, ry) => row.forEach((letter, rx) => {
            if (!letter) return;
            ctx.drawImage(s[NES_BLOCK_KIND[letter]], x + rx * CELL, H - (STACK_ROWS - ry) * CELL);
        }));
    });
    return l.canvas;
}

export default {
    id: 'blocks',
    name: 'Retro Blocks',
    // Classic scenes keep their own look in every weather and play no scene sounds (see background.js)
    quiet: true,
    signature: 'sunny',
    create() {
        const stacks = [
            { board: buildStack(5, 34), x: 0 },
            { board: buildStack(12, 34), x: W - STACK_COLS * CELL },
        ];
        const r = rng(91);
        const rows = Math.ceil(H / CELL) + 6;
        const fallers = Array.from({ length: 12 }, (_, i) => ({
            letter: LETTERS[i % LETTERS.length],
            x: Math.floor(r() * (W / CELL - 4)) * CELL,
            speed: 0.9 + r() * 1.8,
            phase: r() * rows,
            turn: 0.25 + r() * 0.35,
            spin: Math.floor(r() * 4),
        }));
        const layers = [];

        return {
            draw(ctx, t, { level = 0 } = {}) {
                const p = ((level % NES_PALETTES.length) + NES_PALETTES.length) % NES_PALETTES.length;
                if (!layers[p]) layers[p] = buildLayer(p, stacks);
                ctx.drawImage(layers[p], 0, 0);

                const s = sprites(p);
                for (const f of fallers) {
                    const step = Math.floor(f.phase + t * f.speed);
                    const y = (step % rows) * CELL - 4 * CELL;
                    let m = SHAPES[f.letter].matrix;
                    for (let k = (f.spin + Math.floor(step * f.turn)) % 4; k > 0; k--) m = rotateMatrix(m, 1);
                    const sprite = s[NES_BLOCK_KIND[f.letter]];
                    m.forEach((row, ry) => row.forEach((v, rx) => {
                        if (v) ctx.drawImage(sprite, f.x + rx * CELL, y + ry * CELL);
                    }));
                }
            },
        };
    },
};
