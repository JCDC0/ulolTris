/**
 * ambience.js - Background sounds for the pixel art scenes: rain, wind, rustling
 * wheat, water, surf, birds, crickets, thunder and so on.
 *
 * Everything is synthesized with Web Audio from filtered noise and sine tones; no
 * audio files are loaded. Each scene lists the layers it wants and how loud
 * (`ambience: { rain: 1, birds: 0.2 }`). When the scene changes, every layer glides
 * to its new level, so a layer two scenes share never drops out.
 *
 * Beds (rain, wind, ...) are continuous and are built the first time a scene needs
 * them. Calls (birds, thunder, ...) are short sounds scheduled at random intervals.
 */

const BEDS = ['rain', 'storm', 'wind', 'wheat', 'water', 'waves', 'hum', 'city'];
const CALLS = ['birds', 'crickets', 'owl', 'gulls', 'chimes', 'thunder', 'traffic'];

/** Every layer name a scene may use. */
export const AMBIENCE_LAYERS = [...BEDS, ...CALLS];

const GLIDE_S = 0.9;
const TICK_MS = 200;
const LOOKAHEAD_S = 0.6;
const MASTER_GAIN = 0.5;
/** Seconds a bed stays built after it fades out, in case the next scene wants it again. */
const IDLE_S = 8;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];

function createNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

/**
 * The sound sources bound to one AudioContext.
 * @returns {{ bed: (name: string, dest: AudioNode) => () => void,
 *             call: (name: string, t: number, dest: AudioNode) => number }}
 *   bed() starts a continuous layer and returns a function that stops it.
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

    const beds = {
        rain(dest, nodes) {
            noisePath(nodes, dest, 0.22, filter('highpass', 2200, 0, nodes), filter('lowpass', 9000, 0, nodes));
            const body = noisePath(nodes, dest, 0.3, filter('bandpass', 700, 0.4, nodes));
            lfo(body.gain, 0.07, 0.08, nodes);
        },
        storm(dest, nodes) {
            noisePath(nodes, dest, 0.5, filter('lowpass', 2600, 0, nodes));
            const hiss = noisePath(nodes, dest, 0.2, filter('highpass', 3000, 0, nodes));
            lfo(hiss.gain, 0.19, 0.08, nodes);
        },
        wind(dest, nodes) {
            const band = filter('bandpass', 420, 1.4, nodes);
            const g = noisePath(nodes, dest, 0.75, band);
            lfo(band.frequency, 0.11, 170, nodes);
            lfo(g.gain, 0.07, 0.4, nodes);
            lfo(g.gain, 0.23, 0.15, nodes);
        },
        // Dry stalks brushing together: high, thin noise that swells with each gust
        wheat(dest, nodes) {
            const g = noisePath(nodes, dest, 0.2, filter('bandpass', 5200, 0.8, nodes), filter('highpass', 2500, 0, nodes));
            lfo(g.gain, 0.24, 0.1, nodes);
            lfo(g.gain, 0.056, 0.08, nodes);
        },
        water(dest, nodes) {
            noisePath(nodes, dest, 0.5, filter('lowpass', 1700, 0, nodes), filter('highpass', 120, 0, nodes));
            const spray = noisePath(nodes, dest, 0.1, filter('highpass', 4000, 0, nodes));
            lfo(spray.gain, 0.31, 0.04, nodes);
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
        thunder(t, dest) {
            const len = rand(2.5, 4.5);
            // The crack, then a rumble that rolls and fades
            burst(dest, t, 0.3, 'lowpass', 1400, 0.5, (g) => {
                g.linearRampToValueAtTime(0.8, t + 0.01);
                g.exponentialRampToValueAtTime(0.0001, t + 0.28);
            });
            burst(dest, t, len, 'lowpass', 220, 0.7, (g, f) => {
                g.linearRampToValueAtTime(1.6, t + 0.12);
                g.setValueAtTime(1.6, t + 0.3);
                g.linearRampToValueAtTime(0.6, t + len * 0.35);
                g.linearRampToValueAtTime(0.9, t + len * 0.5);
                g.exponentialRampToValueAtTime(0.0001, t + len - 0.05);
                f.frequency.exponentialRampToValueAtTime(70, t + len);
            });
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

    return {
        bed(name, dest) {
            const nodes = [];
            beds[name](dest, nodes);
            return () => nodes.forEach(n => { n.stop?.(); n.disconnect(); });
        },
        call(name, t, dest) {
            return calls[name](t, dest);
        },
    };
}

/**
 * Render a scene's ambience without playing it, for level checks.
 * @param {Object} levels - layer name to 0..1, as in a scene's `ambience`
 * @returns {Promise<AudioBuffer>} mono buffer
 */
export function renderAmbienceOffline(levels, seconds, sampleRate = 44100) {
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const sources = createSources(ctx, createNoiseBuffer(ctx));
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    for (const [name, level] of Object.entries(levels)) {
        const g = ctx.createGain();
        g.gain.value = level;
        g.connect(master);
        if (BEDS.includes(name)) sources.bed(name, g);
        else for (let t = 0.2; t < seconds;) t += sources.call(name, t, g);
    }
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
        layer.stop = BEDS.includes(name) ? sources.bed(name, g) : () => {};
        layers.set(name, layer);
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
            if (BEDS.includes(name) || vol === 0) continue;
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

        dispose() {
            if (timer) clearInterval(timer);
            if (ctx) ctx.close();
            ctx = null;
        },
    };
}
