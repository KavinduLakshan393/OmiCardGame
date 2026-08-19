import test from 'node:test';
import assert from 'node:assert/strict';
import { Deck, RANKS, SUITS } from '../src/engine/index.js';

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

test('standard Omi deck contains exactly 32 unique cards', () => {
    const deck = new Deck({ autoShuffle: false });
    assert.equal(deck.cards.length, 32);

    const ids = deck.cards.map(card => `${card.rank}-${card.suit}`);
    assert.equal(new Set(ids).size, 32);
});

test('standard Omi deck contains 8 ranks in each of 4 suits', () => {
    const deck = new Deck({ autoShuffle: false });

    for (const suit of SUITS) {
        const cards = deck.cards.filter(card => card.suit === suit);
        assert.equal(cards.length, 8);
        assert.deepEqual(cards.map(card => card.rank), RANKS);
    }
});

test('shuffle can be reproduced with the same injected RNG seed', () => {
    const first = new Deck({ rng: seededRng(847291) });
    const second = new Deck({ rng: seededRng(847291) });

    assert.deepEqual(first.cards, second.cards);
});
