/**
 * ambience-synth.js - Builds the textured scene sounds as raw samples: rain made of
 * single drops, wheat made of stalks touching, and thunder.
 *
 * Filtered noise alone sounds like static, so these are built the way the real
 * sounds are: from thousands of tiny separate events mixed into a loop.
 * - Rain is a shower with droplets on top. The shower is a dense field of tiny
 *   impacts (thousands a second, some much louder than others) through a few
 *   frequency bands, breathing slowly as gusts pass, different in each ear. The
 *   droplets are quiet unpitched ticks: drops on stone, on leaves, and now and then
 *   a drip with a little ring. There are no pitched "bloops": a drop that rises in
 *   pitch sounds like a bubble, and a few of them sound like jelly.
 * - Wheat: dry ticks where stalks touch, papery brushes where ears slide past each
 *   other, and hollow knocks from stems. Grains come in swells that cross from left
 *   to right as each gust passes, with near silence between gusts.
 * - Thunder: a crack of several sharp bursts, a low boom, then a rumble that rolls
 *   and fades.
 *
 * Everything here is plain math on Float32Arrays, with no Web Audio and no DOM, so
 * it also runs in Node for tests. The loop builders are generators that yield now
 * and then; ambience.js runs them in short slices so a scene change never stalls a
 * frame. Use runSync() to build one in a single go.
 */

import { rng } from './scenes/pixel.js';

const TAU = Math.PI * 2;

/** Run a loop builder to the end and return its [left, right] samples. */
export function runSync(gen) {
    let step = gen.next();
    while (!step.done) step = gen.next();
    return step.value;
}

function stereo(sr, seconds) {
    const n = Math.round(sr * seconds);
    return [new Float32Array(n), new Float32Array(n)];
}

/** Mix a mono grain into a stereo loop at `start`, wrapping past the end. Pan is -1 to 1. */
function mix(out, start, grain, len, pan) {
    const [left, right] = out;
    const n = left.length;
    const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
    const gl = Math.cos(angle);
    const gr = Math.sin(angle);
    let j = ((start % n) + n) % n;
    for (let i = 0; i < len; i++) {
        left[j] += grain[i] * gl;
        right[j] += grain[i] * gr;
        if (++j >= n) j = 0;
    }
}

/** A sine that glides from f0 to f1 and dies away with time constant tau. Returns its length. */
function sineGrain(buf, sr, f0, f1, tau, amp) {
    const len = Math.min(buf.length, Math.ceil(tau * 6 * sr));
    const attack = Math.max(2, Math.round(sr * 0.0003));
    const decay = Math.exp(-1 / (tau * sr));
    let phase = 0;
    let env = amp;
    for (let i = 0; i < len; i++) {
        phase += (TAU * (f0 + ((f1 - f0) * i) / len)) / sr;
        buf[i] = Math.sin(phase) * env * Math.min(1, i / attack);
        env *= decay;
    }
    return len;
}

/** Noise through a resonant band filter with an attack and a decay. Returns its length. */
function noiseGrain(buf, sr, r, freq, q, attackS, decayS, amp) {
    const len = Math.min(buf.length, Math.ceil((attackS + decayS * 5) * sr));
    const w = (TAU * Math.min(freq, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    const b0 = alpha / a0;
    // A narrow band passes less noise, so make up the level.
    const gain = amp * Math.sqrt(q) * 2.2;
    const attack = Math.max(1, attackS * sr);
    const decay = Math.exp(-1 / (decayS * sr));
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, env = 1;
    for (let i = 0; i < len; i++) {
        const x = r() * 2 - 1;
        const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        if (i < attack) buf[i] = y * gain * (i / attack);
        else { buf[i] = y * gain * env; env *= decay; }
    }
    return len;
}

/**
 * Add a band of dense impacts to one channel. Each impact is a single sample of random
 * size and sign, and the filters turn the impacts into the hiss and patter of a shower.
 * Sizes are kept close together: a few much bigger impacts come out as pops. The filters run once around the loop before writing, so
 * the loop point is seamless.
 * @param {Float32Array} ch - channel to add to
 * @param {Object} band - { rate: impacts per second, hp, lp: corner frequencies in Hz, level }
 * @param {number} breathe - how much gusts swell and ease the band (0 to 1)
 * @param {number} gustPhase - where in the loop the gust swells start, shared by both ears
 */
function* addBand(ch, sr, r, { rate, hp, lp, level }, breathe, gustPhase) {
    const n = ch.length;
    const shot = new Float32Array(n);
    for (let i = Math.round((rate * n) / sr); i > 0; i--) shot[Math.floor(r() * n)] += (r() * 2 - 1) * (0.6 + 0.8 * r() ** 2);
    const kLp = 1 - Math.exp((-TAU * lp) / sr);
    const kHp = 1 - Math.exp((-TAU * hp) / sr);
    let l1 = 0, l2 = 0, a = 0, b = 0;
    // Two-pole lowpass, then two one-pole highpass stages
    const run = x => {
        l1 += (x - l1) * kLp;
        l2 += (l1 - l2) * kLp;
        a += (l2 - a) * kHp;
        const v = l2 - a;
        b += (v - b) * kHp;
        return v - b;
    };
    const warm = Math.min(n, Math.round(sr * 0.25));
    for (let i = n - warm; i < n; i++) run(shot[i]);
    const p1 = r() * TAU, p2 = r() * TAU;
    const c1 = 2 + Math.floor(r() * 2), c2 = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
        const mod = 1 + breathe * (0.6 * Math.sin((TAU * c1 * i) / n + p1 + gustPhase) + 0.4 * Math.sin((TAU * c2 * i) / n + p2));
        ch[i] += run(shot[i]) * level * mod;
        if (i % 65536 === 0) yield;
    }
}

/** Scale to a target RMS and round off any peaks near full scale. */
function normalize(out, targetRms) {
    let sum = 0;
    for (const ch of out) for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / (out[0].length * out.length)) || 1;
    const k = targetRms / rms;
    for (const ch of out) {
        for (let i = 0; i < ch.length; i++) {
            const v = ch[i] * k;
            const a = Math.abs(v);
            ch[i] = a <= 0.8 ? v : Math.sign(v) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
        }
    }
    return out;
}

/**
 * A loop of rain (or of running water): a shower with droplets on top.
 * @param {number} sr - sample rate
 * @param {Object} [o]
 *   seconds: loop length
 *   bands: [{ rate, hp, lp, level }] the shower, see addBand
 *   breathe: how much the shower swells and eases (0 to 1)
 *   ticks, leaves, drips: droplets per second: sharp ticks on stone, soft patters on
 *     leaves, and drips with a little ring. All are quiet next to the shower.
 *   gusts: 0 to 1, bunches the droplets into the same swells as the shower
 *   seed
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* rainLoop(sr, { seconds = 6.5, bands = [], breathe = 0.2, ticks = 16, leaves = 8, drips = 1, gusts = 0, seed = 1 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const gustPhase = r() * TAU;

    for (const ch of out) {
        for (const band of bands) {
            yield* addBand(ch, sr, r, band, breathe, gustPhase);
        }
    }
    // Scale the shower to an RMS of 1, so droplet sizes below are in units of the shower
    let sum = 0;
    for (const ch of out) for (let i = 0; i < n; i++) sum += ch[i] * ch[i];
    const k = 1 / (Math.sqrt(sum / (n * out.length)) || 1);
    for (const ch of out) for (let i = 0; i < n; i++) ch[i] *= k;

    const g = new Float32Array(Math.ceil(sr * 0.1));
    let made = 0;
    /** A time in the loop, more likely where the gust curve is high when gusts > 0. */
    const when = () => {
        let at = Math.floor(r() * n);
        if (gusts > 0) {
            for (let tries = 0; tries < 4; tries++) {
                const wave = 0.5 + 0.5 * Math.sin((TAU * 2 * at) / n + gustPhase);
                if (r() < 1 - gusts + gusts * wave) break;
                at = Math.floor(r() * n);
            }
        }
        return at;
    };
    const loud = () => 0.25 + 0.75 * r() ** 2;

    for (let i = Math.round(ticks * seconds); i > 0; i--) {
        // A drop on something hard: a sharp tick, brighter and shorter the harder the surface
        const len = noiseGrain(g, sr, r, 3000 + r() * 4500, 2.5 + r() * 2, 0.0002, 0.0012 + r() * 0.002, loud() * 4);
        mix(out, when(), g, len, r() * 2 - 1);
        if (++made % 64 === 0) yield;
    }
    for (let i = Math.round(leaves * seconds); i > 0; i--) {
        // A drop on a leaf: duller and a touch longer, a soft pat
        const len = noiseGrain(g, sr, r, 1100 + r() * 1500, 1.2 + r(), 0.0006, 0.004 + r() * 0.005, loud() * 3.6);
        mix(out, when(), g, len, r() * 2 - 1);
        if (++made % 64 === 0) yield;
    }
    for (let i = Math.round(drips * seconds); i > 0; i--) {
        // A drip off a roof or a leaf tip: a tick with a short, narrow ring that does not change pitch
        const at = when();
        const pan = r() * 1.6 - 0.8;
        let len = noiseGrain(g, sr, r, 4200, 2, 0.0002, 0.001, 3);
        mix(out, at, g, len, pan);
        len = noiseGrain(g, sr, r, 2400 + r() * 1800, 14, 0.0004, 0.006 + r() * 0.006, 3.5);
        mix(out, at, g, len, pan);
    }
    yield;
    return normalize(out, 0.085);
}

/** How hard the wind blows at loop position p (0 to 1). Whole cycles, so it loops. */
function gustAt(p) {
    const v = 0.5 + 0.32 * Math.sin(TAU * (p + 0.1)) + 0.18 * Math.sin(TAU * (2 * p + 0.43)) + 0.1 * Math.sin(TAU * (5 * p + 0.2));
    return Math.max(0, Math.min(1, v));
}

/**
 * A loop of wind moving through ripe wheat.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { seconds, seed }
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* wheatLoop(sr, { seconds = 9, seed = 7 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const g = new Float32Array(Math.ceil(sr * 0.08));
    let made = 0;

    function grain(at, pan, level) {
        const kind = r();
        let len;
        if (kind < 0.68) {
            // Two dry stalks touch
            const f = 2500 * Math.pow(3.4, r());
            len = sineGrain(g, sr, f, f * (0.9 + r() * 0.2), 0.0004 + r() * 0.0011, level * (0.15 + 0.85 * r() ** 2) * 0.6);
        } else if (kind < 0.95) {
            // Ears and awns sliding past each other
            len = noiseGrain(g, sr, r, 3000 + r() * 4000, 2 + r() * 2, 0.002 + r() * 0.006, 0.003 + r() * 0.006, level * (0.2 + 0.5 * r()) * 0.3);
        } else {
            // A hollow stem knocks against another
            const f = 600 + r() * 1000;
            len = sineGrain(g, sr, f, f * 0.92, 0.003 + r() * 0.005, level * (0.3 + 0.4 * r()) * 0.4);
        }
        mix(out, at, g, len, pan);
    }

    // Swells: a patch of the field rustles as the gust front crosses it, left to right
    const swells = Math.round(seconds * 1.7);
    for (let s = 0; s < swells; s++) {
        const center = (s + r()) / swells;
        const width = 0.25 + r() * 0.5;
        const strength = (0.45 + r() * 0.55) * (0.2 + 0.8 * gustAt(center) ** 1.5);
        const count = Math.round(1500 * width * strength);
        const drift = 0.5 + r() * 0.9;
        const offset = (r() - 0.5) * 0.5;
        for (let i = 0; i < count; i++) {
            // Sum of two randoms: most grains near the middle of the swell
            const u = (r() + r()) / 2 - 0.5;
            const at = Math.floor((center * seconds + u * width) * sr);
            grain(at, offset + u * 2 * drift + (r() - 0.5) * 0.4, 0.5 + 0.5 * strength);
            if (++made % 64 === 0) yield;
        }
    }

    // Between swells: single stalks ticking, more of them when the wind is up
    for (let i = Math.round(55 * seconds); i > 0; i--) {
        const p = r();
        if (r() > 0.3 + 0.7 * gustAt(p)) continue;
        grain(Math.floor(p * n), r() * 2 - 1, 0.45);
        if (++made % 64 === 0) yield;
    }
    return normalize(out, 0.06);
}

/**
 * One thunderclap. It is not a loop.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { distance, seed }. distance 0 is overhead (sharp crack),
 *   1 is far away (no crack, a longer and duller rumble).
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* thunderClap(sr, { distance = 0.4, seed = 1 } = {}) {
    const r = rng(seed);
    const near = 1 - distance;
    const seconds = 4.5 + r() * 2.5 + distance * 1.5;
    const out = stereo(sr, seconds);
    const n = out[0].length;

    // Loudness over time: the strike, then rolls as the sound returns off the land
    const env = new Float32Array(n);
    const strikeAt = 0.02 + distance * 0.1;
    const bumps = [{ t: strikeAt, a: 1, rise: 0.015 + distance * 0.12, fall: 0.5 + r() * 0.4 }];
    for (let k = 4 + Math.floor(r() * 5); k > 0; k--) {
        const t = 0.25 + r() * seconds * 0.6;
        bumps.push({ t, a: (0.25 + r() * 0.45) * (1 - t / seconds), rise: 0.05 + r() * 0.15, fall: 0.4 + r() * 0.9 });
    }
    for (const b of bumps) {
        const start = Math.floor(b.t * sr);
        for (let i = start; i < n; i++) {
            const t = (i - start) / sr;
            const v = t < b.rise ? t / b.rise : Math.exp(-(t - b.rise) / b.fall);
            if (t > b.rise && v < 0.002) break;
            env[i] += v * b.a;
        }
        yield;
    }

    // The rumble: deep noise for the weight, a band around 250 Hz for the roll, and
    // a band higher up so it still reads as thunder on small speakers.
    const midHz = 500 + near * 1300;
    const kDeep = Math.exp((-TAU * 30) / sr);
    const kBody = 1 - Math.exp((-TAU * 250) / sr);
    const kMid = 1 - Math.exp((-TAU * midHz) / sr);
    const kFlutter = 1 - Math.exp((-TAU * 9) / sr);
    for (const ch of out) {
        let deep = 0, body = 0, mid = 0, flutter = 0;
        for (let i = 0; i < n; i++) {
            const w = r() * 2 - 1;
            deep = deep * kDeep + w;
            body += (w - body) * kBody;
            mid += (w - mid) * kMid;
            flutter += (r() * 2 - 1 - flutter) * kFlutter;
            const roll = Math.max(0.2, 0.8 + flutter * 20);
            const fade = Math.min(1, (n - i) / (sr * 0.8));
            ch[i] = (deep * 0.06 + body * 3.2 + mid * (0.5 + near * 0.9)) * env[i] * roll * fade;
            if (i % 32768 === 0) yield;
        }
    }

    // The crack: a few sharp bursts, as the channel tears through the air
    const g = new Float32Array(Math.ceil(sr * 0.3));
    if (near > 0.2) {
        for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
            const at = Math.floor((strikeAt + r() * 0.22) * sr);
            const len = noiseGrain(g, sr, r, 900 + r() * 2200, 0.7, 0.0005, 0.006 + r() * 0.03, near * (0.5 + r() * 0.5) * 1.6);
            mix(out, at, g, Math.min(len, n - at), r() * 0.8 - 0.4);
        }
    }
    // The boom under it
    const low = 45 + r() * 25;
    const at = Math.floor(strikeAt * sr);
    let len = sineGrain(g, sr, low, low * 0.8, 0.05, 1.1);
    mix(out, at, g, Math.min(len, n - at), 0);
    len = sineGrain(g, sr, low * 2.3, low * 1.9, 0.045, 0.6);
    mix(out, at, g, Math.min(len, n - at), 0);

    let peak = 0;
    for (const ch of out) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[i]));
    const k = (0.95 * (1 - 0.3 * distance)) / (peak || 1);
    for (const ch of out) for (let i = 0; i < n; i++) ch[i] *= k;
    return out;
}

/** One thunderclap, built in a single go (for tests and offline renders). */
export function thunder(sr, opts) {
    return runSync(thunderClap(sr, opts));
}

/**
 * Settings for the kinds of rain. Bands run from a hiss on top to a patter in the middle
 * to a far-off roar underneath. The storm is denser and louder, swells and eases more,
 * and has more droplets. Running water is a low, steady roar with a few splashes.
 */
export const RAIN_KINDS = {
    rain: [
        {
            seconds: 6.1, seed: 11, breathe: 0.18, ticks: 14, leaves: 8, drips: 1.2,
            bands: [
                { rate: 19800, hp: 1800, lp: 6500, level: 0.44 },
                { rate: 8400, hp: 350, lp: 1800, level: 1.12 },
                { rate: 4000, hp: 100, lp: 500, level: 0.54 },
            ],
        },
        {
            seconds: 7.7, seed: 12, breathe: 0.2, ticks: 10, leaves: 6, drips: 0.8,
            bands: [
                { rate: 17600, hp: 2000, lp: 6800, level: 0.44 },
                { rate: 9100, hp: 400, lp: 1600, level: 1.11 },
                { rate: 3500, hp: 90, lp: 450, level: 0.54 },
            ],
        },
    ],
    storm: [
        {
            seconds: 5.9, seed: 21, breathe: 0.4, gusts: 0.6, ticks: 34, leaves: 10, drips: 2,
            bands: [
                { rate: 26400, hp: 1600, lp: 7000, level: 0.59 },
                { rate: 11200, hp: 320, lp: 2000, level: 1.28 },
                { rate: 5000, hp: 70, lp: 450, level: 0.95 },
            ],
        },
        {
            seconds: 7.3, seed: 22, breathe: 0.45, gusts: 0.8, ticks: 26, leaves: 8, drips: 1.5,
            bands: [
                { rate: 24200, hp: 1700, lp: 6800, level: 0.58 },
                { rate: 10500, hp: 340, lp: 1900, level: 1.25 },
                { rate: 4500, hp: 60, lp: 400, level: 0.98 },
            ],
        },
    ],
    water: [
        {
            seconds: 6.7, seed: 31, breathe: 0.08, ticks: 5, leaves: 0, drips: 0,
            bands: [
                { rate: 19800, hp: 500, lp: 5200, level: 0.51 },
                { rate: 9100, hp: 160, lp: 1400, level: 1.06 },
                { rate: 4000, hp: 60, lp: 320, level: 0.76 },
            ],
        },
        {
            seconds: 8.3, seed: 32, breathe: 0.1, ticks: 4, leaves: 0, drips: 0,
            bands: [
                { rate: 17600, hp: 600, lp: 5000, level: 0.51 },
                { rate: 8400, hp: 180, lp: 1300, level: 1.01 },
                { rate: 3500, hp: 60, lp: 300, level: 0.76 },
            ],
        },
    ],
};
