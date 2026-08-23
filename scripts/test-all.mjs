import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const testDir = 'tests';
const testFiles = readdirSync(testDir)
    .filter(file => file.endsWith('.test.js'))
    .sort();

console.log(`Running ${testFiles.length} test files sequentially...`);

for (const file of testFiles) {
    console.log(`\n--- ${file} ---`);
    try {
        await import(`../tests/${file}`);
    } catch (err) {
        console.error(`Failed loading ${file}:`, err);
    }
}
