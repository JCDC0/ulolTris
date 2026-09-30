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
- `content.test.mjs`: the attack table, song data (known voices, events inside their bars, note range, the Korobeiniki motif in every track, keys and tempos), and scenes (each has a name and known ambience layers; every Casual scene can be picked in settings).
- `finesse.test.mjs`: every piece spawns just above the field, and the finesse minimums match the standard chart.

Add a check to the matching file when you change that area. Audio output itself is not covered by `npm test`; to hear a track without playing the game, call `renderTrackOffline(name, seconds)` from `js/music.js` in a browser and save the buffer. `renderAmbienceOffline(levels, seconds)` in `js/ambience.js` does the same for scene sounds.

## Rules

- Root `game.js` is generated. Never edit it by hand. Edit `js/*.js`, then run `npm run build`. The bundle is committed, so rebuild before every commit that touches `js/`.
- `js/game.js` (the engine module) and root `game.js` (the bundle) share a name. Do not confuse them.
- Commit format: version prefix, then a sentence, for example `1.1.1: Fix lock delay reset after hold`. Bump `version` in `package.json` to match.
- Code style: JSDoc on exported functions. A comment that records why a choice was made is fine; no single-line comments that restate the code. No em dashes in code, comments, or docs.
- Before a commit: `npm test` passes and `npm run build` succeeds. For visual changes, load the page and look at it.

## Architecture

`js/main.js` is the entry point and composition root. It loads settings, creates the background, sound engine, soundtrack, music player, and menu, builds the settings panel, scales the playfield to fit small windows (`fitGame`), and calls `createGame()` when a mode is picked. Restart and quit destroy the game instance and create a new one.

Every module uses a factory (`createX(...)` returning an object of closures), not classes. Shared state is passed in by reference, not imported as globals.

- **Engine** (`js/game.js`): owns the arena, the active piece (`player`), the next queue, hold, gravity, lock delay (15-move reset cap), finesse counting, and the `requestAnimationFrame` loop. It reports out through `onGameOver(results)`, `onPause()` and `onLevelUp(level)`.
- **Pure logic** (no DOM): `piece.js` (shapes, SRS kicks, 7-bag, spawn position), `board.js` (collide, merge, line clear, ghost), `scoring.js` (T-spin detection, combo, back-to-back, perfect clear, attack, sound and color mapping), `finesse.js` (fewest inputs per placement).
- **Modes** (`modes.js`, `timer.js`): 40 Lines (`sprint`), Blitz (2 minutes), Casual (`classic` in code: endless, level-based gravity). To add a mode, add an ID, a `MODE_INFO` entry, and handling in `createModeState`. The menu reads `MODE_INFO`.
- **Presentation**: `renderer.js` (board, hold, next canvases), `skins.js` (block skins, cached sprites), `particles.js` (particles and screen shake on the board canvas), `bounce.js` (spring on the playfield element), `hud.js` (DOM around the board: clear feed, stats, number under the board, progress meter, finesse), `menu.js` (all menu screens in `#menu-container`), `background.js` plus `scenes/` (pixel art backgrounds).
- **Audio**: `sound.js` synthesizes all effects with Web Audio (no files), including the `danger` alarm and the `attack` whoosh. Sound packs (`PACKS` in `sound.js`: `arcade` in a Jstris style, `bubbly` in a Puyo Puyo Tetris style, both original synthesis) replace individual events; events a pack leaves out use the default. `music.js` plays the procedural soundtrack from `tracks.js`. `music-player.js` plays user-dropped files through two crossfading `Audio` elements; while it plays, the soundtrack goes silent (`setSuppressor`). `ambience.js` synthesizes the scene sounds (see "Scene sounds").
- The menu opens the settings panel by dispatching a `uloltris-open-settings` DOM event.

### Board geometry

The arena is `COLS` (10) wide and `BUFFER_ROWS` (40) tall. The field is the bottom `VISIBLE_ROWS` (20); the renderer also draws `SPAWN_ROWS` (3) rows above it. Renderer and particle code offset by `BUFFER_ROWS - VISIBLE_ROWS`, so negative field rows are the spawn area.

Pieces spawn fully above the field, like TETR.IO: `getSpawnPos` puts the lowest filled row on the row just above the field, and gravity brings the piece in. Top-out rules: block out (a new piece overlaps blocks when it spawns) and lock out (a piece locks with every cell above the field). Faint X marks on the board canvas show the cells where the next piece will spawn; they turn red in danger.

The board canvas is `BOARD_CANVAS` in `renderer.js`: 308 x 694, with the field starting 90 px down. It draws its own field background, grid and frame (open at the top), so the page layout (`.side` columns, `.meter`) uses a 90 px top margin to line up with the field. Side previews use 22 px blocks and center each piece by its filled cells.

### Game styles, attack, danger

`GAME_STYLES` in `modes.js` sets the wait between a lock and the next piece. Modern (TETR.IO, Jstris) has none. Battle (Tetris 99, Puyo Puyo Tetris) pauses 500 ms on a line clear, 1000 ms when the clear sends `BIG_HIT_LINES` (4) or more, and adds a 117 ms (7 F) entry delay to every piece. During the wait `active` is false in `game.js`: input is ignored (DAS still charges), gravity and lock stop, and the renderer draws the pre-clear board with the cleared rows flashing (`flash`). The style is read when a game starts.

`calculateAttack()` in `scoring.js` uses the guideline versus table (the one Tetris 99 and Puyo Puyo Tetris use): single 0, double 1, triple 2, Tetris 4, T-spin single/double/triple 2/4/6, +1 back-to-back, a combo table, +10 for a perfect clear. There is no opponent yet, so attack is shown (orbs from `particles.spawnAttack` that leave through the right wall, and the "+N" slot of the clear feed) and counted (lines sent, APM, APP, VS) in both styles.

Danger: when any block sits in the top `DANGER_ROWS` (4) visible rows after a lock, the renderer pulses the frame and the top of the field red, the X marks turn red, and the `danger` alarm plays once a second until the stack drops. The canvas also gets a `board-danger` class, which tests read.

### HUD and stats

`hud.js` fills the elements around the board (`#hud-feed`, `#hud-stats`, `#hud-under`, `#hud-finesse`, `#hud-meter-fill`). The clear feed on the left has one slot each for the spin, the clear name (QUAD for four lines), B2B, combo and damage; each slot replays its CSS animation when it updates. The `statsDisplay` setting picks the stats stack at the bottom left, like TETR.IO's display option: off, time (pieces with PPS, lines, time), speed (PPS, APM, KPS), efficiency (APP, KPP, finesse) or versus (APM, PPS, VS = attack per second x 100). Casual adds LEVEL. The number under the board is lines left (40 Lines) or score. The meter between the board and the next queue shows 40 Lines progress, Blitz time left, or progress to the next Casual level. The DOM only changes when text changes, so `update()` is cheap every frame.

Finesse: `input.js` counts move and rotate key presses per piece (`takePieceInputs`). At lock, `game.js` compares them with `minimumInputs()` from `finesse.js` (breadth-first search on an empty board: tap, hold to wall, rotate either way; no 180). A piece placed with soft drop, or one that is unreachable on an empty board (a tuck), is not judged.

### Effects

Independent off/low/medium/high levels (`effectLevel()` in `settings.js`): `boardBounce` (`bounce.js` springs the playfield down on hard drops and clears, sideways when a long slide hits a wall), `placeImpact` (drop trail, landing flash, dust), `clearEffects` (row flash, bursts, T-spin spiral, B2B sparkles, perfect clear confetti) and `screenShake`.

### Skins

`skins.js` paints one block per skin into a cached canvas (`blockSprite(skin, color, size)`); the renderer draws blocks with `drawImage`. Skins: ulol (pixel bevel with inset square, default), classic (thick 3D bevel, Jstris style), glossy (rounded candy blocks, Puyo Puyo Tetris style), flat, neon. All are original drawings. To add one, add a painter to `PAINTERS`, and its name to `SKINS` and `ENUMS.blockSkin`.

### Backgrounds

`background.js` draws a scene at 320 x 180 on `#bg-canvas`, scaled up with crisp pixels to cover the window, at 30 fps, paused while the tab is hidden, with a 1.6 s crossfade between scenes. Each scene in `scenes/` builds its static layers once (lazily, the first time it shows) and animates only what moves; `scenes/pixel.js` has the shared helpers (seeded random, dithered gradients, haze, discs, ridges, clouds).

| Scene | Where |
|---|---|
| bamboo (path through the rain), wheat (golden hour), sakura (shrine gate, petals), village (night), falls (waterfall), castle (crag above a lake, dusk), ocean (day), aurora (northern lights, cabin), neon (falling blocks) | Casual only: one per level, cycling, or a fixed one from the `casualScene` setting. The menu cycles through them. |
| city (Midnight Circuit: neon skyline, light streaks on a highway) | 40 Lines |
| storm (Thunder Peak: snowy peaks, heavy rain, lightning) | Blitz |

The `background` setting is on, dim (darker overlay) or off. Measured cost: under 1.5 ms per scene frame; building a scene takes 3 to 115 ms.

To add a scene: write `scenes/<id>.js` exporting `{ id, name, ambience, create() }`, add it to `SCENES` (and `CASUAL_SCENES` if Casual should use it) in `background.js`, and add the id to `ENUMS.casualScene` in `settings.js`.

Scene notes. Wheat: each stalk is a sprite (bent stem, ear of staggered kernels, awns on the top kernels) drawn once per size at nine lean angles; the wind picks a lean per stalk each frame. Castle: `wall()` and `roundTower()` take a `ground(x)` function and run every column down to the rock, so nothing floats; all left faces are lit by the sun at `SUN`; the lake is a flipped, darkened copy of the finished scene. Bamboo: `pathHalf(y)` is the half width of the path at row y, and `forestLayer` leaves out any stalk that would stand on it.

### Scene sounds

`ambience.js` plays background sounds that match the scene. Everything is synthesized with Web Audio (filtered noise and sine tones); there are no audio files. Each scene lists its layers and levels, for example `ambience: { rain: 1, wind: 0.2, birds: 0.15 }`. Beds are continuous (`rain`, `storm`, `wind`, `wheat`, `water`, `waves`, `hum`, `city`); calls are short sounds at random intervals (`birds`, `crickets`, `owl`, `gulls`, `chimes`, `thunder`, `traffic`). `background.js` reports each scene change through its `onScene` callback, and `main.js` passes it to `ambience.setScene()`. Every layer glides to its new level (about 1 s), so a layer two scenes share keeps playing. Beds are built when first needed and freed 8 s after they fade out.

Settings: `ambience` (SCENE SOUNDS toggle) and `ambienceVolume`, both in the AUDIO tab. Scene sounds also go silent when `background` is off or the tab is hidden. Thunder is not synced to the lightning flashes in the storm scene.

### Soundtrack

Three original arrangements of Korobeiniki (the public-domain folk song behind the classic Tetris theme) in `tracks.js`. No commercial soundtrack is copied.

| Track | Key, tempo | Used for | Character |
|---|---|---|---|
| calm | C minor, 88 BPM, swung | Menu, Casual | Reharmonized with 7th and 9th chords (Am9, Fmaj7, E7sus4, Dm9, Cmaj7, Bm7b5); bell melody, FM electric piano, lo-fi drums. The second pass adds runs and climbs an octave; the last pass adds a harmony line. |
| competitive | D minor, 150 BPM | 40 Lines | Octave-pumping bass, 16th arpeggios, four-on-the-floor drums, square/saw lead; the second pass goes up an octave with a harmony. |
| intense | E minor, 176 BPM | Blitz, and Casual from level 10 | Chugging 16th bass, stabs, syncopated kick; the bridge is in double time. |

`game.js` picks the track every frame (`updateMusic`): the mode's `MODE_INFO.track`, or `intense` when `modeState.isHeated()`, which only Casual does (level 10+). 40 Lines and Blitz keep one track for the whole run, so the pace never changes mid-game. Casual's calm track also speeds up 1.2 % per level. The `soundtrack` setting can force one track or turn it off. The menu plays calm. Pausing muffles and lowers the music.

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

Visual update, done on 2026-09-25 (version 1.3.0): TETR.IO-style layout (hold and next attached to the board, stats bottom left, clear feed on the left, number under the board, progress meter), spawn above the field with lock out and X marks, stats display setting with PPS, APM, KPS, APP, KPP, VS and finesse, block skins, sound packs, independent effect levels with board bounce, pixel art backgrounds (six Casual scenes, city for 40 Lines, storm for Blitz), Barlow Condensed and Silkscreen fonts, 40 Lines and Blitz on fixed tracks. Checked in a browser: the test bot played 120-piece games in both styles with no page errors, frames stayed at 6 ms with backgrounds on, and every scene, skin and stats mode was screenshotted and looked at.

Next steps, in order:
1. Listen and tune the soundtrack and the two new sound packs by ear. They were balanced by measurement, not by listening.
2. Incoming garbage: a training opponent or garbage timer that sends lines back, with a red incoming-garbage meter beside the board (Tetris 99 and Puyo Puyo Tetris both show one). Attack is already calculated, and the progress meter between the board and the next queue is where an incoming meter would go.
3. Fonts load from Google Fonts. Offline, the page falls back to system fonts. Self-host the two fonts (both under the SIL Open Font License) if the game should look the same offline.
4. A quick-retry key (TETR.IO uses R) wired to the menu's restart.
5. Offer TETR.IO's attack table as an option for the Modern style (it differs from the guideline table in combos and perfect clears).
6. Confirm against the live TETR.IO client: the handling ranges and defaults above came from memory of the TETR.IO settings screen and from the TETR.IO FAQ, not from reading the client. Also confirm whether DCD applies after hold and after a hard drop, and whether the carried DAS charge also applies when releasing back to the older key.
7. Consider TETR.IO's "prevent accidental hard drops" option and IRS/IHS (initial rotation and hold), which are not implemented.
8. Keybinds are hard-coded in `input.js` (`GAME_KEYS` and the switch). A remapping UI would need a keybind setting and a lookup table.
9. Gravity drops at most one cell per frame (`update()` in `game.js`), so gravity faster than 1 G is capped. Casual tops out at 50 ms per cell, so this does not show yet.
10. The handling sliders step by 0.1 F. Check whether TETR.IO uses the same step.
