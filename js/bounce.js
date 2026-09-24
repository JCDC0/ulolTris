/**
 * bounce.js - Makes the playfield element spring when hit: down on hard drops and
 * clears, sideways when a piece slams into a wall. A damped spring pulls it back.
 * Strength follows the boardBounce setting.
 */

import { effectLevel } from './settings.js';

const STIFFNESS = 320;   // 1/s^2
const DAMPING = 20;      // 1/s
const MAX_OFFSET = 18;   // px

/**
 * @param {HTMLElement|null} el - the element to move (the playfield)
 * @param {Object} settings - Settings reference
 */
export function createBoardBounce(el, settings) {
    let x = 0, y = 0, vx = 0, vy = 0;

    function apply() {
        if (!el) return;
        if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
            x = y = vx = vy = 0;
            el.style.transform = '';
            return;
        }
        el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(x * 0.12).toFixed(3)}deg)`;
    }

    return {
        /** Add velocity in px/s (positive y is down). */
        kick(dx, dy) {
            const mul = effectLevel(settings, 'boardBounce');
            vx += dx * mul;
            vy += dy * mul;
        },

        /** Advance the spring by dt milliseconds. */
        update(dt) {
            const s = Math.min(dt, 50) / 1000;
            vx += (-STIFFNESS * x - DAMPING * vx) * s;
            vy += (-STIFFNESS * y - DAMPING * vy) * s;
            x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, x + vx * s));
            y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, y + vy * s));
            apply();
        },

        reset() {
            x = y = vx = vy = 0;
            apply();
        },
    };
}
