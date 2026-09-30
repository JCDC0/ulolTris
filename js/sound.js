/**
 * Procedural Web Audio API sound engine for ulolTris.
 * Synthesizes sound effects using oscillators, noise, and envelopes.
 */

/**
 * Creates and initializes the sound engine.
 * @param {Object} settingsRef - Reference object with {masterVolume, sfxVolume, sfxMuted} properties.
 * @returns {Object} The sound engine instance.
 */
export function createSoundEngine(settingsRef) {
    let ctx = null;
    let masterGain = null;
    let noiseBuffer = null;

    /**
     * Initializes the AudioContext on first play to handle autoplay policies.
     */
    function init() {
        if (ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);

        // Create a 1-second shared white noise buffer
        const bufferSize = ctx.sampleRate;
        noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Updates master volume based on settings reference.
     * @returns {number} The calculated volume level.
     */
    function updateVolume() {
        if (!ctx) return 0;
        if (settingsRef.sfxMuted) {
            masterGain.gain.value = 0;
            return 0;
        }
        const master = (settingsRef.masterVolume !== undefined ? settingsRef.masterVolume : 100) / 100;
        const sfx = (settingsRef.sfxVolume !== undefined ? settingsRef.sfxVolume : 100) / 100;
        const volume = master * sfx;
        masterGain.gain.value = volume;
        return volume;
    }

    /**
     * Helper to play a simple tone with an envelope.
     */
    function playTone(freq, type, startTime, duration, volEnvelope) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        
        if (typeof freq === 'number') {
            osc.frequency.setValueAtTime(freq, startTime);
        } else if (typeof freq === 'function') {
            freq(osc.frequency, startTime);
        }

        gain.gain.setValueAtTime(0, startTime);
        if (volEnvelope) {
            volEnvelope(gain.gain, startTime);
        }

        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        osc.onended = () => {
            gain.disconnect();
        };
        
        return { osc, gain };
    }

    /**
     * Helper to play noise with an envelope and optional filter.
     */
    function playNoise(startTime, duration, volEnvelope, filterSetup) {
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startTime);
        if (volEnvelope) {
            volEnvelope(gain.gain, startTime);
        }

        let lastNode = source;
        if (filterSetup) {
            const filter = ctx.createBiquadFilter();
            filterSetup(filter, startTime);
            lastNode.connect(filter);
            lastNode = filter;
        }

        lastNode.connect(gain);
        gain.connect(masterGain);

        source.start(startTime);
        source.stop(startTime + duration);
        
        source.onended = () => {
            gain.disconnect();
            if (lastNode !== source) lastNode.disconnect();
        };
    }

    /** Quick envelope: attack to peak, then decay to silence over len seconds. */
    function blip(freq, type, t, len, peak, bendTo) {
        const { osc } = playTone(freq, type, t, len + 0.02, (g, time) => {
            g.setValueAtTime(0, time);
            g.linearRampToValueAtTime(peak, time + 0.004);
            g.exponentialRampToValueAtTime(0.001, time + len);
        });
        if (bendTo) osc.frequency.exponentialRampToValueAtTime(bendTo, t + len);
    }

    function thump(t, from, to, len, peak) {
        blip(from, 'sine', t, len, peak, to);
    }

    const semitone = (base, n) => base * Math.pow(2, n / 12);
    const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];

    /**
     * Sound packs. Each entry replaces the default sound for that event; events a pack
     * leaves out use the default. Both packs are original synthesis:
     * arcade is short and clicky like classic web stackers (Jstris style), bubbly is
     * round, poppy and chiming like Puyo Puyo Tetris.
     */
    const PACKS = {
        arcade: {
            move: t => blip(1200, 'square', t, 0.012, 0.08),
            rotate: t => blip(900, 'square', t, 0.022, 0.08, 1300),
            softdrop: t => blip(800, 'square', t, 0.008, 0.05),
            harddrop: t => {
                thump(t, 150, 55, 0.09, 0.5);
                playNoise(t, 0.05, (g, time) => { g.setValueAtTime(0.25, time); g.exponentialRampToValueAtTime(0.01, time + 0.05); },
                    (f) => { f.type = 'lowpass'; f.frequency.value = 1500; });
            },
            lock: t => blip(420, 'triangle', t, 0.025, 0.2),
            hold: t => { blip(700, 'square', t, 0.03, 0.07); blip(1000, 'square', t + 0.03, 0.03, 0.07); },
            clear1: t => blip(523, 'square', t, 0.08, 0.12),
            clear2: t => [523, 659].forEach((f, i) => blip(f, 'square', t + i * 0.05, 0.08, 0.12)),
            clear3: t => [523, 659, 784].forEach((f, i) => blip(f, 'square', t + i * 0.05, 0.08, 0.12)),
            clear4: t => [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 'square', t + i * 0.045, 0.1, 0.12)),
            tspin: t => blip(300, 'square', t, 0.12, 0.1, 900),
            combo: (t, n) => blip(semitone(440, Math.min(n || 1, 20)), 'square', t, 0.06, 0.1),
        },
        bubbly: {
            move: t => blip(880, 'sine', t, 0.03, 0.12, 1100),
            rotate: t => { blip(600, 'sine', t, 0.05, 0.16, 950); blip(1200, 'triangle', t, 0.04, 0.05, 1900); },
            softdrop: t => blip(520, 'sine', t, 0.02, 0.08),
            harddrop: t => {
                thump(t, 320, 90, 0.13, 0.55);
                playNoise(t, 0.09, (g, time) => { g.setValueAtTime(0.18, time); g.exponentialRampToValueAtTime(0.01, time + 0.09); },
                    (f) => { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8; });
            },
            lock: t => blip(1300, 'sine', t, 0.06, 0.2, 380),
            hold: t => blip(420, 'sine', t, 0.09, 0.16, 1300),
            clear1: t => chime(t, [0, 4], 0.09),
            clear2: t => chime(t, [0, 4, 7], 0.08),
            clear3: t => chime(t, [0, 4, 7, 12], 0.07),
            clear4: t => {
                chime(t, [0, 4, 7, 12, 16, 19, 24], 0.055);
                for (let i = 0; i < 6; i++) blip(semitone(1568, i * 2), 'sine', t + 0.35 + i * 0.03, 0.12, 0.05);
            },
            tspin: t => { blip(400, 'triangle', t, 0.2, 0.12, 1600); blip(800, 'sine', t + 0.05, 0.2, 0.08, 2400); },
            combo: (t, n) => {
                const step = MAJOR[Math.min((n || 1) - 1, MAJOR.length - 1)];
                bell(semitone(523, step), t, 0.35, 0.18);
            },
        },
    };

    /** Soft bell: sine plus a quiet octave, long decay. */
    function bell(freq, t, len, peak) {
        blip(freq, 'sine', t, len, peak);
        blip(freq * 2, 'sine', t, len * 0.6, peak * 0.3);
    }

    /** Ascending bell arpeggio on a C major chord, one note per step. */
    function chime(t, steps, gap) {
        steps.forEach((st, i) => bell(semitone(523, st), t + i * gap, 0.4, 0.16));
    }

    /**
     * Plays a sound effect by event name.
     * @param {string} eventName - The name of the sound event to play.
     * @param {number} [comboCount] - Optional combo count (1-20) for the 'combo' event.
     */
    function play(eventName, comboCount) {
        init();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        const vol = updateVolume();
        if (vol === 0) return;

        const t = ctx.currentTime;

        const pack = PACKS[settingsRef.soundPack];
        if (pack && pack[eventName]) {
            pack[eventName](t, comboCount);
            return;
        }

        switch (eventName) {
            case 'move':
                playTone(800, 'sine', t, 0.015, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.015);
                });
                break;
                
            case 'rotate':
                playTone(1200, 'sine', t, 0.02, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.02);
                });
                break;
                
            case 'softdrop':
                playTone((f, time) => {
                    f.setValueAtTime(600, time);
                    f.exponentialRampToValueAtTime(300, time + 0.03);
                }, 'sine', t, 0.03, (g, time) => {
                    g.setValueAtTime(0.3, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.03);
                });
                break;
                
            case 'harddrop':
                // Impact thud
                playTone(80, 'sine', t, 0.08, (g, time) => {
                    g.setValueAtTime(0.8, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.08);
                });
                // Noise burst
                playNoise(t, 0.08, (g, time) => {
                    g.setValueAtTime(0.6, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.08);
                }, (f, time) => {
                    f.type = 'lowpass';
                    f.frequency.setValueAtTime(500, time);
                });
                break;
                
            case 'lock':
                playTone(200, 'sine', t, 0.04, (g, time) => {
                    g.setValueAtTime(0.6, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.04);
                });
                break;
                
            case 'clear1':
                playTone((f, time) => {
                    f.setValueAtTime(523, time); // C5
                    f.linearRampToValueAtTime(784, time + 0.15); // G5
                }, 'sine', t, 0.15, (g, time) => {
                    g.setValueAtTime(0.5, time);
                    g.linearRampToValueAtTime(0, time + 0.15);
                });
                break;
                
            case 'clear2':
                playTone(523, 'sine', t, 0.08, (g, time) => {
                    g.setValueAtTime(0.5, time);
                    g.linearRampToValueAtTime(0, time + 0.08);
                });
                playTone(659, 'sine', t + 0.08, 0.08, (g, time) => {
                    g.setValueAtTime(0.5, time);
                    g.linearRampToValueAtTime(0, time + 0.08);
                });
                break;
                
            case 'clear3':
                [523, 659, 784].forEach((freq, i) => { // C5, E5, G5
                    playTone(freq, 'sine', t + i * 0.06, 0.06, (g, time) => {
                        g.setValueAtTime(0.5, time);
                        g.linearRampToValueAtTime(0, time + 0.06);
                    });
                });
                break;
                
            case 'clear4': {
                // Tetris: a bell "bling". Three grace notes run up into a ringing high
                // note. Each note is a stack of sine partials that die away at different
                // rates, like struck metal, with a short echo for sparkle.
                const delay = ctx.createDelay();
                delay.delayTime.value = 0.11;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.3;
                const wet = ctx.createGain();
                wet.gain.value = 0.3;
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(wet);
                wet.connect(masterGain);

                const ring = (freq, at, len, peak) => {
                    for (const [ratio, level, decay] of [[1, 1, 1], [2, 0.3, 0.6], [3.01, 0.16, 0.35], [5.4, 0.07, 0.2]]) {
                        const osc = ctx.createOscillator();
                        const g = ctx.createGain();
                        osc.frequency.value = freq * ratio;
                        g.gain.setValueAtTime(0, at);
                        g.gain.linearRampToValueAtTime(peak * level, at + 0.003);
                        g.gain.exponentialRampToValueAtTime(0.0001, at + len * decay);
                        osc.connect(g);
                        g.connect(masterGain);
                        g.connect(delay);
                        osc.start(at);
                        osc.stop(at + len * decay + 0.02);
                        osc.onended = () => g.disconnect();
                    }
                };
                [1047, 1319, 1568].forEach((freq, i) => ring(freq, t + i * 0.045, 0.25, 0.2));
                ring(2093, t + 0.135, 1.0, 0.3);
                ring(3136, t + 0.135, 0.7, 0.1);

                setTimeout(() => {
                    delay.disconnect();
                    feedback.disconnect();
                    wet.disconnect();
                }, 2500);
                break;
            }

            case 'tspin': {
                // Filtered noise whoosh
                playNoise(t, 0.2, (g, time) => {
                    g.setValueAtTime(0.3, time);
                    g.linearRampToValueAtTime(0, time + 0.2);
                }, (f, time) => {
                    f.type = 'bandpass';
                    f.frequency.setValueAtTime(400, time);
                    f.frequency.linearRampToValueAtTime(2000, time + 0.2);
                });
                
                // Crystalline sine ring with vibrato
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1400, t);
                
                lfo.type = 'sine';
                lfo.frequency.setValueAtTime(15, t); // 15Hz vibrato
                lfoGain.gain.setValueAtTime(30, t);  // 30Hz depth
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                
                osc.connect(gain);
                gain.connect(masterGain);
                
                osc.start(t);
                lfo.start(t);
                osc.stop(t + 0.2);
                lfo.stop(t + 0.2);
                
                osc.onended = () => {
                    gain.disconnect();
                    lfoGain.disconnect();
                };
                break;
            }
                
            case 'tspinClear': {
                // Longer, more dramatic filtered noise
                playNoise(t, 0.35, (g, time) => {
                    g.setValueAtTime(0.5, time);
                    g.linearRampToValueAtTime(0, time + 0.35);
                }, (f, time) => {
                    f.type = 'bandpass';
                    f.frequency.setValueAtTime(400, time);
                    f.frequency.linearRampToValueAtTime(3000, time + 0.35);
                });
                
                // Clear chime
                playTone((f, time) => {
                    f.setValueAtTime(1400, time);
                    f.linearRampToValueAtTime(2000, time + 0.35);
                }, 'sine', t, 0.35, (g, time) => {
                    g.setValueAtTime(0.6, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.35);
                });
                break;
            }
                
            case 'combo': {
                const count = Math.min(20, Math.max(1, comboCount || 1));
                const comboFreq = Math.min(1200, 440 + (count * 40));
                playTone(comboFreq, 'sine', t, 0.06, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.linearRampToValueAtTime(0, time + 0.06);
                });
                break;
            }
                
            case 'b2b':
                // Shimmer/sparkle fairy dust
                for (let i = 0; i < 10; i++) {
                    const st = t + Math.random() * 0.15;
                    const fr = 800 + Math.random() * 1200;
                    playTone(fr, 'sine', st, 0.05, (g, time) => {
                        g.setValueAtTime(0.2, time);
                        g.linearRampToValueAtTime(0, time + 0.05);
                    });
                }
                break;
                
            case 'perfectClear': {
                // Triumphant fanfare C5-E5-G5-C6-E6
                const delay = ctx.createDelay();
                delay.delayTime.value = 0.15;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.3;
                
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(masterGain);

                [523, 659, 784, 1046, 1318].forEach((freq, i) => {
                    const st = t + i * 0.05;
                    const duration = i === 4 ? 0.3 : 0.1;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    
                    g.gain.setValueAtTime(0.5, st);
                    g.gain.linearRampToValueAtTime(0.01, st + duration);
                    
                    osc.connect(g);
                    g.connect(masterGain);
                    g.connect(delay); // Send to reverb
                    
                    osc.start(st);
                    osc.stop(st + duration);
                    osc.onended = () => g.disconnect();
                });
                
                setTimeout(() => {
                    delay.disconnect();
                    feedback.disconnect();
                }, 1500);
                break;
            }
                
            case 'hold':
                playNoise(t, 0.05, (g, time) => {
                    g.setValueAtTime(0.3, time);
                    g.linearRampToValueAtTime(0, time + 0.05);
                }, (f, time) => {
                    f.type = 'bandpass';
                    f.frequency.setValueAtTime(600, time);
                    f.Q.value = 1;
                });
                break;
                
            case 'gameOver': {
                // Descending C5 -> C3 with vibrato
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, t); // C5
                osc.frequency.exponentialRampToValueAtTime(130.81, t + 0.8); // C3
                
                lfo.type = 'sine';
                lfo.frequency.value = 8;
                lfoGain.gain.value = 10;
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                
                g.gain.setValueAtTime(0.5, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
                
                osc.connect(g);
                g.connect(masterGain);
                
                osc.start(t);
                lfo.start(t);
                osc.stop(t + 0.8);
                lfo.stop(t + 0.8);
                
                osc.onended = () => {
                    g.disconnect();
                    lfoGain.disconnect();
                };
                break;
            }
                
            case 'danger':
                // Two-tone alarm pulse, repeated by the game while the stack is near the top
                [[988, 0], [740, 0.11]].forEach(([freq, offset]) => {
                    playTone(freq, 'square', t + offset, 0.09, (g, time) => {
                        g.setValueAtTime(0.12, time);
                        g.linearRampToValueAtTime(0.1, time + 0.07);
                        g.linearRampToValueAtTime(0, time + 0.09);
                    });
                });
                break;

            case 'attack': {
                // Rising whoosh as garbage is sent; comboCount carries the line count
                const lines = Math.min(comboCount || 1, 10);
                playNoise(t, 0.35, (g, time) => {
                    g.setValueAtTime(0, time);
                    g.linearRampToValueAtTime(0.25 + lines * 0.03, time + 0.05);
                    g.exponentialRampToValueAtTime(0.01, time + 0.35);
                }, (f, time) => {
                    f.type = 'bandpass';
                    f.Q.value = 2;
                    f.frequency.setValueAtTime(400, time);
                    f.frequency.exponentialRampToValueAtTime(2500 + lines * 300, time + 0.3);
                });
                playTone(220, 'sawtooth', t, 0.3, (g, time) => {
                    g.setValueAtTime(0.08, time);
                    g.exponentialRampToValueAtTime(0.005, time + 0.3);
                }).osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);
                break;
            }

            case 'levelUp':
                playTone(523, 'sine', t, 0.075, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.linearRampToValueAtTime(0, time + 0.075);
                });
                playTone(1046, 'sine', t + 0.075, 0.075, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.linearRampToValueAtTime(0, time + 0.075);
                });
                break;
                
            case 'menuMove':
                playTone(600, 'sine', t, 0.008, (g, time) => {
                    g.setValueAtTime(0.15, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.008);
                });
                break;
                
            case 'menuSelect':
                playTone(440, 'sine', t, 0.04, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.linearRampToValueAtTime(0, time + 0.04);
                });
                playTone(880, 'sine', t + 0.03, 0.04, (g, time) => {
                    g.setValueAtTime(0.4, time);
                    g.linearRampToValueAtTime(0, time + 0.04);
                });
                break;
                
            case 'countdownTick':
                playTone(1000, 'sine', t, 0.015, (g, time) => {
                    g.setValueAtTime(0.3, time);
                    g.exponentialRampToValueAtTime(0.01, time + 0.015);
                });
                break;
                
            case 'countdownGo':
                [440, 880, 1760].forEach((freq, i) => {
                    playTone(freq, 'sine', t + i * 0.06, 0.08, (g, time) => {
                        g.setValueAtTime(0.4, time);
                        g.linearRampToValueAtTime(0, time + 0.08);
                    });
                });
                break;
        }
    }

    /**
     * Cleans up the sound engine, closing the AudioContext.
     */
    function dispose() {
        if (ctx) {
            ctx.close();
            ctx = null;
            masterGain = null;
            noiseBuffer = null;
        }
    }

    return {
        play,
        dispose
    };
}
