import { calculateAttack } from '../js/scoring.js';
import { SPECS, getTrack, TRACK_INFO, TRACK_IDS, CATEGORIES, musicPlan, chordInfo, segments, parseMelody, scalePcs } from '../js/tracks.js';
import { VOICE_NAMES, KICKS, createVoices } from '../js/voices.js';
import { SCENES, CASUAL_SCENES } from '../js/background.js';
import { AMBIENCE_LAYERS } from '../js/ambience.js';
import { normalizeSettings, DEFAULT_SETTINGS, getConstraint } from '../js/settings.js';
import { SETTINGS_TABS, findSetting } from '../js/settings-defs.js';
import { VARIANTS, VARIANT_INFO, CYCLE_ORDER, ambienceFor, cycleVariant } from '../js/scenes/atmosphere.js';

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

// --- Song data: nine original tracks in three playlists ---
check('three playlists of three tracks each, and nine distinct tracks',
    Object.values(CATEGORIES).every(c => c.tracks.length === 3) && new Set(TRACK_IDS).size === 9
    && new Set(Object.values(TRACK_INFO).map(t => t.name)).size === 9 && new Set(Object.values(TRACK_INFO).map(t => t.art)).size === 9,
    Object.entries(CATEGORIES).map(([k, c]) => `${k}: ${c.tracks.join(', ')}`).join('; '));
check('every voice in voices.js is listed in VOICE_NAMES, and the other way round',
    Object.keys(createVoices({}, null)).sort().join() === [...VOICE_NAMES].sort().join());

// The old soundtrack was arrangements of Korobeiniki. The new one must not open with its motif (E B C D C B).
const KOROBEINIKI = [-5, 1, 2, -2, -1];
for (const spec of SPECS) {
    const info = TRACK_INFO[spec.id];
    const track = getTrack(spec.id);
    const events = track.bars.flat();
    const badVoice = events.find(e => !VOICE_NAMES.includes(e.v));
    const badStep = events.find(e => e.s < 0 || e.s >= 16 || e.l <= 0 || e.s + e.l > 16.001);
    const notes = events.filter(e => e.n !== null).map(e => e.n);
    check(`${spec.id}: every event uses a known voice and fits inside its bar`, !badVoice && !badStep, badVoice?.v || JSON.stringify(badStep || ''));
    check(`${spec.id}: notes stay in a playable range`, Math.min(...notes) >= 24 && Math.max(...notes) <= 96, `MIDI ${Math.min(...notes)} to ${Math.max(...notes)}`);
    check(`${spec.id}: 36 bars that loop back past the intro, about a minute or two long`,
        track.bars.length === 36 && track.loopStart === 4 && track.bars.length * 16 * (60 / track.bpm / 4) > 45 && track.bars.length * 16 * (60 / track.bpm / 4) < 130,
        `${(track.bars.length * 16 * (60 / track.bpm / 4)).toFixed(0)} s at ${track.bpm} BPM`);

    // The melody is in the key, or a tone of the chord under it
    const shift = spec.transpose || 0;
    const scale = scalePcs(spec.key, shift);
    let wrong = '';
    for (const part of ['A', 'B']) {
        let bars;
        try { bars = parseMelody(spec.melody[part], shift); } catch (e) { wrong = e.message; break; }
        if (bars.length !== 8 || spec.chords[part].length !== 8) wrong = `${part} is not eight bars`;
        bars.forEach((bar, i) => {
            const allowed = new Set([...scale, ...segments(spec.chords[part][i], shift).flatMap(g => g.chord.pcs)]);
            for (const n of bar) if (!allowed.has(n.n % 12)) wrong = `${part}${i + 1}: note ${n.n} is not in the key or the chord`;
        });
    }
    check(`${spec.id}: melody adds up in every bar and stays in the key or the chord`, !wrong, wrong);

    const first = parseMelody(spec.melody.A, shift)[0].slice(0, 6).map(n => n.n);
    const steps = first.slice(1).map((n, i) => n - first[i]);
    check(`${spec.id}: does not open with the Korobeiniki motif`, steps.slice(0, 5).join() !== KOROBEINIKI.join());
    check(`${spec.id}: has a name, a genre, a blurb and a key`, !!(info.name && info.genre && info.blurb && info.key), info.key);
    if (spec.pump > 0) check(`${spec.id}: a pumped track has kicks to duck on`, events.some(e => KICKS.has(e.v)));
    check(`${spec.id}: the intro has no melody and the A section brings it in`,
        track.bars.slice(0, 4).every(b => !b.some(e => e.v === spec.voice && e.g === spec.vel)) && track.bars[4].some(e => e.v === spec.voice));
}
{
    const avg = c => CATEGORIES[c].tracks.reduce((a, id) => a + TRACK_INFO[id].bpm, 0) / 3;
    check('tempos rise from the casual playlist to competitive to intense', avg('casual') < avg('competitive') && avg('competitive') < avg('intense'),
        ['casual', 'competitive', 'intense'].map(c => `${c} ${avg(c).toFixed(0)} BPM`).join(', '));
    check('chords can be read, shifted and voiced', chordInfo('F#m7').root === 6 && chordInfo('Am', 5).root === 2 && segments(['Gm7', 'C7']).length === 2);
    check('a melody bar that does not add up to 16 steps is refused', (() => { try { parseMelody('C5:4 D5:4'); return false; } catch { return true; } })());
}

// What the soundtrack plays for the settings
{
    const auto = musicPlan({ soundtrack: 'auto', track: 'auto' }, 'intense');
    check('auto plays the mode\'s playlist', auto.playlist?.join() === CATEGORIES.intense.tracks.join());
    check('a chosen playlist beats the mode', musicPlan({ soundtrack: 'competitive', track: 'auto' }, 'casual').playlist.join() === CATEGORIES.competitive.tracks.join());
    check('a chosen track plays on its own, in any mode', musicPlan({ soundtrack: 'auto', track: 'redline' }, 'casual').track === 'redline');
    check('off is silence, even with a track chosen', musicPlan({ soundtrack: 'off', track: 'redline' }, 'casual').off === true);
    check('an unknown track falls back to the playlist', !!musicPlan({ soundtrack: 'auto', track: 'nope' }, 'casual').playlist);
    check('saves from the old soundtrack ("calm") still load',
        normalizeSettings({ version: 2, soundtrack: 'calm' }).soundtrack === 'casual' && normalizeSettings({ version: 2, track: 'redline' }).track === 'redline'
        && normalizeSettings({ version: 2, track: 'korobeiniki' }).track === 'auto');
}

// --- Scenes and their background sounds ---
for (const [id, scene] of Object.entries(SCENES)) {
    const named = scene.id === id && !!scene.name && VARIANTS.includes(scene.signature) && Number.isFinite(scene.horizon);
    const listed = ['always', 'day', 'night'].flatMap(k => Object.entries(scene.sounds?.[k] || {}));
    const bad = listed.find(([name, level]) => !AMBIENCE_LAYERS.includes(name) || !(level > 0 && level <= 1));
    check(`${id}: has a name, a signature weather, a horizon and known sounds`, named && !!scene.sounds && !bad, bad && bad.join(' '));

    // The sound mix in every weather follows the picture
    const problems = [];
    for (const v of VARIANTS) {
        const mix = ambienceFor(scene, v);
        const info = VARIANT_INFO[v];
        for (const [name, level] of Object.entries(mix)) {
            if (!AMBIENCE_LAYERS.includes(name) || !(level > 0 && level <= 1)) problems.push(`${v}: bad layer ${name} ${level}`);
        }
        if (info.storm && mix.thunder !== 1) problems.push(`${v}: no thunder`);
        if (!info.storm && mix.thunder) problems.push(`${v}: thunder without lightning`);
        if (info.rain > 0 && scene.precip !== 'snow' && !(mix.rain || mix.storm)) problems.push(`${v}: no rain sound`);
        if (info.rain === 0 && (mix.rain || mix.storm)) problems.push(`${v}: rain sound in dry weather`);
        if (info.lit >= 0.7 && (mix.birds || mix.gulls)) problems.push(`${v}: daytime animals at night`);
        if (info.storm && (mix.birds || mix.gulls)) problems.push(`${v}: animals in a storm`);
    }
    check(`${id}: sounds fit all ${VARIANTS.length} weathers`, problems.length === 0, problems.join('; '));
}
check('every weather has a name, a sky, grading and clouds',
    VARIANTS.every(v => {
        const i = VARIANT_INFO[v];
        return i.name && i.sky.length === 6 && i.grade && i.clouds.near !== undefined && i.lit >= 0 && i.lit <= 1;
    }));
check('stormy weathers have rain and lightning, calm ones have neither',
    VARIANTS.every(v => VARIANT_INFO[v].storm ? VARIANT_INFO[v].rain === 1 : VARIANT_INFO[v].rain < 1));
check('night weathers turn the lights on, day weathers leave them off',
    VARIANT_INFO.night.lit === 1 && VARIANT_INFO.nightthunder.lit === 1 && VARIANT_INFO.sunny.lit === 0);
check('cycle by level walks through every weather before repeating',
    new Set(CYCLE_ORDER.map((_, i) => cycleVariant(i + 1))).size === VARIANTS.length && cycleVariant(1) === cycleVariant(VARIANTS.length + 1));
check('every weather can be picked in settings',
    ['default', 'cycle', ...VARIANTS].every(w => normalizeSettings({ version: 2, weather: w }).weather === w)
    && normalizeSettings({ version: 2, weather: 'hail' }).weather === 'default');
check('every Casual scene exists and can be picked in settings',
    CASUAL_SCENES.every(id => SCENES[id] && normalizeSettings({ version: 2, casualScene: id }).casualScene === id),
    `${CASUAL_SCENES.length} scenes`);

// Neon Fall has its own arcade sounds in every weather
check('neon plays its arcade cues and far-off cabinets in every weather',
    VARIANTS.every(v => { const mix = ambienceFor(SCENES.neon, v); return mix.arcade === 1 && mix.cabinets > 0; }));

// --- The settings menu is built from SETTINGS_TABS ---
{
    const defs = SETTINGS_TABS.flatMap(t => t.settings);
    const problems = [];
    for (const def of defs) {
        if (!(def.key in DEFAULT_SETTINGS)) problems.push(`${def.key}: not in DEFAULT_SETTINGS`);
        if (!def.label || !def.hint) problems.push(`${def.key}: missing label or hint`);
        if (def.type === 'range' && !getConstraint(def.key)) problems.push(`${def.key}: range without a constraint`);
        if (def.type === 'toggle' && typeof DEFAULT_SETTINGS[def.key] !== 'boolean') problems.push(`${def.key}: toggle on a non-boolean`);
        if (def.type === 'enum') {
            if (!def.values?.length) problems.push(`${def.key}: enum without values`);
            for (const v of def.values || []) {
                if (normalizeSettings({ version: 2, [def.key]: v })[def.key] !== v) problems.push(`${def.key}: "${v}" is not accepted by settings.js`);
                if (def.describe && !String(def.describe(v))) problems.push(`${def.key}: "${v}" reads as nothing`);
            }
            if (!def.values.includes(DEFAULT_SETTINGS[def.key])) problems.push(`${def.key}: default is not one of its values`);
        }
        if (def.describe && !String(def.describe(DEFAULT_SETTINGS[def.key]))) problems.push(`${def.key}: default reads as nothing`);
    }
    check('every menu setting has a default, a hint and valid values', problems.length === 0, problems.join('; '));
    check('every setting in DEFAULT_SETTINGS can be changed in the menu',
        Object.keys(DEFAULT_SETTINGS).every(k => findSetting(k)),
        Object.keys(DEFAULT_SETTINGS).filter(k => !findSetting(k)).join(', '));
    check('settings labels are unique within a tab', SETTINGS_TABS.every(t => new Set(t.settings.map(s => s.label)).size === t.settings.length));
}

console.log(failures ? `\n${failures} FAILED` : '\nAll content checks passed');
process.exit(failures ? 1 : 0);
