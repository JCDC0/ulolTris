/**
 * ambience.js - Background sounds for the pixel art scenes: rain, wind, rustling
 * wheat, water, surf, birds, crickets, thunder and so on.
 *
 * Everything is synthesized; no audio files are loaded. Each scene (with its weather)
 * lists the layers it wants and how loud (`{ rain: 1, birds: 0.2 }`). When the scene
 * changes, every layer glides to its new level, so a layer two scenes share never
 * drops out.
 *
 * Three kinds of layer:
 * - Beds are continuous. Filtered-noise beds (wind, waves, hum, city) are live Web
 *   Audio graphs. Textured beds (rain, storm, wheat, water) are loops of thousands of
 *   single grains built by ambience-synth.js: drops on stone and leaves, stalks
 *   touching, bubbles in a stream. They are built in short slices the first time a
 *   scene needs them, so a scene change never stalls a frame.
 * - Calls (birds, crickets, owl, gulls, chimes, traffic) are short sounds scheduled at
 *   random intervals.
 * - Flags (thunder) do nothing on their own. Thunder plays when the picture flashes:
 *   background.js reports each lightning strike and strike() answers with a clap
 *   that arrives after a delay that grows with distance, like the real thing.
 */

import { rainLoop, wheatLoop, thunderClap, RAIN_KINDS } from './ambience-synth.js';

const BEDS = ['rain', 'storm', 'wind', 'wheat', 'water', 'waves', 'hum', 'city'];
const CALLS = ['birds', 'crickets', 'owl', 'gulls', 'chimes', 'traffic'];
const FLAGS = ['thunder'];

/** Every layer name a scene may use. */
export const AMBIENCE_LAYERS = [...BEDS, ...CALLS, ...FLAGS];

const GLIDE_S = 0.9;
const TICK_MS = 200;
const LOOKAHEAD_S = 0.6;
const MASTER_GAIN = 0.5;
/** Seconds a bed stays built after it fades out, in case the next scene wants it again. */
const IDLE_S = 8;
/** Thunderclaps kept ready: near, middle and far, two takes of each. */
const CLAPS = [[0.12, 1], [0.12, 2], [0.42, 3], [0.42, 4], [0.75, 5], [0.75, 6]];
/** The sound of thunder reaches you after the flash: seconds of delay at distance 1. */
const SOUND_LAG_S = 2.4;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];

function createNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

/**
 * Run a builder generator in slices of a few milliseconds so the page stays smooth.
 * @returns {Promise<Float32Array[]>} what the generator returned
 */
function inSlices(gen) {
    return new Promise(resolve => {
        function step() {
            const start = performance.now();
            let result;
            do { result = gen.next(); } while (!result.done && performance.now() - start < 6);
            if (result.done) resolve(result.value);
            else setTimeout(step, 0);
        }
        step();
    });
}

/**
 * The sound sources bound to one AudioContext.
 * @returns {{ bed: (name: string, dest: AudioNode) => { ready: Promise, stop: () => void },
 *             call: (name: string, t: number, dest: AudioNode) => number,
 *             prepareClaps: () => void, clapFor: (distance: number) => AudioBuffer | null }}
 *   bed() starts a continuous layer; `ready` resolves once its sound is playing.
 *   call() schedules one short sound at time t and returns seconds until the next.
 */
function createSources(ctx, noise) {
    function noiseSource(nodes) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        src.start(0, Math.random() * 2);
        nodes.push(src);
        return src;
    }

    function filter(type, freq, q, nodes) {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        if (q) f.Q.value = q;
        nodes.push(f);
        return f;
    }

    function gain(value, nodes) {
        const g = ctx.createGain();
        g.gain.value = value;
        nodes.push(g);
        return g;
    }

    /** Slow sine that moves an AudioParam by +/- depth around its set value. */
    function lfo(param, hz, depth, nodes) {
        const o = ctx.createOscillator();
        o.frequency.value = hz;
        const g = gain(depth, nodes);
        o.connect(g);
        g.connect(param);
        o.start();
        nodes.push(o);
    }

    /** Noise through a chain of filters into dest at a level. Returns the level gain. */
    function noisePath(nodes, dest, level, ...filters) {
        let node = noiseSource(nodes);
        for (const f of filters) { node.connect(f); node = f; }
        const g = gain(level, nodes);
        node.connect(g);
        g.connect(dest);
        return g;
    }

    // --- Grain loops, built once per kind and shared by every layer that uses them ---

    const loops = new Map();

    function toBuffer([left, right]) {
        const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
        buffer.copyToChannel(left, 0);
        buffer.copyToChannel(right, 1);
        return buffer;
    }

    function loop(key, make) {
        if (!loops.has(key)) loops.set(key, inSlices(make()).then(toBuffer));
        return loops.get(key);
    }

    /**
     * Play several loops of different lengths together. Their combined pattern only
     * repeats after the lengths line up, which takes about a minute.
     */
    async function loopBed(dest, nodes, isStopped, builders, level) {
        const buffers = await Promise.all(builders.map(([key, make]) => loop(key, make)));
        if (isStopped()) return;
        for (const buffer of buffers) {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = true;
            src.start(0, Math.random() * buffer.duration);
            const g = gain(level, nodes);
            src.connect(g);
            g.connect(dest);
            nodes.push(src);
        }
    }

    const rainBuilders = kind => RAIN_KINDS[kind].map((o, i) =>
        [`${kind}${i}`, () => rainLoop(ctx.sampleRate, o)]);
    const wheatBuilders = [
        ['wheat0', () => wheatLoop(ctx.sampleRate, { seconds: 9, seed: 7 })],
        ['wheat1', () => wheatLoop(ctx.sampleRate, { seconds: 11.3, seed: 8 })],
    ];

    const beds = {
        rain(dest, nodes, isStopped) {
            // A low bed of far-off rain under the drops, so the gaps between them are not dead
            noisePath(nodes, dest, 0.03, filter('lowpass', 500, 0, nodes));
            return loopBed(dest, nodes, isStopped, rainBuilders('rain'), 0.7);
        },
        storm(dest, nodes, isStopped) {
            noisePath(nodes, dest, 0.05, filter('lowpass', 700, 0, nodes));
            return loopBed(dest, nodes, isStopped, rainBuilders('storm'), 0.7);
        },
        wind(dest, nodes) {
            const band = filter('bandpass', 380, 1.1, nodes);
            const g = noisePath(nodes, dest, 0.55, band, filter('lowpass', 900, 0, nodes));
            lfo(band.frequency, 0.11, 140, nodes);
            lfo(g.gain, 0.07, 0.3, nodes);
            lfo(g.gain, 0.23, 0.12, nodes);
        },
        // Stalks touching, ears sliding past each other, in swells as each gust passes
        wheat(dest, nodes, isStopped) {
            return loopBed(dest, nodes, isStopped, wheatBuilders, 1.5);
        },
        water(dest, nodes, isStopped) {
            noisePath(nodes, dest, 0.3, filter('lowpass', 1500, 0, nodes), filter('highpass', 120, 0, nodes));
            return loopBed(dest, nodes, isStopped, rainBuilders('water'), 0.6);
        },
        waves(dest, nodes) {
            const low = noisePath(nodes, dest, 0.3, filter('lowpass', 800, 0, nodes));
            const foam = noisePath(nodes, dest, 0.09, filter('highpass', 2600, 0, nodes));
            lfo(low.gain, 0.13, 0.22, nodes);
            lfo(foam.gain, 0.13, 0.08, nodes);
        },
        hum(dest, nodes) {
            for (const [freq, level] of [[55, 0.1], [110.6, 0.04], [165.2, 0.015]]) {
                const o = ctx.createOscillator();
                o.frequency.value = freq;
                const g = gain(level, nodes);
                o.connect(g);
                g.connect(dest);
                o.start();
                nodes.push(o);
                lfo(g.gain, 0.09 + freq / 900, level * 0.4, nodes);
            }
        },
        city(dest, nodes) {
            const g = noisePath(nodes, dest, 0.7, filter('lowpass', 210, 0, nodes));
            lfo(g.gain, 0.05, 0.15, nodes);
        },
    };

    /** A short tone with an attack and an exponential decay, cleaned up when it ends. */
    function tone(dest, t, { type = 'sine', from, to = from, len, peak, attack = 0.005, pan = 0 }) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(from, t);
        if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g);
        let out = g;
        if (pan && ctx.createStereoPanner) {
            out = ctx.createStereoPanner();
            out.pan.value = pan;
            g.connect(out);
        }
        out.connect(dest);
        o.start(t);
        o.stop(t + len + 0.02);
        o.onended = () => { g.disconnect(); out.disconnect(); };
        return o;
    }

    /** A burst of filtered noise shaped by `shape(gainParam, filter)`. */
    function burst(dest, t, len, type, freq, q, shape) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.setValueAtTime(freq, t);
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        shape(g.gain, f);
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t, Math.random() * 2);
        src.stop(t + len);
        src.onended = () => { f.disconnect(); g.disconnect(); };
    }

    const calls = {
        birds(t, dest) {
            const pan = rand(-0.7, 0.7);
            const base = rand(2600, 4600);
            const song = Math.random();
            if (song < 0.45) {
                // Rising chirps
                const n = 2 + Math.floor(Math.random() * 4);
                for (let i = 0; i < n; i++) {
                    tone(dest, t + i * rand(0.1, 0.15), { from: base, to: base * rand(1.2, 1.5), len: 0.07, peak: 0.22, pan });
                }
            } else if (song < 0.75) {
                // Fast trill
                const n = 7 + Math.floor(Math.random() * 8);
                for (let i = 0; i < n; i++) {
                    tone(dest, t + i * 0.045, { from: base * 1.1, to: base * 0.9, len: 0.035, peak: 0.16, pan });
                }
            } else {
                // Two falling whistles
                tone(dest, t, { from: base * 0.9, to: base * 0.8, len: 0.22, peak: 0.18, attack: 0.03, pan });
                tone(dest, t + 0.3, { from: base * 0.72, to: base * 0.66, len: 0.3, peak: 0.18, attack: 0.03, pan });
            }
            return rand(1.2, 5.5);
        },
        crickets(t, dest) {
            const freq = pick([4300, 4650, 4900]);
            const pan = rand(-0.8, 0.8);
            for (let i = 0; i < 3; i++) tone(dest, t + i * 0.05, { from: freq, len: 0.03, peak: 0.2, attack: 0.004, pan });
            return rand(0.35, 0.8);
        },
        owl(t, dest) {
            const base = rand(330, 390);
            const pan = rand(-0.5, 0.5);
            [0, 0.5, 0.74].forEach((offset, i) => {
                tone(dest, t + offset, { from: base, to: base * 0.93, len: i === 0 ? 0.36 : 0.22, peak: 0.26, attack: 0.05, pan });
            });
            return rand(11, 26);
        },
        gulls(t, dest) {
            const pan = rand(-0.7, 0.7);
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                const start = t + i * 0.42;
                const o = tone(dest, start, { type: 'triangle', from: 1500, to: 1150, len: 0.36, peak: 0.2, attack: 0.04, pan });
                o.frequency.setValueAtTime(1500, start);
                o.frequency.linearRampToValueAtTime(2050, start + 0.09);
            }
            return rand(6, 15);
        },
        chimes(t, dest) {
            const scale = [1047, 1175, 1319, 1568, 1760, 2093];
            const n = 3 + Math.floor(Math.random() * 4);
            for (let i = 0; i < n; i++) {
                const start = t + rand(0, 1.6);
                const freq = pick(scale);
                tone(dest, start, { from: freq, len: 1.8, peak: 0.09, attack: 0.002 });
                tone(dest, start, { from: freq * 2.76, len: 0.5, peak: 0.025, attack: 0.002 });
            }
            return rand(5, 12);
        },
        // A car passing on the highway
        traffic(t, dest) {
            const len = rand(2.2, 3.6);
            burst(dest, t, len, 'bandpass', 260, 0.8, (g, f) => {
                g.linearRampToValueAtTime(0.55, t + len * 0.5);
                g.linearRampToValueAtTime(0.0001, t + len - 0.05);
                f.frequency.linearRampToValueAtTime(620, t + len * 0.5);
                f.frequency.linearRampToValueAtTime(240, t + len);
            });
            return rand(2.5, 7);
        },
    };

    // --- Thunderclaps, built one at a time in the background ---

    const claps = [];
    let clapsStarted = false;

    return {
        bed(name, dest) {
            const nodes = [];
            let stopped = false;
            const ready = Promise.resolve(beds[name](dest, nodes, () => stopped));
            return {
                ready,
                stop() {
                    stopped = true;
                    for (const n of nodes) {
                        try { n.stop?.(); } catch { /* never started */ }
                        n.disconnect();
                    }
                },
            };
        },
        call(name, t, dest) {
            return calls[name](t, dest);
        },
        /** Start building the thunderclaps. Safe to call again; it only runs once. */
        prepareClaps() {
            if (clapsStarted) return;
            clapsStarted = true;
            (async () => {
                for (const [distance, seed] of CLAPS) {
                    const samples = await inSlices(thunderClap(ctx.sampleRate, { distance, seed }));
                    claps.push({ distance, buffer: toBuffer(samples) });
                }
            })();
        },
        /** The built clap closest to a distance (0 overhead, 1 far), or null if none is ready. */
        clapFor(distance) {
            if (!claps.length) return null;
            const near = claps.filter(c => Math.abs(c.distance - distance) < 0.2);
            return pick(near.length ? near : claps).buffer;
        },
    };
}

/**
 * Render a scene's ambience without playing it, for level checks.
 * @param {Object} levels - layer name to 0..1, as in a scene's `ambience`
 * @returns {Promise<AudioBuffer>} stereo buffer
 */
export async function renderAmbienceOffline(levels, seconds, sampleRate = 44100) {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    const sources = createSources(ctx, createNoiseBuffer(ctx));
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    const pending = [];
    for (const [name, level] of Object.entries(levels)) {
        const g = ctx.createGain();
        g.gain.value = level;
        g.connect(master);
        if (BEDS.includes(name)) pending.push(sources.bed(name, g).ready);
        else if (CALLS.includes(name)) for (let t = 0.2; t < seconds;) t += sources.call(name, t, g);
    }
    await Promise.all(pending);
    return ctx.startRendering();
}

/**
 * Create the ambience engine. Silent until unlock() runs from a user gesture.
 *
 * @param {Object} settings - Shared settings (ambience, ambienceVolume, masterVolume, background)
 */
export function createAmbience(settings) {
    let ctx = null;
    let master = null;
    let sources = null;
    let timer = null;
    let wanted = {};
    const layers = new Map();   // name -> { gain, stop, level, idleSince, next }

    function targetVolume() {
        if (!settings.ambience || settings.background === 'off' || document.hidden) return 0;
        return ((settings.masterVolume ?? 100) / 100) * ((settings.ambienceVolume ?? 60) / 100) * MASTER_GAIN;
    }

    function ensureLayer(name) {
        if (layers.has(name)) return layers.get(name);
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(master);
        const layer = { gain: g, level: 0, idleSince: 0, next: ctx.currentTime + rand(0.3, 2.5) };
        layer.stop = BEDS.includes(name) ? sources.bed(name, g).stop : () => {};
        layers.set(name, layer);
        if (name === 'thunder') sources.prepareClaps();
        return layer;
    }

    function apply() {
        if (!ctx) return;
        const now = ctx.currentTime;
        for (const name of AMBIENCE_LAYERS) {
            const level = wanted[name] || 0;
            if (level === 0 && !layers.has(name)) continue;
            const layer = ensureLayer(name);
            if (layer.level === level) continue;
            layer.level = level;
            layer.idleSince = level === 0 ? now : 0;
            layer.gain.gain.setTargetAtTime(level, now, GLIDE_S / 3);
        }
    }

    function tick() {
        const now = ctx.currentTime;
        const vol = targetVolume();
        if (Math.abs(master.gain.value - vol) > 0.001) master.gain.setTargetAtTime(vol, now, 0.15);

        for (const [name, layer] of layers) {
            if (layer.level === 0) {
                if (now - layer.idleSince > IDLE_S) {
                    layer.stop();
                    layer.gain.disconnect();
                    layers.delete(name);
                }
                continue;
            }
            if (!CALLS.includes(name) || vol === 0) continue;
            if (layer.next < now) layer.next = now + 0.05;
            while (layer.next < now + LOOKAHEAD_S) {
                // Quieter layers also call less often
                layer.next += sources.call(name, layer.next, layer.gain) / Math.max(0.3, layer.level);
            }
        }
    }

    return {
        /** Create the AudioContext. Call from a user gesture (click or key). */
        unlock() {
            if (!ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                ctx = new AudioContext();
                master = ctx.createGain();
                master.gain.value = 0;
                master.connect(ctx.destination);
                sources = createSources(ctx, createNoiseBuffer(ctx));
                timer = setInterval(tick, TICK_MS);
            }
            if (ctx.state === 'suspended') ctx.resume();
            apply();
        },

        /** Glide to a scene's layers: `{ rain: 1, birds: 0.2 }`. Unknown names are ignored. */
        setScene(levels) {
            wanted = levels || {};
            apply();
        },

        /**
         * Lightning struck. Plays a thunderclap after a delay that grows with distance,
         * if the scene has thunder and a clap has been built.
         * @param {number} distance - 0 (overhead) to 1 (far away)
         */
        strike(distance = 0.4) {
            const layer = layers.get('thunder');
            if (!ctx || !layer || layer.level === 0 || targetVolume() === 0) return;
            const buffer = sources.clapFor(distance);
            if (!buffer) return;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const g = ctx.createGain();
            g.gain.value = 1.3 - 0.45 * distance;
            src.connect(g);
            g.connect(layer.gain);
            src.start(ctx.currentTime + 0.06 + distance * SOUND_LAG_S);
            src.onended = () => g.disconnect();
        },

        dispose() {
            if (timer) clearInterval(timer);
            if (ctx) ctx.close();
            ctx = null;
        },
    };
}
