import { minimumInputs, placementKey } from '../js/finesse.js';
import { SHAPES, rotateMatrix, getSpawnPos, BUFFER_ROWS, VISIBLE_ROWS, COLS } from '../js/piece.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

const rot = (shape, times) => {
    let m = SHAPES[shape].matrix;
    for (let i = 0; i < times; i++) m = rotateMatrix(m, 1);
    return m;
};
const spawnX = shape => getSpawnPos(SHAPES[shape].matrix).x;

// Spawn position: every piece appears fully above the field, touching its top
for (const [name, { matrix }] of Object.entries(SHAPES)) {
    const pos = getSpawnPos(matrix);
    const rows = matrix.map((r, y) => (r.some(Boolean) ? pos.y + y : null)).filter(v => v !== null);
    check(`${name} spawns just above the field`, Math.max(...rows) === BUFFER_ROWS - VISIBLE_ROWS - 1, `rows ${rows.join(',')}`);
}

// Finesse minimums on an empty board (the standard 2-step finesse chart)
check('dropping where it spawns takes 0 inputs', minimumInputs('T', rot('T', 0), spawnX('T')) === 0);
check('T to the left wall: 1 (hold left)', minimumInputs('T', rot('T', 0), 0) === 1);
check('T to the right wall: 1 (hold right)', minimumInputs('T', rot('T', 0), COLS - 3) === 1);
check('T one left: 1 (tap)', minimumInputs('T', rot('T', 0), spawnX('T') - 1) === 1);
check('T two left: 2 (tap, tap)', minimumInputs('T', rot('T', 0), spawnX('T') - 2) === 2);
check('T rotated once in place: 1', minimumInputs('T', rot('T', 1), spawnX('T')) === 1);
check('T upside down in place: 2 (no 180 key)', minimumInputs('T', rot('T', 2), spawnX('T')) === 2);
check('O to the left wall: 1', minimumInputs('O', rot('O', 0), 0) === 1);
check('I flat to the right wall: 1', minimumInputs('I', rot('I', 0), COLS - 4) === 1);
const iVertical = rot('I', 1);
check('I vertical against the left wall: 2 (rotate, hold left)', minimumInputs('I', iVertical, -2) === 2);

// Equivalent orientations share one key: S rotated CW or CCW, same cells
const sCw = rot('S', 1);
const sCcw = rot('S', 3);
const leftmost = m => m[0].map((_, x) => m.some(r => r[x])).indexOf(true);
check('S vertical: both rotations give the same placement key',
    placementKey(sCw, 3 - leftmost(sCw)) === placementKey(sCcw, 3 - leftmost(sCcw)));
check('unreachable placement returns null', minimumInputs('T', rot('T', 0), 42) === null);

console.log(failures ? `\n${failures} FAILED` : '\nAll finesse checks passed');
process.exit(failures ? 1 : 0);
