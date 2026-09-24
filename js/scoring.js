/**
 * scoring.js - Tetr.io-style scoring with T-spin detection, combos, B2B, and perfect clear
 */

import { isMatrixEmpty } from './board.js';

/**
 * Point values for each clear type (base, before level multiplier).
 */
const SCORE_TABLE = {
    'single':           100,
    'double':           300,
    'triple':           500,
    'tetris':           800,
    'tspin-mini':       100,
    'tspin-mini-single':200,
    'tspin-mini-double':400,
    'tspin':            400,
    'tspin-single':     800,
    'tspin-double':     1200,
    'tspin-triple':     1600,
    'perfect-clear':    3500,
};

/** B2B multiplier for "difficult" clears */
const B2B_MULTIPLIER = 1.5;

/** Points per combo hit */
const COMBO_BONUS = 50;

/**
 * Display names for action text popups.
 */
const ACTION_NAMES = {
    'single':           'SINGLE',
    'double':           'DOUBLE',
    'triple':           'TRIPLE',
    'tetris':           'QUAD',
    'tspin-mini':       'T-SPIN MINI',
    'tspin-mini-single':'T-SPIN MINI SINGLE',
    'tspin-mini-double':'T-SPIN MINI DOUBLE',
    'tspin':            'T-SPIN',
    'tspin-single':     'T-SPIN SINGLE',
    'tspin-double':     'T-SPIN DOUBLE',
    'tspin-triple':     'T-SPIN TRIPLE',
    'perfect-clear':    'PERFECT CLEAR',
};

/**
 * Garbage lines sent per clear, from the Tetris guideline versus table
 * (the one Tetris 99 and Puyo Puyo Tetris use).
 */
const ATTACK_TABLE = {
    'single':            0,
    'double':            1,
    'triple':            2,
    'tetris':            4,
    'tspin-mini-single': 0,
    'tspin-mini-double': 1,
    'tspin-single':      2,
    'tspin-double':      4,
    'tspin-triple':      6,
};

/** Extra lines by combo count (index = combo, capped at the last entry). */
const COMBO_ATTACK = [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
const B2B_ATTACK = 1;
const PERFECT_CLEAR_ATTACK = 10;

/**
 * Lines of garbage a clear sends. Call after calculateScore on its result.
 */
export function calculateAttack(result) {
    if (!result.isClearAction) return 0;
    let lines = ATTACK_TABLE[result.action] || 0;
    if (result.combo > 0) lines += COMBO_ATTACK[Math.min(result.combo, COMBO_ATTACK.length - 1)];
    if (result.b2b) lines += B2B_ATTACK;
    if (result.perfectClear) lines += PERFECT_CLEAR_ATTACK;
    return lines;
}

/**
 * Actions that count as "difficult" for back-to-back tracking.
 */
const DIFFICULT_CLEARS = new Set([
    'tetris',
    'tspin-single', 'tspin-double', 'tspin-triple',
    'tspin-mini-single', 'tspin-mini-double',
]);

/**
 * Create a fresh scoring state tracker.
 */
export function createScoringState() {
    return {
        combo: -1,        // -1 = no active combo; 0 = first consecutive clear
        b2b: -1,          // -1 = no B2B chain; 0+ = consecutive difficult clears
        lastClearWasDifficult: false,
    };
}

/**
 * Detect T-spin type using the 3-corner rule.
 *
 * After a T piece rotates into its final position, check the four corners
 * of the T piece's bounding box. A T-spin requires at least 3 of 4 corners
 * to be filled (wall or block).
 *
 * Mini T-spin: The two corners on the "front" (flat side) of the T are not
 * both filled, and the kick index was 0 (basic rotation, no kick).
 *
 * @param {Array} arena - The game board
 * @param {Object} player - The player piece state
 * @param {boolean} wasRotation - Whether the last action was a rotation
 * @param {number} kickIndex - Which SRS kick test was used (0 = no kick)
 * @returns {'none'|'mini'|'full'} The T-spin type
 */
export function detectTSpin(arena, player, wasRotation, kickIndex) {
    if (player.shape !== 'T' || !wasRotation) {
        return 'none';
    }

    const px = player.pos.x;
    const py = player.pos.y;

    // The T piece is 3x3. Check the four corners of the bounding box.
    const corners = [
        [px,     py],     // top-left
        [px + 2, py],     // top-right
        [px,     py + 2], // bottom-left
        [px + 2, py + 2], // bottom-right
    ];

    let filledCorners = 0;
    const cornerFilled = corners.map(([cx, cy]) => {
        // Out of bounds counts as filled
        if (cy < 0 || cy >= arena.length || cx < 0 || cx >= arena[0].length) {
            filledCorners++;
            return true;
        }
        if (arena[cy][cx] !== 0) {
            filledCorners++;
            return true;
        }
        return false;
    });

    if (filledCorners < 3) {
        return 'none';
    }

    // Determine which corners are the "front" based on rotation state.
    // Rotation 0: T faces up,    front corners = top-left (0), top-right (1)
    // Rotation 1: T faces right, front corners = top-right (1), bottom-right (3)
    // Rotation 2: T faces down,  front corners = bottom-left (2), bottom-right (3)
    // Rotation 3: T faces left,  front corners = top-left (0), bottom-left (2)
    const frontCorners = {
        0: [0, 1],
        1: [1, 3],
        2: [2, 3],
        3: [0, 2],
    };

    const [fc1, fc2] = frontCorners[player.rotation];
    const frontBothFilled = cornerFilled[fc1] && cornerFilled[fc2];

    // Full T-spin if both front corners are filled, or if a wall kick was used (kick index > 0)
    if (frontBothFilled) {
        return 'full';
    }

    // If kick index >= 4 (the last kick test), it is always a full T-spin
    // This handles the TST (T-spin triple) kick
    if (kickIndex >= 4) {
        return 'full';
    }

    return 'mini';
}

/**
 * Classify a line clear action.
 *
 * @param {number} linesCleared - Number of lines cleared (0-4)
 * @param {'none'|'mini'|'full'} tSpinType - T-spin detection result
 * @returns {string|null} The action type key, or null if no clear
 */
export function classifyClear(linesCleared, tSpinType) {
    if (linesCleared === 0 && tSpinType === 'none') return null;

    if (tSpinType === 'full') {
        if (linesCleared === 0) return 'tspin';
        if (linesCleared === 1) return 'tspin-single';
        if (linesCleared === 2) return 'tspin-double';
        if (linesCleared === 3) return 'tspin-triple';
    }

    if (tSpinType === 'mini') {
        if (linesCleared === 0) return 'tspin-mini';
        if (linesCleared === 1) return 'tspin-mini-single';
        if (linesCleared === 2) return 'tspin-mini-double';
    }

    // Normal clears
    if (linesCleared === 1) return 'single';
    if (linesCleared === 2) return 'double';
    if (linesCleared === 3) return 'triple';
    if (linesCleared === 4) return 'tetris';

    return null;
}

/**
 * Calculate score for a line clear event and update scoring state.
 *
 * @param {number} linesCleared - Number of lines cleared
 * @param {'none'|'mini'|'full'} tSpinType - T-spin type
 * @param {Object} scoringState - Mutable scoring state (combo, b2b)
 * @param {number} level - Current level
 * @param {Array} arena - The arena AFTER lines are cleared (for perfect clear check)
 * @returns {Object} Result with points, actions, combo info, etc.
 */
export function calculateScore(linesCleared, tSpinType, scoringState, level, arena) {
    const result = {
        points: 0,
        action: null,
        actionName: '',
        combo: 0,
        b2b: false,
        b2bCount: 0,
        perfectClear: false,
        isClearAction: linesCleared > 0,
        allActions: [],    // All displayable actions
    };

    const actionType = classifyClear(linesCleared, tSpinType);
    if (!actionType) {
        // No clear happened; break combo
        if (linesCleared === 0 && tSpinType === 'none') {
            scoringState.combo = -1;
        }
        return result;
    }

    result.action = actionType;
    result.actionName = ACTION_NAMES[actionType] || '';
    result.allActions.push(result.actionName);

    // Base score
    let basePoints = SCORE_TABLE[actionType] || 0;

    // Combo tracking (only for actual line clears)
    if (linesCleared > 0) {
        scoringState.combo++;
        result.combo = scoringState.combo;
        if (scoringState.combo > 0) {
            const comboBonus = COMBO_BONUS * scoringState.combo;
            basePoints += comboBonus;
            result.allActions.push(`COMBO x${scoringState.combo}`);
        }
    }

    // B2B tracking
    const isDifficult = DIFFICULT_CLEARS.has(actionType);
    if (linesCleared > 0) {
        if (isDifficult) {
            if (scoringState.lastClearWasDifficult) {
                scoringState.b2b++;
                result.b2b = true;
                result.b2bCount = scoringState.b2b;
                basePoints = Math.floor(basePoints * B2B_MULTIPLIER);
                result.allActions.push('BACK-TO-BACK');
            } else {
                scoringState.b2b = 0;
            }
            scoringState.lastClearWasDifficult = true;
        } else {
            scoringState.lastClearWasDifficult = false;
            scoringState.b2b = -1;
        }
    }

    // Perfect clear check
    if (linesCleared > 0 && arena && isMatrixEmpty(arena)) {
        result.perfectClear = true;
        basePoints += SCORE_TABLE['perfect-clear'];
        result.allActions.push('PERFECT CLEAR');
    }

    // Apply level multiplier
    result.points = basePoints * level;

    return result;
}

/**
 * Get the color associated with an action for text display.
 */
export function getActionColor(actionType) {
    if (!actionType) return '#ffffff';
    if (actionType.startsWith('tspin')) return '#e07af0';
    if (actionType === 'tetris') return '#5ee8c8';
    if (actionType === 'perfect-clear') return '#ffd700';
    if (actionType === 'triple') return '#b2e86a';
    if (actionType === 'double') return '#f5a45a';
    return '#ffffff';
}

/**
 * Determine what sound event to play based on the scoring result.
 */
export function getSoundEvent(result) {
    if (result.perfectClear) return 'perfectClear';
    if (result.action && result.action.startsWith('tspin') && result.isClearAction) return 'tspinClear';
    if (result.action && result.action.startsWith('tspin')) return 'tspin';
    if (result.action === 'tetris') return 'clear4';
    if (result.action === 'triple') return 'clear3';
    if (result.action === 'double') return 'clear2';
    if (result.action === 'single') return 'clear1';
    return null;
}
