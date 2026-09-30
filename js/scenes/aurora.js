/**
 * aurora.js - Northern lights over a frozen lake, with a lit cabin among snowy
 * pines (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, ridge, glow, wrap } from './pixel.js';

const SHORE = 128;
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
    ambience: { wind: 0.9, owl: 0.35 },
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, SHORE, ['#050814', '#081226', '#0c1d38', '#12304a', '#1b4a58']);
        const r = rng(404);
        for (let i = 0; i < 70; i++) px(sky.ctx, r() * W, r() * 90, r() < 0.3 ? '#ffffff' : '#9fb4d8');

        // Two ranges of mountains, each capped with snow along its ridge line
        const land = layer();
        const l = land.ctx;
        for (const [base, amp, color, seed, freq, jag] of [[112, 14, '#223452', 61, 0.017, 6], [120, 9, '#16233c', 62, 0.026, 4]]) {
            const range = layer();
            ridge(range.ctx, base, amp, color, seed, { freq, jag });
            const data = range.ctx.getImageData(0, 0, W, SHORE).data;
            for (let x = 0; x < W; x++) {
                let y = 0;
                while (y < SHORE && data[(y * W + x) * 4 + 3] === 0) y++;
                const depth = 3 + Math.round(Math.sin(x * 0.3) + Math.sin(x * 0.11) * 2);
                for (let k = 0; k < depth; k++) px(range.ctx, x, y + k, k === 0 ? '#e6f0ff' : '#aac0e0');
            }
            l.drawImage(range.canvas, 0, 0);
        }
        l.clearRect(0, SHORE, W, H - SHORE);

        // The frozen lake, a snowy near shore, and the cabin on a point of land
        const lake = layer();
        ditherGradient(lake.ctx, 0, SHORE, W, H - SHORE, ['#1b4a58', '#173a52', '#122c46', '#0d2038']);
        const near = layer();
        const n = near.ctx;
        const shoreY = x => Math.round(164 - Math.exp(-(((x - 236) / 60) ** 2)) * 20 + Math.sin(x * 0.04) * 3);
        for (let x = 0; x < W; x++) {
            const y = shoreY(x);
            rect(n, x, y, 1, H - y, '#b8cbe6');
            rect(n, x, y, 1, 2, '#eef4ff');
            if (r() < 0.25) px(n, x, y + 3 + r() * 14, '#8ea6cc');
        }
        const cabinBase = shoreY(232) + 2;
        rect(n, 220, cabinBase - 12, 26, 12, '#3a2630');
        for (let y = cabinBase - 11; y < cabinBase; y += 3) rect(n, 220, y, 26, 1, '#24161e');
        for (let i = 0; i < 9; i++) rect(n, 217 + (8 - i) * 1.7, cabinBase - 21 + i, 32 - (8 - i) * 3.4, 1, i > 6 ? '#8ea6cc' : '#eef4ff');
        rect(n, 238, cabinBase - 25, 4, 7, '#2a1c24');
        rect(n, 237, cabinBase - 26, 6, 1, '#eef4ff');
        rect(n, 225, cabinBase - 8, 5, 5, '#ffcf6b');
        rect(n, 227, cabinBase - 8, 1, 5, '#8a5a30');
        rect(n, 236, cabinBase - 8, 5, 8, '#1c1218');
        glow(n, 227, cabinBase + 4, 8, '#e8b870', 0.35);
        for (let i = 0; i < 14; i++) {
            const x = Math.round(i < 5 ? 6 + r() * 60 : 170 + r() * 146);
            if (x > 212 && x < 254) continue;
            snowPine(n, x, shoreY(x) + 1, 14 + Math.floor(r() * 22), '#0e1a2c', '#dbe8fb');
        }

        const flakes = Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, s: 8 + r() * 10, p: r() * 6 }));

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
                ctx.drawImage(sky.canvas, 0, 0);
                for (const c of CURTAINS) curtain(ctx, c, t, false);
                ctx.drawImage(land.canvas, 0, 0);
                ctx.drawImage(lake.canvas, 0, 0);
                for (const c of CURTAINS) curtain(ctx, c, t, true);
                ctx.drawImage(near.canvas, 0, 0);

                // Smoke from the cabin chimney
                for (let k = 0; k < 6; k++) {
                    const age = wrap(t * 0.3 + k / 6, 1);
                    rect(ctx, 240 + Math.sin(age * 5 + k) * 2 - age * 8, cabinBase - 27 - age * 22, age > 0.5 ? 2 : 1, 1,
                        age < 0.5 ? '#9aa8c0' : '#5a6a88');
                }
                for (const f of flakes) {
                    const y = wrap(f.y + t * f.s, H);
                    const x = wrap(f.x + Math.sin(t * 0.7 + f.p) * 8 - t * 5, W);
                    px(ctx, x, y, '#eef4ff');
                }
            },
        };
    },
};
