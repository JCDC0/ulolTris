/**
 * cover-art.js - Pixel art for the music screens: a 32 x 32 cover for each built-in track,
 * a mark for the "Made with Claude" playlist, covers made from the artwork inside a
 * listener's own files (pixelated), and a generated cover for files that have none.
 *
 * Every function returns a fresh 32 x 32 canvas; the page scales it up with
 * `image-rendering: pixelated`, so the pixels stay square. All of the artwork here is drawn
 * from scratch with rectangles. The mark is a plain spark and is not the logo of any company.
 */

const SIZE = 32;

function canvas() {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    return { c, g };
}

const rect = (g, x, y, w, h, color, alpha = 1) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
};

const disc = (g, cx, cy, r, color, alpha = 1) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.4) g.fillRect(cx + x, cy + y, 1, 1);
    g.globalAlpha = 1;
};

/** A vertical gradient in flat bands, rows y0 up to y1. */
function bands(g, y0, y1, colors) {
    const h = (y1 - y0) / colors.length;
    colors.forEach((color, i) => rect(g, 0, Math.round(y0 + i * h), SIZE, Math.ceil(h) + 1, color));
}

/** A small deterministic random: the same seed always gives the same stream. */
function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** One painter per track, keyed by the `art` name in tracks.js. */
const PAINTERS = {
    // Rainy Window: rain on the glass, a warm lamp beyond it
    rain(g) {
        bands(g, 0, SIZE, ['#242d48', '#2d3859', '#37456a', '#42527a', '#4d5f86']);
        disc(g, 9, 24, 6, '#f3b36a', 0.32);
        disc(g, 9, 24, 3, '#ffd590', 0.5);
        const r = seeded(21);
        for (let i = 0; i < 26; i++) {
            const x = 2 + Math.floor(r() * 27), y = 2 + Math.floor(r() * 24);
            rect(g, x, y, 1, 3, '#b4cdee', 0.75);
            rect(g, x - 1, y + 3, 1, 1, '#b4cdee', 0.5);
        }
        for (const [x, y, w, h] of [[0, 0, 32, 2], [0, 30, 32, 2], [0, 0, 2, 32], [30, 0, 2, 32], [15, 0, 2, 32], [0, 15, 32, 2]]) rect(g, x, y, w, h, '#121628');
    },

    // Midnight Blue: a big moon over a sleeping town
    moon(g) {
        bands(g, 0, SIZE, ['#080c26', '#0e153a', '#16214f', '#202f66', '#2c3f7c']);
        const r = seeded(5);
        for (let i = 0; i < 16; i++) rect(g, Math.floor(r() * 32), Math.floor(r() * 18), 1, 1, '#dfe6ff', 0.4 + r() * 0.5);
        disc(g, 20, 11, 8, '#f6f1da');
        disc(g, 17, 9, 2, '#dcd5b8');
        disc(g, 23, 14, 2, '#e3dcc0');
        disc(g, 22, 8, 1, '#dcd5b8');
        let x = 0;
        while (x < SIZE) {
            const w = 3 + Math.floor(r() * 4), h = 5 + Math.floor(r() * 9);
            rect(g, x, SIZE - h, w, h, '#090d20');
            for (let wy = SIZE - h + 2; wy < SIZE - 1; wy += 3) if (r() < 0.5) rect(g, x + 1, wy, 1, 1, '#ffd36b');
            x += w;
        }
    },

    // Corner Cafe: a cup with steam on a warm table
    cup(g) {
        bands(g, 0, SIZE, ['#ecd8b4', '#e6cda4', '#dcbe94', '#ceab80', '#bd9870']);
        rect(g, 0, 25, SIZE, 7, '#8a5a36');
        rect(g, 0, 25, SIZE, 1, '#a9744a');
        rect(g, 6, 24, 20, 3, '#f7efe0');
        rect(g, 8, 27, 16, 1, '#c9b89a');
        rect(g, 9, 13, 14, 11, '#fffaf0');
        rect(g, 9, 13, 2, 11, '#efe4ce');
        rect(g, 21, 13, 2, 11, '#e2d5bb');
        rect(g, 11, 22, 10, 2, '#e2d5bb');
        rect(g, 10, 12, 12, 3, '#4e2c17');
        rect(g, 11, 12, 4, 1, '#7a4a2a');
        rect(g, 23, 15, 4, 2, '#fffaf0');
        rect(g, 26, 16, 2, 4, '#fffaf0');
        rect(g, 23, 20, 4, 2, '#fffaf0');
        for (const [x, dy] of [[12, 0], [16, 2], [20, 1]]) for (let y = 0; y < 9; y++) rect(g, x + (Math.floor((y + dy) / 2) % 2), 10 - y, 1, 1, '#ffffff', 0.55 - y * 0.05);
    },

    // Neon Circuit: a striped sun over a glowing grid
    sun(g) {
        bands(g, 0, 20, ['#1a0840', '#3a0f66', '#7a1a84', '#c02a8a', '#ff5a6a', '#ffa05a']);
        for (let y = 0; y < 13; y++) {
            const half = Math.floor(Math.sqrt(81 - (y - 12) * (y - 12)));
            const t = y / 13;
            if (y > 6 && y % 3 === 0) continue;
            rect(g, 16 - half, 7 + y, half * 2, 1, t < 0.5 ? '#ffe066' : t < 0.8 ? '#ff9a5a' : '#ff4f8a');
        }
        rect(g, 0, 20, SIZE, 12, '#14052a');
        rect(g, 0, 20, SIZE, 1, '#ff4fb4');
        for (const y of [22, 25, 29]) rect(g, 0, y, SIZE, 1, '#ff4fb4', 0.75);
        for (let i = -6; i <= 6; i++) for (let y = 21; y < 32; y++) rect(g, Math.round(16 + i * (y - 19) * 0.9), y, 1, 1, '#ff4fb4', 0.6);
    },

    // Pulse Driver: light beams over a dark floor
    beam(g) {
        bands(g, 0, SIZE, ['#080620', '#0d0a2e', '#14103e', '#1c1650', '#241c60']);
        const beams = [[6, '#3ff5d0'], [13, '#b06bff'], [19, '#3ff5d0'], [26, '#ff4fb4']];
        for (const [x0, color] of beams) for (let y = 0; y < 24; y++) rect(g, x0 - Math.floor(y / 6), y, 1 + Math.floor(y / 3), 1, color, 0.22 + y * 0.008);
        rect(g, 0, 24, SIZE, 8, '#0a0820');
        rect(g, 0, 24, SIZE, 1, '#ffffff', 0.4);
        for (const [x0, color] of beams) rect(g, x0 - 2, 25, 5, 1, color, 0.5);
        const r = seeded(9);
        for (let i = 0; i < 10; i++) rect(g, Math.floor(r() * 32), Math.floor(r() * 20), 1, 1, '#ffffff', 0.4 + r() * 0.4);
    },

    // Night Shift: a mirror ball
    disco(g) {
        bands(g, 0, SIZE, ['#1a0a3a', '#2a1252', '#3b1a6a', '#4c2282', '#5d2a9a']);
        rect(g, 16, 0, 1, 6, '#c9c9e0');
        const cx = 16, cy = 16, rad = 10;
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
            if (x * x + y * y > rad * rad) continue;
            const tile = ((x >> 1) + (y >> 1)) & 1;
            const light = 1 - (x + y + 2 * rad) / (4 * rad);
            const v = Math.round(110 + light * 120 + (tile ? 18 : -14));
            rect(g, cx + x, cy + y, 1, 1, `rgb(${v},${Math.min(255, v + 8)},${Math.min(255, v + 30)})`);
        }
        rect(g, 11, 11, 2, 2, '#ffffff');
        for (const [x, y] of [[4, 6], [27, 9], [6, 26], [28, 24], [24, 3]]) {
            rect(g, x - 1, y, 3, 1, '#ffffff');
            rect(g, x, y - 1, 1, 3, '#ffffff');
        }
    },

    // Redline: a pulse trace across a dark screen
    wave(g) {
        rect(g, 0, 0, SIZE, SIZE, '#120707');
        for (let y = 0; y < SIZE; y += 2) rect(g, 0, y, SIZE, 1, '#1c0a0a');
        for (let x = 0; x < SIZE; x++) {
            const a = Math.sin(x / 2.4) * 8 * (0.35 + 0.65 * Math.sin((x / SIZE) * Math.PI));
            const y = Math.round(16 + a);
            rect(g, x, y - 2, 1, 5, '#6a1a10', 0.6);
            rect(g, x, y - 1, 1, 3, '#ff5a36');
            rect(g, x, y, 1, 1, '#ffd2a0');
        }
        rect(g, 0, 27, SIZE, 1, '#d8281c');
        rect(g, 0, 29, 20, 1, '#d8281c', 0.6);
    },

    // Overclock: a star burst
    star(g) {
        bands(g, 0, SIZE, ['#050a26', '#0a1240', '#101c5c', '#0a1240', '#050a26']);
        const cx = 16, cy = 16;
        for (let k = 0; k < 8; k++) {
            const angle = (k * Math.PI) / 4;
            const len = k % 2 ? 9 : 15;
            for (let i = 2; i < len; i++) {
                const x = Math.round(cx + Math.cos(angle) * i), y = Math.round(cy + Math.sin(angle) * i);
                rect(g, x, y, 1, 1, i < len * 0.5 ? '#fff6c0' : '#7aa8ff', 1 - i / (len + 4));
                if (k % 2 === 0 && i < len * 0.6) rect(g, x + (k === 2 || k === 6 ? 1 : 0), y + (k === 0 || k === 4 ? 1 : 0), 1, 1, '#b8d0ff', 0.5);
            }
        }
        disc(g, cx, cy, 4, '#7aa8ff', 0.5);
        disc(g, cx, cy, 2, '#ffffff');
        const r = seeded(77);
        for (let i = 0; i < 12; i++) rect(g, Math.floor(r() * 32), Math.floor(r() * 32), 1, 1, '#9cb8ff', 0.5);
    },

    // Static Storm: a dark cloud and a bolt
    bolt(g) {
        bands(g, 0, SIZE, ['#141a28', '#1c2436', '#252f46', '#2f3a54', '#3a4664']);
        for (const [x, y, r] of [[6, 7, 6], [14, 5, 7], [23, 7, 6], [29, 10, 4], [3, 11, 4]]) disc(g, x, y, r, '#0d121d');
        for (const [x, y, r] of [[9, 9, 4], [18, 8, 5], [26, 9, 4]]) disc(g, x, y, r, '#19202f');
        const rows = [[12, 17, 20], [14, 15, 19], [16, 14, 18], [18, 12, 19], [20, 15, 20], [22, 14, 18], [24, 12, 16], [26, 11, 14], [28, 10, 12]];
        for (const [y, x0, x1] of rows) {
            rect(g, x0 - 1, y, x1 - x0 + 3, 2, '#ffb400', 0.5);
            rect(g, x0, y, x1 - x0 + 1, 2, '#ffe066');
            rect(g, x0 + 1, y, Math.max(1, x1 - x0 - 1), 2, '#ffffff');
        }
        const r = seeded(14);
        for (let i = 0; i < 14; i++) rect(g, Math.floor(r() * 32), 14 + Math.floor(r() * 18), 1, 2, '#7d93c4', 0.35);
    },
};

/** The kinds of cover art a built-in track can ask for. */
export const ART_KINDS = Object.keys(PAINTERS);

/**
 * The cover of a built-in track.
 * @param {string} kind - the track's `art` name
 * @returns {HTMLCanvasElement} 32 x 32
 */
export function coverArt(kind) {
    const { c, g } = canvas();
    (PAINTERS[kind] || PAINTERS.moon)(g);
    return c;
}

/**
 * The "Made with Claude" mark: a warm spark with long rays along the axes and short rays
 * between them, on a dark tile.
 * @returns {HTMLCanvasElement} 32 x 32
 */
export function sparkMark() {
    const { c, g } = canvas();
    rect(g, 0, 0, SIZE, SIZE, '#1b1310');
    rect(g, 1, 1, SIZE - 2, 1, '#3a2620');
    rect(g, 1, SIZE - 2, SIZE - 2, 1, '#3a2620');
    rect(g, 1, 1, 1, SIZE - 2, '#3a2620');
    rect(g, SIZE - 2, 1, 1, SIZE - 2, '#3a2620');
    const cx = 16, cy = 16;
    const color = i => (i < 3 ? '#ffd2b4' : i < 8 ? '#f08a64' : '#d8603e');
    for (let i = 2; i < 13; i++) {
        const w = i < 5 ? 3 : i < 9 ? 2 : 1;
        const off = Math.floor((w - 1) / 2);
        rect(g, cx - off, cy - i, w, 1, color(i));
        rect(g, cx - off, cy + i - 1, w, 1, color(i));
        rect(g, cx - i, cy - off, 1, w, color(i));
        rect(g, cx + i - 1, cy - off, 1, w, color(i));
    }
    for (let i = 3; i < 8; i++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        rect(g, cx + sx * i - (sx > 0 ? 1 : 0), cy + sy * i - (sy > 0 ? 1 : 0), 2, 2, i < 5 ? '#f3a27e' : '#d8603e');
    }
    rect(g, cx - 2, cy - 2, 4, 4, '#fff1e6');
    return c;
}

/**
 * A music note on a teal tile: the cover of the listener's own playlist.
 * @returns {HTMLCanvasElement} 32 x 32
 */
export function noteMark() {
    const { c, g } = canvas();
    bands(g, 0, SIZE, ['#0f3a44', '#134852', '#18565f', '#1d646c']);
    rect(g, 13, 7, 2, 15, '#eaffff');
    rect(g, 14, 6, 10, 3, '#eaffff');
    rect(g, 22, 8, 2, 11, '#eaffff');
    disc(g, 11, 22, 4, '#eaffff');
    disc(g, 20, 20, 4, '#eaffff');
    return c;
}

/**
 * A cover for a file with no artwork, made from its name: a mirrored 5 x 5 pattern, the
 * same every time.
 * @param {string} seed - usually the file name
 * @returns {HTMLCanvasElement} 32 x 32
 */
export function identicon(seed) {
    const h = hash(seed);
    const r = seeded(h);
    const hue = h % 360;
    const { c, g } = canvas();
    rect(g, 0, 0, SIZE, SIZE, `hsl(${hue} 35% 16%)`);
    const ink = `hsl(${(hue + 30) % 360} 70% 62%)`;
    const dim = `hsl(${(hue + 30) % 360} 60% 40%)`;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
        if (r() < 0.5) continue;
        const color = r() < 0.3 ? dim : ink;
        rect(g, 1 + x * 6, 1 + y * 6, 5, 5, color);
        rect(g, 1 + (4 - x) * 6, 1 + y * 6, 5, 5, color);
    }
    return c;
}

/**
 * Turn artwork from a listener's file into a pixel cover: crop to a square, shrink to 32 x 32,
 * and cut it down to a few levels per color with an ordered dither, like an old console.
 * @param {CanvasImageSource} image - a decoded image or bitmap
 * @param {number} [levels] - color levels per channel (5 gives 125 colors)
 * @returns {HTMLCanvasElement} 32 x 32
 */
export function pixelate(image, levels = 5) {
    const { c, g } = canvas();
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    const side = Math.min(w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
    g.imageSmoothingEnabled = false;
    const pixels = g.getImageData(0, 0, SIZE, SIZE);
    const d = pixels.data;
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const step = 255 / (levels - 1);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const nudge = (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.47) * step * 0.7;
        const i = (y * SIZE + x) * 4;
        for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] + nudge) / step) * step));
        d[i + 3] = 255;
    }
    g.putImageData(pixels, 0, 0);
    return c;
}
