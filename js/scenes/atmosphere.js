/**
 * atmosphere.js - Weather and time of day for every scene.
 *
 * Each scene is drawn once in daylight colors. A variant (sunny, cloudy, sunset, rain,
 * thunderstorm, night, night thunderstorm) then changes it in four ways:
 * - the sky is drawn by makeSky(): its gradient, sun or moon, stars and clouds;
 * - grade() shifts the colors of the scene's layers (desaturate, darken, tint), and
 *   c() does the same for single colors the scene draws every frame;
 * - lit says how dark it is (0 day, 1 night). Scenes draw their own lights
 *   (windows, lamps, torches) with it, and they are not graded;
 * - overlay() draws the weather in front of the scene: rain or snow, splashes, fog
 *   and the flash of lightning. poll() reports each strike so that the thunder
 *   sound can follow the flash.
 *
 * ambienceFor() turns a scene and a variant into the list of sounds to play.
 */

import { W, H, rng, layer, rect, px, ditherGradient, disc, glow, cloud, hazeBand, parseColor, wrap } from './pixel.js';

export const VARIANTS = ['sunny', 'cloudy', 'sunset', 'rain', 'thunder', 'night', 'nightthunder'];

/** The order Casual walks through when the weather setting is "cycle": a day's weather. */
export const CYCLE_ORDER = ['sunny', 'cloudy', 'rain', 'thunder', 'sunset', 'night', 'nightthunder'];

/**
 * @typedef {Object} Variant
 * @property {string} name
 * @property {string[]} sky - gradient stops from the top of the sky down to the horizon
 * @property {number} lit - 0 (day) to 1 (night): how many lights are on
 * @property {number} stars - 0 to 1
 * @property {number} rain - 0 (none) to 1
 * @property {boolean} storm - lightning and thunder
 * @property {number} wind - 0 to 1.5, how hard it blows
 * @property {Object} grade - { sat, bright, mul: [r, g, b], tint: [r, g, b], mix }
 * @property {Object} clouds - { far, near } each { count, size: [min, max], light, dark, y: [min, max], speed }
 * @property {?Object} fog - { color, alpha, density }
 */

/** @type {Object<string, Variant>} */
export const VARIANT_INFO = {
    sunny: {
        name: 'Sunny',
        sky: ['#2f7fd0', '#4a97dc', '#6cb0e6', '#93c8ee', '#bfe0f4', '#e2f2f8'],
        lit: 0, stars: 0, rain: 0, storm: false, wind: 0.3,
        grade: { sat: 1.04, bright: 1, mul: [1, 1, 1], tint: [255, 240, 200], mix: 0.03 },
        clouds: {
            far: { count: 4, size: [3, 6], light: '#ffffff', dark: '#d5e6f4', y: [40, 100], speed: 1.2 },
            near: { count: 5, size: [5, 10], light: '#ffffff', dark: '#c8dff2', y: [14, 80], speed: 2.5 },
        },
        fog: null,
    },
    cloudy: {
        name: 'Cloudy',
        sky: ['#76889e', '#8797ab', '#9aa9b9', '#adb9c6', '#c0cad3', '#d2d9de'],
        lit: 0.1, stars: 0, rain: 0, storm: false, wind: 0.5,
        grade: { sat: 0.72, bright: 0.9, mul: [0.97, 1, 1.03], tint: [160, 172, 190], mix: 0.08 },
        clouds: {
            far: { count: 9, size: [8, 14], light: '#dfe4e8', dark: '#b3bdc7', y: [4, 75], speed: 3 },
            near: { count: 8, size: [10, 18], light: '#c9d0d6', dark: '#94a0ad', y: [8, 90], speed: 5 },
        },
        fog: { color: '#c8d0d8', alpha: 0.22, density: 0.6 },
    },
    sunset: {
        name: 'Sunset',
        sky: ['#2a1b40', '#4e2a5a', '#8c3b5f', '#cc5d5b', '#ec935d', '#f7c374'],
        lit: 0.55, stars: 0.15, rain: 0, storm: false, wind: 0.3,
        grade: { sat: 1.05, bright: 0.84, mul: [1.08, 0.86, 0.74], tint: [255, 130, 70], mix: 0.1 },
        clouds: {
            far: { count: 5, size: [3, 6], light: '#e0a0a0', dark: '#a86a80', y: [40, 100], speed: 1.2 },
            near: { count: 8, size: [5, 10], light: '#f8bf9c', dark: '#c97c80', y: [12, 80], speed: 2.5 },
        },
        fog: { color: '#f0a070', alpha: 0.25, density: 0.7 },
    },
    rain: {
        name: 'Cloudy (Rain)',
        sky: ['#3d4856', '#4a5664', '#5a6673', '#6b7783', '#7d8892', '#8f9aa3'],
        lit: 0.25, stars: 0, rain: 0.55, storm: false, wind: 0.6,
        grade: { sat: 0.55, bright: 0.72, mul: [0.92, 0.98, 1.05], tint: [130, 150, 175], mix: 0.14 },
        clouds: {
            far: { count: 12, size: [10, 18], light: '#8b96a1', dark: '#66717d', y: [0, 60], speed: 4 },
            near: { count: 12, size: [12, 20], light: '#727d89', dark: '#4d5762', y: [0, 70], speed: 7 },
        },
        fog: { color: '#a9b7c2', alpha: 0.32, density: 0.85 },
    },
    thunder: {
        name: 'Thunderstorm',
        sky: ['#1a202c', '#252d3b', '#323b4a', '#414b5a', '#535d6b', '#667080'],
        lit: 0.45, stars: 0, rain: 1, storm: true, wind: 1.4,
        grade: { sat: 0.42, bright: 0.5, mul: [0.9, 0.96, 1.08], tint: [90, 110, 145], mix: 0.18 },
        clouds: {
            far: { count: 14, size: [10, 18], light: '#3c4554', dark: '#262d3a', y: [0, 60], speed: 6 },
            near: { count: 12, size: [12, 22], light: '#2b3240', dark: '#1b202b', y: [0, 70], speed: 12 },
        },
        fog: { color: '#6c7886', alpha: 0.36, density: 0.9 },
    },
    night: {
        name: 'Night',
        sky: ['#050818', '#0a1030', '#101a44', '#182658', '#22336a', '#2e4078'],
        lit: 1, stars: 1, rain: 0, storm: false, wind: 0.3,
        grade: { sat: 0.55, bright: 0.34, mul: [0.62, 0.74, 1.18], tint: [40, 60, 120], mix: 0.12 },
        clouds: {
            far: null,
            near: { count: 6, size: [5, 10], light: '#3a4a7e', dark: '#232e5a', y: [14, 80], speed: 2 },
        },
        fog: { color: '#3a4a7a', alpha: 0.25, density: 0.7 },
    },
    nightthunder: {
        name: 'Night Thunderstorm',
        sky: ['#04050c', '#080b16', '#0d121f', '#141a28', '#1c2333', '#262e40'],
        lit: 1, stars: 0, rain: 1, storm: true, wind: 1.4,
        grade: { sat: 0.4, bright: 0.24, mul: [0.65, 0.75, 1.15], tint: [30, 45, 90], mix: 0.14 },
        clouds: {
            far: { count: 12, size: [10, 18], light: '#20263a', dark: '#131722', y: [0, 60], speed: 6 },
            near: { count: 10, size: [12, 20], light: '#171b28', dark: '#0d0f17', y: [0, 70], speed: 12 },
        },
        fog: { color: '#2a3348', alpha: 0.3, density: 0.8 },
    },
};

/** Seconds between lightning strikes, on average, in the two stormy variants. */
const STRIKE_PERIOD = { thunder: 6.5, nightthunder: 5.5 };
const FLASH_S = 0.5;

/** Menu and settings text for a weather setting value. */
export function describeWeather(id) {
    if (id === 'default') return 'Scene default';
    if (id === 'cycle') return 'Cycle by level';
    return VARIANT_INFO[id]?.name || id;
}

/** The variant Casual shows at a level when the weather setting is "cycle". */
export function cycleVariant(level) {
    return CYCLE_ORDER[(Math.max(1, level) - 1) % CYCLE_ORDER.length];
}

/**
 * The sounds a scene plays in a variant. Weather adds rain, wind and thunder; animals
 * follow the time of day and go quiet in the wet.
 * @param {Object} scene - a scene module: `sounds` ({ always, day, night }) and `precip`
 * @param {string} variantId
 * @returns {Object<string, number>} layer name to level (0..1), for ambience.setScene()
 */
export function ambienceFor(scene, variantId) {
    const v = VARIANT_INFO[variantId];
    const s = scene.sounds || {};
    const out = { ...s.always };
    const wet = v.rain > 0;
    const hush = v.storm ? 0 : wet ? 0.25 : 1;
    for (const [name, level] of Object.entries((v.lit >= 0.7 ? s.night : s.day) || {})) {
        if (level * hush > 0) out[name] = Math.max(out[name] || 0, level * hush);
    }
    if (wet && scene.precip !== 'snow') out[v.storm ? 'storm' : 'rain'] = v.storm ? 1 : 0.9;
    if (v.storm) {
        // Heavy gusts with a faint howl blow past between the claps
        out.thunder = 1;
        out.gale = 0.4;
    }
    const wind = Math.min(1, (out.wind || 0) + v.wind * (v.storm ? 0.2 : 0.5));
    if (wind > 0.05) out.wind = wind;
    if (out.wheat) out.wheat *= 0.55 + 0.45 * Math.min(1, v.wind);
    return out;
}

/** Color grading math for one variant. Returns null when it would change nothing. */
function makeGrade({ sat, bright, mul, tint, mix }) {
    if (sat === 1 && bright === 1 && mix === 0 && mul.every(m => m === 1)) return null;
    return (r, g, b) => {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const out = [r, g, b];
        for (let i = 0; i < 3; i++) {
            let v = lum + (out[i] - lum) * sat;
            v += (tint[i] - v) * mix;
            out[i] = Math.max(0, Math.min(255, Math.round(v * mul[i] * bright)));
        }
        return out;
    };
}

/** A lightning bolt from the top of the sky down to y, with branches. */
function drawBolt(ctx, seed, x0, groundY, color) {
    const r = rng(seed);
    let x = x0;
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
    for (const [x0p, y0p, x1p, y1p, branch] of paths) {
        const steps = Math.ceil(Math.max(Math.abs(x1p - x0p), Math.abs(y1p - y0p)));
        for (let i = 0; i <= steps; i++) {
            const bx = x0p + (x1p - x0p) * (i / steps);
            const by = y0p + (y1p - y0p) * (i / steps);
            if (!branch) px(ctx, bx - 1, by, '#7fa8ff');
            px(ctx, bx, by, branch ? '#b8d0ff' : color);
        }
    }
}

/**
 * Create the weather for one scene in one variant.
 * @param {string} variantId - one of VARIANTS
 * @param {Object} [meta] - the scene's own facts:
 *   horizon (where the sky meets the land), celestial ({ sunX, sunHighY, sunLowY,
 *   moonX, moonY }), fog ([y0, y1] band for mist), rainBand ([y0, y1] where drops
 *   splash), precip ('rain' or 'snow')
 */
export function createEnv(variantId, meta = {}) {
    const info = VARIANT_INFO[variantId];
    const horizon = meta.horizon ?? 118;
    const cel = { sunX: 232, sunHighY: 34, sunLowY: horizon - 18, moonX: 70, moonY: 34, ...meta.celestial };
    const gradeFn = makeGrade(info.grade);
    const colors = new Map();
    const period = STRIKE_PERIOD[variantId] || 0;
    const snow = meta.precip === 'snow';

    /** Lightning strike n: when, how far away, and where the bolt falls. */
    function strike(n) {
        const r = rng(n * 7919 + 13);
        return { time: n * period + r() * period * 0.7, distance: 0.08 + r() * 0.75, seed: n * 7 + 1, x: 30 + r() * 260 };
    }

    /** The brightest flash at time t, and the strike that is still drawing its bolt. */
    function flashAt(t) {
        if (!period) return { flash: 0, bolt: null };
        let flash = 0;
        let bolt = null;
        const n = Math.floor(t / period);
        for (const k of [n - 1, n]) {
            const s = strike(k);
            const since = t - s.time;
            if (since < 0 || since >= FLASH_S) continue;
            const f = (1 - since / FLASH_S) * (Math.sin(since * 60) > -0.3 ? 1 : 0.4) * (1 - s.distance * 0.6);
            if (f > flash) flash = f;
            if (since < 0.25 && s.distance < 0.6) bolt = s;
        }
        return { flash, bolt };
    }

    const env = {
        id: variantId,
        info,
        meta,
        lit: info.lit,
        rain: info.rain,
        storm: info.storm,
        wind: info.wind,
        night: info.lit >= 0.7,
        /** Where the sun or moon is: { x, y, kind: 'sun' | 'moon' | null }. Set by makeSky(). */
        sun: { x: cel.sunX, y: cel.sunHighY, kind: null },

        /** Grade RGBA pixel data in place (ImageData.data) and return it. */
        gradeData(d) {
            if (!gradeFn) return d;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] === 0) continue;
                const [r, g, b] = gradeFn(d[i], d[i + 1], d[i + 2]);
                d[i] = r; d[i + 1] = g; d[i + 2] = b;
            }
            return d;
        },

        /** Grade a layer's canvas in place and return it. */
        grade(canvas) {
            if (!gradeFn) return canvas;
            const ctx = canvas.getContext('2d');
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            env.gradeData(img.data);
            ctx.putImageData(img, 0, 0);
            return canvas;
        },

        /** A '#rrggbb' color as graded [r, g, b], for things drawn every frame. */
        rgb(hex) {
            const c = parseColor(hex);
            return gradeFn ? gradeFn(c[0], c[1], c[2]) : c;
        },

        /** A '#rrggbb' color graded, as a CSS rgba() string with the given alpha. */
        rgba(hex, alpha) {
            const [r, g, b] = env.rgb(hex);
            return `rgba(${r},${g},${b},${alpha})`;
        },

        /** A '#rrggbb' color graded, as a CSS string. */
        c(hex) {
            let v = colors.get(hex);
            if (!v) {
                const [r, g, b] = env.rgb(hex);
                v = `rgb(${r},${g},${b})`;
                colors.set(hex, v);
            }
            return v;
        },

        /**
         * The sky: gradient, sun or moon, stars, clouds and lightning.
         * @param {Object} [o] - { horizon, palette, noSun }
         * @returns {{ canvas: HTMLCanvasElement, draw: (ctx, t) => void }} `canvas` is the
         *   still sky (no clouds), which reflections can copy.
         */
        makeSky(o = {}) {
            const hor = o.horizon ?? horizon;
            const still = layer();
            const s = still.ctx;
            ditherGradient(s, 0, 0, W, hor + 4, o.palette || info.sky);

            if (!o.noSun) {
                if (variantId === 'sunny') {
                    env.sun = { x: cel.sunX, y: cel.sunHighY, kind: 'sun' };
                    glow(s, cel.sunX, cel.sunHighY, 38, '#f4fbff', 0.5);
                    disc(s, cel.sunX, cel.sunHighY, 11, '#fffbe0');
                    disc(s, cel.sunX, cel.sunHighY, 9, '#ffffff');
                } else if (variantId === 'sunset') {
                    env.sun = { x: cel.sunX, y: cel.sunLowY, kind: 'sun' };
                    glow(s, cel.sunX, cel.sunLowY, 48, '#f5a36d', 0.55);
                    disc(s, cel.sunX, cel.sunLowY, 15, '#f7b070');
                    disc(s, cel.sunX, cel.sunLowY, 12, '#ffd79a');
                } else if (variantId === 'cloudy') {
                    glow(s, cel.sunX, cel.sunHighY + 10, 42, '#f4f6f8', 0.4);
                } else if (variantId === 'night') {
                    env.sun = { x: cel.moonX, y: cel.moonY, kind: 'moon' };
                    glow(s, cel.moonX, cel.moonY, 28, '#2a3a70', 0.7);
                    disc(s, cel.moonX, cel.moonY, 11, '#f2ecd0');
                    px(s, cel.moonX - 4, cel.moonY - 3, '#d9d0ac');
                    rect(s, cel.moonX + 2, cel.moonY + 1, 2, 2, '#d9d0ac');
                    px(s, cel.moonX + 5, cel.moonY - 5, '#d9d0ac');
                    rect(s, cel.moonX - 5, cel.moonY + 3, 2, 1, '#d9d0ac');
                } else if (variantId === 'nightthunder') {
                    glow(s, cel.moonX, cel.moonY, 30, '#2c3446', 0.4);
                }
            }
            const haze = variantId === 'sunny' ? '#e2f2f8' : info.sky[info.sky.length - 1];
            hazeBand(s, hor - 22, hor + 4, haze, 0.45, 0.9);

            const rs = rng(4321);
            const stars = info.stars > 0
                ? Array.from({ length: Math.round(80 * info.stars) }, () => ({ x: Math.floor(rs() * W), y: Math.floor(rs() * hor * 0.8), p: rs() * 10, big: rs() < 0.1 }))
                : [];

            const strips = [];
            for (const spec of [info.clouds.far, info.clouds.near]) {
                if (!spec) continue;
                const strip = layer(W * 2, hor);
                const cr = rng(spec.count * 131 + spec.size[1]);
                for (let i = 0; i < spec.count; i++) {
                    const y = Math.min(hor - 12, spec.y[0] + cr() * (spec.y[1] - spec.y[0]));
                    cloud(strip.ctx, cr() * W * 2, y, spec.size[0] + cr() * (spec.size[1] - spec.size[0]), spec.light, spec.dark, 700 + i * 13);
                }
                strips.push({ canvas: strip.canvas, speed: spec.speed });
            }

            return {
                canvas: still.canvas,
                draw(ctx, t) {
                    ctx.drawImage(still.canvas, 0, 0);
                    for (const st of stars) {
                        const tw = Math.sin(t * 1.5 + st.p);
                        if (tw < -0.4) continue;
                        px(ctx, st.x, st.y, tw > 0.6 ? '#ffffff' : '#8f9fe0');
                        if (st.big && tw > 0.5) {
                            px(ctx, st.x - 1, st.y, '#6f7fc0'); px(ctx, st.x + 1, st.y, '#6f7fc0');
                            px(ctx, st.x, st.y - 1, '#6f7fc0'); px(ctx, st.x, st.y + 1, '#6f7fc0');
                        }
                    }
                    const { flash, bolt } = flashAt(t);
                    strips.forEach((st, i) => {
                        // Draw the bolt between the far and near clouds, so the near ones hide its top
                        if (i === strips.length - 1 && bolt) drawBolt(ctx, bolt.seed, bolt.x, hor - 6, '#ffffff');
                        const x = Math.round(wrap(t * st.speed, W * 2));
                        ctx.drawImage(st.canvas, -x, 0);
                        ctx.drawImage(st.canvas, W * 2 - x, 0);
                    });
                    if (flash > 0) {
                        ctx.fillStyle = `rgba(210, 225, 255, ${flash * 0.4})`;
                        ctx.fillRect(0, 0, W, hor + 4);
                    }
                },
            };
        },

        /**
         * Report lightning strikes that have just happened.
         * @param {number} t - scene time in seconds
         * @param {(strike: { distance: number }) => void} fire
         */
        poll(t, fire) {
            if (!period) return;
            const n = Math.floor(t / period);
            for (const k of [n - 1, n]) {
                if (k <= lastFired) continue;
                const s = strike(k);
                if (t < s.time) continue;
                lastFired = k;
                if (t - s.time < 0.6) fire({ distance: s.distance });
            }
        },

        /** Weather in front of the scene: fog, rain or snow, splashes and the lightning flash. */
        overlay(ctx, t) {
            if (fogLayer) {
                ctx.drawImage(fogLayer, Math.round(Math.sin(t * 0.07) * 8), 0);
            }
            if (particles.length) {
                const slant = info.storm ? 0.5 : 0.25;
                if (snow) {
                    for (const p of particles) {
                        const y = wrap(p.y + t * p.speed, H + 6) - 3;
                        const x = wrap(p.x + Math.sin(t * 0.8 + p.phase) * 6 - t * info.wind * 22, W + 6) - 3;
                        ctx.fillStyle = env.c('#eef4ff');
                        ctx.globalAlpha = p.alpha;
                        ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
                    }
                    ctx.globalAlpha = 1;
                } else {
                    for (const bright of [false, true]) {
                        ctx.fillStyle = bright ? dropBright : dropDim;
                        for (const p of particles) {
                            if (p.bright !== bright) continue;
                            const y = wrap(p.y + t * p.speed, H + 10) - 5;
                            const x = wrap(p.x - y * slant - t * 4, W + 80) - 40;
                            for (let k = 0; k < p.len; k++) ctx.fillRect(Math.round(x + k * slant), Math.round(y - k), 1, 1);
                        }
                    }
                    const [y0, y1] = meta.rainBand || [H - 16, H - 2];
                    const sr = rng(Math.floor(t * 10));
                    const rings = Math.round(info.rain * 26);
                    ctx.fillStyle = splash;
                    for (let i = 0; i < rings; i++) {
                        const sx = Math.floor(sr() * W);
                        const sy = Math.floor(y0 + sr() * (y1 - y0));
                        ctx.fillRect(sx - 1, sy, 1, 1);
                        ctx.fillRect(sx + 1, sy, 1, 1);
                        ctx.fillRect(sx, sy - 1, 1, 1);
                    }
                }
            }
            if (period) {
                const { flash } = flashAt(t);
                if (flash > 0) {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = `rgba(110, 130, 180, ${flash * 0.2})`;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
        },
    };

    let lastFired = Math.floor(0 / (period || 1)) - 2;

    let fogLayer = null;
    if (info.fog && meta.fog) {
        const f = layer();
        hazeBand(f.ctx, meta.fog[0], meta.fog[1], info.fog.color, info.fog.alpha, info.fog.density);
        fogLayer = f.canvas;
    }

    // Rain and snow particles, made once
    const particles = [];
    const dropDim = env.night ? 'rgba(120, 145, 190, 0.35)' : 'rgba(170, 210, 220, 0.35)';
    const dropBright = env.night ? 'rgba(170, 190, 230, 0.5)' : 'rgba(220, 240, 245, 0.55)';
    const splash = env.night ? 'rgba(150, 175, 215, 0.55)' : 'rgba(200, 230, 235, 0.6)';
    if (info.rain > 0) {
        const pr = rng(99);
        const count = snow ? Math.round(50 + info.rain * 130) : Math.round(60 + info.rain * 240);
        for (let i = 0; i < count; i++) {
            particles.push(snow
                ? { x: pr() * W, y: pr() * H, speed: (10 + pr() * 22) * (0.5 + info.rain), phase: pr() * 6, size: pr() < 0.25 ? 2 : 1, alpha: 0.5 + pr() * 0.5 }
                : {
                    x: pr() * (W + 80), y: pr() * H,
                    speed: (info.storm ? 260 : 150) + pr() * 90, len: 3 + Math.floor(pr() * (info.storm ? 6 : 4)),
                    bright: pr() < 0.3,
                });
        }
    }

    return env;
}
