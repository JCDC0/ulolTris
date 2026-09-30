/**
 * modes.js - Game mode definitions for Sprint, Blitz, and Classic
 */

import { createStopwatch, createCountdown } from './timer.js';

/**
 * Mode IDs
 */
export const MODE_SPRINT = 'sprint';
export const MODE_BLITZ = 'blitz';
export const MODE_CLASSIC = 'classic';

const BLITZ_MS = 120000;

/**
 * Game styles. Modern plays like TETR.IO and Jstris: the next piece appears the moment
 * one locks. Battle plays like Tetris 99 and Puyo Puyo Tetris: line clears pause the
 * game (longer for hits that send 4 or more lines) and each piece waits a short entry
 * delay (ARE). Delays are in milliseconds.
 */
export const GAME_STYLES = {
    modern: { name: 'MODERN', lineClearDelay: 0,   bigHitDelay: 0,    entryDelay: 0 },
    battle: { name: 'BATTLE', lineClearDelay: 500, bigHitDelay: 1000, entryDelay: 117 },
};

/** Attack at or above this many lines counts as a big hit. */
export const BIG_HIT_LINES = 4;

/**
 * Mode display info for the mode select menu.
 */
export const MODE_INFO = {
    [MODE_SPRINT]: {
        name: '40 LINES',
        subtitle: 'SPRINT',
        description: 'Clear 40 lines as fast as possible.',
        music: 'casual',
        icon: '\u23F1',
    },
    [MODE_BLITZ]: {
        name: 'BLITZ',
        subtitle: '2 MINUTES',
        description: 'Score as many points as you can before time runs out.',
        music: 'intense',
        icon: '\u26A1',
    },
    [MODE_CLASSIC]: {
        name: 'CASUAL',
        subtitle: 'ENDLESS',
        description: 'Relaxed endless play. Gravity rises and the scenery changes as you level up.',
        music: 'casual',
        icon: '\u221E',
    },
};

/**
 * Calculate gravity drop interval for a given level.
 * Returns milliseconds between automatic drops.
 */
export function getGravityInterval(level) {
    // Tetr.io-style gravity curve
    return Math.max(50, 1000 - (level - 1) * 90);
}

/**
 * Create a mode-specific game state tracker.
 *
 * @param {string} modeId - One of MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC
 * @returns {Object} Mode state with timer, win/loss checks, and stat tracking
 */
export function createModeState(modeId) {
    const stats = {
        linesCleared: 0,
        score: 0,
        level: 1,
        piecesPlaced: 0,
        tSpins: 0,
        tetrises: 0,
        maxCombo: 0,
        perfectClears: 0,
        linesSent: 0,
        startTime: 0,
    };

    let timer = null;
    let goalLines = 0;
    let completed = false;
    let gameOver = false;

    switch (modeId) {
        case MODE_SPRINT:
            timer = createStopwatch();
            goalLines = 40;
            break;
        case MODE_BLITZ:
            timer = createCountdown(BLITZ_MS);
            break;
        case MODE_CLASSIC:
            timer = createStopwatch(); // Track play time
            break;
    }

    return {
        modeId,
        stats,

        /** Start the mode timer */
        start() {
            stats.startTime = performance.now();
            if (timer) timer.start();
        },

        /** Pause the mode timer */
        pause() {
            if (timer) timer.pause();
        },

        /** Resume the mode timer */
        resume() {
            if (timer) timer.resume();
        },

        /** Reset everything */
        reset() {
            stats.linesCleared = 0;
            stats.score = 0;
            stats.level = 1;
            stats.piecesPlaced = 0;
            stats.tSpins = 0;
            stats.tetrises = 0;
            stats.maxCombo = 0;
            stats.perfectClears = 0;
            stats.linesSent = 0;
            stats.startTime = 0;
            completed = false;
            gameOver = false;
            if (timer) timer.reset();
        },

        /** Update the timer. Call each frame. */
        updateTimer() {
            if (!timer) return;
            timer.update();

            // Blitz: check if time expired
            if (modeId === MODE_BLITZ && timer.isExpired && timer.isExpired()) {
                completed = true;
            }
        },

        /** Record lines cleared and update stats */
        addLines(count) {
            stats.linesCleared += count;

            // Level up every 10 lines
            if (modeId === MODE_CLASSIC || modeId === MODE_BLITZ) {
                stats.level = Math.floor(stats.linesCleared / 10) + 1;
            }

            // Sprint: check if goal reached
            if (modeId === MODE_SPRINT && stats.linesCleared >= goalLines) {
                completed = true;
                if (timer) timer.pause();
            }
        },

        /** Add score points */
        addScore(points) {
            stats.score += points;
        },

        /** Record a piece placement */
        addPiece() {
            stats.piecesPlaced++;
        },

        /** Record a T-spin */
        addTSpin() {
            stats.tSpins++;
        },

        /** Record a Tetris */
        addTetris() {
            stats.tetrises++;
        },

        /** Update max combo */
        updateCombo(combo) {
            if (combo > stats.maxCombo) {
                stats.maxCombo = combo;
            }
        },

        /** Record garbage lines sent by a clear */
        addAttack(lines) {
            stats.linesSent += lines;
        },

        /** Record a perfect clear */
        addPerfectClear() {
            stats.perfectClears++;
        },

        /** Mark as game over (top-out) */
        setGameOver() {
            gameOver = true;
            if (timer) timer.pause();
        },

        /** Check if the game is won (Sprint goal reached or Blitz time expired) */
        isCompleted() {
            return completed;
        },

        /** Check if the game should end for any reason */
        isFinished() {
            return completed || gameOver;
        },

        /** Get the current gravity interval based on level */
        getDropInterval() {
            if (modeId === MODE_SPRINT) {
                // Sprint uses fixed moderate gravity
                return 1000;
            }
            return getGravityInterval(stats.level);
        },

        /** Get the formatted timer display */
        getTimerDisplay() {
            if (!timer) return '';
            return timer.format();
        },

        /** Get the primary display stat label for the HUD */
        getPrimaryStatLabel() {
            switch (modeId) {
                case MODE_SPRINT: return 'LINES LEFT';
                case MODE_BLITZ:  return 'SCORE';
                case MODE_CLASSIC: return 'SCORE';
                default: return 'SCORE';
            }
        },

        /** Get the primary display stat value for the HUD */
        getPrimaryStatValue() {
            switch (modeId) {
                case MODE_SPRINT: return Math.max(0, goalLines - stats.linesCleared);
                case MODE_BLITZ:  return stats.score;
                case MODE_CLASSIC: return stats.score;
                default: return stats.score;
            }
        },

        /** Whether the timer counts down (affects display style) */
        isCountdown() {
            return modeId === MODE_BLITZ;
        },

        /** Get Blitz remaining seconds for countdown tick sounds */
        getRemainingSeconds() {
            if (modeId !== MODE_BLITZ || !timer) return null;
            return Math.ceil(timer.getRemaining() / 1000);
        },

        /** Play time in ms (excludes pauses) */
        getElapsedMs() {
            if (!timer) return 0;
            if (modeId === MODE_BLITZ) return BLITZ_MS - timer.getRemaining();
            return timer.getElapsed();
        },

        /** Get results for the game-over screen */
        getResults() {
            const r = { ...stats };
            r.modeId = modeId;
            r.modeName = MODE_INFO[modeId]?.name || modeId;
            r.finalTime = timer ? timer.format() : '';
            r.finalTimePrecise = timer && timer.formatPrecise ? timer.formatPrecise() : r.finalTime;
            const minutes = this.getElapsedMs() / 60000;
            r.apm = minutes > 0 ? stats.linesSent / minutes : 0;
            r.completed = completed;
            r.gameOver = gameOver;
            return r;
        },
    };
}
