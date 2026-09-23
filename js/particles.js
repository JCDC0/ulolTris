/**
 * particles.js - Enhanced particle and juice system
 * Handles placement particles, line clear explosions, T-spin effects,
 * combo escalation, screen shake, and action text popups.
 */

import { BLOCK_SIZE, VISIBLE_ROWS, BUFFER_ROWS, SHAPES } from './piece.js';
import { screenShakeMultiplier, particleDensityMultiplier } from './settings.js';
import { getActionColor } from './scoring.js';

/**
 * Create a particle/juice system.
 *
 * @param {Object} settings - Settings reference for density/shake config
 */
export function createParticleSystem(settings) {
    const particles = [];
    const actionTexts = [];
    let shakeX = 0;
    let shakeY = 0;
    let shakeDecay = 0;
    let shakeIntensity = 0;

    const BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;

    function densityMul() {
        return particleDensityMultiplier(settings);
    }

    function shakeMul() {
        return screenShakeMultiplier(settings);
    }

    /**
     * Spawn particles when a piece locks in place.
     */
    function spawnPlacement(piece) {
        const mul = densityMul();
        if (mul === 0) return;

        const color = SHAPES[piece.shape].color;

        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 0) return;

                const worldX = (x + piece.pos.x) * BLOCK_SIZE + BLOCK_SIZE / 2;
                const worldY = (y + piece.pos.y - BOARD_OFFSET_Y) * BLOCK_SIZE + BLOCK_SIZE / 2;

                if (worldY < -BLOCK_SIZE || worldY > VISIBLE_ROWS * BLOCK_SIZE + BLOCK_SIZE) return;

                const count = Math.floor((4 + Math.random() * 3) * mul);
                for (let i = 0; i < count; i++) {
                    const lifetime = 200 + Math.random() * 200;
                    particles.push({
                        x: worldX,
                        y: worldY,
                        vx: (Math.random() - 0.5) * 0.4,
                        vy: -0.1 - Math.random() * 0.2,
                        life: lifetime,
                        maxLife: lifetime,
                        size: 2 + Math.random() * 4,
                        color,
                        type: 'square',
                    });
                }
            });
        });
    }

    /**
     * Spawn line clear explosion particles.
     * @param {number[]} clearedRows - Array of cleared row Y indices (arena coords)
     * @param {string} clearType - The clear action type from scoring
     * @param {Array} arenaSnapshot - Snapshot of row contents before clearing (for colors)
     */
    function spawnLineClear(clearedRows, clearType, arenaSnapshot) {
        const mul = densityMul();
        if (mul === 0) return;

        const isTetris = clearType === 'tetris';
        const isTSpin = clearType && clearType.startsWith('tspin');
        const intensity = isTetris ? 2.5 : isTSpin ? 2.0 : 1.0;

        for (const rowY of clearedRows) {
            const visualY = (rowY - BOARD_OFFSET_Y) * BLOCK_SIZE + BLOCK_SIZE / 2;

            for (let col = 0; col < 10; col++) {
                const cellShape = arenaSnapshot && arenaSnapshot[rowY] ? arenaSnapshot[rowY][col] : null;
                const color = cellShape && SHAPES[cellShape] ? SHAPES[cellShape].color : '#ffffff';
                const worldX = col * BLOCK_SIZE + BLOCK_SIZE / 2;

                const count = Math.floor((3 + Math.random() * 4) * mul * intensity);
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 0.3 + Math.random() * 0.6 * intensity;
                    const lifetime = 300 + Math.random() * 400;
                    particles.push({
                        x: worldX,
                        y: visualY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 0.2,
                        life: lifetime,
                        maxLife: lifetime,
                        size: 2 + Math.random() * 5,
                        color,
                        type: 'square',
                    });
                }
            }
        }

        // Full-width flash for Tetris
        if (isTetris) {
            const midY = clearedRows.reduce((s, r) => s + r, 0) / clearedRows.length;
            const flashY = (midY - BOARD_OFFSET_Y) * BLOCK_SIZE + BLOCK_SIZE / 2;
            particles.push({
                x: (10 * BLOCK_SIZE) / 2,
                y: flashY,
                vx: 0,
                vy: 0,
                life: 200,
                maxLife: 200,
                size: 10 * BLOCK_SIZE,
                color: '#00ffff',
                type: 'flash',
            });
        }

        // Screen shake
        const shakeAmount = isTetris ? 8 : isTSpin ? 6 : clearedRows.length >= 2 ? 3 : 0;
        if (shakeAmount > 0) {
            triggerShake(shakeAmount);
        }
    }

    /**
     * Spawn T-spin effect particles (purple spiral burst).
     */
    function spawnTSpin(playerPos) {
        const mul = densityMul();
        if (mul === 0) return;

        const cx = (playerPos.x + 1.5) * BLOCK_SIZE;
        const cy = (playerPos.y - BOARD_OFFSET_Y + 1.5) * BLOCK_SIZE;

        const count = Math.floor(30 * mul);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 4 + Math.random() * 0.3;
            const speed = 0.3 + Math.random() * 0.5;
            const lifetime = 400 + Math.random() * 300;
            particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: lifetime,
                maxLife: lifetime,
                size: 3 + Math.random() * 4,
                color: '#aa00ff',
                type: 'circle',
            });
        }

        triggerShake(6);
    }

    /**
     * Spawn B2B sparkle particles.
     */
    function spawnB2B(clearedRows) {
        const mul = densityMul();
        if (mul === 0) return;

        for (const rowY of clearedRows) {
            const visualY = (rowY - BOARD_OFFSET_Y) * BLOCK_SIZE + BLOCK_SIZE / 2;
            const count = Math.floor(15 * mul);
            for (let i = 0; i < count; i++) {
                const lifetime = 250 + Math.random() * 250;
                particles.push({
                    x: Math.random() * 10 * BLOCK_SIZE,
                    y: visualY + (Math.random() - 0.5) * BLOCK_SIZE * 2,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -0.15 - Math.random() * 0.2,
                    life: lifetime,
                    maxLife: lifetime,
                    size: 2 + Math.random() * 3,
                    color: '#ffd700',
                    type: 'circle',
                });
            }
        }
    }

    /**
     * Spawn perfect clear full-screen rain effect.
     */
    function spawnPerfectClear() {
        const mul = densityMul();
        if (mul === 0) return;

        // White flash
        particles.push({
            x: (10 * BLOCK_SIZE) / 2,
            y: (VISIBLE_ROWS * BLOCK_SIZE) / 2,
            vx: 0,
            vy: 0,
            life: 400,
            maxLife: 400,
            size: Math.max(10 * BLOCK_SIZE, VISIBLE_ROWS * BLOCK_SIZE) * 1.5,
            color: '#ffffff',
            type: 'flash',
        });

        // Raining particles
        const count = Math.floor(80 * mul);
        for (let i = 0; i < count; i++) {
            const lifetime = 600 + Math.random() * 800;
            particles.push({
                x: Math.random() * 10 * BLOCK_SIZE,
                y: -Math.random() * 100,
                vx: (Math.random() - 0.5) * 0.2,
                vy: 0.2 + Math.random() * 0.3,
                life: lifetime,
                maxLife: lifetime,
                size: 2 + Math.random() * 4,
                color: ['#ffd700', '#00ffff', '#ff69b4', '#7fff00'][Math.floor(Math.random() * 4)],
                type: 'circle',
            });
        }

        triggerShake(10);
    }

    /**
     * Trigger screen shake.
     */
    function triggerShake(intensity) {
        const mul = shakeMul();
        if (mul === 0) return;
        shakeIntensity = intensity * mul;
        shakeDecay = 200; // ms to decay
    }

    /**
     * Add an action text popup.
     */
    function addActionText(text, y, color) {
        if (!settings.showActionText) return;

        const visualY = y !== undefined
            ? (y - BOARD_OFFSET_Y) * BLOCK_SIZE
            : (VISIBLE_ROWS * BLOCK_SIZE) / 2;

        actionTexts.push({
            text,
            x: (10 * BLOCK_SIZE) / 2,
            y: visualY,
            life: 1200,
            maxLife: 1200,
            color: color || '#ffffff',
            scale: 1.5,
        });
    }

    /**
     * Add action texts from a scoring result.
     */
    function addActionsFromResult(result, clearedRows) {
        if (!result || !result.allActions || result.allActions.length === 0) return;

        const baseY = clearedRows && clearedRows.length > 0
            ? clearedRows[Math.floor(clearedRows.length / 2)]
            : undefined;

        let yOffset = 0;
        for (const actionName of result.allActions) {
            const color = actionName.includes('PERFECT') ? '#ffd700'
                : actionName.includes('BACK-TO-BACK') ? '#ffd700'
                : actionName.includes('COMBO') ? '#00ff88'
                : getActionColor(result.action);

            const y = baseY !== undefined ? baseY - yOffset * 1.5 : undefined;
            addActionText(actionName, y, color);
            yOffset++;
        }
    }

    /**
     * Update all particles and effects. Call each frame.
     */
    function update(deltaTime) {
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= deltaTime;

            if (p.type !== 'flash') {
                p.vy += 0.0012 * deltaTime; // gravity
                p.x += p.vx * deltaTime;
                p.y += p.vy * deltaTime;
            }

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Update action texts
        for (let i = actionTexts.length - 1; i >= 0; i--) {
            const t = actionTexts[i];
            t.life -= deltaTime;
            t.y -= 0.03 * deltaTime; // float upward

            if (t.life <= 0) {
                actionTexts.splice(i, 1);
            }
        }

        // Update screen shake
        if (shakeDecay > 0) {
            shakeDecay -= deltaTime;
            const progress = Math.max(0, shakeDecay / 200);
            const intensity = shakeIntensity * progress;
            shakeX = (Math.random() - 0.5) * 2 * intensity;
            shakeY = (Math.random() - 0.5) * 2 * intensity;
            if (shakeDecay <= 0) {
                shakeX = 0;
                shakeY = 0;
            }
        }
    }

    /**
     * Draw all particles onto a canvas context.
     */
    function drawParticles(ctx) {
        for (const p of particles) {
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));

            ctx.save();

            if (p.type === 'flash') {
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = p.color;
                ctx.fillRect(
                    p.x - p.size / 2,
                    p.y - p.size / 2,
                    p.size,
                    p.size
                );
            } else if (p.type === 'circle') {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.fillRect(
                    p.x - p.size / 2,
                    p.y - p.size / 2,
                    p.size,
                    p.size
                );
            }

            ctx.restore();
        }
    }

    /**
     * Draw action text popups onto a canvas context.
     */
    function drawActionTexts(ctx) {
        for (const t of actionTexts) {
            const alpha = Math.max(0, Math.min(1, t.life / t.maxLife));
            const scale = 1 + (1 - alpha) * 0.3; // Slight grow as it fades

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.floor(20 * scale)}px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Glow
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);

            // Second pass for brighter center
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillText(t.text, t.x, t.y);

            ctx.restore();
        }
    }

    return {
        spawnPlacement,
        spawnLineClear,
        spawnTSpin,
        spawnB2B,
        spawnPerfectClear,
        addActionsFromResult,
        update,
        drawParticles,
        drawActionTexts,

        /** Get current screen shake offset */
        getShake() {
            return { x: shakeX, y: shakeY };
        },

        /** Clear all particles and effects */
        clear() {
            particles.length = 0;
            actionTexts.length = 0;
            shakeX = 0;
            shakeY = 0;
            shakeDecay = 0;
        },
    };
}
