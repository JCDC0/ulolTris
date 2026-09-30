/**
 * city.js - Midnight Circuit: a city skyline over an elevated highway (40 Lines).
 * Signature look: night, with lit windows, neon signs and light streaks racing along
 * the road. By day the windows are glass and the cars are colored bodies. Speed
 * without clutter.
 */

import { W, H, rng, layer, rect, px, wrap } from './pixel.js';

const ROAD = 150;
const CAR_COLORS = ['#d94a4a', '#4a7ad9', '#e8c84a', '#f0f0f0', '#3a3a48', '#4ab86a', '#e88a3a'];

/**
 * One row of towers. Draws the bodies and the glass windows, and returns the windows
 * that light up at night (the rest stay dark).
 */
function skyline(ctx, seed, count, minH, maxH, body, glass, litColors, litChance, winStep) {
    const r = rng(seed);
    const lit = [];
    let x = -4;
    while (x < W) {
        const w = 12 + Math.floor(r() * 22);
        const h = minH + Math.floor(r() * (maxH - minH));
        const top = ROAD - h;
        rect(ctx, x, top, w, h, body);
        rect(ctx, x, top, 1, h, glass);
        if (r() < 0.3) rect(ctx, x + Math.floor(w / 2), top - 6, 1, 6, body);
        for (let wy = top + 3; wy < ROAD - 3; wy += winStep) {
            for (let wx = x + 2; wx < x + w - 2; wx += winStep) {
                px(ctx, wx, wy, glass);
                if (r() < litChance) lit.push({ x: wx, y: wy, c: litColors[Math.floor(r() * litColors.length)], p: r() * 100 });
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
    signature: 'night',
    horizon: ROAD,
    celestial: { sunX: 262, sunHighY: 32, sunLowY: 70, moonX: 262, moonY: 32 },
    fog: [ROAD - 60, ROAD + 12],
    rainBand: [ROAD + 3, ROAD + 16],
    sounds: { always: { city: 1, traffic: 1, hum: 0.25 }, day: {}, night: {} },
    create(env) {
        const sky = env.makeSky();

        const base = layer();
        const b = base.ctx;
        const farLit = skyline(b, 3, 40, 40, 90, '#7f92b4', '#a9c0dc', ['#5a5aa8', '#6a6ab8'], 0.25, 3);
        const midLit = skyline(b, 9, 30, 25, 70, '#5f7398', '#8fb0d4', ['#ffd27a', '#7ad0ff', '#ff9ad0'], 0.18, 4);
        const signs = [];
        const nr = rng(15);
        let x = 6;
        while (x < W) {
            const w = 16 + Math.floor(nr() * 20);
            const h = 18 + Math.floor(nr() * 40);
            rect(b, x, ROAD - h, w, h, '#3c4866');
            rect(b, x, ROAD - h, 1, h, '#5a6a8a');
            if (nr() < 0.6) signs.push({ x: x + 2 + Math.floor(nr() * (w - 6)), y: ROAD - h + 4, h: 6 + Math.floor(nr() * 10), c: nr() < 0.5 ? '#ff4fa8' : '#4ff0ff', p: nr() * 10 });
            x += w + 6 + Math.floor(nr() * 14);
        }

        // Highway deck and rails
        rect(b, 0, ROAD, W, H - ROAD, '#4a4c62');
        rect(b, 0, ROAD, W, 2, '#9a9cc0');
        rect(b, 0, ROAD + 14, W, 1, '#6a6c88');
        rect(b, 0, H - 8, W, 8, '#2a2c3e');
        for (let px0 = 10; px0 < W; px0 += 40) rect(b, px0, H - 8, 4, 8, '#3a3c52');
        env.grade(base.canvas);

        const antennas = [];
        const ar = rng(27);
        for (let i = 0; i < 6; i++) antennas.push({ x: Math.floor(ar() * W), y: 60 + Math.floor(ar() * 40), p: ar() * 6 });

        const r = rng(44);
        const cars = Array.from({ length: 16 }, () => {
            const right = r() < 0.55;
            return {
                right, x: r() * W, speed: (90 + r() * 90) * (right ? 1 : -1),
                y: right ? ROAD + 5 + Math.floor(r() * 3) : ROAD + 10 + Math.floor(r() * 3),
                len: 6 + Math.floor(r() * 10), body: env.c(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]),
            };
        });

        const lane = env.c('#c8cae8');
        const headlight = env.rgb('#fff6d8');
        const tailLight = env.rgb('#ff3050');
        const streak = 0.2 + 0.8 * env.lit;
        const rush = env.rain > 0 ? 0.8 : 1;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(base.canvas, 0, 0);

                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    for (const list of [farLit, midLit]) {
                        for (const w of list) {
                            if (Math.sin(t * 0.3 + w.p) > 0.97) continue;
                            px(ctx, w.x, w.y, w.c);
                        }
                    }
                    ctx.globalAlpha = 1;
                    if (env.lit > 0.3) {
                        for (const a of antennas) if (Math.sin(t * 3 + a.p) > 0.3) px(ctx, a.x, a.y, '#ff3b3b');
                        for (const s of signs) {
                            const on = Math.sin(t * 9 + s.p) > -0.85 || Math.sin(t * 0.7 + s.p) > 0;
                            if (!on) continue;
                            ctx.globalAlpha = env.lit;
                            rect(ctx, s.x, s.y, 2, s.h, s.c);
                            ctx.globalAlpha = 0.25 * env.lit;
                            rect(ctx, s.x - 1, s.y - 1, 4, s.h + 2, s.c);
                            ctx.globalAlpha = 1;
                        }
                    }
                }

                // Lane marks rushing past
                ctx.fillStyle = lane;
                for (let i = 0; i < 12; i++) {
                    const lx = wrap(i * 30 - t * 160 * rush, W + 30) - 15;
                    ctx.fillRect(Math.round(lx), ROAD + 9, 10, 1);
                }

                for (const c of cars) {
                    const cx = Math.round(wrap(c.x + t * c.speed * rush, W + 60) - 30);
                    const rgb = c.right ? headlight : tailLight;
                    for (let k = 0; k < c.len; k++) {
                        const tx = c.right ? cx - k - 3 : cx + k + 3;
                        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(streak * (1 - k / c.len)).toFixed(2)})`;
                        ctx.fillRect(tx, c.y, 1, 1);
                    }
                    ctx.fillStyle = c.body;
                    ctx.fillRect(cx - 2, c.y - 1, 5, 2);
                    const front = c.right ? cx + 2 : cx - 2;
                    ctx.fillStyle = c.right ? '#ffffff' : '#ff6070';
                    ctx.globalAlpha = 0.5 + 0.5 * env.lit;
                    ctx.fillRect(front, c.y - 1, 1, 1);
                    ctx.globalAlpha = 1;
                }
            },
        };
    },
};
