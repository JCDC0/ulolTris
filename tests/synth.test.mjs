import { rainLoop, wheatLoop, thunder, runSync, RAIN_KINDS } from '../js/ambience-synth.js';

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

// Rain, storm and running water are made of single drops and bubbles, so they are peaky
for (const [kind, list] of Object.entries(RAIN_KINDS)) {
    list.forEach((options, i) => {
        const out = runSync(rainLoop(SR, { ...options, seconds: 3 }));
        const t = texture(out);
        check(`${kind} loop ${i + 1}: separate drops, not noise`, t.finite && t.kurtosis > 5 && t.variation > 0.3,
            `kurtosis ${t.kurtosis.toFixed(1)}, variation ${t.variation.toFixed(2)}`);
        check(`${kind} loop ${i + 1}: level is steady and does not clip`, Math.abs(t.rms - 0.085) < 0.01 && t.peak < 1,
            `rms ${t.rms.toFixed(3)}, peak ${t.peak.toFixed(2)}`);
    });
}
const storm = texture(runSync(rainLoop(SR, { ...RAIN_KINDS.storm[0], seconds: 3 })));
const light = texture(runSync(rainLoop(SR, { ...RAIN_KINDS.rain[0], seconds: 3 })));
check('a storm has more hard drops than light rain (denser, so less peaky)', storm.kurtosis < light.kurtosis);

// Wheat: stalks touching, in swells
for (const seed of [7, 8]) {
    const t = texture(runSync(wheatLoop(SR, { seed, seconds: 4 })));
    check(`wheat loop ${seed}: ticks and brushes in swells, not noise`, t.finite && t.kurtosis > 6 && t.variation > 0.5,
        `kurtosis ${t.kurtosis.toFixed(1)}, variation ${t.variation.toFixed(2)}`);
    check(`wheat loop ${seed}: quiet bed that does not clip`, Math.abs(t.rms - 0.06) < 0.01 && t.peak < 1, `rms ${t.rms.toFixed(3)}, peak ${t.peak.toFixed(2)}`);
}

// Loops join up: the jump across the loop point is no bigger than the loudest jump inside
{
    const [l] = runSync(wheatLoop(SR, { seed: 7, seconds: 4 }));
    let biggest = 0;
    for (let i = 1; i < l.length; i++) biggest = Math.max(biggest, Math.abs(l[i] - l[i - 1]));
    check('wheat loop joins up at its end', Math.abs(l[0] - l[l.length - 1]) <= biggest);
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
    check(`thunder at ${distance}: loudest at the start, nearly silent at the end`,
        windowRms(0, 1) > windowRms(seconds * 0.5, seconds * 0.5 + 1) * 1.5 && windowRms(seconds - 0.5, seconds) < windowRms(0, 1) * 0.05);
}
{
    // Distant thunder has no sharp crack: less energy in the first 50 ms than overhead thunder
    const first = d => { const [l] = thunder(SR, { distance: d, seed: 3 }); let e = 0; for (let i = 0; i < SR * 0.05; i++) e += l[i] ** 2; return e; };
    check('overhead thunder cracks harder than distant thunder', first(0.1) > first(0.8) * 2);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll synth checks passed');
process.exit(failures ? 1 : 0);
