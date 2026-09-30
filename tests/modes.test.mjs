import { createModeState, GAME_STYLES, MODE_INFO } from '../js/modes.js';

let clock = 0;
globalThis.performance = { now: () => clock };

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

function mode(id) {
    clock = 0;
    const m = createModeState(id);
    m.start();
    return m;
}

// Soundtrack by mode: one track for the whole run
check('Casual and 40 Lines play the casual playlist, Blitz the intense one',
    MODE_INFO.classic.music === 'casual' && MODE_INFO.sprint.music === 'casual' && MODE_INFO.blitz.music === 'intense');

// Attack stats
{
    const m = mode('sprint');
    m.addAttack(4);
    m.addAttack(6);
    clock = 60000;
    m.updateTimer();
    const r = m.getResults();
    check('lines sent add up and APM uses play time', r.linesSent === 10 && Math.abs(r.apm - 10) < 0.01, `sent ${r.linesSent}, APM ${r.apm.toFixed(2)}`);
    m.reset();
    check('reset clears lines sent', m.stats.linesSent === 0);
}

// Game styles
check('Modern has no pauses', Object.values(GAME_STYLES.modern).filter(v => typeof v === 'number').every(v => v === 0));
check('Battle pauses on clears, longer on big hits, with an entry delay',
    GAME_STYLES.battle.lineClearDelay > 0 && GAME_STYLES.battle.bigHitDelay > GAME_STYLES.battle.lineClearDelay && GAME_STYLES.battle.entryDelay > 0);

console.log(failures ? `\n${failures} FAILED` : '\nAll mode checks passed');
process.exit(failures ? 1 : 0);
