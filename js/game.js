/**
 * game.js - Core game engine
 * Orchestrates the game loop, piece logic, scoring, effects, and mode state.
 */

import { COLS, BUFFER_ROWS, VISIBLE_ROWS, SHAPES, fillQueue, getSpawnPos, tryRotate } from './piece.js';
import { createMatrix, collide, merge, clearLines, isGrounded, getGhostY } from './board.js';
import { createScoringState, detectTSpin, calculateScore, calculateAttack, getSoundEvent } from './scoring.js';
import { createParticleSystem } from './particles.js';
import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';
import { createModeState, getRules, GAME_STYLES, BIG_HIT_LINES, MODE_INFO } from './modes.js';
import { classicMatrix, getClassicSpawnPos, tryRotateClassic, fillClassicQueue,
         calculateClassicScore, NES_FRAME_MS, SOFT_DROP_FRAMES } from './classic.js';
import { createHud } from './hud.js';
import { createBoardBounce } from './bounce.js';
import { minimumInputs } from './finesse.js';

const BLITZ_MS = 120000;
const SPRINT_LINES = 40;

/** The warning starts when blocks reach this many rows from the top. */
const DANGER_ROWS = 4;
const DANGER_INTERVAL_MS = 1000;

/**
 * Create and run a game instance.
 *
 * @param {Object} config
 *   - modeId: string ('sprint' | 'blitz' | 'classic' | 'og'); 'classic' is Casual, 'og' is Classic
 *   - canvases: { board, hold, next }
 *   - playfield: element that bounces (board, hold and next)
 *   - settings: settings reference object
 *   - soundEngine: sound engine (or null)
 *   - music: music engine (or null)
 *   - onGameOver: (results) => void
 *   - onPause: () => void
 *   - onLevelUp: (level) => void (optional)
 */
export function createGame(config) {
    const { modeId, canvases, playfield, settings, soundEngine, music, onGameOver, onPause, onLevelUp } = config;
    const rules = getRules(modeId);
    const previewCount = () => rules.previewCount ?? (settings.nextPreviewCount || 5);

    // State
    const arena = createMatrix(COLS, BUFFER_ROWS);
    const nextQueue = [];
    let lastShape = null;       // the piece in play, for the classic randomizer
    fillNext();

    const modeState = createModeState(modeId, { startLevel: settings.classicStartLevel });
    const scoringState = createScoringState();
    const particles = createParticleSystem(settings);
    const renderer = createRenderer(canvases, settings, rules.look);
    const hud = createHud(settings, modeId);
    const bounce = createBoardBounce(playfield, settings);
    let finesseJudged = 0;
    let finesseFaults = 0;

    // Resize next canvas based on settings
    renderer.resizeNextCanvas(previewCount());

    const player = {
        pos: { x: 0, y: 0 },
        matrix: null,
        shape: null,
        rotation: 0,
        held: null,
        canHold: true,
    };

    let dropCounter = 0;
    let dropInterval = modeState.getDropInterval();
    let lastTime = 0;
    let lockTimer = 0;
    let lockMoves = 0;
    const MAX_LOCK_MOVES = 15;

    let running = false;
    let paused = false;
    let animFrameId = null;

    // Track last rotation for T-spin detection
    let lastWasRotation = false;
    let lastKickIndex = -1;

    // Blitz countdown tick tracking
    let lastCountdownSecond = -1;

    // Game style, and the wait between a lock and the next piece
    const style = GAME_STYLES[rules.style || settings.gameStyle] || GAME_STYLES.modern;
    let active = false;         // a piece is in play
    let freezeTimer = 0;        // ms until the next piece spawns
    let flash = null;           // { arena, rows, duration, elapsed } during a line clear pause

    // Danger warning
    let inDanger = false;
    let dangerTimer = 0;

    // Input handler
    const input = createInputHandler(settings, {
        onMove(dir, cells) { return playerMove(dir, cells); },
        onSoftDrop(cells)  { return softDrop(cells); },
        getGravityInterval() { return dropInterval; },
        // Classic soft drop is a fixed speed (never slower than gravity), not the SDF setting
        getSoftDropInterval: rules.lock === 'gravity'
            ? () => Math.min(dropInterval, SOFT_DROP_FRAMES * NES_FRAME_MS)
            : undefined,
        onHardDrop()  { hardDrop(); },
        onRotateCW()  { playerRotate(1); },
        onRotateCCW() { playerRotate(-1); },
        onHold()      { holdPiece(); },
        onPause()     { if (running && !modeState.isFinished()) pauseGame(); },
    });

    // --- Piece Spawning ---
    function fillNext() {
        if (rules.randomizer === 'classic') fillClassicQueue(nextQueue, lastShape);
        else fillQueue(nextQueue);
    }

    /** Put the current piece in its spawn orientation and position. */
    function placeAtSpawn() {
        player.matrix = rules.rotation === 'classic' ? classicMatrix(player.shape) : SHAPES[player.shape].matrix;
        player.rotation = 0;
        const spawn = rules.spawn === 'inside' ? getClassicSpawnPos(player.matrix) : getSpawnPos(player.matrix);
        player.pos.x = spawn.x;
        player.pos.y = spawn.y;
    }

    function spawnPiece() {
        fillNext();
        player.shape = nextQueue.shift();
        lastShape = player.shape;
        placeAtSpawn();
        player.canHold = true;
        active = true;
        flash = null;
        lastWasRotation = false;
        lastKickIndex = -1;
        lockTimer = 0;
        lockMoves = 0;
        dropCounter = 0;
        input.cutDas();

        // Check top-out
        if (collide(arena, player)) {
            modeState.setGameOver();
            playSound('gameOver');
            endGame();
        }
    }

    // --- Movement ---
    function playerMove(dir, cells = 1) {
        if (!active) return 0;
        let moved = 0;
        while (moved < cells && moved < COLS) {
            player.pos.x += dir;
            if (collide(arena, player)) {
                player.pos.x -= dir;
                break;
            }
            moved++;
        }
        if (moved > 0) {
            lastWasRotation = false;
            resetLockTimer();
            playSound('move');
            // A long slide that stops at a wall knocks the board sideways
            if (moved < cells && moved >= 3) bounce.kick(dir * (30 + moved * 12), 0);
        }
        return moved;
    }

    function playerRotate(dir) {
        if (!active) return;
        const result = (rules.rotation === 'classic' ? tryRotateClassic : tryRotate)(player, arena, collide, dir);
        if (result.success) {
            lastWasRotation = true;
            lastKickIndex = result.kickIndex;
            resetLockTimer();
            input.cutDas();
            playSound('rotate');
        }
    }

    function playerDrop() {
        player.pos.y++;
        if (collide(arena, player)) {
            player.pos.y--;
            return true; // hit
        }
        dropCounter = 0;
        lastWasRotation = false;
        return false;
    }

    function softDrop(cells = 1) {
        if (!active) return 0;
        let dropped = 0;
        while (dropped < cells && !playerDrop()) {
            dropped++;
        }
        if (dropped > 0) {
            modeState.addScore(dropped);
            playSound('softdrop');
        } else if (rules.lock === 'gravity') {
            // Holding down on a resting piece locks it at once
            lockPiece();
        }
        return dropped;
    }

    function hardDrop() {
        if (!active || !rules.hardDrop) return;
        let rows = 0;
        while (!playerDrop()) {
            rows++;
        }
        modeState.addScore(rows * 2);
        playSound('harddrop');
        bounce.kick(0, 50 + Math.min(rows, 20) * 6);
        lockPiece(rows);
    }

    function holdPiece() {
        if (!active || !rules.hold || !player.canHold) return;

        if (player.held === null) {
            player.held = player.shape;
            spawnPiece();
        } else {
            const temp = player.shape;
            player.shape = player.held;
            player.held = temp;
            placeAtSpawn();
            input.cutDas();
        }
        input.resetPieceInputs();
        player.canHold = false;
        dropCounter = 0;
        lockTimer = 0;
        lockMoves = 0;
        lastWasRotation = false;
        lastKickIndex = -1;
        playSound('hold');
    }

    function resetLockTimer() {
        if (rules.lock === 'gravity') return;
        if (isGrounded(arena, player)) {
            lockMoves++;
            if (lockMoves < MAX_LOCK_MOVES) {
                lockTimer = 0;
            }
        }
    }

    // --- Piece Locking ---
    function lockPiece(dropRows = 0) {
        // Lock out: a piece that locks entirely above the field ends the game
        const lockedOut = player.matrix.every((row, y) =>
            row.every(v => !v || player.pos.y + y < BUFFER_ROWS - VISIBLE_ROWS));

        // Finesse: compare inputs with the fewest that reach this placement
        const used = input.takePieceInputs();
        if (rules.finesse && !used.softDrop) {
            const min = minimumInputs(player.shape, player.matrix, player.pos.x);
            if (min !== null) {
                finesseJudged++;
                if (used.inputs > min) finesseFaults++;
            }
        }

        // Snapshot for T-spin detection
        const tSpinType = rules.scoring === 'modern'
            ? detectTSpin(arena, player, lastWasRotation, lastKickIndex)
            : 'none';

        // Snapshot arena rows before merge (for particle colors)
        const arenaSnapshot = arena.map(row => [...row]);

        // Merge piece into arena
        merge(arena, player);
        modeState.addPiece();
        const lockedArena = arena.map(row => [...row]);

        if (rules.effects) {
            particles.spawnPlacement({
                shape: player.shape,
                matrix: player.matrix.map(row => [...row]),
                pos: { ...player.pos },
            }, dropRows);
        }
        // A held down key must not carry over to the next piece in Classic
        if (rules.lock === 'gravity') input.cancelSoftDrop();

        if (lockedOut) {
            modeState.setGameOver();
            playSound('gameOver');
            endGame();
            return;
        }

        // Clear lines
        const { linesCleared, clearedRows } = clearLines(arena);

        // Calculate score
        const scoreResult = rules.scoring === 'classic'
            ? calculateClassicScore(linesCleared, modeState.stats.level)
            : calculateScore(linesCleared, tSpinType, scoringState, modeState.stats.level, arena);

        // Apply score
        if (scoreResult.points > 0) {
            modeState.addScore(scoreResult.points);
        }

        // Update mode stats
        if (linesCleared > 0) {
            const levelBefore = modeState.stats.level;
            modeState.addLines(linesCleared);
            dropInterval = modeState.getDropInterval();
            if (modeState.stats.level > levelBefore) {
                playSound('levelUp');
                onLevelUp?.(modeState.stats.level);
            }
        }

        if (scoreResult.action && scoreResult.action.startsWith('tspin')) {
            modeState.addTSpin();
        }
        if (scoreResult.action === 'tetris') {
            modeState.addTetris();
        }
        if (scoreResult.combo > 0) {
            modeState.updateCombo(scoreResult.combo);
        }
        if (scoreResult.perfectClear) {
            modeState.addPerfectClear();
        }

        // Spawn effects
        if (rules.effects) {
            if (linesCleared > 0) {
                particles.spawnLineClear(clearedRows, scoreResult.action, arenaSnapshot);
            }
            if (tSpinType !== 'none' && linesCleared > 0) {
                particles.spawnTSpin(player.pos);
            }
            if (scoreResult.b2b) {
                particles.spawnB2B(clearedRows);
            }
            if (scoreResult.perfectClear) {
                particles.spawnPerfectClear();
            }
        }

        // Play sounds
        const soundEvent = getSoundEvent(scoreResult);
        if (soundEvent) {
            playSound(soundEvent);
        } else if (linesCleared === 0) {
            playSound('lock');
        }

        // Combo sound (overlaps with clear sound)
        if (scoreResult.combo > 0) {
            playSound('combo', scoreResult.combo);
        }
        if (scoreResult.b2b) {
            playSound('b2b');
        }

        // Attack: the garbage this clear sends
        const attack = rules.attack ? calculateAttack(scoreResult) : 0;
        if (attack > 0) {
            modeState.addAttack(attack);
            particles.spawnAttack(clearedRows, attack);
            playSound('attack', attack);
        }
        if (scoreResult.action || scoreResult.perfectClear) hud.onClear({ ...scoreResult, attack });
        if (rules.effects && linesCleared > 0) bounce.kick(0, 60 + linesCleared * 45 + attack * 10);

        updateDanger();

        // Check mode completion
        if (modeState.isCompleted()) {
            endGame();
            return;
        }

        // Next piece: at once (modern), or after the clear pause and entry delay (battle)
        const clearDelay = linesCleared === 0 ? 0
            : attack >= BIG_HIT_LINES ? style.bigHitDelay : style.lineClearDelay;
        const wait = clearDelay + style.entryDelay;
        if (wait > 0) {
            active = false;
            freezeTimer = wait;
            flash = clearDelay > 0
                ? { arena: lockedArena, rows: clearedRows, duration: clearDelay, elapsed: 0, big: linesCleared >= 4 }
                : null;
        } else {
            spawnPiece();
        }
    }

    function updateDanger() {
        if (!rules.danger) return;
        const top = arena.findIndex(row => row.some(v => v !== 0));
        const danger = top !== -1 && top < BUFFER_ROWS - VISIBLE_ROWS + DANGER_ROWS;
        if (danger && !inDanger) dangerTimer = 0;
        inDanger = danger;
        canvases.board.classList.toggle('board-danger', inDanger);
    }

    function updateMusic() {
        if (!music) return;
        const choice = settings.soundtrack || 'auto';
        if (choice === 'off') {
            music.setTrack(null);
            return;
        }
        const heated = choice === 'auto' && modeState.isHeated();
        music.setTrack(heated ? 'intense' : choice === 'auto' ? MODE_INFO[modeId].track : choice);
        // Classic's calm track picks up a little with each level until it turns intense.
        const levelBoost = modeId === 'classic' && !heated ? (modeState.stats.level - 1) * 0.012 : 0;
        music.setTempoScale(1 + Math.min(levelBoost, 0.12));
    }

    // --- Game Loop ---
    function update(time = 0) {
        if (!running) return;

        const deltaTime = time - lastTime;
        lastTime = time;

        if (paused || modeState.isFinished()) {
            animFrameId = requestAnimationFrame(update);
            return;
        }

        // Update input auto-repeat
        input.update(time);

        // Update mode timer
        modeState.updateTimer();
        updateMusic();

        if (inDanger) {
            dangerTimer -= deltaTime;
            if (dangerTimer <= 0) {
                playSound('danger');
                dangerTimer = DANGER_INTERVAL_MS;
            }
        }

        // Blitz countdown tick sound
        if (modeState.isCountdown()) {
            const sec = modeState.getRemainingSeconds();
            if (sec !== null && sec <= 10 && sec !== lastCountdownSecond && sec > 0) {
                lastCountdownSecond = sec;
                playSound('countdownTick');
            }
            if (sec === 0 && lastCountdownSecond !== 0) {
                lastCountdownSecond = 0;
                // Time expired
                if (modeState.isCompleted()) {
                    endGame();
                    animFrameId = requestAnimationFrame(update);
                    return;
                }
            }
        }

        if (active) {
            // Gravity
            dropCounter += deltaTime;
            if (dropCounter >= dropInterval - 1) {
                // Carry the remainder so gravity keeps its pace at any refresh rate
                const carry = dropCounter - dropInterval;
                playerDrop();
                dropCounter = Math.min(Math.max(carry, 0), dropInterval);
            }

            // Lock delay
            if (isGrounded(arena, player)) {
                lockTimer += deltaTime;
                const lockDelay = rules.lock === 'gravity' ? dropInterval : (settings.lockDelay || 500);
                if (lockTimer >= lockDelay) {
                    lockPiece();
                }
            } else {
                lockTimer = 0;
            }
        } else if (running) {
            // Battle style pause after a lock
            freezeTimer -= deltaTime;
            if (flash) {
                flash.elapsed += deltaTime;
                if (flash.elapsed >= flash.duration) flash = null;
            }
            if (freezeTimer <= 0) spawnPiece();
        }

        particles.update(deltaTime);
        bounce.update(deltaTime);

        // Render
        const ghostY = active && rules.ghost ? getGhostY(arena, player) : undefined;
        renderer.draw({
            arena: flash ? flash.arena : arena,
            player: active ? player : null,
            flash: flash ? { rows: flash.rows, progress: flash.elapsed / flash.duration } : null,
            level: modeState.stats.level,
            nextQueue,
            held: player.held,
            holdLocked: !player.canHold,
            danger: inDanger,
            time,
            particles,
            shake: particles.getShake(),
            ghostY,
        });

        // Update HUD
        updateHUD();

        animFrameId = requestAnimationFrame(update);
    }

    function updateHUD() {
        const elapsed = modeState.getElapsedMs();
        const stats = modeState.stats;
        const remaining = BLITZ_MS - elapsed;
        hud.update({
            pieces: stats.piecesPlaced,
            lines: stats.linesCleared,
            level: stats.level,
            keys: input.getKeyCount(),
            linesSent: stats.linesSent,
            elapsedMs: elapsed,
            clockMs: modeId === 'blitz' ? remaining : elapsed,
            urgent: modeId === 'blitz' && remaining <= 10000,
            primaryLabel: modeState.getPrimaryStatLabel(),
            primaryValue: modeState.getPrimaryStatValue(),
            tetrises: stats.tetrises,
            progress: modeId === 'sprint' ? stats.linesCleared / SPRINT_LINES
                : modeId === 'blitz' ? remaining / BLITZ_MS
                : modeState.getLevelProgress(),
            finesseJudged,
            finesseFaults,
        });
    }

    function playSound(name, ...args) {
        if (soundEngine) {
            soundEngine.play(name, ...args);
        }
    }

    // --- Game Control ---
    function startGame() {
        // Reset arena
        arena.forEach(row => row.fill(0));
        nextQueue.length = 0;
        lastShape = null;
        fillNext();

        // Reset player
        player.held = null;
        player.canHold = true;

        // Reset state
        modeState.reset();
        scoringState.combo = -1;
        scoringState.b2b = -1;
        scoringState.lastClearWasDifficult = false;
        particles.clear();

        dropCounter = 0;
        lockTimer = 0;
        lockMoves = 0;
        lastTime = performance.now();
        lastCountdownSecond = -1;
        active = false;
        freezeTimer = 0;
        flash = null;
        inDanger = false;
        canvases.board.classList.remove('board-danger');
        finesseJudged = 0;
        finesseFaults = 0;
        hud.reset();
        bounce.reset();
        input.resetCounts();

        dropInterval = modeState.getDropInterval();
        renderer.resizeNextCanvas(previewCount());
        soundEngine?.setPack?.(rules.soundPack);

        // Spawn first piece
        spawnPiece();

        // Start mode timer
        modeState.start();
        running = true;
        paused = false;

        input.setEnabled(true);
        input.resetState();

        // Countdown "Go!" sound
        playSound('countdownGo');

        animFrameId = requestAnimationFrame(update);
    }

    function pauseGame() {
        if (!running || modeState.isFinished()) return;
        paused = true;
        modeState.pause();
        input.setEnabled(false);
        music?.setPaused(true);
        if (onPause) onPause();
    }

    function resumeGame() {
        if (!running) return;
        paused = false;
        lastTime = performance.now();
        modeState.resume();
        input.setEnabled(true);
        input.resetState();
        music?.setPaused(false);
    }

    function endGame() {
        running = false;
        input.setEnabled(false);
        canvases.board.classList.remove('board-danger');

        // Let particles finish rendering briefly, then show results
        setTimeout(() => {
            if (onGameOver) {
                const results = modeState.getResults();
                const sec = modeState.getElapsedMs() / 1000;
                results.pps = sec > 0 ? results.piecesPlaced / sec : 0;
                results.finesse = finesseJudged > 0 ? ((finesseJudged - finesseFaults) / finesseJudged) * 100 : 100;
                results.finesseFaults = finesseFaults;
                onGameOver(results);
            }
        }, modeState.isCompleted() ? 800 : 400);
    }

    function destroy() {
        running = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
        }
        input.destroy();
        particles.clear();
        bounce.reset();
        music?.setPaused(false);
        soundEngine?.setPack?.(null);
        canvases.board.classList.remove('board-danger');
    }

    return {
        start: startGame,
        pause: pauseGame,
        resume: resumeGame,
        destroy,
        isRunning() { return running; },
    };
}
