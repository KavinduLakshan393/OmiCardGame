import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

test('Single Player v1 release metadata is frozen at 1.0.0', () => {
    assert.equal(packageJson.version, '1.0.0');
    assert.equal(packageJson.private, true);
    assert.ok(packageJson.scripts.verify);
});

test('release documentation and QA checklist are committed', () => {
    for (const path of [
        'docs/batch-6-notes.md',
        'docs/release-qa.md',
        'docs/single-player-v1-release.md',
    ]) {
        assert.equal(existsSync(path), true, `${path} should exist`);
    }
});
