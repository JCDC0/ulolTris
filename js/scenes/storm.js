/**
 * storm.js - Thunder Peak: jagged snowy mountains under racing clouds (Blitz).
 * Signature look: thunderstorm, with heavy rain and lightning. Two minutes of
 * pressure. In fair weather the same peaks stand in clear alpine light.
 */

import { W, H, rng, layer, rect, ditherGradient, glow, wrap } from './pixel.js';

/**
 * A mountain range from individual peaks of varied height and slope. Each column takes
 * the highest peak slope above it, with small jitter, and snow near each summit.
 * Returns the top y of every column.
 */
function peaks(ctx, seed, baseY, amp, color, snow) {
    const r = rng(seed);
    const list = [];
    for (let x = -30; x < W + 30; x += 22 + r() * 34) {
        list.push({ x, top: baseY - amp * (0.35 + r() * 0.65), slope: 0.7 + r() * 0.8 });
    }
    const tops = [];
    let jitter = 0;
    for (let x = 0; x < W; x++) {
        if (x % 3 === 0) jitter = Math.round((r() - 0.5) * 2);
        let y = baseY;
        let peak = null;
        for (const p of list) {
            const py = p.top + Math.abs(x - p.x) * p.slope;
            if (py < y) { y = py; peak = p; }
        }
        y = Math.round(y + jitter);
        tops.push(y);
        rect(ctx, x, y, 1, H - y, color);
        if (snow && peak) {
            const depth = Math.round(6 - (y - peak.top) * 0.6 + (r() < 0.3 ? 1 : 0));
            if (depth > 0 && peak.top < baseY - amp * 0.5) rect(ctx, x, y, 1, depth, snow);
        }
    }
    return tops;
}

export default {
    id: 'storm',
    name: 'Thunder Peak',
    signature: 'thunder',
    horizon: 128,
    celestial: { sunX: 250, sunHighY: 26, sunLowY: 92, moonX: 70, moonY: 30 },
    fog: [96, 170],
    rainBand: [150, 176],
    sounds: { always: { wind: 0.3 }, day: {}, night: { owl: 0.2 } },
    create(env) {
        const sky = env.makeSky();

        const far = layer();
        peaks(far.ctx, 2, 128, 46, '#7a8aa8', '#e8f0fa');
        env.grade(far.canvas);
        const near = layer();
        peaks(near.ctx, 9, 162, 38, '#3a4658', '#c8d4e4');
        env.grade(near.canvas);
        // Pines on the lower slopes give the near ridge a rough edge and some scale
        const pr = rng(31);
        const pines = layer();
        for (let x = 0; x < W; x += 3 + Math.floor(pr() * 5)) {
            const h = 4 + Math.floor(pr() * 8);
            const y = 172 + Math.floor(pr() * 8);
            for (let i = 0; i < h; i++) rect(pines.ctx, x - Math.floor(i / 3), y - h + i, 1 + Math.floor(i / 3) * 2, 1, '#22342e');
        }
        env.grade(pines.canvas);

        const hut = layer();
        rect(hut.ctx, 250, 166, 12, 8, '#7a5a44');
        for (let i = 0; i < 5; i++) rect(hut.ctx, 248 + i, 161 + i, 16 - i * 2, 1, i === 0 ? '#f2f8ff' : '#a8b8d0');
        rect(hut.ctx, 253, 169, 3, 3, '#3f5070');
        env.grade(hut.canvas);

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(far.canvas, 0, 0);
                ctx.drawImage(near.canvas, 0, 0);
                ctx.drawImage(hut.canvas, 0, 0);
                ctx.drawImage(pines.canvas, 0, 0);
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    rect(ctx, 253, 169, 3, 3, '#ffcf6b');
                    glow(ctx, 254, 170, 8, '#e8b870', 0.5);
                    ctx.globalAlpha = 1;
                }
            },
        };
    },
};
