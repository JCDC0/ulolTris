/**
 * background.js - Runs the pixel art background behind the game.
 *
 * Casual gets six scenes that change with each level (or one fixed scene, from the
 * casualScene setting). Classic gets three, the same way (classicScene): retro blocks,
 * the uloltris night and the snow domes. 40 Lines always shows Midnight Circuit and
 * Blitz always shows Thunder Peak. The menu cycles through the Casual scenes. Scenes
 * draw at 320 x 180 and are scaled up with crisp pixels to cover the window. A scene's
 * draw(ctx, t, { level }) gets the game level, which Retro Blocks uses for its palette.
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
import blocks from './scenes/blocks.js';
import ulol from './scenes/ulol.js';
import domes from './scenes/domes.js';

const SCENES = { bamboo, wheat, village, castle, ocean, neon, city, storm, blocks, ulol, domes };
export const CASUAL_SCENES = ['bamboo', 'wheat', 'village', 'castle', 'ocean', 'neon'];
export const CLASSIC_SCENES = ['blocks', 'ulol', 'domes'];
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
 */
export function createBackground(canvas, layerEl, settings) {
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
    let level = 0;          // game level, for scenes that follow it (Retro Blocks)
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
    }

    function casualScene(level) {
        const pick = settings.casualScene || 'cycle';
        if (pick !== 'cycle' && SCENES[pick]) return pick;
        return CASUAL_SCENES[(Math.max(1, level) - 1) % CASUAL_SCENES.length];
    }

    /** Classic scene for a level (levels start at 0 there). */
    function classicScene(level) {
        const pick = settings.classicScene || 'cycle';
        if (pick !== 'cycle' && SCENES[pick]) return pick;
        return CLASSIC_SCENES[Math.max(0, level) % CLASSIC_SCENES.length];
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

        instance(current).draw(ctx, t, { level });
        const k = (t - fadeStart) / FADE_S;
        if (previous && k < 1) {
            instance(previous).draw(fadeCtx, t, { level });
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

        /** A game started: pick the scene for its mode (and the start level, in Classic). */
        showMode(modeId, startLevel = 1) {
            menuCycle = false;
            level = startLevel;
            show(modeId === 'og' ? classicScene(level) : MODE_SCENES[modeId] || casualScene(level));
        },

        /** Level changed in Casual or Classic: move to the next scene in the cycle. */
        onLevel(modeId, newLevel) {
            level = newLevel;
            if (modeId === 'og') show(classicScene(level));
            else if (!MODE_SCENES[modeId]) show(casualScene(level));
        },
    };
}
