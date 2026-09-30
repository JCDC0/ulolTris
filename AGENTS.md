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
- `modes.test.mjs`: the track each mode plays, lines sent and APM, game style delays.
- `content.test.mjs`: the attack table, song data (known voices, events inside their bars, note range, the Korobeiniki motif in every track, keys and tempos), scenes (each has a name, signature weather, horizon and known sounds; every Casual scene and every weather can be picked in settings), the sound mix in all seven weathers of every scene (rain only in rain, thunder only with lightning, no daytime animals at night), and the settings menu definitions (every entry matches `settings.js`, every setting has an entry, every enum value is accepted).
- `synth.test.mjs`: the built sounds in `ambience-synth.js`. Rain, storm and water loops must be a smooth shower that still moves (kurtosis between 3.3 and 7, where steady white noise scores 2.7 and a few pops score far higher; loudness that changes over time), warm (little below 300 Hz, not mostly above 6 kHz) and steady in level; their droplets must be audible but subtle (2 to 10 % of the shower's energy, in taps about 4 times its level); a storm must swell more than light rain; wheat must be peaky (stalks touching, in swells); thunder must be loudest at the start and die away, and overhead thunder must crack harder than distant thunder.
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
- **Presentation**: `renderer.js` (board, hold, next canvases), `skins.js` (block skins, cached sprites), `particles.js` (particles and screen shake on the board canvas), `bounce.js` (spring on the playfield element), `hud.js` (DOM around the board: clear feed, stats, number under the board, progress meter, finesse), `menu.js` (every menu screen, see "Menus") with `settings-defs.js` (what the settings menu lists), `background.js` plus `scenes/` (pixel art backgrounds).
- **Audio**: `sound.js` synthesizes all effects with Web Audio (no files), including the `danger` alarm and the `attack` whoosh. The default Tetris clear (`clear4`) is a bell "bling": three grace notes into a ringing high note, each a stack of decaying sine partials. Sound packs (`PACKS` in `sound.js`: `arcade` in a Jstris style, `bubbly` in a Puyo Puyo Tetris style, both original synthesis) replace individual events; events a pack leaves out use the default. `music.js` plays the procedural soundtrack from `tracks.js`. `music-player.js` plays user-dropped files through two crossfading `Audio` elements; while it plays, the soundtrack goes silent (`setSuppressor`). `ambience.js` and `ambience-synth.js` synthesize the scene sounds (see "Scene sounds").
- The gear button (`#settings-toggle`) opens the settings menu from anywhere; in a running game it pauses first. While a menu is up the button hides (`body.menu-open`).
- **Touch** (`touch.js`): on-screen buttons for phones and tablets (see "Mobile and touch").

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

`background.js` draws a scene at 320 x 180 on `#bg-canvas`, scaled up with crisp pixels to cover the window, at 30 fps, paused while the tab is hidden, with a 1.6 s crossfade between scenes. Each scene in `scenes/` builds its static layers once (lazily, the first time it shows) and animates only what moves; `scenes/pixel.js` has the shared helpers (seeded random, dithered gradients, haze, discs, ridges, clouds). Built scenes are cached per scene and weather (four kept), and Casual builds the next level's scene 2.5 s after a level starts so a level up never stalls a frame.

| Scene | Signature weather | Where |
|---|---|---|
| bamboo (path through the forest) | rain | Casual |
| wheat (windmill, scarecrow) | sunset | Casual |
| sakura (shrine gate, petals) | sunny | Casual |
| village | night | Casual |
| falls (waterfall) | sunny | Casual |
| castle (crag above a lake) | sunset | Casual |
| ocean | sunny | Casual |
| aurora (frozen lake, cabin; rain falls as snow) | night | Casual |
| neon (falling blocks, retro sun) | night | Casual |
| city (Midnight Circuit: skyline, light streaks on a highway) | night | 40 Lines |
| storm (Thunder Peak: snowy peaks) | thunder | Blitz |

The `background` setting is on, dim (darker overlay) or off. Measured cost: under 1.6 ms per scene frame; building a scene takes 17 to 110 ms.

### Weather

Every scene can show seven weathers (`VARIANTS` in `scenes/atmosphere.js`): sunny, cloudy, sunset, rain (Cloudy (Rain)), thunder (Thunderstorm), night, nightthunder (Night Thunderstorm). The `weather` setting (VISUAL tab) is `default` (each scene's signature), `cycle` (Casual walks through `CYCLE_ORDER` as levels go up; 40 Lines and Blitz keep their signature) or one fixed weather for all scenes.

How it works: a scene is drawn once in daylight colors, and `createEnv(variant, scene)` returns an `env` the scene uses:
- `env.makeSky(opts)`: gradient, sun or moon, stars, two scrolling cloud layers and lightning for the weather. `sky.canvas` is the still sky (no clouds) for reflections; scenes may draw onto it (bamboo paints the clearing). Options: `horizon`, `palette` (sakura and neon use their own), `noSun`.
- `env.grade(canvas)` and `env.gradeData(pixels)` shift a layer's colors (saturation, brightness, tint) for the weather; `env.c(hex)`, `env.rgb(hex)` and `env.rgba(hex, a)` do the same for single colors drawn every frame. Never grade twice: anything drawn after grading that should keep its own color (haze, water tint, lights) uses the raw color.
- `env.lit` (0 day to 1 night) is how many lights are on. Scenes draw windows, lamps and torches with it, after grading, so they glow. `env.night`, `env.rain`, `env.storm`, `env.wind` drive animals, fireflies, sway and wave height. `env.sun` is `{ x, y, kind }` (`'sun'`, `'moon'` or null) for glitter on water.
- `env.overlay(ctx, t)` is called by `background.js` after the scene draws: fog band, rain (or snow when the scene has `precip: 'snow'`), splash rings in the scene's `rainBand`, and the lightning flash. `env.poll(t, fire)` reports each strike so thunder follows the flash.

A scene module exports `{ id, name, signature, horizon, celestial, fog, rainBand, precip?, sounds, create(env) }`. `horizon` is where the sky meets the land; `celestial` is `{ sunX, sunHighY, sunLowY, moonX, moonY }`; `fog` and `rainBand` are `[y0, y1]` rows; `sounds` is `{ always, day, night }` (see "Scene sounds"). To add a scene: write it, add it to `SCENES` (and `CASUAL_SCENES` for Casual) in `background.js`, and add the id to `ENUMS.casualScene` in `settings.js`. `npm test` checks that it works in all seven weathers sound-wise; look at it in all seven by eye.

Lightning is deterministic: strike n of a variant falls at a time set by `rng(n)`, so the flash, the bolt and the thunder sound agree. Only `thunder` and `nightthunder` have strikes (about every 6.5 s and 5.5 s). Day scenes are the reference look; night and storm are made by grading, so a scene's daylight palette must stay readable when darkened (dark greens go black at night; that is intended).

Scene notes. Wheat: each stalk is a sprite (bent stem, ear of staggered kernels, awns on the top kernels) drawn once per size and sheared in memory into nine lean angles; the wind picks a lean per stalk each frame, and its strength follows `env.wind`. Castle: `wall()` and `roundTower()` take a `ground(x)` function and run every column down to the rock, so nothing floats; all left faces are lit by the sun at `SUN`; the lake is a flipped, darkened copy of the finished scene. Bamboo: `pathHalf(y)` is the half width of the path at row y, and `forestLayer` leaves out any stalk that would stand on it.

### Scene sounds

`ambience.js` plays background sounds that match the scene and its weather. Everything is synthesized (no audio files). A scene's `sounds` are `{ always, day, night }` layer-to-level maps, and `ambienceFor(scene, variant)` in `atmosphere.js` turns that into the mix: the `always` layers, plus `day` or `night` animals (hushed to 25 % in light rain, silent in a storm), plus rain (`rain` bed) or `storm` bed, plus `thunder` in stormy weather, plus wind by how hard the weather blows. Rain falling as snow (scenes with `precip: 'snow'`) plays no rain.

Three kinds of layer:
- Beds run all the time. Wind, waves, hum and city are live Web Audio graphs of filtered noise. Rain, storm, water and wheat are loops built by `ambience-synth.js`, because filtered noise alone sounds like static. Rain is a shower with droplets on top: the shower is thousands of tiny impacts a second (`addBand`: random-sized single samples through a two-pole lowpass and highpass), in three bands (a hiss, a patter in the middle, a far roar underneath), different in each ear, warm rather than a wall of hiss, and breathing slowly as gusts pass; the droplets are quiet unpitched ticks on stone (sharp), patters on leaves (softer) and drips with a short fixed-pitch ring, about 2 to 10 % of the shower's energy. There are deliberately no pitched or rising droplets: a drop that rises in pitch sounds like a bubble, and the first version's "soft drops" sounded like jelly. Keep impact sizes close together (big random sizes come out as pops) and rates high (sparse impacts in a band make it spiky). The storm is denser, louder and swells more, with more droplets in gusts; water is the same shower, lower and steadier, with a few splashes. Wheat is dry ticks where stalks touch, papery brushes where ears slide past and hollow stem knocks, in swells that cross the stereo field as each gust passes, with near silence between gusts. Each bed plays two loops of different lengths together so the pattern takes about a minute to repeat. Loops are built in 3 ms slices (`inSlices`) the first time a scene needs them (about 200 ms of work per rain loop, 50 to 90 ms for wheat) and shared afterwards.
- Calls are short sounds at random intervals: `birds`, `crickets`, `owl`, `gulls`, `chimes`, `traffic`.
- Flags do nothing alone. `thunder` turns on the thunder that follows lightning: `background.js` reports each strike through its `onStrike` hook, `main.js` calls `ambience.strike(distance)`, and a pre-built clap (three distances, two takes each; overhead claps have a sharp crack, far ones a long dull rumble) plays after `0.06 + distance * 2.4` s, like sound lagging a flash.

`background.js` reports each scene change through its `onScene` hook (`info.sounds`), and `main.js` passes it to `ambience.setScene()`. Every layer glides to its new level (about 1 s), so a layer two scenes share keeps playing. Beds are built when first needed and freed 8 s after they fade out. `renderAmbienceOffline(levels, seconds)` renders a mix for level checks.

Settings: `ambience` (SCENE SOUNDS toggle) and `ambienceVolume`, both in the AUDIO tab. Scene sounds also go silent when `background` is off or the tab is hidden.

### Soundtrack

Three original arrangements of Korobeiniki (the public-domain folk song behind the classic Tetris theme) in `tracks.js`. No commercial soundtrack is copied.

| Track | Key, tempo | Used for | Character |
|---|---|---|---|
| calm | C minor, 88 BPM, swung | Menu, Casual, 40 Lines | Reharmonized with 7th and 9th chords (Am9, Fmaj7, E7sus4, Dm9, Cmaj7, Bm7b5); bell melody, FM electric piano, lo-fi drums. The second pass adds runs and climbs an octave; the last pass adds a harmony line. |
| competitive | D minor, 150 BPM | Only when picked in the `soundtrack` setting | Octave-pumping bass, 16th arpeggios, four-on-the-floor drums, square/saw lead; the second pass goes up an octave with a harmony. |
| intense | E minor, 176 BPM | Blitz | Chugging 16th bass, stabs, syncopated kick; the bridge is in double time. |

`game.js` picks the track every frame (`updateMusic`): the mode's `MODE_INFO.track`. Every mode keeps one track for the whole run. Since the menu, Casual and 40 Lines all play calm, the song carries on unbroken from the menu into those games and back. Casual's calm track speeds up 1.2 % per level, up to 12 %. The `soundtrack` setting can force one track or turn it off. The menu plays calm. Pausing muffles and lowers the music.

`music.js` schedules whole bars 0.2 s ahead on the AudioContext clock, so tempo holds when frames drop. Each track has its own gain, compressor and tempo-synced delay. Switching tracks is a handoff, not a fade: the new track starts at full level exactly on the old track's next beat, and the old one is released over 0.12 s from that beat (`applyTrack`, `nextBeat`, `release`). The earlier 1.5 s exponential crossfade dropped to near silence in the middle, which sounded like a fade out followed by a fade in. Browsers block audio until a user gesture, so `main.js` calls `music.unlock()` on the first click or key. Levels were checked by rendering stems offline: full mix peaks near -8 dBFS at full volume, and the melody sits level with the backing.

To change a song, edit the bar builders in `tracks.js`. Events are `{ s, l, v, n, g }` on a 16-step bar; `npm test` checks their shape.

### Mobile and touch

`index.html` holds the buttons in `#touch-controls` (left, right, soft drop on the left; rotate left, rotate right, hold, hard drop on the right) and `#touch-pause`. Each has a `data-key` with a keyboard code. `touch.js` turns a press into the same `keydown` and `keyup` events a keyboard sends, dispatched on `document`, so `input.js` needs no touch code: a held button charges DAS and auto-repeats like a held key, and finesse and key counts work as before. Multi-touch works because each pointer is tracked on its own.

The `touchControls` setting (GAME tab) is auto, on or off. Auto shows the buttons when `(pointer: coarse)` matches. `touchControls.refresh()` sets the `touch-ui` class on `body`; CSS shows the buttons only while `#game-container` is not hidden, and menus cover them.

`fitGame()` in `main.js` scales the playfield. With `touch-ui` the side columns are narrower (design width 590 instead of 700) so the board is larger on a phone. In portrait (`touch-portrait` class) the playfield is pinned to the top and 176 px are kept free for the buttons; in landscape the buttons sit in the bottom corners beside the board. The page uses `100dvh`, `viewport-fit=cover` and safe-area insets, and blocks pinch zoom and overscroll.

`manifest.webmanifest` and `icon.svg` let a phone add the game to its home screen. There is no service worker, so it does not work offline.

### Deployment

`.github/workflows/pages.yml` runs on every push to `main`: `npm ci`, `npm test`, `npm run build`, then publishes only `index.html`, `style.css`, `game.js`, `icon.svg` and `manifest.webmanifest` to GitHub Pages. All paths in `index.html` are relative, so the site works under `/ulolTris/`. A new file the page needs at runtime must be added to the "Collect site files" step. The repo setting Pages > Source must be "GitHub Actions". Site: https://jcdc0.github.io/ulolTris/

### Menus

`menu.js` draws every menu in the style of Ace Combat: a row of slanted tabs, lists of wide slanted bars under it, and an info panel beside the list. One persistent `.ac` element inside `#menu-container`; `showScreen('main' | 'pause')` and `showResults(results)` fill it.

- **Main**: tabs PLAY, SETTINGS, CONTROLS, MUSIC. The list under the tab row previews what the tab holds. PLAY lists the modes; a mode opens a briefing (START, game style, scene for Casual, weather, next pieces, BACK). SETTINGS lists the settings tabs (HANDLING, AUDIO, VISUAL, FX, GAME) and RESET DEFAULTS (press twice). MUSIC has the music player and the soundtrack options.
- **Pause** and **results** have a banner (PAUSED, SPRINT COMPLETE, TIME'S UP, GAME OVER) and bars: pause has RESUME, RESTART, SETTINGS, QUIT TO MENU; results has RETRY, CHANGE MODE, SETTINGS, MAIN MENU, with the stats in the info panel. SETTINGS from these opens the same settings lists as a deeper step, and BACK returns.
- A screen is a stack of levels `{ title, nodes, index }`. A node has a `kind`: `menu` (opens `children()`), `action` (runs), `range`, `toggle`, `enum` (a setting, adjusted in place) or `info` (shown, not focusable). Focus is on the tab row (`state.focus === 'row'`) or in the list. A list at depth 1 or more ends in a BACK bar, which is also how touch users go back.
- Keys: up and down move, left and right adjust a value (shift steps five at a time) or change tab, Enter or Space confirms, Escape or Backspace goes back (and resumes from the pause root). The menu listens on `document` in the capture phase and stops the keys it handles, so the game's own handler never sees them: this is what stops Escape from resuming and pausing again in the same keypress.
- Mouse: hover focuses a bar, click confirms, the arrows step a value, and a gauge can be clicked or dragged. Touch uses the same clicks; gauges and arrows are large enough for a finger, and rows with controls take two lines on phones (name and value above the gauge).
- Values change through `setSetting(key, value)` from `main.js` (`applySetting`), which saves and does anything the change needs (soundtrack, sound pack preview, touch layout, background refresh). Rows update in place (`patchRow`) so a dragged gauge is not rebuilt under the finger; a structure change re-renders the list and replays the slide-in.
- `settings-defs.js` lists the settings tabs: per setting its key, label, kind, how its value reads and a hint for the info panel. `npm test` checks that every entry matches `settings.js` and that every setting has an entry. There is no DOM test of the menu itself: it was checked in the browser (keyboard, mouse, touch, desktop and phone size).
- Styles are the `ac-*` classes in `style.css`; rows are skewed with a pseudo element so the text stays upright. Pause and results (`.ac.over`) darken and blur the game behind them.

### Settings

`settings.js` holds `DEFAULT_SETTINGS`, per-key `CONSTRAINTS`, `normalizeSettings` (clamps and fills missing keys), and persistence to `localStorage` under `uloltris-settings`. Saves carry `version: 2`. `migrateSettings` converts version 1 saves (handling in milliseconds) to frames and resets SDF.

The settings object is one shared instance. `main.js` mutates it in place (reset uses `Object.assign`), and the game, input, sound, and music modules read it live. Never replace it with a new object. To add a setting: add the default and constraint (or boolean check, or enum) in `settings.js`, add an entry with a hint to `SETTINGS_TABS` in `settings-defs.js`, and if the change has to take effect at once, handle it in `applySetting()` in `main.js`.

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

Scenes, scene sounds and music, done on 2026-09-30 (versions 1.4.0 and 1.4.1): wheat, castle and bamboo scenes redrawn; three new Casual scenes (sakura, aurora, falls); synthesized scene sounds with a toggle and volume; gapless track handoff; Casual and 40 Lines on calm, Blitz on intense, no mid-run switch; bell "bling" for the default Tetris clear. Checked in a browser: every scene was rendered and looked at, each builds in under 35 ms and draws in about 1 ms or less, and ambience levels were measured offline (scene mixes sit 5 to 20 dB under the soundtrack's RMS). Nothing here was listened to by a person.

Mobile and GitHub Pages, done on 2026-09-30 (version 1.5.0): touch buttons, a narrower touch layout, small-screen menu styles, a web manifest and icon, and the Pages workflow. Checked in the browser pane at 375 x 812 (portrait) and 812 x 375 (landscape): the board, HUD and buttons fit, and the buttons moved, rotated, dropped and paused a real game. Not checked: a real phone (thumb reach, latency, iOS Safari audio unlock with three AudioContexts), and the workflow itself, which has not run yet.

Weather and scene sounds, done on 2026-10-01 (version 1.6.0): every scene in seven weathers (see "Weather"), with a shared sky, grading, rain, snow, fog and lightning; rain, storm, water and wheat rebuilt from a shower with droplets on top, and stalks, instead of noise; thunder that follows each lightning strike. Checked in a browser: all 77 scene and weather combinations build without errors (17 to 110 ms) and draw in under 1.6 ms a frame; a real AudioContext plays the rain and a clap adds 6 dB of peak on top of it; synth loops measured offline (peaky, uneven, steady level). Nothing was listened to by a person: levels are set by measurement, and the rain and wheat beds in particular need a listen. Version 1.6.1 rebuilt the rain after a listener said the first version's drops sounded like falling jelly orbs: the pitched soft drops were removed, the shower became the main sound, and the droplets became subtle ticks.

Menus, done on 2026-10-01 (version 1.7.0): the Ace Combat style bar menus replace the old buttons, cards and settings panel (see "Menus"). Checked in the browser pane: keyboard through main, settings, briefing, game, pause, resume, game over, retry and change mode; the weather preview while choosing it; at 375 x 812 with taps for tabs, lists, start, pause and resume. Not checked: mouse dragging a gauge and hover (no mouse pointer in the pane), gamepads (not supported), a real phone.

Next steps, in order:
0. Try the game on a real phone and tune button size and placement. Consider PNG icons (iOS ignores SVG for the home screen icon) and a service worker for offline play.
1. Listen and tune the soundtrack, the two sound packs, the scene sounds and the new Tetris "bling" by ear. They were balanced by measurement, not by listening.
2. Incoming garbage: a training opponent or garbage timer that sends lines back, with a red incoming-garbage meter beside the board (Tetris 99 and Puyo Puyo Tetris both show one). Attack is already calculated, and the progress meter between the board and the next queue is where an incoming meter would go.
3. Fonts load from Google Fonts. Offline, the page falls back to system fonts. Self-host the two fonts (both under the SIL Open Font License) if the game should look the same offline.
4. A quick-retry key (TETR.IO uses R) wired to the menu's restart.
5. Offer TETR.IO's attack table as an option for the Modern style (it differs from the guideline table in combos and perfect clears).
6. Confirm against the live TETR.IO client: the handling ranges and defaults above came from memory of the TETR.IO settings screen and from the TETR.IO FAQ, not from reading the client. Also confirm whether DCD applies after hold and after a hard drop, and whether the carried DAS charge also applies when releasing back to the older key.
7. Consider TETR.IO's "prevent accidental hard drops" option and IRS/IHS (initial rotation and hold), which are not implemented.
8. Keybinds are hard-coded in `input.js` (`GAME_KEYS` and the switch). A remapping UI would need a keybind setting and a lookup table.
9. Gravity drops at most one cell per frame (`update()` in `game.js`), so gravity faster than 1 G is capped. Casual tops out at 50 ms per cell, so this does not show yet.
10. The handling sliders step by 0.1 F. Check whether TETR.IO uses the same step.
