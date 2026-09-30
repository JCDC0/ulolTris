/**
 * bamboo.js - A path through a misty bamboo forest in the rain (Casual).
 *
 * The grove opens down the middle: a wet stone path runs from the foreground to a
 * pale clearing, and every stalk stands clear of it at its own depth.
 */

import { W, H, rng, layer, rect, px, ditherGradient, hazeBand, glow, wrap } from './pixel.js';

const VANISH = { x: 160, y: 96 };

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
function forestLayer(seed, count, widths, floor, colors, leafColors, leafScale) {
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
    return canvas;
}

function mistLayer(y0, y1, color, alpha, density) {
    const { canvas, ctx } = layer();
    hazeBand(ctx, y0, y1, color, alpha, density);
    return canvas;
}

/** Stone lantern beside the path. Returns the position of its light. */
function lantern(ctx, x, base) {
    const stone = '#4e5a52', dark = '#2c3630', lit = '#7c8a7c';
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
    ambience: { rain: 1, wind: 0.2, birds: 0.15 },
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, H, ['#132226', '#1b302f', '#26413a', '#355848', '#4a7058']);
        // Pale light where the path leaves the grove
        glow(sky.ctx, VANISH.x, VANISH.y - 16, 46, '#8fc0a0', 0.5);
        glow(sky.ctx, VANISH.x, VANISH.y - 10, 24, '#cfe8d2', 0.6);

        // Forest floor and the path, drawn row by row so it narrows toward the clearing
        const floor = layer();
        const f = floor.ctx;
        ditherGradient(f, 0, VANISH.y, W, H - VANISH.y, ['#3a5f4b', '#2c4a39', '#1d3327', '#13231a', '#0c170f']);
        const path = layer();
        ditherGradient(path.ctx, 0, VANISH.y, W, H - VANISH.y, ['#b9d2b6', '#8da78c', '#6b806a', '#55634f', '#454f3e']);
        const fr = rng(5);
        for (let y = VANISH.y; y < H; y++) {
            const half = pathHalf(y);
            const bend = Math.sin((y - VANISH.y) * 0.045) * 5;
            const left = Math.round(VANISH.x + bend - half);
            const width = Math.round(half * 2);
            f.drawImage(path.canvas, left, y, width, 1, left, y, width, 1);
            px(f, left - 1, y, '#22382a');
            px(f, left + width, y, '#22382a');
            // Worn stone: darker joints across the path, wider apart when closer
            const depth = (y - VANISH.y) / (H - VANISH.y);
            if (Math.floor(Math.pow(depth, 0.55) * 22) !== Math.floor(Math.pow((y + 1 - VANISH.y) / (H - VANISH.y), 0.55) * 22)) {
                rect(f, left + 1, y, width - 2, 1, '#4a5a47');
            }
            for (let x = left; x < left + width; x++) if (fr() < 0.05) px(f, x, y, fr() < 0.5 ? '#7d957c' : '#435040');
        }
        // Leaf litter and grass on both sides
        for (let i = 0; i < 420; i++) {
            const y = VANISH.y + 3 + Math.floor(fr() * (H - VANISH.y - 3));
            const x = Math.floor(fr() * W);
            if (Math.abs(x - VANISH.x) < pathHalf(y) + 6) continue;
            px(f, x, y, fr() < 0.4 ? '#4f7a4e' : '#1a2f20');
        }
        // Puddles on the path, reflecting the pale sky
        const puddles = [[150, 128, 7], [172, 146, 10], [138, 166, 13], [181, 172, 9]];
        for (const [cx, cy, rx] of puddles) {
            for (let dy = -2; dy <= 2; dy++) {
                const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / 6.5));
                rect(f, cx - half, cy + dy, half * 2, 1, dy < 0 ? '#a9c9b4' : '#7ea58f');
            }
        }

        const far = forestLayer(11, 30, [2, 2], [VANISH.y + 1, VANISH.y + 10],
            { body: '#557d63', light: '#63907a', dark: '#4a6f57', node: '#46694f' }, ['#5f8a6c', '#79a283'], 1);
        const mistFar = mistLayer(60, 170, '#96bea8', 0.35, 1);
        const mid = forestLayer(23, 18, [3, 4], [VANISH.y + 14, VANISH.y + 44],
            { body: '#2f5a37', light: '#4b7f4d', dark: '#244a2b', node: '#1f3f25' }, ['#3d7440', '#63a058'], 1.5);
        const mistNear = mistLayer(120, 200, '#78a08c', 0.28, 0.9);
        const near = forestLayer(37, 7, [7, 9], [H + 4, H + 4],
            { body: '#14291a', light: '#23422a', dark: '#0d1d11', node: '#0a170d' }, ['#18351e', '#2a5230'], 2.2);

        const front = layer();
        const light = lantern(front.ctx, 108, 158);
        const gr = rng(6);
        for (let x = 0; x < W; x += 2) {
            if (Math.abs(x - VANISH.x) < pathHalf(H) - 6) continue;
            const h = 2 + Math.floor(gr() * 6);
            rect(front.ctx, x, H - h, 1, h, gr() < 0.5 ? '#16301c' : '#1f3d24');
        }

        const r = rng(99);
        const drops = Array.from({ length: 190 }, () => ({
            x: r() * (W + 60), y: r() * H, speed: 110 + r() * 70, len: 3 + Math.floor(r() * 4),
            color: r() < 0.3 ? 'rgba(220, 240, 245, 0.55)' : 'rgba(170, 210, 220, 0.35)',
        }));
        const leaves = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H, speed: 6 + r() * 6, phase: r() * 6 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                ctx.drawImage(floor.canvas, 0, 0);
                ctx.drawImage(far, 0, 0);
                ctx.drawImage(mistFar, Math.round(Math.sin(t * 0.05) * 6), 0);
                ctx.drawImage(mid, 0, 0);

                // Rings where rain lands on the path and its puddles
                const slot = Math.floor(t * 6);
                for (let i = 0; i < 16; i++) {
                    const sr = rng(slot - (i % 3) + i * 131);
                    const y = VANISH.y + 8 + Math.floor(sr() * (H - VANISH.y - 8));
                    const x = Math.round(VANISH.x + (sr() - 0.5) * 2 * (pathHalf(y) - 3));
                    const age = i % 3;
                    const color = age === 0 ? 'rgba(225, 245, 240, 0.8)' : 'rgba(200, 230, 225, 0.4)';
                    if (age === 0) px(ctx, x, y - 1, color);
                    rect(ctx, x - 1 - age, y, 1, 1, color);
                    rect(ctx, x + 1 + age, y, 1, 1, color);
                }

                for (const l of leaves) {
                    const y = wrap(l.y + t * l.speed, H + 10) - 5;
                    const x = wrap(l.x + Math.sin(t * 0.8 + l.phase) * 10 - t * 2, W);
                    rect(ctx, x, y, 2, 1, '#7fb068');
                    px(ctx, x + (Math.sin(t * 3 + l.phase) > 0 ? 2 : -1), y + 1, '#5e9150');
                }

                ctx.drawImage(mistNear, Math.round(Math.sin(t * 0.08 + 1) * 10), 0);
                ctx.drawImage(front.canvas, 0, 0);
                const flick = Math.sin(t * 9) * Math.sin(t * 5.3) > 0.2;
                rect(ctx, light.x - 2, light.y - 1, 5, 3, flick ? '#ffd27a' : '#f4b85a');
                px(ctx, light.x, light.y, '#fff2c0');
                ctx.drawImage(near, 0, 0);

                for (const d of drops) {
                    const y = wrap(d.y + t * d.speed, H + 10) - 5;
                    const x = wrap(d.x - y * 0.25 - t * 4, W + 60) - 30;
                    ctx.fillStyle = d.color;
                    for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x + k * 0.25), Math.round(y - k), 1, 1);
                }
            },
        };
    },
};
