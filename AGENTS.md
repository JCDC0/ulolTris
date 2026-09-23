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
npm test           # every tests/*.test.mjs, bundled for Node (tests/run.mjs)
```

You can also open `index.html` directly after `npm run build`, because the bundle is not a module script.

`npm test` bundles each test with esbuild for Node and stubs `document`, `window`, and `performance` where needed, so it needs no browser:
- `handling.test.mjs` drives `js/input.js` frame by frame at 60 Hz: DAS, ARR, DCD, SDF, the two toggles, settings migration.
- `modes.test.mjs`: when each mode's music turns intense, lines sent and APM, game style delays.
- `content.test.mjs`: the attack table, and song data (known voices, events inside their bars, note range, the Korobeiniki motif in every track, keys and tempos).

Add a check to the matching file when you change that area. Audio output itself is not covered by `npm test`; to hear a track without playing the game, call `renderTrackOffline(name, seconds)` from `js/music.js` in a browser and save the buffer.

## Rules

- Root `game.js` is generated. Never edit it by hand. Edit `js/*.js`, then run `npm run build`. The bundle is committed, so rebuild before every commit that touches `js/`.
- `js/game.js` (the engine module) and root `game.js` (the bundle) share a name. Do not confuse them.
- Commit format: version prefix, then a sentence, for example `1.1.1: Fix lock delay reset after hold`. Bump `version` in `package.json` to match.
- Code style: JSDoc on exported functions. A comment that records why a choice was made is fine; no single-line comments that restate the code. No em dashes in code, comments, or docs.
- Before a commit: `npm test` passes and `npm run build` succeeds. For visual changes, load the page and look at it.

## Architecture

`js/main.js` is the entry point and composition root. It loads settings, creates the sound engine, soundtrack, music player, and menu, builds the settings panel, and calls `createGame()` when a mode is picked. Restart and quit destroy the game instance and create a new one.

Every module uses a factory (`createX(...)` returning an object of closures), not classes. Shared state is passed in by reference, not imported as globals.

- **Engine** (`js/game.js`): owns the arena, the active piece (`player`), the next queue, hold, gravity, lock delay (15-move reset cap), and the `requestAnimationFrame` loop. It reports out through `onGameOver(results)` and `onPause()`.
- **Pure logic** (no DOM): `piece.js` (shapes, SRS kicks, 7-bag, spawn position), `board.js` (collide, merge, line clear, ghost), `scoring.js` (T-spin detection, combo, back-to-back, perfect clear, sound and color mapping).
- **Modes** (`modes.js`, `timer.js`): Sprint (40 lines), Blitz (2 minutes), Classic (marathon). To add a mode, add an ID, a `MODE_INFO` entry, and handling in `createModeState`. The menu reads `MODE_INFO`.
- **Presentation**: `renderer.js` (board, hold, next canvases), `particles.js` (particles, screen shake, action text), `menu.js` (all menu screens in `#menu-container`).
- **Audio**: `sound.js` synthesizes all effects with Web Audio (no files), including the `danger` alarm and the `attack` whoosh. `music.js` plays the procedural soundtrack from `tracks.js`. `music-player.js` plays user-dropped files through two crossfading `Audio` elements; while it plays, the soundtrack goes silent (`setSuppressor`).
- The menu opens the settings panel by dispatching a `uloltris-open-settings` DOM event.

### Board geometry

The arena is `COLS` (10) wide and `BUFFER_ROWS` (40) tall. Only the bottom `VISIBLE_ROWS` (20) are drawn; the rows above are a hidden buffer. Renderer and particle code offset by `BUFFER_ROWS - VISIBLE_ROWS`. Pieces spawn with their top filled row on the first visible row (`getSpawnPos`), so they are visible at once. Side previews (hold, next) center each piece by its filled cells, not its padded matrix.

### Game styles, attack, danger

`GAME_STYLES` in `modes.js` sets the wait between a lock and the next piece. Modern (TETR.IO, Jstris) has none. Battle (Tetris 99, Puyo Puyo Tetris) pauses 500 ms on a line clear, 1000 ms when the clear sends `BIG_HIT_LINES` (4) or more, and adds a 117 ms (7 F) entry delay to every piece. During the wait `active` is false in `game.js`: input is ignored (DAS still charges), gravity and lock stop, and the renderer draws the pre-clear board with the cleared rows flashing (`flash`). The style is read when a game starts.

`calculateAttack()` in `scoring.js` uses the guideline versus table (the one Tetris 99 and Puyo Puyo Tetris use): single 0, double 1, triple 2, Tetris 4, T-spin single/double/triple 2/4/6, +1 back-to-back, a combo table, +10 for a perfect clear. There is no opponent yet, so attack is shown (orbs from `particles.spawnAttack`, "+N SENT", the SENT stat) and counted (lines sent, APM on the results screen) in both styles.

Danger: when any block sits in the top `DANGER_ROWS` (4) visible rows after a lock, the board gets the `board-danger` class (red pulse in `style.css`) and the `danger` alarm plays once a second until the stack drops.

### Soundtrack

Three original arrangements of Korobeiniki (the public-domain folk song behind the classic Tetris theme) in `tracks.js`. No commercial soundtrack is copied.

| Track | Key, tempo | Used for | Character |
|---|---|---|---|
| calm | C minor, 88 BPM, swung | Menu, Classic | Reharmonized with 7th and 9th chords (Am9, Fmaj7, E7sus4, Dm9, Cmaj7, Bm7b5); bell melody, FM electric piano, lo-fi drums. The second pass adds runs and climbs an octave; the last pass adds a harmony line. |
| competitive | D minor, 150 BPM | Sprint, Blitz | Octave-pumping bass, 16th arpeggios, four-on-the-floor drums, square/saw lead; the second pass goes up an octave with a harmony. |
| intense | E minor, 176 BPM | Classic level 10+, Blitz last 30 s, Sprint last 10 lines | Chugging 16th bass, stabs, syncopated kick; the bridge is in double time. |

`game.js` picks the track every frame (`updateMusic`): the mode's `MODE_INFO.track`, or `intense` when `modeState.isHeated()`. Classic's calm track also speeds up 1.2 % per level. The `soundtrack` setting can force one track or turn it off. The menu plays calm. Pausing muffles and lowers the music.

`music.js` schedules whole bars 0.2 s ahead on the AudioContext clock, so tempo holds when frames drop. Each track has its own gain, compressor and tempo-synced delay; switching tracks crossfades over 1.5 s. Browsers block audio until a user gesture, so `main.js` calls `music.unlock()` on the first click or key. Levels were checked by rendering stems offline: full mix peaks near -8 dBFS at full volume, and the melody sits level with the backing.

To change a song, edit the bar builders in `tracks.js`. Events are `{ s, l, v, n, g }` on a 16-step bar; `npm test` checks their shape.

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

Dead code sweep, done on 2026-09-23 (version 1.1.1): removed unused exports, factory methods, imports, the unread `boardOpacity` setting, the unused `allClears` stat, and the `R` and `F1` keys, which were captured but did nothing. The HUD now uses `getPrimaryStatLabel`/`getPrimaryStatValue` from `modes.js` instead of repeating the Sprint logic. The `levelUp` sound existed but was never played; it now plays on level up. A quick-retry key (TETR.IO uses `R`) would need wiring to the menu's restart.

Music, warning, and Battle style, done on 2026-09-23 (version 1.2.0): see "Game styles, attack, danger" and "Soundtrack" above. Checked in a browser by a script that plays real games from the canvas pixels: Modern spawns the next piece within one frame; Battle waits about 114 ms with no clear, 614 ms after a clear, and 1110 ms after a Tetris; attacks registered as expected (for example 4 lines sent 5 with a combo). The danger alarm repeated once a second, and the soundtrack played at the right tempo in each context.

Next steps, in order:
1. Listen and tune the soundtrack by ear: instrument balance, and whether each loop wears thin over a long session. It was balanced by measurement, not by listening.
2. Incoming garbage: a training opponent or garbage timer that sends lines back, with a red incoming-garbage meter beside the board (Tetris 99 and Puyo Puyo Tetris both show one). Attack is already calculated.
3. Offer TETR.IO's attack table as an option for the Modern style (it differs from the guideline table in combos and perfect clears).
4. Confirm against the live TETR.IO client: the handling ranges and defaults above came from memory of the TETR.IO settings screen and from the TETR.IO FAQ, not from reading the client. Also confirm whether DCD applies after hold and after a hard drop, and whether the carried DAS charge also applies when releasing back to the older key.
5. Consider TETR.IO's "prevent accidental hard drops" option and IRS/IHS (initial rotation and hold), which are not implemented.
6. Keybinds are hard-coded in `input.js` (`GAME_KEYS` and the switch). A remapping UI would need a keybind setting and a lookup table.
7. Gravity drops at most one cell per frame (`update()` in `game.js`), so gravity faster than 1 G is capped. Classic mode tops out at 50 ms per cell, so this does not show yet.
8. The handling sliders step by 0.1 F. Check whether TETR.IO uses the same step.
