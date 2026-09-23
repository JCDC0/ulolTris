# AGENTS.md

Guide for AI agents (Claude, Hermes, Antigravity, and others) configuring or building features in ulolTris. Agent memory does not carry over between tools, so state the next agent needs goes in "Open work" below, not in a private note.

## Overview

ulolTris is a TETR.IO-inspired block stacker in plain browser JavaScript. There is no framework and no linter. Source lives in `js/` as ES modules. esbuild bundles them into one IIFE, `game.js`, which `index.html` loads with a plain `<script>` tag.

## Commands

```bash
npm install        # esbuild is the only dependency
npm run build      # bundle js/main.js -> game.js
npm run watch      # rebuild on change
npm run serve      # build in memory and serve at http://localhost:8123
npm test           # handling timing tests (tests/handling.test.mjs)
```

You can also open `index.html` directly after `npm run build`, because the bundle is not a module script.

`npm test` bundles the test with esbuild for Node and stubs `document`, `window`, and `performance`, so it needs no browser. It drives `js/input.js` frame by frame at 60 Hz and checks DAS, ARR, DCD, SDF, the two toggles, and settings migration. Add a check there when you change handling.

## Rules

- Root `game.js` is generated. Never edit it by hand. Edit `js/*.js`, then run `npm run build`. The bundle is committed, so rebuild before every commit that touches `js/`.
- `js/game.js` (the engine module) and root `game.js` (the bundle) share a name. Do not confuse them.
- Commit format: version prefix, then a sentence, for example `1.1.1: Fix lock delay reset after hold`. Bump `version` in `package.json` to match.
- Code style: JSDoc on exported functions. A comment that records why a choice was made is fine; no single-line comments that restate the code. No em dashes in code, comments, or docs.
- Before a commit: `npm test` passes and `npm run build` succeeds. For visual changes, load the page and look at it.

## Architecture

`js/main.js` is the entry point and composition root. It loads settings, creates the sound engine, music player, and menu, builds the settings panel, and calls `createGame()` when a mode is picked. Restart and quit destroy the game instance and create a new one.

Every module uses a factory (`createX(...)` returning an object of closures), not classes. Shared state is passed in by reference, not imported as globals.

- **Engine** (`js/game.js`): owns the arena, the active piece (`player`), the next queue, hold, gravity, lock delay (15-move reset cap), and the `requestAnimationFrame` loop. It reports out through `onGameOver(results)` and `onPause()`.
- **Pure logic** (no DOM): `piece.js` (shapes, SRS kicks, 7-bag, spawn position), `board.js` (collide, merge, line clear, ghost), `scoring.js` (T-spin detection, combo, back-to-back, perfect clear, sound and color mapping).
- **Modes** (`modes.js`, `timer.js`): Sprint (40 lines), Blitz (2 minutes), Classic (marathon). To add a mode, add an ID, a `MODE_INFO` entry, and handling in `createModeState`. The menu reads `MODE_INFO`.
- **Presentation**: `renderer.js` (board, hold, next canvases), `particles.js` (particles, screen shake, action text), `menu.js` (all menu screens in `#menu-container`).
- **Audio**: `sound.js` synthesizes all effects with Web Audio (no files). `music-player.js` plays user-dropped files through two crossfading `Audio` elements.
- The menu opens the settings panel by dispatching a `uloltris-open-settings` DOM event.

### Board geometry

The arena is `COLS` (10) wide and `BUFFER_ROWS` (40) tall. Only the bottom `VISIBLE_ROWS` (20) are drawn; the rows above are a hidden buffer. Renderer and particle code offset by `BUFFER_ROWS - VISIBLE_ROWS`. Pieces spawn with their top filled row on the first visible row (`getSpawnPos`), so they are visible at once. Side previews (hold, next) center each piece by its filled cells, not its padded matrix.

### Settings

`settings.js` holds `DEFAULT_SETTINGS`, per-key `CONSTRAINTS`, `normalizeSettings` (clamps and fills missing keys), and persistence to `localStorage` under `uloltris-settings`. Saves carry `version: 2`. `migrateSettings` converts version 1 saves (handling in milliseconds) to frames and resets SDF.

The settings object is one shared instance. `main.js` mutates it in place (reset uses `Object.assign`), and the game, input, sound, and music modules read it live. Never replace it with a new object. To add a setting: add the default and constraint (or boolean check) in `settings.js`, then add a row to the `tabs` array in `buildSettingsUI()` in `main.js`. The panel's listeners are bound once; rebuilding the panel only re-renders rows.

### Handling (TETR.IO model)

Implemented in `js/input.js`. Units match TETR.IO: frames at 60 Hz for ARR, DAS, and DCD, and a gravity multiplier for SDF.

| Setting | Range | Default | Behavior |
|---|---|---|---|
| ARR | 0 to 5 F | 2 F | Frames between auto-shifts after DAS. 0 shifts to the wall in the same frame. |
| DAS | 1 to 20 F | 10 F | Frames a direction is held before auto-shift starts. |
| DCD | 0 to 20 F | 1 F | Pauses DAS charging after a rotation or a new piece (spawn, hold). 0 is off. |
| SDF | 5 to 40 X, 41 = infinite | 6 X | Soft drop speed is gravity times SDF. Infinite drops to the floor in one frame. |
| Cancel DAS on turn | on/off | off | When off, the DAS charge carries over when you switch direction. |
| Prefer soft drop | on/off | off | Runs soft drop before horizontal movement within a frame. |

The engine side: `onMove(dir, cells)` and `onSoftDrop(cells)` accept `Infinity`, `getGravityInterval()` supplies the current gravity to SDF, and `game.js` calls `input.cutDas()` on spawn, successful rotation, and hold swap. A 1 ms tolerance (`EPSILON`) snaps timings to frame boundaries so drift in frame timestamps does not delay a shift by a frame.

## Open work

Handling audit, done on 2026-09-23 (version 1.1.0):
- ARR, DAS, DCD were in milliseconds and SDF was a millisecond interval. Now in TETR.IO units, with migration of old saves.
- ARR 0 moved one cell per frame. Now it shifts to the wall at once.
- ARR under one frame was capped at one shift per frame. Now multiple shifts per frame are applied.
- DCD was used as the DAS delay when switching direction. That is not what DCD does in TETR.IO. Now it pauses DAS after rotate, spawn, and hold swap.
- Added the missing TETR.IO toggles: cancel DAS when changing directions, prefer soft drop over movement.
- Fixed: reset defaults replaced the shared settings object and bound the panel listeners a second time.
- Fixed: hold and next previews pushed 3-wide pieces one column right and clipped them. Pieces spawned hidden above the visible board.

Next steps, in order:
1. Confirm against the live TETR.IO client: the handling ranges and defaults above came from memory of the TETR.IO settings screen and from the TETR.IO FAQ, not from reading the client. Also confirm whether DCD applies after hold and after a hard drop, and whether the carried DAS charge also applies when releasing back to the older key.
2. Consider TETR.IO's "prevent accidental hard drops" option and IRS/IHS (initial rotation and hold), which are not implemented.
3. Keybinds are hard-coded in `input.js` (`GAME_KEYS` and the switch). A remapping UI would need a keybind setting and a lookup table.
4. Gravity drops at most one cell per frame (`update()` in `game.js`), so gravity faster than 1 G is capped. Classic mode tops out at 50 ms per cell, so this does not show yet.
5. The handling sliders step by 0.1 F. Check whether TETR.IO uses the same step.
