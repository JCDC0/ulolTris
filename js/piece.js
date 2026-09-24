/**
 * piece.js - Tetromino definitions, SRS kick data, and 7-bag randomizer
 */

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const BUFFER_ROWS = 40;
export const BLOCK_SIZE = 30;

/** Tetromino shape matrices and colors */
export const SHAPES = {
    I: { matrix: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], color: '#3fd9b8' },
    J: { matrix: [[1,0,0], [1,1,1], [0,0,0]], color: '#5d55e0' },
    L: { matrix: [[0,0,1], [1,1,1], [0,0,0]], color: '#ef8a3c' },
    O: { matrix: [[1,1], [1,1]], color: '#f2cb46' },
    S: { matrix: [[0,1,1], [1,1,0], [0,0,0]], color: '#94d64a' },
    T: { matrix: [[0,1,0], [1,1,1], [0,0,0]], color: '#cf5ce0' },
    Z: { matrix: [[1,1,0], [0,1,1], [0,0,0]], color: '#ec4a5c' }
};

/** SRS Wall Kick Data (Y-axis inverted for Canvas coordinates) */
export const KICKS = {
    JLSTZ: {
        '0->1': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
        '1->0': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
        '1->2': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
        '2->1': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
        '2->3': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
        '3->2': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
        '3->0': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
        '0->3': [[0,0], [1,0], [1,-1], [0,2], [1,2]]
    },
    I: {
        '0->1': [[0,0], [-2,0], [1,0], [-2,1], [1,-2]],
        '1->0': [[0,0], [2,0], [-1,0], [2,-1], [-1,2]],
        '1->2': [[0,0], [-1,0], [2,0], [-1,-2], [2,1]],
        '2->1': [[0,0], [1,0], [-2,0], [1,2], [-2,-1]],
        '2->3': [[0,0], [2,0], [-1,0], [2,-1], [-1,2]],
        '3->2': [[0,0], [-2,0], [1,0], [-2,1], [1,-2]],
        '3->0': [[0,0], [1,0], [-2,0], [1,2], [-2,-1]],
        '0->3': [[0,0], [-1,0], [2,0], [-1,-2], [2,1]]
    }
};

/**
 * Rotate a tetromino matrix clockwise (dir=1) or counter-clockwise (dir=-1).
 */
export function rotateMatrix(matrix, dir) {
    const transposed = matrix[0].map((_, i) => matrix.map(row => row[i]));
    if (dir > 0) return transposed.map(row => row.reverse());
    return transposed.reverse();
}

/**
 * Fisher-Yates shuffle (in place).
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Generate a new shuffled bag of all 7 tetrominoes.
 */
export function generateBag() {
    return shuffle(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
}

/**
 * Fill the queue to at least `minSize` pieces by appending bags.
 */
export function fillQueue(queue, minSize = 7) {
    while (queue.length < minSize) {
        queue.push(...generateBag());
    }
}

/**
 * Pull the next piece from the front of the queue, refilling as needed.
 */
export function getNextPiece(queue) {
    fillQueue(queue);
    return queue.shift();
}

/**
 * Get the spawn position for a piece in the buffer.
 */
export function getSpawnPos(matrix) {
    // Spawn just above the visible field (like TETR.IO): the lowest filled row sits on the
    // row above the field, so the piece shows outside the board and falls in.
    let lastFilledRow = 0;
    matrix.forEach((row, y) => { if (row.some(v => v !== 0)) lastFilledRow = y; });
    return {
        x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
        y: BUFFER_ROWS - VISIBLE_ROWS - 1 - lastFilledRow
    };
}

/** Rows above the field that are drawn, so spawning pieces are visible. */
export const SPAWN_ROWS = 3;

/**
 * Attempt to rotate a player piece with SRS wall kicks.
 * Returns { success, kickIndex } where kickIndex is which kick test passed (0 = no kick).
 */
export function tryRotate(player, arena, collide, dir) {
    const originalMatrix = player.matrix;
    const originalRotation = player.rotation;

    const rotated = rotateMatrix(player.matrix, dir);
    const newRotation = (player.rotation + dir + 4) % 4;

    player.matrix = rotated;

    if (player.shape === 'O') {
        player.rotation = newRotation;
        return { success: true, kickIndex: 0 };
    }

    const kickKey = `${originalRotation}->${newRotation}`;
    const kickType = player.shape === 'I' ? 'I' : 'JLSTZ';
    const kickTests = KICKS[kickType][kickKey];

    for (let i = 0; i < kickTests.length; i++) {
        const [xOff, yOff] = kickTests[i];
        player.pos.x += xOff;
        player.pos.y += yOff;

        if (!collide(arena, player)) {
            player.rotation = newRotation;
            return { success: true, kickIndex: i };
        }

        player.pos.x -= xOff;
        player.pos.y -= yOff;
    }

    // Rotation failed, revert
    player.matrix = originalMatrix;
    player.rotation = originalRotation;
    return { success: false, kickIndex: -1 };
}
