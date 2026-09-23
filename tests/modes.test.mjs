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

// Soundtrack by mode, and when it turns intense
check('Classic plays calm; Sprint and Blitz play competitive',
    MODE_INFO.classic.track === 'calm' && MODE_INFO.sprint.track === 'competitive' && MODE_INFO.blitz.track === 'competitive');
{
    const m = mode('sprint');
    m.addLines(29);
    const before = m.isHeated();
    m.addLines(1);
    check('Sprint turns intense at 10 lines left', !before && m.isHeated());
}
{
    const m = mode('classic');
    m.addLines(89);
    const before = m.isHeated();
    m.addLines(1);
    check('Classic turns intense at level 10', !before && m.isHeated(), `level ${m.stats.level}`);
}
{
    const m = mode('blitz');
    clock = 89000;
    m.updateTimer();
    const before = m.isHeated();
    clock = 90000;
    m.updateTimer();
    check("Blitz turns intense in the last 30 seconds", !before && m.isHeated());
}

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
