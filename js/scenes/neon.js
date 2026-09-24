/**
 * neon.js - Neon block outlines falling over a scrolling synthwave grid (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, glow, wrap } from './pixel.js';

const HORIZON = 118;
const SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]],
];
const COLORS = ['#3ff5d0', '#ff4fb4', '#ffd84a', '#7a6bff', '#9bff5a', '#ff7a3a'];

function rotate(m) {
    return m[0].map((_, i) => m.map(row => row[i]).reverse());
}

function drawPiece(ctx, shape, x, y, cell, color, alpha) {
    ctx.globalAlpha = alpha;
    shape.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return;
        const cx = Math.round(x + c * cell);
        const cy = Math.round(y + r * cell);
        rect(ctx, cx, cy, cell, 1, color);
        rect(ctx, cx, cy + cell - 1, cell, 1, color);
        rect(ctx, cx, cy, 1, cell, color);
        rect(ctx, cx + cell - 1, cy, 1, cell, color);
        if (cell >= 6) rect(ctx, cx + 2, cy + 2, cell - 4, cell - 4, 'rgba(255,255,255,0.12)');
    }));
    ctx.globalAlpha = 1;
}

export default {
    id: 'neon',
    name: 'Neon Fall',
    create() {
        const base = layer();
        ditherGradient(base.ctx, 0, 0, W, HORIZON, ['#05030d', '#0b0620', '#170a34', '#2a0d47', '#46125a']);
        ditherGradient(base.ctx, 0, HORIZON, W, H - HORIZON, ['#1a0628', '#0c0416', '#06020c']);
        glow(base.ctx, 160, HORIZON, 60, '#5a1a6a', 0.45);
        rect(base.ctx, 0, HORIZON, W, 1, '#ff4fb4');

        const r = rng(71);
        const pieces = Array.from({ length: 18 }, () => {
            let shape = SHAPES[Math.floor(r() * SHAPES.length)];
            for (let k = Math.floor(r() * 4); k > 0; k--) shape = rotate(shape);
            const cell = r() < 0.35 ? 7 : r() < 0.6 ? 5 : 4;
            return {
                shape, cell, x: r() * (W - 30), y: r() * H, speed: 6 + cell * 2.2 + r() * 6,
                color: COLORS[Math.floor(r() * COLORS.length)], p: r() * 6,
            };
        }).sort((a, b) => a.cell - b.cell);
        const stars = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * (HORIZON - 10)), p: r() * 6 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(base.canvas, 0, 0);
                for (const s of stars) if (Math.sin(t * 2 + s.p) > 0.3) px(ctx, s.x, s.y, '#b9a8ff');

                // Grid floor: lines rushing toward the viewer, and lines to the vanishing point
                ctx.fillStyle = 'rgba(255, 79, 180, 0.55)';
                for (let i = 0; i < 12; i++) {
                    const z = wrap(i - t * 1.4, 12) / 12;
                    const y = HORIZON + Math.round(Math.pow(z, 2.2) * (H - HORIZON));
                    ctx.globalAlpha = 0.25 + z * 0.75;
                    ctx.fillRect(0, y, W, 1);
                }
                ctx.globalAlpha = 0.5;
                for (let i = -12; i <= 12; i++) {
                    const bottomX = 160 + i * 34;
                    for (let y = HORIZON + 1; y < H; y += 1) {
                        const k = (y - HORIZON) / (H - HORIZON);
                        ctx.fillRect(Math.round(160 + (bottomX - 160) * k), y, 1, 1);
                    }
                }
                ctx.globalAlpha = 1;

                for (const p of pieces) {
                    const y = wrap(p.y + t * p.speed, H + 50) - 40;
                    const x = p.x + Math.sin(t * 0.3 + p.p) * 3;
                    drawPiece(ctx, p.shape, x, y - p.cell * 3, p.cell, p.color, 0.15);
                    drawPiece(ctx, p.shape, x, y - p.cell * 1.5, p.cell, p.color, 0.3);
                    drawPiece(ctx, p.shape, x, y, p.cell, p.color, 1);
                }
            },
        };
    },
};
