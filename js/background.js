/**
 * background.js - Runs the pixel art background behind the game.
 *
 * Casual gets nine scenes that change with each level (or one fixed scene, from the
 * casualScene setting). Classic gets three, the same way (classicScene): retro blocks,
 * the uloltris night and the snow domes. 40 Lines always shows Midnight Circuit and
 * Blitz always shows Thunder Peak. The menu cycles through the Casual scenes. Scenes
 * draw at 320 x 180 and are scaled up with crisp pixels to cover the window. A scene's
 * draw(ctx, t, { level }) gets the game level, which Retro Blocks uses for its palette.
 *
 * Every Casual, 40 Lines and Blitz scene can be shown in any of seven weathers (see
 * scenes/atmosphere.js). The weather setting picks one for all scenes, "default" gives
 * each scene its own signature look, and "cycle" walks through the weathers as Casual
 * levels up. Classic scenes are `quiet`: they keep the retro look in every weather and
 * play no scene sounds, like the console game they are modeled on.
 */

import { W, H } from './scenes/pixel.js';
import { createEnv, ambienceFor, cycleVariant, VARIANT_INFO } from './scenes/atmosphere.js';
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
import sakura from './scenes/sakura.js';
import aurora from './scenes/aurora.js';
import falls from './scenes/falls.js';

export const SCENES = { bamboo, wheat, sakura, village, falls, castle, ocean, aurora, neon, city, storm, blocks, ulol, domes };
export const CASUAL_SCENES = ['bamboo', 'wheat', 'sakura', 'village', 'falls', 'castle', 'ocean', 'aurora', 'neon'];
export const CLASSIC_SCENES = ['blocks', 'ulol', 'domes'];
const MODE_SCENES = { sprint: 'city', blitz: 'storm' };
const FADE_S = 1.6;
const FRAME_MS = 1000 / 30;
const MENU_CYCLE_S = 16;
/** Built scenes kept in memory; the rest are rebuilt if shown again. */
const KEEP_INSTANCES = 4;

export function describeScene(id) {
    return id === 'cycle' ? 'Cycle by level' : SCENES[id]?.name || id;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} layerEl - wrapper that gets the bg-dim / bg-off classes
 * @param {Object} settings - Settings reference (background, casualScene, weather)
 * @param {Object} [hooks]
 *   onScene({ id, variant, sceneName, weatherName, sounds }): the scene changed;
 *     `sounds` maps ambience layer names to levels (0..1)
 *   onStrike({ distance }): lightning flashed in the current scene
 *   onCue({ t, kind }): something happened in a scene that makes a sound (the Neon Fall
 *     stacker moved, locked or cleared four rows)
 */
export function createBackground(canvas, layerEl, settings, hooks = {}) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const fadeCanvas = document.createElement('canvas');
    fadeCanvas.width = W;
    fadeCanvas.height = H;
    const fadeCtx = fadeCanvas.getContext('2d');

    const instances = new Map();
    let current = null;     // { id, variant, key }
    let previous = null;
    let fadeStart = 0;
    let level = 0;          // game level, for scenes that follow it (Retro Blocks)
    let menuCycle = false;
    let menuIndex = 0;
    let menuSince = 0;
    let lastDraw = 0;
    const start = performance.now();

    function instance({ id, variant, key }) {
        let inst = instances.get(key);
        if (!inst) {
            const scene = SCENES[id];
            const env = createEnv(variant, scene);
            const drawing = scene.create(env);
            inst = {
                env,
                events: drawing.events,
                draw(c, t, opts) {
                    drawing.draw(c, t, opts);
                    if (!scene.quiet) env.overlay(c, t);
                },
            };
            instances.set(key, inst);
            for (const old of instances.keys()) {
                if (instances.size <= KEEP_INSTANCES) break;
                if (old !== current?.key && old !== previous?.key && old !== key) instances.delete(old);
            }
        }
        return inst;
    }

    function fit() {
        const scale = Math.max(window.innerWidth / W, window.innerHeight / H);
        canvas.style.width = `${Math.ceil(W * scale)}px`;
        canvas.style.height = `${Math.ceil(H * scale)}px`;
    }

    /** The weather for a scene: the setting, or the scene's own look. `step` drives "cycle". */
    function variantFor(id, step) {
        if (SCENES[id].quiet) return SCENES[id].signature;
        const pick = settings.weather || 'default';
        if (VARIANT_INFO[pick]) return pick;
        if (pick === 'cycle' && step !== null) return cycleVariant(step);
        return SCENES[id].signature;
    }

    function show(id, variant) {
        if (!SCENES[id]) return;
        const key = `${id}:${variant}`;
        if (key === current?.key) return;
        previous = current;
        current = { id, variant, key };
        fadeStart = (performance.now() - start) / 1000;
        hooks.onScene?.({
            id, variant,
            sceneName: SCENES[id].name,
            weatherName: SCENES[id].quiet ? '' : VARIANT_INFO[variant].name,
            sounds: SCENES[id].quiet ? {} : ambienceFor(SCENES[id], variant),
        });
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

    /** Show the scene for a Classic level (quiet scenes have a single look, so no weather). */
    function showClassic(lvl) {
        const id = classicScene(lvl);
        show(id, variantFor(id, null));
    }

    let warmTimer = 0;

    /** Show the scene for a Casual level, and build the next level's a moment later. */
    function showCasual(level) {
        const id = casualScene(level);
        show(id, variantFor(id, level));
        clearTimeout(warmTimer);
        warmTimer = setTimeout(() => {
            const next = casualScene(level + 1);
            const variant = variantFor(next, level + 1);
            instance({ id: next, variant, key: `${next}:${variant}` });
        }, 2500);
    }

    /** The scene the menu shows now: the chosen one, or the next in its slow cycle. */
    function showMenuScene() {
        const pick = settings.casualScene || 'cycle';
        const fixed = pick !== 'cycle' && SCENES[pick];
        const id = fixed ? pick : CASUAL_SCENES[menuIndex];
        show(id, variantFor(id, menuIndex + 1));
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
            showMenuScene();
        }

        const inst = instance(current);
        inst.draw(ctx, t, { level });
        if (hooks.onStrike) inst.env.poll(t, hooks.onStrike);
        if (hooks.onCue && inst.events) inst.events(t, hooks.onCue);
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
        /** Menu: slowly cycle through the Casual scenes (or show the chosen one). */
        showMenu() {
            menuCycle = true;
            menuSince = (performance.now() - start) / 1000;
            showMenuScene();
        },

        /** The scene or weather setting changed in the menu: show it now. */
        refresh() {
            if (menuCycle) showMenuScene();
        },

        /** A game started: pick the scene for its mode (and the start level, in Classic). */
        showMode(modeId, startLevel = 1) {
            menuCycle = false;
            level = startLevel;
            const fixed = MODE_SCENES[modeId];
            if (modeId === 'og') showClassic(level);
            else if (fixed) show(fixed, variantFor(fixed, null));
            else showCasual(level);
        },

        /** Level changed in Casual or Classic: move to the next scene in the cycle. */
        onLevel(modeId, newLevel) {
            level = newLevel;
            if (modeId === 'og') showClassic(level);
            else if (!MODE_SCENES[modeId]) showCasual(level);
        },
    };
}
