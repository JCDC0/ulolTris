/**
 * ulol.js - ulol Night: the uloltris look as a place. A teal moon and a purple moon (the
 * "u" and "lol" of the logo) over a lake, block-stack skylines in the game's own bevel
 * skin fading into the haze, and glowing pieces drifting up like lanterns (Classic).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, wrap } from './pixel.js';
import { SHAPES, rotateMatrix } from '../piece.js';
import { blockSprite } from '../skins.js';

const HORIZON = 140;
const LETTERS = Object.keys(SHAPES);
const TEAL = '#5ee8c8';
const PURPLE = '#cf5ce0';

/**
 * Drop random pieces into a well, like a game in progress, and return the settled
 * cells as rows of piece letters (or null).
 */
function buildStack(seed, cols, rows, pieces) {
    const r = rng(seed);
    const board = Array.from({ length: rows }, () => new Array(cols).fill(null));
    const fits = (m, x, y) => m.every((row, dy) => row.every((v, dx) => {
        if (!v) return true;
        const bx = x + dx;
        const by = y + dy;
        return bx >= 0 && bx < cols && by < rows && (by < 0 || !board[by][bx]);
    }));
    for (let i = 0; i < pieces; i++) {
        const letter = LETTERS[Math.floor(r() * LETTERS.length)];
        let m = SHAPES[letter].matrix;
        for (let k = Math.floor(r() * 4); k > 0; k--) m = rotateMatrix(m, 1);
        const x = Math.floor(r() * (cols - m[0].length + 1));
        let y = -m.length;
        if (!fits(m, x, y)) continue;
        while (fits(m, x, y + 1)) y++;
        m.forEach((row, dy) => row.forEach((v, dx) => {
            if (v && y + dy >= 0) board[y + dy][x + dx] = letter;
        }));
    }
    return board;
}

/**
 * Paint a stack standing on the horizon, then tint everything it painted toward the
 * sky color so far layers sink into the haze.
 */
function paintStack(ctx, board, x, cell, haze, hazeColor) {
    const tmp = layer();
    board.forEach((row, ry) => row.forEach((letter, rx) => {
        if (!letter) return;
        tmp.ctx.drawImage(blockSprite('ulol', SHAPES[letter].color, cell), x + rx * cell, HORIZON - (board.length - ry) * cell);
    }));
    tmp.ctx.globalCompositeOperation = 'source-atop';
    tmp.ctx.globalAlpha = haze;
    tmp.ctx.fillStyle = hazeColor;
    tmp.ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp.canvas, 0, 0);
}

export default {
    id: 'ulol',
    name: 'ulol Night',
    // Classic scenes keep their own look in every weather and play no scene sounds (see background.js)
    quiet: true,
    signature: 'sunny',
    create() {
        const base = layer();
        const b = base.ctx;
        ditherGradient(b, 0, 0, W, HORIZON, ['#04040b', '#080819', '#10103a', '#1c1160', '#32177a', '#4f2488']);
        glow(b, 38, 30, 28, '#1b5a66', 0.6);
        disc(b, 38, 30, 12, '#d8fff4');
        disc(b, 41, 27, 10, '#9af3dc');
        disc(b, 35, 32, 2, '#7fdcc4');
        glow(b, 284, 38, 20, '#5a2a7a', 0.6);
        disc(b, 284, 38, 7, '#f0c8f8');
        disc(b, 286, 36, 5, '#d99ae8');
        glow(b, 160, HORIZON, 70, '#4d2a80', 0.45);

        // Skylines of block stacks: far, mid and near, each hazier the farther it is
        paintStack(b, buildStack(31, 64, 9, 110), 0, 5, 0.74, '#3a1f78');
        paintStack(b, buildStack(37, 12, 11, 34), -4, 8, 0.5, '#2a1a68');
        paintStack(b, buildStack(41, 12, 11, 34), W - 92, 8, 0.5, '#2a1a68');
        paintStack(b, buildStack(53, 8, 8, 17), 2, 10, 0.2, '#1a1050');
        paintStack(b, buildStack(59, 8, 8, 17), W - 82, 10, 0.2, '#1a1050');

        // The lake: the land flipped and dimmed, redrawn each frame with a ripple
        const strip = 48;
        const mirror = layer(W, strip);
        mirror.ctx.save();
        mirror.ctx.translate(0, strip);
        mirror.ctx.scale(1, -1);
        mirror.ctx.drawImage(base.canvas, 0, HORIZON - strip, W, strip, 0, 0, W, strip);
        mirror.ctx.restore();
        ditherGradient(b, 0, HORIZON, W, H - HORIZON, ['#0d0a2a', '#080620', '#05040f']);
        rect(b, 0, HORIZON, W, 1, TEAL);

        const r = rng(7);
        const stars = Array.from({ length: 80 }, () => ({
            x: Math.floor(r() * W), y: Math.floor(r() * (HORIZON - 40)), p: r() * 6,
            c: ['#ffffff', TEAL, '#d9b8ff'][Math.floor(r() * 3)],
        }));
        const lanterns = Array.from({ length: 9 }, () => {
            const letter = LETTERS[Math.floor(r() * LETTERS.length)];
            let matrix = SHAPES[letter].matrix;
            for (let k = Math.floor(r() * 4); k > 0; k--) matrix = rotateMatrix(matrix, 1);
            return {
                letter, matrix, cell: r() < 0.5 ? 5 : 6, x: 14 + r() * (W - 60), y: r() * H,
                speed: 5 + r() * 7, p: r() * 6,
            };
        });
        const glints = [{ x: 38, c: '#b6fff0' }, { x: 284, c: '#f0b8ff' }];

        return {
            draw(ctx, t) {
                ctx.drawImage(base.canvas, 0, 0);
                for (const s of stars) if (Math.sin(t * 1.6 + s.p) > -0.2) px(ctx, s.x, s.y, s.c);

                // Reflection with a slow ripple, fading with depth
                for (let i = 0; i < strip; i += 2) {
                    ctx.globalAlpha = 0.5 * (1 - i / strip);
                    const dx = Math.round(Math.sin(t * 1.3 + i * 0.55) * (1 + i * 0.05));
                    ctx.drawImage(mirror.canvas, 0, i, W, 2, dx, HORIZON + 1 + i, W, 2);
                }
                ctx.globalAlpha = 1;

                // Moon glints on the water
                for (const g of glints) {
                    for (let i = 0; i < 9; i++) {
                        const y = HORIZON + 3 + i * 4 + Math.round(Math.sin(t * 2 + i + g.x) * 1.2);
                        const half = 6 - Math.floor(i / 2) + Math.round(Math.sin(t * 3 + i * 2) * 1.5);
                        ctx.globalAlpha = 0.65 - i * 0.06;
                        rect(ctx, g.x - half, y, half * 2, 1, g.c);
                    }
                }
                ctx.globalAlpha = 1;

                // Lanterns: pieces in the game's skin, drifting up and fading in and out
                for (const l of lanterns) {
                    const y = H + 30 - wrap(t * l.speed + l.p * 40, H + 60);
                    const x = l.x + Math.sin(t * 0.4 + l.p) * 5;
                    const fade = Math.min(1, (H - y) / 40, y / 50 + 0.2);
                    if (fade <= 0) continue;
                    const w = l.matrix[0].length * l.cell;
                    ctx.globalAlpha = 0.4 * fade;
                    glow(ctx, Math.round(x + w / 2), Math.round(y + w / 2), 14, SHAPES[l.letter].color, 0.5);
                    ctx.globalAlpha = Math.max(0, fade);
                    const sprite = blockSprite('ulol', SHAPES[l.letter].color, l.cell);
                    l.matrix.forEach((row, ry) => row.forEach((v, rx) => {
                        if (v) ctx.drawImage(sprite, Math.round(x + rx * l.cell), Math.round(y + ry * l.cell));
                    }));
                }
                ctx.globalAlpha = 1;
            },
        };
    },
};
