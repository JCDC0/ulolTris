/**
 * ambience-synth.js - Builds the textured scene sounds as raw samples: rain made of
 * single drops, wheat made of stalks touching, and thunder.
 *
 * Filtered noise alone sounds like static, so these are built the way the real
 * sounds are: from thousands of tiny separate events ("grains") mixed into a loop.
 * - Rain: soft drops (a short rising chirp, like a drop on a leaf or a puddle), hard
 *   drops (a sharp tick with a low pat, like a drop on stone) and now and then a
 *   heavy drip into standing water, over a quiet wash of distant rain.
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
 * Quiet band of noise under the grains, different in each ear. The filters are run
 * once around the loop before writing, so the loop point is seamless.
 */
function addWash(out, sr, r, level, lowHz, highHz, swell) {
    const n = out[0].length;
    const kLow = 1 - Math.exp((-TAU * highHz) / sr);
    const kHigh = 1 - Math.exp((-TAU * lowHz) / sr);
    const phase = r() * TAU;
    for (const ch of out) {
        const noise = new Float32Array(n);
        for (let i = 0; i < n; i++) noise[i] = r() * 2 - 1;
        let lp = 0, hp = 0;
        const warm = Math.min(n, Math.round(sr * 0.2));
        for (let i = n - warm; i < n; i++) {
            lp += (noise[i] - lp) * kLow;
            hp += (lp - hp) * kHigh;
        }
        for (let i = 0; i < n; i++) {
            lp += (noise[i] - lp) * kLow;
            hp += (lp - hp) * kHigh;
            const slow = 1 + swell * Math.sin((TAU * 2 * i) / n + phase);
            ch[i] += (lp - hp) * level * slow;
        }
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
 * A loop of rain. Rates are drops per second.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { seconds, soft, hard, drips, wash, gusts, seed }
 *   `gusts` (0 to 1) bunches the hard drops into waves, as wind drives the rain.
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* rainLoop(sr, { seconds = 6.5, soft = 55, hard = 35, drips = 2.5, wash = 0.05, gusts = 0, seed = 1 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const g = new Float32Array(Math.ceil(sr * 0.3));
    const loud = () => 0.12 + 0.88 * r() ** 3;
    let made = 0;

    for (let i = Math.round(soft * seconds); i > 0; i--) {
        const f = 1200 * Math.pow(3.2, r());
        const len = sineGrain(g, sr, f, f * (1.15 + r() * 0.45), 0.004 + r() * 0.01, loud() * 0.8);
        mix(out, Math.floor(r() * n), g, len, r() * 2 - 1);
        if (++made % 48 === 0) yield;
    }

    const gustPhase = r() * TAU;
    for (let i = Math.round(hard * seconds); i > 0; i--) {
        let at = Math.floor(r() * n);
        if (gusts > 0) {
            // Keep a drop more often where the gust curve is high
            for (let tries = 0; tries < 4; tries++) {
                const wave = 0.5 + 0.5 * Math.sin((TAU * 2 * at) / n + gustPhase);
                if (r() < 1 - gusts + gusts * wave) break;
                at = Math.floor(r() * n);
            }
        }
        const pan = r() * 2 - 1;
        const amp = loud();
        let len = noiseGrain(g, sr, r, 1800 * Math.pow(3.6, r()), 3 + r() * 3, 0.0002, 0.0015 + r() * 0.0025, amp);
        mix(out, at, g, len, pan);
        if (r() < 0.5) {
            const f = 180 + r() * 300;
            len = sineGrain(g, sr, f, f * 0.8, 0.008 + r() * 0.008, amp * 0.55);
            mix(out, at, g, len, pan);
        }
        if (++made % 48 === 0) yield;
    }

    for (let i = Math.round(drips * seconds); i > 0; i--) {
        const at = Math.floor(r() * n);
        const pan = r() * 1.6 - 0.8;
        const amp = 0.55 + r() * 0.45;
        let len = noiseGrain(g, sr, r, 3200, 2, 0.0002, 0.001, amp * 0.5);
        mix(out, at, g, len, pan);
        const f = 420 + r() * 480;
        len = sineGrain(g, sr, f, f * (1.5 + r() * 0.7), 0.025 + r() * 0.02, amp);
        mix(out, at + Math.round(sr * (0.008 + r() * 0.006)), g, len, pan);
    }
    yield;

    addWash(out, sr, r, wash, 500, 3200, 0.25);
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

/** Settings for the kinds of rain. The storm is mostly hard drops, driven in gusts. */
export const RAIN_KINDS = {
    rain: [
        { seconds: 6.1, soft: 55, hard: 35, drips: 2.5, wash: 0.05, seed: 11 },
        { seconds: 7.7, soft: 40, hard: 25, drips: 1.5, wash: 0.04, seed: 12 },
    ],
    storm: [
        { seconds: 5.9, soft: 60, hard: 190, drips: 3, wash: 0.11, gusts: 0.6, seed: 21 },
        { seconds: 7.3, soft: 40, hard: 140, drips: 2, wash: 0.09, gusts: 0.8, seed: 22 },
    ],
    // Running water: many small bubbles and few hard hits, with a wide wash
    water: [
        { seconds: 6.7, soft: 190, hard: 25, drips: 1, wash: 0.13, seed: 31 },
        { seconds: 8.3, soft: 150, hard: 20, drips: 0.5, wash: 0.11, seed: 32 },
    ],
};
