/**
 * background.js - Runs the pixel art background behind the game.
 *
 * Casual gets nine scenes that change with each level (or one fixed scene, from the
 * casualScene setting). 40 Lines always shows Midnight Circuit and Blitz always
 * shows Thunder Peak. The menu cycles through the Casual scenes. Scenes draw at
 * 320 x 180 and are scaled up with crisp pixels to cover the window.
 */

import { W, H } from './scenes/pixel.js';
import bamboo from './scenes/bamboo.js';
import wheat from './scenes/wheat.js';
import village from './scenes/village.js';
import castle from './scenes/castle.js';
import ocean from './scenes/ocean.js';
import neon from './scenes/neon.js';
import city from './scenes/city.js';
import storm from './scenes/storm.js';
import sakura from './scenes/sakura.js';
import aurora from './scenes/aurora.js';
import falls from './scenes/falls.js';

export const SCENES = { bamboo, wheat, sakura, village, falls, castle, ocean, aurora, neon, city, storm };
export const CASUAL_SCENES = ['bamboo', 'wheat', 'sakura', 'village', 'falls', 'castle', 'ocean', 'aurora', 'neon'];
const MODE_SCENES = { sprint: 'city', blitz: 'storm' };
const FADE_S = 1.6;
const FRAME_MS = 1000 / 30;
const MENU_CYCLE_S = 16;

export function describeScene(id) {
    return id === 'cycle' ? 'Cycle by level' : SCENES[id]?.name || id;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} layerEl - wrapper that gets the bg-dim / bg-off classes
 * @param {Object} settings - Settings reference (background, casualScene)
 * @param {(ambience: Object) => void} [onScene] - called with the new scene's ambience
 *   levels (layer name to 0..1) whenever the scene changes
 */
export function createBackground(canvas, layerEl, settings, onScene) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const fadeCanvas = document.createElement('canvas');
    fadeCanvas.width = W;
    fadeCanvas.height = H;
    const fadeCtx = fadeCanvas.getContext('2d');

    const instances = new Map();
    let current = null;
    let previous = null;
    let fadeStart = 0;
    let menuCycle = false;
    let menuIndex = 0;
    let menuSince = 0;
    let lastDraw = 0;
    const start = performance.now();

    function instance(id) {
        if (!instances.has(id)) instances.set(id, SCENES[id].create());
        return instances.get(id);
    }

    function fit() {
        const scale = Math.max(window.innerWidth / W, window.innerHeight / H);
        canvas.style.width = `${Math.ceil(W * scale)}px`;
        canvas.style.height = `${Math.ceil(H * scale)}px`;
    }

    function show(id) {
        if (!SCENES[id] || id === current) return;
        previous = current;
        current = id;
        fadeStart = (performance.now() - start) / 1000;
        onScene?.(SCENES[id].ambience || {});
    }

    function casualScene(level) {
        const pick = settings.casualScene || 'cycle';
        if (pick !== 'cycle' && SCENES[pick]) return pick;
        return CASUAL_SCENES[(Math.max(1, level) - 1) % CASUAL_SCENES.length];
    }

    function frame(now) {
        requestAnimationFrame(frame);
        const mode = settings.background || 'on';
        layerEl.classList.toggle('bg-dim', mode === 'dim');
        layerEl.classList.toggle('bg-off', mode === 'off');
        if (mode === 'off' || document.hidden || !current) return;
        if (now - lastDraw < FRAME_MS - 2) return;
        lastDraw = now;

        const t = (now - start) / 1000;
        if (menuCycle && t - menuSince > MENU_CYCLE_S) {
            menuSince = t;
            menuIndex = (menuIndex + 1) % CASUAL_SCENES.length;
            show(CASUAL_SCENES[menuIndex]);
        }

        instance(current).draw(ctx, t);
        const k = (t - fadeStart) / FADE_S;
        if (previous && k < 1) {
            instance(previous).draw(fadeCtx, t);
            ctx.globalAlpha = 1 - k;
            ctx.drawImage(fadeCanvas, 0, 0);
            ctx.globalAlpha = 1;
        } else {
            previous = null;
        }
    }

    window.addEventListener('resize', fit);
    fit();
    requestAnimationFrame(frame);

    return {
        /** Menu: slowly cycle through the Casual scenes. */
        showMenu() {
            menuCycle = true;
            menuSince = (performance.now() - start) / 1000;
            show(CASUAL_SCENES[menuIndex]);
        },

        /** A game started: pick the scene for its mode. */
        showMode(modeId, level = 1) {
            menuCycle = false;
            show(MODE_SCENES[modeId] || casualScene(level));
        },

        /** Casual level changed: move to the next scene in the cycle. */
        onLevel(modeId, level) {
            if (!MODE_SCENES[modeId]) show(casualScene(level));
        },
    };
}
