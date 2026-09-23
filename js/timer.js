/**
 * timer.js - Stopwatch (counts up) and countdown timer for game modes
 */

/**
 * Format milliseconds as MM:SS.ms
 */
export function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * Format milliseconds as MM:SS (no centiseconds)
 */
export function formatTimeShort(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Create a stopwatch that counts up from zero.
 * Used by Sprint (40 Lines) mode to track completion time.
 */
export function createStopwatch() {
    let elapsed = 0;
    let running = false;
    let startTimestamp = 0;

    return {
        start() {
            if (!running) {
                running = true;
                startTimestamp = performance.now() - elapsed;
            }
        },

        pause() {
            if (running) {
                elapsed = performance.now() - startTimestamp;
                running = false;
            }
        },

        resume() {
            this.start();
        },

        reset() {
            elapsed = 0;
            running = false;
            startTimestamp = 0;
        },

        /** Update and return elapsed time in ms. Call each frame. */
        update() {
            if (running) {
                return performance.now() - startTimestamp;
            }
            return elapsed;
        },

        /** Get current elapsed time without updating */
        getElapsed() {
            if (running) {
                return performance.now() - startTimestamp;
            }
            return elapsed;
        },

        format() {
            return formatTime(this.getElapsed());
        },

        isRunning() {
            return running;
        }
    };
}

/**
 * Create a countdown timer that counts down from a given duration.
 * Used by Blitz mode (2 minutes).
 * @param {number} durationMs - Total duration in milliseconds
 */
export function createCountdown(durationMs) {
    let remaining = durationMs;
    let running = false;
    let lastUpdate = 0;

    return {
        start() {
            if (!running) {
                running = true;
                lastUpdate = performance.now();
            }
        },

        pause() {
            if (running) {
                remaining -= performance.now() - lastUpdate;
                if (remaining < 0) remaining = 0;
                running = false;
            }
        },

        resume() {
            this.start();
        },

        reset() {
            remaining = durationMs;
            running = false;
            lastUpdate = 0;
        },

        /** Update and return remaining time in ms. Call each frame. */
        update() {
            if (running) {
                const now = performance.now();
                remaining -= now - lastUpdate;
                lastUpdate = now;
                if (remaining < 0) remaining = 0;
            }
            return remaining;
        },

        /** Get remaining time without updating */
        getRemaining() {
            if (running) {
                const r = remaining - (performance.now() - lastUpdate);
                return Math.max(0, r);
            }
            return remaining;
        },

        format() {
            return formatTimeShort(this.getRemaining());
        },

        formatPrecise() {
            return formatTime(this.getRemaining());
        },

        isExpired() {
            return this.getRemaining() <= 0;
        },

        isRunning() {
            return running;
        },
    };
}
