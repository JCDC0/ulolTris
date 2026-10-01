/**
 * chip.js - Shared pieces of the 8-bit sound: pulse waves with a duty cycle.
 *
 * Old sound chips had square waves at 12.5, 25 and 50 percent duty, each with its own
 * hollow or reedy tone. Web Audio only has a 50 percent square, so the others are built
 * from their Fourier series.
 */

const cache = new WeakMap();

/** MIDI note number to frequency in Hz. */
export function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * A pulse wave for an AudioContext, cached per context and duty.
 * @param {BaseAudioContext} ctx
 * @param {number} duty - Share of each cycle spent high (0.125, 0.25 or 0.5)
 * @returns {PeriodicWave} for OscillatorNode.setPeriodicWave
 */
export function pulseWave(ctx, duty) {
    let byDuty = cache.get(ctx);
    if (!byDuty) {
        byDuty = new Map();
        cache.set(ctx, byDuty);
    }
    let wave = byDuty.get(duty);
    if (!wave) {
        const harmonics = 48;
        const real = new Float32Array(harmonics + 1);
        const imag = new Float32Array(harmonics + 1);
        for (let n = 1; n <= harmonics; n++) {
            real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
            imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
        }
        wave = ctx.createPeriodicWave(real, imag);
        byDuty.set(duty, wave);
    }
    return wave;
}
