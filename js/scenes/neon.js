/**
 * neon.js - Neon block outlines falling over a scrolling synthwave grid (Casual).
 * Signature look: night. This scene keeps its own sky and colors in every weather,
 * because its palette is made of light: a retro striped sun on the horizon, a grid
 * that glows, and blocks that fall in every kind of weather.
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

/**
 * The look in each weather: sky gradient, floor gradient, grid color, the retro sun
 * ([top, bottom] colors and radius, or null), how strongly the blocks glow.
 */
const LOOKS = {
    sunny: {
        sky: ['#5a6cf0', '#7f84f4', '#b48cf0', '#ee8cd0', '#ffb0b8', '#ffd8a8'],
        floor: ['#b070e8', '#8a50c8', '#6a38a8'], grid: '#ffffff', horizon: '#ffffff',
        sun: ['#fff6b0', '#ffb0c8', 20], glow: 0.7,
    },
    cloudy: {
        sky: ['#585888', '#68689a', '#7878a8', '#8a8ab4', '#9e9ec0', '#b2b2cc'],
        floor: ['#6a6a98', '#54547e', '#404068'], grid: '#c8c8f0', horizon: '#e0e0ff',
        sun: null, glow: 0.6,
    },
    sunset: {
        sky: ['#0d0221', '#2a0a4a', '#5a1a7a', '#c02a8a', '#ff5a6a', '#ffb04a'],
        floor: ['#2a0a3a', '#160520', '#0a0212'], grid: '#ff4fb4', horizon: '#ffb04a',
        sun: ['#ffe066', '#ff3f8a', 26], glow: 1,
    },
    rain: {
        sky: ['#22223c', '#2c2c4a', '#383858', '#444466', '#545476', '#666688'],
        floor: ['#2a2a48', '#1c1c34', '#101022'], grid: '#7a8ad0', horizon: '#9aaae8',
        sun: null, glow: 0.85,
    },
    thunder: {
        sky: ['#0a0a16', '#12121f', '#1a1a2a', '#242434', '#30303f', '#3e3e50'],
        floor: ['#16162a', '#0c0c1a', '#06060e'], grid: '#8a7aff', horizon: '#a89aff',
        sun: null, glow: 1,
    },
    night: {
        sky: ['#05030d', '#0b0620', '#170a34', '#2a0d47', '#46125a', '#5e1a6a'],
        floor: ['#1a0628', '#0c0416', '#06020c'], grid: '#ff4fb4', horizon: '#ff4fb4',
        sun: ['#ff9ad0', '#c02a8a', 16], glow: 1,
    },
    nightthunder: {
        sky: ['#020208', '#05050e', '#0a0a16', '#101020', '#181828', '#222236'],
        floor: ['#0e0a1e', '#08061a', '#040310'], grid: '#7a5aff', horizon: '#9a7aff',
        sun: null, glow: 1,
    },
};

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

/** The retro sun: a half disc with dark stripes that thicken toward the bottom, on the horizon. */
function retroSun(ctx, x, y, r, top, bottom) {
    const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const from = hex(top);
    const to = hex(bottom);
    for (let row = 0; row <= r; row++) {
        const k = row / r;
        if (k > 0.4 && row % 6 < Math.round((k - 0.3) * 5)) continue;
        const dy = row - r;
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        const c = from.map((v, i) => Math.round(v + (to[i] - v) * k));
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(x - half, y + dy, half * 2 + 1, 1);
    }
}

export default {
    id: 'neon',
    name: 'Neon Fall',
    signature: 'night',
    horizon: HORIZON,
    celestial: { sunX: 160, sunHighY: 60, sunLowY: 60, moonX: 160, moonY: 60 },
    fog: [HORIZON - 30, HORIZON + 40],
    rainBand: [HORIZON + 10, H - 4],
    sounds: { always: { hum: 0.6 }, day: {}, night: {} },
    create(env) {
        const look = LOOKS[env.id];
        const sky = env.makeSky({ palette: look.sky, noSun: true });
        const sc = sky.canvas.getContext('2d');
        glow(sc, 160, HORIZON, 60, look.horizon, 0.3);
        if (look.sun) retroSun(sc, 160, HORIZON, look.sun[2], look.sun[0], look.sun[1]);

        const floor = layer();
        ditherGradient(floor.ctx, 0, HORIZON, W, H - HORIZON, look.floor);
        rect(floor.ctx, 0, HORIZON, W, 1, look.horizon);

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
        const rush = 1.4 + env.wind * 0.3;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(floor.canvas, 0, 0);

                // Grid floor: lines rushing toward the viewer, and lines to the vanishing point
                ctx.fillStyle = look.grid;
                for (let i = 0; i < 12; i++) {
                    const z = wrap(i - t * rush, 12) / 12;
                    const y = HORIZON + Math.round(Math.pow(z, 2.2) * (H - HORIZON));
                    ctx.globalAlpha = (0.25 + z * 0.75) * 0.55;
                    ctx.fillRect(0, y, W, 1);
                }
                ctx.globalAlpha = 0.28;
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
                    drawPiece(ctx, p.shape, x, y - p.cell * 3, p.cell, p.color, 0.15 * look.glow);
                    drawPiece(ctx, p.shape, x, y - p.cell * 1.5, p.cell, p.color, 0.3 * look.glow);
                    drawPiece(ctx, p.shape, x, y, p.cell, p.color, Math.min(1, 0.55 + 0.45 * look.glow));
                }
            },
        };
    },
};
