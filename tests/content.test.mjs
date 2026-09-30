import { calculateAttack } from '../js/scoring.js';
import { TRACKS } from '../js/tracks.js';
import { SCENES, CASUAL_SCENES } from '../js/background.js';
import { AMBIENCE_LAYERS } from '../js/ambience.js';
import { normalizeSettings } from '../js/settings.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

// --- Attack table (guideline versus rules) ---
const hit = (action, extra = {}) => calculateAttack({ isClearAction: true, action, combo: 0, b2b: false, perfectClear: false, ...extra });
check('single sends 0, double 1, triple 2, tetris 4',
    hit('single') === 0 && hit('double') === 1 && hit('triple') === 2 && hit('tetris') === 4);
check('T-spin single 2, double 4, triple 6',
    hit('tspin-single') === 2 && hit('tspin-double') === 4 && hit('tspin-triple') === 6);
check('back-to-back adds 1', hit('tetris', { b2b: true }) === 5);
check('combo table: combo 1 adds 1, combo 4 adds 2, combo 20 adds 5',
    hit('single', { combo: 1 }) === 1 && hit('single', { combo: 4 }) === 2 && hit('single', { combo: 20 }) === 5);
check('perfect clear adds 10', hit('tetris', { perfectClear: true }) === 14);
check('no clear sends nothing', calculateAttack({ isClearAction: false, action: 'tspin' }) === 0);

// --- Song data ---
const VOICES = new Set(['epiano', 'bell', 'pad', 'softbass', 'bass', 'pluck', 'stab', 'lead',
    'kick', 'lofikick', 'snare', 'rim', 'hat', 'brush', 'crash']);
for (const [name, track] of Object.entries(TRACKS)) {
    const events = track.bars.flat();
    const badVoice = events.find(e => !VOICES.has(e.v));
    const badStep = events.find(e => e.s < 0 || e.s >= 16 || e.l <= 0 || e.s + e.l > 16.001);
    const notes = events.filter(e => e.n !== null).map(e => e.n);
    check(`${name}: every event uses a known voice`, !badVoice, badVoice && badVoice.v);
    check(`${name}: every event fits inside its bar`, !badStep, badStep && JSON.stringify(badStep));
    check(`${name}: notes stay in a playable range`, Math.min(...notes) >= 28 && Math.max(...notes) <= 100,
        `MIDI ${Math.min(...notes)} to ${Math.max(...notes)}`);
    check(`${name}: loop point is inside the song`, track.loopStart >= 0 && track.loopStart < track.bars.length);
}

// The melody keeps its Korobeiniki shape: first phrase E B C D C B (in A minor) shifted by the track key.
const firstPhrase = (name, voice) => TRACKS[name].bars
    .find(bar => bar.some(e => e.v === voice)).filter(e => e.v === voice).slice(0, 6).map(e => e.n);
const intervals = arr => arr.slice(1).map((n, i) => n - arr[i]);
const motif = intervals([76, 71, 72, 74, 72, 71]);
for (const [name, voice] of [['calm', 'bell'], ['competitive', 'lead'], ['intense', 'lead']]) {
    const phrase = firstPhrase(name, voice);
    check(`${name}: opens with the Korobeiniki motif`, intervals(phrase).join() === motif.join(), phrase.join(' '));
}
const top = name => firstPhrase(name, name === 'calm' ? 'bell' : 'lead')[0];
check('calm is raised a minor third (E5 to G5)', top('calm') === 79);
check('competitive is raised a fourth (E5 to A5)', top('competitive') === 81);

const loopSeconds = t => (t.bars.length - t.loopStart) * 16 * (60 / t.bpm / 4);
check('tempos rise calm < competitive < intense',
    TRACKS.calm.bpm < TRACKS.competitive.bpm && TRACKS.competitive.bpm < TRACKS.intense.bpm,
    Object.entries(TRACKS).map(([n, t]) => `${n} ${t.bpm} BPM, loop ${loopSeconds(t).toFixed(0)}s`).join(', '));

// --- Scenes and their background sounds ---
for (const [id, scene] of Object.entries(SCENES)) {
    const layers = Object.entries(scene.ambience || {});
    const bad = layers.find(([name, level]) => !AMBIENCE_LAYERS.includes(name) || !(level > 0 && level <= 1));
    check(`${id}: has a name and known ambience layers`, scene.id === id && !!scene.name && layers.length > 0 && !bad, bad && bad.join(' '));
}
check('every Casual scene exists and can be picked in settings',
    CASUAL_SCENES.every(id => SCENES[id] && normalizeSettings({ version: 2, casualScene: id }).casualScene === id),
    `${CASUAL_SCENES.length} scenes`);

console.log(failures ? `\n${failures} FAILED` : '\nAll content checks passed');
process.exit(failures ? 1 : 0);
