const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }
    
    toString() {
        return `${this.rank} of ${this.suit}`;
    }
}

class Deck {
    constructor() {
        this.cards = this.buildDeck();
    }

    buildDeck() {
        const deck = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push(new Card(suit, rank));
            }
        }
        return deck;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
}
