/**
 * bamboo.js - A path through a bamboo forest (Casual). Signature look: rain.
 *
 * The grove opens down the middle: a stone path runs from the foreground to a pale
 * clearing, and every stalk stands clear of it at its own depth. In sun and
 * moonlight, shafts of light fall through the canopy.
 */

import { W, H, rng, layer, rect, px, ditherGradient, hazeBand, glow, wrap } from './pixel.js';

const VANISH = { x: 160, y: 96 };

/** The light at the far end of the path, by variant: [wide glow, bright core]. */
const CLEARING = {
    sunny: ['#fff4c8', '#ffffff'], cloudy: ['#e6ecea', '#f4f8f6'], sunset: ['#ffb070', '#ffd9a0'],
    rain: ['#a8c4b4', '#cfe8d8'], thunder: ['#788890', '#98a8b0'], night: ['#3a5a8a', '#6a8ac0'],
    nightthunder: ['#202a3a', '#303c50'],
};
/** Mist between the trees: [color, alpha, density]. */
const MIST = {
    sunny: ['#f4fff4', 0.12, 0.8], cloudy: ['#dfeee6', 0.28, 0.9], sunset: ['#ffc090', 0.22, 0.9],
    rain: ['#96bea8', 0.38, 1], thunder: ['#788e86', 0.42, 1], night: ['#5a7aa0', 0.28, 0.9],
    nightthunder: ['#3a4a5a', 0.32, 0.9],
};
/** Shafts of light through the canopy: [r, g, b, strength]. */
const BEAMS = { sunny: [255, 244, 190, 0.13], sunset: [255, 190, 120, 0.11], night: [150, 180, 255, 0.06] };

/** Half the width of the path at row y, from a point at the clearing to the full foreground. */
function pathHalf(y) {
    const k = Math.max(0, (y - VANISH.y) / (H - VANISH.y));
    return 4 + k * k * 58 + k * 14;
}

function stalk(ctx, r, x, w, bottom, colors) {
    const top = -2;
    rect(ctx, x, top, w, bottom - top, colors.body);
    if (w >= 3) rect(ctx, x, top, 1, bottom - top, colors.light);
    if (w >= 6) rect(ctx, x + w - 1, top, 1, bottom - top, colors.dark);
    let y = 6 + r() * 14;
    while (y < bottom) {
        rect(ctx, x - 1, y, w + 2, 1, colors.node);
        if (w >= 5) rect(ctx, x, y + 1, w, 1, colors.light);
        y += 14 + r() * 10;
    }
}

function leafCluster(ctx, r, x, y, color, tip, count, scale) {
    for (let i = 0; i < count; i++) {
        const dir = r() < 0.5 ? -1 : 1;
        const len = Math.round((5 + r() * 6) * scale);
        const droop = 0.35 + r() * 0.35;
        const oy = y + r() * 6;
        for (let k = 0; k < len; k++) {
            const lx = x + dir * k;
            const ly = oy + k * droop;
            px(ctx, lx, ly, k === len - 1 ? tip : color);
            if (k > 1 && k < len - 2 && scale > 1) px(ctx, lx, ly + 1, color);
        }
    }
}

/**
 * One depth of the grove. Each stalk stands on the ground between `floor[0]` and
 * `floor[1]`, and is left out if it would stand on the path at that depth.
 */
function forestLayer(env, seed, count, widths, floor, colors, leafColors, leafScale) {
    const { canvas, ctx } = layer();
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
        const x = Math.round((i + r() * 0.8) * (W / count));
        const w = widths[0] + Math.floor(r() * (widths[1] - widths[0] + 1));
        const bottom = Math.round(floor[0] + r() * (floor[1] - floor[0]));
        const leaves = [];
        for (let y = 10 + r() * 30; y < bottom - 24; y += 22 + r() * 30) leaves.push([y, r() < 0.5 ? 0 : w]);
        if (Math.abs(x + w / 2 - VANISH.x) < pathHalf(bottom) + w + 3) continue;
        stalk(ctx, r, x, w, bottom, colors);
        for (const [y, side] of leaves) {
            leafCluster(ctx, r, x + side, y, leafColors[0], leafColors[1], 2 + Math.floor(r() * 3), leafScale);
        }
    }
    return env.grade(canvas);
}

function mistLayer(env, y0, y1, scale) {
    const [color, alpha, density] = MIST[env.id];
    const { canvas, ctx } = layer();
    hazeBand(ctx, y0, y1, color, alpha * scale, density);
    return canvas;
}

/** Stone lantern beside the path. Returns the position of its flame. */
function lantern(ctx, x, base) {
    const stone = '#8a968c', dark = '#4c5850', lit = '#b8c4b8';
    rect(ctx, x - 4, base - 2, 9, 2, dark);
    rect(ctx, x - 1, base - 9, 3, 7, stone);
    px(ctx, x - 1, base - 9, lit);
    rect(ctx, x - 3, base - 11, 7, 2, stone);
    rect(ctx, x - 3, base - 16, 7, 5, dark);
    rect(ctx, x - 5, base - 18, 11, 2, stone);
    rect(ctx, x - 5, base - 18, 11, 1, lit);
    rect(ctx, x - 3, base - 20, 7, 2, stone);
    rect(ctx, x - 1, base - 22, 3, 2, stone);
    return { x, y: base - 14 };
}

export default {
    id: 'bamboo',
    name: 'Bamboo Path',
    signature: 'rain',
    horizon: 160,
    celestial: { sunX: 210, sunHighY: 20, sunLowY: 64, moonX: 210, moonY: 26 },
    fog: [70, 176],
    rainBand: [H - 22, H - 4],
    sounds: { always: {}, day: { birds: 0.5 }, night: { crickets: 0.5, owl: 0.3 } },
    create(env) {
        const sky = env.makeSky();
        const [wide, core] = CLEARING[env.id];
        const sc = sky.canvas.getContext('2d');
        glow(sc, VANISH.x, VANISH.y - 16, 46, wide, 0.5);
        glow(sc, VANISH.x, VANISH.y - 10, 24, core, 0.6);

        // Forest floor and the path, drawn row by row so it narrows toward the clearing
        const floor = layer();
        const f = floor.ctx;
        ditherGradient(f, 0, VANISH.y, W, H - VANISH.y, ['#4f8a5a', '#3d7448', '#2e5a38', '#22452b', '#183520']);
        const path = layer();
        ditherGradient(path.ctx, 0, VANISH.y, W, H - VANISH.y, ['#d0dcc8', '#a8bca4', '#889c84', '#6e8068', '#5a6a52']);
        const fr = rng(5);
        for (let y = VANISH.y; y < H; y++) {
            const half = pathHalf(y);
            const bend = Math.sin((y - VANISH.y) * 0.045) * 5;
            const left = Math.round(VANISH.x + bend - half);
            const width = Math.round(half * 2);
            f.drawImage(path.canvas, left, y, width, 1, left, y, width, 1);
            px(f, left - 1, y, '#2e5a3a');
            px(f, left + width, y, '#2e5a3a');
            // Worn stone: darker joints across the path, wider apart when closer
            const depth = (y - VANISH.y) / (H - VANISH.y);
            if (Math.floor(Math.pow(depth, 0.55) * 22) !== Math.floor(Math.pow((y + 1 - VANISH.y) / (H - VANISH.y), 0.55) * 22)) {
                rect(f, left + 1, y, width - 2, 1, '#6a7c66');
            }
            for (let x = left; x < left + width; x++) if (fr() < 0.05) px(f, x, y, fr() < 0.5 ? '#b0c4ac' : '#5f7060');
        }
        // Leaf litter and grass on both sides
        for (let i = 0; i < 420; i++) {
            const y = VANISH.y + 3 + Math.floor(fr() * (H - VANISH.y - 3));
            const x = Math.floor(fr() * W);
            if (Math.abs(x - VANISH.x) < pathHalf(y) + 6) continue;
            px(f, x, y, fr() < 0.4 ? '#66a05a' : '#265030');
        }
        env.grade(floor.canvas);
        // Puddles on the path, reflecting the sky
        for (const [cx, cy, rx] of [[150, 128, 7], [172, 146, 10], [138, 166, 13], [181, 172, 9]]) {
            for (let dy = -2; dy <= 2; dy++) {
                const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / 6.5));
                rect(f, cx - half, cy + dy, half * 2, 1, dy < 0 ? env.info.sky[4] : env.info.sky[3]);
            }
        }

        const far = forestLayer(env, 11, 30, [2, 2], [VANISH.y + 1, VANISH.y + 10],
            { body: '#6d9f78', light: '#84b590', dark: '#5d8a68', node: '#547c5f' }, ['#78ab82', '#98c79a'], 1);
        const mistFar = mistLayer(env, 60, 170, 1);
        const mid = forestLayer(env, 23, 18, [3, 4], [VANISH.y + 14, VANISH.y + 44],
            { body: '#3d7a44', light: '#5f9c5a', dark: '#2f6238', node: '#295530' }, ['#4f9450', '#7cc068'], 1.5);
        const mistNear = mistLayer(env, 120, 200, 0.8);
        const near = forestLayer(env, 37, 7, [7, 9], [H + 4, H + 4],
            { body: '#1f4a2a', light: '#34703a', dark: '#173820', node: '#132d19' }, ['#256335', '#3f8a48'], 2.2);

        const front = layer();
        const light = lantern(front.ctx, 108, 158);
        const gr = rng(6);
        for (let x = 0; x < W; x += 2) {
            if (Math.abs(x - VANISH.x) < pathHalf(H) - 6) continue;
            const h = 2 + Math.floor(gr() * 6);
            rect(front.ctx, x, H - h, 1, h, gr() < 0.5 ? '#2a5a30' : '#357040');
        }
        env.grade(front.canvas);

        const r = rng(99);
        const leaves = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H, speed: 6 + r() * 6, phase: r() * 6 }));
        const beamSpec = BEAMS[env.id];
        const beams = beamSpec ? Array.from({ length: 6 }, (_, i) => ({ x: 90 + i * 32 + r() * 14, w: 8 + r() * 8, ph: r() * 6 })) : [];
        const flies = Array.from({ length: 12 }, () => ({ x: 90 + r() * 140, y: 110 + r() * 60, p: r() * 10 }));
        const leafA = env.c('#7fb068');
        const leafB = env.c('#5e9150');
        const ring = env.rgba('#e1f5f0', 0.8);
        const ringOld = env.rgba('#c8e6e1', 0.4);
        const wind = 0.4 + env.wind;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(floor.canvas, 0, 0);
                ctx.drawImage(far, 0, 0);
                ctx.drawImage(mistFar, Math.round(Math.sin(t * 0.05) * 6), 0);
                ctx.drawImage(mid, 0, 0);

                // Rings where rain lands on the path and its puddles
                if (env.rain > 0) {
                    const slot = Math.floor(t * 6);
                    for (let i = 0; i < 16; i++) {
                        const sr = rng(slot - (i % 3) + i * 131);
                        const y = VANISH.y + 8 + Math.floor(sr() * (H - VANISH.y - 8));
                        const x = Math.round(VANISH.x + (sr() - 0.5) * 2 * (pathHalf(y) - 3));
                        const age = i % 3;
                        ctx.fillStyle = age === 0 ? ring : ringOld;
                        if (age === 0) ctx.fillRect(x, y - 1, 1, 1);
                        ctx.fillRect(x - 1 - age, y, 1, 1);
                        ctx.fillRect(x + 1 + age, y, 1, 1);
                    }
                }

                for (const l of leaves) {
                    const y = wrap(l.y + t * l.speed * wind, H + 10) - 5;
                    const x = wrap(l.x + Math.sin(t * 0.8 + l.phase) * 10 - t * 2 * wind, W);
                    ctx.fillStyle = leafA;
                    ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
                    ctx.fillStyle = leafB;
                    ctx.fillRect(Math.round(x + (Math.sin(t * 3 + l.phase) > 0 ? 2 : -1)), Math.round(y + 1), 1, 1);
                }

                ctx.drawImage(mistNear, Math.round(Math.sin(t * 0.08 + 1) * 10), 0);

                if (beamSpec) {
                    const [br, bg, bb, strength] = beamSpec;
                    ctx.globalCompositeOperation = 'lighter';
                    for (const b of beams) {
                        const x0 = b.x + Math.sin(t * 0.15 + b.ph) * 6;
                        const pulse = 0.65 + 0.35 * Math.sin(t * 0.4 + b.ph * 2);
                        for (let band = 0; band < 6; band++) {
                            ctx.fillStyle = `rgba(${br},${bg},${bb},${(strength * pulse * (1 - band * 0.13)).toFixed(3)})`;
                            for (let y = band * 30; y < band * 30 + 30; y++) ctx.fillRect(Math.round(x0 + y * 0.4), y, Math.round(b.w), 1);
                        }
                    }
                    ctx.globalCompositeOperation = 'source-over';
                }

                ctx.drawImage(front.canvas, 0, 0);
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    const flick = Math.sin(t * 9) * Math.sin(t * 5.3) > 0.2;
                    rect(ctx, light.x - 2, light.y - 1, 5, 3, flick ? '#ffd27a' : '#f4b85a');
                    px(ctx, light.x, light.y, '#fff2c0');
                    glow(ctx, light.x, light.y, 14, '#ffb84a', 0.5);
                    ctx.globalAlpha = 1;
                }
                if (env.night && env.rain === 0) {
                    for (const fl of flies) {
                        const on = Math.sin(t * 2.2 + fl.p);
                        if (on < 0.1) continue;
                        ctx.fillStyle = on > 0.7 ? '#eaff9a' : '#a8d85a';
                        ctx.fillRect(Math.round(fl.x + Math.sin(t * 0.6 + fl.p) * 14), Math.round(fl.y + Math.sin(t * 1.3 + fl.p * 2) * 5), 1, 1);
                    }
                }
                ctx.drawImage(near, 0, 0);
            },
        };
    },
};
