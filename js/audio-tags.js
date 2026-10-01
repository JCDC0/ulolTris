/**
 * audio-tags.js - Reads the title, artist and cover image out of a listener's audio file, so
 * the music screens can show them. Supports MP3 (ID3v2.2, 2.3 and 2.4), FLAC and M4A/MP4.
 * Other formats (OGG, WAV, Opus) just have no tags; the player then uses the file name.
 *
 * Only the start of a file is read (and, for M4A, the one atom that holds the tags), never
 * the whole song. Every reader is forgiving: a file it cannot make sense of gives no tags
 * instead of an error.
 */

/** Most of a file read looking for tags; covers can be a few megabytes. */
const MAX_HEAD = 12 * 1024 * 1024;

const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u32le = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const u24 = (b, at) => (b[at] << 16) | (b[at + 1] << 8) | b[at + 2];
const synchsafe = (b, at) => ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f);

/** Decode ID3 text: encoding 0 is Latin-1, 1 is UTF-16 with a byte order mark, 2 is UTF-16BE, 3 is UTF-8. */
function decodeText(bytes, encoding) {
    let text;
    if (encoding === 1 || encoding === 2) {
        let label = encoding === 2 ? 'utf-16be' : 'utf-16le';
        let body = bytes;
        if (bytes[0] === 0xff && bytes[1] === 0xfe) { label = 'utf-16le'; body = bytes.subarray(2); }
        else if (bytes[0] === 0xfe && bytes[1] === 0xff) { label = 'utf-16be'; body = bytes.subarray(2); }
        text = new TextDecoder(label).decode(body);
    } else text = new TextDecoder(encoding === 3 ? 'utf-8' : 'windows-1252').decode(bytes);
    return text.replace(/\0+$/, '').trim();
}

/** The index just past the terminator of a string that starts at `at`, for this encoding. */
function pastTerminator(bytes, at, encoding) {
    if (encoding === 1 || encoding === 2) {
        for (let i = at; i + 1 < bytes.length; i += 2) if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2;
        return bytes.length;
    }
    const i = bytes.indexOf(0, at);
    return i < 0 ? bytes.length : i + 1;
}

const IMAGE_TYPES = { PNG: 'image/png', JPG: 'image/jpeg', JPEG: 'image/jpeg' };

/** Read an ID3v2 tag from the start of `bytes`. Returns null if there is none. */
export function readId3(bytes) {
    if (ascii(bytes, 0, 3) !== 'ID3') return null;
    const version = bytes[3];
    if (version < 2 || version > 4) return null;
    let p = 10;
    const end = Math.min(bytes.length, 10 + synchsafe(bytes, 6));
    if (bytes[5] & 0x40 && version >= 3) p += version === 4 ? synchsafe(bytes, p) : u32(bytes, p) + 4;
    const header = version === 2 ? 6 : 10;
    const tags = {};
    let cover = null;
    while (p + header <= end) {
        const id = ascii(bytes, p, version === 2 ? 3 : 4);
        if (!/^[A-Z0-9]+$/.test(id)) break;
        const length = version === 2 ? u24(bytes, p + 3) : version === 4 ? synchsafe(bytes, p + 4) : u32(bytes, p + 4);
        const body = bytes.subarray(p + header, Math.min(end, p + header + length));
        p += header + length;
        if (id === 'TIT2' || id === 'TT2') tags.title = decodeText(body.subarray(1), body[0]);
        else if (id === 'TPE1' || id === 'TP1') tags.artist = decodeText(body.subarray(1), body[0]);
        else if (id === 'TALB' || id === 'TAL') tags.album = decodeText(body.subarray(1), body[0]);
        else if (id === 'APIC' || id === 'PIC') {
            const encoding = body[0];
            let q = 1;
            let type;
            if (id === 'PIC') { type = IMAGE_TYPES[ascii(body, 1, 3).toUpperCase()]; q = 4; }
            else {
                const z = body.indexOf(0, 1);
                type = ascii(body, 1, Math.max(0, z - 1)) || 'image/jpeg';
                q = z + 1;
            }
            const pictureType = body[q];
            q = pastTerminator(body, q + 1, encoding);
            // Keep the front cover if there are several pictures, otherwise the first one
            if (type && type !== '-->' && (!cover || pictureType === 3) && body.length > q) cover = new Blob([body.slice(q)], { type });
        }
    }
    if (cover) tags.image = cover;
    return tags;
}

/** Read the Vorbis comments and pictures of a FLAC file's metadata blocks. Null if not FLAC. */
export function readFlac(bytes) {
    if (ascii(bytes, 0, 4) !== 'fLaC') return null;
    const tags = {};
    let p = 4;
    while (p + 4 <= bytes.length) {
        const last = bytes[p] & 0x80;
        const type = bytes[p] & 0x7f;
        const length = u24(bytes, p + 1);
        const body = bytes.subarray(p + 4, p + 4 + length);
        p += 4 + length;
        if (type === 4) {
            let q = 4 + u32le(body, 0);
            const count = u32le(body, q);
            q += 4;
            for (let i = 0; i < count && q + 4 <= body.length; i++) {
                const size = u32le(body, q);
                const comment = new TextDecoder('utf-8').decode(body.subarray(q + 4, q + 4 + size));
                q += 4 + size;
                const eq = comment.indexOf('=');
                const key = comment.slice(0, eq).toUpperCase();
                if (key === 'TITLE') tags.title = comment.slice(eq + 1);
                else if (key === 'ARTIST') tags.artist = comment.slice(eq + 1);
                else if (key === 'ALBUM') tags.album = comment.slice(eq + 1);
            }
        } else if (type === 6) {
            const pictureType = u32(body, 0);
            const mimeLength = u32(body, 4);
            const mime = ascii(body, 8, mimeLength);
            let q = 8 + mimeLength;
            q += 4 + u32(body, q);          // description
            q += 16;                        // width, height, depth, colors
            const size = u32(body, q);
            if (!tags.image || pictureType === 3) tags.image = new Blob([body.slice(q + 4, q + 4 + size)], { type: mime || 'image/jpeg' });
        }
        if (last) break;
    }
    return tags;
}

/** Walk the atoms between `start` and `end`: calls `visit(type, payloadStart, payloadEnd)`. */
function atoms(bytes, start, end, visit) {
    let p = start;
    while (p + 8 <= end) {
        let size = u32(bytes, p);
        const type = ascii(bytes, p + 4, 4);
        let header = 8;
        if (size === 1) { size = u32(bytes, p + 12); header = 16; }
        if (size === 0) size = end - p;
        if (size < header) break;
        visit(type, p + header, Math.min(end, p + size));
        p += size;
    }
}

/** Read the tags out of an MP4 `moov` atom (the bytes of the whole atom, header included). */
export function readMoov(bytes) {
    const tags = {};
    const find = (from, to, path, fn) => {
        atoms(bytes, from, to, (type, a, b) => {
            if (type !== path[0]) return;
            if (path.length === 1) fn(a, b);
            else find(type === 'meta' ? a + 4 : a, b, path.slice(1), fn);
        });
    };
    find(8, bytes.length, ['udta', 'meta', 'ilst'], (from, to) => {
        atoms(bytes, from, to, (type, a, b) => {
            atoms(bytes, a, b, (inner, c, d) => {
                if (inner !== 'data') return;
                const flags = u24(bytes, c + 1);
                const payload = bytes.subarray(c + 8, d);
                if (type === '©nam') tags.title = new TextDecoder('utf-8').decode(payload);
                else if (type === '©ART') tags.artist = new TextDecoder('utf-8').decode(payload);
                else if (type === '©alb') tags.album = new TextDecoder('utf-8').decode(payload);
                else if (type === 'covr') tags.image = new Blob([payload.slice()], { type: flags === 14 ? 'image/png' : 'image/jpeg' });
            });
        });
    });
    return tags;
}

/** Find the `moov` atom of an MP4 file by hopping from atom to atom, and read only that. */
async function readMp4(file) {
    let offset = 0;
    while (offset + 8 <= file.size) {
        const head = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
        let size = u32(head, 0);
        if (size === 1) size = u32(head, 12);
        if (size < 8) return null;
        if (ascii(head, 4, 4) === 'moov') {
            if (size > MAX_HEAD) return null;
            return readMoov(new Uint8Array(await file.slice(offset, offset + size).arrayBuffer()));
        }
        offset += size;
    }
    return null;
}

/**
 * The tags of an audio file.
 * @param {Blob} file - a File from an input or a drop
 * @returns {Promise<{ title?: string, artist?: string, album?: string, image?: Blob }>} empty if there are none
 */
export async function readTags(file) {
    try {
        const first = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (ascii(first, 0, 3) === 'ID3') {
            const size = synchsafe(first, 6) + 10;
            return readId3(new Uint8Array(await file.slice(0, Math.min(size, MAX_HEAD)).arrayBuffer())) || {};
        }
        if (ascii(first, 0, 4) === 'fLaC') return readFlac(new Uint8Array(await file.slice(0, MAX_HEAD).arrayBuffer())) || {};
        if (ascii(first, 4, 4) === 'ftyp') return (await readMp4(file)) || {};
    } catch { /* an odd file just has no tags */ }
    return {};
}
