import test from 'node:test';
import assert from 'node:assert/strict';
import { Card, getLegalCardIndices } from '../src/engine/index.js';

test('all cards are legal when leading a trick', () => {
    const hand = [new Card('Hearts', 'A'), new Card('Clubs', '7')];
    assert.deepEqual(getLegalCardIndices(hand, []), [0, 1]);
});

test('player must follow the lead suit when able', () => {
    const hand = [
        new Card('Hearts', 'A'),
        new Card('Clubs', '7'),
        new Card('Hearts', '8'),
    ];
    const trick = [{ player: 2, card: new Card('Hearts', '10') }];

    assert.deepEqual(getLegalCardIndices(hand, trick), [0, 2]);
});

test('player may play any card when void in the lead suit', () => {
    const hand = [new Card('Spades', 'A'), new Card('Clubs', '7')];
    const trick = [{ player: 2, card: new Card('Hearts', '10') }];

    assert.deepEqual(getLegalCardIndices(hand, trick), [0, 1]);
});
