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
        this.tokens = 0;
    }
}

class Game {
    constructor() {
        this.players = [
            new Player(0, 'You (South)', false),
            new Player(1, 'West', true),
            new Player(2, 'Partner (North)', true),
            new Player(3, 'East', true)
        ];
        
        this.teams = [
            new Team(0, 'Team NS (You & Partner)', [this.players[0], this.players[2]]),
            new Team(1, 'Team EW (West & East)', [this.players[1], this.players[3]])
        ];
        
        this.dealerIndex = 3; // East deals first, so South (You) calls trump on Round 1
        this.trumpCaller = 0;
        this.trumpSuit = null;
        this.deck = new Deck();
        this.currentTrick = [];
        this.turnIndex = 0;
        this.isProcessing = false;
    }

    initRound() {
        this.deck = new Deck();
        this.deck.shuffle();
        this.teams.forEach(t => t.tricksWon = 0);
        this.players.forEach(p => p.hand = []);
        this.trumpSuit = null;
        this.currentTrick = [];
        this.isProcessing = false;
        
        // Rotate trump caller (player to dealer's right)
        this.trumpCaller = (this.dealerIndex + 1) % 4;
        this.turnIndex = this.trumpCaller;
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

// Helper Functions
function getSuitSymbol(suit) {
    switch (suit) {
        case 'Hearts': return '♥';
        case 'Diamonds': return '♦';
        case 'Clubs': return '♣';
        case 'Spades': return '♠';
    }
}

function getRankValue(rank) {
    return RANKS.indexOf(rank);
}

// UI Rendering
function renderCard(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'card';
    if (hidden) {
        div.classList.add('hidden-card');
        return div;
    }
    
    const isRed = (card.suit === 'Hearts' || card.suit === 'Diamonds');
    div.classList.add(isRed ? 'red' : 'black');
    
    const symbol = getSuitSymbol(card.suit);
    div.innerHTML = `
        <div class="card-corner">
            <span>${card.rank}</span>
            <span>${symbol}</span>
        </div>
        <div class="card-center-suit">${symbol}</div>
        <div class="card-corner card-bottom">
            <span>${card.rank}</span>
            <span>${symbol}</span>
        </div>
    `;
    return div;
}

function renderHand(playerId, cards, hidden = false) {
    const containerId = `p${playerId}-hand`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    cards.forEach((card, index) => {
        const cardEl = renderCard(card, hidden);
        if (playerId === 0 && !hidden) {
            cardEl.addEventListener('click', () => {
                if (game.turnIndex === 0 && !game.isProcessing) {
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
    
    // Update Trump Display
    const iconEl = document.getElementById('trump-suit-icon');
    const callerEl = document.getElementById('trump-caller-name');
    
    if (game.trumpSuit) {
        iconEl.textContent = getSuitSymbol(game.trumpSuit);
        iconEl.style.color = (game.trumpSuit === 'Hearts' || game.trumpSuit === 'Diamonds') ? '#e84118' : '#f5f6fa';
        callerEl.textContent = `Called by ${game.players[game.trumpCaller].name}`;
    } else {
        iconEl.textContent = '-';
        iconEl.style.color = '#fff';
        callerEl.textContent = '';
    }
    
    // Update Trick Slot Cards
    const trickPositions = { 0: 'bottom', 1: 'left', 2: 'top', 3: 'right' };
    Object.values(trickPositions).forEach(pos => {
        document.getElementById(`trick-${pos}`).innerHTML = '';
    });
    
    game.currentTrick.forEach(play => {
        const pos = trickPositions[play.player];
        const slot = document.getElementById(`trick-${pos}`);
        if (slot) {
            slot.appendChild(renderCard(play.card, false));
        }
    });

    // Update Scoreboard
    document.getElementById('ns-tricks').textContent = game.teams[0].tricksWon;
    document.getElementById('ns-tokens').textContent = game.teams[0].tokens;
    document.getElementById('ew-tricks').textContent = game.teams[1].tricksWon;
    document.getElementById('ew-tokens').textContent = game.teams[1].tokens;

    // Update Turn Badges & Player Highlights
    game.players.forEach(player => {
        const pArea = document.getElementById(`player-${player.id}`);
        const badge = pArea ? pArea.querySelector('.turn-badge') : null;
        if (pArea && badge) {
            if (player.id === game.turnIndex) {
                pArea.classList.add('active-turn');
                badge.classList.remove('hidden');
                badge.textContent = player.isAI ? 'Thinking...' : 'Your Turn!';
            } else {
                pArea.classList.remove('active-turn');
                badge.classList.add('hidden');
            }
        }
    });
}

function updateStatus(message) {
    const banner = document.getElementById('status-message');
    if (banner) {
        banner.textContent = message;
    }
}

// Game Flow Logic
document.getElementById('start-game-btn').addEventListener('click', startRound);

function startRound() {
    document.getElementById('start-game-btn').style.display = 'none';
    game.initRound();
    game.dealInitialCards();
    updateUI();
    
    const callerName = game.players[game.trumpCaller].name;
    updateStatus(`${callerName} is selecting Trump...`);
    
    if (game.trumpCaller === 0) {
        // Human player selects trump
        showTrumpModal();
    } else {
        // AI selects trump after brief delay
        setTimeout(() => {
            const aiHand = game.players[game.trumpCaller].hand;
            // Pick suit with maximum cards or highest rank
            const suitCounts = {};
            SUITS.forEach(s => suitCounts[s] = 0);
            aiHand.forEach(c => suitCounts[c.suit]++);
            
            let bestSuit = SUITS[0];
            let maxCount = -1;
            SUITS.forEach(s => {
                if (suitCounts[s] > maxCount) {
                    maxCount = suitCounts[s];
                    bestSuit = s;
                }
            });
            setTrump(bestSuit);
        }, 1200);
    }
}

function showTrumpModal() {
    const previewContainer = document.getElementById('initial-hand-preview');
    previewContainer.innerHTML = '';
    game.players[0].hand.forEach(card => {
        previewContainer.appendChild(renderCard(card, false));
    });
    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const suit = e.currentTarget.dataset.suit;
        document.getElementById('modal-overlay').classList.add('hidden');
        setTrump(suit);
    });
});

function setTrump(suit) {
    game.trumpSuit = suit;
    game.dealRemainingCards();
    updateUI();
    
    const callerName = game.players[game.trumpCaller].name;
    updateStatus(`${callerName} chose ${suit} as Trump! Game starts.`);
    processTurn();
}

function processTurn() {
    if (game.isProcessing) return;
    
    updateUI();
    const activePlayer = game.players[game.turnIndex];
    
    if (activePlayer.id === 0) {
        updateStatus("Your turn! Click a card to play.");
    } else {
        updateStatus(`Waiting for ${activePlayer.name}...`);
        setTimeout(() => {
            playAITurn(activePlayer.id);
        }, 900);
    }
}

function playCard(playerIndex, cardIndex) {
    if (game.isProcessing) return false;
    
    const player = game.players[playerIndex];
    const card = player.hand[cardIndex];
    
    // Follow suit rule
    if (game.currentTrick.length > 0) {
        const ledSuit = game.currentTrick[0].card.suit;
        if (card.suit !== ledSuit) {
            const hasLedSuit = player.hand.some(c => c.suit === ledSuit);
            if (hasLedSuit) {
                if (playerIndex === 0) {
                    updateStatus(`You must follow suit (${ledSuit})!`);
                }
                return false;
            }
        }
    }
    
    player.hand.splice(cardIndex, 1);
    game.currentTrick.push({ player: playerIndex, card: card });
    updateUI();
    
    if (game.currentTrick.length === 4) {
        game.isProcessing = true;
        setTimeout(resolveTrick, 1200);
    } else {
        game.turnIndex = (game.turnIndex + 1) % 4;
        processTurn();
    }
    return true;
}

function playAITurn(aiIndex) {
    if (game.turnIndex !== aiIndex || game.isProcessing) return;
    
    const player = game.players[aiIndex];
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
    
    // Smart card selection for AI
    let chosenIndex = validIndices[0];
    if (game.currentTrick.length > 0) {
        const ledSuit = game.currentTrick[0].card.suit;
        // Try to play highest card if following suit, or lowest if can't win
        validIndices.sort((a, b) => getRankValue(player.hand[b].rank) - getRankValue(player.hand[a].rank));
        chosenIndex = validIndices[0];
    } else {
        // AI leading: choose highest card
        validIndices.sort((a, b) => getRankValue(player.hand[b].rank) - getRankValue(player.hand[a].rank));
        chosenIndex = validIndices[0];
    }
    
    playCard(aiIndex, chosenIndex);
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
    
    const winnerName = game.players[winnerIndex].name;
    updateStatus(`${winnerName} won the trick!`);
    
    game.currentTrick = [];
    game.turnIndex = winnerIndex;
    game.isProcessing = false;
    updateUI();
    
    // Check if round is over (8 tricks played)
    if (game.players[0].hand.length === 0) {
        setTimeout(resolveRound, 1000);
    } else {
        setTimeout(processTurn, 800);
    }
}

function resolveRound() {
    const nsTricks = game.teams[0].tricksWon;
    const ewTricks = game.teams[1].tricksWon;
    
    const callerTeam = game.teams.find(t => t.players.some(p => p.id === game.trumpCaller));
    const defenderTeam = game.teams.find(t => t !== callerTeam);
    
    let resultMsg = `Round Over! NS: ${nsTricks} tricks, EW: ${ewTricks} tricks. `;
    
    if (callerTeam.tricksWon >= 5) {
        if (callerTeam.tricksWon === 8) {
            callerTeam.tokens += 2;
            resultMsg += `KAPUTHI! ${callerTeam.name} won all 8 tricks (+2 Tokens)!`;
        } else {
            callerTeam.tokens += 1;
            resultMsg += `${callerTeam.name} won the round (+1 Token)!`;
        }
    } else {
        defenderTeam.tokens += 2;
        resultMsg += `DEFENDED! ${callerTeam.name} failed to get 5 tricks. ${defenderTeam.name} (+2 Tokens)!`;
    }
    
    updateStatus(resultMsg);
    
    // Rotate dealer for next round
    game.dealerIndex = (game.dealerIndex + 1) % 4;
    
    const startBtn = document.getElementById('start-game-btn');
    startBtn.style.display = 'inline-block';
    startBtn.textContent = 'Start Next Round';
    updateUI();
}
