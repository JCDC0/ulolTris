/**
 * storm.js - Thunder Peak: jagged snowy mountains under racing storm clouds, heavy
 * rain and lightning (Blitz). Two minutes of pressure.
 */

import { W, H, rng, layer, rect, px, ditherGradient, cloud, wrap } from './pixel.js';

const FLASH_EVERY = 3.4;

/**
 * A mountain range from individual peaks of varied height and slope. Each column takes
 * the highest peak slope above it, with small jitter, and snow near each summit.
 * Returns the top y of every column.
 */
function peaks(ctx, seed, baseY, amp, color, snow) {
    const r = rng(seed);
    const list = [];
    for (let x = -30; x < W + 30; x += 22 + r() * 34) {
        list.push({ x, top: baseY - amp * (0.35 + r() * 0.65), slope: 0.7 + r() * 0.8 });
    }
    const tops = [];
    let jitter = 0;
    for (let x = 0; x < W; x++) {
        if (x % 3 === 0) jitter = Math.round((r() - 0.5) * 2);
        let y = baseY;
        let peak = null;
        for (const p of list) {
            const py = p.top + Math.abs(x - p.x) * p.slope;
            if (py < y) { y = py; peak = p; }
        }
        y = Math.round(y + jitter);
        tops.push(y);
        rect(ctx, x, y, 1, H - y, color);
        if (snow && peak) {
            const depth = Math.round(6 - (y - peak.top) * 0.6 + (r() < 0.3 ? 1 : 0));
            if (depth > 0 && peak.top < baseY - amp * 0.5) rect(ctx, x, y, 1, depth, snow);
        }
    }
    return tops;
}

function bolt(ctx, seed, groundY) {
    const r = rng(seed);
    let x = 40 + r() * 240;
    let y = 0;
    const paths = [];
    while (y < groundY) {
        const nx = x + (r() - 0.5) * 12;
        const ny = y + 4 + r() * 8;
        paths.push([x, y, nx, ny]);
        if (r() < 0.18) {
            let bx = nx, by = ny;
            const dir = r() < 0.5 ? -1 : 1;
            for (let k = 0; k < 4; k++) {
                const ex = bx + dir * (3 + r() * 6), ey = by + 3 + r() * 5;
                paths.push([bx, by, ex, ey, true]);
                bx = ex; by = ey;
            }
        }
        x = nx; y = ny;
    }
    for (const [x0, y0, x1, y1, branch] of paths) {
        const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
        for (let i = 0; i <= steps; i++) {
            const px0 = x0 + (x1 - x0) * (i / steps);
            const py0 = y0 + (y1 - y0) * (i / steps);
            if (!branch) px(ctx, px0 - 1, py0, '#7fa8ff');
            px(ctx, px0, py0, branch ? '#b8d0ff' : '#ffffff');
        }
    }
}

export default {
    id: 'storm',
    name: 'Thunder Peak',
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, H, ['#06080e', '#0b0f19', '#121827', '#1a2234', '#232d42']);

        const cloudsFar = layer(W * 2, 80);
        const cloudsNear = layer(W * 2, 70);
        const cr = rng(33);
        for (let i = 0; i < 14; i++) cloud(cloudsFar.ctx, cr() * W * 2, 10 + cr() * 50, 7 + cr() * 8, '#1f2638', '#161b29', 700 + i);
        for (let i = 0; i < 10; i++) cloud(cloudsNear.ctx, cr() * W * 2, 4 + cr() * 30, 9 + cr() * 9, '#2a3246', '#1c2231', 800 + i);

        const far = layer();
        peaks(far.ctx, 2, 128, 46, '#161c2b', '#7c889f');
        const lit = layer();
        peaks(lit.ctx, 2, 128, 46, '#39456a', '#dfe6f5');
        const near = layer();
        const nearTop = peaks(near.ctx, 9, 162, 38, '#0a0d15', '#3a4458');

        const r = rng(5);
        const drops = Array.from({ length: 260 }, () => ({
            x: r() * (W + 80), y: r() * H, speed: 230 + r() * 120, len: 4 + Math.floor(r() * 5),
        }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                const fx = Math.round(wrap(t * 9, W * 2));
                ctx.drawImage(cloudsFar.canvas, -fx, 0);
                ctx.drawImage(cloudsFar.canvas, W * 2 - fx, 0);

                const n = Math.floor(t / FLASH_EVERY);
                const local = t - n * FLASH_EVERY;
                const offset = rng(n)() * 1.2;
                const since = local - offset;
                const flash = since >= 0 && since < 0.45 ? (1 - since / 0.45) * (Math.sin(since * 60) > -0.3 ? 1 : 0.4) : 0;

                ctx.drawImage(far.canvas, 0, 0);
                if (flash > 0) {
                    ctx.globalAlpha = flash * 0.8;
                    ctx.drawImage(lit.canvas, 0, 0);
                    ctx.globalAlpha = 1;
                    if (since < 0.25) bolt(ctx, n * 7 + 1, nearTop[160] - 20);
                }

                const nx = Math.round(wrap(t * 16, W * 2));
                ctx.drawImage(cloudsNear.canvas, -nx, 0);
                ctx.drawImage(cloudsNear.canvas, W * 2 - nx, 0);
                ctx.drawImage(near.canvas, 0, 0);

                ctx.fillStyle = 'rgba(160, 182, 214, 0.42)';
                for (const d of drops) {
                    const y = wrap(d.y + t * d.speed, H + 10) - 5;
                    const x = wrap(d.x - y * 0.45 - t * 30, W + 80) - 40;
                    for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x + k * 0.45), Math.round(y - k), 1, 1);
                }

                if (flash > 0) {
                    ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.3})`;
                    ctx.fillRect(0, 0, W, H);
                }
            },
        };
    },
};
