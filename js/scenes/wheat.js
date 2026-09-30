/**
 * wheat.js - Wheat field at golden hour, swaying in the wind (Casual).
 *
 * Every stalk is a sprite: a bent stem and an ear built from staggered kernels
 * with awns (the bristles). Each size is drawn once at several lean angles, and
 * the wind picks a lean per stalk every frame.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, ridge, cloud, wrap } from './pixel.js';

const HORIZON = 112;
const LEANS = 4;

const FAR = { kernel: '#d39a44', light: '#e8b85e', shade: '#ad7834', awn: '#e2b563', stem: '#a8793a' };
const MID = { kernel: '#c98d3a', light: '#e6b65a', shade: '#93622a', awn: '#d9a851', stem: '#8f6a2c' };
const NEAR = { kernel: '#e9b44c', light: '#ffe9a0', shade: '#a36a26', awn: '#f3d384', stem: '#b98a36', leaf: '#9c8a34' };

/**
 * Stalk sizes, far to near. kw and kh are the kernel size, pairs the number of
 * kernel pairs in the ear, awn the bristle length.
 */
const SIZES = [
    { kw: 1, kh: 1, pairs: 3, awn: 1, stem: 6, colors: FAR, bend: 2 },
    { kw: 1, kh: 2, pairs: 3, awn: 2, stem: 11, colors: FAR, bend: 3 },
    { kw: 2, kh: 2, pairs: 4, awn: 3, stem: 18, colors: MID, bend: 5 },
    { kw: 2, kh: 3, pairs: 6, awn: 5, stem: 27, colors: NEAR, bend: 8, leaves: true },
];

/**
 * One stalk at a given lean (-LEANS to LEANS). The ear is drawn upright on a grid,
 * then each row is shifted sideways by a curve, so the heavy head bends the most.
 * @returns {{ canvas: HTMLCanvasElement, ox: number }} ox is the stem's x in the sprite
 */
function stalkSprite(size, lean) {
    const { kw, kh, pairs, awn, stem, colors, bend } = size;
    const earH = pairs * kh + kh + Math.ceil(kh / 2);
    const h = awn + earH + stem;
    const pad = bend + awn + kw + 2;
    const w = pad * 2 + 1;
    const grid = layer(w, h);
    const g = grid.ctx;
    const cx = pad;
    const earTop = awn;

    rect(g, cx, earTop + kh, 1, h - earTop - kh, colors.stem);
    if (size.leaves) {
        for (const [dir, from, len] of [[-1, 0.45, 9], [1, 0.62, 7]]) {
            const ly = Math.round(earTop + earH + stem * from);
            for (let k = 1; k <= len; k++) {
                const droop = Math.round(((k - len * 0.45) ** 2) * 0.09 - 2);
                px(g, cx + dir * k, ly + droop, k > len - 2 ? colors.shade : colors.leaf);
            }
        }
    }

    const kernel = (x, y, side, bristle) => {
        rect(g, x, y, kw, kh, colors.kernel);
        px(g, side < 0 ? x : x + kw - 1, y, colors.light);
        if (kh > 1) rect(g, x, y + kh - 1, kw, 1, colors.shade);
        if (!bristle) return;
        const tipX = side < 0 ? x : x + kw - 1;
        for (let j = 1; j <= awn; j++) px(g, tipX + side * Math.round(j * 0.45), y - j, colors.awn);
    };
    // Tip kernel, then pairs staggered left and right down the ear. Only the top
    // kernels carry awns, so the ear stays readable.
    rect(g, cx, earTop, 1, kh, colors.light);
    for (let j = 1; j <= awn; j++) px(g, cx, earTop - j, colors.awn);
    for (let i = 0; i < pairs; i++) {
        const y = earTop + kh + i * kh;
        kernel(cx - kw, y, -1, i < 2);
        kernel(cx + 1, y + Math.ceil(kh / 2), 1, i < 2);
    }

    const out = layer(w, h);
    const amount = (lean / LEANS) * bend;
    for (let y = 0; y < h; y++) {
        const up = (h - y) / h;
        out.ctx.drawImage(grid.canvas, 0, y, w, 1, Math.round(amount * up * up), y, w, 1);
    }
    return { canvas: out.canvas, ox: cx };
}

function windmill(ctx, x, y) {
    for (let i = 0; i < 11; i++) rect(ctx, x - 2 - Math.floor(i / 5), y - 11 + i, 5 + Math.floor(i / 5) * 2, 1, '#4a2440');
    rect(ctx, x - 1, y - 13, 3, 2, '#4a2440');
    px(ctx, x, y - 5, '#f7c374');
}

export default {
    id: 'wheat',
    name: 'Golden Field',
    ambience: { wheat: 1, wind: 0.35, birds: 0.5 },
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, HORIZON + 4, ['#2a1b40', '#4e2a5a', '#8c3b5f', '#cc5d5b', '#ec935d', '#f7c374']);
        glow(sky.ctx, 232, 96, 34, '#fbd98f', 0.55);
        disc(sky.ctx, 232, 96, 15, '#ffe9ad');
        disc(sky.ctx, 232, 96, 12, '#fff3cc');

        const clouds = layer(W * 2, 90);
        const cr = rng(7);
        for (let i = 0; i < 9; i++) {
            cloud(clouds.ctx, cr() * W * 2, 18 + cr() * 50, 6 + cr() * 7, '#f8bf9c', '#c97c80', 100 + i);
        }

        const hills = layer();
        ridge(hills.ctx, HORIZON - 4, 6, '#7a3c5a', 3, { freq: 0.018 });
        ridge(hills.ctx, HORIZON + 1, 3, '#5a2e4c', 8, { freq: 0.03 });
        const tr = rng(12);
        for (let i = 0; i < 12; i++) {
            const x = tr() * W;
            const y = HORIZON - 1 + tr() * 2;
            disc(hills.ctx, x, y - 3, 2, '#4a2440');
            rect(hills.ctx, x, y - 1, 1, 2, '#4a2440');
        }
        const MILL = { x: 58, y: HORIZON - 2 };
        windmill(hills.ctx, MILL.x, MILL.y);

        // The field itself: far wheat is only texture, short strokes that get longer nearer
        const field = layer();
        ditherGradient(field.ctx, 0, HORIZON + 1, W, H - HORIZON - 1, ['#c98a3e', '#d39a40', '#b87c34', '#8a5a28', '#5e3a20']);
        const fr = rng(44);
        for (let y = HORIZON + 2; y < HORIZON + 26; y++) {
            const depth = (y - HORIZON) / 26;
            for (let x = 0; x < W; x++) {
                const v = fr();
                if (v < 0.22) px(field.ctx, x, y, '#f0c46c');
                else if (v < 0.4) rect(field.ctx, x, y, 1, 1 + Math.round(depth * 2), '#a8722e');
            }
        }

        const sprites = SIZES.map(size => {
            const byLean = [];
            for (let lean = -LEANS; lean <= LEANS; lean++) byLean.push(stalkSprite(size, lean));
            return byLean;
        });

        // Rows of stalks, far to near. Closer rows sit lower, are larger and sway more.
        const sr = rng(31);
        const rows = [
            { size: 0, y: HORIZON + 22, gap: 3 }, { size: 0, y: HORIZON + 27, gap: 3 },
            { size: 1, y: HORIZON + 35, gap: 4 }, { size: 1, y: HORIZON + 42, gap: 5 },
            { size: 2, y: HORIZON + 54, gap: 7 }, { size: 2, y: HORIZON + 64, gap: 8 },
            { size: 3, y: H + 8, gap: 15 }, { size: 3, y: H + 18, gap: 13 },
        ].map((row, i) => {
            const stalks = [];
            for (let x = -4; x < W + 4; x += row.gap) {
                stalks.push({ x: Math.round(x + sr() * row.gap), dy: Math.round(sr() * (2 + row.size * 2)), phase: sr() * 1.2 });
            }
            return { ...row, stalks, offset: i * 1.3 };
        });

        const birds = Array.from({ length: 4 }, (_, i) => ({ x: sr() * W, y: 26 + sr() * 40, speed: 9 + sr() * 6, phase: i }));
        const motes = Array.from({ length: 24 }, () => ({ x: sr() * W, y: HORIZON + sr() * 60, s: 2 + sr() * 3, p: sr() * 6 }));
        const ripples = Array.from({ length: 40 }, () => ({ x: sr() * W, y: HORIZON + 3 + Math.floor(sr() * 20), len: 3 + sr() * 8, p: sr() * 6 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                ctx.drawImage(clouds.canvas, -Math.round(wrap(t * 2, W * 2)), 0);
                ctx.drawImage(clouds.canvas, W * 2 - Math.round(wrap(t * 2, W * 2)), 0);
                ctx.drawImage(hills.canvas, 0, 0);

                // Windmill sails
                for (let k = 0; k < 4; k++) {
                    const a = t * 0.6 + (k * Math.PI) / 2;
                    for (let d = 1; d <= 8; d++) px(ctx, MILL.x + Math.cos(a) * d, MILL.y - 12 + Math.sin(a) * d, '#3a1c38');
                }

                for (const b of birds) {
                    const x = wrap(b.x - t * b.speed, W + 20) - 10;
                    const y = Math.round(b.y + Math.sin(t * 0.7 + b.phase) * 3);
                    const up = Math.floor(t * 5 + b.phase) % 2 === 0;
                    px(ctx, x, y, '#3a1c38');
                    px(ctx, x - 1, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x + 1, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x - 2, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x + 2, y + (up ? -1 : 1), '#3a1c38');
                }

                ctx.drawImage(field.canvas, 0, 0);

                // Wind running over the far field as moving bright streaks
                for (const r of ripples) {
                    const x = wrap(r.x + t * 14, W + 20) - 10;
                    if (Math.sin(t * 0.9 + r.p) > 0.1) rect(ctx, x, r.y, r.len, 1, '#f6d684');
                }

                const gust = 0.55 + 0.45 * Math.sin(t * 0.35);
                for (const row of rows) {
                    const set = sprites[row.size];
                    for (const s of row.stalks) {
                        const wave = Math.sin(t * 1.5 - s.x * 0.035 + row.offset + s.phase);
                        const lean = Math.round((0.35 + wave * 0.65) * gust * LEANS);
                        const sprite = set[Math.max(-LEANS, Math.min(LEANS, lean)) + LEANS];
                        ctx.drawImage(sprite.canvas, s.x - sprite.ox, row.y + s.dy - sprite.canvas.height);
                    }
                }

                for (const m of motes) {
                    const y = wrap(m.y - t * m.s, 70) + HORIZON - 10;
                    const x = wrap(m.x + Math.sin(t + m.p) * 6 + t * 3, W);
                    if (Math.sin(t * 2 + m.p) > -0.2) px(ctx, x, y, '#fff1b8');
                }
            },
        };
    },
};
