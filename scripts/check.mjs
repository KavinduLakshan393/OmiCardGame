import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectJavaScript(path) {
    if (statSync(path).isFile()) return path.endsWith('.js') ? [path] : [];
    return readdirSync(path).flatMap(name => collectJavaScript(join(path, name)));
}

const files = ['script.js', ...collectJavaScript('src')];

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
