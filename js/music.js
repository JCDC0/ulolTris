/**
 * music.js - Procedural soundtrack engine.
 *
 * Plays the song data in tracks.js with Web Audio synth voices. Scheduling uses a
 * lookahead timer: every TICK_MS it queues whole bars that start within LOOKAHEAD_S,
 * timed on the AudioContext clock so tempo stays exact even when frames drop.
 * Each playing track has its own gain node, so switching tracks is a crossfade.
 */

import { TRACKS } from './tracks.js';

const TICK_MS = 25;
const LOOKAHEAD_S = 0.2;
const CROSSFADE_S = 1.5;
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

/**
 * Synth voices bound to one AudioContext. Each voice is
 * (time, freq, duration, velocity, bus) and schedules its own nodes.
 */
function createVoices(ctx, noise) {
    function env(param, t, peak, attack, hold, release) {
        param.setValueAtTime(0.0001, t);
        param.linearRampToValueAtTime(peak, t + attack);
        param.setValueAtTime(peak, t + attack + hold);
        param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
        return attack + hold + release;
    }

    function osc(type, freq, t, end, dest, detune = 0) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.detune.value = detune;
        o.connect(dest);
        o.start(t);
        o.stop(end);
        return o;
    }

    function voiceGain(dest, onEnd) {
        const g = ctx.createGain();
        g.connect(dest);
        return { g, done: (node) => { node.onended = () => { g.disconnect(); onEnd?.(); }; } };
    }

    function noiseBurst(t, dur, vel, dest, filterType, freq, q = 1) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq;
        f.Q.value = q;
        const { g, done } = voiceGain(dest, () => f.disconnect());
        env(g.gain, t, vel, 0.001, 0, dur);
        src.connect(f);
        f.connect(g);
        src.start(t);
        src.stop(t + dur + 0.02);
        done(src);
    }

    return {
        /** FM electric piano: sine carrier, sine modulator at 1:1 with a decaying index. */
        epiano(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            const len = env(g.gain, t, vel, 0.005, Math.max(0, dur - 0.05), 0.6);
            const mod = ctx.createOscillator();
            const modGain = ctx.createGain();
            mod.frequency.value = freq;
            modGain.gain.setValueAtTime(freq * 1.2, t);
            modGain.gain.exponentialRampToValueAtTime(freq * 0.1, t + 0.4);
            mod.connect(modGain);
            const car = osc('sine', freq, t, t + len, g);
            modGain.connect(car.frequency);
            mod.start(t);
            mod.stop(t + len);
            done(car);
        },

        /** Bell: FM at 1:3.5 for a glassy tone, with a delay send. */
        bell(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            g.connect(bus.send);
            const len = env(g.gain, t, vel, 0.003, Math.min(dur, 0.1), 0.9 + dur * 0.5);
            const mod = ctx.createOscillator();
            const modGain = ctx.createGain();
            mod.frequency.value = freq * 3.5;
            modGain.gain.setValueAtTime(freq * 0.8, t);
            modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.8);
            mod.connect(modGain);
            const car = osc('sine', freq, t, t + len, g);
            modGain.connect(car.frequency);
            mod.start(t);
            mod.stop(t + len);
            done(car);
        },

        /** Detuned saws through a slow lowpass. */
        pad(t, freq, dur, vel, bus) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 1400;
            f.connect(bus.dry);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.25, Math.max(0, dur - 0.25), 0.5);
            osc('sawtooth', freq, t, t + len, g, -8);
            done(osc('sawtooth', freq, t, t + len, g, 8));
        },

        softbass(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            const len = env(g.gain, t, vel, 0.01, Math.max(0, dur - 0.1), 0.25);
            osc('sine', freq, t, t + len, g);
            done(osc('triangle', freq * 2, t, t + len, g));
        },

        bass(t, freq, dur, vel, bus) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(1800, t);
            f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
            f.connect(bus.dry);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.004, Math.max(0, dur * 0.7), 0.06);
            osc('sine', freq, t, t + len, g);
            done(osc('square', freq, t, t + len, g));
        },

        pluck(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            g.connect(bus.send);
            const len = env(g.gain, t, vel, 0.002, 0, 0.12);
            done(osc('square', freq, t, t + len, g));
        },

        stab(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            const len = env(g.gain, t, vel, 0.002, 0.03, 0.08);
            osc('sawtooth', freq, t, t + len, g, -10);
            done(osc('sawtooth', freq, t, t + len, g, 10));
        },

        /** Square/saw lead with delayed vibrato. */
        lead(t, freq, dur, vel, bus) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 3200;
            f.connect(bus.dry);
            f.connect(bus.send);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.008, Math.max(0, dur - 0.03), 0.12);
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.value = 5.5;
            lfoGain.gain.setValueAtTime(0, t);
            lfoGain.gain.linearRampToValueAtTime(freq * 0.006, t + 0.25);
            lfo.connect(lfoGain);
            const a = osc('square', freq, t, t + len, g);
            const b = osc('sawtooth', freq, t, t + len, g, 6);
            lfoGain.connect(a.frequency);
            lfoGain.connect(b.frequency);
            lfo.start(t);
            lfo.stop(t + len);
            done(a);
        },

        kick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.001, 0.02, 0.25);
            const o = osc('sine', 150, t, t + 0.3, g);
            o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
            done(o);
        },

        lofikick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.004, 0.02, 0.3);
            const o = osc('sine', 110, t, t + 0.35, g);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
            done(o);
        },

        snare(t, _f, _d, vel, bus) {
            noiseBurst(t, 0.16, vel, bus.dry, 'bandpass', 1800, 0.8);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.5, 0.001, 0, 0.08);
            done(osc('triangle', 190, t, t + 0.1, g));
        },

        rim(t, _f, _d, vel, bus) {
            noiseBurst(t, 0.05, vel, bus.dry, 'bandpass', 2500, 4);
        },

        hat(t, _f, _d, vel, bus) {
            noiseBurst(t, 0.035, vel, bus.dry, 'highpass', 7500);
        },

        brush(t, _f, _d, vel, bus) {
            noiseBurst(t, 0.12, vel, bus.dry, 'bandpass', 5000, 0.6);
        },

        crash(t, _f, _d, vel, bus) {
            noiseBurst(t, 1.2, vel, bus.dry, 'highpass', 4000);
        },
    };
}

/**
 * A track's output: voices and a tempo-synced delay feed a compressor, then the
 * track gain (used for crossfades). The compressor keeps dense bars from clipping.
 * @returns {{ gain: GainNode, bus: { dry: AudioNode, send: AudioNode }, nodes: AudioNode[] }}
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

    return { gain, bus: { dry: comp, send: delay }, nodes: [comp, delay, feedback, wet] };
}

/**
 * Schedule one bar of events starting at barStart. Returns the bar length in seconds.
 */
function scheduleBar(voices, track, bus, events, barStart, tempoScale) {
    const step = 60 / (track.bpm * tempoScale) / 4;
    for (const e of events) {
        let start = e.s;
        if (track.swing && e.s % 4 === 2) start += track.swing;
        voices[e.v]?.(barStart + start * step, e.n === null ? 0 : midiToFreq(e.n), e.l * step, e.g, bus);
    }
    return 16 * step;
}

function nextBar(track, bar) {
    return bar + 1 >= track.bars.length ? track.loopStart : bar + 1;
}

/**
 * Render a track without playing it, for tests and previews. Runs faster than real time.
 * @param {string[]} [onlyVoices] - render just these voices (a stem), for mix checks
 * @returns {Promise<AudioBuffer>} mono buffer of the given length
 */
export function renderTrackOffline(name, seconds, sampleRate = 44100, onlyVoices = null) {
    const track = TRACKS[name];
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const voices = createVoices(ctx, createNoiseBuffer(ctx));
    const { gain, bus } = createBus(ctx, track, ctx.destination);
    gain.gain.value = TRACK_GAIN;
    let t = 0.05;
    let bar = 0;
    while (t < seconds) {
        const events = track.bars[bar].filter(e => !onlyVoices || onlyVoices.includes(e.v));
        t += scheduleBar(voices, track, bus, events, t, 1);
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

    const players = [];     // { name, track, gain, bus, nodes, bar, nextBarTime, stopping }
    let wanted = null;      // track name that should be playing
    let paused = false;
    let tempoScale = 1;
    let isSuppressed = () => false;

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

    function createPlayer(name) {
        const track = TRACKS[name];
        const { gain, bus, nodes } = createBus(ctx, track, duckGain);
        return { name, track, gain, bus, nodes, bar: 0, nextBarTime: ctx.currentTime + 0.1, stopping: false };
    }

    function tick() {
        const now = ctx.currentTime;
        const suppressed = isSuppressed();

        const vol = suppressed ? 0 : targetVolume();
        if (Math.abs(out.gain.value - vol) > 0.001) out.gain.setTargetAtTime(vol, now, 0.05);

        for (const p of players) {
            if (p.stopping || suppressed) continue;
            while (p.nextBarTime < now + LOOKAHEAD_S) {
                if (p.nextBarTime < now - 0.05) p.nextBarTime = now + 0.02;
                p.nextBarTime += scheduleBar(voices, p.track, p.bus, p.track.bars[p.bar], p.nextBarTime, tempoScale);
                p.bar = nextBar(p.track, p.bar);
            }
        }

        // Pause the clock while suppressed so the song resumes in time afterwards.
        if (suppressed) for (const p of players) p.nextBarTime = now + 0.1;
    }

    function fadeTo(p, value, seconds) {
        const now = ctx.currentTime;
        p.gain.gain.cancelScheduledValues(now);
        p.gain.gain.setValueAtTime(Math.max(p.gain.gain.value, 0.0001), now);
        p.gain.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + seconds);
    }

    function applyTrack() {
        if (!ctx) return;
        for (const p of players) {
            if (p.name !== wanted && !p.stopping) {
                p.stopping = true;
                fadeTo(p, 0.0001, CROSSFADE_S);
                setTimeout(() => {
                    p.gain.disconnect();
                    p.nodes.forEach(n => n.disconnect());
                    players.splice(players.indexOf(p), 1);
                }, CROSSFADE_S * 1000 + 3000);
            }
        }
        if (wanted && !players.some(p => p.name === wanted && !p.stopping)) {
            const p = createPlayer(wanted);
            players.push(p);
            fadeTo(p, TRACK_GAIN, players.length > 1 ? CROSSFADE_S : 0.3);
        }
    }

    return {
        /** Create the AudioContext. Call from a user gesture (click or key). */
        unlock() {
            init();
            if (ctx.state === 'suspended') ctx.resume();
            applyTrack();
        },

        /** Switch to a track ('calm' | 'competitive' | 'intense'), or null for silence. */
        setTrack(name) {
            if (name === wanted) return;
            wanted = name && TRACKS[name] ? name : null;
            applyTrack();
        },

        getTrack() {
            return wanted;
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
