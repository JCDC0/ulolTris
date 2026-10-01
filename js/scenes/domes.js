/**
 * domes.js - Snow Domes: an onion-domed cathedral and a bell tower at twilight, with
 * snow falling, warm windows and lamps (Classic). A nod to the folk song the music is
 * built on. All shapes are drawn procedurally; nothing here copies a real artwork.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, wrap, parseColor } from './pixel.js';

const GROUND = 146;

const BRICK = '#9c2f3b';
const BRICK_DARK = '#76222f';
const BRICK_LIGHT = '#b8454a';
const CREAM = '#ecdcc0';
const CREAM_DARK = '#c3ae8e';
const GOLD = '#f3c94a';
const GOLD_DARK = '#b8801f';
const OUTLINE = '#2a1226';
const WINDOW = '#ffd978';
const SNOW = '#eef3ff';

/** Mix a hex color toward white (k > 0) or black (k < 0). */
function mix(hex, k) {
    const [r, g, b] = parseColor(hex);
    const t = k > 0 ? 255 : 0;
    const f = Math.abs(k);
    const c = v => Math.round(v + (t - v) * f);
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/**
 * An onion dome: a bulb that swells above a narrow neck and tapers to a point, with a
 * gold ball and cross. `pattern(x, row, side, u)` returns true for the first color.
 */
function onion(ctx, cx, baseY, r, height, a, b, pattern) {
    for (let i = 0; i < height; i++) {
        const u = i / (height - 1);
        const swell = u < 0.28
            ? 0.5 + 0.5 * Math.sin((u / 0.28) * Math.PI / 2)
            : Math.pow(Math.cos(((u - 0.28) / 0.72) * Math.PI / 2), 1.3);
        const hw = Math.max(i === height - 1 ? 0 : 1, Math.round(r * swell));
        for (let x = -hw; x <= hw; x++) {
            const side = hw ? x / hw : 0;
            let c = pattern(x, i, side, u) ? a : b;
            if (x === -hw || x === hw) c = OUTLINE;
            else if (side < -0.4) c = mix(c, 0.25);
            else if (side > 0.5) c = mix(c, -0.3);
            px(ctx, cx + x, baseY - i, c);
        }
    }
    const top = baseY - height;
    rect(ctx, cx - 1, top - 1, 3, 2, GOLD);
    rect(ctx, cx, top - 6, 1, 6, GOLD);
    rect(ctx, cx - 2, top - 4, 5, 1, GOLD);
    px(ctx, cx - 1, top - 1, GOLD_DARK);
}

const PATTERNS = {
    stripes: (x, i) => (x + i + 40) % 5 < 3,
    diamonds: (x, i) => ((x + i + 60) % 6 < 3) === ((x - i + 60) % 6 < 3),
    ribs: (x, i, side) => Math.floor((side + 1) * 3) % 2 === 0,
    spiral: (x, i, side, u) => (((side * 1.6 + u * 4) % 1) + 1) % 1 < 0.5,
};

/** A short round drum under a dome, with a gold band and tiny windows. */
function drum(ctx, cx, top, h, w, lights) {
    rect(ctx, cx - w, top, w * 2 + 1, h, CREAM);
    rect(ctx, cx + w - 1, top, 2, h, CREAM_DARK);
    rect(ctx, cx - w, top, w * 2 + 1, 1, GOLD);
    for (let x = cx - w + 2; x < cx + w - 1; x += 4) {
        rect(ctx, x, top + 2, 1, h - 3, '#3a1c28');
        lights.push({ x, y: top + 2, w: 1, h: h - 3 });
    }
}

/** Brick wall with a cream cap, and cream arches (kokoshniks) along the top. */
function wall(ctx, x, y, w, h) {
    rect(ctx, x, y, w, h, BRICK);
    for (let row = y + 3, n = 0; row < y + h; row += 3, n++) {
        rect(ctx, x, row, w, 1, BRICK_DARK);
        for (let bx = x + (n % 2 ? 2 : 5); bx < x + w; bx += 6) px(ctx, bx, row - 1, BRICK_DARK);
    }
    rect(ctx, x, y, 1, h, BRICK_LIGHT);
    rect(ctx, x + w - 1, y, 1, h, BRICK_DARK);
    rect(ctx, x - 1, y, w + 2, 3, CREAM);
    rect(ctx, x - 1, y + 3, w + 2, 1, CREAM_DARK);
    for (let ax = x + 1; ax + 4 <= x + w; ax += 5) {
        rect(ctx, ax, y - 2, 4, 2, CREAM);
        rect(ctx, ax + 1, y - 3, 2, 1, CREAM);
    }
}

function windowArch(ctx, x, y, color) {
    rect(ctx, x - 1, y, 5, 7, '#3a1420');
    rect(ctx, x, y + 2, 3, 4, color);
    px(ctx, x + 1, y + 1, color);
}

/** The tall tent roof: a slim tapering spire with ribs, bands and a gold dome on top. */
function tent(ctx, cx, baseY, w, h) {
    for (let i = 0; i < h; i++) {
        const k = i / h;
        const hw = Math.max(1, Math.round((w / 2) * Math.pow(1 - k, 1.15)));
        for (let x = -hw; x <= hw; x++) {
            let c = BRICK;
            const rib = Math.abs(x) <= 0 || Math.abs(x) === Math.round(hw * 0.55);
            if (rib) c = CREAM;
            if (x === -hw) c = BRICK_LIGHT;
            else if (x === hw) c = BRICK_DARK;
            else if (x > hw * 0.4 && !rib) c = BRICK_DARK;
            if (i % 11 === 10) c = CREAM_DARK;
            px(ctx, cx + x, baseY - i, c);
        }
    }
}

function fir(ctx, x, baseY, h, color, snow) {
    for (let i = 0; i < h; i++) {
        const hw = Math.round((1 - i / h) * (h / 3.2)) + (i % 5 === 0 ? 1 : 0);
        rect(ctx, x - hw, baseY - i, hw * 2 + 1, 1, color);
        if (i % 5 === 3 && hw > 1) {
            rect(ctx, x - hw, baseY - i, Math.max(1, Math.floor(hw / 2)), 1, snow);
        }
    }
    rect(ctx, x, baseY, 1, 3, '#3a2418');
}

function lamp(ctx, x) {
    rect(ctx, x, GROUND - 22, 1, 22, '#241a30');
    rect(ctx, x - 1, GROUND - 25, 3, 3, '#ffe9a8');
    rect(ctx, x - 2, GROUND - 26, 5, 1, '#241a30');
}

export default {
    id: 'domes',
    name: 'Snow Domes',
    create() {
        const sky = layer();
        const s = sky.ctx;
        ditherGradient(s, 0, 0, W, GROUND, ['#080a24', '#12154a', '#262a72', '#4b3a88', '#86498a', '#c46472', '#eb9a6c']);
        glow(s, 252, 40, 24, '#3b3f86', 0.55);
        disc(s, 252, 40, 8, '#f4f6ff');
        disc(s, 255, 38, 6, '#dfe4fa');
        glow(s, 160, GROUND - 4, 90, '#d6806c', 0.4);

        const land = layer();
        const l = land.ctx;
        const lights = [];

        // Far wall and towers, hazy purple, running behind everything
        rect(l, 0, GROUND - 17, W, 17, '#4a3478');
        for (let cx = 0; cx < W; cx += 6) rect(l, cx, GROUND - 20, 3, 3, '#4a3478');
        for (const tx of [118, 150, 190, 214]) {
            rect(l, tx - 4, GROUND - 38, 9, 38, '#3e2b6c');
            for (let i = 0; i < 10; i++) rect(l, tx - 5 + Math.floor(i / 2), GROUND - 39 - i, 11 - Math.floor(i / 2) * 2, 1, '#523a86');
        }

        // Left: the cathedral. Walls, then domes behind the tent, the tent, then front domes.
        wall(l, 4, 120, 96, GROUND - 120);
        wall(l, 20, 106, 64, 14);
        for (const wx of [14, 28, 42, 62, 76, 90]) { windowArch(l, wx, 129, WINDOW); lights.push({ x: wx, y: 131, w: 3, h: 4 }); }
        for (const wx of [30, 40, 60, 70]) { windowArch(l, wx - 1, 111, WINDOW); lights.push({ x: wx - 1, y: 113, w: 3, h: 4 }); }

        drum(l, 30, 99, 7, 5, lights);
        onion(l, 30, 99, 7, 17, '#3a6fd0', '#f2f2ff', PATTERNS.spiral);
        drum(l, 74, 99, 7, 5, lights);
        onion(l, 74, 99, 7, 17, '#e8892e', '#ffd84a', PATTERNS.ribs);

        tent(l, 52, 106, 26, 58);
        rect(l, 47, 106, 11, 2, CREAM);
        onion(l, 52, 47, 4, 10, GOLD, GOLD_DARK, PATTERNS.ribs);

        drum(l, 14, 114, 6, 5, lights);
        onion(l, 14, 114, 8, 19, '#2f9e5a', '#e8f2d0', PATTERNS.stripes);
        drum(l, 88, 114, 6, 5, lights);
        onion(l, 88, 114, 8, 19, '#d6453d', '#f3c94a', PATTERNS.diamonds);

        // Right: a chapel with two small domes, and the bell tower
        wall(l, 236, 120, 32, GROUND - 120);
        for (const wx of [242, 252, 262]) { windowArch(l, wx, 129, WINDOW); lights.push({ x: wx, y: 131, w: 3, h: 4 }); }
        drum(l, 245, 114, 6, 4, lights);
        onion(l, 245, 114, 6, 14, '#cc3b44', '#f4f0e0', PATTERNS.stripes);
        drum(l, 259, 114, 6, 4, lights);
        onion(l, 259, 114, 6, 14, '#2c8f6a', '#f4f0e0', PATTERNS.stripes);

        wall(l, 276, 74, 20, GROUND - 74);
        for (let wy = 84; wy < 130; wy += 14) { windowArch(l, 285, wy, WINDOW); lights.push({ x: 285, y: wy + 2, w: 3, h: 4 }); }
        for (const wx of [279, 291]) { rect(l, wx - 1, 74, 4, 8, '#2b1424'); }
        drum(l, 286, 67, 7, 6, lights);
        onion(l, 286, 67, 8, 19, '#2c5fb8', '#f3c94a', PATTERNS.ribs);

        // Snow on the ledges, trees and lamps
        for (const [x, y, w] of [[3, 117, 98], [19, 103, 66], [235, 117, 34], [275, 71, 22]]) {
            for (let i = 0; i < w; i++) if ((i * 7) % 5 !== 0) px(l, x + i, y, SNOW);
        }
        const tr = rng(21);
        for (const tx of [108, 226, 272, 304, 312]) fir(l, tx, GROUND + 2, 18 + Math.floor(tr() * 6), '#173a4a', '#dfeaff');
        fir(l, 106, GROUND + 3, 12, '#1d4756', '#dfeaff');
        lamp(l, 100);
        lamp(l, 232);

        // Ground: deep snow with soft drifts
        ditherGradient(l, 0, GROUND, W, H - GROUND, ['#dfe6fa', '#b9c5e8', '#8f9cd2', '#6b76b4']);
        for (let x = 0; x < W; x++) {
            const y = GROUND + Math.round(Math.sin(x * 0.09) * 1.5 + Math.sin(x * 0.31) * 0.7);
            rect(l, x, y - 1, 1, 2, '#f4f7ff');
        }
        for (const [sx, sw] of [[4, 96], [236, 32], [276, 20]]) rect(l, sx, GROUND + 1, sw, 2, '#aab6e0');

        const r = rng(8);
        const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * 80), p: r() * 6 }));
        const sparkles = Array.from({ length: 36 }, () => ({
            x: Math.floor(r() * W), y: GROUND + 3 + Math.floor(r() * (H - GROUND - 4)), p: r() * 6,
        }));
        const flakes = Array.from({ length: 90 }, (_, i) => ({
            x: r() * W, y: r() * H, depth: i % 3, p: r() * 6,
        }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                for (const st of stars) if (Math.sin(t * 1.4 + st.p) > -0.3) px(ctx, st.x, st.y, '#e4e8ff');
                ctx.drawImage(land.canvas, 0, 0);

                // A few windows flicker off for a moment, like candles
                for (const w of lights) {
                    if (Math.sin(t * 0.6 + w.x * 1.7 + w.y) > 0.985) rect(ctx, w.x, w.y, w.w, w.h, '#3a1420');
                }
                for (const sp of sparkles) if (Math.sin(t * 2.2 + sp.p) > 0.8) px(ctx, sp.x, sp.y, '#ffffff');
                glow(ctx, 100, GROUND - 24, 12, '#ffd27a', 0.35 + Math.sin(t * 5) * 0.03);
                glow(ctx, 232, GROUND - 24, 12, '#ffd27a', 0.35 + Math.sin(t * 5 + 2) * 0.03);

                for (const f of flakes) {
                    const speed = 9 + f.depth * 9;
                    const y = wrap(f.y + t * speed, H + 4) - 2;
                    const x = wrap(f.x + Math.sin(t * 0.8 + f.p) * 6 + t * (2 + f.depth), W);
                    ctx.globalAlpha = 0.45 + f.depth * 0.25;
                    if (f.depth === 2) rect(ctx, x, y, 2, 2, '#ffffff');
                    else px(ctx, x, y, '#ffffff');
                }
                ctx.globalAlpha = 1;
            },
        };
    },
};
