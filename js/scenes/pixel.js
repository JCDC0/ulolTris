/**
 * pixel.js - Helpers for the pixel art backgrounds. Scenes draw at a low
 * resolution (W x H) and the page scales the canvas up with crisp pixels.
 */

export const W = 320;
export const H = 180;

/** Seeded random number generator (mulberry32), so scenes look the same each time. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** An offscreen canvas for a static layer. */
export function layer(w = W, h = H) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
}

export function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];

/**
 * Vertical gradient through a list of colors, with 4x4 ordered dithering between
 * neighboring bands instead of smooth blending, for a pixel art look.
 */
export function ditherGradient(ctx, x, y, w, h, colors) {
    const bands = colors.length - 1;
    const rgb = colors.map(parseColor);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let row = 0; row < h; row++) {
        const pos = (row / Math.max(1, h - 1)) * bands;
        const i = Math.min(bands - 1, Math.floor(pos));
        const frac = pos - i;
        for (let col = 0; col < w; col++) {
            const c = frac > (BAYER[(y + row) & 3][(x + col) & 3] + 0.5) / 16 ? rgb[i + 1] : rgb[i];
            const o = (row * w + col) * 4;
            d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
    }
    const tmp = layer(w, h);
    tmp.ctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp.canvas, x, y);
}

/** '#rrggbb' to [r, g, b]. */
export function parseColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Dithered haze band: coverage peaks in the middle of [y0, y1) and fades to the edges.
 * Written straight into pixels, so large bands stay fast to build.
 */
export function hazeBand(ctx, y0, y1, hex, alpha, density) {
    const [r, g, b] = parseColor(hex);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const mid = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
        const k = 1 - Math.abs((y - mid) / half);
        const cover = k * k * density;
        for (let x = 0; x < W; x++) {
            if (cover <= (BAYER[y & 3][x & 3] + 0.5) / 16) continue;
            const o = (y * W + x) * 4;
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(alpha * 255);
        }
    }
    ctx.putImageData(img, 0, 0);
}

/** Filled pixel disc. */
export function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
}

/** Dithered ring of light around a point, fading out to radius r. */
export function glow(ctx, cx, cy, r, color, strength = 0.5) {
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy) / r;
            if (d > 1) continue;
            const threshold = (BAYER[(cy + dy) & 3][(cx + dx) & 3] + 0.5) / 16;
            if ((1 - d) * strength > threshold) px(ctx, cx + dx, cy + dy, color);
        }
    }
}

/**
 * Silhouette of hills or mountains: a height profile made of layered sine waves.
 * `jag` > 0 adds sharp random peaks.
 */
export function ridge(ctx, baseY, amp, color, seed, { freq = 0.02, jag = 0, w = W } = {}) {
    const r = rng(seed);
    const phases = [r() * 10, r() * 10, r() * 10];
    let spike = 0;
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
        if (jag && x % 6 === 0) spike = (r() - 0.5) * jag;
        const y = baseY
            - Math.sin(x * freq + phases[0]) * amp
            - Math.sin(x * freq * 2.3 + phases[1]) * amp * 0.45
            - Math.sin(x * freq * 5.1 + phases[2]) * amp * 0.15
            + spike;
        ctx.fillRect(x, Math.round(y), 1, H - Math.round(y));
    }
}

/** A puffy pixel cloud built from overlapping discs, with a darker underside. */
export function cloud(ctx, x, y, size, light, dark, seed) {
    const r = rng(seed);
    const puffs = [];
    const count = 5 + Math.floor(size / 3);
    for (let i = 0; i < count; i++) {
        const along = (i / (count - 1)) * 2 - 1;
        const pr = size * (0.5 + (1 - Math.abs(along)) * 0.55 + r() * 0.2);
        puffs.push([x + along * size * 2, y - (1 - Math.abs(along)) * size * 0.35 + r() * 2, pr]);
    }
    const floor = Math.round(y + size * 0.45);
    const draw = (color, grow, lift) => {
        ctx.fillStyle = color;
        for (const [cx, cy, pr] of puffs) {
            const rx = pr * 1.35 * grow;
            const ry = pr * 0.75 * grow;
            for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
                const yy = Math.round(cy + dy - lift);
                if (yy > floor - lift) continue;
                const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
                ctx.fillRect(Math.round(cx - half), yy, half * 2 + 1, 1);
            }
        }
    };
    draw(dark, 1, 0);
    draw(light, 0.92, 2);
}

/** Wrap a value into [0, span). */
export function wrap(v, span) {
    return ((v % span) + span) % span;
}
