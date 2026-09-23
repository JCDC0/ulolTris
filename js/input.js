/**
 * input.js - Keyboard input handling with TETR.IO-style DAS/ARR/DCD/SDF
 * Decoupled from game state; emits action callbacks.
 *
 * Handling model:
 * - DAS charges while a direction is held. The first auto-shift happens when the charge
 *   reaches DAS, then one shift every ARR. ARR 0 shifts to the wall in the same frame.
 * - Switching direction keeps the DAS charge unless cancelDasOnDirectionChange is on.
 * - DCD pauses DAS charging for DCD frames after a rotation or a new piece (cutDas()).
 * - Soft drop moves at gravity x SDF. SDF_INFINITE drops to the floor in the same frame.
 */

import { framesToMs, SDF_INFINITE } from './settings.js';

/**
 * Timing tolerance in ms. Frame timestamps drift by fractions of a millisecond, which
 * would push a shift due on frame N to frame N+1. TETR.IO counts whole frames, so snap.
 */
const EPSILON = 1;

const GAME_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp',
    'Space', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft', 'ShiftRight',
    'Escape', 'KeyR', 'F1',
]);

/**
 * Create an input handler that translates raw keyboard events into game actions.
 *
 * @param {Object} settings - Reference to the settings object (read each frame)
 * @param {Object} callbacks - Action callbacks:
 *   { onMove(dir, cells) -> cellsMoved, onSoftDrop(cells) -> cellsDropped,
 *     getGravityInterval() -> ms per cell, onHardDrop, onRotateCW, onRotateCCW,
 *     onHold, onPause, onRetry }
 *   `cells` may be Infinity, meaning "as far as possible".
 */
export function createInputHandler(settings, callbacks) {
    const state = {
        leftHeld: false,
        rightHeld: false,
        downHeld: false,
        activeHorizontal: null,   // -1 (left) | 1 (right) | null
        dasCharge: 0,             // ms the active direction has charged
        chargeFrom: 0,            // timestamp charging was last counted up to
        dcdUntil: 0,              // DAS charging is paused until this timestamp
        softDropCharge: 0,        // ms accumulated toward the next soft drop cell
        softDropFrom: 0,
        enabled: true,
    };

    function heldFor(dir) {
        return dir < 0 ? state.leftHeld : state.rightHeld;
    }

    function setActiveHorizontal(dir, now) {
        if (state.activeHorizontal === null || settings.cancelDasOnDirectionChange) {
            state.dasCharge = 0;
        }
        state.activeHorizontal = dir;
        state.chargeFrom = now;
        callbacks.onMove?.(dir, 1);
    }

    function handleHorizontalKey(dir, isDown, now) {
        if (dir < 0) state.leftHeld = isDown;
        else state.rightHeld = isDown;

        if (isDown) {
            if (state.activeHorizontal !== dir) setActiveHorizontal(dir, now);
            return;
        }

        if (state.activeHorizontal === dir) {
            if (heldFor(-dir)) {
                setActiveHorizontal(-dir, now);
            } else {
                state.activeHorizontal = null;
                state.dasCharge = 0;
            }
        }
    }

    function clearHeld() {
        state.leftHeld = false;
        state.rightHeld = false;
        state.downHeld = false;
        state.activeHorizontal = null;
        state.dasCharge = 0;
        state.softDropCharge = 0;
    }

    function onKeyDown(event) {
        if (!state.enabled) return;
        if (GAME_KEYS.has(event.code)) {
            event.preventDefault();
        }
        if (event.repeat) return;

        const now = performance.now();

        switch (event.code) {
            case 'ArrowLeft':
                handleHorizontalKey(-1, true, now);
                break;
            case 'ArrowRight':
                handleHorizontalKey(1, true, now);
                break;
            case 'ArrowDown':
                state.downHeld = true;
                state.softDropCharge = 0;
                state.softDropFrom = now;
                break;
            case 'ArrowUp':
            case 'KeyX':
                callbacks.onRotateCW?.();
                break;
            case 'KeyZ':
                callbacks.onRotateCCW?.();
                break;
            case 'KeyC':
            case 'ShiftLeft':
            case 'ShiftRight':
                callbacks.onHold?.();
                break;
            case 'Space':
                callbacks.onHardDrop?.();
                break;
            case 'Escape':
                callbacks.onPause?.();
                break;
            case 'KeyR':
                callbacks.onRetry?.();
                break;
        }
    }

    function onKeyUp(event) {
        if (GAME_KEYS.has(event.code)) {
            event.preventDefault();
        }

        const now = performance.now();

        switch (event.code) {
            case 'ArrowLeft':
                handleHorizontalKey(-1, false, now);
                break;
            case 'ArrowRight':
                handleHorizontalKey(1, false, now);
                break;
            case 'ArrowDown':
                state.downHeld = false;
                break;
        }
    }

    function updateHorizontal(now) {
        const dir = state.activeHorizontal;
        if (dir === null) return;

        const from = Math.max(state.chargeFrom, state.dcdUntil);
        state.chargeFrom = now;
        if (now <= from) return;

        const das = framesToMs(settings.das) - EPSILON;
        const arr = framesToMs(settings.arr);
        const prev = state.dasCharge;
        state.dasCharge += now - from;
        if (state.dasCharge < das) return;

        if (arr === 0) {
            callbacks.onMove?.(dir, Infinity);
            return;
        }

        const shiftsBefore = prev >= das ? Math.floor((prev - das) / arr) + 1 : 0;
        const shiftsAfter = Math.floor((state.dasCharge - das) / arr) + 1;
        if (shiftsAfter > shiftsBefore) {
            callbacks.onMove?.(dir, shiftsAfter - shiftsBefore);
        }
    }

    function updateSoftDrop(now) {
        if (!state.downHeld) return;

        if (settings.sdf >= SDF_INFINITE) {
            callbacks.onSoftDrop?.(Infinity);
            return;
        }

        const gravity = callbacks.getGravityInterval?.() ?? 1000;
        const interval = gravity / settings.sdf;
        state.softDropCharge += now - state.softDropFrom;
        state.softDropFrom = now;

        const cells = Math.floor((state.softDropCharge + EPSILON) / interval);
        if (cells > 0) {
            state.softDropCharge -= cells * interval;
            callbacks.onSoftDrop?.(cells);
        }
    }

    // Prevent stuck keys when window loses focus
    function onBlur() {
        clearHeld();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return {
        /**
         * Call each frame to process auto-repeat inputs.
         */
        update(now) {
            if (!state.enabled) return;

            if (settings.preferSoftDrop) {
                updateSoftDrop(now);
                updateHorizontal(now);
            } else {
                updateHorizontal(now);
                updateSoftDrop(now);
            }
        },

        /**
         * Pause DAS charging for DCD frames. Called after a rotation or a new piece.
         */
        cutDas() {
            if (settings.dcd > 0) {
                state.dcdUntil = performance.now() + framesToMs(settings.dcd);
            }
        },

        /** Enable or disable input processing */
        setEnabled(enabled) {
            state.enabled = enabled;
            if (!enabled) clearHeld();
        },

        /** Reset all held state */
        resetState() {
            clearHeld();
        },

        /** Clean up event listeners */
        destroy() {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        },
    };
}
