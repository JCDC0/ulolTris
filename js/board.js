/**
 * board.js - Matrix operations: creation, collision, merge, line clearing
 */

/**
 * Create a 2D matrix filled with zeros.
 */
export function createMatrix(width, height) {
    const matrix = [];
    for (let i = 0; i < height; i++) {
        matrix.push(new Array(width).fill(0));
    }
    return matrix;
}

/**
 * Check if a player piece collides with the arena or boundaries.
 */
export function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Merge the player piece into the arena (lock in place).
 */
export function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = player.shape;
            }
        });
    });
}

/**
 * Find all full rows in the arena.
 * Returns an array of row indices (in original arena coordinates).
 */
export function findFullRows(arena) {
    const rows = [];
    for (let y = 0; y < arena.length; y++) {
        if (arena[y].every(cell => cell !== 0)) {
            rows.push(y);
        }
    }
    return rows;
}

/**
 * Remove the specified rows from the arena and add empty rows at the top.
 * `rows` should be the result of findFullRows() (sorted ascending).
 * Returns the number of rows actually cleared.
 */
export function removeRows(arena, rows) {
    if (rows.length === 0) return 0;

    // Process from bottom to top so indices stay valid
    const sorted = [...rows].sort((a, b) => b - a);
    for (const y of sorted) {
        arena.splice(y, 1);
    }
    // Add empty rows at the top
    const width = arena.length > 0 ? arena[0].length : 10;
    for (let i = 0; i < sorted.length; i++) {
        arena.unshift(new Array(width).fill(0));
    }
    return sorted.length;
}

/**
 * Combined find-and-clear operation. Returns { linesCleared, clearedRows }.
 * clearedRows contains the original y indices before any mutation.
 */
export function clearLines(arena) {
    const clearedRows = findFullRows(arena);
    const linesCleared = removeRows(arena, clearedRows);
    return { linesCleared, clearedRows };
}

/**
 * Check if the entire arena is empty (for Perfect Clear detection).
 */
export function isMatrixEmpty(arena) {
    return arena.every(row => row.every(cell => cell === 0));
}

/**
 * Get the ghost piece Y position (lowest valid position).
 */
export function getGhostY(arena, player) {
    const ghost = { matrix: player.matrix, pos: { ...player.pos } };
    while (!collide(arena, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;
    return ghost.pos.y;
}

/**
 * Check if a player piece is grounded (touching the bottom or a locked piece below).
 */
export function isGrounded(arena, player) {
    const test = { matrix: player.matrix, pos: { x: player.pos.x, y: player.pos.y + 1 } };
    return collide(arena, test);
}
