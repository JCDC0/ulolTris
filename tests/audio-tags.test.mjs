import { readTags, readId3, readFlac, readMoov } from '../js/audio-tags.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

// Files are built by hand here, byte by byte, the way the formats lay them out.
const flat = x => (typeof x === 'number' ? [x] : typeof x === 'string' ? [...x].map(c => c.charCodeAt(0)) : Array.from(x).flatMap(flat));
const bytes = (...parts) => Uint8Array.from(flat(parts));
const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = n => be32(n).reverse();
const synch = n => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const utf8 = s => [...new TextEncoder().encode(s)];
const PNG = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5, 6, 7, 8];
const JPG = [255, 216, 255, 224, 9, 9, 9, 9];

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const read = async blob => new Uint8Array(await blob.arrayBuffer());

// --- ID3v2.3: Latin-1 text and an APIC frame ---
function id3v23(frames) {
    const body = frames.flat();
    return bytes('ID3', 3, 0, 0, synch(body.length), body);
}
const frame23 = (id, body) => [...bytes(id, be32(body.length), 0, 0), ...body];
{
    const file = id3v23([
        frame23('TIT2', [0, ...utf8('Song Title')]),
        frame23('TPE1', [0, ...utf8('An Artist')]),
        frame23('TALB', [0, ...utf8('The Album')]),
        frame23('APIC', [0, ...utf8('image/png'), 0, 3, 0, ...PNG]),
    ]);
    const tags = readId3(file);
    check('ID3v2.3: title, artist and album', tags.title === 'Song Title' && tags.artist === 'An Artist' && tags.album === 'The Album', JSON.stringify({ t: tags.title, a: tags.artist }));
    check('ID3v2.3: the cover picture comes out intact', tags.image?.type === 'image/png' && same([...(await read(tags.image))], PNG));
}

// --- ID3v2.4: UTF-16 text with a byte order mark, synchsafe frame sizes, a front cover after another picture ---
{
    const utf16 = s => [0xff, 0xfe, ...[...s].flatMap(c => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])];
    const frame24 = (id, body) => [...bytes(id, synch(body.length), 0, 0), ...body];
    const body = [
        frame24('TIT2', [1, ...utf16('Tïle')]),
        frame24('APIC', [0, ...utf8('image/jpeg'), 0, 0, 0, ...JPG]),
        frame24('APIC', [0, ...utf8('image/png'), 0, 3, 0, ...PNG]),
    ].flat();
    const tags = readId3(bytes('ID3', 4, 0, 0, synch(body.length), body));
    check('ID3v2.4: UTF-16 text is decoded', tags.title === 'Tïle', tags.title);
    check('ID3v2.4: the front cover wins over another picture', tags.image?.type === 'image/png');
}

// --- ID3v2.2: three letter ids and a PIC frame ---
{
    const frame22 = (id, body) => [...bytes(id, [(body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]), ...body];
    const body = [frame22('TT2', [0, ...utf8('Old Tag')]), frame22('TP1', [0, ...utf8('Old Artist')]), frame22('PIC', [0, ...utf8('JPG'), 3, 0, ...JPG])].flat();
    const tags = readId3(bytes('ID3', 2, 0, 0, synch(body.length), body));
    check('ID3v2.2: title, artist and a JPG cover', tags.title === 'Old Tag' && tags.artist === 'Old Artist' && tags.image?.type === 'image/jpeg');
}

// --- FLAC: a stream info block, Vorbis comments and a picture ---
{
    const comment = s => [...le32(utf8(s).length), ...utf8(s)];
    const vorbis = [...le32(4), ...utf8('test'), ...le32(3), ...comment('TITLE=Flac Song'), ...comment('artist=Flac Artist'), ...comment('GENRE=x')];
    const picture = [...be32(3), ...be32(9), ...utf8('image/png'), ...be32(0), ...be32(32), ...be32(32), ...be32(24), ...be32(0), ...be32(PNG.length), ...PNG];
    const block = (type, body, last) => [(last ? 128 : 0) | type, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255, ...body];
    const file = bytes('fLaC', block(0, new Array(34).fill(0), false), block(4, vorbis, false), block(6, picture, true), 255, 248);
    const tags = readFlac(file);
    check('FLAC: title and artist from the Vorbis comments (any case of key)', tags.title === 'Flac Song' && tags.artist === 'Flac Artist');
    check('FLAC: the picture block comes out intact', tags.image?.type === 'image/png' && same([...(await read(tags.image))], PNG));
}

// --- MP4 / M4A: tags live in moov > udta > meta > ilst, after the audio ---
const atom = (type, ...payload) => { const body = flat(payload); return [...be32(body.length + 8), ...flat(type), ...body]; };
const item = (type, flags, payload) => atom(type, atom('data', [0, 0, 0, flags], be32(0), payload));
function mp4() {
    const ilst = atom('ilst', item('©nam', 1, utf8('M4A Song')), item('©ART', 1, utf8('M4A Artist')), item('covr', 14, PNG));
    const meta = atom('meta', [0, 0, 0, 0], ilst);
    const moov = atom('moov', atom('mvhd', new Array(20).fill(0)), atom('udta', meta));
    return bytes(atom('ftyp', 'M4A ', be32(0), 'M4A '), atom('mdat', new Array(40).fill(7)), moov);
}
{
    const file = mp4();
    const tags = await readTags(new Blob([file]));
    check('M4A: found past the audio data, with title and artist', tags.title === 'M4A Song' && tags.artist === 'M4A Artist', JSON.stringify({ t: tags.title }));
    check('M4A: the cover is a PNG (flags 14) and intact', tags.image?.type === 'image/png' && same([...(await read(tags.image))], PNG));
    const moov = readMoov(bytes(atom('moov', atom('udta', atom('meta', [0, 0, 0, 0], atom('ilst', item('covr', 13, JPG)))))));
    check('M4A: flags 13 are JPEG', moov.image?.type === 'image/jpeg');
}

// --- Through the front door: any file, including broken ones ---
{
    const mp3 = await readTags(new Blob([id3v23([frame23('TIT2', [0, ...utf8('Via readTags')])]), new Uint8Array(200)]));
    check('readTags picks the reader by the start of the file', mp3.title === 'Via readTags');
    check('an unknown format has no tags and no error', Object.keys(await readTags(new Blob([bytes('OggS', new Array(60).fill(1))]))).length === 0);
    check('an empty file has no tags and no error', Object.keys(await readTags(new Blob([]))).length === 0);
    const cut = id3v23([frame23('TIT2', [0, ...utf8('Cut short')]), frame23('APIC', [0, ...utf8('image/png'), 0, 3, 0, ...PNG])]);
    const partial = await readTags(new Blob([cut.slice(0, 40)]));
    check('a truncated tag does not throw', typeof partial === 'object');
    const junk = await readTags(new Blob([new Uint8Array(300).map((_, i) => (i * 37) & 255)]));
    check('random bytes do not throw', typeof junk === 'object');
}

console.log(failures ? `\n${failures} FAILED` : '\nAll tag checks passed');
process.exit(failures ? 1 : 0);
