/* Constants and Configurations */
const COLS = 10;
const VISIBLE_ROWS = 20;
const BUFFER_ROWS = 40;
const BLOCK_SIZE = 30;

const boardCanvas = document.getElementById('board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

/* Tetromino Definitions */
const SHAPES = {
    I: { matrix: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], color: '#00ffff' },
    J: { matrix: [[1,0,0], [1,1,1], [0,0,0]], color: '#0000ff' },
    L: { matrix: [[0,0,1], [1,1,1], [0,0,0]], color: '#ffa500' },
    O: { matrix: [[1,1], [1,1]], color: '#ffff00' },
    S: { matrix: [[0,1,1], [1,1,0], [0,0,0]], color: '#00ff00' },
    T: { matrix: [[0,1,0], [1,1,1], [0,0,0]], color: '#800080' },
    Z: { matrix: [[1,1,0], [0,1,1], [0,0,0]], color: '#ff0000' }
};

/* SRS Wall Kick Data (Y-axis inverted for Canvas coordinates) */
const KICKS = {
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

/* Matrix and Game State */
function createMatrix(width, height) {
    const matrix = [];
    while (height--) {
        matrix.push(new Array(width).fill(0));
    }
    return matrix;
}

const arena = createMatrix(COLS, BUFFER_ROWS);
let bag = [];
let nextQueue = [];

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    shape: null,
    rotation: 0,
    held: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1
};

/* Randomizer Logic */
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function generateBag() {
    return shuffle(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
}

function fillQueue() {
    while (nextQueue.length < 5) {
        nextQueue = nextQueue.concat(generateBag());
    }
}

function getNextPiece() {
    fillQueue();
    return nextQueue.shift();
}

function resetPlayer() {
    player.shape = getNextPiece();
    player.matrix = SHAPES[player.shape].matrix;
    player.rotation = 0;
    player.pos.y = BUFFER_ROWS - VISIBLE_ROWS - player.matrix.length;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    player.canHold = true;
    
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        player.lines = 0;
        player.level = 1;
        updateStats();
    }
}

function holdPiece() {
    if (!player.canHold) return;
    
    if (player.held === null) {
        player.held = player.shape;
        resetPlayer();
    } else {
        const temp = player.shape;
        player.shape = player.held;
        player.held = temp;
        player.matrix = SHAPES[player.shape].matrix;
        player.rotation = 0;
        player.pos.y = BUFFER_ROWS - VISIBLE_ROWS - player.matrix.length;
        player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    }
    player.canHold = false;
    dropCounter = 0;
    lockTimer = 0;
}

/* Collision and Merging */
function collide(arena, playerObj) {
    const m = playerObj.matrix;
    const o = playerObj.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, playerObj) {
    playerObj.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + playerObj.pos.y][x + playerObj.pos.x] = playerObj.shape;
            }
        });
    });
}

function clearLines() {
    let linesCleared = 0;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        linesCleared++;
    }
    
    if (linesCleared > 0) {
        player.lines += linesCleared;
        player.level = Math.floor(player.lines / 10) + 1;
        player.score += linesCleared * 100 * player.level;
        dropInterval = Math.max(100, 1000 - (player.level - 1) * 100);
        updateStats();
    }
}

function updateStats() {
    document.getElementById('score-display').innerText = player.score;
    document.getElementById('lines-display').innerText = player.lines;
    document.getElementById('level-display').innerText = player.level;
}

/* Rendering Logic */
function drawBlock(ctx, x, y, color, isGhost = false) {
    ctx.fillStyle = isGhost ? 'rgba(255, 255, 255, 0.2)' : color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    if (!isGhost) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, 4);
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 4, BLOCK_SIZE);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x * BLOCK_SIZE, (y + 1) * BLOCK_SIZE - 4, BLOCK_SIZE, 4);
        ctx.fillRect((x + 1) * BLOCK_SIZE - 4, y * BLOCK_SIZE, 4, BLOCK_SIZE);
    }
    
    ctx.strokeStyle = isGhost ? color : '#000';
    ctx.lineWidth = isGhost ? 2 : 1;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawMatrix(ctx, matrix, offset, color, isGhost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const drawY = y + offset.y - (BUFFER_ROWS - VISIBLE_ROWS);
                if (drawY >= 0 || ctx !== boardCtx) {
                    drawBlock(ctx, x + offset.x, drawY, color || SHAPES[value].color, isGhost);
                }
            }
        });
    });
}

function drawSideCanvas(ctx, shapeStr, yOffset) {
    if (!shapeStr) return;
    const matrix = SHAPES[shapeStr].matrix;
    const color = SHAPES[shapeStr].color;
    
    let xOffset = 2;
    if (shapeStr === 'O') xOffset = 1;
    if (shapeStr === 'I') xOffset = 0;

    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + xOffset, y + yOffset, color);
            }
        });
    });
}

function draw() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    drawMatrix(boardCtx, arena, {x: 0, y: 0});
    
    if (player.matrix) {
        const ghost = { ...player, pos: { ...player.pos } };
        while (!collide(arena, ghost)) {
            ghost.pos.y++;
        }
        ghost.pos.y--;
        drawMatrix(boardCtx, ghost.matrix, ghost.pos, SHAPES[player.shape].color, true);
        
        drawMatrix(boardCtx, player.matrix, player.pos, SHAPES[player.shape].color);
    }
    
    if (player.held) {
        drawSideCanvas(holdCtx, player.held, 1);
    }
    
    nextQueue.slice(0, 3).forEach((shapeStr, index) => {
        drawSideCanvas(nextCtx, shapeStr, index * 4 + 1);
    });
}

/* Movement and Rotations */
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        return true;
    }
    dropCounter = 0;
    return false;
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(arena, player)) {
        player.pos.x -= offset;
    } else {
        lockTimer = 0;
    }
}

function rotateMatrix(matrix, dir) {
    const transposed = matrix[0].map((val, index) => matrix.map(row => row[index]));
    if (dir > 0) return transposed.map(row => row.reverse());
    return transposed.reverse();
}

function playerRotate(dir) {
    const originalMatrix = player.matrix;
    const originalRotation = player.rotation;
    
    player.matrix = rotateMatrix(player.matrix, dir);
    let newRotation = (player.rotation + dir + 4) % 4;
    
    if (player.shape === 'O') {
        player.rotation = newRotation;
        return;
    }
    
    const kickKey = `${originalRotation}->${newRotation}`;
    const kickType = player.shape === 'I' ? 'I' : 'JLSTZ';
    const kickTests = KICKS[kickType][kickKey];
    
    let rotated = false;
    for (let i = 0; i < kickTests.length; i++) {
        const [xOffset, yOffset] = kickTests[i];
        player.pos.x += xOffset;
        player.pos.y += yOffset;
        
        if (!collide(arena, player)) {
            rotated = true;
            player.rotation = newRotation;
            lockTimer = 0;
            break;
        }
        
        player.pos.x -= xOffset;
        player.pos.y -= yOffset;
    }
    
    if (!rotated) {
        player.matrix = originalMatrix;
        player.rotation = originalRotation;
    }
}

/* Engine Loop */
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let lockTimer = 0;
const LOCK_DELAY = 500;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        const hit = playerDrop();
        if (!hit) {
            dropCounter = 0;
        }
    }
    
    const isGrounded = (() => {
        player.pos.y++;
        const grounded = collide(arena, player);
        player.pos.y--;
        return grounded;
    })();

    if (isGrounded) {
        lockTimer += deltaTime;
        if (lockTimer > LOCK_DELAY) {
            merge(arena, player);
            clearLines();
            resetPlayer();
            lockTimer = 0;
            dropCounter = 0;
        }
    } else {
        lockTimer = 0;
    }
    
    draw();
    requestAnimationFrame(update);
}

/* Input Handling */
document.addEventListener('keydown', event => {
    switch(event.keyCode) {
        case 37: 
            playerMove(-1);
            break;
        case 39: 
            playerMove(1);
            break;
        case 40: 
            playerDrop();
            player.score += 1;
            updateStats();
            break;
        case 38: 
            playerRotate(1);
            break;
        case 90: 
            playerRotate(-1);
            break;
        case 67: 
            holdPiece();
            break;
        case 32: 
            while (!playerDrop()) {
                player.score += 2;
            }
            merge(arena, player);
            clearLines();
            resetPlayer();
            lockTimer = 0;
            dropCounter = 0;
            updateStats();
            break;
    }
});

fillQueue();
resetPlayer();
updateStats();
update();