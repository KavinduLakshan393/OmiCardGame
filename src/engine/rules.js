import { SUITS } from './constants.js';

export function assertTrumpSuit(suit) {
    if (!SUITS.includes(suit)) {
        throw new RangeError(`Invalid trump suit: ${suit}`);
    }
}

export function leadSuitOf(currentTrick) {
    return currentTrick.length > 0 ? currentTrick[0].card.suit : null;
}

/**
 * Return the card indices the player is legally allowed to play.
 * Standard Omi requires a player to follow the led suit whenever possible.
 */
export function getLegalCardIndices(hand, currentTrick) {
    if (!Array.isArray(hand) || !Array.isArray(currentTrick)) {
        throw new TypeError('hand and currentTrick must be arrays');
    }

    if (currentTrick.length === 0) {
        return hand.map((_, index) => index);
    }

    const leadSuit = leadSuitOf(currentTrick);
    const matching = [];

    hand.forEach((card, index) => {
        if (card.suit === leadSuit) matching.push(index);
    });

    return matching.length > 0 ? matching : hand.map((_, index) => index);
}

export function isLegalPlay(hand, currentTrick, cardIndex) {
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) {
        return false;
    }
    return getLegalCardIndices(hand, currentTrick).includes(cardIndex);
}
