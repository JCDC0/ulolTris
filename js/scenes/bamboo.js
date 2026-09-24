/**
 * bamboo.js - Misty bamboo forest in the rain (Casual).
 */

import { W, H, rng, layer, rect, px, ditherGradient, hazeBand, wrap } from './pixel.js';

function stalk(ctx, r, x, w, colors) {
    const top = -2;
    rect(ctx, x, top, w, H, colors.body);
    if (w >= 3) rect(ctx, x, top, 1, H, colors.light);
    if (w >= 6) rect(ctx, x + w - 1, top, 1, H, colors.dark);
    let y = 6 + r() * 14;
    while (y < H) {
        rect(ctx, x - 1, y, w + 2, 1, colors.node);
        if (w >= 5) rect(ctx, x, y + 1, w, 1, colors.light);
        y += 14 + r() * 10;
    }
}

function leafCluster(ctx, r, x, y, color, tip, count, scale) {
    for (let i = 0; i < count; i++) {
        const dir = r() < 0.5 ? -1 : 1;
        const len = Math.round((5 + r() * 6) * scale);
        const droop = 0.35 + r() * 0.35;
        const oy = y + r() * 6;
        for (let k = 0; k < len; k++) {
            const lx = x + dir * k;
            const ly = oy + k * droop;
            px(ctx, lx, ly, k === len - 1 ? tip : color);
            if (k > 1 && k < len - 2 && scale > 1) px(ctx, lx, ly + 1, color);
        }
    }
}

function forestLayer(seed, count, widths, colors, leafColors, leafScale) {
    const { canvas, ctx } = layer();
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
        const x = Math.round((i + r() * 0.8) * (W / count));
        const w = widths[0] + Math.floor(r() * (widths[1] - widths[0] + 1));
        stalk(ctx, r, x, w, colors);
        let y = 10 + r() * 30;
        while (y < H - 30) {
            leafCluster(ctx, r, x + (r() < 0.5 ? 0 : w), y, leafColors[0], leafColors[1], 2 + Math.floor(r() * 3), leafScale);
            y += 22 + r() * 30;
        }
    }
    return canvas;
}

function mistLayer(y0, y1, color, alpha, density) {
    const { canvas, ctx } = layer();
    hazeBand(ctx, y0, y1, color, alpha, density);
    return canvas;
}

export default {
    id: 'bamboo',
    name: 'Bamboo Rain',
    create() {
        const sky = layer();
        ditherGradient(sky.ctx, 0, 0, W, H, ['#132226', '#1b302f', '#26413a', '#355848', '#4a7058']);

        const far = forestLayer(11, 26, [2, 2],
            { body: '#557d63', light: '#63907a', dark: '#4a6f57', node: '#46694f' }, ['#5f8a6c', '#79a283'], 1);
        const mistFar = mistLayer(60, 170, '#96bea8', 0.35, 1);
        const mid = forestLayer(23, 14, [3, 4],
            { body: '#2f5a37', light: '#4b7f4d', dark: '#244a2b', node: '#1f3f25' }, ['#3d7440', '#63a058'], 1.5);
        const mistNear = mistLayer(120, 200, '#78a08c', 0.28, 0.9);
        const near = forestLayer(37, 5, [7, 9],
            { body: '#14291a', light: '#23422a', dark: '#0d1d11', node: '#0a170d' }, ['#18351e', '#2a5230'], 2.2);

        const ground = layer();
        rect(ground.ctx, 0, H - 8, W, 8, '#0c170f');
        const gr = rng(5);
        for (let x = 0; x < W; x += 2) {
            const h = 1 + Math.floor(gr() * 4);
            rect(ground.ctx, x, H - 8 - h, 1, h, gr() < 0.5 ? '#16301c' : '#1f3d24');
        }

        const r = rng(99);
        const drops = Array.from({ length: 190 }, () => ({
            x: r() * (W + 60), y: r() * H, speed: 110 + r() * 70, len: 3 + Math.floor(r() * 4),
            color: r() < 0.3 ? 'rgba(220, 240, 245, 0.55)' : 'rgba(170, 210, 220, 0.35)',
        }));
        const leaves = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H, speed: 6 + r() * 6, phase: r() * 6 }));

        return {
            draw(ctx, t) {
                ctx.drawImage(sky.canvas, 0, 0);
                ctx.drawImage(far, 0, 0);
                ctx.drawImage(mistFar, Math.round(Math.sin(t * 0.05) * 6), 0);
                ctx.drawImage(mid, 0, 0);

                for (const l of leaves) {
                    const y = wrap(l.y + t * l.speed, H + 10) - 5;
                    const x = wrap(l.x + Math.sin(t * 0.8 + l.phase) * 10 - t * 2, W);
                    rect(ctx, x, y, 2, 1, '#7fb068');
                    px(ctx, x + (Math.sin(t * 3 + l.phase) > 0 ? 2 : -1), y + 1, '#5e9150');
                }

                ctx.drawImage(mistNear, Math.round(Math.sin(t * 0.08 + 1) * 10), 0);
                ctx.drawImage(near, 0, 0);
                ctx.drawImage(ground.canvas, 0, 0);

                for (const d of drops) {
                    const y = wrap(d.y + t * d.speed, H + 10) - 5;
                    const x = wrap(d.x - y * 0.25 - t * 4, W + 60) - 30;
                    ctx.fillStyle = d.color;
                    for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x + k * 0.25), Math.round(y - k), 1, 1);
                }

                // Splashes on the ground
                const sr = rng(Math.floor(t * 12));
                for (let i = 0; i < 10; i++) {
                    const sx = Math.floor(sr() * W);
                    px(ctx, sx - 1, H - 9, 'rgba(200, 230, 235, 0.6)');
                    px(ctx, sx + 1, H - 9, 'rgba(200, 230, 235, 0.6)');
                    px(ctx, sx, H - 10, 'rgba(200, 230, 235, 0.4)');
                }
            },
        };
    },
};
