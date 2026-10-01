/**
 * voices.js - The synth voices the soundtrack is played on, all built from Web Audio
 * oscillators, filtered noise and one small string model. Nothing is sampled.
 *
 * A voice is `(time, freq, duration, velocity, bus)` and schedules its own nodes. `bus`
 * has four inputs: `dry` (straight to the mix), `send` (the track's tempo-synced delay),
 * `verb` (its reverb) and `pad` (the same as dry, but ducked by the kick: the sidechain
 * pump of dance music). `bus.bpm` is the tempo, for voices that move in time with it.
 * Drums ignore `freq` (toms use it as their pitch).
 *
 * The voices are grouped by the job they do in the tracks in tracks.js.
 */

import { pulseWave } from './chip.js';

/** Every voice name a track may use. */
export const VOICE_NAMES = [
    // Keys and mallets
    'lofikeys', 'rhodes', 'vibes', 'flute', 'nylon',
    // Pads and synths
    'warmpad', 'strings', 'superpad', 'supersaw', 'sawpluck', 'clav', 'stab', 'lead', 'hoover',
    // Bass
    'sub', 'upright', 'synthbass', 'funkbass', 'reese', 'rollbass', 'wobble',
    // Drums and percussion
    'lofikick', 'softkick', 'kick', 'hardkick', 'softsnare', 'brushsnare', 'gsnare', 'dnbsnare', 'snare', 'clap', 'xstick',
    'hatc', 'hat', 'openhat', 'pedal', 'ride', 'shaker', 'tom', 'crash', 'riser', 'tick',
    // The 8-bit sound chip of the Classic track: two pulse channels, a triangle bass, noise drums
    'chipLead', 'chipHarm', 'chipBass', 'chipKick', 'chipSnare', 'chipHat',
];

/** Voices that are ducked by the kick when a track has a pump. */
export const PUMPED = new Set(['warmpad', 'strings', 'superpad', 'sawpluck', 'stab']);
/** The voices that count as a kick for the pump. */
export const KICKS = new Set(['lofikick', 'softkick', 'kick', 'hardkick']);

/**
 * Create the voices for one AudioContext. Nothing touches the context until a voice plays.
 * @param {BaseAudioContext} ctx
 * @param {AudioBuffer} noise - a second or more of white noise
 * @returns {Object<string, (t: number, freq: number, dur: number, vel: number, bus: Object) => void>}
 */
export function createVoices(ctx, noise) {
    const ksCache = new Map();

    /** Attack, hold, then an exponential release, on a gain parameter. Returns the length. */
    function env(param, t, peak, attack, hold, release) {
        param.setValueAtTime(0.0001, t);
        param.linearRampToValueAtTime(peak, t + attack);
        param.setValueAtTime(peak, t + attack + hold);
        param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
        return attack + hold + release;
    }

    function osc(type, freq, t, end, dest, detune = 0, level = 1) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.detune.value = detune;
        if (level === 1) o.connect(dest);
        else {
            const g = ctx.createGain();
            g.gain.value = level;
            o.connect(g);
            g.connect(dest);
        }
        o.start(t);
        o.stop(end);
        return o;
    }

    /** A gain node into dest. `done(node)` frees everything when that node ends. */
    function voiceGain(dest, onEnd) {
        const g = ctx.createGain();
        g.connect(dest);
        return { g, done: node => { node.onended = () => { g.disconnect(); onEnd?.(); }; } };
    }

    function biquad(type, freq, q, dest) {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        f.connect(dest);
        return f;
    }

    /** A burst of filtered noise with its own decay, into one or more inputs. */
    function burst(t, dur, vel, dests, type, freq, q = 1, attack = 0.001) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const { g, done } = voiceGain(dests[0], () => f.disconnect());
        for (const d of dests.slice(1)) g.connect(d);
        env(g.gain, t, vel, attack, 0, dur);
        src.connect(f);
        f.connect(g);
        src.start(t, Math.random() * 0.5);
        src.stop(t + attack + dur + 0.02);
        done(src);
    }

    /** FM pair: a sine carrier whose frequency is modulated by a sine at `ratio`, index easing from `from` to `to`. */
    function fm(freq, ratio, from, to, over, t, end, dest, detune = 0) {
        const car = osc('sine', freq, t, end, dest, detune);
        const mod = ctx.createOscillator();
        mod.frequency.value = freq * ratio;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(freq * from, t);
        mg.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * to), t + over);
        mod.connect(mg);
        mg.connect(car.frequency);
        mod.start(t);
        mod.stop(end);
        return car;
    }

    /** A plucked string: a looped noise burst averaged with its neighbour (Karplus-Strong), cached per pitch. */
    function string(freq) {
        const key = Math.round(freq * 2) / 2;
        if (ksCache.has(key)) return ksCache.get(key);
        const sr = ctx.sampleRate;
        const period = Math.max(2, Math.round(sr / key));
        const len = Math.floor(sr * 1.6);
        const buffer = ctx.createBuffer(1, len, sr);
        const out = buffer.getChannelData(0);
        const line = new Float32Array(period);
        let seed = 9301 + Math.round(key * 7);
        for (let i = 0; i < period; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; line[i] = (seed / 4294967296) * 2 - 1; }
        for (let i = 1; i < period; i++) line[i] = 0.55 * line[i] + 0.45 * line[i - 1];
        let p = 0;
        for (let i = 0; i < len; i++) {
            const next = (p + 1) % period;
            out[i] = line[p];
            line[p] = (line[p] + line[next]) * 0.4985;
            p = next;
        }
        const entry = { buffer, rate: key / (sr / period) };
        ksCache.set(key, entry);
        return entry;
    }

    function drive(amount) {
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 511.5) - 1) * amount);
        shaper.curve = curve;
        return shaper;
    }

    /** Sustained note helper for pads: several detuned oscillators through a lowpass. */
    function padNote(type, detunes, cutoff, attack, release, t, freq, dur, vel, bus) {
        const f = biquad('lowpass', cutoff, 0.5, bus.pad);
        f.connect(bus.verb);
        const { g, done } = voiceGain(f, () => f.disconnect());
        const len = env(g.gain, t, vel, attack, Math.max(0, dur - attack), release);
        let last;
        for (const d of detunes) last = osc(type, freq, t, t + len, g, d, 1 / Math.sqrt(detunes.length));
        done(last);
    }

    /** A steady pulse wave with a hard start and a short release, like a sound chip channel. */
    function pulseNote(t, freq, dur, vel, bus, duty) {
        const { g, done } = voiceGain(bus.dry);
        const len = env(g.gain, t, vel, 0.002, Math.max(0, dur - 0.025), 0.03);
        const o = ctx.createOscillator();
        o.setPeriodicWave(pulseWave(ctx, duty));
        o.frequency.setValueAtTime(freq, t);
        o.connect(g);
        o.start(t);
        o.stop(t + len);
        done(o);
    }

    return {
        // --- Keys and mallets ---

        /** Dusty electric piano: two slightly detuned FM pairs through a low filter. */
        lofikeys(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 1700, 0.6, bus.dry);
            f.connect(bus.verb);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.006, Math.max(0, dur - 0.1), 0.55);
            fm(freq, 1, 1.0, 0.1, 0.5, t, t + len, g, -7);
            done(fm(freq, 1, 0.8, 0.1, 0.5, t, t + len, g, 7));
        },

        /** Electric piano with a tine: FM with a bright start that settles, and a small knock. */
        rhodes(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 3400, 0.5, bus.dry);
            f.connect(bus.verb);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.004, Math.max(0, dur - 0.05), 0.6);
            done(fm(freq, 1, 1.5, 0.14, 0.7, t, t + len, g));
            burst(t, 0.03, vel * 0.25, [f], 'bandpass', Math.min(9000, freq * 6), 3);
        },

        /** Vibraphone: a sine with a short bright overtone and a slow tremolo, ringing on. */
        vibes(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            g.connect(bus.verb);
            const len = env(g.gain, t, vel, 0.003, Math.min(dur, 0.25), 0.9 + dur * 0.35);
            const tremolo = ctx.createOscillator();
            const depth = ctx.createGain();
            tremolo.frequency.value = 5.2;
            depth.gain.value = vel * 0.22;
            tremolo.connect(depth);
            depth.connect(g.gain);
            tremolo.start(t);
            tremolo.stop(t + len);
            const top = ctx.createGain();
            top.gain.setValueAtTime(0.28, t);
            top.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            top.connect(g);
            osc('sine', freq * 3.98, t, t + len, top);
            done(osc('sine', freq, t, t + len, g));
        },

        /** Flute: a sine and a soft triangle with a little breath and a vibrato that arrives late. */
        flute(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 5200, 0.5, bus.dry);
            f.connect(bus.verb);
            f.connect(bus.send);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.05, Math.max(0, dur - 0.08), 0.18);
            const vib = ctx.createOscillator();
            const vibDepth = ctx.createGain();
            vib.frequency.value = 5.3;
            vibDepth.gain.setValueAtTime(0, t);
            vibDepth.gain.linearRampToValueAtTime(freq * 0.007, t + 0.3);
            vib.connect(vibDepth);
            vib.start(t);
            vib.stop(t + len);
            const a = osc('sine', freq, t, t + len, g);
            const b = osc('triangle', freq, t, t + len, g, 0, 0.3);
            vibDepth.connect(a.frequency);
            vibDepth.connect(b.frequency);
            burst(t, len, vel * 0.12, [f], 'bandpass', Math.min(8000, freq * 2.5), 1.5, 0.05);
            done(a);
        },

        /** Nylon guitar: a modelled plucked string. */
        nylon(t, freq, dur, vel, bus) {
            const { buffer, rate } = string(freq);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = rate;
            const f = biquad('lowpass', 3800, 0.5, bus.dry);
            f.connect(bus.verb);
            const { g, done } = voiceGain(f, () => f.disconnect());
            g.gain.setValueAtTime(vel * 1.6, t);
            g.gain.setValueAtTime(vel * 1.6, t + Math.max(0.12, dur));
            g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.12, dur) + 0.35);
            src.connect(g);
            src.start(t);
            src.stop(t + Math.max(0.12, dur) + 0.4);
            done(src);
        },

        // --- Pads and synths ---

        warmpad(t, freq, dur, vel, bus) { padNote('triangle', [-6, 6], 1000, 0.5, 0.8, t, freq, dur, vel, bus); },
        strings(t, freq, dur, vel, bus) { padNote('sawtooth', [-10, 0, 10], 2200, 0.3, 0.5, t, freq, dur, vel, bus); },
        superpad(t, freq, dur, vel, bus) { padNote('sawtooth', [-18, -9, 0, 9, 18], 2600, 0.14, 0.4, t, freq, dur, vel, bus); },

        /** Five detuned saws: the wide lead of trance and house. */
        supersaw(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 5200, 0.5, bus.dry);
            f.connect(bus.send);
            f.connect(bus.verb);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.006, Math.max(0, dur - 0.02), 0.14);
            let last;
            for (const d of [-16, -8, 0, 8, 16]) last = osc('sawtooth', freq, t, t + len, g, d, 0.45);
            done(last);
        },

        /** A saw whose filter closes as it decays: the arpeggio voice. */
        sawpluck(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 4500, 1.2, bus.pad);
            f.frequency.setValueAtTime(4500, t);
            f.frequency.exponentialRampToValueAtTime(700, t + 0.17);
            f.connect(bus.send);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.002, 0, 0.22);
            osc('sawtooth', freq, t, t + len, g, -6, 0.6);
            done(osc('sawtooth', freq, t, t + len, g, 6, 0.6));
        },

        /** A short, dry, funky keyboard: a pulse-ish tone through a band. */
        clav(t, freq, dur, vel, bus) {
            const f = biquad('bandpass', 1900, 1.1, bus.dry);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel * 2.2, 0.001, 0, 0.09);
            osc('square', freq, t, t + len, g, 0, 0.5);
            done(osc('sawtooth', freq, t, t + len, g, 8, 0.5));
        },

        /** A short chord hit from two detuned saws. */
        stab(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.pad);
            const len = env(g.gain, t, vel, 0.002, 0.03, 0.09);
            osc('sawtooth', freq, t, t + len, g, -10);
            done(osc('sawtooth', freq, t, t + len, g, 10));
        },

        /** Square and saw lead with a vibrato that arrives late. */
        lead(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 3200, 0.7, bus.dry);
            f.connect(bus.send);
            f.connect(bus.verb);
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

        /** The trance "hoover": wide saws that start a fourth high and swoop down into the note. */
        hoover(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 3600, 0.9, bus.dry);
            f.connect(bus.send);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.01, Math.max(0, dur - 0.03), 0.14);
            let last;
            for (const d of [-28, 0, 28]) {
                const o = osc('sawtooth', freq * 1.335, t, t + len, g, d, 0.55);
                o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
                last = o;
            }
            done(last);
        },

        // --- Bass ---

        /** A pure low sine with a soft edge. */
        sub(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            const len = env(g.gain, t, vel, 0.01, Math.max(0, dur - 0.1), 0.12);
            done(osc('sine', freq, t, t + len, g));
        },

        /** Upright bass: a plucked triangle and sine with a little finger noise. */
        upright(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 950, 0.7, bus.dry);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel * 1.3, 0.006, 0, Math.max(0.3, dur * 1.2));
            osc('triangle', freq, t, t + len, g);
            done(osc('sine', freq * 2, t, t + len, g, 0, 0.3));
            burst(t, 0.015, vel * 0.3, [bus.dry], 'bandpass', 1800, 1);
        },

        /** Synthwave bass: a saw with a filter that snaps shut, over a sine. */
        synthbass(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 1800, 1.5, bus.dry);
            f.frequency.setValueAtTime(1800, t);
            f.frequency.exponentialRampToValueAtTime(320, t + 0.14);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.004, Math.max(0, dur * 0.7), 0.06);
            osc('sawtooth', freq, t, t + len, g, 0, 0.7);
            osc('sine', freq, t, t + len, bus.dry, 0, vel * 0.8);
            done(osc('square', freq, t, t + len, g, 4, 0.3));
        },

        /** Funk bass: a quick pop from a filter that opens and shuts, over a sine. */
        funkbass(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 2600, 2, bus.dry);
            f.frequency.setValueAtTime(2600, t);
            f.frequency.exponentialRampToValueAtTime(380, t + 0.1);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.002, Math.max(0, dur * 0.4), 0.09);
            osc('sawtooth', freq, t, t + len, g, 0, 0.6);
            osc('square', freq, t, t + len, g, 0, 0.3);
            done(osc('sine', freq, t, t + len, g, 0, 0.8));
        },

        /** Reese: detuned saws that beat against each other through a low filter, over a sub. */
        reese(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 520, 1.4, bus.dry);
            f.frequency.setValueAtTime(380, t);
            f.frequency.linearRampToValueAtTime(700, t + Math.max(0.2, dur * 0.5));
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.012, Math.max(0, dur - 0.05), 0.08);
            osc('sawtooth', freq, t, t + len, g, -22, 0.5);
            osc('sawtooth', freq, t, t + len, g, 22, 0.5);
            osc('sawtooth', freq * 2, t, t + len, g, 11, 0.2);
            osc('sine', freq, t, t + len, bus.dry, 0, vel * 0.7);
            done(osc('square', freq / 2, t, t + len, g, 0, 0.2));
        },

        /** Trance bass: a short saw on the off-beat 16ths, closing fast. */
        rollbass(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 1500, 1, bus.dry);
            f.frequency.setValueAtTime(1500, t);
            f.frequency.exponentialRampToValueAtTime(260, t + 0.1);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.002, 0.02, 0.07);
            osc('sawtooth', freq, t, t + len, g, -5, 0.6);
            done(osc('sawtooth', freq, t, t + len, g, 5, 0.6));
        },

        /** The bass-music wobble: saws through a resonant filter that an eighth-note LFO opens and closes. */
        wobble(t, freq, dur, vel, bus) {
            const f = biquad('lowpass', 700, 7, bus.dry);
            const lfo = ctx.createOscillator();
            const depth = ctx.createGain();
            lfo.frequency.value = ((bus.bpm || 140) / 60) * 2;
            depth.gain.value = 620;
            f.frequency.value = 760;
            lfo.connect(depth);
            depth.connect(f.frequency);
            const { g, done } = voiceGain(f, () => f.disconnect());
            const len = env(g.gain, t, vel, 0.008, Math.max(0, dur - 0.04), 0.06);
            lfo.start(t);
            lfo.stop(t + len);
            osc('sawtooth', freq, t, t + len, g, -12, 0.5);
            osc('sawtooth', freq, t, t + len, g, 12, 0.5);
            osc('sine', freq, t, t + len, bus.dry, 0, vel * 0.6);
            done(osc('square', freq, t, t + len, g, 0, 0.25));
        },

        // --- Drums and percussion ---

        kick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.001, 0.02, 0.25);
            const o = osc('sine', 150, t, t + 0.3, g);
            o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
            done(o);
        },

        /** Boom-bap kick: soft and round. */
        lofikick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.004, 0.02, 0.3);
            const o = osc('sine', 110, t, t + 0.35, g);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
            done(o);
        },

        /** Jazz kick: a feathered thump you feel more than hear. */
        softkick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.004, 0, 0.16);
            const o = osc('sine', 95, t, t + 0.2, g);
            o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
            done(o);
        },

        /** A hard, driven kick with a click on the front. */
        hardkick(t, _f, _d, vel, bus) {
            const shaper = drive(2.6);
            shaper.connect(bus.dry);
            const { g, done } = voiceGain(shaper, () => shaper.disconnect());
            env(g.gain, t, vel * 0.85, 0.001, 0.05, 0.22);
            const o = osc('sine', 210, t, t + 0.32, g);
            o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
            burst(t, 0.012, vel * 0.35, [bus.dry], 'highpass', 3000);
            done(o);
        },

        softsnare(t, _f, _d, vel, bus) {
            burst(t, 0.17, vel, [bus.dry, bus.verb], 'bandpass', 1700, 0.5);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.45, 0.001, 0, 0.1);
            done(osc('triangle', 175, t, t + 0.12, g));
        },

        /** Brushes swept across the snare. */
        brushsnare(t, _f, _d, vel, bus) {
            burst(t, 0.2, vel, [bus.dry], 'bandpass', 4500, 0.5, 0.014);
        },

        /** Gated-reverb snare: a big burst that is cut off short. */
        gsnare(t, _f, _d, vel, bus) {
            const src = ctx.createBufferSource();
            src.buffer = noise;
            src.loop = true;
            const f = biquad('bandpass', 1600, 0.6, bus.dry);
            f.connect(bus.verb);
            const { g, done } = voiceGain(f, () => f.disconnect());
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vel, t + 0.002);
            g.gain.setValueAtTime(vel * 0.8, t + 0.13);
            g.gain.linearRampToValueAtTime(0.0001, t + 0.19);
            src.connect(f);
            f.connect(g);
            src.start(t, Math.random() * 0.5);
            src.stop(t + 0.22);
            done(src);
            const { g: tone, done: toneDone } = voiceGain(bus.dry);
            env(tone.gain, t, vel * 0.5, 0.001, 0, 0.12);
            toneDone(osc('triangle', 205, t, t + 0.14, tone));
        },

        /** Drum and bass snare: a tight crack. */
        dnbsnare(t, _f, _d, vel, bus) {
            burst(t, 0.13, vel, [bus.dry], 'bandpass', 2300, 0.7);
            burst(t, 0.01, vel * 0.5, [bus.dry], 'highpass', 5000);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.55, 0.001, 0, 0.1);
            const o = osc('triangle', 250, t, t + 0.12, g);
            o.frequency.exponentialRampToValueAtTime(175, t + 0.08);
            done(o);
        },

        snare(t, _f, _d, vel, bus) {
            burst(t, 0.16, vel, [bus.dry], 'bandpass', 1800, 0.8);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.5, 0.001, 0, 0.08);
            done(osc('triangle', 190, t, t + 0.1, g));
        },

        /** A clap: three quick bursts and a tail. */
        clap(t, _f, _d, vel, bus) {
            for (const at of [0, 0.011, 0.022]) burst(t + at, 0.012, vel * 0.8, [bus.dry], 'bandpass', 1500, 1.2);
            burst(t + 0.03, 0.16, vel * 0.7, [bus.dry, bus.verb], 'bandpass', 1400, 1);
        },

        /** Cross-stick: the rim click of a bossa nova. */
        xstick(t, _f, _d, vel, bus) {
            burst(t, 0.045, vel, [bus.dry, bus.verb], 'bandpass', 2000, 5);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.4, 0.001, 0, 0.03);
            const o = osc('sine', 820, t, t + 0.05, g);
            o.frequency.exponentialRampToValueAtTime(600, t + 0.03);
            done(o);
        },

        hatc(t, _f, _d, vel, bus) { burst(t, 0.028, vel, [bus.dry], 'highpass', 8000); },
        hat(t, _f, _d, vel, bus) { burst(t, 0.035, vel, [bus.dry], 'highpass', 7500); },
        openhat(t, _f, _d, vel, bus) { burst(t, 0.22, vel, [bus.dry], 'highpass', 7000); },
        pedal(t, _f, _d, vel, bus) { burst(t, 0.05, vel, [bus.dry], 'highpass', 4500); },

        /** Ride cymbal: bright noise with a few inharmonic sines in it. */
        ride(t, _f, _d, vel, bus) {
            burst(t, 0.5, vel * 0.6, [bus.dry, bus.verb], 'highpass', 5500);
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel * 0.1, 0.001, 0, 0.45);
            osc('sine', 4300, t, t + 0.5, g);
            osc('sine', 5900, t, t + 0.5, g);
            done(osc('sine', 7400, t, t + 0.5, g));
        },

        shaker(t, _f, _d, vel, bus) { burst(t, 0.045, vel, [bus.dry], 'bandpass', 7000, 0.8, 0.006); },

        /** A tom: a sine that falls from its pitch. */
        tom(t, freq, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.002, 0, 0.26);
            const o = osc('sine', freq * 1.4, t, t + 0.3, g);
            o.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 0.14);
            done(o);
        },

        crash(t, _f, _d, vel, bus) { burst(t, 1.2, vel, [bus.dry, bus.verb], 'highpass', 4000); },

        /** A riser: noise whose band sweeps up over the note's length, getting louder. */
        riser(t, _f, dur, vel, bus) {
            const src = ctx.createBufferSource();
            src.buffer = noise;
            src.loop = true;
            const f = biquad('bandpass', 300, 1.5, bus.dry);
            f.frequency.setValueAtTime(300, t);
            f.frequency.exponentialRampToValueAtTime(9000, t + dur);
            const { g, done } = voiceGain(f, () => f.disconnect());
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vel, t + dur * 0.97);
            g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
            src.connect(f);
            f.connect(g);
            src.start(t, Math.random() * 0.5);
            src.stop(t + dur + 0.06);
            done(src);
        },

        /** A tick of vinyl crackle. */
        tick(t, _f, _d, vel, bus) { burst(t, 0.003, vel, [bus.dry], 'highpass', 2500); },

        // --- 8-bit chip (the Classic track) ---

        /** Lead: 50 percent pulse. */
        chipLead(t, freq, dur, vel, bus) { pulseNote(t, freq, dur, vel, bus, 0.5); },

        /** Second pulse channel: 25 percent duty, thinner, for harmony and stabs. */
        chipHarm(t, freq, dur, vel, bus) { pulseNote(t, freq, dur, vel, bus, 0.25); },

        /** Triangle bass. */
        chipBass(t, freq, dur, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            const len = env(g.gain, t, vel, 0.002, Math.max(0, dur - 0.03), 0.03);
            done(osc('triangle', freq, t, t + len, g));
        },

        /** Triangle drum: a quick pitch drop. */
        chipKick(t, _f, _d, vel, bus) {
            const { g, done } = voiceGain(bus.dry);
            env(g.gain, t, vel, 0.001, 0.03, 0.08);
            const o = osc('triangle', 150, t, t + 0.15, g);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            done(o);
        },

        chipSnare(t, _f, _d, vel, bus) { burst(t, 0.09, vel, [bus.dry], 'highpass', 1500); },

        chipHat(t, _f, _d, vel, bus) { burst(t, 0.03, vel, [bus.dry], 'highpass', 8000); },
    };
}
