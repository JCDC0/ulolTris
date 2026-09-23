/**
 * game.js - Core game engine
 * Orchestrates the game loop, piece logic, scoring, effects, and mode state.
 */

import { COLS, BUFFER_ROWS, VISIBLE_ROWS, SHAPES, getNextPiece, fillQueue, getSpawnPos, tryRotate } from './piece.js';
import { createMatrix, collide, merge, clearLines, isGrounded, getGhostY } from './board.js';
import { createScoringState, detectTSpin, calculateScore, getSoundEvent } from './scoring.js';
import { createParticleSystem } from './particles.js';
import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';
import { createModeState } from './modes.js';

/**
 * Create and run a game instance.
 *
 * @param {Object} config
 *   - modeId: string ('sprint' | 'blitz' | 'classic')
 *   - canvases: { board, hold, next }
 *   - settings: settings reference object
 *   - soundEngine: sound engine (or null)
 *   - onGameOver: (results) => void
 *   - onPause: () => void
 */
export function createGame(config) {
    const { modeId, canvases, settings, soundEngine, onGameOver, onPause } = config;

    // State
    const arena = createMatrix(COLS, BUFFER_ROWS);
    const nextQueue = [];
    fillQueue(nextQueue);

    const modeState = createModeState(modeId);
    const scoringState = createScoringState();
    const particles = createParticleSystem(settings);
    const renderer = createRenderer(canvases, settings);

    // Resize next canvas based on settings
    renderer.resizeNextCanvas(settings.nextPreviewCount || 5);

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

    // Input handler
    const input = createInputHandler(settings, {
        onMove(dir, cells) { return playerMove(dir, cells); },
        onSoftDrop(cells)  { return softDrop(cells); },
        getGravityInterval() { return dropInterval; },
        onHardDrop()  { hardDrop(); },
        onRotateCW()  { playerRotate(1); },
        onRotateCCW() { playerRotate(-1); },
        onHold()      { holdPiece(); },
        onPause()     { if (running && !modeState.isFinished()) pauseGame(); },
        onRetry()     { /* handled by menu */ },
    });

    // --- Piece Spawning ---
    function spawnPiece() {
        player.shape = getNextPiece(nextQueue);
        player.matrix = SHAPES[player.shape].matrix;
        player.rotation = 0;
        const spawn = getSpawnPos(player.matrix);
        player.pos.x = spawn.x;
        player.pos.y = spawn.y;
        player.canHold = true;
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
        }
        return moved;
    }

    function playerRotate(dir) {
        const result = tryRotate(player, arena, collide, dir);
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
        let dropped = 0;
        while (dropped < cells && !playerDrop()) {
            dropped++;
        }
        if (dropped > 0) {
            modeState.addScore(dropped);
            playSound('softdrop');
        }
        return dropped;
    }

    function hardDrop() {
        let rows = 0;
        while (!playerDrop()) {
            rows++;
        }
        modeState.addScore(rows * 2);
        playSound('harddrop');
        lockPiece();
    }

    function holdPiece() {
        if (!player.canHold) return;

        if (player.held === null) {
            player.held = player.shape;
            spawnPiece();
        } else {
            const temp = player.shape;
            player.shape = player.held;
            player.held = temp;
            player.matrix = SHAPES[player.shape].matrix;
            player.rotation = 0;
            const spawn = getSpawnPos(player.matrix);
            player.pos.x = spawn.x;
            player.pos.y = spawn.y;
            input.cutDas();
        }
        player.canHold = false;
        dropCounter = 0;
        lockTimer = 0;
        lockMoves = 0;
        lastWasRotation = false;
        lastKickIndex = -1;
        playSound('hold');
    }

    function resetLockTimer() {
        if (isGrounded(arena, player)) {
            lockMoves++;
            if (lockMoves < MAX_LOCK_MOVES) {
                lockTimer = 0;
            }
        }
    }

    // --- Piece Locking ---
    function lockPiece() {
        // Snapshot for T-spin detection
        const tSpinType = detectTSpin(arena, player, lastWasRotation, lastKickIndex);

        // Snapshot arena rows before merge (for particle colors)
        const arenaSnapshot = arena.map(row => [...row]);

        // Merge piece into arena
        merge(arena, player);
        modeState.addPiece();

        // Spawn placement particles
        particles.spawnPlacement({
            shape: player.shape,
            matrix: player.matrix.map(row => [...row]),
            pos: { ...player.pos },
        });

        // Clear lines
        const { linesCleared, clearedRows } = clearLines(arena);

        // Calculate score
        const scoreResult = calculateScore(
            linesCleared, tSpinType, scoringState,
            modeState.stats.level, arena
        );

        // Apply score
        if (scoreResult.points > 0) {
            modeState.addScore(scoreResult.points);
        }

        // Update mode stats
        if (linesCleared > 0) {
            modeState.addLines(linesCleared);
            dropInterval = modeState.getDropInterval();
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

        // Action text
        particles.addActionsFromResult(scoreResult, clearedRows);

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

        // Check mode completion
        if (modeState.isCompleted()) {
            endGame();
            return;
        }

        // Spawn next piece
        spawnPiece();
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

        // Gravity
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
            dropCounter = 0;
        }

        // Lock delay
        if (isGrounded(arena, player)) {
            lockTimer += deltaTime;
            const lockDelay = settings.lockDelay || 500;
            if (lockTimer >= lockDelay) {
                lockPiece();
            }
        } else {
            lockTimer = 0;
        }

        // Update particles
        particles.update(deltaTime);

        // Render
        const ghostY = getGhostY(arena, player);
        renderer.draw({
            arena,
            player,
            nextQueue,
            held: player.held,
            particles,
            shake: particles.getShake(),
            ghostY,
        });

        // Update HUD
        updateHUD();

        animFrameId = requestAnimationFrame(update);
    }

    function updateHUD() {
        const scoreEl = document.getElementById('score-display');
        const linesEl = document.getElementById('lines-display');
        const levelEl = document.getElementById('level-display');
        const timerEl = document.getElementById('timer-display');

        if (scoreEl) {
            if (modeId === 'sprint') {
                // Sprint: show lines remaining instead of score
                scoreEl.textContent = Math.max(0, 40 - modeState.stats.linesCleared);
                const label = scoreEl.previousElementSibling;
                if (label) label.textContent = 'LINES LEFT';
            } else {
                scoreEl.textContent = modeState.stats.score.toLocaleString();
                const label = scoreEl.previousElementSibling;
                if (label) label.textContent = 'SCORE';
            }
        }
        if (linesEl) linesEl.textContent = modeState.stats.linesCleared;
        if (levelEl) levelEl.textContent = modeState.stats.level;

        if (timerEl) {
            timerEl.textContent = modeState.getTimerDisplay();
            if (modeState.isCountdown()) {
                const sec = modeState.getRemainingSeconds();
                timerEl.classList.toggle('timer-urgent', sec !== null && sec <= 10);
            }
        }
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
        fillQueue(nextQueue);

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

        dropInterval = modeState.getDropInterval();
        renderer.resizeNextCanvas(settings.nextPreviewCount || 5);

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
        if (onPause) onPause();
    }

    function resumeGame() {
        if (!running) return;
        paused = false;
        lastTime = performance.now();
        modeState.resume();
        input.setEnabled(true);
        input.resetState();
    }

    function endGame() {
        running = false;
        input.setEnabled(false);

        // Let particles finish rendering briefly, then show results
        setTimeout(() => {
            if (onGameOver) {
                onGameOver(modeState.getResults());
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
    }

    return {
        start: startGame,
        pause: pauseGame,
        resume: resumeGame,
        restart: startGame,
        destroy,
        isRunning() { return running; },
        isPaused() { return paused; },
    };
}
