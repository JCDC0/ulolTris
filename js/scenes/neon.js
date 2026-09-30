/**
 * neon.js - An 80s arcade night over a scrolling synthwave grid (Casual). Signature
 * look: night. This scene keeps its own sky and colors in every weather, because its
 * palette is made of light: a retro striped sun on the horizon, a grid that glows, and
 * a glowing block stacker that plays itself on the right (see neon-demo.js): it builds
 * four rows, drops an I piece down the well for a Tetris, lets the rest fall, and starts
 * over for ever. A few neon pieces drift down the left half behind it. The demo reports
 * its moves through `events` so the arcade sounds land on the beat of the picture.
 */

import { W, H, rng, layer, rect, ditherGradient, glow, wrap } from './pixel.js';
import { createDemo, COLS, ROWS, KINDS, shapeOf } from './neon-demo.js';

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
/** The stacker's piece colors, in the order of KINDS (I O T S Z J L). */
const KIND_COLORS = ['#3ff5d0', '#ffd84a', '#b06bff', '#9bff5a', '#ff4f7a', '#4f8bff', '#ff9a3a'];
const CELL = 7;
const BOARD = { x: 232, y: 30 };
const PANEL = { x: 187, y: 30, w: 39 };

/** A 3 x 5 pixel font: the letters and digits the stacker's readout needs. */
const GLYPHS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
    T: '111010010010010', E: '111100111100111', R: '111101111110101', I: '111010010010111', S: '111100111001111',
    L: '100100100100111', N: '111101101101101', V: '101101101101010', C: '111100100100111', O: '111101101101111',
    X: '101101010101101', D: '110101101101110',
};

/** Draw a string in the pixel font; `scale` makes each font pixel a square of that many pixels. */
function text(ctx, str, x, y, color, scale = 1) {
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of String(str)) {
        const g = GLYPHS[ch];
        if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
        cx += 4 * scale;
    }
}
const textWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;

/** One block as a neon outline with a dim fill, drawn once and stamped. */
function cellSprite(color, white) {
    const c = document.createElement('canvas');
    c.width = c.height = CELL;
    const g = c.getContext('2d');
    g.fillStyle = white ? '#ffffff' : color;
    g.fillRect(0, 0, CELL, CELL);
    g.fillStyle = white ? 'rgba(255,255,255,0.78)' : 'rgba(8,2,20,0.66)';
    g.fillRect(1, 1, CELL - 2, CELL - 2);
    g.globalAlpha = white ? 0 : 0.42;
    g.fillStyle = color;
    g.fillRect(2, 2, CELL - 4, CELL - 4);
    g.globalAlpha = 0.75;
    g.fillStyle = '#ffffff';
    g.fillRect(1, 1, 1, 1);
    return c;
}

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
    sounds: { always: { hum: 0.35, arcade: 1, cabinets: 0.6 }, day: {}, night: {} },
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
        // A few pieces drift down the left half; the stacker owns the right
        const pieces = Array.from({ length: 10 }, () => {
            let shape = SHAPES[Math.floor(r() * SHAPES.length)];
            for (let k = Math.floor(r() * 4); k > 0; k--) shape = rotate(shape);
            const cell = r() < 0.35 ? 7 : r() < 0.6 ? 5 : 4;
            return {
                shape, cell, x: r() * 150, y: r() * H, speed: 6 + cell * 2.2 + r() * 6,
                color: COLORS[Math.floor(r() * COLORS.length)], p: r() * 6,
            };
        }).sort((a, b) => a.cell - b.cell);
        const rush = 1.4 + env.wind * 0.3;

        const demo = createDemo(9, 6);
        const sprites = KIND_COLORS.map(c => cellSprite(c, false));
        const flashSprites = KIND_COLORS.map(c => cellSprite(c, true));
        const ink = look.grid === '#ffffff' ? '#e8f4ff' : look.grid;
        const cellsW = COLS * CELL, cellsH = ROWS * CELL;

        /** The stacker: panel, board, pieces, sparks and the TETRIS banner. */
        function drawStacker(ctx, t) {
            const f = demo.frame(t);
            const { x: bx, y: by } = BOARD;

            // Readout on the left of the board
            ctx.fillStyle = 'rgba(6,2,16,0.5)';
            ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, 100);
            text(ctx, 'NEXT', PANEL.x + 5, PANEL.y + 4, ink);
            const shape = shapeOf(KINDS[f.next]);
            const small = 4;
            const sx = PANEL.x + Math.round((PANEL.w - shape.w * small) / 2);
            for (const [dx, dy] of shape.cells) rect(ctx, sx + dx * small, PANEL.y + 13 + dy * small, small - 1, small - 1, KIND_COLORS[f.next]);
            text(ctx, 'LINES', PANEL.x + 5, PANEL.y + 32, ink);
            text(ctx, String(f.lines % 1000).padStart(3, '0'), PANEL.x + 5, PANEL.y + 40, '#ffffff');
            text(ctx, 'LEVEL', PANEL.x + 5, PANEL.y + 54, ink);
            text(ctx, String(f.level % 100).padStart(2, '0'), PANEL.x + 5, PANEL.y + 62, '#ffffff');
            text(ctx, 'SCORE', PANEL.x + 5, PANEL.y + 76, ink);
            text(ctx, String(f.score % 100000).padStart(5, '0'), PANEL.x + 5, PANEL.y + 84, '#ffffff');

            // Well: glow, dark glass, faint grid, frame
            ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 2.4);
            ctx.fillStyle = ink;
            ctx.fillRect(bx - 3, by - 3, cellsW + 6, cellsH + 6);
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(6,2,16,0.72)';
            ctx.fillRect(bx, by, cellsW, cellsH);
            ctx.fillStyle = ink;
            ctx.globalAlpha = 0.07;
            for (let x = 1; x < COLS; x++) ctx.fillRect(bx + x * CELL, by, 1, cellsH);
            for (let y = 1; y < ROWS; y++) ctx.fillRect(bx, by + y * CELL, cellsW, 1);
            ctx.globalAlpha = 1;
            ctx.fillRect(bx - 1, by, 1, cellsH + 1);
            ctx.fillRect(bx + cellsW, by, 1, cellsH + 1);
            ctx.fillRect(bx - 1, by + cellsH, cellsW + 2, 1);

            if (f.ghost) {
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = ink;
                for (const [x, y] of f.ghost) {
                    const cx = bx + x * CELL, cy = by + Math.round(y) * CELL;
                    ctx.fillRect(cx, cy, CELL, 1);
                    ctx.fillRect(cx, cy + CELL - 1, CELL, 1);
                    ctx.fillRect(cx, cy, 1, CELL);
                    ctx.fillRect(cx + CELL - 1, cy, 1, CELL);
                }
                ctx.globalAlpha = 1;
            }
            for (const c of f.cells) {
                ctx.drawImage((c.flash ? flashSprites : sprites)[c.k], bx + c.x * CELL, by + Math.round(c.y * CELL));
            }
            if (f.piece) {
                for (const [x, y] of f.piece.cells) ctx.drawImage(sprites[f.piece.k], bx + x * CELL, by + Math.round(y * CELL));
            }
            for (const s of f.sparks) {
                ctx.globalAlpha = Math.max(0, s.a);
                rect(ctx, bx + Math.round(s.x * CELL), by + Math.round(s.y * CELL), 2, 2, s.a > 0.6 ? '#ffffff' : KIND_COLORS[s.k]);
            }
            ctx.globalAlpha = 1;

            if (f.title > 0) {
                const scale = 2;
                const word = 'TETRIS';
                const tx = bx + Math.round((cellsW - textWidth(word, scale)) / 2);
                const ty = by + 52 - Math.round((1 - f.title) * 6);
                ctx.globalAlpha = f.title;
                ctx.fillStyle = 'rgba(6,2,16,0.75)';
                ctx.fillRect(tx - 4, ty - 4, textWidth(word, scale) + 8, 18);
                text(ctx, word, tx + 1, ty + 1, '#ff2d8a', scale);
                text(ctx, word, tx, ty, Math.floor(t * 12) % 2 ? '#ffffff' : '#ffe066', scale);
                ctx.globalAlpha = 1;
            }
        }

        let lastEventT = null;

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

                drawStacker(ctx, t);
            },
            /** Report the stacker's moves since the last call, so the arcade sounds can follow them. */
            events(t, fire) {
                if (lastEventT !== null && t > lastEventT && t - lastEventT < 1) for (const e of demo.events(lastEventT, t)) fire(e);
                lastEventT = t;
            },
        };
    },
};
