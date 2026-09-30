/**
 * aurora.js - A frozen lake among snowy mountains, with a cabin and snowy pines
 * (Casual). Signature look: night, when the northern lights dance. Rain falls as
 * snow here, and a thunderstorm becomes a blizzard.
 */

import { W, H, rng, layer, rect, px, ditherGradient, ridge, glow, wrap } from './pixel.js';

const SHORE = 128;
const GLASS = '#3f5070';
const CURTAINS = [
    { y: 34, amp: 11, len: 34, speed: 0.22, freq: 0.021, core: [126, 255, 196], edge: [60, 190, 170] },
    { y: 22, amp: 8, len: 26, speed: -0.16, freq: 0.034, core: [150, 140, 255], edge: [90, 80, 200] },
];

function snowPine(ctx, x, base, h, body, snow) {
    for (let i = 0; i < h; i++) {
        const tier = i % 5;
        const half = Math.floor((i / h) * (h * 0.36)) + (tier < 2 ? 0 : 1);
        rect(ctx, x - half, base - h + i, half * 2 + 1, 1, body);
        if (tier === 0 && half > 0) rect(ctx, x - half, base - h + i, half + 1, 1, snow);
    }
    rect(ctx, x, base, 1, 2, body);
}

export default {
    id: 'aurora',
    name: 'Northern Lights',
    signature: 'night',
    horizon: SHORE,
    precip: 'snow',
    celestial: { sunX: 240, sunHighY: 26, sunLowY: 92, moonX: 70, moonY: 30 },
    fog: [86, 150],
    sounds: { always: { wind: 0.35 }, day: {}, night: { owl: 0.35 } },
    create(env) {
        const sky = env.makeSky();
        const r = rng(404);
        const showLights = env.id === 'night';

        // Two ranges of mountains, each capped with snow along its ridge line
        const land = layer();
        const l = land.ctx;
        for (const [base, amp, color, seed, freq, jag] of [[112, 14, '#7c92b8', 61, 0.017, 6], [120, 9, '#6a80a8', 62, 0.026, 4]]) {
            const range = layer();
            ridge(range.ctx, base, amp, color, seed, { freq, jag });
            const data = range.ctx.getImageData(0, 0, W, SHORE).data;
            for (let x = 0; x < W; x++) {
                let y = 0;
                while (y < SHORE && data[(y * W + x) * 4 + 3] === 0) y++;
                const depth = 3 + Math.round(Math.sin(x * 0.3) + Math.sin(x * 0.11) * 2);
                for (let k = 0; k < depth; k++) px(range.ctx, x, y + k, k === 0 ? '#f4f8ff' : '#c8d8f0');
            }
            l.drawImage(range.canvas, 0, 0);
        }
        l.clearRect(0, SHORE, W, H - SHORE);
        env.grade(land.canvas);

        // The frozen lake, a snowy near shore, and the cabin on a point of land
        const lake = layer();
        ditherGradient(lake.ctx, 0, SHORE, W, H - SHORE, ['#b8dcf0', '#9cc8e4', '#82b4d8', '#6ca0c8']);
        env.grade(lake.canvas);

        const near = layer();
        const n = near.ctx;
        const lights = [];
        const shoreY = x => Math.round(164 - Math.exp(-(((x - 236) / 60) ** 2)) * 20 + Math.sin(x * 0.04) * 3);
        for (let x = 0; x < W; x++) {
            const y = shoreY(x);
            rect(n, x, y, 1, H - y, '#dce8f8');
            rect(n, x, y, 1, 2, '#ffffff');
            if (r() < 0.25) px(n, x, y + 3 + r() * 14, '#b0c4e4');
        }
        const cabinBase = shoreY(232) + 2;
        rect(n, 220, cabinBase - 12, 26, 12, '#8a5a3e');
        for (let y = cabinBase - 11; y < cabinBase; y += 3) rect(n, 220, y, 26, 1, '#6a4028');
        for (let i = 0; i < 9; i++) rect(n, 217 + (8 - i) * 1.7, cabinBase - 21 + i, 32 - (8 - i) * 3.4, 1, i > 6 ? '#b8c8e0' : '#f2f8ff');
        rect(n, 238, cabinBase - 25, 4, 7, '#5a4038');
        rect(n, 237, cabinBase - 26, 6, 1, '#f2f8ff');
        rect(n, 225, cabinBase - 8, 5, 5, GLASS);
        rect(n, 227, cabinBase - 8, 1, 5, '#6a4028');
        lights.push({ x: 225, y: cabinBase - 8, w: 5, h: 5 });
        rect(n, 236, cabinBase - 8, 5, 8, '#4a2c20');
        for (let i = 0; i < 14; i++) {
            const x = Math.round(i < 5 ? 6 + r() * 60 : 170 + r() * 146);
            if (x > 212 && x < 254) continue;
            snowPine(n, x, shoreY(x) + 1, 14 + Math.floor(r() * 22), '#245040', '#f2f8ff');
        }
        env.grade(near.canvas);

        const flakes = Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, s: 8 + r() * 10, p: r() * 6 }));
        const sparkles = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * W), y: 150 + Math.floor(r() * 28), p: r() * 10 }));
        const smokeColor = env.rgb('#e8eef8');
        const sparkle = env.c('#ffffff');
        const day = !env.night && env.rain === 0 && env.id !== 'sunset';

        function curtain(ctx, c, t, mirror) {
            for (let x = 0; x < W; x += 2) {
                const wave = Math.sin(x * c.freq + t * c.speed) * c.amp + Math.sin(x * c.freq * 2.7 - t * c.speed * 1.7) * c.amp * 0.4;
                const bright = 0.45 + 0.55 * Math.sin(x * 0.045 + t * c.speed * 3 + c.y);
                if (bright < 0.12) continue;
                const len = c.len * (0.6 + 0.4 * Math.sin(x * 0.07 - t * 0.31));
                const top = c.y + wave;
                if (mirror) {
                    // Reflection on the ice, squashed and dim
                    const y = SHORE + 2 + (SHORE - top - len) * 0.28;
                    ctx.fillStyle = `rgba(${c.core}, ${0.16 * bright})`;
                    ctx.fillRect(x, Math.round(y), 2, Math.round(len * 0.3));
                    continue;
                }
                ctx.fillStyle = `rgba(${c.edge}, ${0.2 * bright})`;
                ctx.fillRect(x, Math.round(top), 2, Math.round(len));
                ctx.fillStyle = `rgba(${c.core}, ${0.4 * bright})`;
                ctx.fillRect(x, Math.round(top + len * 0.55), 2, Math.round(len * 0.45));
                ctx.fillStyle = `rgba(${c.core}, ${0.5 * bright})`;
                ctx.fillRect(x, Math.round(top + len - 3), 2, 3);
            }
        }

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                if (showLights) for (const c of CURTAINS) curtain(ctx, c, t, false);
                ctx.drawImage(land.canvas, 0, 0);
                ctx.drawImage(lake.canvas, 0, 0);
                if (showLights) for (const c of CURTAINS) curtain(ctx, c, t, true);
                ctx.drawImage(near.canvas, 0, 0);

                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    ctx.fillStyle = '#ffcf6b';
                    for (const w of lights) ctx.fillRect(w.x, w.y, w.w, w.h);
                    glow(ctx, 227, cabinBase + 4, 9, '#e8b870', 0.4);
                    ctx.globalAlpha = 1;
                }

                // Smoke from the cabin chimney, blown along by the wind
                for (let k = 0; k < 6; k++) {
                    const age = wrap(t * 0.3 + k / 6, 1);
                    ctx.fillStyle = `rgba(${smokeColor[0]}, ${smokeColor[1]}, ${smokeColor[2]}, ${(0.85 - age * 0.6).toFixed(2)})`;
                    ctx.fillRect(Math.round(240 + Math.sin(age * 5 + k) * 2 - age * (8 + env.wind * 8)), Math.round(cabinBase - 27 - age * 22), age > 0.5 ? 2 : 1, 1);
                }
                if (day) {
                    ctx.fillStyle = sparkle;
                    for (const s of sparkles) if (Math.sin(t * 3 + s.p * 5) > 0.93) ctx.fillRect(s.x, s.y, 1, 1);
                }
                if (env.rain === 0) {
                    ctx.fillStyle = sparkle;
                    for (const f of flakes) {
                        const y = wrap(f.y + t * f.s, H);
                        const x = wrap(f.x + Math.sin(t * 0.7 + f.p) * 8 - t * 5, W);
                        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
                    }
                }
            },
        };
    },
};
