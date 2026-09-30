import { rainLoop, wheatLoop, windLoop, surfLoop, bellStrike, thunder, runSync, RAIN_KINDS } from '../js/ambience-synth.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

const SR = 22050;

/** Peakiness (kurtosis) and how much loudness changes from one 20 ms window to the next. */
function texture([left]) {
    const n = left.length;
    let sum = 0, sum4 = 0, peak = 0, finite = true;
    for (let i = 0; i < n; i++) {
        const v = left[i];
        if (!Number.isFinite(v)) finite = false;
        sum += v * v;
        sum4 += v ** 4;
        peak = Math.max(peak, Math.abs(v));
    }
    const rms = Math.sqrt(sum / n);
    const w = Math.round(SR * 0.02);
    const levels = [];
    for (let i = 0; i + w < n; i += w) {
        let e = 0;
        for (let j = 0; j < w; j++) e += left[i + j] ** 2;
        levels.push(Math.sqrt(e / w));
    }
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const sd = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length);
    return { rms, peak, finite, kurtosis: sum4 / n / (sum / n) ** 2, variation: sd / mean };
}

// The reference the old sounds were built from: steady white noise
let seed = 1;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const white = new Float32Array(SR * 4).map(() => (noise() + noise() + noise() + noise()) / 2);
const reference = texture([white]);
check('white noise reference is flat (kurtosis near 3, no loudness variation)', reference.kurtosis < 3.5 && reference.variation < 0.1,
    `kurtosis ${reference.kurtosis.toFixed(1)}, variation ${reference.variation.toFixed(2)}`);

/** How much of a signal's energy is below 300 Hz and above 6 kHz (crude one-pole splits). */
function balance([left]) {
    const kLow = 1 - Math.exp((-2 * Math.PI * 300) / SR);
    const kHigh = 1 - Math.exp((-2 * Math.PI * 6000) / SR);
    let low = 0, lowE = 0, high = 0, highE = 0, all = 0;
    for (let i = 0; i < left.length; i++) {
        low += (left[i] - low) * kLow;
        high += (left[i] - high) * kHigh;
        lowE += low * low;
        highE += (left[i] - high) ** 2;
        all += left[i] ** 2;
    }
    return { low: lowE / all, high: highE / all };
}

/** Share of a signal's energy below a cutoff (a one-pole lowpass, so a rough split). */
function below([left], fc) {
    const k = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    let low = 0, lowE = 0, all = 0;
    for (let i = 0; i < left.length; i++) {
        low += (left[i] - low) * k;
        lowE += low * low;
        all += left[i] ** 2;
    }
    return lowE / all;
}

/** RMS of each window of `seconds`. */
function windows([left], seconds) {
    const w = Math.round(SR * seconds);
    const out = [];
    for (let i = 0; i + w <= left.length; i += w) {
        let e = 0;
        for (let j = 0; j < w; j++) e += left[i + j] ** 2;
        out.push(Math.sqrt(e / w));
    }
    return out;
}

/** The jump across a loop's end is no bigger than the loudest jump inside it. */
function joinsUp([l]) {
    let biggest = 0;
    for (let i = 1; i < l.length; i++) biggest = Math.max(biggest, Math.abs(l[i] - l[i - 1]));
    return Math.abs(l[0] - l[l.length - 1]) <= biggest;
}

// Rain, storm and running water are a shower with droplets on top. The shower is dense and
// smooth (no pops), it breathes, it is warm (not a wall of hiss and not a rumble), and it
// stays steady in level and does not clip.
for (const [kind, list] of Object.entries(RAIN_KINDS)) {
    list.forEach((options, i) => {
        const out = runSync(rainLoop(SR, { ...options, seconds: 3 }));
        const t = texture(out);
        const b = balance(out);
        const breathes = kind === 'storm' ? 0.1 : kind === 'rain' ? 0.06 : 0.04;
        check(`${kind} loop ${i + 1}: a steady shower that moves, not flat noise`, t.finite && t.kurtosis > 3.3 && t.kurtosis < 7 && t.variation > breathes,
            `kurtosis ${t.kurtosis.toFixed(1)}, variation ${t.variation.toFixed(2)}`);
        const lowest = kind === 'water' ? 0.14 : 0.11;
        check(`${kind} loop ${i + 1}: warm, neither all hiss nor all rumble`, b.low < lowest && b.high < 0.45,
            `below 300 Hz ${(b.low * 100).toFixed(0)} %, above 6 kHz ${(b.high * 100).toFixed(0)} %`);
        check(`${kind} loop ${i + 1}: level is steady and does not clip`, Math.abs(t.rms - 0.085) < 0.01 && t.peak < 1,
            `rms ${t.rms.toFixed(3)}, peak ${t.peak.toFixed(2)}`);
    });
}
const storm = texture(runSync(rainLoop(SR, { ...RAIN_KINDS.storm[0], seconds: 3 })));
const light = texture(runSync(rainLoop(SR, { ...RAIN_KINDS.rain[0], seconds: 3 })));
check('a storm swells and eases more than light rain', storm.variation > light.variation * 1.3,
    `${storm.variation.toFixed(2)} against ${light.variation.toFixed(2)}`);

// The droplets are there but subtle: they add a few per cent of the energy, in short taps
// that stand several times above the shower, and they do not pitch up into bloops
{
    const options = RAIN_KINDS.rain[0];
    const shower = runSync(rainLoop(SR, { ...options, seconds: 3, ticks: 0, leaves: 0, drips: 0 }))[0];
    const full = runSync(rainLoop(SR, { ...options, seconds: 3 }))[0];
    let e = 0, eShower = 0, peak = 0;
    for (let i = 0; i < full.length; i++) {
        const d = full[i] - shower[i];
        e += d * d;
        eShower += shower[i] ** 2;
        peak = Math.max(peak, Math.abs(d));
    }
    const share = e / eShower;
    const showerRms = Math.sqrt(eShower / full.length);
    check('droplets are audible but subtle (2 to 10 % of the shower energy)', share > 0.02 && share < 0.1, `${(share * 100).toFixed(1)} %`);
    check('droplets are short taps that stand well above the shower', peak > showerRms * 3, `peak ${(peak / showerRms).toFixed(1)}x the shower level`);
}

// Wheat: soft brushes in swells. Airy (nothing low, most of it above 1 kHz), quiet, and with
// no sharp clicks: a click is a sample that jumps far from its neighbour, and the ticks that
// made the old wheat sound like splashing water were exactly that.
for (const seed of [7, 8]) {
    const out = runSync(wheatLoop(SR, { seed, seconds: 6 }));
    const t = texture(out);
    check(`wheat loop ${seed}: brushes in swells, not steady noise`, t.finite && t.kurtosis > 4 && t.variation > 0.5,
        `kurtosis ${t.kurtosis.toFixed(1)}, variation ${t.variation.toFixed(2)}`);
    check(`wheat loop ${seed}: airy, with nothing below 300 Hz and little below 1 kHz`, below(out, 300) < 0.03 && below(out, 1000) < 0.25,
        `below 300 Hz ${(below(out, 300) * 100).toFixed(0)} %, below 1 kHz ${(below(out, 1000) * 100).toFixed(0)} %`);
    check(`wheat loop ${seed}: a very quiet bed that does not clip`, Math.abs(t.rms - 0.05) < 0.01 && t.peak < 0.8, `rms ${t.rms.toFixed(3)}, peak ${t.peak.toFixed(2)}`);
    check(`wheat loop ${seed}: no sharp clicks`, t.peak < t.rms * 9, `peak ${(t.peak / t.rms).toFixed(1)}x rms`);
}

check('wheat loop joins up at its end', joinsUp(runSync(wheatLoop(SR, { seed: 7, seconds: 4 }))));

// Wind: a band that rises and brightens in gusts. Loud and quiet stretches, nothing hissy, and
// a gale gusts harder than a breeze
{
    const breeze = runSync(windLoop(SR, { seconds: 8, seed: 41, gusty: 0.6 }));
    const gale = runSync(windLoop(SR, { seconds: 8, seed: 43, gusty: 0.9, howl: 0.8 }));
    const b = texture(breeze), g = texture(gale);
    check('breeze: swells and eases, and is warm rather than hissy', b.finite && b.variation > 0.3 && below(breeze, 3000) > 0.7 && below(breeze, 150) < 0.4,
        `variation ${b.variation.toFixed(2)}, below 3 kHz ${(below(breeze, 3000) * 100).toFixed(0)} %, below 150 Hz ${(below(breeze, 150) * 100).toFixed(0)} %`);
    check('gale: gusts harder than a breeze and does not clip', g.variation > b.variation && g.peak < 1 && Math.abs(g.rms - 0.085) < 0.01,
        `variation ${g.variation.toFixed(2)} against ${b.variation.toFixed(2)}, peak ${g.peak.toFixed(2)}`);
    check('wind loops join up at their ends', joinsUp(breeze) && joinsUp(gale));
}

// Surf: each wave builds, breaks, then washes back with a fading fizz, and the sea between
// waves is never dead
{
    const surf = runSync(surfLoop(SR, { seconds: 30, waves: 3, seed: 51 }));
    const half = windows(surf, 0.5);
    const peak = Math.max(...half);
    const at = half.indexOf(peak);
    const gathering = half.slice(Math.max(0, at - 6), at - 3).reduce((a, b) => a + b, 0) / 3;
    const after = half[at + 2];
    const quietest = Math.min(...half);
    const t = texture(surf);
    check('surf: a wave gathers before it breaks', gathering < peak * 0.35, `${(gathering / peak).toFixed(2)} of the peak, 1.5 to 3 s before it`);
    check('surf: the wash recedes after the crash', after < peak * 0.6 && half[at + 6] < peak * 0.25, `${(after / peak).toFixed(2)} of the peak a second later`);
    check('surf: never dead between waves, never a wall of noise', quietest > 0.004 && peak > quietest * 6, `quietest ${quietest.toFixed(3)}, loudest ${peak.toFixed(2)}`);
    check('surf: quiet overall and does not clip', t.finite && Math.abs(t.rms - 0.06) < 0.02 && t.peak < 1, `rms ${t.rms.toFixed(3)}, peak ${t.peak.toFixed(2)}`);
    check('surf loop joins up at its end', joinsUp(surf));
}

// Bell: a bright start and a dark tail, nothing harsh, and it dies away
{
    const bell = runSync(bellStrike(SR, { freq: 146.8, seconds: 11, seed: 5 }));
    const secs = windows(bell, 1);
    const t = texture(bell);
    check('bell: rings out and is nearly silent at the end', secs[0] > secs[6] * 4 && secs[secs.length - 1] < secs[0] * 0.05,
        `first second ${secs[0].toFixed(3)}, seventh ${secs[6].toFixed(3)}`);
    check('bell: dark and warm, with almost nothing above 3 kHz', 1 - below(bell, 3000) < 0.05, `${((1 - below(bell, 3000)) * 100).toFixed(1)} % above`);
    check('bell: finite, under full scale', t.finite && t.peak < 0.45, `peak ${t.peak.toFixed(2)}`);
    // Tone quality: energy sits on the bell's partials, not spread like noise
    check('bell: tonal, not noisy (high kurtosis in its ring)', t.kurtosis > 2.5, `kurtosis ${t.kurtosis.toFixed(1)}`);
}

// Thunder: a strike, then a rumble that rolls and dies away
for (const distance of [0.1, 0.45, 0.8]) {
    const out = thunder(SR, { distance, seed: 3 });
    const [l] = out;
    const seconds = l.length / SR;
    const windowRms = (from, to) => {
        let e = 0;
        const a = Math.floor(from * SR), b = Math.min(l.length, Math.floor(to * SR));
        for (let i = a; i < b; i++) e += l[i] ** 2;
        return Math.sqrt(e / (b - a));
    };
    const t = texture(out);
    check(`thunder at ${distance}: long, finite and under full scale`, t.finite && seconds > 4 && t.peak <= 0.96, `${seconds.toFixed(1)} s, peak ${t.peak.toFixed(2)}`);
    const loud = Math.max(windowRms(0, 1), windowRms(1, 2));
    check(`thunder at ${distance}: loudest in the first two seconds, nearly silent at the end`,
        loud > windowRms(seconds * 0.5, seconds * 0.5 + 1) * 1.5 && windowRms(seconds - 0.5, seconds) < loud * 0.05);
    // Paper crackle lives above about 600 Hz. A boom has almost nothing there.
    check(`thunder at ${distance}: a low boom, not crackle (almost nothing above 600 Hz)`,
        1 - below(out, 600) < 0.08 && below(out, 300) > 0.85,
        `${((1 - below(out, 600)) * 100).toFixed(1)} % above 600 Hz, ${(below(out, 300) * 100).toFixed(0)} % below 300 Hz`);
    check(`thunder at ${distance}: rolls instead of holding steady`, t.variation > 0.4, `variation ${t.variation.toFixed(2)}`);
}
{
    // Distant thunder has no crack: less sharp change in the first 50 ms (a boom is slow, a crack is not)
    const sharp = d => { const [l] = thunder(SR, { distance: d, seed: 3 }); let e = 0; for (let i = 1; i < SR * 0.05; i++) e += (l[i] - l[i - 1]) ** 2; return e; };
    check('overhead thunder cracks harder than distant thunder', sharp(0.1) > sharp(0.8) * 2);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll synth checks passed');
process.exit(failures ? 1 : 0);
