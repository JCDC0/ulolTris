/**
 * music.js - Procedural soundtrack engine.
 *
 * Plays the songs in tracks.js on the synth voices in voices.js. Scheduling uses a
 * lookahead timer: every TICK_MS it queues whole bars that start within LOOKAHEAD_S,
 * timed on the AudioContext clock so tempo stays exact even when frames drop.
 *
 * Switching tracks is a handoff, not a fade: the new track starts exactly on the old
 * track's next beat at full level, and the old one is released over HANDOFF_S from that
 * same beat. There is never a dip in volume between the two. A playlist uses the same
 * handoff at the end of each track, on the bar line.
 *
 * Each track has its own bus: a compressor (so dense bars cannot clip), a tempo-synced
 * delay, a reverb, and a "pump" input that the kick ducks, the way dance music ducks its
 * pads.
 */

import { getTrack, TRACK_INFO } from './tracks.js';
import { createVoices, KICKS } from './voices.js';

const TICK_MS = 25;
const LOOKAHEAD_S = 0.2;
const HANDOFF_S = 0.12;
const TRACK_GAIN = 0.3;

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function createNoiseBuffer(ctx) {
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
}

const impulses = new WeakMap();

/** A short, dark room: noise that dies away, made once per context. */
function impulse(ctx) {
    if (!impulses.has(ctx)) {
        const length = Math.floor(ctx.sampleRate * 1.8);
        const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
            let seed = 7 + c * 13;
            let dark = 0;
            for (let i = 0; i < length; i++) {
                seed = (seed * 1664525 + 1013904223) >>> 0;
                dark += ((seed / 4294967296) * 2 - 1 - dark) * 0.4;
                data[i] = dark * Math.pow(1 - i / length, 3.2);
            }
        }
        impulses.set(ctx, buffer);
    }
    return impulses.get(ctx);
}

/**
 * A track's output. Voices feed `dry`, `send` (delay), `verb` (reverb) or `pad` (dry, but
 * ducked by the kick); everything ends in the compressor, then the track gain that the
 * handoff between tracks works on.
 * @returns {{ gain: GainNode, bus: Object, pump: AudioParam, nodes: AudioNode[] }}
 */
function createBus(ctx, track, destination) {
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.15;
    comp.connect(gain);

    const delay = ctx.createDelay(2);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = track.delay;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(comp);

    const verb = ctx.createGain();
    verb.gain.value = track.verb;
    const room = ctx.createConvolver();
    room.buffer = impulse(ctx);
    verb.connect(room);
    room.connect(comp);

    const pad = ctx.createGain();
    pad.connect(comp);

    return {
        gain,
        bus: { dry: comp, send: delay, verb, pad, bpm: track.bpm },
        pump: pad.gain,
        nodes: [comp, delay, feedback, wet, verb, room, pad],
    };
}

/**
 * Schedule one bar of events starting at barStart. Returns the bar length in seconds.
 */
function scheduleBar(voices, track, bus, pump, events, barStart, tempoScale) {
    const bpm = track.bpm * tempoScale;
    const step = 60 / bpm / 4;
    bus.bpm = bpm;
    const when = e => barStart + (e.s + (track.swing && e.s % 4 === 2 ? track.swing : 0)) * step;
    if (track.pump > 0) {
        // Every kick ducks the pumped voices and lets them swell back before the next one
        const kicks = events.filter(e => KICKS.has(e.v)).map(when).sort((a, b) => a - b);
        for (const t of kicks) {
            pump.setValueAtTime(1 - track.pump, t);
            pump.linearRampToValueAtTime(1, t + Math.min(0.25, step * 4));
        }
    }
    for (const e of events) voices[e.v]?.(when(e), e.n === null ? 0 : midiToFreq(e.n), e.l * step, e.g, bus);
    return 16 * step;
}

function nextBar(track, bar) {
    return bar + 1 >= track.bars.length ? track.loopStart : bar + 1;
}

/**
 * Render a track without playing it, for tests and previews. Runs faster than real time.
 * @param {string} id - a track id from tracks.js
 * @param {number} seconds
 * @param {string[]} [onlyVoices] - render just these voices (a stem), for mix checks
 * @param {number} [startBar] - the bar to start from (8 is the first B section, 12 and on are full)
 * @returns {Promise<AudioBuffer>} stereo buffer of the given length
 */
export function renderTrackOffline(id, seconds, sampleRate = 44100, onlyVoices = null, startBar = 0) {
    const track = getTrack(id);
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    const voices = createVoices(ctx, createNoiseBuffer(ctx));
    const { gain, bus, pump } = createBus(ctx, track, ctx.destination);
    gain.gain.value = TRACK_GAIN * track.gain;
    let t = 0.05;
    let bar = startBar;
    while (t < seconds) {
        const events = track.bars[bar].filter(e => !onlyVoices || onlyVoices.includes(e.v));
        t += scheduleBar(voices, track, bus, pump, events, t, 1);
        bar = nextBar(track, bar);
    }
    return ctx.startRendering();
}

/**
 * Create the music engine. Nothing makes sound until unlock() runs from a user gesture.
 *
 * @param {Object} settingsRef - Shared settings (masterVolume, musicVolume, musicMuted)
 */
export function createMusicEngine(settingsRef) {
    let ctx = null;
    let out = null;         // volume from settings
    let duckGain = null;    // pause ducking
    let duckFilter = null;  // pause muffling
    let voices = null;
    let timer = null;

    const players = [];     // { id, track, level, gain, bus, pump, nodes, bar, nextBarTime, barStart, barLen, stopAt }
    let wanted = null;      // id of the track that should be playing
    let mode = 'off';       // 'off', 'pinned' (one track on a loop) or 'playlist'
    let playlist = [];
    let playlistKey = '';
    let paused = false;
    let tempoScale = 1;
    let isSuppressed = () => false;
    const listeners = new Set();

    function init() {
        if (ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioContext();

        out = ctx.createGain();
        out.gain.value = targetVolume();
        duckGain = ctx.createGain();
        duckFilter = ctx.createBiquadFilter();
        duckFilter.type = 'lowpass';
        duckFilter.frequency.value = 18000;
        duckGain.connect(duckFilter);
        duckFilter.connect(out);
        out.connect(ctx.destination);

        voices = createVoices(ctx, createNoiseBuffer(ctx));

        timer = setInterval(tick, TICK_MS);
    }

    function targetVolume() {
        if (settingsRef.musicMuted) return 0;
        return ((settingsRef.masterVolume ?? 100) / 100) * ((settingsRef.musicVolume ?? 100) / 100);
    }

    // --- Scheduling ---

    function createPlayer(id, startAt) {
        const track = getTrack(id);
        const { gain, bus, pump, nodes } = createBus(ctx, track, duckGain);
        // Full level from the first note: each voice has its own attack, so nothing clicks.
        const level = TRACK_GAIN * track.gain;
        gain.gain.value = level;
        return { id, track, level, gain, bus, pump, nodes, bar: 0, nextBarTime: startAt, barStart: null, barLen: 0, stopAt: null };
    }

    /** The next beat of a playing track, at least 60 ms away so it can still be scheduled. */
    function nextBeat(p, now) {
        if (p.barStart === null) return now + 0.1;
        const beat = p.barLen / 4;
        return p.barStart + Math.ceil((now + 0.06 - p.barStart) / beat) * beat;
    }

    function tick() {
        const now = ctx.currentTime;
        const suppressed = isSuppressed();

        const vol = suppressed ? 0 : targetVolume();
        if (Math.abs(out.gain.value - vol) > 0.001) out.gain.setTargetAtTime(vol, now, 0.05);

        for (const p of players) {
            if (suppressed) continue;
            // A track that is handing off keeps playing up to its last beat.
            const until = p.stopAt === null ? now + LOOKAHEAD_S : Math.min(now + LOOKAHEAD_S, p.stopAt);
            while (p.nextBarTime < until) {
                if (p.nextBarTime < now - 0.05) p.nextBarTime = now + 0.02;
                p.barStart = p.nextBarTime;
                p.barLen = scheduleBar(voices, p.track, p.bus, p.pump, p.track.bars[p.bar], p.nextBarTime, tempoScale);
                p.nextBarTime += p.barLen;
                const finished = p.bar + 1 >= p.track.bars.length;
                p.bar = nextBar(p.track, p.bar);
                // In a playlist the next track starts on the bar line where this one ends
                if (finished && p.stopAt === null && mode === 'playlist' && playlist.length > 1 && p.id === wanted) {
                    setWanted(playlist[(playlist.indexOf(wanted) + 1) % playlist.length], p.nextBarTime);
                }
            }
        }

        // Pause the clock while suppressed so the song resumes in time afterwards.
        if (suppressed) for (const p of players) if (p.stopAt === null) p.nextBarTime = now + 0.1;
    }

    /** Release a track from time `at`, then free its nodes. */
    function release(p, at) {
        const now = ctx.currentTime;
        p.stopAt = at;
        p.gain.gain.cancelScheduledValues(now);
        p.gain.gain.setValueAtTime(p.level, at);
        p.gain.gain.linearRampToValueAtTime(0, at + HANDOFF_S);
        setTimeout(() => {
            p.gain.disconnect();
            p.nodes.forEach(n => n.disconnect());
            players.splice(players.indexOf(p), 1);
        }, (at - now + HANDOFF_S) * 1000 + 1500);
    }

    /** Make the playing track match `wanted`, starting the change at `at` (default: the next beat). */
    function applyTrack(at = null) {
        if (!ctx) return;
        const now = ctx.currentTime;
        const live = players.find(p => p.stopAt === null);
        if (live && live.id === wanted) return;

        let startAt = now + 0.1;
        if (live) {
            startAt = at ?? (wanted && !isSuppressed() ? nextBeat(live, now) : now + 0.05);
            release(live, startAt);
        }
        if (wanted) players.push(createPlayer(wanted, startAt));
    }

    function setWanted(id, at = null) {
        if (id === wanted) return;
        wanted = id;
        applyTrack(at);
        listeners.forEach(cb => cb(wanted));
    }

    return {
        /** Create the AudioContext. Call from a user gesture (click or key). */
        unlock() {
            init();
            if (ctx.state === 'suspended') ctx.resume();
            applyTrack();
        },

        /** Loop one track (an id from tracks.js), or pass null for silence. */
        setTrack(id) {
            const known = id && TRACK_INFO[id] ? id : null;
            mode = known ? 'pinned' : 'off';
            playlist = [];
            playlistKey = '';
            setWanted(known);
        },

        /**
         * Play a playlist: its tracks in order, each handed to the next on the bar line when it
         * ends. Asking again for the same list changes nothing, so the game can ask every frame;
         * a new list starts on a random one of its tracks, unless the one playing is in it.
         * @param {string[]} ids
         */
        setPlaylist(ids) {
            const list = ids.filter(id => TRACK_INFO[id]);
            const key = list.join();
            if (mode === 'playlist' && key === playlistKey) return;
            mode = list.length ? 'playlist' : 'off';
            playlist = list;
            playlistKey = key;
            setWanted(list.length ? (list.includes(wanted) ? wanted : list[Math.floor(Math.random() * list.length)]) : null);
        },

        /** Do what musicPlan() in tracks.js says: silence, one track, or a playlist. */
        play(plan) {
            if (plan.off) this.setTrack(null);
            else if (plan.track) this.setTrack(plan.track);
            else this.setPlaylist(plan.playlist);
        },

        /** Move on to the next track of the playlist, on the next beat. */
        skip() {
            if (mode !== 'playlist' || playlist.length < 2) return;
            setWanted(playlist[(playlist.indexOf(wanted) + 1) % playlist.length]);
        },

        /** The id of the track that is (or is about to be) playing, or null. */
        getTrack() {
            return wanted;
        },

        /** Call `cb(id)` whenever the playing track changes. Returns a function that stops it. */
        onTrack(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },

        /** Muffle and lower the music while the game is paused. */
        setPaused(value) {
            if (value === paused) return;
            paused = value;
            if (!ctx) return;
            const now = ctx.currentTime;
            duckGain.gain.setTargetAtTime(value ? 0.35 : 1, now, 0.1);
            duckFilter.frequency.setTargetAtTime(value ? 700 : 18000, now, 0.1);
        },

        /** Speed up the song slightly (1 = written tempo). Applies from the next bar. */
        setTempoScale(scale) {
            tempoScale = scale;
        },

        /** Silence the soundtrack while this returns true (for example, user music playing). */
        setSuppressor(fn) {
            isSuppressed = fn;
        },

        dispose() {
            if (timer) clearInterval(timer);
            if (ctx) ctx.close();
            ctx = null;
        },
    };
}
