/**
 * ambience-synth.js - Builds the textured scene sounds as raw samples: rain made of
 * single drops, wind, wheat brushing, surf, a temple bell and thunder.
 *
 * Filtered noise alone sounds like static, so these are built the way the real
 * sounds are: from thousands of tiny separate events, or from resonances, mixed into a
 * loop.
 * - Rain is a shower with droplets on top. The shower is a dense field of tiny
 *   impacts (thousands a second) through a few frequency bands, breathing as gusts pass,
 *   different in each ear, with a patter of separate drops in the middle. The droplets
 *   are quiet unpitched ticks: drops on stone, on leaves, and now and then a drip with
 *   a little ring. There are no pitched "bloops": a drop that rises in pitch sounds
 *   like a bubble, and a few of them sound like jelly.
 * - Wind is noise through a moving resonant band: the harder a gust blows, the higher
 *   and louder the band, with a faint howl on top in a gale.
 * - Wheat: soft, airy brushes as ears and leaves slide past each other, in swells as
 *   each gust crosses the field. Nothing pitched and nothing sharp: short tonal grains
 *   sound like water splashing.
 * - Surf: each wave builds, breaks and then washes back down the beach with a fizz that
 *   thins out.
 * - Bell: a struck temple bell, made of decaying partials that are not whole multiples,
 *   each with a slightly detuned twin so the tone slowly beats.
 * - Thunder: a deep boom, then a low rumble that rolls and fades. The rumble is noise
 *   through steep filters, so nothing above a few hundred hertz is left to hiss, and it
 *   is driven through a soft clipper so small speakers still get something to play.
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
    const c1 = 2 + Math.floor(r() * 2), c2 = 5 + Math.floor(r() * 3), c3 = 13 + Math.floor(r() * 6);
    const p3 = r() * TAU;
    for (let i = 0; i < n; i++) {
        const mod = 1 + breathe * (0.55 * Math.sin((TAU * c1 * i) / n + p1 + gustPhase) + 0.35 * Math.sin((TAU * c2 * i) / n + p2) + 0.25 * Math.sin((TAU * c3 * i) / n + p3));
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
        const len = noiseGrain(g, sr, r, 3000 + r() * 4200, 2.5 + r() * 2, 0.0002, 0.0012 + r() * 0.002, loud() * 3.1);
        mix(out, when(), g, len, r() * 2 - 1);
        if (++made % 64 === 0) yield;
    }
    for (let i = Math.round(leaves * seconds); i > 0; i--) {
        // A drop on a leaf: duller and a touch longer, a soft pat
        const len = noiseGrain(g, sr, r, 1100 + r() * 1500, 1.2 + r(), 0.0006, 0.004 + r() * 0.005, loud() * 3.1);
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

/**
 * Smooth gust strength around a loop, 0 to 1: raised-cosine bumps laid on a circle, so the
 * end of the loop meets its start.
 */
function gustCurve(n, sr, r, count, widthMin, widthMax) {
    const out = new Float32Array(n);
    for (let k = 0; k < count; k++) {
        const half = (widthMin + r() * (widthMax - widthMin)) * sr;
        const from = Math.floor(r() * n - half);
        const amp = 0.55 + 0.45 * r();
        for (let d = 0; d < half * 2; d++) {
            const i = (((from + d) % n) + n) % n;
            out[i] += amp * 0.5 * (1 - Math.cos((Math.PI * d) / half));
        }
    }
    for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i]);
    return out;
}

/** White noise in a Float32Array, from a seeded generator. */
function noiseArray(n, r) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
    return out;
}

/** Scale a mono array to an RMS of 1. */
function unitRms(a) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    const k = 1 / (Math.sqrt(sum / a.length) || 1);
    for (let i = 0; i < a.length; i++) a[i] *= k;
}

/**
 * A loop of wind. Noise goes through a resonant band that rises and brightens as a gust
 * builds, with a slow rumble underneath. In a gale a narrow moving resonance adds a faint
 * howl. The two ears are different noise, and the level tilts slowly between them.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { seconds, seed, gusty (0 steady to 1 gusts), howl (0 to 1) }
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* windLoop(sr, { seconds = 10, seed = 41, gusty = 0.7, howl = 0 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const gust = gustCurve(n, sr, r, Math.max(2, Math.round(seconds / 3)), 1.1, 2.6);
    const phase = [r() * TAU, r() * TAU, r() * TAU];
    const cycles = [Math.max(1, Math.round(seconds * 0.5)), Math.max(2, Math.round(seconds * 1.4))];
    const strength = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const mixed = (1 - gusty) * 0.5 + gusty * gust[i];
        const flutter = 1 + 0.14 * Math.sin((TAU * cycles[1] * i) / n + phase[1]) + 0.08 * Math.sin((TAU * cycles[1] * 2.9 * i) / n + phase[2]);
        strength[i] = (0.16 + 0.84 * mixed) * flutter;
    }

    const kRum = 1 - Math.exp((-TAU * 110) / sr);
    const warm = Math.min(n, Math.round(sr * 0.6));
    for (let ch = 0; ch < 2; ch++) {
        const x = noiseArray(n, rng(seed * 13 + ch * 101));
        const y = out[ch];
        let low1 = 0, band1 = 0, low2 = 0, band2 = 0, rum1 = 0, rum2 = 0;
        const step = i => {
            const s = strength[i];
            const f1 = 2 * Math.sin((Math.PI * (170 + 900 * s ** 1.3)) / sr);
            low1 += f1 * band1;
            band1 += f1 * (x[i] - low1 - 0.72 * band1);
            rum1 += (x[i] - rum1) * kRum;
            rum2 += (rum1 - rum2) * kRum;
            let v = band1 * 0.85 + rum2 * 3.2 * s;
            if (howl > 0) {
                const f2 = 2 * Math.sin((Math.PI * (340 + 560 * s + 30 * Math.sin((TAU * cycles[1] * 3 * i) / n + phase[0]))) / sr);
                low2 += f2 * band2;
                band2 += f2 * (x[i] - low2 - 0.05 * band2);
                v += band2 * howl * 0.9 * s * s;
            }
            return v * s ** 1.15;
        };
        for (let i = n - warm; i < n; i++) step(i);
        for (let i = 0; i < n; i++) {
            const tilt = 1 + (ch === 0 ? 1 : -1) * 0.22 * Math.sin((TAU * cycles[0] * i) / n + phase[0]);
            y[i] = step(i) * tilt;
            if (i % 65536 === 0) yield;
        }
    }
    return normalize(out, 0.085);
}

/**
 * A loop of wind moving through ripe wheat: soft brushes, quiet, in swells as gusts
 * cross the field. Every grain is noise in a wide band with a slow attack and a slow
 * decay, so together they read as a dry, airy "shhh" with a little texture. The earlier
 * version used short tonal ticks, which came out as splashing water.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { seconds, seed }
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* wheatLoop(sr, { seconds = 11, seed = 7 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const g = new Float32Array(Math.ceil(sr * 0.5));
    const gust = gustCurve(n, sr, r, Math.max(2, Math.round(seconds / 2.4)), 0.9, 2.2);
    let made = 0;

    // Soft swishes: ears and leaves brushing past each other
    for (let i = Math.round(200 * seconds); i > 0; i--) {
        const at = Math.floor(r() * n);
        const s = gust[at];
        if (r() > 0.1 + 0.9 * s ** 1.3) continue;
        const len = noiseGrain(g, sr, r, 1600 + r() * 3000, 0.8 + r() * 0.7, 0.012 + r() * 0.03, 0.035 + r() * 0.08, (0.3 + 0.7 * r()) * (0.3 + 0.7 * s));
        mix(out, at, g, len, (r() * 2 - 1) * 0.85);
        if (++made % 48 === 0) yield;
    }
    // A few dry stalks touching: soft and dull, never a click
    for (let i = Math.round(5 * seconds); i > 0; i--) {
        const at = Math.floor(r() * n);
        if (r() > 0.15 + 0.85 * gust[at]) continue;
        const len = noiseGrain(g, sr, r, 1800 + r() * 1800, 1.2, 0.002, 0.01 + r() * 0.012, 0.16 * (0.4 + 0.6 * r()));
        mix(out, at, g, len, (r() * 2 - 1) * 0.85);
        if (++made % 48 === 0) yield;
    }
    yield;
    return normalize(out, 0.05);
}

/**
 * A loop of surf. Each wave gathers (a low rumble that rises and brightens), breaks (a
 * broad crash with a thump underneath) and then washes back down the beach: a band of
 * noise that falls in pitch and level, with a fizz of tiny bubbles that thins out. The
 * wave runs along the shore from one ear toward the other as it breaks.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { seconds: loop length, waves: how many in the loop, size: 0..1.5, seed }
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* surfLoop(sr, { seconds = 30, waves = 3, size = 1, seed = 51 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const slot = n / waves;
    const [left, right] = out;
    const lp = (fc) => 1 - Math.exp((-TAU * fc) / sr);

    for (let w = 0; w < waves; w++) {
        const crashAt = Math.floor((w + 0.35 + r() * 0.35) * slot);
        const build = 2.4 + r() * 1.6;
        const wash = 4 + r() * 2.2;
        const big = size * (0.75 + 0.45 * r());
        const p0 = r() < 0.5 ? -0.6 : 0.6;
        const p1 = -p0 * (0.3 + 0.5 * r());
        const length = Math.round((build + wash + 0.8) * sr);
        const start = crashAt - Math.round(build * sr);

        let a1 = 0, a2 = 0;            // gathering rumble (two poles)
        let h = 0;                     // gathering hiss (highpass state)
        let c1 = 0, c2 = 0;            // crash (two poles)
        let t1 = 0;                    // thump
        let w1 = 0, w2 = 0, wh = 0;    // wash: lowpass, lowpass, highpass
        let fz = 0;                    // fizz highpass
        for (let i = 0; i < length; i++) {
            const t = (i - Math.round(build * sr)) / sr;     // seconds since the crash, negative while gathering
            const white = r() * 2 - 1;
            let v = 0;
            if (t < 0) {
                const u = Math.max(0, (t + build) / build);
                const e = 0.6 * u ** 2.3;
                a1 += (white - a1) * lp(180 + 700 * u);
                a2 += (a1 - a2) * lp(180 + 700 * u);
                h += (white - h) * lp(1800);
                v += a2 * e * 5 + (white - h) * e * 0.12 * u;
            }
            if (t >= 0) {
                const attack = 1 - Math.exp(-t / 0.035);
                const crash = attack * Math.exp(-t / 0.55);
                const fc = 1100 + 3100 * Math.exp(-t / 0.7);
                c1 += (white - c1) * lp(fc);
                c2 += (c1 - c2) * lp(fc);
                t1 += (white - t1) * lp(240);
                v += c2 * crash * 2.4 + t1 * attack * Math.exp(-t / 0.5) * 4.5;
            }
            if (t >= 0.05) {
                const span = Math.max(0, 1 - t / wash);
                const e = (1 - Math.exp(-t / 0.3)) * span ** 1.7;
                const fc = 900 + 2600 * span;
                w1 += (white - w1) * lp(fc);
                w2 += (w1 - w2) * lp(fc);
                wh += (w2 - wh) * lp(450);
                v += (w2 - wh) * e * 1.5;
                // Bubbles popping in the foam: thick at first, then fewer and fewer
                const pops = (420 * span * span + 12) / sr;
                fz += ((r() < pops ? (r() * 2 - 1) * (0.3 + 0.7 * r()) * (0.3 + span) : 0) - fz) * 0.6;
                v += fz * 0.7;
            }
            const k = Math.max(0, Math.min(1, t / wash));
            const pan = t < 0 ? p0 : p0 + (p1 - p0) * k;
            const angle = ((pan + 1) * Math.PI) / 4;
            const j = (((start + i) % n) + n) % n;
            left[j] += v * big * Math.cos(angle);
            right[j] += v * big * Math.sin(angle);
            if (i % 65536 === 0) yield;
        }
    }
    // The far roar of the whole sea under the waves, so the gaps between them are never dead
    const roarPhase = r() * TAU;
    const kRoar = lp(280);
    for (const ch of out) {
        let a = 0, b = 0;
        for (let i = 0; i < n; i++) {
            a += ((r() * 2 - 1) - a) * kRoar;
            b += (a - b) * kRoar;
            ch[i] += b * 0.75 * (1 + 0.35 * Math.sin((TAU * 3 * i) / n + roarPhase));
            if (i % 65536 === 0) yield;
        }
    }
    return normalize(out, 0.06);
}

/** The partials of a struck temple bell: ratio to the fundamental, level, and decay time in seconds. */
const BELL_PARTIALS = [
    [0.5, 0.55, 3.6], [1, 1, 4.6], [1.19, 0.6, 3.3], [1.5, 0.45, 2.6], [2, 0.5, 2.3],
    [2.51, 0.22, 1.4], [3, 0.2, 1.1], [4.15, 0.12, 0.65], [5.43, 0.08, 0.42], [6.8, 0.05, 0.27],
];

/**
 * One strike of a temple bell. Each partial is a decaying sine, and each has a twin a hair
 * away in pitch, so the tone slowly swells and dims as the two beat against each other.
 * Higher partials die quickly, which is what makes the first moment bright and the tail
 * dark. It is not a loop.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { freq: fundamental in Hz, seconds, seed }
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* bellStrike(sr, { freq = 146.8, seconds = 11, seed = 5 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const [left, right] = out;
    for (const [ratio, level, tau] of BELL_PARTIALS) {
        for (const twin of [0, 1]) {
            const f = freq * ratio * (twin ? 1 + 0.0009 + r() * 0.0032 : 1);
            const w = (TAU * f) / sr;
            const decay = Math.exp(-1 / (tau * (0.85 + 0.3 * r()) * sr));
            const amp = level * (twin ? 0.7 : 1);
            const c = 2 * decay * Math.cos(w);
            const d2 = decay * decay;
            const attack = Math.max(8, Math.round(sr * (ratio < 1.2 ? 0.012 : 0.004)));
            const pan = (r() * 2 - 1) * 0.5;
            const gl = Math.cos(((pan + 1) * Math.PI) / 4);
            const gr = Math.sin(((pan + 1) * Math.PI) / 4);
            let y1 = amp * decay * Math.sin(w);
            let y2 = 0;
            for (let i = 1; i < n; i++) {
                const v = y1 * (i < attack ? i / attack : 1);
                left[i] += v * gl;
                right[i] += v * gr;
                const y0 = c * y1 - d2 * y2;
                y2 = y1;
                y1 = y0;
                if (i % 131072 === 0) yield;
            }
        }
    }
    // The clapper's knock: a short, dull thud
    const g = new Float32Array(Math.ceil(sr * 0.1));
    const len = noiseGrain(g, sr, r, 900, 0.8, 0.0008, 0.01, 0.6);
    mix(out, 0, g, len, 0);
    // A bell is never cut off: fade the last second and a half
    const fade = Math.round(sr * 1.5);
    let peak = 0;
    for (let i = 0; i < n; i++) {
        const k = n - i < fade ? (n - i) / fade : 1;
        left[i] *= k;
        right[i] *= k;
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const scale = 0.4 / (peak || 1);
    for (let i = 0; i < n; i++) { left[i] *= scale; right[i] *= scale; }
    return out;
}

/**
 * One thunderclap. It is not a loop.
 *
 * It is built to be low. The rumble is white noise through four one-pole lowpass stages,
 * so there is nothing above a few hundred hertz to hiss like paper, then it swells and
 * rolls by a slow random curve and goes through a soft clipper, which adds harmonics so a
 * small speaker has something to play. A sub-bass boom starts it and a few weaker thumps
 * follow as the sound comes back off the land. Overhead thunder also gets a short, dull
 * crack; far thunder arrives as a slow swell with no crack at all.
 * @param {number} sr - sample rate
 * @param {Object} [o] - { distance, seed }. distance 0 is overhead, 1 is far away.
 * @returns {Generator<void, Float32Array[]>} yields while working, returns [left, right]
 */
export function* thunderClap(sr, { distance = 0.4, seed = 1 } = {}) {
    const r = rng(seed);
    const near = 1 - distance;
    const seconds = 5.5 + r() * 2.5 + distance * 2;
    const out = stereo(sr, seconds);
    const n = out[0].length;

    // Loudness over time: the strike, then rolls as the sound returns off the land
    const env = new Float32Array(n);
    const bumps = [{ t: 0, a: 1, rise: 0.05 + distance * 0.45, fall: 0.9 + r() * 0.5 + distance * 0.7 }];
    for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
        const t = 0.5 + r() * seconds * 0.55;
        bumps.push({ t, a: (0.3 + r() * 0.5) * (1 - t / seconds), rise: 0.15 + r() * 0.4, fall: 0.7 + r() * 1.3 });
    }
    for (const b of bumps) {
        const start = Math.floor(b.t * sr);
        for (let i = start; i < n; i++) {
            const t = (i - start) / sr;
            const v = t < b.rise ? (t / b.rise) ** 1.5 : Math.exp(-(t - b.rise) / b.fall);
            if (t > b.rise && v < 0.002) break;
            env[i] += v * b.a;
        }
        yield;
    }

    const lp = fc => 1 - Math.exp((-TAU * fc) / sr);
    const kDeep = lp(105 + near * 80);
    const kBody = lp(300 + near * 250);
    const kSlow = lp(2.5);
    const kOut = lp(330 + near * 450);
    for (const ch of out) {
        const deep = new Float32Array(n);
        let a = 0, b = 0, c = 0, d = 0;
        for (let i = 0; i < n; i++) {
            const w = r() * 2 - 1;
            a += (w - a) * kDeep; b += (a - b) * kDeep; c += (b - c) * kDeep; d += (c - d) * kDeep;
            deep[i] = d;
            if (i % 65536 === 0) yield;
        }
        unitRms(deep);
        const body = new Float32Array(n);
        let e = 0, f = 0;
        for (let i = 0; i < n; i++) {
            const w = r() * 2 - 1;
            e += (w - e) * kBody; f += (e - f) * kBody;
            body[i] = f;
        }
        unitRms(body);
        // A slow random curve makes the rumble roll instead of sounding steady
        let s1 = 0, s2 = 0, o1 = 0, o2 = 0;
        for (let i = 0; i < n; i++) {
            s1 += ((r() * 2 - 1) - s1) * kSlow; s2 += (s1 - s2) * kSlow;
            const roll = Math.max(0.25, Math.min(1.7, 0.8 + s2 * 7));
            const fade = Math.min(1, (n - i) / (sr * 1.2));
            const x = Math.tanh(2.1 * (deep[i] + body[i] * 0.5) * env[i] * roll * fade);
            o1 += (x - o1) * kOut; o2 += (o1 - o2) * kOut;
            ch[i] = o2;
            if (i % 65536 === 0) yield;
        }
    }

    const g = new Float32Array(Math.ceil(sr * 0.6));
    // The crack, for strikes close by: two dull bursts, nothing bright
    if (near > 0.25) {
        for (let k = 2 + Math.floor(r() * 2); k > 0; k--) {
            const at = Math.floor((r() * 0.05) * sr);
            const len = noiseGrain(g, sr, r, 350 + r() * 600, 0.7, 0.0004, 0.004 + r() * 0.012, near * (0.5 + r() * 0.5) * 2.2);
            mix(out, at, g, Math.min(len, n - at), r() * 0.6 - 0.3);
        }
    }
    // The boom under it, and the thumps that follow
    const low = 42 + r() * 20;
    let len = sineGrain(g, sr, low * 1.25, low * 0.8, 0.22 + near * 0.1, 1.2);
    mix(out, 0, g, Math.min(len, n), 0);
    len = sineGrain(g, sr, low * 2.4, low * 1.8, 0.12, 0.45);
    mix(out, 0, g, Math.min(len, n), 0);
    for (let k = 2 + Math.floor(r() * 2); k > 0; k--) {
        const at = Math.floor((0.5 + r() * seconds * 0.4) * sr);
        len = sineGrain(g, sr, (low + 6) * 1.1, low * 0.85, 0.3, 0.5 * (1 - at / n));
        mix(out, at, g, Math.min(len, n - at), r() * 0.8 - 0.4);
    }

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
            seconds: 6.1, seed: 11, breathe: 0.3, ticks: 26, leaves: 14, drips: 2,
            bands: [
                { rate: 19800, hp: 1500, lp: 5000, level: 0.3 },
                { rate: 8400, hp: 350, lp: 1800, level: 1.12 },
                { rate: 4000, hp: 100, lp: 500, level: 0.6 },
            ],
        },
        {
            seconds: 7.7, seed: 12, breathe: 0.32, ticks: 18, leaves: 11, drips: 1.4,
            bands: [
                { rate: 17600, hp: 1600, lp: 5200, level: 0.3 },
                { rate: 9100, hp: 400, lp: 1600, level: 1.11 },
                { rate: 3500, hp: 90, lp: 450, level: 0.6 },
            ],
        },
    ],
    storm: [
        {
            seconds: 5.9, seed: 21, breathe: 0.5, gusts: 0.6, ticks: 52, leaves: 18, drips: 3,
            bands: [
                { rate: 26400, hp: 1500, lp: 5600, level: 0.4 },
                { rate: 11200, hp: 320, lp: 2000, level: 1.28 },
                { rate: 5000, hp: 70, lp: 450, level: 1 },
            ],
        },
        {
            seconds: 7.3, seed: 22, breathe: 0.55, gusts: 0.8, ticks: 40, leaves: 14, drips: 2.4,
            bands: [
                { rate: 24200, hp: 1600, lp: 5400, level: 0.4 },
                { rate: 10500, hp: 340, lp: 1900, level: 1.25 },
                { rate: 4500, hp: 60, lp: 400, level: 1.02 },
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
