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
    cards.forEach((card, index) => {
        const cardEl = renderCard(card, hidden);
        if (playerId === 0) {
            cardEl.addEventListener('click', () => {
                if (game.turnIndex === 0) {
                    playCard(0, index);
                }
            });
        }
        container.appendChild(cardEl);
    });
}

function updateUI() {
    game.players.forEach(player => {
        renderHand(player.id, player.hand, player.isAI);
    });
    const indicator = document.getElementById('trump-suit');
    indicator.textContent = game.trumpSuit ? game.trumpSuit : '-';
    
    const trickPositions = {0: 'bottom', 1: 'left', 2: 'top', 3: 'right'};
    Object.values(trickPositions).forEach(pos => {
        document.getElementById(`trick-${pos}`).innerHTML = '';
    });
    
    game.currentTrick.forEach(play => {
        const pos = trickPositions[play.player];
        const slot = document.getElementById(`trick-${pos}`);
        slot.appendChild(renderCard(play.card, false));
    });

    document.getElementById('ns-score').textContent = game.teams[0].tricksWon;
    document.getElementById('ew-score').textContent = game.teams[1].tricksWon;
}

document.getElementById('start-game-btn').addEventListener('click', () => {
    game.initRound();
    game.dealInitialCards();
    updateUI();
    document.getElementById('start-game-btn').style.display = 'none';
    
    game.trumpCaller = 1; // Left player is first caller
    
    if (game.players[game.trumpCaller].isAI) {
        setTimeout(() => {
            const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
            setTrump(suits[Math.floor(Math.random() * suits.length)]);
        }, 1000);
    } else {
        document.getElementById('modal-overlay').classList.remove('hidden');
    }
});

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const suit = e.target.dataset.suit;
        document.getElementById('modal-overlay').classList.add('hidden');
        setTrump(suit);
    });
});

function setTrump(suit) {
    game.trumpSuit = suit;
    game.dealRemainingCards();
    updateUI();
    processNextTurn(); // Start the game loop
}

function getRankValue(rank) {
    return RANKS.indexOf(rank);
}

function playCard(playerIndex, cardIndex) {
    const player = game.players[playerIndex];
    const card = player.hand[cardIndex];
    
    if (game.currentTrick.length > 0) {
        const ledSuit = game.currentTrick[0].card.suit;
        if (card.suit !== ledSuit) {
            const hasLedSuit = player.hand.some(c => c.suit === ledSuit);
            if (hasLedSuit) {
                if (playerIndex === 0) alert("You must follow suit!");
                return false;
            }
        }
    }
    
    player.hand.splice(cardIndex, 1);
    game.currentTrick.push({ player: playerIndex, card: card });
    updateUI();
    
    if (game.currentTrick.length === 4) {
        setTimeout(resolveTrick, 1500);
    } else {
        game.turnIndex = (game.turnIndex + 1) % 4;
        processNextTurn();
    }
    return true;
}

function resolveTrick() {
    const ledSuit = game.currentTrick[0].card.suit;
    let highestValue = -1;
    let winnerIndex = -1;
    
    for (let play of game.currentTrick) {
        let value = -1;
        if (play.card.suit === game.trumpSuit) {
            value = getRankValue(play.card.rank) + 100;
        } else if (play.card.suit === ledSuit) {
            value = getRankValue(play.card.rank);
        }
        
        if (value > highestValue) {
            highestValue = value;
            winnerIndex = play.player;
        }
    }
    
    const winningTeam = game.teams.find(t => t.players.some(p => p.id === winnerIndex));
    winningTeam.tricksWon++;
    
    game.currentTrick = [];
    game.turnIndex = winnerIndex;
    updateUI();
    processNextTurn();
}

function processNextTurn() {
    if (game.players[0].hand.length === 0 && game.currentTrick.length === 0) {
        const nsTricks = game.teams[0].tricksWon;
        const ewTricks = game.teams[1].tricksWon;
        
        let msg = `Round Over! NS: ${nsTricks}, EW: ${ewTricks}\n`;
        const callerTeam = game.teams.find(t => t.players.some(p => p.id === game.trumpCaller));
        
        if (callerTeam.tricksWon >= 5) {
            msg += `${callerTeam.name} won the round!`;
        } else {
            msg += `${callerTeam.name} failed to get 5 tricks. Opponents win!`;
        }
        
        alert(msg);
        document.getElementById('start-game-btn').style.display = 'block';
        document.getElementById('start-game-btn').textContent = 'Next Round';
        return;
    }
    
    if (game.players[game.turnIndex].isAI) {
        setTimeout(() => {
            const player = game.players[game.turnIndex];
            let validIndices = [];
            
            if (game.currentTrick.length > 0) {
                const ledSuit = game.currentTrick[0].card.suit;
                for (let i = 0; i < player.hand.length; i++) {
                    if (player.hand[i].suit === ledSuit) validIndices.push(i);
                }
            }
            
            if (validIndices.length === 0) {
                for (let i = 0; i < player.hand.length; i++) validIndices.push(i);
            }
            
            const randomValidIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
            playCard(game.turnIndex, randomValidIndex);
        }, 800);
    }
}
