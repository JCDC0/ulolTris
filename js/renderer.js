/**
 * renderer.js - Canvas rendering for board, pieces, ghost, hold, next queue, and HUD overlays
 */

import { BLOCK_SIZE, VISIBLE_ROWS, BUFFER_ROWS, SHAPES } from './piece.js';

const BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;

/**
 * Draw a single block on a canvas context.
 */
function drawBlock(ctx, x, y, color, isGhost = false, ghostOpacity = 0.2) {
    if (isGhost) {
        ctx.fillStyle = `rgba(255, 255, 255, ${ghostOpacity * 0.5})`;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = ghostOpacity;
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.globalAlpha = 1;
        return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // Top/left highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, 4);
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 4, BLOCK_SIZE);

    // Bottom/right shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x * BLOCK_SIZE, (y + 1) * BLOCK_SIZE - 4, BLOCK_SIZE, 4);
    ctx.fillRect((x + 1) * BLOCK_SIZE - 4, y * BLOCK_SIZE, 4, BLOCK_SIZE);

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

/**
 * Draw a matrix (arena or piece) on a canvas.
 */
function drawMatrix(ctx, matrix, offset, color, isGhost = false, ghostOpacity = 0.2, isBoard = true) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const drawY = isBoard ? y + offset.y - BOARD_OFFSET_Y : y + offset.y;
                if (drawY >= 0 || !isBoard) {
                    const c = color || (SHAPES[value] ? SHAPES[value].color : '#888');
                    drawBlock(ctx, x + offset.x, drawY, c, isGhost, ghostOpacity);
                }
            }
        });
    });
}

/**
 * Draw a piece preview on a side canvas (hold or next).
 */
function drawSideCanvas(ctx, shapeStr, slotTop, slotHeight) {
    if (!shapeStr) return;
    const matrix = SHAPES[shapeStr].matrix;
    const color = SHAPES[shapeStr].color;

    // Center the filled cells, not the padded matrix, so every piece sits inside the slot.
    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        });
    });

    const slotWidth = ctx.canvas.width / BLOCK_SIZE;
    const xOffset = (slotWidth - (maxX - minX + 1)) / 2 - minX;
    const yOffset = slotTop + (slotHeight - (maxY - minY + 1)) / 2 - minY;

    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + xOffset, y + yOffset, color);
            }
        });
    });
}

/**
 * Create a renderer that manages all canvas drawing.
 *
 * @param {Object} canvases - { board, hold, next } canvas elements
 * @param {Object} settings - Settings reference for visual config
 */
export function createRenderer(canvases, settings) {
    const boardCtx = canvases.board.getContext('2d');
    const holdCtx = canvases.hold.getContext('2d');
    const nextCtx = canvases.next.getContext('2d');

    /**
     * Main draw call. Renders the full game state.
     *
     * @param {Object} state - {
     *   arena, player, nextQueue, held,
     *   particles (particle system),
     *   shake (screen shake offset { x, y }),
     * }
     */
    function draw(state) {
        const { arena, player, nextQueue, held, particles, shake } = state;
        const ghostOpacity = (settings.ghostOpacity || 40) / 100;
        const previewCount = settings.nextPreviewCount || 5;

        // Clear all canvases
        boardCtx.clearRect(0, 0, canvases.board.width, canvases.board.height);
        holdCtx.clearRect(0, 0, canvases.hold.width, canvases.hold.height);
        nextCtx.clearRect(0, 0, canvases.next.width, canvases.next.height);

        // Apply screen shake
        boardCtx.save();
        if (shake) {
            boardCtx.translate(shake.x, shake.y);
        }

        // Draw locked blocks on the board
        drawMatrix(boardCtx, arena, { x: 0, y: 0 }, null, false, ghostOpacity, true);

        // Draw ghost piece
        if (player && player.matrix) {
            // The caller passes ghostY so the renderer does not depend on board.js.
            if (state.ghostY !== undefined) {
                drawMatrix(
                    boardCtx, player.matrix,
                    { x: player.pos.x, y: state.ghostY },
                    SHAPES[player.shape].color,
                    true, ghostOpacity, true
                );
            }

            // Draw active piece
            drawMatrix(
                boardCtx, player.matrix,
                player.pos,
                SHAPES[player.shape].color,
                false, ghostOpacity, true
            );
        }

        // Draw particles
        if (particles) {
            particles.drawParticles(boardCtx);
            particles.drawActionTexts(boardCtx);
        }

        boardCtx.restore();

        // Draw hold piece
        if (held) {
            drawSideCanvas(holdCtx, held, 0, canvases.hold.height / BLOCK_SIZE);
        }

        // Draw next queue
        const visibleNext = nextQueue ? nextQueue.slice(0, previewCount) : [];
        visibleNext.forEach((shapeStr, index) => {
            drawSideCanvas(nextCtx, shapeStr, index * 3 + 0.5, 3);
        });
    }

    /**
     * Resize the next canvas based on preview count.
     */
    function resizeNextCanvas(previewCount) {
        const height = previewCount * 3 * BLOCK_SIZE + BLOCK_SIZE;
        canvases.next.height = height;
    }

    return {
        draw,
        resizeNextCanvas,
    };
}
