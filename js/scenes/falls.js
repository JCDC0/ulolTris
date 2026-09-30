/**
 * falls.js - A waterfall dropping into a jungle pool, mist rising where it lands
 * (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, cloud, glow, wrap } from './pixel.js';

const FALL = { x: 128, w: 30, top: 46, bottom: 138 };
const POOL = 138;

function fern(ctx, x, y, len, dir, color, tip) {
    for (let k = 0; k < len; k++) {
        const fx = x + dir * k;
        const fy = y - Math.sin((k / len) * Math.PI) * len * 0.45 + k * 0.35;
        px(ctx, fx, fy, k > len - 3 ? tip : color);
        if (k % 2 === 0 && k > 1) {
            const leaf = Math.max(1, Math.round((1 - k / len) * 4));
            rect(ctx, fx, fy + 1, 1, leaf, color);
            rect(ctx, fx, fy - leaf, 1, leaf, color);
        }
    }
}

export default {
    id: 'falls',
    name: 'Misty Falls',
    ambience: { water: 1, birds: 0.6, wind: 0.15 },
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, 100, ['#3f8fc4', '#62aad4', '#8fc6e0', '#c2e2e8', '#e8f3e4']);
        const clouds = layer(W * 2, 60);
        const cr = rng(52);
        for (let i = 0; i < 6; i++) cloud(clouds.ctx, cr() * W * 2, 12 + cr() * 30, 5 + cr() * 6, '#ffffff', '#cfe3ee', 1200 + i);

        const land = layer();
        const l = land.ctx;
        const r = rng(77);

        // The cliff: layered rock with a notch for the river, mossy ledges
        const inFall = x => x > FALL.x - 4 && x < FALL.x + FALL.w + 4;
        const cliffTop = x => Math.round(46 + Math.sin(x * 0.03) * 5 + Math.sin(x * 0.11 + 1) * 2
            + (inFall(x) ? 3 : 0) + Math.max(0, x - 250) * 0.5);
        // Rock faces: uneven blocks split by joints, each stratum lit along its upper edge
        const joints = [0];
        while (joints[joints.length - 1] < W) joints.push(joints[joints.length - 1] + 9 + Math.floor(r() * 22));
        const tones = ['#625c70', '#524d62', '#454054', '#3a3648'];
        let block = 0;
        for (let x = 0; x < W; x++) {
            if (x >= joints[block + 1]) block++;
            const top = cliffTop(x);
            const warp = Math.round(Math.sin(x * 0.05 + block) * 2 + block % 3);
            for (let y = top; y < POOL; y++) {
                const band = Math.floor((y + warp) / 11);
                const edge = (y + warp) % 11;
                const tone = (band * 3 + block * 5) % 3 + (x === joints[block] ? 1 : 0);
                px(l, x, y, edge === 0 ? '#2c2a3a' : edge === 1 ? '#7a748a' : tones[tone]);
            }
            rect(l, x, top - 2, 1, 5, '#2f7a3f');
        }
        // Moss on the ledges
        for (let i = 0; i < 60; i++) {
            const x = Math.floor(r() * W);
            const y = cliffTop(x) + 6 + Math.floor(r() * 80);
            if (y < POOL - 2 && !inFall(x)) rect(l, x, y, 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 2), r() < 0.5 ? '#4f9a4c' : '#3a7f42');
        }
        // Jungle canopy along the rim
        for (let i = 0; i < 80; i++) {
            const x = r() * W;
            if (inFall(x)) continue;
            const y = cliffTop(Math.floor(x));
            disc(l, x, y - 3 - r() * 5, 3 + Math.floor(r() * 4), r() < 0.5 ? '#2f7a3f' : '#3f9448');
            px(l, x - 1, y - 7 - r() * 4, '#7cc464');
        }
        // Moss and vines hanging on the rock
        for (let i = 0; i < 46; i++) {
            const x = Math.floor(r() * W);
            if (x > FALL.x - 6 && x < FALL.x + FALL.w + 6) continue;
            const y = cliffTop(x) + 4 + Math.floor(r() * 50);
            rect(l, x, y, 1, 4 + Math.floor(r() * 16), r() < 0.5 ? '#3f8a44' : '#2f6a3a');
        }
        // Wet dark rock behind the water
        rect(l, FALL.x - 3, FALL.top, FALL.w + 6, POOL - FALL.top, '#2a2c40');

        const spray = layer();
        glow(spray.ctx, FALL.x + FALL.w / 2, POOL - 6, 34, '#e6f8f6', 0.75);

        const pool = layer();
        ditherGradient(pool.ctx, 0, POOL, W, H - POOL, ['#7fd0c8', '#4fb0b4', '#2f8c9c', '#1f6a80', '#16506a']);

        // Foreground: boulders and ferns
        const front = layer();
        const f = front.ctx;
        for (const [bx, by, br] of [[24, 176, 22], [70, 186, 16], [292, 178, 26], [246, 188, 14]]) {
            disc(f, bx, by, br, '#23222e');
            disc(f, bx - 3, by - 3, br - 4, '#33313f');
            for (let k = 0; k < br; k++) px(f, bx - br * 0.7 + r() * br * 1.2, by - br + 2 + r() * 5, '#4f9a4c');
        }
        for (let i = 0; i < 16; i++) {
            const x = i < 8 ? r() * 90 : W - r() * 80;
            fern(f, x, H - 6 - r() * 22, 12 + r() * 12, r() < 0.5 ? -1 : 1, '#1f5a2e', '#5fb050');
        }

        const span = FALL.bottom - FALL.top;
        const streaks = Array.from({ length: 70 }, () => ({
            x: FALL.x + r() * FALL.w, p: r() * 100, speed: 60 + r() * 50, len: 5 + r() * 12, bright: r() < 0.35,
        }));
        const mist = Array.from({ length: 34 }, () => ({ a: r() * 6.28, d: r(), p: r() * 6, s: 0.2 + r() * 0.4 }));
        const ripples = Array.from({ length: 26 }, () => ({ x: r() * W, y: POOL + 4 + Math.floor(r() * 30), len: 3 + r() * 9, p: r() * 6 }));
        const birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 14 + r() * 20, speed: 9 + r() * 6, p: i * 2 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                const cx = Math.round(wrap(t * 2, W * 2));
                ctx.drawImage(clouds.canvas, -cx, 0);
                ctx.drawImage(clouds.canvas, W * 2 - cx, 0);
                for (const b of birds) {
                    const x = wrap(b.x + t * b.speed, W + 20) - 10;
                    const y = Math.round(b.y + Math.sin(t * 0.8 + b.p) * 3);
                    const up = Math.floor(t * 5 + b.p) % 2 === 0;
                    px(ctx, x, y, '#2a3a4a');
                    px(ctx, x - 1, y + (up ? -1 : 1), '#2a3a4a');
                    px(ctx, x + 1, y + (up ? -1 : 1), '#2a3a4a');
                }
                ctx.drawImage(land.canvas, 0, 0);
                ctx.drawImage(pool.canvas, 0, 0);

                // The falling water: a pale sheet with brighter streaks running down it
                ctx.fillStyle = 'rgba(190, 232, 240, 0.78)';
                ctx.fillRect(FALL.x, FALL.top, FALL.w, span);
                rect(ctx, FALL.x, FALL.top - 2, FALL.w, 3, '#e8fbff');
                for (const s of streaks) {
                    const y = FALL.top + wrap(s.p + t * s.speed, span);
                    rect(ctx, s.x, y, 1, Math.min(s.len, FALL.bottom - y), s.bright ? '#ffffff' : '#8fc8dc');
                }

                for (const rp of ripples) {
                    const x = wrap(rp.x + Math.sin(t * 0.4 + rp.p) * 6, W);
                    if (Math.sin(t * 1.3 + rp.p) > 0) rect(ctx, x, rp.y, rp.len, 1, '#b8ece6');
                }

                // Foam and mist where the water lands
                ctx.drawImage(spray.canvas, 0, 0);
                const base = FALL.x + FALL.w / 2;
                for (const m of mist) {
                    const age = wrap(t * m.s + m.p, 1);
                    const x = base + Math.cos(m.a) * (FALL.w * 0.5 + age * 26) * (0.4 + m.d);
                    const y = POOL + 2 - age * 20 * m.d - Math.abs(Math.sin(m.a)) * 3;
                    ctx.fillStyle = `rgba(240, 252, 255, ${(1 - age) * 0.75})`;
                    ctx.fillRect(Math.round(x), Math.round(y), age > 0.4 ? 3 : 2, age > 0.4 ? 2 : 1);
                }
                for (let x = FALL.x - 6; x < FALL.x + FALL.w + 6; x += 2) {
                    if (Math.sin(t * 7 + x * 1.7) > -0.2) rect(ctx, x, POOL - 1 + Math.round(Math.sin(t * 5 + x)), 2, 2, '#ffffff');
                }

                ctx.drawImage(front.canvas, 0, 0);
            },
        };
    },
};
