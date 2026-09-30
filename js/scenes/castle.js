/**
 * castle.js - A castle on a crag above a lake (Casual). Signature look: sunset.
 *
 * The castle is built into its setting: walls run down to the rock they stand on,
 * a road climbs from the lakeside hamlet over a bridge to the gate, the sun on the
 * left lights every left face, and the lake mirrors the whole scene, whatever the
 * sky is doing. Windows, torches and the gate glow when it is dark.
 */

import { W, H, rng, layer, rect, px, disc, glow, ridge, hazeBand, wrap } from './pixel.js';

const SHORE = 146;

const STONE = '#9b98ae';
const STONE_LIT = '#cfc5c3';
const STONE_HI = '#f2e6d8';
const STONE_DARK = '#6b6885';
const STONE_DEEP = '#525070';
const ROOF = '#a63c3c';
const ROOF_LIT = '#d86058';
const ROOF_DARK = '#75262c';
const GLASS = '#3a4a6a';
const WARM = '#ffcf6b';
const ROCK = '#7a7484';
const ROCK_LIT = '#b09a9a';
const ROCK_DARK = '#524e60';
const PINE = '#2c5a38';

/** Top of the crag at column x. The plateau carries the castle; the left side is a cliff. */
function cragTop(x) {
    let y;
    if (x < 126) return H;
    if (x < 152) {
        const k = (x - 126) / 26;
        y = SHORE + 2 - (k * k * (3 - 2 * k)) * 34;
    } else if (x <= 276) {
        y = 114 + Math.sin(x * 0.11) * 1.5;
    } else {
        y = 114 + (x - 276) * 0.62;
    }
    return Math.round(y);
}

/**
 * A wall or square tower from its top down to the rock, lit from the left, with
 * courses of stone. `ground` gives the base per column, so nothing floats.
 */
function wall(ctx, x, top, w, ground) {
    for (let cx = x; cx < x + w; cx++) {
        const base = ground(cx);
        const edge = cx - x;
        const color = edge === 0 ? STONE_HI : edge < Math.max(2, w * 0.22) ? STONE_LIT : edge >= w - 2 ? STONE_DARK : STONE;
        rect(ctx, cx, top, 1, base - top + 1, color);
    }
    for (let row = top + 3, n = 0; row < H; row += 4, n++) {
        for (let cx = x + 1; cx < x + w - 1; cx++) {
            if (row >= ground(cx)) continue;
            if ((cx + n * 3) % 6 === 0) px(ctx, cx, row - 1, STONE_DARK);
            if ((cx * 7 + n * 5) % 11 < 7) px(ctx, cx, row, STONE_DARK);
        }
    }
}

/** A round tower: shading wraps across its width, and it ends in battlements or a cone roof. */
function roundTower(ctx, x, top, w, ground, roof, flags, lights) {
    for (let cx = x; cx < x + w; cx++) {
        const k = (cx - x) / (w - 1);
        const color = k < 0.12 ? STONE_HI : k < 0.38 ? STONE_LIT : k < 0.7 ? STONE : k < 0.9 ? STONE_DARK : STONE_DEEP;
        rect(ctx, cx, top, 1, ground(cx) - top + 1, color);
    }
    for (let row = top + 4, n = 0; row < H; row += 4, n++) {
        for (let cx = x + 1; cx < x + w - 1; cx++) {
            if (row < ground(cx) && (cx + n * 2) % 3 !== 0) px(ctx, cx, row, STONE_DARK);
        }
    }
    // Corbelled top, one pixel wider than the shaft
    rect(ctx, x - 1, top, w + 2, 2, STONE);
    rect(ctx, x - 1, top, 2, 2, STONE_HI);
    rect(ctx, x + w - 1, top, 2, 2, STONE_DARK);
    if (roof) {
        const roofH = Math.round(w * 1.25);
        for (let i = 0; i < roofH; i++) {
            const half = ((i + 1) / roofH) * (w / 2 + 2);
            const left = Math.round(x + w / 2 - half);
            const width = Math.round(half * 2);
            rect(ctx, left, top - roofH + i, width, 1, ROOF);
            rect(ctx, left, top - roofH + i, Math.max(1, Math.round(width * 0.3)), 1, ROOF_LIT);
            rect(ctx, left + Math.round(width * 0.72), top - roofH + i, width - Math.round(width * 0.72), 1, ROOF_DARK);
        }
        flags.push({ x: x + Math.floor(w / 2), y: top - roofH - 7 });
    } else {
        crenels(ctx, x - 1, top, w + 2);
    }
    const mid = x + Math.floor(w / 2);
    for (let wy = top + 7; wy < ground(mid) - 8; wy += 11) slit(ctx, mid, wy, lights);
}

function crenels(ctx, x, y, w) {
    for (let cx = x; cx < x + w; cx += 4) {
        rect(ctx, cx, y - 3, 2, 3, cx - x < w * 0.25 ? STONE_LIT : STONE);
        px(ctx, cx, y - 3, STONE_HI);
    }
}

/** An arrow slit: dark glass in the wall, and a warm light recorded for the dark hours. */
function slit(ctx, x, y, lights) {
    rect(ctx, x, y, 1, 3, GLASS);
    px(ctx, x - 1, y + 1, STONE_DARK);
    px(ctx, x + 1, y + 1, STONE_DARK);
    lights.push({ x, y, w: 1, h: 3 });
}

function arch(ctx, x, y, w, h, color) {
    rect(ctx, x, y + w / 2, w, h - w / 2, color);
    for (let i = 0; i < w / 2; i++) {
        const half = Math.round(Math.sqrt((w / 2) ** 2 - (w / 2 - i - 0.5) ** 2));
        rect(ctx, x + w / 2 - half, y + i, half * 2, 1, color);
    }
}

function pine(ctx, x, base, h, body, lit) {
    for (let i = 0; i < h; i++) {
        const half = Math.floor((i / h) * (h * 0.36)) + (i % 3 === 0 ? 0 : 1);
        rect(ctx, x - half, base - h + i, half * 2 + 1, 1, body);
        if (lit && half > 0) px(ctx, x - half, base - h + i, lit);
    }
    rect(ctx, x, base, 1, 2, body);
}

function cottage(ctx, x, base, w, lights) {
    rect(ctx, x, base - 5, w, 5, '#c9b592');
    rect(ctx, x, base - 5, 1, 5, '#e8d8b4');
    rect(ctx, x + w - 1, base - 5, 1, 5, '#a08c6c');
    for (let i = 0; i < 4; i++) rect(ctx, x - 1 + i, base - 6 - (3 - i), w + 2 - i * 2, 1, i === 3 ? ROOF_DARK : ROOF);
    px(ctx, x + 2, base - 3, GLASS);
    lights.push({ x: x + 2, y: base - 3, w: 1, h: 1 });
    if (w > 6) {
        px(ctx, x + w - 3, base - 3, GLASS);
        lights.push({ x: x + w - 3, y: base - 3, w: 1, h: 1 });
    }
}

/** The road from the hamlet to the gate, as points with a width. */
const ROAD = [
    [132, 149, 2], [150, 150, 3], [176, 151, 4], [214, 150, 4], [252, 146, 4], [278, 139, 3],
    [286, 131, 3], [272, 125, 2], [250, 121, 2], [232, 118, 2], [221, 116, 2],
];

export default {
    id: 'castle',
    name: 'Dusk Castle',
    signature: 'sunset',
    horizon: SHORE + 2,
    celestial: { sunX: 58, sunHighY: 30, sunLowY: 104, moonX: 58, moonY: 34 },
    fog: [96, 150],
    rainBand: [SHORE + 4, H - 24],
    sounds: { always: { water: 0.12 }, day: { birds: 0.4 }, night: { crickets: 0.7, owl: 0.6 } },
    create(env) {
        const sky = env.makeSky();
        const sun = env.sun;

        // Far mountains, hazier with distance
        const far = layer();
        ridge(far.ctx, 122, 16, '#8fa4c8', 41, { freq: 0.014, jag: 5 });
        ridge(far.ctx, 134, 9, '#7488b0', 42, { freq: 0.022, jag: 3 });
        far.ctx.clearRect(0, SHORE, W, H - SHORE);
        env.grade(far.canvas);
        hazeBand(far.ctx, 120, 152, env.info.sky[env.info.sky.length - 1], 0.35, 0.8);

        const land = layer();
        const l = land.ctx;
        const r = rng(51);
        const lights = [];

        // The crag: lit cliff on the left, strata, shadow on the right
        const jitter = [];
        for (let x = 0; x < W; x++) jitter.push(x % 3 === 0 ? Math.round((r() - 0.5) * 2) : jitter[x - 1]);
        const ground = x => cragTop(x) + (x >= 126 ? jitter[Math.max(0, Math.min(W - 1, x))] : 0);
        for (let x = 126; x < W; x++) {
            const top = ground(x);
            rect(l, x, top, 1, H - top, x < 150 ? ROCK_LIT : x > 268 ? ROCK_DARK : ROCK);
            for (let y = top + 3; y < H; y += 5) {
                const shift = Math.round(Math.sin(x * 0.2 + y) * 1.5);
                px(l, x, y + shift, x < 150 ? ROCK : ROCK_DARK);
            }
            if (x < 150 && x % 2 === 0) px(l, x, top + 1, '#d0b09a');
            // Grass on the plateau
            if (x >= 150) rect(l, x, top, 1, 2, x % 5 === 0 ? '#6fae56' : '#5f9a4c');
        }
        for (let i = 0; i < 9; i++) {
            const x = 128 + Math.floor(r() * 20);
            const y = ground(x) + 4 + Math.floor(r() * 18);
            rect(l, x, y, 1, 3 + Math.floor(r() * 5), ROCK);
        }

        const flags = [];
        // Outer ward stepping down the right slope, behind everything else
        wall(l, 268, 104, 30, ground);
        crenels(l, 268, 104, 30);
        roundTower(l, 294, 98, 9, ground, true, flags, lights);

        // Keep and the tall rear towers
        roundTower(l, 232, 60, 9, ground, true, flags, lights);
        wall(l, 186, 72, 34, ground);
        crenels(l, 186, 72, 34);
        for (const [wx, wy] of [[193, 80], [203, 80], [213, 80], [198, 92], [208, 92]]) {
            arch(l, wx, wy, 2, 4, GLASS);
            lights.push({ x: wx, y: wy + 1, w: 2, h: 3 });
        }
        // Keep roof with a turret
        for (let i = 0; i < 10; i++) {
            const left = 203 - i * 1.6;
            const width = 2 + i * 3.2;
            rect(l, left, 59 + i, width, 1, ROOF);
            rect(l, left, 59 + i, Math.max(1, width * 0.3), 1, ROOF_LIT);
            rect(l, left + width * 0.75, 59 + i, width * 0.25 + 1, 1, ROOF_DARK);
        }
        flags.push({ x: 203, y: 51 });
        roundTower(l, 172, 78, 8, ground, true, flags, lights);

        // Curtain wall with the gatehouse in the middle
        wall(l, 152, 98, 116, ground);
        crenels(l, 152, 98, 116);
        for (const bx of [170, 188, 240, 256]) {
            rect(l, bx, 104, 2, ground(bx) - 104, STONE_LIT);
            rect(l, bx + 2, 104, 1, ground(bx) - 104, STONE_DARK);
        }
        for (const wx of [162, 180, 196, 246, 262]) slit(l, wx, 104, lights);
        roundTower(l, 146, 86, 11, ground, true, flags, lights);
        roundTower(l, 262, 84, 11, ground, false, flags, lights);

        wall(l, 208, 92, 22, ground);
        crenels(l, 208, 92, 22);
        roundTower(l, 204, 88, 6, ground, false, flags, lights);
        roundTower(l, 228, 88, 6, ground, false, flags, lights);
        arch(l, 214, 103, 10, 13, '#241a2c');
        const torches = [[211, 106], [226, 106]];

        // Ivy and stains where the walls meet the rock
        for (let i = 0; i < 40; i++) {
            const x = 150 + Math.floor(r() * 146);
            const y = ground(x) - Math.floor(r() * 7);
            px(l, x, y, r() < 0.5 ? '#4a7a44' : '#3f6a3c');
        }

        // Foreground hills that the crag rises from, and the lakeside hamlet
        const hillY = x => Math.round(152 + Math.sin(x * 0.021 + 1) * 5 + Math.sin(x * 0.07) * 2 - Math.max(0, x - 120) * 0.035);
        for (let x = 118; x < W; x++) {
            const y = hillY(x);
            rect(l, x, y, 1, H - y, '#3f6f3a');
            px(l, x, y, '#5f9a4c');
        }
        // Stone bridge where the road crosses a gully
        for (let x = 262; x < 292; x++) rect(l, x, 140 - Math.round((x - 262) * 0.05), 1, 3, x % 4 === 0 ? STONE_DARK : '#8e8ba0');
        arch(l, 270, 143, 6, 7, '#2a2438');
        arch(l, 280, 143, 6, 7, '#2a2438');

        for (let i = 0; i < ROAD.length - 1; i++) {
            const [x0, y0, w0] = ROAD[i];
            const [x1, y1, w1] = ROAD[i + 1];
            const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
            for (let s = 0; s <= steps; s++) {
                const k = s / steps;
                const x = x0 + (x1 - x0) * k;
                const y = y0 + (y1 - y0) * k;
                const w = Math.round(w0 + (w1 - w0) * k);
                rect(l, x, y, 2, w, '#b8a684');
                px(l, x, y, '#d4c49c');
            }
        }

        // Pines climbing the crag, lit on the sun side
        for (let i = 0; i < 26; i++) {
            const x = 130 + Math.floor(r() * 186);
            const top = ground(x);
            const base = top + 8 + Math.floor(r() * 22);
            if (base > hillY(x) - 1 || (x > 200 && x < 236)) continue;
            pine(l, x, base, 6 + Math.floor(r() * 5), PINE, '#4a8a52');
        }
        cottage(l, 121, 150, 8, lights);
        cottage(l, 134, 152, 7, lights);
        cottage(l, 108, 149, 6, lights);
        rect(l, 96, 148, 26, H - 148, '#3f6f3a');
        for (let x = 96; x < 122; x++) px(l, x, 148 + Math.round(Math.sin(x * 0.4)), '#5f9a4c');
        env.grade(land.canvas);

        // The lake mirrors the sky, mountains and castle, tinted the color of water
        const scene = layer();
        scene.ctx.drawImage(sky.canvas, 0, 0);
        scene.ctx.drawImage(far.canvas, 0, 0);
        scene.ctx.drawImage(land.canvas, 0, 0);
        const lake = layer();
        for (let y = SHORE; y < H; y++) {
            const src = Math.max(0, SHORE - (y - SHORE) * 2 - 1);
            const shift = Math.round(Math.sin(y * 1.7) * 1.2);
            lake.ctx.drawImage(scene.canvas, 0, src, W, 1, shift, y, W, 1);
        }
        lake.ctx.fillStyle = `${env.c('#1c4a70').replace('rgb', 'rgba').replace(')', ', 0.5)')}`;
        lake.ctx.fillRect(0, SHORE, W, H - SHORE);
        rect(lake.ctx, 0, SHORE, W, 1, env.c('#3a6a90'));

        // Near bank in shadow, with pines framing the view
        const near = layer();
        const n = near.ctx;
        const bankY = x => Math.round(172 - Math.sin(x * 0.012 + 0.4) * 5 - Math.max(0, x - 150) * 0.1 + Math.sin(x * 0.09) * 1.5);
        for (let x = 0; x < W; x++) rect(n, x, bankY(x), 1, H, '#1f3f2a');
        for (let i = 0; i < 9; i++) {
            const x = i < 4 ? 4 + r() * 50 : W - 4 - r() * 70;
            pine(n, Math.round(x), bankY(Math.round(x)) + 1, 20 + Math.floor(r() * 26), '#1c3a26', '#2f5a3a');
        }
        for (let x = 0; x < W; x += 2) if (r() < 0.5) rect(n, x, bankY(x) - 1 - Math.floor(r() * 2), 1, 2, '#1f3f2a');
        env.grade(near.canvas);

        const bats = Array.from({ length: 5 }, (_, i) => ({ cx: 215 + (r() - 0.5) * 60, cy: 52 + r() * 18, rx: 30 + r() * 30, p: i * 1.3 }));
        const swallows = Array.from({ length: 4 }, (_, i) => ({ cx: 215 + (r() - 0.5) * 60, cy: 40 + r() * 16, rx: 40 + r() * 30, p: i * 1.9 }));
        const glints = Array.from({ length: 30 }, () => ({ x: r(), y: SHORE + 2 + Math.floor(r() * 24), p: r() * 6, len: 2 + Math.floor(r() * 5) }));

        const dusk = env.id === 'sunset' || env.id === 'night';
        const daytime = env.id === 'sunny' || env.id === 'cloudy';
        const glintColors = env.sun.kind === 'moon' ? ['#c8d4ff', '#8a9ad0'] : ['#ffd9a0', '#e8895b'];
        const smoke = env.c('#a8a0b8');
        const critter = env.c('#1a1626');

        return {
            draw(ctx, t) {
                sky.draw(ctx, t);
                ctx.drawImage(far.canvas, 0, 0);
                ctx.drawImage(lake.canvas, 0, 0);

                // Glitter and slow ripples on the water, under the sun or the moon
                if (sun.kind) {
                    for (const g of glints) {
                        if (Math.sin(t * 1.4 + g.p) < 0.1) continue;
                        const spread = 6 + (g.y - SHORE) * 1.1;
                        const x = sun.x + (g.x - 0.5) * spread * 2 + Math.sin(t * 0.5 + g.p) * 2;
                        rect(ctx, x, g.y, g.len, 1, g.y < SHORE + 10 ? glintColors[0] : glintColors[1]);
                    }
                }

                ctx.drawImage(land.canvas, 0, 0);

                // Lights: windows, the gate and torches, only as dark as it is
                if (env.lit > 0.05) {
                    ctx.globalAlpha = env.lit;
                    ctx.fillStyle = WARM;
                    for (const w of lights) ctx.fillRect(w.x, w.y, w.w, w.h);
                    arch(ctx, 215, 105, 8, 11, '#e0904a');
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = '#2a1c2c';
                    for (let gx = 216; gx < 223; gx += 2) ctx.fillRect(gx, 105, 1, 11);
                    ctx.fillRect(215, 109, 8, 1);
                    ctx.globalAlpha = env.lit;
                    for (const [tx, ty] of torches) {
                        const flick = Math.sin(t * 11 + tx) > 0;
                        px(ctx, tx, ty, flick ? '#ffe9a0' : '#ffb84a');
                        px(ctx, tx, ty - 1, flick ? '#ffb84a' : '#e8703a');
                    }
                    ctx.globalAlpha = 1;
                    glow(ctx, 219, 117, 7, '#c9784a', 0.45 * env.lit);
                }

                for (const f of flags) {
                    rect(ctx, f.x, f.y, 1, 7, '#2a2030');
                    const flap = 6 * (0.5 + env.wind * 0.6);
                    for (let c = 0; c < 6; c++) {
                        const dy = Math.round(Math.sin(t * flap - c * 0.9) * (0.7 + env.wind * 0.5));
                        rect(ctx, f.x + 1 + c, f.y + dy, 1, 3, c % 2 ? '#ec4a5c' : '#d93a4e');
                    }
                }

                // Chimney smoke from the hamlet
                ctx.fillStyle = smoke;
                for (let k = 0; k < 5; k++) {
                    const age = wrap(t * 0.35 + k / 5, 1);
                    ctx.fillRect(Math.round(124 + Math.sin(age * 6 + k) * 2 + age * (5 + env.wind * 6)), Math.round(141 - age * 14), 1, 1);
                }

                if (dusk && env.rain === 0) {
                    ctx.fillStyle = critter;
                    for (const b of bats) {
                        const x = Math.round(b.cx + Math.cos(t * 0.5 + b.p) * b.rx);
                        const y = Math.round(b.cy + Math.sin(t * 0.9 + b.p) * 10);
                        const up = Math.floor(t * 8 + b.p) % 2 === 0;
                        ctx.fillRect(x, y, 2, 1);
                        ctx.fillRect(x - 1, y + (up ? -1 : 0), 1, 1);
                        ctx.fillRect(x + 2, y + (up ? -1 : 0), 1, 1);
                        ctx.fillRect(x - 2, y + (up ? -2 : 1), 1, 1);
                        ctx.fillRect(x + 3, y + (up ? -2 : 1), 1, 1);
                    }
                }
                if (daytime) {
                    ctx.fillStyle = critter;
                    for (const b of swallows) {
                        const x = Math.round(b.cx + Math.cos(t * 0.4 + b.p) * b.rx);
                        const y = Math.round(b.cy + Math.sin(t * 0.7 + b.p) * 8);
                        const up = Math.floor(t * 5 + b.p) % 2 === 0 ? -1 : 1;
                        ctx.fillRect(x, y, 1, 1);
                        for (const dx of [-2, -1, 1, 2]) ctx.fillRect(x + dx, y + up, 1, 1);
                    }
                }

                ctx.drawImage(near.canvas, 0, 0);
            },
        };
    },
};
