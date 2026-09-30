/**
 * ocean.js - Open sea on a bright day: shimmering waves, a sailboat, gulls and a
 * small palm island (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, cloud, wrap } from './pixel.js';

const HORIZON = 106;

export default {
    id: 'ocean',
    name: 'Open Sea',
    ambience: { waves: 1, gulls: 0.7, wind: 0.3 },
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, HORIZON, ['#2b69be', '#4585d4', '#65a2e2', '#8cc0ee', '#bddff7', '#e6f4fc']);
        glow(sky.ctx, 250, 32, 26, '#fff4c4', 0.6);
        disc(sky.ctx, 250, 32, 11, '#fffbe6');

        const clouds = layer(W * 2, HORIZON);
        const cr = rng(61);
        for (let i = 0; i < 8; i++) cloud(clouds.ctx, cr() * W * 2, 20 + cr() * 60, 5 + cr() * 7, '#ffffff', '#c8dff2', 500 + i);

        const sea = layer();
        ditherGradient(sea.ctx, 0, HORIZON, W, H - HORIZON, ['#56afe0', '#3690c8', '#2676b0', '#1c5e96', '#154c7e']);
        rect(sea.ctx, 0, HORIZON, W, 1, '#8fcaec');
        // Distant island
        for (let i = 0; i < 26; i++) {
            const h = Math.round(Math.sin((i / 26) * Math.PI) * 5);
            rect(sea.ctx, 60 + i, HORIZON - h, 1, h, '#5a86a8');
        }

        // Palm island in the foreground
        const isle = layer();
        const s = isle.ctx;
        for (let x = -10; x < 90; x++) {
            const d = (x - 35) / 50;
            const h = Math.max(0, Math.round((1 - d * d) * 16));
            if (h > 0) {
                rect(s, x, H - h, 1, h, '#e9d59c');
                rect(s, x, H - h, 1, 1, '#f7e8bd');
                if (h > 3) rect(s, x, H - 2, 1, 2, '#cdb77c');
            }
        }
        // Trunk: a curved line of segments
        for (let i = 0; i < 34; i++) {
            const tx = Math.round(36 + Math.sin(i / 34 * 1.4) * 10);
            rect(s, tx, H - 14 - i, 3, 1, i % 3 === 0 ? '#6e4424' : '#8a5a30');
        }
        const topX = 46, topY = H - 49;
        const frond = (dir, len, droop, color) => {
            for (let k = 0; k < len; k++) {
                const fx = topX + dir * k;
                const fy = topY + Math.round((k * k) * droop);
                rect(s, fx, fy, 2, 1, color);
                if (k % 2 === 0 && k > 2) px(s, fx, fy + 1, color);
            }
        };
        frond(-1, 18, 0.05, '#2f8a3a'); frond(1, 20, 0.045, '#2f8a3a');
        frond(-1, 14, 0.09, '#4fb04a'); frond(1, 15, 0.08, '#4fb04a');
        frond(1, 10, 0.18, '#3a9a40'); frond(-1, 9, 0.2, '#3a9a40');
        disc(s, topX, topY + 2, 2, '#6b4424');

        const r = rng(19);
        const waves = [];
        for (let i = 0; i < 90; i++) {
            const depth = r();
            waves.push({
                x: r() * W, y: HORIZON + 3 + Math.round(depth * depth * (H - HORIZON - 6)),
                len: 2 + Math.round(depth * 8), speed: (4 + depth * 10) * (r() < 0.5 ? 1 : -1), p: r() * 6,
                color: depth < 0.4 ? '#a8dcf6' : '#7fc2ea',
            });
        }
        const gulls = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 40 + r() * 30, speed: 7 + r() * 5, p: i }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                const cx = Math.round(wrap(t * 2.5, W));
                ctx.drawImage(clouds.canvas, -cx, 0);
                ctx.drawImage(clouds.canvas, W * 2 - cx, 0);
                ctx.drawImage(sea.canvas, 0, 0);

                for (const w of waves) {
                    const x = wrap(w.x + t * w.speed, W + 20) - 10;
                    if (Math.sin(t * 1.2 + w.p) < -0.6) continue;
                    rect(ctx, x, w.y, w.len, 1, w.color);
                }

                // Sun glints in a column below the sun
                const gr = rng(Math.floor(t * 8));
                for (let i = 0; i < 14; i++) {
                    const y = HORIZON + 2 + Math.floor(gr() * 50);
                    const spread = 4 + (y - HORIZON) * 0.4;
                    px(ctx, 250 + Math.round((gr() - 0.5) * spread * 2), y, '#ffffff');
                }

                // Sailboat
                const bx = Math.round(wrap(t * 4 + 40, W + 60) - 30);
                const by = Math.round(HORIZON + 8 + Math.sin(t * 1.5));
                rect(ctx, bx, by, 14, 2, '#7a3a28');
                rect(ctx, bx + 1, by + 2, 12, 1, '#5a2a1c');
                rect(ctx, bx + 6, by - 13, 1, 13, '#3a2a20');
                for (let i = 0; i < 11; i++) {
                    rect(ctx, bx + 7, by - 12 + i, Math.round(i * 0.6), 1, '#f4f1e8');
                    rect(ctx, bx + 5 - Math.round(i * 0.35), by - 10 + i, Math.round(i * 0.35), 1, '#dcd6c8');
                }
                rect(ctx, bx - 2, by + 3, 18, 1, 'rgba(255,255,255,0.35)');

                for (const g of gulls) {
                    const x = wrap(g.x + t * g.speed, W + 20) - 10;
                    const y = Math.round(g.y + Math.sin(t * 0.8 + g.p) * 4);
                    const up = Math.floor(t * 4 + g.p) % 2 === 0;
                    px(ctx, x, y, '#f4f6fa');
                    px(ctx, x - 1, y + (up ? -1 : 0), '#f4f6fa'); px(ctx, x + 1, y + (up ? -1 : 0), '#f4f6fa');
                    px(ctx, x - 2, y + (up ? -1 : 1), '#aab4c4'); px(ctx, x + 2, y + (up ? -1 : 1), '#aab4c4');
                }

                ctx.drawImage(isle.canvas, 0, 0);
                // Foam where the island meets the water
                for (let x = -10; x < 90; x += 3) {
                    const d = (x - 35) / 50;
                    const h = Math.max(0, Math.round((1 - d * d) * 16));
                    if (h > 0 && h < 6 && Math.sin(t * 2 + x) > 0) px(ctx, x, H - h - 1, '#ffffff');
                }
            },
        };
    },
};
