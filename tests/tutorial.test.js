import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_STEPS } from '../src/ui/tutorialData.js';

test('tutorial contains the planned eleven steps in stable order', () => {
    assert.equal(TUTORIAL_STEPS.length, 11);
    assert.deepEqual(
        TUTORIAL_STEPS.map(step => step.id),
        [
            'teams',
            'deck',
            'ranking',
            'trump',
            'leading',
            'follow-suit',
            'trump-power',
            'resolve-trick',
            'scoring',
            'tie-and-target',
            'strategy',
        ],
    );
});

test('every tutorial step contains complete instructional content', () => {
    for (const step of TUTORIAL_STEPS) {
        assert.ok(step.kicker.length > 0, `${step.id} requires a kicker`);
        assert.ok(step.title.length > 0, `${step.id} requires a title`);
        assert.ok(step.body.length > 0, `${step.id} requires body copy`);
        assert.ok(step.bullets.length > 0, `${step.id} requires at least one rule bullet`);
        assert.ok(step.visual.length > 0, `${step.id} requires a visual key`);
        assert.ok(step.caption.length > 0, `${step.id} requires a caption`);
    }
});

test('tutorial standard-rule statements match Batch 1 engine baseline', () => {
    const allText = TUTORIAL_STEPS
        .flatMap(step => [step.title, step.body, ...step.bullets])
        .join(' ');

    assert.match(allText, /32 cards/i);
    assert.match(allText, /No Joker/i);
    assert.match(allText, /counter-clockwise/i);
    assert.match(allText, /Passing is not available/i);
    assert.match(allText, /5–7 tricks → 1 base token/);
    assert.match(allText, /5–7 tricks → 2 base tokens/);
    assert.match(allText, /8-trick Kapothi → 3 base tokens/);
    assert.match(allText, /4–4/);
    assert.match(allText, /10 tokens/i);
});
