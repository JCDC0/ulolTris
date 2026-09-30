/**
 * tracks.js - Song data for the procedural soundtrack: nine original tracks in three
 * playlists (casual, competitive, intense). The melodies, chord changes and grooves are
 * all written here; nothing is taken from another piece of music, and none of it is
 * Korobeiniki (the folk song behind the classic Tetris theme), which earlier versions used.
 *
 * | Playlist    | Tracks                                                     |
 * | casual      | Rainy Window (lo-fi), Midnight Blue (jazz), Corner Cafe (bossa nova) |
 * | competitive | Neon Circuit (synthwave), Pulse Driver (melodic house), Night Shift (future funk) |
 * | intense     | Redline (drum and bass), Overclock (hard trance), Static Storm (bass music) |
 *
 * A track is written as two eight-bar chord loops (A and B), a melody for each in a
 * small text notation, and a groove: a function that turns each bar's chords into bass,
 * chords and drums. `compose()` lays them out as intro, A, B, A again with a harmony, and B
 * again, and the song loops from the first A.
 *
 * Bars are 16 steps (16th notes). An event is { s: start step, l: length in steps,
 * v: voice name (see voices.js), n: MIDI note (null for most drums), g: velocity 0..1 }.
 * Bars are built the first time a track is asked for.
 */

// --- Notes and chords ---

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };

/** Intervals above the root, in the order root, third, fifth, seventh, then extensions. */
const QUALITY = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], '13': [0, 4, 7, 10, 14, 21], m7b5: [0, 3, 6, 10],
    '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15],
};
/** Which chord tones a voicing keeps first: third, seventh, ninth, root, fifth, thirteenth. */
const PRIORITY = [1, 3, 4, 0, 2, 5];

/**
 * Parse a note name such as "Eb4" or "C#5" to a MIDI number (C4 = 60).
 * @param {string} name
 * @returns {number}
 */
export function midi(name) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error(`bad note name: ${name}`);
    return PC[m[1]] + 12 * (Number(m[2]) + 1);
}

/**
 * A chord by name ("Fm9", "C7b9") moved by `shift` semitones.
 * @returns {{ name: string, root: number, tones: number[], pcs: number[] }} root and pcs are pitch classes
 */
export function chordInfo(name, shift = 0) {
    const m = /^([A-G][#b]?)(.*)$/.exec(name);
    const tones = m && QUALITY[m[2]];
    if (!tones) throw new Error(`unknown chord: ${name}`);
    const root = (PC[m[1]] + shift + 120) % 12;
    return { name, root, tones, pcs: tones.map(t => (root + t) % 12) };
}

const nearest = (pc, center) => Math.round((center - pc) / 12) * 12 + pc;

/** The notes of a voicing of a chord, close to `center`: `count` of its tones, rootless if asked. */
function voicing(chord, center, count, rootless = false) {
    const order = PRIORITY.filter(k => k < chord.tones.length && !(rootless && k === 0));
    const notes = order.slice(0, count).map(k => nearest((chord.root + chord.tones[k]) % 12, center));
    return [...new Set(notes)].sort((a, b) => a - b);
}

/** The chord's root as a note at or above `low`. */
const bassNote = (chord, low) => low + (((chord.root - low) % 12) + 12) % 12;

/**
 * One bar's harmony as segments: a chord name for the whole bar, or a list of 2 or 4 names.
 * @returns {Array<{ at: number, len: number, chord: Object }>}
 */
export function segments(spec, shift = 0) {
    const list = Array.isArray(spec) ? spec : [spec];
    const len = 16 / list.length;
    return list.map((name, k) => ({ at: k * len, len, chord: chordInfo(name, shift) }));
}

/**
 * Parse a melody: bars separated by "|", each a list of "Note:steps" and "r:steps" (rest).
 * Every bar must add up to 16 steps.
 * @returns {Array<Array<{ s: number, l: number, n: number }>>}
 */
export function parseMelody(text, shift = 0) {
    return text.trim().split('|').map((bar, b) => {
        let s = 0;
        const notes = [];
        for (const token of bar.trim().split(/\s+/)) {
            const [name, len] = token.split(':');
            const l = Number(len);
            if (name !== 'r') notes.push({ s, l, n: midi(name) + shift });
            s += l;
        }
        if (s !== 16) throw new Error(`melody bar ${b + 1} adds up to ${s} steps: ${bar.trim()}`);
        return notes;
    });
}

/** The pitch classes of a key. */
export function scalePcs(key, shift = 0) {
    return MODES[key.mode].map(iv => (PC[key.root] + shift + iv) % 12);
}

/** The note two scale steps below, for a harmony line; null if the note is not in the scale. */
function thirdBelow(n, scale) {
    if (!scale.includes(n % 12)) return null;
    let m = n;
    for (let steps = 0; steps < 2;) {
        m--;
        if (scale.includes(((m % 12) + 12) % 12)) steps++;
    }
    return m;
}

const ev = (s, l, v, n, g) => ({ s, l, v, n, g });
const drum = (v, steps, g) => steps.map(s => ev(s, 1, v, null, g));
const steps16 = Array.from({ length: 16 }, (_, i) => i);

// --- Grooves ---
// A groove is a factory returning (ctx) => events for one bar, so it can keep a little
// state (the walking bass remembers where it was). ctx: { segs, next (the next bar's first
// chord), i (bar within the section), bar (within the song), name (section), energy (0..1),
// first, last }. Sections named 'intro' leave the drums out, and in the dance tracks the
// first four bars of B are a breakdown (no kick) that builds into the drop.

/** Lo-fi hip hop: dusty keys, a round sub, a boom-bap beat and a little vinyl. */
function lofi() {
    return ({ segs, i, bar, name, energy }) => {
        const e = [];
        for (const seg of segs) {
            const keys = voicing(seg.chord, 58, 4);
            const first = Math.min(9, seg.len - 1);
            keys.forEach((n, k) => e.push(ev(seg.at + (k >= 3 ? 1 : 0), first, 'lofikeys', n, 0.17)));
            if (seg.len === 16) keys.forEach((n, k) => e.push(ev(10 + (k >= 3 ? 1 : 0), 5, 'lofikeys', n, 0.1)));
            const root = bassNote(seg.chord, 33);
            e.push(ev(seg.at, seg.len === 16 ? 8 : seg.len - 1, 'sub', root, 0.5));
            if (seg.len === 16) e.push(ev(10, 4, 'sub', root + (i % 2 ? 7 : 0), 0.38));
            if (energy > 0.75) for (const n of voicing(seg.chord, 70, 3, true)) e.push(ev(seg.at, seg.len, 'warmpad', n, 0.05));
        }
        if (name !== 'intro') {
            e.push(...drum('lofikick', i % 2 ? [0, 6, 10] : [0, 7, 10], 0.6));
            e.push(...drum('softsnare', [4, 12], 0.42));
            for (let s = 0; s < 16; s += 2) e.push(ev(s, 1, 'hatc', null, s % 4 === 0 ? 0.22 : 0.13));
            if (i % 4 === 3) e.push(ev(15, 1, 'hatc', null, 0.15));
        }
        for (const s of [1, 5, 9, 13]) if ((bar * 5 + s * 3) % 7 < 2) e.push(ev(s, 1, 'tick', null, 0.25));
        return e;
    };
}

/** Swing jazz: a walking bass with approach notes, shell voicings in a charleston rhythm, ride and brushes. */
function jazz() {
    let prev = 43;
    const near = (pc, ref) => {
        let n = nearest(pc, ref);
        while (n < 36) n += 12;
        while (n > 55) n -= 12;
        return n;
    };
    return ({ segs, next, i, bar, name, energy }) => {
        const e = [];
        segs.forEach((seg, si) => {
            const c = seg.chord;
            const beats = seg.len / 4;
            const pattern = [c.root, (c.root + c.tones[1]) % 12, (c.root + c.tones[2]) % 12, (c.root + (c.tones[3] ?? c.tones[2])) % 12];
            const target = (si + 1 < segs.length ? segs[si + 1].chord : next).root;
            for (let b = 0; b < beats; b++) {
                let note;
                if (b === beats - 1) {
                    const up = near((target + 1) % 12, prev), down = near((target + 11) % 12, prev);
                    note = Math.abs(up - prev) <= Math.abs(down - prev) ? up : down;
                } else if (b === 0) note = near(c.root, prev);
                else note = near(pattern[(b === 1 ? 1 : 2) + (i % 2)], prev);
                prev = note;
                e.push(ev(seg.at + b * 4, 3, 'upright', note, b === 0 ? 0.5 : 0.42));
            }
            const shell = voicing(c, 63, 3, true);
            const hits = seg.len === 16
                ? [[[0, 5], [6, 3]], [[0, 3], [6, 2], [12, 3]], [[2, 3], [8, 5]]][bar % 3]
                : [[0, 3], [6, 2]];
            for (const n of shell) for (const [s, l] of hits) e.push(ev(seg.at + s, l, 'rhodes', n, name === 'intro' ? 0.11 : 0.15));
        });
        if (name !== 'intro') {
            for (const s of [0, 4, 6, 8, 12, 14]) e.push(ev(s, 2, 'ride', null, s % 8 === 0 ? 0.3 : s % 4 === 0 ? 0.26 : 0.18));
            e.push(...drum('pedal', [4, 12], 0.22));
            e.push(...drum('softkick', [0, 4, 8, 12], 0.14));
            e.push(...drum('brushsnare', bar % 2 ? [3, 11] : [7, 15], energy > 0.8 ? 0.16 : 0.11));
        }
        return e;
    };
}

/** Bossa nova: the two-beat bass, a nylon guitar on the clave, cross-stick and shaker. */
function bossa() {
    return ({ segs, name, i }) => {
        const e = [];
        for (const seg of segs) {
            const c = seg.chord;
            const root = bassNote(c, 36);
            const bass = seg.len === 16 ? [[0, root], [6, root + 7], [8, root], [14, root + 7]] : [[0, root], [6, root + 7]];
            for (const [s, n] of bass) e.push(ev(seg.at + s, Math.min(4, seg.len - s), 'upright', n, s % 8 === 0 ? 0.45 : 0.36));
            const chord = voicing(c, 60, 4);
            const hits = seg.len === 16 ? [3, 6, 10, 13] : [3, 6];
            for (const s of hits) for (const n of chord) e.push(ev(seg.at + s, 3, 'nylon', n, 0.12));
            if (seg.len === 16 && i % 4 === 0) for (const n of chord) e.push(ev(seg.at, 3, 'nylon', n, 0.1));
        }
        if (name !== 'intro') {
            e.push(...drum('xstick', [0, 3, 6, 10, 13], 0.16));
            e.push(...drum('softkick', [0, 6, 8, 14], 0.3));
            for (const s of steps16) e.push(ev(s, 1, 'shaker', null, s % 2 === 0 ? 0.11 : 0.06));
        }
        return e;
    };
}

/** Synthwave: eighth-note bass with octave jumps, a 16th arpeggio, wide pads, gated snare and toms. */
function synthwave() {
    return ({ segs, name, energy, first, last }) => {
        const e = [];
        const intro = name === 'intro';
        for (const seg of segs) {
            const root = bassNote(seg.chord, 33);
            for (let s = 0; s < seg.len; s += 2) e.push(ev(seg.at + s, 2, 'synthbass', root + (s % 8 === 6 ? 12 : 0), 0.36));
            const tones = voicing(seg.chord, 67, 4);
            const up = [0, 1, 2, 3, 2, 1];
            for (let s = 0; s < seg.len; s++) e.push(ev(seg.at + s, 1, 'sawpluck', tones[up[s % up.length] % tones.length], intro ? 0.08 : 0.13));
            for (const n of voicing(seg.chord, 62, 3)) e.push(ev(seg.at, seg.len, 'superpad', n, 0.06));
        }
        if (!intro) {
            e.push(...drum('kick', energy > 0.85 ? [0, 4, 8, 12] : [0, 8, 10], 0.8));
            e.push(...drum('gsnare', [4, 12], 0.5));
            for (const s of [2, 6, 10, 14]) e.push(ev(s, 1, 'hat', null, 0.22));
            for (const s of [1, 3, 5, 7, 9, 11, 13, 15]) e.push(ev(s, 1, 'hat', null, 0.07));
            if (first) e.push(ev(0, 1, 'crash', null, 0.3));
            if (last) [[12, 52], [13, 50], [14, 48], [15, 45]].forEach(([s, n]) => e.push(ev(s, 1, 'tom', n, 0.6)));
        }
        return e;
    };
}

/** Melodic house: four on the floor, off-beat bass and open hats, pumping pads, stabs, and a breakdown in B. */
function house() {
    return ({ segs, i, name, energy }) => {
        const e = [];
        const breakdown = name === 'B' && i < 4;
        const intro = name === 'intro';
        for (const seg of segs) {
            for (const n of voicing(seg.chord, 64, 4)) e.push(ev(seg.at, seg.len, 'superpad', n, 0.07));
            if (!breakdown && !intro) {
                const root = bassNote(seg.chord, 31);
                for (const s of [2, 6, 10, 14]) if (s < seg.len) e.push(ev(seg.at + s, 2, 'rollbass', root + (s === 10 ? 12 : 0), 0.34));
            }
            if (!breakdown && !intro && energy >= 0.6) for (const s of [0, 3, 6, 10]) if (s < seg.len) for (const n of voicing(seg.chord, 66, 3)) e.push(ev(seg.at + s, 2, 'stab', n, 0.11));
            if (energy >= 0.9 && !breakdown) {
                const tones = voicing(seg.chord, 72, 3);
                for (let s = 0; s < seg.len; s++) e.push(ev(seg.at + s, 1, 'sawpluck', tones[s % tones.length], 0.08));
            }
        }
        if (!breakdown) {
            e.push(...drum('kick', [0, 4, 8, 12], intro ? 0.6 : 0.75));
            if (!intro) {
                e.push(...drum('clap', [4, 12], 0.5));
                e.push(...drum('openhat', [2, 6, 10, 14], 0.26));
                e.push(...drum('hatc', [1, 3, 5, 7, 9, 11, 13, 15], 0.09));
            }
        } else if (i === 3) {
            e.push(ev(0, 16, 'riser', null, 0.3));
            for (let s = 8; s < 16; s++) e.push(ev(s, 1, 'clap', null, 0.25 + (s - 8) * 0.05));
        }
        return e;
    };
}

/** Future funk: a syncopated slap-style bass, a choppy clav, strings, a four-on-the-floor disco beat. */
function funk() {
    return ({ segs, name, last, first }) => {
        const e = [];
        for (const seg of segs) {
            const c = seg.chord;
            const root = bassNote(c, 33);
            const seventh = root + (c.tones[3] === 10 ? 10 : 11);
            const line = [[0, root, 2], [3, root + 12, 1], [5, root, 1], [8, root, 2], [10, root + 7, 1], [11, seventh, 1], [13, root, 1], [14, root + 12, 1]];
            for (const [s, n, l] of line) if (s < seg.len) e.push(ev(seg.at + s, l, 'funkbass', n, s % 8 === 0 ? 0.4 : 0.32));
            for (const s of [2, 5, 7, 10, 13]) if (s < seg.len) for (const n of voicing(c, 64, 3)) e.push(ev(seg.at + s, 1, 'clav', n, 0.1));
            for (const n of voicing(c, 66, 4)) e.push(ev(seg.at, seg.len, 'strings', n, 0.055));
        }
        if (name !== 'intro') {
            e.push(...drum('kick', [0, 4, 8, 12], 0.72));
            e.push(...drum('clap', [4, 12], 0.5));
            e.push(...drum('openhat', [2, 6, 10, 14], 0.22));
            e.push(...drum('hatc', [1, 3, 5, 7, 9, 11, 13, 15], 0.09));
            if (first) e.push(ev(0, 1, 'crash', null, 0.25));
            if (last) e.push(...drum('clap', [12, 13, 14, 15], 0.4));
        }
        return e;
    };
}

/** Drum and bass: a reese bass, a two-step break, stabs, pads, and a half-bar-long build in B. */
function dnb() {
    return ({ segs, i, name, first, last }) => {
        const e = [];
        const breakdown = name === 'B' && i < 4;
        const intro = name === 'intro';
        for (const seg of segs) {
            for (const n of voicing(seg.chord, 62, 3)) e.push(ev(seg.at, seg.len, 'superpad', n, 0.07));
            if (!breakdown) {
                const root = bassNote(seg.chord, 28);
                e.push(ev(seg.at, seg.len === 16 ? 10 : seg.len, 'reese', root, intro ? 0.3 : 0.42));
                if (seg.len === 16) {
                    e.push(ev(seg.at + 10, 4, 'reese', root + 7, 0.36));
                    e.push(ev(seg.at + 14, 2, 'reese', root, 0.36));
                }
            }
            if (!breakdown && !intro) for (const s of [3, 11]) if (s < seg.len) for (const n of voicing(seg.chord, 66, 3)) e.push(ev(seg.at + s, 1, 'stab', n, 0.1));
        }
        if (!breakdown && !intro) {
            e.push(...drum('kick', [0, 10], 0.85));
            e.push(...drum('dnbsnare', [4, 12], 0.75));
            if (i % 2) e.push(...drum('dnbsnare', [7, 15], 0.2));
            for (let s = 0; s < 16; s += 2) e.push(ev(s, 1, 'hat', null, 0.16));
            for (const s of [5, 13]) e.push(ev(s, 1, 'hatc', null, 0.08));
            if (first) e.push(ev(0, 1, 'crash', null, 0.32));
            if (last) for (const s of [10, 11, 12, 13, 14, 15]) e.push(ev(s, 1, 'dnbsnare', null, 0.3 + (s - 10) * 0.08));
        } else if (breakdown && i === 3) {
            e.push(ev(0, 16, 'riser', null, 0.3));
        }
        return e;
    };
}

/** Hard trance: a hard four-on-the-floor kick, rolling off-beat 16th bass, pumping supersaws, an arpeggio and snare rolls. */
function trance() {
    return ({ segs, i, name, first }) => {
        const e = [];
        const breakdown = name === 'B' && i < 4;
        const intro = name === 'intro';
        for (const seg of segs) {
            for (const n of voicing(seg.chord, 64, 4)) e.push(ev(seg.at, seg.len, 'superpad', n, 0.075));
            if (!breakdown && !intro) {
                const root = bassNote(seg.chord, 31);
                for (let s = 0; s < seg.len; s++) if (s % 4 !== 0) e.push(ev(seg.at + s, 1, 'rollbass', root + (s % 8 === 6 ? 12 : 0), 0.3));
                const tones = voicing(seg.chord, 71, 3);
                const gate = [1, 1, 0, 1, 1, 0, 1, 1];
                for (let s = 0; s < seg.len; s++) if (gate[s % 8]) e.push(ev(seg.at + s, 1, 'sawpluck', tones[s % tones.length], 0.09));
            }
        }
        if (!breakdown) {
            e.push(...drum('hardkick', [0, 4, 8, 12], intro ? 0.6 : 0.85));
            if (!intro) {
                e.push(...drum('clap', [4, 12], 0.55));
                e.push(...drum('openhat', [2, 6, 10, 14], 0.3));
                e.push(...drum('hatc', [1, 3, 5, 7, 9, 11, 13, 15], 0.1));
                if (first) e.push(ev(0, 1, 'crash', null, 0.3));
            }
        } else if (i === 3) {
            e.push(ev(0, 16, 'riser', null, 0.3));
            for (let s = 0; s < 16; s += 2) e.push(ev(s, 1, 'clap', null, 0.2 + s * 0.03));
            for (let s = 12; s < 16; s++) e.push(ev(s, 1, 'clap', null, 0.5));
        }
        return e;
    };
}

/** Bass music: half-time drums, a sub, dark plucks in the verse and a wobble bass in the drop (B). */
function bassMusic() {
    return ({ segs, i, name, first, last }) => {
        const e = [];
        const drop = name === 'B' || name === 'B2';
        const intro = name === 'intro';
        for (const seg of segs) {
            for (const n of voicing(seg.chord, 62, 3)) e.push(ev(seg.at, seg.len, 'superpad', n, drop ? 0.05 : 0.07));
            const root = bassNote(seg.chord, 28);
            if (!intro) e.push(ev(seg.at, seg.len, 'sub', root, 0.5));
            if (drop) {
                const low = bassNote(seg.chord, 31);
                const riff = i % 2 ? [[0, 4, low], [6, 2, low + 12], [8, 2, low], [12, 4, low + 7]] : [[0, 6, low], [8, 2, low], [10, 2, low + 12], [12, 4, low]];
                for (const [s, l, n] of riff) if (s < seg.len) e.push(ev(seg.at + s, l, 'wobble', n, 0.34));
            } else if (!intro) {
                const tones = voicing(seg.chord, 69, 2);
                for (const s of [0, 6, 10]) if (s < seg.len) e.push(ev(seg.at + s, 1, 'sawpluck', tones[s % tones.length], 0.1));
            }
        }
        if (!intro) {
            e.push(...drum('hardkick', drop ? [0, 10] : [0], 0.85));
            e.push(...drum('snare', [8], drop ? 0.8 : 0.6));
            if (drop) e.push(...drum('clap', [8], 0.55));
            for (let s = 0; s < 16; s += 2) e.push(ev(s, 1, 'hat', null, 0.13));
            if (first && drop) e.push(ev(0, 1, 'crash', null, 0.32));
            if (last) [[12, 55], [13, 52], [14, 48], [15, 45]].forEach(([s, n]) => e.push(ev(s, 1, 'tom', n, 0.6)));
        }
        return e;
    };
}

// --- Arrangement ---

/** Intro, A, B, A again with a harmony line, B again. The song loops from the first A. */
const FORM = [
    { name: 'intro', part: 'A', bars: 4, energy: 0.3, melody: null },
    { name: 'A', part: 'A', bars: 8, energy: 0.6, melody: 'A' },
    { name: 'B', part: 'B', bars: 8, energy: 0.9, melody: 'B' },
    { name: 'A2', part: 'A', bars: 8, energy: 1, melody: 'A', harmony: true },
    { name: 'B2', part: 'B', bars: 8, energy: 0.85, melody: 'B', harmony: true },
];
const LOOP_START = FORM[0].bars;

/** Lay a track's chords, melodies and groove out as bars of events. */
export function compose(spec) {
    const shift = spec.transpose || 0;
    const scale = scalePcs(spec.key, shift);
    const melodies = { A: parseMelody(spec.melody.A, shift), B: parseMelody(spec.melody.B, shift) };
    const plan = [];
    for (const sec of FORM) {
        for (let i = 0; i < sec.bars; i++) plan.push({ sec, i, segs: segments(spec.chords[sec.part][i], shift) });
    }
    const groove = spec.groove();
    return plan.map((p, idx) => {
        const after = plan[idx + 1] || plan[LOOP_START];
        const events = groove({
            segs: p.segs, next: after.segs[0].chord, i: p.i, bar: idx, name: p.sec.name,
            energy: p.sec.energy, first: p.i === 0, last: p.i === p.sec.bars - 1,
        });
        if (p.sec.melody) {
            const notes = melodies[p.sec.melody][p.i];
            for (const n of notes) events.push(ev(n.s, n.l, spec.voice, n.n, spec.vel));
            if (p.sec.harmony) {
                for (const n of notes) {
                    const h = thirdBelow(n.n, scale);
                    if (h !== null) events.push(ev(n.s, n.l, spec.voice, h, spec.vel * 0.5));
                }
            }
        }
        return events;
    });
}

// --- The tracks ---

/**
 * The written tracks. `transpose` moves everything (chords, melody, key) by semitones, so a
 * melody can be written in A minor and heard in D minor. `delay`, `verb` and `pump` are the
 * wet level of the tempo-synced delay and the reverb, and how far the kick ducks the pads
 * (0 to 1). `gain` trims the track's level against the others.
 */
export const SPECS = [
    {
        id: 'rainy-window', name: 'Rainy Window', genre: 'Lo-fi', category: 'casual', bpm: 76, swing: 0.42,
        delay: 0.22, verb: 0.24, pump: 0, gain: 0.99,
        blurb: 'Dusty keys, a boom-bap beat and a vibraphone, for a grey afternoon.',
        art: 'rain', key: { root: 'F', mode: 'minor' }, voice: 'vibes', vel: 0.58, groove: lofi,
        chords: {
            A: ['Fm9', 'Dbmaj7', 'Ebmaj7', 'Cm7', 'Fm9', 'Dbmaj7', 'Bbm9', 'C7b9'],
            B: ['Abmaj7', 'Ebmaj7', 'Dbmaj7', 'Bbm9', 'Abmaj7', 'Ebmaj7', 'Gm7b5', 'C7b9'],
        },
        melody: {
            A: `C5:3 Eb5:1 F5:4 r:2 Eb5:2 C5:4 | Db5:4 C5:2 Ab4:2 r:2 Bb4:2 C5:4 | Bb4:4 G4:2 Bb4:2 Eb5:6 r:2 | C5:2 Bb4:2 Ab4:2 G4:2 r:4 C5:4 |
                C5:3 Eb5:1 F5:4 r:2 Ab5:2 G5:4 | F5:4 Eb5:2 C5:2 r:2 Db5:2 C5:4 | Bb4:4 Db5:4 F5:4 Eb5:2 Db5:2 | E5:4 Db5:4 C5:8`,
            B: `Eb5:4 C5:2 Eb5:2 Ab5:6 r:2 | G5:4 Eb5:2 Bb4:2 r:2 D5:2 Eb5:4 | F5:3 Ab5:1 F5:4 Db5:4 C5:4 | Bb4:2 C5:2 Db5:4 F5:4 Eb5:2 Db5:2 |
                Eb5:4 C5:2 Eb5:2 Ab5:4 Bb5:2 C6:2 | Bb5:4 G5:2 Eb5:2 G5:4 Bb4:4 | G5:4 F5:2 Db5:2 Bb4:4 G4:4 | E5:2 G5:2 Bb5:4 Ab5:4 G5:4`,
        },
    },
    {
        id: 'midnight-blue', name: 'Midnight Blue', genre: 'Jazz', category: 'casual', bpm: 92, swing: 0.58,
        delay: 0.12, verb: 0.26, pump: 0, gain: 1.19,
        blurb: 'A slow swing: walking bass, brushes and a vibraphone over ii-V-I changes.',
        art: 'moon', key: { root: 'F', mode: 'major' }, voice: 'vibes', vel: 0.42, groove: jazz,
        chords: {
            A: ['Fmaj9', 'Dm9', 'Gm9', 'C13', 'Am7', 'D7b9', 'Gm7', 'C7b9'],
            B: ['Bbmaj9', 'Bbm7', 'Am7', 'D7#9', 'Gm7', 'C7', 'Fmaj7', ['Gm7', 'C7']],
        },
        melody: {
            A: `A4:4 C5:2 E5:2 G5:6 F5:2 | F5:3 D5:1 A4:4 r:2 C5:2 D5:4 | Bb4:4 D5:2 F5:2 A5:4 G5:4 | E5:4 G5:2 A5:2 G5:4 E5:4 |
                C5:4 E5:2 G5:2 E5:4 C5:4 | F#4:4 A4:2 C5:2 Eb5:4 D5:4 | D5:4 Bb4:2 G4:2 F5:4 D5:4 | E5:4 G5:2 Bb5:2 G5:4 E5:4`,
            B: `D5:4 F5:2 A5:2 F5:4 D5:4 | Db5:4 F5:2 Ab5:2 F5:4 Db5:4 | E5:4 G5:2 A5:2 G5:4 E5:4 | F#5:4 A5:2 C6:2 A5:4 F5:4 |
                D5:4 F5:2 G5:2 F5:4 D5:4 | E5:4 G5:2 Bb5:2 G5:4 E5:4 | A5:6 G5:2 F5:4 C5:4 | Bb4:4 D5:4 E5:4 G5:4`,
        },
    },
    {
        id: 'corner-cafe', name: 'Corner Cafe', genre: 'Cafe bossa', category: 'casual', bpm: 112, swing: 0,
        delay: 0.18, verb: 0.22, pump: 0, gain: 1.08,
        blurb: 'Nylon guitar on a bossa nova clave, a soft bass and a breathy flute.',
        art: 'cup', key: { root: 'A', mode: 'minor' }, voice: 'flute', vel: 0.32, groove: bossa,
        chords: {
            A: ['Am9', 'Dm9', 'G13', 'Cmaj9', 'Fmaj7', 'Bm7b5', 'E7b9', 'Am9'],
            B: ['Cmaj9', 'Am9', 'Dm9', 'G13', 'Em7', 'A7b9', 'Dm9', 'E7b9'],
        },
        melody: {
            A: `E5:4 A5:2 G5:2 E5:4 C5:4 | D5:3 F5:1 A5:4 G5:2 F5:2 E5:4 | B4:4 D5:2 F5:2 E5:4 D5:4 | E5:4 G5:2 B4:2 D5:4 C5:4 |
                A4:4 C5:2 E5:2 F5:4 A5:4 | B4:4 D5:2 F5:2 A5:4 F5:4 | G#4:4 B4:2 D5:2 F5:4 E5:4 | E5:6 C5:2 A4:8`,
            B: `G5:4 E5:2 C5:2 E5:4 G5:4 | A5:4 G5:2 E5:2 C5:4 E5:4 | F5:4 A5:2 C6:2 A5:4 F5:4 | D5:4 F5:2 B4:2 D5:4 G4:4 |
                B4:4 D5:2 E5:2 G5:4 E5:4 | C#5:4 E5:2 G5:2 Bb5:4 A5:4 | F5:4 E5:2 D5:2 C5:4 A4:4 | G#4:4 B4:4 D5:4 E5:4`,
        },
    },
    {
        id: 'neon-circuit', name: 'Neon Circuit', genre: 'Synthwave', category: 'competitive', bpm: 118, swing: 0,
        delay: 0.28, verb: 0.22, pump: 0.3, gain: 0.97, transpose: 5,
        blurb: 'Arpeggios, gated snares and a big lead, written for a night drive.',
        art: 'sun', key: { root: 'A', mode: 'minor' }, voice: 'lead', vel: 0.48, groove: synthwave,
        chords: {
            A: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
            B: ['F', 'G', 'Am', 'C', 'F', 'G', 'Am', 'E'],
        },
        melody: {
            A: `A5:3 G5:1 E5:4 r:2 C5:2 E5:4 | A5:3 F5:1 C5:4 r:2 A4:2 C5:4 | G5:3 E5:1 C5:4 r:2 E5:2 G5:4 | B5:3 G5:1 D5:4 r:2 B4:2 D5:4 |
                A5:3 G5:1 E5:4 r:2 C6:2 B5:4 | A5:3 F5:1 C5:4 r:2 F5:2 A5:4 | F5:4 A5:4 D6:4 C6:2 A5:2 | B5:4 G#5:4 E5:4 G#5:2 B5:2`,
            B: `C6:4 A5:4 F5:8 | D6:4 B5:4 G5:8 | E6:4 C6:4 A5:8 | G5:4 E5:4 C5:4 E5:4 |
                C6:4 A5:4 C6:4 A5:4 | D6:4 B5:4 D6:4 B5:4 | C6:4 E6:4 A5:8 | B5:2 G#5:2 E5:4 G#5:2 B5:2 E6:4`,
        },
    },
    {
        id: 'pulse-driver', name: 'Pulse Driver', genre: 'Melodic house', category: 'competitive', bpm: 126, swing: 0,
        delay: 0.22, verb: 0.18, pump: 0.5, gain: 1.5,
        blurb: 'Four on the floor, off-beat bass and a bright pluck lead, with a breakdown that builds back in.',
        art: 'beam', key: { root: 'G', mode: 'minor' }, voice: 'supersaw', vel: 0.32, groove: house,
        chords: {
            A: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Cm', 'D'],
            B: ['Eb', 'Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'D'],
        },
        melody: {
            A: `D5:2 G5:2 Bb5:4 A5:2 G5:2 D5:4 | Eb5:2 G5:2 Bb5:4 G5:2 Eb5:2 Bb4:4 | D5:2 F5:2 Bb5:4 A5:2 F5:2 D5:4 | C5:2 F5:2 A5:4 G5:2 F5:2 C5:4 |
                D5:2 G5:2 Bb5:4 D6:2 C6:2 Bb5:4 | Eb5:2 G5:2 Bb5:4 C6:2 Bb5:2 G5:4 | C5:2 Eb5:2 G5:4 Bb5:2 G5:2 Eb5:4 | F#5:4 A5:4 D6:4 C6:2 A5:2`,
            B: `G5:4 Bb5:4 Eb6:8 | F5:4 Bb5:4 D6:8 | A5:4 C6:4 F6:8 | Bb5:4 D6:4 G5:8 |
                G5:4 Bb5:4 Eb6:4 D6:4 | F5:4 Bb5:4 D6:4 C6:4 | A5:4 C6:4 A5:4 F5:4 | F#5:4 A5:4 C6:2 A5:2 F#5:4`,
        },
    },
    {
        id: 'night-shift', name: 'Night Shift', genre: 'Future funk', category: 'competitive', bpm: 112, swing: 0,
        delay: 0.14, verb: 0.15, pump: 0.25, gain: 1.06,
        blurb: 'A slap bass, a choppy clav and strings over a disco beat, after midnight.',
        art: 'disco', key: { root: 'B', mode: 'minor' }, voice: 'lead', vel: 0.36, groove: funk,
        chords: {
            A: ['Bm9', 'Em9', 'A13', 'Dmaj9', 'Gmaj9', 'F#m7', 'Em9', 'F#7b9'],
            B: ['Gmaj9', 'A13', 'Bm9', 'F#m7', 'Gmaj9', 'A13', 'Dmaj9', 'F#7b9'],
        },
        melody: {
            A: `F#5:3 A5:1 B5:4 r:2 A5:2 F#5:4 | G5:3 B5:1 D6:4 r:2 B5:2 G5:4 | E5:3 G5:1 A5:4 r:2 G5:2 E5:4 | F#5:3 A5:1 C#6:4 r:2 A5:2 F#5:4 |
                D5:3 G5:1 B5:4 r:2 A5:2 G5:4 | C#5:3 E5:1 F#5:4 r:2 E5:2 C#5:4 | G5:4 B5:4 A5:4 F#5:4 | A#5:4 C#6:4 G5:4 F#5:4`,
            B: `B4:2 D5:2 G5:4 F#5:2 D5:2 B4:4 | C#5:2 E5:2 A5:4 G5:2 E5:2 C#5:4 | D5:2 F#5:2 B5:4 A5:2 F#5:2 D5:4 | C#5:2 E5:2 F#5:4 A5:2 F#5:2 E5:4 |
                B4:2 D5:2 G5:4 A5:2 B5:2 D6:4 | C#5:2 E5:2 G5:4 A5:2 G5:2 E5:4 | F#5:4 A5:4 C#6:4 A5:4 | A#4:2 C#5:2 F#5:4 G5:2 F#5:2 C#5:4`,
        },
    },
    {
        id: 'redline', name: 'Redline', genre: 'Drum and bass', category: 'intense', bpm: 174, swing: 0,
        delay: 0.1, verb: 0.12, pump: 0.3, gain: 1.0,
        blurb: 'A two-step break and a growling reese bass, with a breakdown that drops back in.',
        art: 'wave', key: { root: 'E', mode: 'minor' }, voice: 'lead', vel: 0.38, groove: dnb,
        chords: {
            A: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B7'],
            B: ['C', 'D', 'Em', 'G', 'C', 'D', 'Em', 'B7'],
        },
        melody: {
            A: `B4:2 E5:2 G5:4 F#5:2 E5:2 B4:4 | C5:2 E5:2 G5:4 E5:2 C5:2 G4:4 | D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 | D5:2 F#5:2 A5:4 F#5:2 D5:2 A4:4 |
                B4:2 E5:2 G5:4 B5:2 A5:2 G5:4 | C5:2 E5:2 G5:4 C6:2 B5:2 G5:4 | A4:2 C5:2 E5:4 A5:2 G5:2 E5:4 | D#5:4 F#5:4 B5:4 A5:2 F#5:2`,
            B: `G5:8 E5:8 | A5:8 F#5:8 | B5:8 G5:8 | D6:8 B5:8 |
                G5:4 E5:4 C5:4 E5:4 | A5:4 F#5:4 D5:4 F#5:4 | G5:4 B5:4 E6:4 B5:4 | D#5:2 F#5:2 B5:4 A5:4 F#5:4`,
        },
    },
    {
        id: 'overclock', name: 'Overclock', genre: 'Hard trance', category: 'intense', bpm: 140, swing: 0,
        delay: 0.16, verb: 0.14, pump: 0.55, gain: 1.18, transpose: 3,
        blurb: 'A hard kick, rolling 16th bass, wide supersaws and a hoover lead that swoops in.',
        art: 'star', key: { root: 'A', mode: 'minor' }, voice: 'hoover', vel: 0.4, groove: trance,
        chords: {
            A: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
            B: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'E'],
        },
        melody: {
            A: `E5:2 A5:2 C6:4 B5:2 A5:2 E5:4 | D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 | C5:2 F5:2 A5:4 G5:2 F5:2 C5:4 | B4:2 E5:2 G#5:4 B5:2 G#5:2 E5:4 |
                E5:2 A5:2 C6:4 E6:4 D6:4 | D5:2 G5:2 B5:4 D6:4 C6:4 | C5:2 F5:2 A5:4 C6:4 B5:4 | B4:2 E5:2 G#5:4 B5:4 E6:4`,
            B: `C6:8 A5:8 | E6:8 C6:8 | D6:8 B5:8 | C6:4 B5:4 A5:8 |
                A5:4 C6:4 F6:8 | G5:4 E6:4 C6:8 | D6:4 B5:4 G5:4 B5:4 | G#5:2 B5:2 E6:4 D6:4 B5:4`,
        },
    },
    {
        id: 'static-storm', name: 'Static Storm', genre: 'Bass music', category: 'intense', bpm: 140, swing: 0,
        delay: 0.14, verb: 0.16, pump: 0.35, gain: 0.95, transpose: 4,
        blurb: 'Half-time drums, a dark verse and a wobble bass drop.',
        art: 'bolt', key: { root: 'A', mode: 'minor' }, voice: 'lead', vel: 0.44, groove: bassMusic,
        chords: {
            A: ['Am', 'Am', 'F', 'F', 'Am', 'Am', 'G', 'E'],
            B: ['Am', 'Am', 'Am', 'Am', 'F', 'F', 'G', 'G'],
        },
        melody: {
            A: `E5:8 r:2 C5:2 E5:4 | A5:6 r:2 G5:4 E5:4 | C5:8 A4:4 C5:4 | F5:8 E5:4 C5:4 |
                E5:8 r:2 C5:2 E5:4 | A5:6 r:2 B5:4 C6:4 | B5:8 D6:4 B5:4 | G#5:8 B5:4 G#5:4`,
            B: `A5:2 r:2 A5:2 C6:2 r:2 E6:2 D6:2 C6:2 | A5:2 r:2 A5:2 C6:2 r:2 B5:2 A5:2 G5:2 | A5:2 r:2 A5:2 C6:2 r:2 E6:2 D6:2 C6:2 | E6:4 D6:2 C6:2 B5:4 A5:4 |
                F5:2 r:2 F5:2 A5:2 r:2 C6:2 B5:2 A5:2 | F5:2 r:2 F5:2 A5:2 r:2 G5:2 F5:2 E5:2 | G5:2 r:2 G5:2 B5:2 r:2 D6:2 C6:2 B5:2 | D6:4 B5:4 G5:4 A5:4`,
        },
    },
];

/** Who, what and how each track sounds, without the bars (cheap to read at any time). */
export const TRACK_INFO = Object.fromEntries(SPECS.map(s => {
    const shift = s.transpose || 0;
    return [s.id, {
        id: s.id, name: s.name, genre: s.genre, category: s.category, bpm: s.bpm, blurb: s.blurb, art: s.art,
        key: `${NAMES[(PC[s.key.root] + shift) % 12]} ${s.key.mode}`,
    }];
}));

export const TRACK_IDS = SPECS.map(s => s.id);

/** The playlists, in play order. */
export const CATEGORIES = {
    casual: { label: 'Casual', blurb: 'Lo-fi, jazz and cafe music for calm play.' },
    competitive: { label: 'Competitive', blurb: 'Synthwave, house and funk with some drive.' },
    intense: { label: 'Intense', blurb: 'Drum and bass, trance and bass music for when it counts.' },
};
for (const id of Object.keys(CATEGORIES)) CATEGORIES[id].tracks = SPECS.filter(s => s.category === id).map(s => s.id);

const built = new Map();

/**
 * A track ready to play: its tempo, feel and bars. Built the first time, then kept.
 * @param {string} id
 * @returns {{ id: string, bpm: number, swing: number, delay: number, verb: number, pump: number,
 *             gain: number, loopStart: number, bars: Array<Array<Object>> } | undefined}
 */
export function getTrack(id) {
    if (!built.has(id)) {
        const spec = SPECS.find(s => s.id === id);
        if (!spec) return undefined;
        built.set(id, {
            id, bpm: spec.bpm, swing: spec.swing, delay: spec.delay, verb: spec.verb, pump: spec.pump, gain: spec.gain,
            loopStart: LOOP_START, bars: compose(spec),
        });
    }
    return built.get(id);
}

/**
 * What the soundtrack should do for the current settings.
 * @param {{ soundtrack?: string, track?: string }} settings - soundtrack is 'auto', a playlist or 'off'; track is 'auto' or a track id
 * @param {string} category - the playlist the mode plays under 'auto' ('casual' in the menu)
 * @returns {{ off: true } | { track: string } | { playlist: string[] }}
 */
export function musicPlan(settings, category) {
    const choice = settings.soundtrack || 'auto';
    if (choice === 'off') return { off: true };
    if (settings.track && settings.track !== 'auto' && TRACK_INFO[settings.track]) return { track: settings.track };
    const list = CATEGORIES[choice === 'auto' ? category : choice] || CATEGORIES.casual;
    return { playlist: list.tracks };
}
