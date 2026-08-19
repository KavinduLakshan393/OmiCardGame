import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync('script.js', 'utf8');

function functionBody(name) {
    const start = script.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const next = script.indexOf('\nfunction ', start + 1);
    return script.slice(start, next === -1 ? script.length : next);
}

test('final deal animation releases the dealing guard when engine phase advances', () => {
    const body = functionBody('handleDealBatchAnimation');
    assert.match(
        body,
        /runtime\.dealing\s*=\s*\[PHASE\.DEAL_INITIAL,\s*PHASE\.DEAL_REMAINING\]\.includes\(state\.phase\)/,
    );
});

test('human-turn hook clears dealing before enabling legal cards', () => {
    const body = functionBody('handleHumanTurn');
    const dealingReset = body.indexOf('runtime.dealing = false');
    const highlight = body.indexOf('highlightValidCards()');
    assert.ok(dealingReset >= 0, 'human turn must clear runtime.dealing');
    assert.ok(highlight > dealingReset, 'dealing guard must clear before card highlighting');
});

test('legal-card highlighting controls native button disabled state', () => {
    const body = functionBody('highlightValidCards');
    assert.match(body, /wrapper\.disabled\s*=\s*!legal/);
});
