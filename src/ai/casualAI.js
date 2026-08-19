import { SUITS } from '../engine/constants.js';

function randomIndex(length, rng) {
    if (length <= 0) throw new RangeError('Cannot select from an empty collection');
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError('AI rng must return a finite number in [0, 1)');
    }
    return Math.floor(value * length);
}

/** Beginner-friendly AI: always legal, intentionally low-complexity. */
export function chooseCasualTrump(_knowledge, rng = Math.random) {
    return SUITS[randomIndex(SUITS.length, rng)];
}

export function chooseCasualCard(knowledge, rng = Math.random) {
    if (knowledge.legalCards.length === 0) {
        throw new Error('Casual AI has no legal card to play');
    }
    return knowledge.legalCards[randomIndex(knowledge.legalCards.length, rng)].cardId;
}
