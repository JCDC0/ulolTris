/**
 * castle.js - A castle on a hill at dusk, flags waving, bats circling (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, ridge, cloud, wrap } from './pixel.js';

const STONE = '#5e5c7c';
const STONE_DARK = '#48466a';
const STONE_LIGHT = '#77759a';
const ROOF = '#7c2b4c';
const ROOF_DARK = '#5e1f3a';

function stoneBlock(ctx, x, y, w, h) {
    rect(ctx, x, y, w, h, STONE);
    rect(ctx, x, y, 1, h, STONE_LIGHT);
    rect(ctx, x + w - 1, y, 1, h, STONE_DARK);
    for (let row = y + 3, n = 0; row < y + h; row += 3, n++) {
        rect(ctx, x, row, w, 1, STONE_DARK);
        for (let bx = x + (n % 2 ? 2 : 4); bx < x + w - 1; bx += 5) px(ctx, bx, row - 1, STONE_DARK);
    }
}

function crenels(ctx, x, y, w) {
    for (let cx = x; cx < x + w; cx += 3) rect(ctx, cx, y - 2, 2, 2, STONE);
}

function tower(ctx, x, top, w, base, flags) {
    stoneBlock(ctx, x, top, w, base - top);
    const roofH = Math.round(w * 1.3);
    for (let i = 0; i < roofH; i++) {
        const half = Math.round((i / roofH) * (w / 2 + 2));
        rect(ctx, x + w / 2 - half, top - roofH + i, half * 2, 1, i % 4 === 0 ? ROOF_DARK : ROOF);
    }
    rect(ctx, x + Math.round(w / 2) - 1, top + 6, 2, 3, '#ffcf6b');
    rect(ctx, x + Math.round(w / 2) - 1, top + 16, 2, 3, '#ffcf6b');
    flags.push({ x: x + Math.round(w / 2), y: top - roofH - 6 });
}

export default {
    id: 'castle',
    name: 'Dusk Castle',
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, 150, ['#181231', '#321c4d', '#582757', '#923963', '#c95c5e', '#e8895b']);
        glow(sky.ctx, 74, 122, 30, '#f5a36d', 0.5);
        disc(sky.ctx, 74, 122, 14, '#f7c08a');

        const clouds = layer(W * 2, 100);
        const cr = rng(17);
        for (let i = 0; i < 8; i++) cloud(clouds.ctx, cr() * W * 2, 16 + cr() * 60, 4 + cr() * 5, '#b35f7c', '#7c3d68', 300 + i);

        const land = layer();
        const l = land.ctx;
        ridge(l, 128, 14, '#3a2150', 41, { freq: 0.016, jag: 5 });
        ridge(l, 150, 6, '#2a1a42', 42, { freq: 0.02 });
        // The castle hill
        l.fillStyle = '#20163a';
        for (let x = 0; x < W; x++) {
            const d = (x - 205) / 95;
            const y = Math.round(128 + d * d * 40);
            l.fillRect(x, Math.min(y, H), 1, H);
        }

        const flags = [];
        const baseY = 132;
        stoneBlock(l, 168, 108, 76, baseY - 108);
        crenels(l, 168, 108, 76);
        rect(l, 198, 116, 16, 16, '#1a1226');
        for (let i = 0; i < 8; i++) rect(l, 198 + i, 116 - Math.round(Math.sqrt(64 - (i - 8) ** 2) / 2), 16 - i * 2, 1, '#1a1226');
        tower(l, 160, 90, 12, baseY, flags);
        tower(l, 240, 90, 12, baseY, flags);
        tower(l, 199, 74, 14, 108, flags);
        crenels(l, 160, 90, 12);
        crenels(l, 240, 90, 12);
        for (const wx of [176, 186, 222, 232]) rect(l, wx, 116, 2, 3, '#ffcf6b');

        const tr = rng(51);
        for (let i = 0; i < 12; i++) {
            const x = i < 6 ? tr() * 90 : W - tr() * 60;
            const h = 14 + tr() * 22;
            for (let k = 0; k < h; k++) {
                const half = Math.round((k / h) * h * 0.33);
                rect(l, x - half, H - h - 4 + k, half * 2 + 1, 1, '#120d1f');
            }
        }
        rect(l, 0, H - 5, W, 5, '#120d1f');

        const sr = rng(3);
        const stars = Array.from({ length: 22 }, () => ({ x: Math.floor(sr() * W), y: Math.floor(sr() * 50), p: sr() * 10 }));
        const bats = Array.from({ length: 5 }, (_, i) => ({ cx: 205 + (sr() - 0.5) * 60, cy: 70 + sr() * 20, rx: 30 + sr() * 30, p: i * 1.3 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                for (const s of stars) if (Math.sin(t + s.p) > 0) px(ctx, s.x, s.y, '#f0d8f0');
                const cx = Math.round(wrap(t * 3, W));
                ctx.drawImage(clouds.canvas, -cx, 0);
                ctx.drawImage(clouds.canvas, W * 2 - cx, 0);
                ctx.drawImage(land.canvas, 0, 0);

                for (const f of flags) {
                    rect(ctx, f.x, f.y, 1, 7, '#2a2030');
                    for (let c = 0; c < 7; c++) {
                        const dy = Math.round(Math.sin(t * 6 - c * 0.9) * 0.9);
                        rect(ctx, f.x + 1 + c, f.y + dy, 1, 3, c % 2 ? '#ec4a5c' : '#d93a4e');
                    }
                }

                for (const b of bats) {
                    const x = Math.round(b.cx + Math.cos(t * 0.5 + b.p) * b.rx);
                    const y = Math.round(b.cy + Math.sin(t * 0.9 + b.p) * 10);
                    const up = Math.floor(t * 8 + b.p) % 2 === 0;
                    rect(ctx, x, y, 2, 1, '#140f22');
                    px(ctx, x - 1, y + (up ? -1 : 0), '#140f22');
                    px(ctx, x + 2, y + (up ? -1 : 0), '#140f22');
                    px(ctx, x - 2, y + (up ? -2 : 1), '#140f22');
                    px(ctx, x + 3, y + (up ? -2 : 1), '#140f22');
                }
            },
        };
    },
};
