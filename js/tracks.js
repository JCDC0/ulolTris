/**
 * tracks.js - Song data for the procedural soundtrack.
 *
 * All four tracks are original arrangements of Korobeiniki, the Russian folk song
 * (public domain) that the classic Tetris theme is based on. Nothing here is taken
 * from a commercial soundtrack.
 *
 * Notes are MIDI numbers written in A minor; each build function transposes its bars
 * (the chip track stays in A minor).
 * A bar is 16 steps (16th notes). Events: { s: start step, l: length in steps,
 * v: voice name, n: MIDI note (or null for drums), g: velocity 0..1 }.
 */

// --- Shared melody (A minor) ---

const A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79, A5 = 81;
const Gs4 = 68, Gs5 = 80;

/** Part A, eight bars: [note, start, length] */
const MELODY_A = [
    [[E5, 0, 4], [B4, 4, 2], [C5, 6, 2], [D5, 8, 4], [C5, 12, 2], [B4, 14, 2]],
    [[A4, 0, 4], [A4, 4, 2], [C5, 6, 2], [E5, 8, 4], [D5, 12, 2], [C5, 14, 2]],
    [[B4, 0, 6], [C5, 6, 2], [D5, 8, 4], [E5, 12, 4]],
    [[C5, 0, 4], [A4, 4, 4], [A4, 8, 4]],
    [[D5, 2, 4], [F5, 6, 2], [A5, 8, 4], [G5, 12, 2], [F5, 14, 2]],
    [[E5, 0, 6], [C5, 6, 2], [E5, 8, 4], [D5, 12, 2], [C5, 14, 2]],
    [[B4, 0, 4], [B4, 4, 2], [C5, 6, 2], [D5, 8, 4], [E5, 12, 4]],
    [[C5, 0, 4], [A4, 4, 4], [A4, 8, 4]],
];

/** Part B (the slow bridge), eight bars */
const MELODY_B = [
    [[E5, 0, 8], [C5, 8, 8]],
    [[D5, 0, 8], [B4, 8, 8]],
    [[C5, 0, 8], [A4, 8, 8]],
    [[Gs4, 0, 8], [B4, 8, 8]],
    [[E5, 0, 8], [C5, 8, 8]],
    [[D5, 0, 8], [B4, 8, 8]],
    [[C5, 0, 4], [E5, 4, 4], [A5, 8, 8]],
    [[Gs5, 0, 16]],
];

/** Descending run that fills the rest at the end of bars 4 and 8. */
const FILL = [[E5, 12, 1], [D5, 13, 1], [C5, 14, 1], [B4, 15, 1]];

// --- Chords (voicings in A minor space; `r` is the bass root) ---

const CH = {
    Am:     { c: [57, 60, 64], r: 45 },
    Am7:    { c: [57, 60, 64, 67], r: 45 },
    Am9:    { c: [57, 60, 64, 67, 71], r: 45 },
    Amadd9: { c: [57, 60, 64, 71], r: 45 },
    F:      { c: [53, 57, 60], r: 41 },
    Fmaj7:  { c: [53, 57, 60, 64], r: 41 },
    E:      { c: [52, 56, 59], r: 40 },
    E7:     { c: [52, 56, 59, 62], r: 40 },
    E7sus4: { c: [52, 57, 59, 62], r: 40 },
    E7b9:   { c: [52, 56, 59, 62, 65], r: 40 },
    Dm:     { c: [50, 53, 57], r: 38 },
    Dm9:    { c: [50, 53, 57, 60, 64], r: 38 },
    C:      { c: [48, 52, 55, 60], r: 36 },
    Cmaj7:  { c: [48, 55, 59, 64], r: 36 },
    G:      { c: [55, 59, 62], r: 43 },
    G6:     { c: [55, 59, 62, 64], r: 43 },
    Bm7b5:  { c: [47, 50, 53, 57], r: 35 },
};

/**
 * A bar's harmony: one chord name, or two names split at the half bar.
 * @returns {Array<{at:number, len:number, ch:Object}>}
 */
function harmony(spec) {
    if (Array.isArray(spec)) {
        return [{ at: 0, len: 8, ch: CH[spec[0]] }, { at: 8, len: 8, ch: CH[spec[1]] }];
    }
    return [{ at: 0, len: 16, ch: CH[spec] }];
}

// --- Helpers ---

const SCALE_PCS = [9, 11, 0, 2, 4, 5, 7]; // A natural minor, from A

/** Diatonic third below, used for harmony lines. G# is treated as G. */
function thirdBelow(midi) {
    const pc = ((midi % 12) + 12) % 12 === 8 ? 7 : ((midi % 12) + 12) % 12;
    const deg = SCALE_PCS.indexOf(pc);
    const target = SCALE_PCS[(deg + 5) % 7];
    let n = midi - 1;
    while (((n % 12) + 12) % 12 !== target) n--;
    return n;
}

function melodyEvents(notes, voice, vel, shift = 0) {
    return notes.map(([n, s, l]) => ({ s, l, v: voice, n: n + shift, g: vel }));
}

function drum(voice, steps, vel) {
    return steps.map(s => ({ s, l: 1, v: voice, n: null, g: vel }));
}

function transposeBar(events, semitones) {
    return events.map(e => (e.n === null ? e : { ...e, n: e.n + semitones }));
}

// --- Calm: C minor, slow and swung, reharmonized ---

const CALM_A = ['Am9', 'Fmaj7', ['E7sus4', 'E7'], 'Am7', 'Dm9', 'Cmaj7', ['Bm7b5', 'E7'], 'Amadd9'];
const CALM_B = ['Am9', 'G6', 'Fmaj7', 'E7', 'Am9', 'G6', 'Fmaj7', 'E7b9'];

function calmBacking(spec, withDrums) {
    const events = [];
    for (const seg of harmony(spec)) {
        for (const n of seg.ch.c) {
            events.push({ s: seg.at, l: seg.len === 16 ? 10 : seg.len, v: 'epiano', n, g: 0.2 });
            if (seg.len === 16) events.push({ s: 10, l: 6, v: 'epiano', n, g: 0.12 });
            events.push({ s: seg.at, l: seg.len, v: 'pad', n: n + 12, g: 0.07 });
        }
        events.push({ s: seg.at, l: seg.len === 16 ? 8 : seg.len, v: 'softbass', n: seg.ch.r, g: 0.38 });
        if (seg.len === 16) events.push({ s: 8, l: 8, v: 'softbass', n: seg.ch.r + 7, g: 0.3 });
    }
    if (withDrums) {
        events.push(...drum('lofikick', [0, 10], 0.6));
        events.push(...drum('rim', [8], 0.25));
        events.push(...drum('brush', [2, 6, 10, 14], 0.12));
    }
    return events;
}

function buildCalm() {
    const bars = [];
    // Intro: two bars of chords only
    bars.push(calmBacking('Am9', false), calmBacking('Fmaj7', false));
    // A1: the melody as written, on a bell
    for (let i = 0; i < 8; i++) {
        bars.push([...calmBacking(CALM_A[i], true), ...melodyEvents(MELODY_A[i], 'bell', 0.7)]);
    }
    // A2: runs fill the gaps, and the second half climbs an octave
    for (let i = 0; i < 8; i++) {
        const shift = i >= 4 ? 12 : 0;
        const mel = melodyEvents(MELODY_A[i], 'bell', i >= 4 ? 0.55 : 0.7, shift);
        if (i === 3 || i === 7) mel.push(...melodyEvents(FILL, 'bell', 0.4, shift));
        bars.push([...calmBacking(CALM_A[i], true), ...mel]);
    }
    // B: the bridge with a broken-chord countermelody
    for (let i = 0; i < 8; i++) {
        const arp = harmony(CALM_B[i]).flatMap(seg =>
            [0, 2, 4, 6].filter(s => s < seg.len).map((s, k) => ({
                s: seg.at + s, l: 2, v: 'epiano', n: seg.ch.c[k % seg.ch.c.length] + 12, g: 0.14,
            })));
        bars.push([...calmBacking(CALM_B[i], true), ...arp, ...melodyEvents(MELODY_B[i], 'bell', 0.65)]);
    }
    // A3: the melody with a soft harmony a third below
    for (let i = 0; i < 8; i++) {
        const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
        bars.push([
            ...calmBacking(CALM_A[i], true),
            ...melodyEvents(MELODY_A[i], 'bell', 0.65),
            ...melodyEvents(harm, 'epiano', 0.16, 12),
        ]);
    }
    return bars.map(b => transposeBar(b, 3));
}

// --- Competitive: D minor, 150 BPM, driving ---

const COMP_A = ['Am', 'F', 'E', 'Am', 'Dm', 'C', ['G', 'E'], 'Am'];
const COMP_B = ['F', 'G', 'Am', 'E', 'F', 'G', 'Am', 'E'];

function compBacking(spec, { fill = false, drums = true } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
        for (let s = 0; s < seg.len; s += 2) {
            events.push({ s: seg.at + s, l: 2, v: 'bass', n: seg.ch.r + (s % 4 === 2 ? 12 : 0), g: 0.36 });
        }
        for (let s = 0; s < seg.len; s++) {
            const tones = seg.ch.c;
            events.push({ s: seg.at + s, l: 1, v: 'pluck', n: tones[s % tones.length] + 12, g: 0.16 });
        }
        for (const n of seg.ch.c) events.push({ s: seg.at, l: seg.len, v: 'pad', n, g: 0.06 });
    }
    if (drums) {
        events.push(...drum('kick', [0, 4, 8, 12], 0.8));
        events.push(...drum('snare', fill ? [4, 12, 13, 14, 15] : [4, 12], 0.55));
        events.push(...drum('hat', [2, 6, 10, 14], 0.3));
        events.push(...drum('hat', [1, 3, 5, 7, 9, 11, 13, 15], 0.1));
    }
    return events;
}

function buildCompetitive() {
    const bars = [];
    // Intro: bass and drums
    bars.push(compBacking('Am'), compBacking('F', { fill: true }));
    // A1
    for (let i = 0; i < 8; i++) {
        bars.push([...compBacking(COMP_A[i], { fill: i === 7 }), ...melodyEvents(MELODY_A[i], 'lead', 0.46)]);
    }
    // A2: an octave up with a harmony line
    for (let i = 0; i < 8; i++) {
        const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
        bars.push([
            ...compBacking(COMP_A[i], { fill: i === 7 }),
            ...melodyEvents(MELODY_A[i], 'lead', 0.4, 12),
            ...melodyEvents(harm, 'lead', 0.16, 12),
        ]);
    }
    // B: the bridge over a brighter progression
    for (let i = 0; i < 8; i++) {
        bars.push([...compBacking(COMP_B[i], { fill: i === 7 }), ...melodyEvents(MELODY_B[i], 'lead', 0.44)]);
    }
    // A3: melody back down, with fills
    for (let i = 0; i < 8; i++) {
        const mel = melodyEvents(MELODY_A[i], 'lead', 0.46);
        if (i === 3) mel.push(...melodyEvents(FILL, 'lead', 0.24));
        bars.push([...compBacking(COMP_A[i], { fill: i === 7 }), ...mel]);
    }
    return bars.map(b => transposeBar(b, 5));
}

// --- Intense: E minor (melody an octave down), 176 BPM ---

const INT_A = ['Am', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'Am'];
const INT_B = ['Am', 'E', 'Am', 'E', 'F', 'G', 'Am', 'E'];

function intenseBacking(spec, { crash = false, fill = false } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
        for (let s = 0; s < seg.len; s++) {
            const up = s % 8 === 6;
            events.push({ s: seg.at + s, l: 1, v: 'bass', n: seg.ch.r + (up ? 12 : 0), g: s % 4 === 0 ? 0.4 : 0.26 });
        }
        for (const s of [0, 3, 6].filter(x => x < seg.len)) {
            for (const n of seg.ch.c) events.push({ s: seg.at + s, l: 1, v: 'stab', n: n + 12, g: 0.13 });
        }
        for (const n of seg.ch.c) events.push({ s: seg.at, l: seg.len, v: 'pad', n: n + 12, g: 0.05 });
    }
    events.push(...drum('kick', [0, 4, 8, 10, 12], 0.85));
    events.push(...drum('snare', fill ? [4, 10, 11, 12, 13, 14, 15] : [4, 12], 0.6));
    events.push(...drum('hat', [...Array(16).keys()], 0.14));
    if (crash) events.push(...drum('crash', [0], 0.35));
    return events;
}

function buildIntense() {
    const bars = [];
    // A1: melody doubled at the octave
    for (let i = 0; i < 8; i++) {
        bars.push([
            ...intenseBacking(INT_A[i], { crash: i === 0, fill: i === 7 }),
            ...melodyEvents(MELODY_A[i], 'lead', 0.46, -12),
            ...melodyEvents(MELODY_A[i], 'lead', 0.12),
        ]);
    }
    // A2: melody an octave up, harmony below
    for (let i = 0; i < 8; i++) {
        const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
        bars.push([
            ...intenseBacking(INT_A[i], { crash: i === 0, fill: i === 7 }),
            ...melodyEvents(MELODY_A[i], 'lead', 0.42),
            ...melodyEvents(harm, 'lead', 0.18),
        ]);
    }
    // B: the bridge in double time, each long note repeated in eighths
    for (let i = 0; i < 8; i++) {
        const chopped = MELODY_B[i].flatMap(([n, s, l]) => {
            const out = [];
            for (let k = 0; k < l; k += 2) out.push([n, s + k, 2]);
            return out;
        });
        bars.push([
            ...intenseBacking(INT_B[i], { crash: i === 0, fill: i === 7 }),
            ...melodyEvents(chopped, 'lead', 0.4, -12),
            ...melodyEvents(chopped, 'lead', 0.1),
        ]);
    }
    return bars.map(b => transposeBar(b, 7));
}

// --- Chip: A minor, 150 BPM, three channels and noise, like an 8-bit console ---

const CHIP_A = ['Am', 'Am', 'E', 'Am', 'Dm', 'C', 'E', 'Am'];
const CHIP_B = ['Am', 'G', 'F', 'E', 'Am', 'G', 'Am', 'E'];

/**
 * Backing: a triangle bass that bounces between root and octave, and the second pulse
 * channel on chord stabs or a running arpeggio. `drums` is 'none', 'beat' or 'full'.
 */
function chipBacking(spec, { arp = false, drums = 'none', fill = false } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
        for (let s = 0; s < seg.len; s += 2) {
            events.push({ s: seg.at + s, l: 2, v: 'chipBass', n: seg.ch.r + (s % 4 === 2 ? 12 : 0), g: 0.52 });
        }
        const tones = seg.ch.c;
        if (arp) {
            for (let s = 0; s < seg.len; s++) {
                events.push({ s: seg.at + s, l: 1, v: 'chipHarm', n: tones[s % tones.length] + 12, g: 0.09 });
            }
        } else {
            for (let s = 2; s < seg.len; s += 4) {
                for (const n of tones.slice(1, 3)) events.push({ s: seg.at + s, l: 1, v: 'chipHarm', n: n + 12, g: 0.09 });
            }
        }
    }
    if (drums !== 'none') {
        events.push(...drum('chipKick', drums === 'full' ? [0, 4, 8, 12] : [0, 8], 0.55));
        events.push(...drum('chipSnare', fill ? [4, 12, 13, 14, 15] : [4, 12], 0.34));
        events.push(...drum('chipHat', drums === 'full' ? [2, 6, 10, 14] : [], 0.18));
    }
    return events;
}

function buildChip() {
    const bars = [];
    // A1: the melody on the lead, bass and stabs underneath, no drums
    for (let i = 0; i < 8; i++) {
        bars.push([...chipBacking(CHIP_A[i]), ...melodyEvents(MELODY_A[i], 'chipLead', 0.35)]);
    }
    // A2: a harmony line joins on the second pulse, with a plain beat
    for (let i = 0; i < 8; i++) {
        const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
        bars.push([
            ...chipBacking(CHIP_A[i], { drums: 'beat', fill: i === 7 }).filter(e => e.v !== 'chipHarm'),
            ...melodyEvents(MELODY_A[i], 'chipLead', 0.35),
            ...melodyEvents(harm, 'chipHarm', 0.13),
        ]);
    }
    // B: the slow bridge, with the second pulse running arpeggios
    for (let i = 0; i < 8; i++) {
        bars.push([...chipBacking(CHIP_B[i], { arp: true, drums: 'beat', fill: i === 7 }), ...melodyEvents(MELODY_B[i], 'chipLead', 0.35)]);
    }
    // A3: an octave up with a full beat and fills
    for (let i = 0; i < 8; i++) {
        const mel = melodyEvents(MELODY_A[i], 'chipLead', 0.3, 12);
        if (i === 3 || i === 7) mel.push(...melodyEvents(FILL, 'chipLead', 0.23, 12));
        bars.push([...chipBacking(CHIP_A[i], { drums: 'full', fill: i === 7 }), ...mel]);
    }
    return bars;
}

/**
 * Track table. `loopStart` is the bar the loop returns to (skipping the intro).
 * `swing` delays off-beat eighths by that fraction of a 16th.
 */
export const TRACKS = {
    calm:        { bpm: 88,  swing: 0.35, delay: 0.3, loopStart: 2, bars: buildCalm() },
    competitive: { bpm: 150, swing: 0,    delay: 0.12, loopStart: 2, bars: buildCompetitive() },
    intense:     { bpm: 176, swing: 0,    delay: 0.08, loopStart: 0, bars: buildIntense() },
    chip:        { bpm: 150, swing: 0,    delay: 0,    loopStart: 0, bars: buildChip() },
};

export const TRACK_NAMES = Object.keys(TRACKS);
