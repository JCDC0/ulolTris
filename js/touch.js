/**
 * touch.js - On-screen buttons for phones and tablets.
 *
 * Each button stands for a keyboard key (`data-key`). Pressing one dispatches the
 * same keydown and keyup events a keyboard would, so DAS, ARR, soft drop, finesse
 * counting and the pause key all run through input.js unchanged, and a held button
 * auto-repeats exactly like a held key.
 */

/**
 * @param {HTMLElement[]} roots - elements whose `[data-key]` buttons act as keys
 * @param {Object} settings - Settings reference (touchControls: 'auto' | 'on' | 'off')
 */
export function createTouchControls(roots, settings) {
    const coarse = window.matchMedia?.('(pointer: coarse)');
    const held = new Map();   // pointerId -> button

    function send(type, code) {
        document.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    }

    function press(e) {
        const btn = e.target.closest('[data-key]');
        if (!btn) return;
        e.preventDefault();
        if (held.has(e.pointerId)) return;
        held.set(e.pointerId, btn);
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('pressed');
        navigator.vibrate?.(8);
        send('keydown', btn.dataset.key);
    }

    function release(e) {
        const btn = held.get(e.pointerId);
        if (!btn) return;
        held.delete(e.pointerId);
        btn.classList.remove('pressed');
        send('keyup', btn.dataset.key);
    }

    for (const root of roots) {
        root.addEventListener('pointerdown', press);
        root.addEventListener('pointerup', release);
        root.addEventListener('pointercancel', release);
        root.addEventListener('lostpointercapture', release);
        root.addEventListener('contextmenu', e => e.preventDefault());
    }

    return {
        /**
         * Whether the buttons should show: forced on or off by the setting, otherwise
         * on when the main pointer is a finger. Also sets the `touch-ui` body class.
         */
        refresh() {
            const mode = settings.touchControls || 'auto';
            const active = mode === 'on' || (mode === 'auto' && !!coarse?.matches);
            document.body.classList.toggle('touch-ui', active);
            return active;
        },
    };
}
