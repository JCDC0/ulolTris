/**
 * falls.js - A waterfall dropping into a jungle pool, mist rising where it lands
 * (Casual). Signature look: sunny.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, wrap } from './pixel.js';

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
    signature: 'sunny',
    horizon: 100,
    celestial: { sunX: 288, sunHighY: 20, sunLowY: 54, moonX: 288, moonY: 24 },
    fog: [70, 150],
    rainBand: [POOL + 2, H - 8],
    sounds: { always: { water: 1 }, day: { birds: 0.6 }, night: { crickets: 0.4 } },
    create(env) {
        const sky = env.makeSky();

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
        const tones = ['#7a7488', '#6a657c', '#5c576e', '#4e4a60'];
        let block = 0;
        for (let x = 0; x < W; x++) {
            if (x >= joints[block + 1]) block++;
            const top = cliffTop(x);
            const warp = Math.round(Math.sin(x * 0.05 + block) * 2 + block % 3);
            for (let y = top; y < POOL; y++) {
                const band = Math.floor((y + warp) / 11);
                const edge = (y + warp) % 11;
                const tone = (band * 3 + block * 5) % 3 + (x === joints[block] ? 1 : 0);
                px(l, x, y, edge === 0 ? '#38364a' : edge === 1 ? '#9a94ac' : tones[tone]);
            }
            rect(l, x, top - 2, 1, 5, '#2f7a3f');
        }
        // Moss on the ledges
        for (let i = 0; i < 60; i++) {
            const x = Math.floor(r() * W);
            const y = cliffTop(x) + 6 + Math.floor(r() * 80);
            if (y < POOL - 2 && !inFall(x)) rect(l, x, y, 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 2), r() < 0.5 ? '#5aaa54' : '#448a48');
        }
        // Jungle canopy along the rim
        for (let i = 0; i < 80; i++) {
            const x = r() * W;
            if (inFall(x)) continue;
            const y = cliffTop(Math.floor(x));
            disc(l, x, y - 3 - r() * 5, 3 + Math.floor(r() * 4), r() < 0.5 ? '#2f8a3f' : '#3fa44c');
            px(l, x - 1, y - 7 - r() * 4, '#8cd470');
        }
        // Vines hanging on the rock
        for (let i = 0; i < 46; i++) {
            const x = Math.floor(r() * W);
            if (x > FALL.x - 6 && x < FALL.x + FALL.w + 6) continue;
            const y = cliffTop(x) + 4 + Math.floor(r() * 50);
            rect(l, x, y, 1, 4 + Math.floor(r() * 16), r() < 0.5 ? '#3f8a44' : '#2f6a3a');
        }
        // Wet dark rock behind the water
        rect(l, FALL.x - 3, FALL.top, FALL.w + 6, POOL - FALL.top, '#3a3c54');
        env.grade(land.canvas);

        const spray = layer();
        glow(spray.ctx, FALL.x + FALL.w / 2, POOL - 6, 34, '#e6f8f6', 0.75);
        env.grade(spray.canvas);

        const pool = layer();
        ditherGradient(pool.ctx, 0, POOL, W, H - POOL, ['#7fd0c8', '#4fb0b4', '#2f8c9c', '#1f6a80', '#16506a']);
        env.grade(pool.canvas);

        // Foreground: boulders and ferns
        const front = layer();
        const f = front.ctx;
        for (const [bx, by, br] of [[24, 176, 22], [70, 186, 16], [292, 178, 26], [246, 188, 14]]) {
            disc(f, bx, by, br, '#3a3a48');
            disc(f, bx - 3, by - 3, br - 4, '#55556a');
            for (let k = 0; k < br; k++) px(f, bx - br * 0.7 + r() * br * 1.2, by - br + 2 + r() * 5, '#5aaa54');
        }
        for (let i = 0; i < 16; i++) {
            const x = i < 8 ? r() * 90 : W - r() * 80;
            fern(f, x, H - 6 - r() * 22, 12 + r() * 12, r() < 0.5 ? -1 : 1, '#2a7a3c', '#6fc45a');
        }
        env.grade(front.canvas);

        const span = FALL.bottom - FALL.top;
        const streaks = Array.from({ length: 70 }, () => ({
            x: FALL.x + r() * FALL.w, p: r() * 100, speed: 60 + r() * 50, len: 5 + r() * 12, bright: r() < 0.35,
        }));
        const mist = Array.from({ length: 34 }, () => ({ a: r() * 6.28, d: r(), p: r() * 6, s: 0.2 + r() * 0.4 }));
        const ripples = Array.from({ length: 26 }, () => ({ x: r() * W, y: POOL + 4 + Math.floor(r() * 30), len: 3 + r() * 9, p: r() * 6 }));
        const birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 14 + r() * 20, speed: 9 + r() * 6, p: i * 2 }));
        const flies = Array.from({ length: 14 }, () => ({ x: 20 + r() * 280, y: POOL + 2 + r() * 40, p: r() * 10 }));

        const sheet = env.rgba('#bee8f0', 0.78);
        const lip = env.c('#e8fbff');
        const white = env.c('#ffffff');
        const streakDim = env.c('#8fc8dc');
        const ripple = env.c('#b8ece6');
        const bird = env.c('#2a3a4a');
        const showBirds = !env.night && env.rain === 0;
        const flow = 1 + (env.rain > 0 ? 0.25 : 0);

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                if (showBirds) {
                    ctx.fillStyle = bird;
                    for (const b of birds) {
                        const x = Math.round(wrap(b.x + t * b.speed, W + 20) - 10);
                        const y = Math.round(b.y + Math.sin(t * 0.8 + b.p) * 3);
                        const up = Math.floor(t * 5 + b.p) % 2 === 0 ? -1 : 1;
                        ctx.fillRect(x, y, 1, 1);
                        ctx.fillRect(x - 1, y + up, 1, 1);
                        ctx.fillRect(x + 1, y + up, 1, 1);
                    }
                }
                ctx.drawImage(land.canvas, 0, 0);
                ctx.drawImage(pool.canvas, 0, 0);

                // The falling water: a pale sheet with brighter streaks running down it
                ctx.fillStyle = sheet;
                ctx.fillRect(FALL.x, FALL.top, FALL.w, span);
                rect(ctx, FALL.x, FALL.top - 2, FALL.w, 3, lip);
                for (const s of streaks) {
                    const y = FALL.top + wrap(s.p + t * s.speed * flow, span);
                    rect(ctx, s.x, y, 1, Math.min(s.len, FALL.bottom - y), s.bright ? white : streakDim);
                }

                ctx.fillStyle = ripple;
                for (const rp of ripples) {
                    const x = wrap(rp.x + Math.sin(t * 0.4 + rp.p) * 6, W);
                    if (Math.sin(t * 1.3 + rp.p) > 0) ctx.fillRect(Math.round(x), rp.y, Math.round(rp.len), 1);
                }

                // Foam and mist where the water lands
                ctx.drawImage(spray.canvas, 0, 0);
                const base = FALL.x + FALL.w / 2;
                for (const m of mist) {
                    const age = wrap(t * m.s + m.p, 1);
                    const x = base + Math.cos(m.a) * (FALL.w * 0.5 + age * 26) * (0.4 + m.d);
                    const y = POOL + 2 - age * 20 * m.d - Math.abs(Math.sin(m.a)) * 3;
                    ctx.fillStyle = env.rgba('#f0fcff', ((1 - age) * 0.75).toFixed(2));
                    ctx.fillRect(Math.round(x), Math.round(y), age > 0.4 ? 3 : 2, age > 0.4 ? 2 : 1);
                }
                ctx.fillStyle = white;
                for (let x = FALL.x - 6; x < FALL.x + FALL.w + 6; x += 2) {
                    if (Math.sin(t * 7 + x * 1.7) > -0.2) ctx.fillRect(x, POOL - 1 + Math.round(Math.sin(t * 5 + x)), 2, 2);
                }

                if (env.night && env.rain === 0) {
                    for (const fl of flies) {
                        const on = Math.sin(t * 2.2 + fl.p);
                        if (on < 0.1) continue;
                        ctx.fillStyle = on > 0.7 ? '#eaff9a' : '#a8d85a';
                        ctx.fillRect(Math.round(fl.x + Math.sin(t * 0.6 + fl.p) * 14), Math.round(fl.y + Math.sin(t * 1.3 + fl.p * 2) * 5), 1, 1);
                    }
                }

                ctx.drawImage(front.canvas, 0, 0);
            },
        };
    },
};
