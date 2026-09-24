/**
 * wheat.js - Wheat field at golden hour, swaying in the wind (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, ridge, cloud, wrap } from './pixel.js';

const HORIZON = 118;

export default {
    id: 'wheat',
    name: 'Golden Field',
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, HORIZON + 4, ['#2a1b40', '#4e2a5a', '#8c3b5f', '#cc5d5b', '#ec935d', '#f7c374']);
        glow(sky.ctx, 232, 100, 34, '#fbd98f', 0.55);
        disc(sky.ctx, 232, 100, 15, '#ffe9ad');
        disc(sky.ctx, 232, 100, 12, '#fff3cc');

        const clouds = layer(W * 2, 90);
        const cr = rng(7);
        for (let i = 0; i < 9; i++) {
            cloud(clouds.ctx, cr() * W * 2, 18 + cr() * 50, 6 + cr() * 7, '#f8bf9c', '#c97c80', 100 + i);
        }

        const hills = layer();
        ridge(hills.ctx, HORIZON - 2, 5, '#7a3c5a', 3, { freq: 0.018 });
        ridge(hills.ctx, HORIZON + 4, 3, '#5a2e4c', 8, { freq: 0.03 });
        const tr = rng(12);
        for (let i = 0; i < 14; i++) {
            const x = tr() * W;
            const y = HORIZON - 1 + tr() * 3;
            rect(hills.ctx, x, y - 3, 3, 3, '#4a2440');
            rect(hills.ctx, x + 1, y - 5, 1, 2, '#4a2440');
        }

        const field = layer();
        ditherGradient(field.ctx, 0, HORIZON + 2, W, H - HORIZON - 2, ['#9c6530', '#b67a36', '#cd913d', '#bf853a', '#a86f30']);

        // Wheat rows, far to near: closer rows are lower, taller and sway more
        const rows = [];
        for (let i = 0; i < 16; i++) {
            const depth = i / 15;
            rows.push({
                y: HORIZON + 6 + Math.pow(depth, 1.35) * (H - HORIZON - 2),
                spacing: depth < 0.3 ? 2 : depth < 0.7 ? 3 : 4,
                head: 1 + Math.round(depth * 4),
                stem: 2 + Math.round(depth * 10),
                amp: 0.4 + depth * 2.2,
                offset: i * 1.7,
            });
        }

        const r = rng(31);
        const birds = Array.from({ length: 4 }, (_, i) => ({ x: r() * W, y: 26 + r() * 40, speed: 9 + r() * 6, phase: i }));
        const motes = Array.from({ length: 24 }, () => ({ x: r() * W, y: HORIZON + r() * 60, s: 2 + r() * 3, p: r() * 6 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                ctx.drawImage(clouds.canvas, -Math.round(wrap(t * 2, W)), 0);
                ctx.drawImage(clouds.canvas, W * 2 - Math.round(wrap(t * 2, W)), 0);
                ctx.drawImage(hills.canvas, 0, 0);

                for (const b of birds) {
                    const x = wrap(b.x - t * b.speed, W + 20) - 10;
                    const y = Math.round(b.y + Math.sin(t * 0.7 + b.phase) * 3);
                    const up = Math.floor(t * 5 + b.phase) % 2 === 0;
                    px(ctx, x, y, '#3a1c38');
                    px(ctx, x - 1, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x + 1, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x - 2, y + (up ? -1 : 1), '#3a1c38');
                    px(ctx, x + 2, y + (up ? -1 : 1), '#3a1c38');
                }

                ctx.drawImage(field.canvas, 0, 0);

                for (const row of rows) {
                    const gust = Math.sin(t * 0.35) * 0.5 + 0.5;
                    for (let x = (row.offset | 0) % row.spacing; x < W; x += row.spacing) {
                        const sway = Math.round(Math.sin(t * 1.6 - x * 0.045 + row.offset) * row.amp * (0.6 + gust * 0.6));
                        const top = Math.round(row.y - row.stem);
                        rect(ctx, x + Math.round(sway / 2), top + row.head, 1, row.stem - row.head, '#9a6a2c');
                        rect(ctx, x + sway, top, row.head > 3 ? 2 : 1, row.head, '#efc15a');
                        px(ctx, x + sway, top - 1, '#ffe39a');
                    }
                }

                for (const m of motes) {
                    const y = wrap(m.y - t * m.s, 70) + HORIZON - 10;
                    const x = wrap(m.x + Math.sin(t + m.p) * 6 + t * 3, W);
                    if (Math.sin(t * 2 + m.p) > -0.2) px(ctx, x, y, '#fff1b8');
                }
            },
        };
    },
};
