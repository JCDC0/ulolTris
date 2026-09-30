/**
 * village.js - A small village at night: lit windows, chimney smoke, stars (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, ridge, wrap } from './pixel.js';

const GROUND = 150;

function pine(ctx, x, base, h, color) {
    for (let i = 0; i < h; i++) {
        const half = Math.floor((i / h) * (h * 0.4)) + (i % 3 === 0 ? 0 : 1);
        rect(ctx, x - half, base - h + i, half * 2 + 1, 1, color);
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
        rect(ctx, cx, cTop, 3, 8, '#3a2e34');
        rect(ctx, cx - 1, cTop, 5, 1, '#2a2026');
        chimneys.push({ x: cx + 1, y: cTop - 1, phase: r() * 10 });
    }

    rect(ctx, x + Math.round(w / 2) - 2, GROUND - 7, 4, 7, '#2a1c16');
    const winY = top + 4;
    for (let wx = x + 3; wx + 4 < x + w - 2; wx += 8) {
        if (Math.abs(wx + 2 - (x + w / 2)) < 4 && h < 20) continue;
        rect(ctx, wx - 1, winY - 1, 6, 6, '#3a2a22');
        windows.push({ x: wx, y: winY, seed: r() });
    }
}

export default {
    id: 'village',
    name: 'Night Village',
    ambience: { crickets: 1, owl: 0.4, wind: 0.2 },
    create() {
        const base = layer();
        const b = base.ctx;
        ditherGradient(b, 0, 0, W, 135, ['#060919', '#0b112e', '#131b42', '#1d2756', '#2b3466']);
        glow(b, 58, 34, 22, '#1e2a58', 0.7);
        disc(b, 58, 34, 11, '#f2ecd0');
        px(b, 54, 31, '#d9d0ac'); rect(b, 60, 36, 2, 2, '#d9d0ac'); px(b, 63, 30, '#d9d0ac'); rect(b, 55, 38, 2, 1, '#d9d0ac');

        ridge(b, 122, 12, '#121937', 21, { freq: 0.013, jag: 3 });
        ridge(b, 134, 5, '#18203f', 22, { freq: 0.025 });
        const tr = rng(4);
        for (let i = 0; i < 26; i++) pine(b, Math.round(tr() * W), 136 + Math.round(tr() * 6), 7 + Math.round(tr() * 7), '#0e1530');

        rect(b, 0, GROUND, W, H - GROUND, '#171b2a');
        ditherGradient(b, 0, GROUND, W, H - GROUND, ['#1a1f30', '#141824']);
        for (let x = 0; x < W; x++) {
            const y = GROUND + 12 + Math.round(Math.sin(x * 0.03) * 3);
            rect(b, x, y, 1, 6, (x >> 2) % 2 ? '#2a2c3c' : '#262838');
        }

        const r = rng(8);
        const windows = [];
        const chimneys = [];
        const walls = [['#6b4a3a', '#57392c'], ['#7a5d47', '#624a38'], ['#5c4a5a', '#4a3a48'], ['#6d5c49', '#584a3a']];
        const roofs = [['#7a2f38', '#5e2129'], ['#34467a', '#26345c'], ['#5b3a2a', '#462a1e'], ['#2f5a4a', '#224438']];
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
            glow(b, l.x, l.y, 10, '#4a3f46', 1.6);
            glow(b, l.x, l.y, 6, '#8a6a44', 1.4);
            rect(b, l.x, l.y, 1, 14, '#1e1a22');
            rect(b, l.x - 1, l.y - 3, 3, 3, '#ffe08a');
        }

        const sr = rng(77);
        const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(sr() * W), y: Math.floor(sr() * 100), p: sr() * 10, big: sr() < 0.1 }));
        const flies = Array.from({ length: 12 }, () => ({ x: sr() * W, y: GROUND - 6 + sr() * 14, p: sr() * 10 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(base.canvas, 0, 0);

                for (const s of stars) {
                    const tw = Math.sin(t * 1.5 + s.p);
                    if (tw < -0.4) continue;
                    const c = tw > 0.6 ? '#ffffff' : '#8f9fe0';
                    px(ctx, s.x, s.y, c);
                    if (s.big && tw > 0.5) { px(ctx, s.x - 1, s.y, '#6f7fc0'); px(ctx, s.x + 1, s.y, '#6f7fc0'); px(ctx, s.x, s.y - 1, '#6f7fc0'); px(ctx, s.x, s.y + 1, '#6f7fc0'); }
                }

                for (const w of windows) {
                    const off = Math.sin(Math.floor(t / 4) * 13.7 + w.seed * 91) > 0.82;
                    const flicker = Math.sin(t * 7 + w.seed * 50) > 0.92;
                    rect(ctx, w.x, w.y, 4, 4, off ? '#1c1a2a' : flicker ? '#ffe7a4' : '#ffc75e');
                    if (!off) rect(ctx, w.x, w.y + 2, 4, 1, '#e8a646');
                }

                for (const c of chimneys) {
                    for (let k = 0; k < 7; k++) {
                        const age = wrap(t * 0.35 + k / 7 + c.phase, 1);
                        const sx = Math.round(c.x + Math.sin(age * 5 + k) * 2 + age * 10);
                        const sy = Math.round(c.y - age * 30);
                        const size = 1 + Math.round(age * 3);
                        ctx.fillStyle = `rgba(150, 156, 184, ${(1 - age) * 0.55})`;
                        ctx.fillRect(sx, sy, size, size);
                    }
                }

                for (const f of flies) {
                    if (Math.sin(t * 2.5 + f.p) < 0.2) continue;
                    px(ctx, f.x + Math.sin(t * 0.6 + f.p) * 18, f.y + Math.sin(t * 1.3 + f.p * 2) * 5, '#d8ff7a');
                }
            },
        };
    },
};
