/**
 * wheat.js - Wheat field swaying in the wind, with a windmill and a scarecrow (Casual).
 * Signature look: sunset.
 *
 * Every stalk is a sprite: a bent stem and an ear built from staggered kernels
 * with awns (the bristles). Each size is drawn once at several lean angles, and
 * the wind picks a lean per stalk every frame.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, ridge, wrap } from './pixel.js';

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
 * One upright stalk, drawn once per size: a stem, leaves and an ear of staggered
 * kernels. Returns its pixels and the stem's x.
 */
function stalkGrid(size) {
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
    return { data: g.getImageData(0, 0, w, h).data, w, h };
}

/**
 * The stalk at a given lean (-LEANS to LEANS): each row is shifted sideways by a
 * curve, so the heavy head bends the most. Works on pixels in memory, then grades
 * them, because a scene draws this once for every lean of every size.
 */
function leanedStalk(env, grid, size, lean) {
    const { data, w, h } = grid;
    const out = layer(w, h);
    const img = out.ctx.createImageData(w, h);
    const amount = (lean / LEANS) * size.bend;
    for (let y = 0; y < h; y++) {
        const up = (h - y) / h;
        const shift = Math.round(amount * up * up);
        for (let x = 0; x < w; x++) {
            const nx = x + shift;
            if (nx < 0 || nx >= w) continue;
            const from = (y * w + x) * 4;
            const to = (y * w + nx) * 4;
            img.data[to] = data[from]; img.data[to + 1] = data[from + 1];
            img.data[to + 2] = data[from + 2]; img.data[to + 3] = data[from + 3];
        }
    }
    env.gradeData(img.data);
    out.ctx.putImageData(img, 0, 0);
    return out.canvas;
}

function windmill(ctx, x, y) {
    const wall = '#8a7a68', dark = '#5e5044';
    for (let i = 0; i < 12; i++) {
        const half = 2 + Math.floor(i / 4);
        rect(ctx, x - half, y - 12 + i, half * 2, 1, i % 4 === 0 ? dark : wall);
    }
    rect(ctx, x - 3, y - 15, 6, 3, dark);
    rect(ctx, x - 2, y - 17, 4, 2, '#7a3a34');
    rect(ctx, x - 1, y - 7, 3, 5, '#3a2c22');
}

function scarecrow(ctx, x, base) {
    const wood = '#6b4a2a', shirt = '#8a4a3a', shirtDark = '#6a3428', hat = '#c9a04a', straw = '#f0d078';
    rect(ctx, x, base - 24, 2, 24, wood);
    rect(ctx, x - 9, base - 19, 20, 2, wood);
    rect(ctx, x - 3, base - 20, 8, 10, shirt);
    rect(ctx, x + 3, base - 20, 2, 10, shirtDark);
    rect(ctx, x - 1, base - 16, 3, 3, '#4a6a8a');
    rect(ctx, x - 2, base - 26, 6, 5, '#d8c090');
    px(ctx, x - 1, base - 25, '#3a2a1a');
    px(ctx, x + 2, base - 25, '#3a2a1a');
    rect(ctx, x - 4, base - 28, 10, 2, hat);
    rect(ctx, x - 2, base - 31, 6, 3, hat);
    for (const ax of [x - 11, x + 11]) rect(ctx, ax, base - 20, 2, 3, straw);
    for (let k = 0; k < 5; k++) px(ctx, x - 3 + k * 2, base - 10 + (k % 2), straw);
}

export default {
    id: 'wheat',
    name: 'Golden Field',
    signature: 'sunset',
    horizon: HORIZON,
    celestial: { sunX: 232, sunHighY: 30, sunLowY: 96, moonX: 90, moonY: 32 },
    fog: [HORIZON - 6, HORIZON + 34],
    rainBand: [HORIZON + 30, H - 2],
    sounds: { always: { wheat: 1, wind: 0.3 }, day: { birds: 0.5 }, night: { crickets: 0.8 } },
    create(env) {
        const sky = env.makeSky();

        const hills = layer();
        ridge(hills.ctx, HORIZON - 4, 6, '#7ea18c', 3, { freq: 0.018 });
        ridge(hills.ctx, HORIZON + 1, 3, '#5f8c6c', 8, { freq: 0.03 });
        const tr = rng(12);
        for (let i = 0; i < 12; i++) {
            const x = tr() * W;
            const y = HORIZON - 1 + tr() * 2;
            disc(hills.ctx, x, y - 3, 2, '#3f6a48');
            rect(hills.ctx, x, y - 1, 1, 2, '#3f6a48');
        }
        const MILL = { x: 58, y: HORIZON - 2 };
        windmill(hills.ctx, MILL.x, MILL.y);
        env.grade(hills.canvas);

        // The field itself: far wheat is only texture, short strokes that get longer nearer
        const field = layer();
        ditherGradient(field.ctx, 0, HORIZON + 1, W, H - HORIZON - 1, ['#d9a04a', '#dfab4c', '#c98a3c', '#9c672c', '#62401f']);
        const fr = rng(44);
        for (let y = HORIZON + 2; y < HORIZON + 26; y++) {
            const depth = (y - HORIZON) / 26;
            for (let x = 0; x < W; x++) {
                const v = fr();
                if (v < 0.22) px(field.ctx, x, y, '#f2cb70');
                else if (v < 0.4) rect(field.ctx, x, y, 1, 1 + Math.round(depth * 2), '#a8722e');
            }
        }
        env.grade(field.canvas);

        const sprites = SIZES.map(size => {
            const grid = stalkGrid(size);
            const byLean = [];
            for (let lean = -LEANS; lean <= LEANS; lean++) byLean.push(leanedStalk(env, grid, size, lean));
            return byLean;
        });
        const spriteOx = SIZES.map(size => size.bend + size.awn + size.kw + 2);

        const crow = layer(40, 40);
        scarecrow(crow.ctx, 20, 38);
        env.grade(crow.canvas);
        const CROW = { x: 244, base: HORIZON + 58 };

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
        const flies = Array.from({ length: 16 }, () => ({ x: sr() * W, y: HORIZON + 24 + sr() * 60, p: sr() * 10 }));
        const ripples = Array.from({ length: 40 }, () => ({ x: sr() * W, y: HORIZON + 3 + Math.floor(sr() * 20), len: 3 + sr() * 8, p: sr() * 6 }));

        const bird = env.c('#2a2030');
        const streak = env.c('#f6d684');
        const mote = env.c('#fff1b8');
        const beam = env.c('#4a3a30');
        const cloth = env.c('#e8dcc0');
        const windScale = 0.45 + env.wind * 0.75;
        const showBirds = !env.night && env.rain === 0;
        const fast = 1.2 + env.wind;
        const sailSpeed = 0.3 + env.wind * 0.9;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(hills.canvas, 0, 0);

                for (let k = 0; k < 4; k++) {
                    const a = t * sailSpeed + (k * Math.PI) / 2;
                    for (let d = 1; d <= 9; d++) {
                        const sx = MILL.x + Math.cos(a) * d;
                        const sy = MILL.y - 16 + Math.sin(a) * d;
                        px(ctx, sx, sy, beam);
                        if (d > 3) px(ctx, sx - Math.sin(a), sy + Math.cos(a), cloth);
                    }
                }
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    rect(ctx, MILL.x - 1, MILL.y - 11, 2, 2, '#ffcf6b');
                    ctx.globalAlpha = 1;
                }

                if (showBirds) {
                    ctx.fillStyle = bird;
                    for (const b of birds) {
                        const x = Math.round(wrap(b.x - t * b.speed, W + 20) - 10);
                        const y = Math.round(b.y + Math.sin(t * 0.7 + b.phase) * 3);
                        const up = Math.floor(t * 5 + b.phase) % 2 === 0 ? -1 : 1;
                        ctx.fillRect(x, y, 1, 1);
                        for (const dx of [-2, -1, 1, 2]) ctx.fillRect(x + dx, y + up, 1, 1);
                    }
                }

                ctx.drawImage(field.canvas, 0, 0);

                // Wind running over the far field as moving bright streaks
                ctx.fillStyle = streak;
                for (const r of ripples) {
                    const x = wrap(r.x + t * 14 * fast, W + 20) - 10;
                    if (Math.sin(t * 0.9 + r.p) > 0.1) ctx.fillRect(Math.round(x), r.y, Math.round(r.len), 1);
                }

                const gust = 0.55 + 0.45 * Math.sin(t * 0.35);
                rows.forEach((row, index) => {
                    if (index === 6) ctx.drawImage(crow.canvas, CROW.x - 20, CROW.base - 38);
                    const set = sprites[row.size];
                    for (const s of row.stalks) {
                        const wave = Math.sin(t * fast * 1.25 - s.x * 0.035 + row.offset + s.phase);
                        const lean = Math.round((0.35 + wave * 0.65) * gust * windScale * LEANS);
                        const sprite = set[Math.max(-LEANS, Math.min(LEANS, lean)) + LEANS];
                        ctx.drawImage(sprite, s.x - spriteOx[row.size], row.y + s.dy - sprite.height);
                    }
                });

                if (env.rain === 0 && !env.night) {
                    ctx.fillStyle = mote;
                    for (const m of motes) {
                        const y = wrap(m.y - t * m.s, 70) + HORIZON - 10;
                        const x = wrap(m.x + Math.sin(t + m.p) * 6 + t * 3, W);
                        if (Math.sin(t * 2 + m.p) > -0.2) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
                    }
                }
                if (env.night && env.rain === 0) {
                    for (const f of flies) {
                        const on = Math.sin(t * 2.2 + f.p);
                        if (on < 0.1) continue;
                        const x = f.x + Math.sin(t * 0.6 + f.p) * 18;
                        const y = f.y + Math.sin(t * 1.3 + f.p * 2) * 5;
                        ctx.fillStyle = on > 0.7 ? '#eaff9a' : '#a8d85a';
                        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
                    }
                }
            },
        };
    },
};
