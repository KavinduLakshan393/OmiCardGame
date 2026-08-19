import { RANKS, SUITS } from './constants.js';
import { Card } from './cards.js';

/**
 * Standard 32-card Omi deck.
 *
 * A random-number function can be injected for deterministic tests. It must
 * behave like Math.random() and return a number in the range [0, 1).
 */
export class Deck {
    constructor({ rng = Math.random, autoShuffle = true } = {}) {
        if (typeof rng !== 'function') {
            throw new TypeError('rng must be a function');
        }

        this.rng = rng;
        this.cards = [];
        this.populate();
        if (autoShuffle) this.shuffle();
    }

    populate() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i -= 1) {
            const sample = this.rng();
            if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
                throw new RangeError('rng must return a finite number in [0, 1)');
            }
            const j = Math.floor(sample * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        return this;
    }

    deal(count) {
        if (!Number.isInteger(count) || count < 0) {
            throw new RangeError(`Invalid deal count: ${count}`);
        }
        if (count > this.cards.length) {
            throw new RangeError(`Cannot deal ${count} cards; only ${this.cards.length} remain`);
        }
        return this.cards.splice(this.cards.length - count, count);
    }

    get remaining() {
        return this.cards.length;
    }
}
