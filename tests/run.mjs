// Bundles each tests/*.test.mjs for Node with esbuild, then runs it.
import { build } from 'esbuild';
import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';

const dir = new URL('.', import.meta.url);
let failed = false;
for (const file of readdirSync(dir).filter(f => f.endsWith('.test.mjs'))) {
    const outfile = new URL(`.out/${file}`, dir).pathname.replace(/^\/([A-Z]:)/, '$1');
    await build({
        entryPoints: [new URL(file, dir).pathname.replace(/^\/([A-Z]:)/, '$1')],
        bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'warning',
    });
    console.log(`\n# ${file}`);
    try {
        execFileSync(process.execPath, [outfile], { stdio: 'inherit' });
    } catch {
        failed = true;
    }
}
process.exit(failed ? 1 : 0);
