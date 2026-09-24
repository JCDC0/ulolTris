/**
 * skins.js - Block skins. Each skin paints one block into a small canvas, and
 * blockSprite() caches the result per skin, color and size, so drawing a block is
 * one drawImage call.
 *
 * All skins are original. "classic" follows the beveled look of Jstris-style
 * games and "glossy" the rounded, shiny look of Puyo Puyo Tetris, without using
 * their art.
 */

export const SKINS = ['ulol', 'classic', 'glossy', 'flat', 'neon'];

const SKIN_LABELS = {
    ulol: 'uloltris (pixel bevel)',
    classic: 'Classic (Jstris-style bevel)',
    glossy: 'Glossy (PPT-style)',
    flat: 'Flat',
    neon: 'Neon outline',
};

export function describeSkin(val) {
    return SKIN_LABELS[val] || val;
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a color toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    const t = amount > 0 ? 255 : 0;
    const k = Math.abs(amount);
    const mix = c => Math.round(c + (t - c) * k);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const PAINTERS = {
    /** Pixel bevel with an inset square, sized in whole pixels so it stays crisp. */
    ulol(ctx, s, color) {
        const b = Math.max(2, Math.round(s / 10));
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = shade(color, 0.35);
        ctx.fillRect(0, 0, s, b);
        ctx.fillStyle = shade(color, 0.2);
        ctx.fillRect(0, b, b, s - b);
        ctx.fillStyle = shade(color, -0.35);
        ctx.fillRect(0, s - b, s, b);
        ctx.fillStyle = shade(color, -0.2);
        ctx.fillRect(s - b, 0, b, s - b);
        const inset = Math.round(s * 0.27);
        const w = Math.max(1, Math.round(s / 15));
        ctx.strokeStyle = shade(color, 0.22);
        ctx.lineWidth = w;
        ctx.strokeRect(inset + w / 2, inset + w / 2, s - inset * 2 - w, s - inset * 2 - w);
    },

    /** Thick 3D bevel: light top-left triangle, dark bottom-right, flat face. */
    classic(ctx, s, color) {
        const b = Math.round(s * 0.18);
        ctx.fillStyle = shade(color, 0.45);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(s, 0); ctx.lineTo(0, s);
        ctx.fill();
        ctx.fillStyle = shade(color, -0.45);
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(s, s); ctx.lineTo(0, s);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(b, b, s - b * 2, s - b * 2);
    },

    /** Rounded candy block with a vertical gradient and a specular highlight. */
    glossy(ctx, s, color) {
        const r = s * 0.22;
        const pad = Math.max(1, s * 0.03);
        const path = () => {
            ctx.beginPath();
            ctx.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
        };
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, shade(color, 0.3));
        g.addColorStop(0.55, color);
        g.addColorStop(1, shade(color, -0.35));
        path();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.strokeStyle = shade(color, -0.5);
        ctx.stroke();
        const hl = ctx.createLinearGradient(0, pad, 0, s * 0.5);
        hl.addColorStop(0, 'rgba(255,255,255,0.75)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.ellipse(s * 0.5, s * 0.3, s * 0.32, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = hl;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(s * 0.3, s * 0.27, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
    },

    flat(ctx, s, color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, s - Math.max(1, s / 15), s, Math.max(1, s / 15));
    },

    neon(ctx, s, color) {
        const w = Math.max(2, Math.round(s / 10));
        ctx.fillStyle = shade(color, -0.75);
        ctx.fillRect(0, 0, s, s);
        ctx.shadowColor = color;
        ctx.shadowBlur = s / 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.strokeRect(w, w, s - w * 2, s - w * 2);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = shade(color, 0.6);
        ctx.lineWidth = 1;
        ctx.strokeRect(w + 0.5, w + 0.5, s - w * 2 - 1, s - w * 2 - 1);
    },
};

const cache = new Map();

/**
 * A cached canvas with one block painted in the given skin.
 */
export function blockSprite(skin, color, size) {
    const key = `${skin}|${color}|${size}`;
    let sprite = cache.get(key);
    if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = size;
        sprite.height = size;
        (PAINTERS[skin] || PAINTERS.ulol)(sprite.getContext('2d'), size, color);
        cache.set(key, sprite);
    }
    return sprite;
}
