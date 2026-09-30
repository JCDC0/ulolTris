/**
 * ocean.js - Open sea with shimmering waves, a sailboat, gulls and a small palm
 * island (Casual). Signature look: sunny. In a storm the waves run high and the boat
 * pitches; at night its lantern is lit and the moon lays a path on the water.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, wrap } from './pixel.js';

const HORIZON = 106;

export default {
    id: 'ocean',
    name: 'Open Sea',
    signature: 'sunny',
    horizon: HORIZON,
    celestial: { sunX: 250, sunHighY: 30, sunLowY: 98, moonX: 250, moonY: 32 },
    fog: [HORIZON - 14, HORIZON + 40],
    rainBand: [HORIZON + 6, H - 6],
    sounds: { always: { surf: 0.7 }, day: { gulls: 0.7 }, night: {} },
    create(env) {
        const sky = env.makeSky();

        const sea = layer();
        ditherGradient(sea.ctx, 0, HORIZON, W, H - HORIZON, ['#56afe0', '#3690c8', '#2676b0', '#1c5e96', '#154c7e']);
        rect(sea.ctx, 0, HORIZON, W, 1, '#8fcaec');
        // Distant island
        for (let i = 0; i < 26; i++) {
            const h = Math.round(Math.sin((i / 26) * Math.PI) * 5);
            rect(sea.ctx, 60 + i, HORIZON - h, 1, h, '#5a86a8');
        }
        env.grade(sea.canvas);
        // The sun's (or moon's) light spread over the water beneath it
        const shine = layer();
        const shineColor = { sunset: ['#ff9a50', 0.5], night: ['#8ab0ff', 0.3], sunny: ['#ffffff', 0.22] }[env.id];
        if (env.sun.kind && shineColor) {
            glow(shine.ctx, env.sun.x, HORIZON + 4, 46, shineColor[0], shineColor[1]);
            shine.ctx.clearRect(0, 0, W, HORIZON + 1);
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
        env.grade(isle.canvas);

        const r = rng(19);
        const choppy = 0.6 + env.wind * 1.1;
        const waves = [];
        for (let i = 0; i < 90; i++) {
            const depth = r();
            waves.push({
                x: r() * W, y: HORIZON + 3 + Math.round(depth * depth * (H - HORIZON - 6)),
                len: 2 + Math.round(depth * 8), speed: (4 + depth * 10) * (r() < 0.5 ? 1 : -1), p: r() * 6,
                near: depth < 0.4,
            });
        }
        const caps = Array.from({ length: 60 }, () => ({
            x: r() * W, y: HORIZON + 6 + Math.round(r() * r() * (H - HORIZON - 10)), p: r() * 6, len: 2 + Math.floor(r() * 4),
        }));
        const gulls = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 40 + r() * 30, speed: 7 + r() * 5, p: i }));

        const waveNear = env.c('#a8dcf6');
        const waveFar = env.c('#7fc2ea');
        const white = env.c('#ffffff');
        const hull = env.c('#7a3a28');
        const hullDark = env.c('#5a2a1c');
        const mast = env.c('#3a2a20');
        const sailA = env.c('#f4f1e8');
        const sailB = env.c('#dcd6c8');
        const wake = env.rgba('#ffffff', 0.35);
        const gull = env.c('#f4f6fa');
        const gullTip = env.c('#aab4c4');
        const glitterMain = env.sun.kind === 'moon' ? '#dfe8ff' : env.id === 'sunset' ? '#ffe0a8' : '#ffffff';
        const glitter = env.rgba(glitterMain, env.sun.kind === 'moon' ? 0.7 : 1);
        const showGulls = !env.night && !env.storm;
        const pitch = 1 + env.wind * 2;

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(sea.canvas, 0, 0);
                ctx.drawImage(shine.canvas, 0, 0);

                for (const w of waves) {
                    const x = wrap(w.x + t * w.speed * choppy, W + 20) - 10;
                    if (Math.sin(t * 1.2 + w.p) < -0.6) continue;
                    ctx.fillStyle = w.near ? waveNear : waveFar;
                    ctx.fillRect(Math.round(x), w.y, w.len, 1);
                }
                if (env.wind >= 0.9) {
                    ctx.fillStyle = white;
                    for (const c of caps) {
                        const x = wrap(c.x + t * 9 * choppy, W + 10) - 5;
                        if (Math.sin(t * 3 + c.p) > 0.2) ctx.fillRect(Math.round(x), c.y, c.len, 1);
                    }
                }

                // Glitter in a column under the sun, or the moon
                if (env.sun.kind) {
                    const gr = rng(Math.floor(t * 8));
                    ctx.fillStyle = glitter;
                    for (let i = 0; i < 14; i++) {
                        const y = HORIZON + 2 + Math.floor(gr() * 50);
                        const spread = 4 + (y - HORIZON) * 0.4;
                        ctx.fillRect(env.sun.x + Math.round((gr() - 0.5) * spread * 2), y, 1, 1);
                    }
                }

                // Sailboat
                const bx = Math.round(wrap(t * 4 + 40, W + 60) - 30);
                const by = Math.round(HORIZON + 8 + Math.sin(t * 1.5) * pitch);
                rect(ctx, bx, by, 14, 2, hull);
                rect(ctx, bx + 1, by + 2, 12, 1, hullDark);
                rect(ctx, bx + 6, by - 13, 1, 13, mast);
                for (let i = 0; i < 11; i++) {
                    rect(ctx, bx + 7, by - 12 + i, Math.round(i * 0.6), 1, sailA);
                    rect(ctx, bx + 5 - Math.round(i * 0.35), by - 10 + i, Math.round(i * 0.35), 1, sailB);
                }
                ctx.fillStyle = wake;
                ctx.fillRect(bx - 2, by + 3, 18, 1);
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    rect(ctx, bx + 6, by - 15, 2, 2, '#ffd27a');
                    glow(ctx, bx + 7, by - 14, 8, '#ffb84a', 0.6);
                    ctx.globalAlpha = 1;
                }

                if (showGulls) {
                    for (const g of gulls) {
                        const x = Math.round(wrap(g.x + t * g.speed, W + 20) - 10);
                        const y = Math.round(g.y + Math.sin(t * 0.8 + g.p) * 4);
                        const up = Math.floor(t * 4 + g.p) % 2 === 0;
                        ctx.fillStyle = gull;
                        ctx.fillRect(x, y, 1, 1);
                        ctx.fillRect(x - 1, y + (up ? -1 : 0), 1, 1);
                        ctx.fillRect(x + 1, y + (up ? -1 : 0), 1, 1);
                        ctx.fillStyle = gullTip;
                        ctx.fillRect(x - 2, y + (up ? -1 : 1), 1, 1);
                        ctx.fillRect(x + 2, y + (up ? -1 : 1), 1, 1);
                    }
                }

                ctx.drawImage(isle.canvas, 0, 0);
                // Foam where the island meets the water
                ctx.fillStyle = white;
                for (let x = -10; x < 90; x += 3) {
                    const d = (x - 35) / 50;
                    const h = Math.max(0, Math.round((1 - d * d) * 16));
                    if (h > 0 && h < 6 && Math.sin(t * 2 * choppy + x) > 0) ctx.fillRect(x, H - h - 1, 1, 1);
                }
            },
        };
    },
};
