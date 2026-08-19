import test from 'node:test';
import assert from 'node:assert/strict';
import { Card, resolveTrick } from '../src/engine/index.js';

test('highest card of lead suit wins when no trump is played', () => {
    const trick = [
        { player: 0, card: new Card('Clubs', 'Q') },
        { player: 3, card: new Card('Clubs', 'A') },
        { player: 2, card: new Card('Diamonds', 'K') },
        { player: 1, card: new Card('Clubs', 'K') },
    ];

    assert.equal(resolveTrick(trick, 'Hearts').winner, 3);
});

test('a trump card beats a higher ranked non-trump card', () => {
    const trick = [
        { player: 0, card: new Card('Clubs', 'A') },
        { player: 3, card: new Card('Hearts', '7') },
        { player: 2, card: new Card('Clubs', 'K') },
        { player: 1, card: new Card('Clubs', 'Q') },
    ];

    assert.equal(resolveTrick(trick, 'Hearts').winner, 3);
});

test('highest trump wins when multiple trump cards are played', () => {
    const trick = [
        { player: 0, card: new Card('Clubs', 'A') },
        { player: 3, card: new Card('Hearts', '7') },
        { player: 2, card: new Card('Hearts', 'K') },
        { player: 1, card: new Card('Hearts', '10') },
    ];

    assert.equal(resolveTrick(trick, 'Hearts').winner, 2);
});
