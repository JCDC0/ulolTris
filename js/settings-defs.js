/**
 * settings-defs.js - What the settings menu shows: the tabs, and for each setting its
 * label, kind, how its value reads, and a hint for the info panel. The menu builds its
 * rows from this list, so a new setting needs a default and constraint in settings.js
 * and one entry here.
 */

import {
    describeArr, describeFrames, describeDcd, describeSoftDrop, describeVolume, describeCrossfade,
    describeEnum, describeOpacity, describePreviewCount, describeLockDelay,
    describeGameStyle, describeSoundtrack, describeStatsDisplay,
} from './settings.js';
import { describeSkin, SKINS } from './skins.js';
import { describeScene, CASUAL_SCENES } from './background.js';
import { TRACK_INFO, TRACK_IDS } from './tracks.js';
import { describeWeather, VARIANTS } from './scenes/atmosphere.js';

const SOUND_PACK_LABELS = { ulol: 'uloltris', arcade: 'Arcade (Jstris-style)', bubbly: 'Bubbly (PPT-style)' };
const LEVELS = ['off', 'low', 'medium', 'high'];

/**
 * @typedef {Object} SettingDef
 * @property {string} key - key in the settings object
 * @property {string} label
 * @property {'range'|'toggle'|'enum'} type
 * @property {(value: *) => string} [describe] - how the value reads
 * @property {string[]} [values] - for enums
 * @property {string} hint - one or two sentences for the info panel
 */

/** @type {{ id: string, label: string, settings: SettingDef[] }[]} */
export const SETTINGS_TABS = [
    { id: 'handling', label: 'HANDLING', settings: [
        { key: 'arr', label: 'ARR', type: 'range', describe: describeArr, hint: 'Auto repeat rate. Frames between auto-shifts once DAS has charged. 0 slides to the wall at once.' },
        { key: 'das', label: 'DAS', type: 'range', describe: describeFrames, hint: 'Delayed auto shift. Frames you hold a direction before it starts repeating.' },
        { key: 'dcd', label: 'DCD', type: 'range', describe: describeDcd, hint: 'DAS cut delay. Pauses DAS charging for this many frames after a rotation or a new piece. 0 is off.' },
        { key: 'sdf', label: 'SDF', type: 'range', describe: describeSoftDrop, hint: 'Soft drop factor. How many times faster than gravity a held soft drop falls. The top value drops at once.' },
        { key: 'cancelDasOnDirectionChange', label: 'CANCEL DAS ON TURN', type: 'toggle', hint: 'On: changing direction resets the DAS charge. Off: the charge carries over.' },
        { key: 'preferSoftDrop', label: 'PREFER SOFT DROP', type: 'toggle', hint: 'On: soft drop runs before sideways movement within a frame.' },
    ] },
    { id: 'audio', label: 'AUDIO', settings: [
        { key: 'masterVolume', label: 'MASTER', type: 'range', describe: describeVolume, hint: 'Overall volume for everything.' },
        { key: 'sfxVolume', label: 'SFX', type: 'range', describe: describeVolume, hint: 'Volume of move, rotate, drop and clear sounds.' },
        { key: 'musicVolume', label: 'MUSIC', type: 'range', describe: describeVolume, hint: 'Volume of the soundtrack.' },
        { key: 'ambienceVolume', label: 'SCENE SOUND VOLUME', type: 'range', describe: describeVolume, hint: 'Volume of rain, wind, birds and the other sounds of the scenery.' },
        { key: 'sfxMuted', label: 'MUTE SFX', type: 'toggle', hint: 'Silence the effect sounds.' },
        { key: 'musicMuted', label: 'MUTE MUSIC', type: 'toggle', hint: 'Silence the soundtrack.' },
        { key: 'ambience', label: 'SCENE SOUNDS', type: 'toggle', hint: 'Play the sounds of the scenery: rain, thunder, wind, wheat, water, birds and more.' },
        { key: 'soundPack', label: 'SOUND PACK', type: 'enum', values: ['ulol', 'arcade', 'bubbly'], describe: v => SOUND_PACK_LABELS[v] || v, hint: 'The set of effect sounds. All are synthesized; none are recordings.' },
        { key: 'soundtrack', label: 'SOUNDTRACK', type: 'enum', values: ['auto', 'casual', 'competitive', 'intense', 'off'], describe: describeSoundtrack, hint: 'Which playlist plays. Auto plays casual in the menu, Casual and 40 Lines, and intense in Blitz.' },
        { key: 'track', label: 'TRACK', type: 'enum', values: ['auto', ...TRACK_IDS], describe: v => (v === 'auto' ? 'Auto (playlist)' : TRACK_INFO[v].name), hint: 'Loop one track from the soundtrack instead of the playlist. You can also pick one on the MUSIC tab.' },
        { key: 'crossfadeDuration', label: 'PLAYER CROSSFADE', type: 'range', describe: describeCrossfade, hint: 'Fade between songs in the music player that plays your own files.' },
    ] },
    { id: 'visual', label: 'VISUAL', settings: [
        { key: 'blockSkin', label: 'BLOCK SKIN', type: 'enum', values: SKINS, describe: describeSkin, hint: 'How the blocks are drawn.' },
        { key: 'statsDisplay', label: 'STATS DISPLAY', type: 'enum', values: ['off', 'time', 'speed', 'efficiency', 'versus'], describe: describeStatsDisplay, hint: 'Which numbers sit at the bottom left of the board.' },
        { key: 'background', label: 'BACKGROUND', type: 'enum', values: ['on', 'dim', 'off'], describe: describeEnum, hint: 'The pixel art scenery behind the game. Dim darkens it; off also silences scene sounds.' },
        { key: 'casualScene', label: 'CASUAL SCENE', type: 'enum', values: ['cycle', ...CASUAL_SCENES], describe: describeScene, hint: 'Which scene Casual shows. Cycle changes the scene every level.' },
        { key: 'weather', label: 'WEATHER', type: 'enum', values: ['default', 'cycle', ...VARIANTS], describe: describeWeather, hint: 'Scene default gives each scene its own look. Cycle changes the weather every Casual level. Or pick one for every scene.' },
        { key: 'ghostOpacity', label: 'GHOST OPACITY', type: 'range', describe: describeOpacity, hint: 'How visible the ghost piece is, where the piece will land.' },
        { key: 'showActionText', label: 'CLEAR TEXT', type: 'toggle', hint: 'Show the name of each clear, T-spin and combo beside the board.' },
    ] },
    { id: 'effects', label: 'FX', settings: [
        { key: 'boardBounce', label: 'BOARD BOUNCE', type: 'enum', values: LEVELS, describe: describeEnum, hint: 'The board springs on hard drops, clears and wall bumps.' },
        { key: 'placeImpact', label: 'PLACE IMPACT', type: 'enum', values: LEVELS, describe: describeEnum, hint: 'Drop trail, landing flash and dust when a piece locks.' },
        { key: 'clearEffects', label: 'CLEAR EFFECTS', type: 'enum', values: LEVELS, describe: describeEnum, hint: 'Row flashes, bursts, T-spin spirals, sparkles and confetti.' },
        { key: 'screenShake', label: 'SCREEN SHAKE', type: 'enum', values: LEVELS, describe: describeEnum, hint: 'The board shakes on big clears.' },
    ] },
    { id: 'gameplay', label: 'GAME', settings: [
        { key: 'gameStyle', label: 'GAME STYLE', type: 'enum', values: ['modern', 'battle'], describe: describeGameStyle, hint: 'Modern spawns the next piece at once. Battle pauses on line clears and adds an entry delay. Read when a game starts.' },
        { key: 'nextPreviewCount', label: 'NEXT PIECES', type: 'range', describe: describePreviewCount, hint: 'How many upcoming pieces are shown.' },
        { key: 'lockDelay', label: 'LOCK DELAY', type: 'range', describe: describeLockDelay, hint: 'How long a piece can rest on the stack before it locks.' },
        { key: 'touchControls', label: 'TOUCH CONTROLS', type: 'enum', values: ['auto', 'on', 'off'], describe: describeEnum, hint: 'On-screen buttons for phones and tablets. Auto shows them on touch devices.' },
    ] },
];

/** Find a setting's definition by key. */
export function findSetting(key) {
    for (const tab of SETTINGS_TABS) {
        const def = tab.settings.find(s => s.key === key);
        if (def) return def;
    }
    return null;
}
