/**
 * city.js - Midnight Circuit: a neon city at night with light streaks racing along an
 * elevated highway (40 Lines). Speed without clutter.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, wrap } from './pixel.js';

const ROAD = 150;

function skyline(ctx, seed, count, minH, maxH, body, windowColors, litChance, winStep) {
    const r = rng(seed);
    const lit = [];
    let x = -4;
    while (x < W) {
        const w = 12 + Math.floor(r() * 22);
        const h = minH + Math.floor(r() * (maxH - minH));
        const top = ROAD - h;
        rect(ctx, x, top, w, h, body);
        if (r() < 0.3) rect(ctx, x + Math.floor(w / 2), top - 6, 1, 6, body);
        for (let wy = top + 3; wy < ROAD - 3; wy += winStep) {
            for (let wx = x + 2; wx < x + w - 2; wx += winStep) {
                if (r() < litChance) {
                    const c = windowColors[Math.floor(r() * windowColors.length)];
                    px(ctx, wx, wy, c);
                    lit.push({ x: wx, y: wy, c, p: r() * 100 });
                }
            }
        }
        x += w + Math.floor(r() * 4);
        if (count-- <= 0) break;
    }
    return lit;
}

export default {
    id: 'city',
    name: 'Midnight Circuit',
    create() {
        const base = layer();
        const b = base.ctx;
        ditherGradient(b, 0, 0, W, ROAD, ['#04030c', '#08071e', '#120c32', '#1f1348', '#3a1a5e', '#5a2266']);
        glow(b, 262, 32, 24, '#2c2466', 0.8);
        disc(b, 262, 32, 13, '#ece8ff');
        disc(b, 266, 29, 11, '#d6d0f4');

        skyline(b, 3, 40, 40, 90, '#141236', ['#2e2d6a', '#3a3a7a'], 0.25, 3);
        const midLit = skyline(b, 9, 30, 25, 70, '#1b1744', ['#ffd27a', '#7ad0ff', '#ff9ad0'], 0.18, 4);
        const signs = [];
        const nr = rng(15);
        let x = 6;
        while (x < W) {
            const w = 16 + Math.floor(nr() * 20);
            const h = 18 + Math.floor(nr() * 40);
            rect(b, x, ROAD - h, w, h, '#0b0920');
            if (nr() < 0.6) signs.push({ x: x + 2 + Math.floor(nr() * (w - 6)), y: ROAD - h + 4, h: 6 + Math.floor(nr() * 10), c: nr() < 0.5 ? '#ff4fa8' : '#4ff0ff', p: nr() * 10 });
            x += w + 6 + Math.floor(nr() * 14);
        }

        // Highway deck and rails
        rect(b, 0, ROAD, W, H - ROAD, '#0e0c1c');
        rect(b, 0, ROAD, W, 2, '#3a3560');
        rect(b, 0, ROAD + 14, W, 1, '#2a2548');
        rect(b, 0, H - 8, W, 8, '#08070f');
        for (let px0 = 10; px0 < W; px0 += 40) rect(b, px0, H - 8, 4, 8, '#1a1830');

        const antennas = [];
        const ar = rng(27);
        for (let i = 0; i < 6; i++) antennas.push({ x: Math.floor(ar() * W), y: 60 + Math.floor(ar() * 40), p: ar() * 6 });

        const r = rng(44);
        const cars = Array.from({ length: 16 }, () => {
            const right = r() < 0.55;
            return {
                right, x: r() * W, speed: (90 + r() * 90) * (right ? 1 : -1),
                y: right ? ROAD + 5 + Math.floor(r() * 3) : ROAD + 10 + Math.floor(r() * 3),
                len: 6 + Math.floor(r() * 10),
            };
        });

        return {
            draw(ctx, t) {
                ctx.drawImage(base.canvas, 0, 0);

                for (const w of midLit) {
                    if (Math.sin(t * 0.3 + w.p) > 0.97) px(ctx, w.x, w.y, '#1b1744');
                }
                for (const a of antennas) {
                    if (Math.sin(t * 3 + a.p) > 0.3) px(ctx, a.x, a.y, '#ff3b3b');
                }
                for (const s of signs) {
                    const on = Math.sin(t * 9 + s.p) > -0.85 || Math.sin(t * 0.7 + s.p) > 0;
                    if (!on) continue;
                    rect(ctx, s.x, s.y, 2, s.h, s.c);
                    ctx.globalAlpha = 0.25;
                    rect(ctx, s.x - 1, s.y - 1, 4, s.h + 2, s.c);
                    ctx.globalAlpha = 1;
                }

                // Lane marks rushing past
                for (let i = 0; i < 12; i++) {
                    const lx = wrap(i * 30 - t * 160, W + 30) - 15;
                    rect(ctx, lx, ROAD + 9, 10, 1, '#4a4478');
                }

                for (const c of cars) {
                    const x = wrap(c.x + t * c.speed, W + 60) - 30;
                    for (let k = 0; k < c.len; k++) {
                        const tx = c.right ? x - k : x + k;
                        ctx.globalAlpha = 1 - k / c.len;
                        px(ctx, tx, c.y, c.right ? '#fff6d8' : '#ff3050');
                    }
                    ctx.globalAlpha = 1;
                    px(ctx, x, c.y - 1, c.right ? '#ffffff' : '#ff6070');
                }
            },
        };
    },
};
