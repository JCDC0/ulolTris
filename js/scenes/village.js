/**
 * village.js - A small village of timber houses with chimney smoke and lamps (Casual).
 * Signature look: night. Windows and lamps glow as it gets dark.
 */

import { W, H, rng, layer, rect, px, ditherGradient, glow, ridge, wrap } from './pixel.js';

const GROUND = 150;
const GLASS = '#3f5070';

function pine(ctx, x, base, h, color, lit) {
    for (let i = 0; i < h; i++) {
        const half = Math.floor((i / h) * (h * 0.4)) + (i % 3 === 0 ? 0 : 1);
        rect(ctx, x - half, base - h + i, half * 2 + 1, 1, color);
        if (lit && half > 0) px(ctx, x - half, base - h + i, lit);
    }
    rect(ctx, x, base, 1, 2, color);
}

function house(ctx, x, w, h, wall, wallDark, roof, roofDark, r, windows, chimneys) {
    const top = GROUND - h;
    rect(ctx, x, top, w, h, wall);
    rect(ctx, x + w - 2, top, 2, h, wallDark);
    for (let y = top + 3; y < GROUND; y += 4) rect(ctx, x, y, w - 2, 1, wallDark);

    const roofH = Math.round(w * 0.45);
    for (let i = 0; i < roofH; i++) {
        const inset = Math.round((roofH - i) * (w / 2 + 3) / roofH);
        rect(ctx, x - 3 + inset, top - roofH + i, w + 6 - inset * 2, 1, i % 3 === 0 ? roofDark : roof);
    }

    if (r() < 0.8) {
        const cx = x + Math.round(w * (0.2 + r() * 0.5));
        const cTop = top - Math.round(roofH * 0.7) - 4;
        rect(ctx, cx, cTop, 3, 8, '#6a5a58');
        rect(ctx, cx - 1, cTop, 5, 1, '#4a3c3c');
        chimneys.push({ x: cx + 1, y: cTop - 1, phase: r() * 10 });
    }

    rect(ctx, x + Math.round(w / 2) - 2, GROUND - 7, 4, 7, '#4a2c20');
    const winY = top + 4;
    for (let wx = x + 3; wx + 4 < x + w - 2; wx += 8) {
        if (Math.abs(wx + 2 - (x + w / 2)) < 4 && h < 20) continue;
        rect(ctx, wx - 1, winY - 1, 6, 6, '#4a3a2c');
        rect(ctx, wx, winY, 4, 4, GLASS);
        px(ctx, wx, winY, '#6a86a8');
        windows.push({ x: wx, y: winY, seed: r() });
    }
}

export default {
    id: 'village',
    name: 'Night Village',
    signature: 'night',
    horizon: 135,
    celestial: { sunX: 250, sunHighY: 30, sunLowY: 112, moonX: 58, moonY: 34 },
    fog: [110, 176],
    rainBand: [GROUND + 14, H - 3],
    sounds: { always: {}, day: { birds: 0.7 }, night: { crickets: 1, owl: 0.4 } },
    create(env) {
        const sky = env.makeSky();

        const base = layer();
        const b = base.ctx;
        ridge(b, 122, 12, '#6f9a86', 21, { freq: 0.013, jag: 3 });
        ridge(b, 134, 5, '#5a8a6c', 22, { freq: 0.025 });
        const tr = rng(4);
        for (let i = 0; i < 26; i++) pine(b, Math.round(tr() * W), 136 + Math.round(tr() * 6), 7 + Math.round(tr() * 7), '#2f5a3a', '#4a8a52');

        rect(b, 0, GROUND, W, H - GROUND, '#5f8f4a');
        ditherGradient(b, 0, GROUND, W, H - GROUND, ['#6b9a52', '#557f42']);
        // The lane through the village
        for (let x = 0; x < W; x++) {
            const y = GROUND + 12 + Math.round(Math.sin(x * 0.03) * 3);
            rect(b, x, y, 1, 6, (x >> 2) % 2 ? '#c9b48a' : '#bba67c');
        }

        const r = rng(8);
        const windows = [];
        const chimneys = [];
        const walls = [['#c99a76', '#a87c5a'], ['#d9b78e', '#b89670'], ['#b8909e', '#96727f'], ['#cdb894', '#a99878']];
        const roofs = [['#a83c46', '#7a2830'], ['#4a64a8', '#364a80'], ['#8a5a3a', '#684228'], ['#3f7a5e', '#2c5a44']];
        let x = 8;
        while (x < W - 20) {
            const w = 22 + Math.floor(r() * 12);
            const h = 15 + Math.floor(r() * 10);
            const [wall, wallDark] = walls[Math.floor(r() * walls.length)];
            const [roof, roofDark] = roofs[Math.floor(r() * roofs.length)];
            house(b, x, w, h, wall, wallDark, roof, roofDark, r, windows, chimneys);
            x += w + 10 + Math.floor(r() * 16);
        }

        const lamps = [52, 150, 262].map(lx => ({ x: lx, y: GROUND - 14 }));
        for (const l of lamps) {
            rect(b, l.x, l.y, 1, 14, '#3a3440');
            rect(b, l.x - 1, l.y - 3, 3, 3, '#9a8a6a');
        }
        env.grade(base.canvas);

        const sr = rng(77);
        const flies = Array.from({ length: 12 }, () => ({ x: sr() * W, y: GROUND - 6 + sr() * 14, p: sr() * 10 }));
        const smoke = env.rgb('#c8ccd8');
        const wind = 4 + env.wind * 10;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(base.canvas, 0, 0);

                // Windows glow as it gets dark; a few go out, a few flicker
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    for (const w of windows) {
                        const off = Math.sin(Math.floor(t / 4) * 13.7 + w.seed * 91) > 0.82;
                        if (off) continue;
                        const flicker = Math.sin(t * 7 + w.seed * 50) > 0.92;
                        rect(ctx, w.x, w.y, 4, 4, flicker ? '#ffe7a4' : '#ffc75e');
                        rect(ctx, w.x, w.y + 2, 4, 1, '#e8a646');
                    }
                    for (const l of lamps) {
                        glow(ctx, l.x, l.y, 10, '#8a6a44', 1.2);
                        rect(ctx, l.x - 1, l.y - 3, 3, 3, '#ffe08a');
                    }
                    ctx.globalAlpha = 1;
                }

                for (const c of chimneys) {
                    for (let k = 0; k < 7; k++) {
                        const age = wrap(t * 0.35 + k / 7 + c.phase, 1);
                        const sx = Math.round(c.x + Math.sin(age * 5 + k) * 2 + age * wind);
                        const sy = Math.round(c.y - age * 30);
                        const size = 1 + Math.round(age * 3);
                        ctx.fillStyle = `rgba(${smoke[0]}, ${smoke[1]}, ${smoke[2]}, ${((1 - age) * 0.55).toFixed(2)})`;
                        ctx.fillRect(sx, sy, size, size);
                    }
                }

                if (env.night && env.rain === 0) {
                    for (const f of flies) {
                        if (Math.sin(t * 2.5 + f.p) < 0.2) continue;
                        px(ctx, f.x + Math.sin(t * 0.6 + f.p) * 18, f.y + Math.sin(t * 1.3 + f.p * 2) * 5, '#d8ff7a');
                    }
                }
            },
        };
    },
};
