/**
 * sakura.js - Cherry blossoms around a hillside shrine gate, petals drifting on the
 * breeze (Casual). Signature look: sunny (a spring morning).
 */

import { W, H, rng, layer, rect, px, disc, glow, ridge, hazeBand, wrap } from './pixel.js';

const PINK = ['#f7b9cf', '#ee8fb2', '#d96a97', '#fde0ea'];
/** A peach horizon for the sunny variant only, so the morning feels like spring. */
const SPRING_SKY = ['#6fa8dc', '#8fbfe6', '#b5d6ee', '#dbe6f2', '#f6dfe2', '#fbcfd4'];

/** A mass of blossom: overlapping discs, dark underneath, light on top. */
function blossom(ctx, r, x, y, size) {
    const puffs = Array.from({ length: 5 + Math.floor(size / 2) }, () => [
        x + (r() - 0.5) * size * 2.4, y + (r() - 0.5) * size * 1.1, size * (0.45 + r() * 0.5),
    ]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx, cy + 2, Math.round(pr), PINK[2]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx, cy, Math.round(pr), PINK[1]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx - 1, cy - 1, Math.max(1, Math.round(pr * 0.65)), PINK[0]);
    for (let i = 0; i < size * 3; i++) px(ctx, x + (r() - 0.5) * size * 2.6, y + (r() - 0.6) * size * 1.4, PINK[3]);
}

/** A branch as a wandering line that thins toward its tip. Returns points along it. */
function branch(ctx, r, x, y, angle, length, width, color) {
    const points = [];
    for (let i = 0; i < length; i++) {
        angle += (r() - 0.5) * 0.35;
        x += Math.cos(angle);
        y += Math.sin(angle);
        const w = Math.max(1, Math.round(width * (1 - i / length)));
        rect(ctx, x, y, w, w, color);
        if (i % 6 === 0) points.push([x, y]);
    }
    return points;
}

function torii(ctx, x, base) {
    const red = '#d8433c', dark = '#8e2630', lit = '#f0735a', cap = '#3a2a34';
    for (const lx of [x - 9, x + 6]) {
        rect(ctx, lx, base - 22, 3, 22, red);
        rect(ctx, lx, base - 22, 1, 22, lit);
        rect(ctx, lx + 2, base - 22, 1, 22, dark);
        rect(ctx, lx - 1, base - 2, 5, 2, cap);
    }
    rect(ctx, x - 11, base - 18, 22, 2, red);
    rect(ctx, x - 11, base - 17, 22, 1, dark);
    rect(ctx, x - 14, base - 25, 28, 3, red);
    rect(ctx, x - 14, base - 25, 28, 1, lit);
    rect(ctx, x - 15, base - 27, 30, 2, cap);
    rect(ctx, x - 16, base - 28, 2, 1, cap);
    rect(ctx, x + 14, base - 28, 2, 1, cap);
    rect(ctx, x - 1, base - 22, 2, 4, dark);
}

export default {
    id: 'sakura',
    name: 'Blossom Shrine',
    signature: 'sunny',
    horizon: 150,
    celestial: { sunX: 190, sunHighY: 26, sunLowY: 108, moonX: 190, moonY: 30 },
    fog: [96, 156],
    rainBand: [H - 24, H - 3],
    sounds: { always: { bell: 1, wind: 0.22 }, day: { birds: 1 }, night: { owl: 0.35, crickets: 0.4 } },
    create(env) {
        const sky = env.makeSky(env.id === 'sunny' ? { palette: SPRING_SKY } : {});

        const land = layer();
        const l = land.ctx;
        const r = rng(83);

        // A snow-capped peak far off, then hills dotted with blossoming trees
        for (let y = 0; y < 62; y++) {
            const half = 6 + y * 1.25 + Math.sin(y * 0.5) * 1.5;
            rect(l, 92 - half, 58 + y, half * 2, 1, '#8ea3c8');
            // Snow cap with ragged fingers running down the slopes
            if (y < 9) rect(l, 92 - half, 58 + y, half * 2, 1, '#f4f6fb');
            else if (y < 22) {
                for (let x = -half; x < half; x++) {
                    if (9 + Math.abs(Math.sin(x * 0.9)) * 12 > y) px(l, 92 + x, 58 + y, '#f4f6fb');
                }
            }
        }
        env.grade(land.canvas);
        hazeBand(l, 96, 132, env.info.sky[env.info.sky.length - 1], 0.7, 0.9);

        const hills = layer();
        const h = hills.ctx;
        ridge(h, 126, 7, '#8aa88e', 21, { freq: 0.02 });
        for (let i = 0; i < 26; i++) disc(h, r() * W, 122 + r() * 8, 2 + Math.floor(r() * 2), r() < 0.6 ? '#eea4bf' : '#f7c4d6');
        ridge(h, 142, 8, '#5f8f68', 22, { freq: 0.016 });
        for (let i = 0; i < 18; i++) {
            const x = r() * W, y = 136 + r() * 8;
            rect(h, x, y, 1, 4, '#4a3a3a');
            disc(h, x, y - 1, 3, '#e98bb0');
            disc(h, x - 1, y - 2, 2, '#f7bfd3');
        }

        // The shrine hill with stone steps up to the gate
        const hillY = x => Math.round(150 - Math.exp(-(((x - 120) / 70) ** 2)) * 22 + Math.sin(x * 0.05) * 1.5);
        for (let x = 0; x < W; x++) {
            const y = hillY(x);
            rect(h, x, y, 1, H - y, '#3f7a4c');
            rect(h, x, y, 1, 2, '#6cab62');
            if (r() < 0.3) px(h, x, y + 3 + r() * 20, '#57955a');
            if (r() < 0.12) px(h, x, y + 2 + r() * 24, '#f7bfd3');
        }
        for (let i = 0; i < 17; i++) {
            const y = 129 + i * 3;
            const half = 5 + i * 1.3;
            rect(h, 120 - half, y, half * 2, 3, i % 2 ? '#b9b4ae' : '#cfcac2');
            rect(h, 120 - half, y + 2, half * 2, 1, '#8d8890');
        }
        torii(h, 120, 130);
        // Stone lanterns flanking the steps: dark glass now, a flame when it is dark
        const lanterns = [98, 142];
        for (const lx of lanterns) {
            rect(h, lx, 138, 3, 7, '#9a96a0');
            rect(h, lx - 1, 135, 5, 3, '#7c7884');
            px(h, lx + 1, 136, '#5a5a66');
            rect(h, lx - 2, 133, 7, 2, '#9a96a0');
        }
        env.grade(hills.canvas);
        l.drawImage(hills.canvas, 0, 0);

        // The big cherry tree that frames the right side
        const tree = layer();
        const tc = tree.ctx;
        const tr = rng(19);
        for (let y = 60; y < H; y++) {
            const w = 9 + Math.max(0, y - 150) * 0.5 + Math.sin(y * 0.2) * 1.2;
            const x = 268 + Math.sin(y * 0.035) * 9;
            rect(tc, x, y, w, 1, '#4a2f33');
            rect(tc, x, y, 2, 1, '#7a5350');
            rect(tc, x + w - 2, y, 2, 1, '#2e1c24');
            if (y % 7 === 0) rect(tc, x + 2, y, w * 0.4, 1, '#2e1c24');
        }
        const tips = [];
        for (const [bx, by, ang, len, wd] of [
            [270, 92, -2.75, 120, 5], [272, 74, -2.2, 80, 4], [276, 66, -1.2, 48, 4],
            [274, 108, -2.95, 84, 3], [278, 84, -0.45, 46, 3], [270, 120, 3.0, 50, 2],
        ]) tips.push(...branch(tc, tr, bx, by, ang, len, wd, '#4a2f33'));
        for (const [x, y] of tips) blossom(tc, tr, x, y, 5 + Math.floor(tr() * 5));
        blossom(tc, tr, 290, 58, 12);
        blossom(tc, tr, 250, 46, 10);
        env.grade(tree.canvas);

        const petalColors = PINK.map(c => env.c(c));
        const petals = Array.from({ length: 46 }, () => ({
            x: r() * W, y: r() * H, fall: 7 + r() * 9, drift: 8 + r() * 10, p: r() * 6, c: petalColors[Math.floor(r() * 4)],
        }));
        const birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 24 + r() * 30, speed: 10 + r() * 6, p: i * 2 }));
        const flies = Array.from({ length: 12 }, () => ({ x: 20 + r() * 200, y: 128 + r() * 26, p: r() * 10 }));
        const bird = env.c('#4a5a78');
        const showBirds = !env.night && env.rain === 0;
        const blow = 0.6 + env.wind * 1.4;

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

                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    for (const lx of lanterns) {
                        const flick = Math.sin(t * 9 + lx) > 0;
                        rect(ctx, lx, 136, 3, 2, flick ? '#ffe9a0' : '#ffd27a');
                        glow(ctx, lx + 1, 137, 9, '#ffb84a', 0.5);
                    }
                    ctx.globalAlpha = 1;
                }
                if (env.night && env.rain === 0) {
                    for (const f of flies) {
                        const on = Math.sin(t * 2.2 + f.p);
                        if (on < 0.1) continue;
                        ctx.fillStyle = on > 0.7 ? '#eaff9a' : '#a8d85a';
                        ctx.fillRect(Math.round(f.x + Math.sin(t * 0.6 + f.p) * 14), Math.round(f.y + Math.sin(t * 1.3 + f.p * 2) * 5), 1, 1);
                    }
                }

                ctx.drawImage(tree.canvas, 0, 0);

                for (const p of petals) {
                    const y = wrap(p.y + t * p.fall * blow, H + 8) - 4;
                    const x = wrap(p.x - t * p.drift * blow + Math.sin(t * 1.3 + p.p) * 7, W + 8) - 4;
                    const flip = Math.sin(t * 4 + p.p) > 0;
                    ctx.fillStyle = p.c;
                    ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2);
                }
            },
        };
    },
};
