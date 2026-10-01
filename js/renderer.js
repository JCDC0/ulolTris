/**
 * renderer.js - Canvas rendering for the board, ghost, hold and next queue.
 *
 * The modern board canvas holds the 10 x 20 field plus SPAWN_ROWS rows above it, where
 * new pieces appear before they fall in. The frame is open at the top, like TETR.IO.
 * Faint X marks show where the next piece spawns: a block there ends the game.
 *
 * The classic look (Classic mode) is the original's: pieces spawn inside the field, so
 * the canvas is just the field in a closed frame, with solid black behind 8-bit blocks
 * whose colors change every level, no ghost and no spawn marks.
 */

import { BLOCK_SIZE, COLS, VISIBLE_ROWS, BUFFER_ROWS, SHAPES, SPAWN_ROWS, getSpawnPos } from './piece.js';
import { blockSprite, nesBlockSprite } from './skins.js';
import { classicMatrix, nesPalette } from './classic.js';

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
 * @param {(shape: string, size: number, dimmed: boolean) => HTMLCanvasElement} sprite
 */
function drawPreview(ctx, sprite, shape, matrix, slotTop, slotHeight, dimmed) {
    let minX = 9, maxX = 0, minY = 9, maxY = 0;
    matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }));
    const w = (maxX - minX + 1) * SIDE_BLOCK;
    const h = (maxY - minY + 1) * SIDE_BLOCK;
    const ox = Math.round((ctx.canvas.width - w) / 2) - minX * SIDE_BLOCK;
    const oy = Math.round(slotTop + (slotHeight - h) / 2) - minY * SIDE_BLOCK;
    const img = sprite(shape, SIDE_BLOCK, dimmed);
    matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) ctx.drawImage(img, ox + x * SIDE_BLOCK, oy + y * SIDE_BLOCK);
    }));
}

/**
 * Create the renderer.
 *
 * @param {Object} canvases - { board, hold, next }
 * @param {Object} settings - Settings reference (ghostOpacity, nextPreviewCount, blockSkin)
 * @param {'modern'|'classic'} [look] - Board look; the classic one also sizes the board canvas
 */
export function createRenderer(canvases, settings, look = 'modern') {
    const classic = look === 'classic';
    const boardCtx = canvases.board.getContext('2d');
    const holdCtx = canvases.hold.getContext('2d');
    const nextCtx = canvases.next.getContext('2d');
    const fieldTop = classic ? FRAME : FIELD_TOP;
    let previews = settings.nextPreviewCount || 5;

    canvases.board.width = BOARD_CANVAS.width;
    canvases.board.height = classic ? FIELD_H + FRAME * 2 : BOARD_CANVAS.height;
    canvases.hold.width = SIDE_COLS * SIDE_BLOCK;
    canvases.hold.height = 3 * SIDE_BLOCK;

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

    /** Solid black field in a closed two-tone frame: white outside, the level color inside. */
    function drawClassicField(level) {
        const ctx = boardCtx;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-FRAME, -FRAME, FIELD_W + FRAME * 2, FIELD_H + FRAME * 2);
        ctx.fillStyle = nesPalette(level)[0];
        ctx.fillRect(-FRAME / 2, -FRAME / 2, FIELD_W + FRAME, FIELD_H + FRAME);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
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

    /**
     * Draw a matrix of cells. Arena cells hold their piece letter; a piece's own matrix
     * holds 1s, so it passes its letter as `shape`.
     */
    function drawMatrix(sprite, matrix, pos, shape) {
        matrix.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const visRow = y + pos.y - BOARD_OFFSET_Y;
            if (visRow >= -SPAWN_ROWS) boardCtx.drawImage(sprite(shape || v, BLOCK_SIZE), (x + pos.x) * BLOCK_SIZE, visRow * BLOCK_SIZE);
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
     * Modern line clear pause: cleared rows flash, then squeeze to the center.
     * Classic: the blocks of each row vanish in pairs from the middle out, and a
     * four-line clear also flashes the field white.
     */
    function drawClearFlash(flash) {
        const { rows, progress, big } = flash;
        if (classic) {
            const gone = Math.min(5, Math.floor(progress * 5));
            boardCtx.fillStyle = '#000000';
            for (const row of rows) {
                const y = (row - BOARD_OFFSET_Y) * BLOCK_SIZE;
                for (let i = 0; i < gone; i++) {
                    boardCtx.fillRect((4 - i) * BLOCK_SIZE, y, BLOCK_SIZE, BLOCK_SIZE);
                    boardCtx.fillRect((5 + i) * BLOCK_SIZE, y, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
            if (big && Math.floor(progress * 10) % 2 === 0) {
                boardCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                boardCtx.fillRect(0, 0, FIELD_W, FIELD_H);
            }
            return;
        }
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

    /**
     * Render one frame.
     *
     * @param {Object} state - { arena, player, nextQueue, held, holdLocked, particles, shake,
     *   ghostY, flash: { rows, progress, big } | null, danger, time, level }
     */
    function draw(state) {
        const { arena, player, nextQueue, held, particles, shake, danger } = state;
        const time = state.time ?? performance.now();
        const skin = settings.blockSkin || 'ulol';
        const ghostOpacity = (settings.ghostOpacity ?? 40) / 100 * 0.6;
        const level = state.level ?? 0;
        const sprite = classic
            ? (shape, size) => nesBlockSprite(shape, level, size)
            : (shape, size, dimmed) => blockSprite(skin, dimmed ? '#5a5a66' : SHAPES[shape]?.color || '#888', size);

        boardCtx.clearRect(0, 0, canvases.board.width, canvases.board.height);
        holdCtx.clearRect(0, 0, canvases.hold.width, canvases.hold.height);
        nextCtx.clearRect(0, 0, canvases.next.width, canvases.next.height);

        boardCtx.save();
        boardCtx.translate(FRAME + (shake?.x || 0), fieldTop + (shake?.y || 0));

        if (classic) {
            drawClassicField(level);
        } else {
            drawField(danger, time);
            drawSpawnMarks(nextQueue?.[0], danger, time);
        }
        drawMatrix(sprite, arena, { x: 0, y: 0 }, null);

        if (state.flash) drawClearFlash(state.flash);

        if (player && player.matrix) {
            if (state.ghostY !== undefined) {
                drawGhost(player.matrix, { x: player.pos.x, y: state.ghostY }, SHAPES[player.shape].color, ghostOpacity);
            }
            drawMatrix(sprite, player.matrix, player.pos, player.shape);
        }

        if (particles) particles.drawParticles(boardCtx);
        boardCtx.restore();

        const previewMatrix = shape => (classic ? classicMatrix(shape) : SHAPES[shape].matrix);
        if (held) drawPreview(holdCtx, sprite, held, previewMatrix(held), 0, canvases.hold.height, state.holdLocked);

        (nextQueue || []).slice(0, previews).forEach((shape, i) => {
            drawPreview(nextCtx, sprite, shape, previewMatrix(shape), i * 3 * SIDE_BLOCK, 3 * SIDE_BLOCK, false);
        });
    }

    /** Size the next canvas for the number of previews. */
    function resizeNextCanvas(previewCount) {
        previews = previewCount;
        canvases.next.width = SIDE_COLS * SIDE_BLOCK;
        canvases.next.height = previewCount * 3 * SIDE_BLOCK;
    }

    return { draw, resizeNextCanvas };
}
