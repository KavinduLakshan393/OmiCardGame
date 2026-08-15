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

class Player {
    constructor(id, name, isAI = true) {
        this.id = id;
        this.name = name;
        this.isAI = isAI;
        this.hand = [];
    }

    addCards(cards) {
        this.hand.push(...cards);
    }
}

class Team {
    constructor(id, name, players) {
        this.id = id;
        this.name = name;
        this.players = players;
        this.tricksWon = 0;
    }
}

class Game {
    constructor() {
        this.players = [
            new Player(0, 'You', false),
            new Player(1, 'Player 2 (Left)'),
            new Player(2, 'Player 3 (Partner)'),
            new Player(3, 'Player 4 (Right)')
        ];
        
        this.teams = [
            new Team(0, 'Team NS (You & P3)', [this.players[0], this.players[2]]),
            new Team(1, 'Team EW (P2 & P4)', [this.players[1], this.players[3]])
        ];
        
        this.deck = new Deck();
        this.trumpSuit = null;
        this.trumpCaller = null;
        this.currentTrick = [];
        this.turnIndex = 0;
    }

    initRound() {
        this.deck = new Deck();
        this.deck.shuffle();
        this.teams.forEach(t => t.tricksWon = 0);
        this.players.forEach(p => p.hand = []);
        this.trumpSuit = null;
        this.currentTrick = [];
    }

    dealInitialCards() {
        for (let i = 0; i < 4; i++) {
            for (let player of this.players) {
                player.addCards([this.deck.cards.pop()]);
            }
        }
    }

    dealRemainingCards() {
        for (let i = 0; i < 4; i++) {
            for (let player of this.players) {
                player.addCards([this.deck.cards.pop()]);
            }
        }
    }
}

const game = new Game();

// UI Logic
function getSuitSymbol(suit) {
    switch (suit) {
        case 'Hearts': return '♥';
        case 'Diamonds': return '♦';
        case 'Clubs': return '♣';
        case 'Spades': return '♠';
    }
}

function renderCard(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'card';
    if (hidden) {
        div.classList.add('hidden-card');
        return div;
    }
    
    if (card.suit === 'Hearts' || card.suit === 'Diamonds') {
        div.classList.add('red');
    } else {
        div.classList.add('black');
    }
    
    div.innerHTML = `<span>${card.rank}</span><span>${getSuitSymbol(card.suit)}</span>`;
    return div;
}

function renderHand(playerId, cards, hidden = false) {
    const containerId = `p${playerId}-hand`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    cards.forEach(card => {
        const cardEl = renderCard(card, hidden);
        container.appendChild(cardEl);
    });
}

function updateUI() {
    game.players.forEach(player => {
        renderHand(player.id, player.hand, player.isAI);
    });
    const indicator = document.getElementById('trump-suit');
    indicator.textContent = game.trumpSuit ? game.trumpSuit : '-';
}

document.getElementById('start-game-btn').addEventListener('click', () => {
    game.initRound();
    game.dealInitialCards();
    updateUI();
    document.getElementById('start-game-btn').style.display = 'none';
});
