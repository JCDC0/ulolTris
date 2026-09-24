/**
 * renderer.js - Canvas rendering for the board, ghost, hold and next queue.
 *
 * The board canvas holds the 10 x 20 field plus SPAWN_ROWS rows above it, where new
 * pieces appear before they fall in. The frame is open at the top, like TETR.IO.
 * Faint X marks show where the next piece spawns: a block there ends the game.
 */

import { BLOCK_SIZE, COLS, VISIBLE_ROWS, BUFFER_ROWS, SHAPES, SPAWN_ROWS, getSpawnPos } from './piece.js';
import { blockSprite } from './skins.js';

const BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;
const FIELD_W = COLS * BLOCK_SIZE;
const FIELD_H = VISIBLE_ROWS * BLOCK_SIZE;
const FRAME = 4;
const FIELD_TOP = SPAWN_ROWS * BLOCK_SIZE;
const SIDE_BLOCK = 22;
const SIDE_COLS = 5;

/** Board canvas size; the page reads it to lay out the hold and next boxes. */
export const BOARD_CANVAS = { width: FIELD_W + FRAME * 2, height: FIELD_TOP + FIELD_H + FRAME, fieldTop: FIELD_TOP };

function lerpColor(a, b, t) {
    const pa = a.match(/\d+/g).map(Number);
    const pb = b.match(/\d+/g).map(Number);
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

/**
 * Draw a piece preview centered in a slot of a side canvas.
 */
function drawPreview(ctx, skin, shape, slotTop, slotHeight, dimmed) {
    const { matrix, color } = SHAPES[shape];
    let minX = 9, maxX = 0, minY = 9, maxY = 0;
    matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }));
    const w = (maxX - minX + 1) * SIDE_BLOCK;
    const h = (maxY - minY + 1) * SIDE_BLOCK;
    const ox = Math.round((ctx.canvas.width - w) / 2) - minX * SIDE_BLOCK;
    const oy = Math.round(slotTop + (slotHeight - h) / 2) - minY * SIDE_BLOCK;
    const sprite = blockSprite(skin, dimmed ? '#5a5a66' : color, SIDE_BLOCK);
    matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) ctx.drawImage(sprite, ox + x * SIDE_BLOCK, oy + y * SIDE_BLOCK);
    }));
}

/**
 * Create the renderer.
 *
 * @param {Object} canvases - { board, hold, next }
 * @param {Object} settings - Settings reference (ghostOpacity, nextPreviewCount, blockSkin)
 */
export function createRenderer(canvases, settings) {
    const boardCtx = canvases.board.getContext('2d');
    const holdCtx = canvases.hold.getContext('2d');
    const nextCtx = canvases.next.getContext('2d');

    canvases.board.width = BOARD_CANVAS.width;
    canvases.board.height = BOARD_CANVAS.height;
    canvases.hold.width = SIDE_COLS * SIDE_BLOCK;
    canvases.hold.height = 3 * SIDE_BLOCK;

    function cell(ctx, skin, color, col, visRow) {
        ctx.drawImage(blockSprite(skin, color, BLOCK_SIZE), col * BLOCK_SIZE, visRow * BLOCK_SIZE);
    }

    function drawField(danger, time) {
        const ctx = boardCtx;
        ctx.fillStyle = 'rgba(7, 7, 13, 0.86)';
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        for (let x = 1; x < COLS; x++) ctx.fillRect(x * BLOCK_SIZE, 0, 1, FIELD_H);
        for (let y = 1; y < VISIBLE_ROWS; y++) ctx.fillRect(0, y * BLOCK_SIZE, FIELD_W, 1);

        let frameColor = 'rgb(226,229,238)';
        if (danger) {
            const pulse = 0.5 + 0.5 * Math.sin(time / 1000 * Math.PI * 2);
            frameColor = lerpColor('rgb(120,30,45)', 'rgb(255,60,90)', pulse);
            const glow = ctx.createLinearGradient(0, 0, 0, BLOCK_SIZE * 6);
            glow.addColorStop(0, `rgba(255,45,85,${0.18 + pulse * 0.2})`);
            glow.addColorStop(1, 'rgba(255,45,85,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, FIELD_W, BLOCK_SIZE * 6);
        }
        ctx.fillStyle = frameColor;
        ctx.fillRect(-FRAME, 0, FRAME, FIELD_H + FRAME);
        ctx.fillRect(FIELD_W, 0, FRAME, FIELD_H + FRAME);
        ctx.fillRect(-FRAME, FIELD_H, FIELD_W + FRAME * 2, FRAME);
    }

    function drawSpawnMarks(shape, danger, time) {
        if (!shape) return;
        const { matrix } = SHAPES[shape];
        const pos = getSpawnPos(matrix);
        const ctx = boardCtx;
        const pulse = danger ? 0.5 + 0.5 * Math.sin(time / 1000 * Math.PI * 2) : 0;
        ctx.strokeStyle = danger ? `rgba(255, 70, 100, ${0.45 + pulse * 0.4})` : 'rgba(255, 255, 255, 0.13)';
        ctx.lineWidth = 2;
        const m = 9;
        matrix.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const px = (pos.x + x) * BLOCK_SIZE;
            const py = (pos.y + y - BOARD_OFFSET_Y) * BLOCK_SIZE;
            ctx.beginPath();
            ctx.moveTo(px + m, py + m); ctx.lineTo(px + BLOCK_SIZE - m, py + BLOCK_SIZE - m);
            ctx.moveTo(px + BLOCK_SIZE - m, py + m); ctx.lineTo(px + m, py + BLOCK_SIZE - m);
            ctx.stroke();
        }));
    }

    function drawMatrix(skin, matrix, pos, color) {
        matrix.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const visRow = y + pos.y - BOARD_OFFSET_Y;
            if (visRow >= -SPAWN_ROWS) cell(boardCtx, skin, color || SHAPES[v]?.color || '#888', x + pos.x, visRow);
        }));
    }

    function drawGhost(matrix, pos, color, opacity) {
        const ctx = boardCtx;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        matrix.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const visRow = y + pos.y - BOARD_OFFSET_Y;
            if (visRow >= 0) ctx.fillRect((x + pos.x) * BLOCK_SIZE + 1, visRow * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        }));
        ctx.restore();
    }

    /**
     * Render one frame.
     *
     * @param {Object} state - { arena, player, nextQueue, held, holdLocked, particles, shake,
     *   ghostY, flash: { rows, progress } | null, danger, time }
     */
    function draw(state) {
        const { arena, player, nextQueue, held, particles, shake, danger } = state;
        const time = state.time ?? performance.now();
        const skin = settings.blockSkin || 'ulol';
        const ghostOpacity = (settings.ghostOpacity ?? 40) / 100 * 0.6;

        boardCtx.clearRect(0, 0, canvases.board.width, canvases.board.height);
        holdCtx.clearRect(0, 0, canvases.hold.width, canvases.hold.height);
        nextCtx.clearRect(0, 0, canvases.next.width, canvases.next.height);

        boardCtx.save();
        boardCtx.translate(FRAME + (shake?.x || 0), FIELD_TOP + (shake?.y || 0));

        drawField(danger, time);
        drawSpawnMarks(nextQueue?.[0], danger, time);
        drawMatrix(skin, arena, { x: 0, y: 0 }, null);

        // Battle style line clear pause: cleared rows flash, then squeeze to the center
        if (state.flash) {
            const { rows, progress } = state.flash;
            const width = FIELD_W * (1 - progress);
            for (const row of rows) {
                const y = (row - BOARD_OFFSET_Y) * BLOCK_SIZE;
                boardCtx.fillStyle = 'rgb(7,7,13)';
                boardCtx.fillRect(0, y, FIELD_W, BLOCK_SIZE);
                boardCtx.globalAlpha = 0.9 - progress * 0.6;
                boardCtx.fillStyle = '#ffffff';
                boardCtx.fillRect((FIELD_W - width) / 2, y + 2, width, BLOCK_SIZE - 4);
                boardCtx.globalAlpha = 1;
            }
        }

        if (player && player.matrix) {
            const color = SHAPES[player.shape].color;
            if (state.ghostY !== undefined) drawGhost(player.matrix, { x: player.pos.x, y: state.ghostY }, color, ghostOpacity);
            drawMatrix(skin, player.matrix, player.pos, color);
        }

        if (particles) particles.drawParticles(boardCtx);
        boardCtx.restore();

        if (held) drawPreview(holdCtx, skin, held, 0, canvases.hold.height, state.holdLocked);

        const count = settings.nextPreviewCount || 5;
        (nextQueue || []).slice(0, count).forEach((shape, i) => {
            drawPreview(nextCtx, skin, shape, i * 3 * SIDE_BLOCK, 3 * SIDE_BLOCK, false);
        });
    }

    /** Size the next canvas for the number of previews. */
    function resizeNextCanvas(previewCount) {
        canvases.next.width = SIDE_COLS * SIDE_BLOCK;
        canvases.next.height = previewCount * 3 * SIDE_BLOCK;
    }

    return { draw, resizeNextCanvas };
}
