import { RANKS, SUITS } from './constants.js';

export class Card {
    constructor(suit, rank) {
        if (!SUITS.includes(suit)) {
            throw new RangeError(`Invalid suit: ${suit}`);
        }
        if (!RANKS.includes(rank)) {
            throw new RangeError(`Invalid rank: ${rank}`);
        }

        this.suit = suit;
        this.rank = rank;
        Object.freeze(this);
    }
}

export function suitSymbol(suit) {
    return {
        Hearts: '♥',
        Diamonds: '♦',
        Clubs: '♣',
        Spades: '♠',
    }[suit] ?? '';
}

export function rankValue(rank) {
    const value = RANKS.indexOf(rank);
    if (value < 0) {
        throw new RangeError(`Invalid rank: ${rank}`);
    }
    return value;
}

export function isRed(suit) {
    return suit === 'Hearts' || suit === 'Diamonds';
}

export function cardId(card) {
    return `${card.rank}-${card.suit}`;
}
