/* ============================================================
   OMI CARD GAME — Full Script
   Improvements: Smarter AI, Trump Pass, Joker, Multi-round,
   Valid Highlighting, Card Sort, Trick History, Game Log,
   Deal Animation, Trick Win Flash, Round Overlay, Confetti,
   Sound Effects (Web Audio), End-of-game Stats Panel
   ============================================================ */

/* ===== CONSTANTS ===== */
const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];

function suitSymbol(suit) {
    if (suit === 'Joker') return '🃏';
    return { Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠' }[suit];
}
function rankValue(rank) {
    if (rank === 'Joker') return 200;
    return RANKS.indexOf(rank);
}
function isRed(suit)    { return suit === 'Hearts' || suit === 'Diamonds'; }
function teamOf(pid)    { return (pid === 0 || pid === 2) ? 0 : 1; }
function partnerOf(pid) { return (pid + 2) % 4; }

/* ===== CARD & DECK ===== */
class Card { constructor(s, r) { this.suit = s; this.rank = r; } }

class Deck {
    constructor(jokerEnabled = false) {
        this.jokerEnabled = jokerEnabled;
        this.cards = [];
        this._populate();
        this.shuffle();
    }
    _populate() {
        this.cards = [];
        for (const s of SUITS) for (const r of RANKS) this.cards.push(new Card(s, r));
        if (this.jokerEnabled) this.cards.push(new Card('Joker', 'Joker'));
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal(n) { return this.cards.splice(this.cards.length - n, n); }
}

/* ===== GAME STATE ===== */
const state = {
    // Round
    hands:         [[], [], [], []],
    teamTricks:    [0, 0],
    trump:         null,
    trumpCaller:   null,
    trumpPassChain: 0,
    currentTrick:  [],
    turnIndex:     0,
    dealerIndex:   3,
    processing:    false,
    dealing:       false,

    // Memory
    playedCards:   new Set(),
    trickHistory:  [],

    // Match
    tokens:        [0, 0],
    matchTokenTarget: 8,
    matchOver:     false,
    roundCount:    0,

    // Settings
    jokerEnabled:  false,
    muted:         false,

    // Stats
    stats: {
        tricksWonByPlayer: [0, 0, 0, 0],
        roundsWon:  [0, 0],
        kaputhis:   [0, 0],
        defends:    [0, 0],
        trumpsCalled: [0, 0, 0, 0],
    },

    // Log
    gameLog: [],
    deck:    null,
};

/* ===== SOUND ENGINE (Web Audio API — procedural, no files) ===== */
const Sound = {
    ctx: null,

    init() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch(e) { /* no audio support */ }
        }
    },

    _tone(freq, type, gain, start, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + start);
        g.gain.setValueAtTime(0, this.ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + start + duration);
        osc.start(this.ctx.currentTime + start);
        osc.stop(this.ctx.currentTime + start + duration + 0.05);
    },

    play(type) {
        if (state.muted || !this.ctx) return;
        switch (type) {
            case 'card':
                this._tone(380, 'triangle', 0.18, 0, 0.12);
                break;
            case 'trick':
                [523, 659, 784].forEach((f, i) => this._tone(f, 'sine', 0.28, i * 0.12, 0.25));
                break;
            case 'win':
                [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 'sine', 0.32, i * 0.14, 0.35));
                break;
            case 'lose':
                [392, 330, 262].forEach((f, i) => this._tone(f, 'triangle', 0.22, i * 0.17, 0.35));
                break;
            case 'kaputhi':
                [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 'sine', 0.38, i * 0.13, 0.45));
                break;
            case 'invalid':
                this._tone(110, 'square', 0.25, 0, 0.15);
                break;
            case 'trump':
                this._tone(220, 'sine', 0.28, 0, 0.10);
                this._tone(440, 'sine', 0.28, 0.12, 0.10);
                this._tone(880, 'sine', 0.28, 0.26, 0.25);
                break;
        }
    }
};

/* ===== UI HELPERS ===== */
function setStatus(msg) {
    document.getElementById('status-banner').textContent = msg;
}

function updateScoreboard() {
    document.getElementById('ns-tricks').textContent = state.teamTricks[0];
    document.getElementById('ew-tricks').textContent = state.teamTricks[1];
    document.getElementById('ns-tokens').textContent = state.tokens[0];
    document.getElementById('ew-tokens').textContent = state.tokens[1];
}

function updateTrumpBadge() {
    const icon   = document.getElementById('trump-icon');
    const caller = document.getElementById('trump-caller');
    if (state.trump) {
        icon.textContent  = suitSymbol(state.trump);
        icon.style.color  = isRed(state.trump) ? '#d00' : '#eee';
        caller.textContent = PLAYER_NAMES[state.trumpCaller];
    } else {
        icon.textContent  = '–';
        icon.style.color  = '#fff';
        caller.textContent = '';
    }
}

function updateTurnBadges() {
    [0, 1, 2, 3].forEach(pid => {
        const area  = document.getElementById(`player-${pid}`);
        if (!area) return;
        const badge = area.querySelector('.turn-badge');
        const active = pid === state.turnIndex && !state.processing && !state.dealing;
        area.classList.toggle('active-turn', active);
        if (badge) {
            badge.classList.toggle('hidden', !active);
            if (active) badge.textContent = pid === 0 ? 'Your Turn!' : '...';
        }
    });
}

function updateTrickSlots() {
    const slotMap = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
    ['north', 'south', 'west', 'east'].forEach(d => {
        document.getElementById('trick-' + d).innerHTML = '';
    });
    state.currentTrick.forEach(({ player, card }) => {
        const slot = document.getElementById('trick-' + slotMap[player]);
        if (slot) slot.appendChild(buildCard(card, false));
    });
}

/* Card highlighting for valid/invalid plays */
function highlightValidCards() {
    if (state.turnIndex !== 0 || state.processing || state.dealing) return;

    const hand      = state.hands[0];
    const container = document.getElementById('p0-hand');
    if (!container) return;

    const ledSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const hasLedSuit = ledSuit && hand.some(c => c.suit === ledSuit);

    container.querySelectorAll('.card-wrapper').forEach((wrapper, i) => {
        const card   = hand[i];
        const cardEl = wrapper.querySelector('.card');
        if (!card || !cardEl) return;

        cardEl.classList.remove('card-valid', 'card-invalid');
        if (!ledSuit) return;                         // leading: all valid

        const isJoker = card.suit === 'Joker';
        const followsLed = card.suit === ledSuit;
        const valid  = isJoker || !hasLedSuit || followsLed;

        cardEl.classList.add(valid ? 'card-valid' : 'card-invalid');
    });
}

function clearCardHighlights() {
    document.querySelectorAll('.card-valid, .card-invalid').forEach(el => {
        el.classList.remove('card-valid', 'card-invalid');
    });
}

function refreshUI() {
    renderAllHands();
    updateScoreboard();
    updateTrumpBadge();
    updateTrickSlots();
    updateTurnBadges();
    updateTrickHistoryPanel();
}

/* ===== CARD RENDERING ===== */
function buildCard(card, faceDown) {
    const div = document.createElement('div');

    if (faceDown) {
        div.className = 'card face-down';
        return div;
    }

    // Joker
    if (card.suit === 'Joker') {
        div.className = 'card joker';
        const tl = document.createElement('div'); tl.className = 'card-tl';
        tl.innerHTML = '<span class="cr" style="font-size:0.65rem;color:#f0c040">JKR</span><span class="cs">🃏</span>';
        const center = document.createElement('div');
        center.className = 'card-center';
        center.style.fontSize = '2rem';
        center.textContent = '🃏';
        const br = document.createElement('div'); br.className = 'card-br';
        br.innerHTML = '<span class="cr" style="font-size:0.65rem;color:#f0c040">JKR</span><span class="cs">🃏</span>';
        div.appendChild(tl); div.appendChild(center); div.appendChild(br);
        return div;
    }

    const sym = suitSymbol(card.suit);
    div.className = 'card ' + (isRed(card.suit) ? 'red' : 'black');

    const tl = document.createElement('div'); tl.className = 'card-tl';
    tl.innerHTML = `<span class="cr">${card.rank}</span><span class="cs">${sym}</span>`;

    const center = document.createElement('div');
    if (card.rank === 'A') {
        center.className = 'card-center ace-big';
        center.textContent = sym;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
        center.className = 'card-center court';
        const icons = { K: '♔', Q: '♕', J: '♘' };
        center.innerHTML = `<span class="court-icon">${icons[card.rank]}</span><span class="court-sub">${sym}</span>`;
    } else {
        center.className = 'card-center pip-center';
        center.textContent = sym;
    }

    const br = document.createElement('div'); br.className = 'card-br';
    br.innerHTML = `<span class="cr">${card.rank}</span><span class="cs">${sym}</span>`;

    div.appendChild(tl); div.appendChild(center); div.appendChild(br);
    return div;
}

/* ===== HAND RENDERING ===== */
function renderHand(playerId) {
    const isAI       = playerId !== 0;
    const isVertical = playerId === 1 || playerId === 3;
    const containerId = ['p0-hand', 'p1-hand', 'p2-hand', 'p3-hand'][playerId];
    const container   = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const cards = state.hands[playerId];
    const n     = cards.length;

    cards.forEach((card, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';

        const cardEl = buildCard(card, isAI);
        wrapper.appendChild(cardEl);

        if (isVertical) {
            // Side players — vertical overlap, face-down
            if (index > 0) wrapper.style.marginTop = '-68px';
            wrapper.style.zIndex = String(index + 1);
            wrapper.style.cursor = 'default';

        } else if (playerId === 2) {
            // North partner — horizontal overlap, face-down
            if (index > 0) wrapper.style.marginLeft = '-40px';
            wrapper.style.zIndex = String(index + 1);
            wrapper.style.cursor = 'default';

        } else {
            // South (human) — fanned arc, face-up, clickable
            const mid   = (n - 1) / 2;
            const angle = (index - mid) * 5;
            const yArc  = Math.pow(index - mid, 2) * 2.5;
            wrapper.style.transform      = `rotate(${angle}deg) translateY(${yArc}px)`;
            wrapper.style.transformOrigin = 'bottom center';
            if (index > 0) wrapper.style.marginLeft = '-38px';
            wrapper.style.zIndex = String(index + 1);

            wrapper.addEventListener('mouseenter', () => {
                if (!cardEl.classList.contains('card-invalid')) {
                    wrapper.style.transform = `rotate(0deg) translateY(-28px) scale(1.12)`;
                    wrapper.style.zIndex    = '200';
                }
            });
            wrapper.addEventListener('mouseleave', () => {
                wrapper.style.transform = `rotate(${angle}deg) translateY(${yArc}px)`;
                wrapper.style.zIndex    = String(index + 1);
            });

            wrapper.addEventListener('click', () => {
                if (state.dealing || state.processing) return;
                if (state.turnIndex !== 0) {
                    setStatus(`Not your turn – waiting for ${PLAYER_NAMES[state.turnIndex]}.`);
                    return;
                }
                if (!state.trump) return;
                const ok = tryPlayCard(0, index);
                if (!ok) {
                    Sound.play('invalid');
                    cardEl.classList.remove('shake');
                    void cardEl.offsetWidth;
                    cardEl.classList.add('shake');
                    setTimeout(() => cardEl.classList.remove('shake'), 400);
                }
            });
        }

        container.appendChild(wrapper);
    });

    // Apply highlights to human hand after render
    if (playerId === 0) {
        requestAnimationFrame(() => highlightValidCards());
    }
}

function renderAllHands() { [0, 1, 2, 3].forEach(id => renderHand(id)); }

/* ===== TRICK HISTORY PANEL ===== */
function updateTrickHistoryPanel() {
    const panel = document.getElementById('trick-history-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const recent = state.trickHistory.slice(-3);
    if (recent.length === 0) {
        panel.innerHTML = '<span class="history-empty">No tricks yet</span>';
        return;
    }

    recent.forEach(({ trickNum, plays, winner }) => {
        const item  = document.createElement('div');
        item.className = 'history-item';

        const label = document.createElement('div');
        label.className = 'history-label';
        label.textContent = `Trick ${trickNum} → ${PLAYER_NAMES[winner]}`;

        const mini = document.createElement('div');
        mini.className = 'history-cards';
        plays.forEach(({ card }) => {
            const m = document.createElement('div');
            m.className = 'mini-card ' +
                (card.suit === 'Joker' ? 'joker' : (isRed(card.suit) ? 'red' : 'black'));
            m.textContent = (card.suit === 'Joker')
                ? '🃏'
                : `${card.rank}${suitSymbol(card.suit)}`;
            mini.appendChild(m);
        });

        item.appendChild(label);
        item.appendChild(mini);
        panel.appendChild(item);
    });
}

/* ===== GAME LOG ===== */
function appendLog(msg, type = 'info') {
    const list = document.getElementById('game-log-list');
    if (!list) return;

    const li = document.createElement('li');
    li.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span class="log-time">${time}</span> ${msg}`;
    list.prepend(li);

    while (list.children.length > 60) list.removeChild(list.lastChild);
}

/* ===== SMARTER AI ===== */
function getCurrentTrickWinner() {
    if (state.currentTrick.length === 0) return -1;
    const ledSuit = state.currentTrick[0].card.suit;
    let best = -1, winner = -1;
    for (const { player, card } of state.currentTrick) {
        let val = -1;
        if (card.suit === 'Joker')          val = 200;
        else if (card.suit === state.trump)  val = rankValue(card.rank) + 100;
        else if (card.suit === ledSuit)      val = rankValue(card.rank);
        if (val > best) { best = val; winner = player; }
    }
    return winner;
}

function getValidIndices(pid) {
    const hand = state.hands[pid];
    if (state.currentTrick.length === 0) return hand.map((_, i) => i);

    const ledSuit = state.currentTrick[0].card.suit;
    const suitMatches = hand
        .map((c, i) => (c.suit === ledSuit ? i : -1))
        .filter(i => i >= 0);

    if (suitMatches.length > 0) {
        const jokerIdx = hand.findIndex(c => c.suit === 'Joker');
        return jokerIdx >= 0 ? [...suitMatches, jokerIdx] : suitMatches;
    }
    return hand.map((_, i) => i);
}

function cardStrength(card, ledSuit) {
    if (!card) return -1;
    if (card.suit === 'Joker')          return 200;
    if (card.suit === state.trump)      return 100 + rankValue(card.rank);
    if (card.suit === ledSuit)          return rankValue(card.rank);
    return -1;
}

function aiPlay(pid) {
    if (state.turnIndex !== pid || state.processing) return;
    const hand     = state.hands[pid];
    const validIdx = getValidIndices(pid);
    if (validIdx.length === 0) return;
    if (validIdx.length === 1) { tryPlayCard(pid, validIdx[0]); return; }

    const isLeading = state.currentTrick.length === 0;
    const ledSuit   = isLeading ? null : state.currentTrick[0].card.suit;

    if (isLeading) {
        /* ——— LEADING STRATEGY ——— */
        // Count how many trump cards have been played
        const trumpSeen = [...state.playedCards]
            .filter(k => k.endsWith('-' + state.trump)).length;

        // Try to lead highest trump to draw out opponents' trumps
        const highTrumps = validIdx
            .filter(i => hand[i].suit === state.trump && ['A', 'K', 'Q'].includes(hand[i].rank))
            .sort((a, b) => rankValue(hand[b].rank) - rankValue(hand[a].rank));

        if (highTrumps.length > 0 && trumpSeen < 4) {
            tryPlayCard(pid, highTrumps[0]);
            return;
        }

        // Lead strongest non-trump
        const nonTrump = validIdx
            .filter(i => hand[i].suit !== state.trump && hand[i].suit !== 'Joker')
            .sort((a, b) => rankValue(hand[b].rank) - rankValue(hand[a].rank));

        if (nonTrump.length > 0) { tryPlayCard(pid, nonTrump[0]); return; }

        // Fall back: highest card
        validIdx.sort((a, b) => rankValue(hand[b].rank) - rankValue(hand[a].rank));
        tryPlayCard(pid, validIdx[0]);

    } else {
        /* ——— FOLLOWING STRATEGY ——— */
        const currentWinner  = getCurrentTrickWinner();
        const partnerWinning = teamOf(currentWinner) === teamOf(pid);

        const winnerCard = state.currentTrick.find(p => p.player === currentWinner)?.card;
        const winStrength = cardStrength(winnerCard, ledSuit);

        const canBeat = i => cardStrength(hand[i], ledSuit) > winStrength;

        if (partnerWinning) {
            // Partner winning — duck with lowest, avoid spending trumps
            const nonTrumpLow = validIdx
                .filter(i => hand[i].suit !== state.trump)
                .sort((a, b) => rankValue(hand[a].rank) - rankValue(hand[b].rank));
            if (nonTrumpLow.length > 0) { tryPlayCard(pid, nonTrumpLow[0]); return; }
            // All trumps left — play lowest trump
            validIdx.sort((a, b) => rankValue(hand[a].rank) - rankValue(hand[b].rank));
            tryPlayCard(pid, validIdx[0]);

        } else {
            // Opponent winning — try to win with the lowest winning card
            const winners = validIdx
                .filter(canBeat)
                .sort((a, b) => cardStrength(hand[a], ledSuit) - cardStrength(hand[b], ledSuit));

            if (winners.length > 0) { tryPlayCard(pid, winners[0]); return; }

            // Can't win — discard lowest non-trump
            const discards = validIdx
                .filter(i => hand[i].suit !== state.trump)
                .sort((a, b) => rankValue(hand[a].rank) - rankValue(hand[b].rank));

            if (discards.length > 0) { tryPlayCard(pid, discards[0]); return; }

            // Only trumps remain — discard lowest
            validIdx.sort((a, b) => rankValue(hand[a].rank) - rankValue(hand[b].rank));
            tryPlayCard(pid, validIdx[0]);
        }
    }
}

function aiPickTrump(callerPid) {
    const hand   = state.hands[callerPid];
    const counts = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
    const maxRnk = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
    hand.forEach(c => {
        if (c.suit !== 'Joker') {
            counts[c.suit]++;
            maxRnk[c.suit] = Math.max(maxRnk[c.suit], rankValue(c.rank));
        }
    });
    // Prefer suit with most cards, break ties by highest rank
    const best = Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || maxRnk[b[0]] - maxRnk[a[0]])[0][0];
    confirmTrump(best);
}

/* ===== HAND SORT ===== */
function sortHand() {
    const suitOrder = { Hearts: 0, Diamonds: 1, Clubs: 2, Spades: 3, Joker: 4 };
    state.hands[0].sort((a, b) => {
        const sd = suitOrder[a.suit] - suitOrder[b.suit];
        return sd !== 0 ? sd : rankValue(b.rank) - rankValue(a.rank);
    });
    renderHand(0);
    highlightValidCards();
    appendLog('Hand sorted by suit & rank', 'info');
}

/* ===== GAME FLOW ===== */
document.getElementById('start-btn').addEventListener('click', () => {
    Sound.init();
    startRound();
});

function startRound() {
    if (state.matchOver) return;

    // Reset round
    state.deck         = new Deck(state.jokerEnabled);
    state.hands        = [[], [], [], []];
    state.teamTricks   = [0, 0];
    state.trump        = null;
    state.currentTrick = [];
    state.processing   = false;
    state.dealing      = true;
    state.playedCards  = new Set();
    state.trickHistory = [];
    state.trumpPassChain = 0;
    state.trumpCaller  = (state.dealerIndex + 1) % 4;
    state.turnIndex    = state.trumpCaller;
    state.roundCount++;

    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('sort-btn').style.display  = 'inline-block';

    clearCardHighlights();
    updateTrickHistoryPanel();
    updateScoreboard();
    updateTrumpBadge();
    updateTurnBadges();

    appendLog(`── Round ${state.roundCount} started ──`, 'round');
    setStatus('Dealing cards…');

    // Show deck pile
    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'flex';

    // Staggered deal animation: 4 cards each player, one at a time
    let dealCount = 0;
    const totalCards = 16; // first 4 each

    function dealNext() {
        if (dealCount >= totalCards) {
            state.dealing = false;
            if (deckPile) deckPile.style.display = 'none';
            beginTrumpSelection();
            return;
        }
        const pid  = (state.trumpCaller + dealCount) % 4;
        const card = state.deck.deal(1)[0];
        state.hands[pid].push(card);
        Sound.play('card');
        renderHand(pid);
        dealCount++;
        setTimeout(dealNext, 65);
    }
    setTimeout(dealNext, 200);
}

function beginTrumpSelection() {
    setStatus(`${PLAYER_NAMES[state.trumpCaller]} is choosing trump…`);
    if (state.trumpCaller === 0) {
        showTrumpModal();
    } else {
        setTimeout(() => aiPickTrump(state.trumpCaller), 850);
    }
}

function showTrumpModal() {
    const preview = document.getElementById('hand-preview');
    preview.innerHTML = '';
    state.hands[0].forEach((card, i) => {
        const w = document.createElement('div');
        w.className = 'card-wrapper';
        w.appendChild(buildCard(card, false));
        if (i > 0) w.style.marginLeft = '-28px';
        w.style.zIndex = String(i + 1);
        preview.appendChild(w);
    });

    const passBtn = document.getElementById('pass-trump-btn');
    if (passBtn) {
        const canPass = state.trumpPassChain < 3;
        passBtn.style.display = canPass ? 'inline-block' : 'none';
        if (canPass) {
            passBtn.textContent =
                `Pass → ${PLAYER_NAMES[(state.trumpCaller + 1) % 4]}`;
        }
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        Sound.init();
        document.getElementById('modal-overlay').classList.add('hidden');
        confirmTrump(e.currentTarget.dataset.suit);
    });
});

document.getElementById('pass-trump-btn').addEventListener('click', () => {
    Sound.init();
    document.getElementById('modal-overlay').classList.add('hidden');

    appendLog(`${PLAYER_NAMES[state.trumpCaller]} passed trump selection`, 'pass');
    state.trumpPassChain++;
    state.trumpCaller = (state.trumpCaller + 1) % 4;

    setStatus(`${PLAYER_NAMES[state.trumpCaller]} is choosing trump…`);

    if (state.trumpCaller === 0) {
        setTimeout(showTrumpModal, 400);
    } else {
        setTimeout(() => aiPickTrump(state.trumpCaller), 800);
    }
});

function confirmTrump(suit) {
    state.trump = suit;
    state.stats.trumpsCalled[state.trumpCaller]++;
    Sound.play('trump');
    updateTrumpBadge();

    const callerName = PLAYER_NAMES[state.trumpCaller];
    appendLog(`${callerName} chose <b>${suit}</b> ${suitSymbol(suit)} as trump`, 'trump');
    setStatus(`${callerName} chose ${suit}! Dealing remaining cards…`);

    // Deal remaining 4 cards each
    state.dealing = true;
    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'flex';

    let count = 0;
    const total = 16;
    function dealRemaining() {
        if (count >= total) {
            state.dealing = false;
            if (deckPile) deckPile.style.display = 'none';
            refreshUI();
            setStatus(`${callerName} leads first!`);
            processTurn();
            return;
        }
        const pid  = (state.trumpCaller + count) % 4;
        const card = state.deck.deal(1)[0];
        if (card) {
            state.hands[pid].push(card);
            Sound.play('card');
            renderHand(pid);
        }
        count++;
        setTimeout(dealRemaining, 65);
    }
    setTimeout(dealRemaining, 200);
}

/* ===== TURN PROCESSING ===== */
function processTurn() {
    if (state.processing || state.dealing) return;
    updateTurnBadges();

    if (state.turnIndex === 0) {
        setStatus('YOUR TURN! Click a card to play.');
        highlightValidCards();
    } else {
        setStatus(`${PLAYER_NAMES[state.turnIndex]} is thinking…`);
        setTimeout(() => aiPlay(state.turnIndex), 750);
    }
}

function tryPlayCard(playerIndex, cardIndex) {
    if (state.processing || state.dealing) return false;
    const hand = state.hands[playerIndex];
    const card = hand[cardIndex];
    if (!card) return false;

    // Follow-suit validation (Joker exempt)
    if (state.currentTrick.length > 0 && card.suit !== 'Joker') {
        const ledSuit = state.currentTrick[0].card.suit;
        if (card.suit !== ledSuit && hand.some(c => c.suit === ledSuit)) {
            if (playerIndex === 0) setStatus(`Must follow suit: ${ledSuit}!`);
            return false;
        }
    }

    // Play the card
    hand.splice(cardIndex, 1);
    state.currentTrick.push({ player: playerIndex, card });
    state.playedCards.add(`${card.rank}-${card.suit}`);

    Sound.play('card');
    const cardLabel = card.suit === 'Joker' ? '🃏 Joker' : `${card.rank}${suitSymbol(card.suit)}`;
    appendLog(`${PLAYER_NAMES[playerIndex]} played ${cardLabel}`, 'play');

    clearCardHighlights();
    refreshUI();

    if (state.currentTrick.length === 4) {
        state.processing = true;
        setTimeout(resolveTrick, 1000);
    } else {
        state.turnIndex = (state.turnIndex + 1) % 4;
        processTurn();
    }
    return true;
}

function resolveTrick() {
    const ledSuit = state.currentTrick[0].card.suit;
    let best = -1, winner = -1;

    for (const { player, card } of state.currentTrick) {
        let val = -1;
        if (card.suit === 'Joker')          val = 200;
        else if (card.suit === state.trump)  val = rankValue(card.rank) + 100;
        else if (card.suit === ledSuit)      val = rankValue(card.rank);
        if (val > best) { best = val; winner = player; }
    }

    const team = teamOf(winner);
    state.teamTricks[team]++;
    state.stats.tricksWonByPlayer[winner]++;

    const trickNum = state.trickHistory.length + 1;
    state.trickHistory.push({ trickNum, plays: [...state.currentTrick], winner });

    // Flash winning slot
    const slotMap  = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
    const winSlot  = document.getElementById('trick-' + slotMap[winner]);
    if (winSlot) {
        winSlot.classList.add('winner-flash');
        setTimeout(() => winSlot.classList.remove('winner-flash'), 700);
    }

    Sound.play('trick');
    appendLog(`${PLAYER_NAMES[winner]} won trick #${trickNum}`, 'trick');
    showTrickWinBanner(`${PLAYER_NAMES[winner]} wins the trick!`);

    setTimeout(() => {
        state.currentTrick = [];
        state.turnIndex    = winner;
        state.processing   = false;
        refreshUI();
        setStatus(`${PLAYER_NAMES[winner]} won trick #${trickNum}!`);

        if (state.hands[0].length === 0) {
            setTimeout(endRound, 1000);
        } else {
            setTimeout(processTurn, 600);
        }
    }, 950);
}

function showTrickWinBanner(msg) {
    const el = document.getElementById('trick-win-overlay');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('show'));
    });
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.classList.add('hidden'), 350);
    }, 1100);
}

function endRound() {
    const ns = state.teamTricks[0];
    const ew = state.teamTricks[1];
    const callerTeam = teamOf(state.trumpCaller);
    const defTeam    = 1 - callerTeam;

    let msg, isKaputhi = false;

    if (state.teamTricks[callerTeam] >= 5) {
        isKaputhi = state.teamTricks[callerTeam] === 8;
        const bonus = isKaputhi ? 2 : 1;
        state.tokens[callerTeam] += bonus;
        state.stats.roundsWon[callerTeam]++;

        if (isKaputhi) {
            state.stats.kaputhis[callerTeam]++;
            msg = `KAPUTHI! ${callerTeam === 0 ? 'NS' : 'EW'} swept all 8 tricks! +2 tokens`;
            Sound.play('kaputhi');
        } else {
            msg = `${callerTeam === 0 ? 'NS' : 'EW'} won! (NS ${ns} – EW ${ew}) +1 token`;
            Sound.play('win');
        }
    } else {
        state.tokens[defTeam] += 2;
        state.stats.roundsWon[defTeam]++;
        state.stats.defends[defTeam]++;
        msg = `DEFENDED! ${defTeam === 0 ? 'NS' : 'EW'} +2 tokens (NS ${ns} – EW ${ew})`;
        Sound.play('lose');
    }

    appendLog(`── ${msg} ──`, 'result');
    setStatus(msg);
    updateScoreboard();
    updateTrickHistoryPanel();

    state.dealerIndex = (state.dealerIndex + 1) % 4;

    if (checkMatchWin()) return;

    // Show round overlay briefly
    const roundOverlay = document.getElementById('round-overlay');
    document.getElementById('round-overlay-msg').textContent = msg;
    roundOverlay.classList.remove('hidden');
    if (isKaputhi) fireConfetti();
    setTimeout(() => roundOverlay.classList.add('hidden'), 2200);

    setTimeout(() => {
        const btn = document.getElementById('start-btn');
        btn.textContent = 'Next Round';
        btn.style.display = 'inline-block';
        document.getElementById('sort-btn').style.display = 'none';
        document.getElementById('show-stats-btn').style.display = 'inline-block';
    }, 2300);
}

function checkMatchWin() {
    const nsWon = state.tokens[0] >= state.matchTokenTarget;
    const ewWon = state.tokens[1] >= state.matchTokenTarget;
    if (!nsWon && !ewWon) return false;

    state.matchOver = true;
    const winnerLabel = nsWon ? 'NS (You & Partner)' : 'EW (Opponents)';
    appendLog(`🏆 MATCH WON by ${winnerLabel}!`, 'match');

    setTimeout(() => {
        const overlay = document.getElementById('match-win-overlay');
        document.getElementById('match-winner-text').textContent = `🏆 ${winnerLabel} wins the match!`;
        document.getElementById('match-stats-text').textContent =
            `NS: ${state.tokens[0]} tokens | EW: ${state.tokens[1]} tokens`;
        overlay.classList.remove('hidden');
        if (nsWon) fireConfetti();
    }, 800);

    return true;
}

/* ===== CONFETTI ===== */
function fireConfetti() {
    if (typeof confetti === 'undefined') return;
    confetti({ particleCount: 180, spread: 80, origin: { y: 0.55 } });
    setTimeout(() => confetti({ particleCount: 80, spread: 55, origin: { x: 0.1, y: 0.6 } }), 350);
    setTimeout(() => confetti({ particleCount: 80, spread: 55, origin: { x: 0.9, y: 0.6 } }), 550);
}

/* ===== STATS PANEL ===== */
function showStatsPanel() {
    const totalTricks = Math.max(1,
        state.stats.tricksWonByPlayer.reduce((a, b) => a + b, 0));

    document.getElementById('stats-tricks-body').innerHTML =
        PLAYER_NAMES.map((name, i) => {
            const t   = state.stats.tricksWonByPlayer[i];
            const pct = Math.round((t / totalTricks) * 100);
            const col = teamOf(i) === 0 ? '#4cd137' : '#e84118';
            return `<tr>
                <td>${name}</td>
                <td>${t}</td>
                <td><div class="stat-bar-bg">
                    <div class="stat-bar" style="width:${pct}%;background:${col}"></div>
                </div></td>
            </tr>`;
        }).join('');

    document.getElementById('stats-ns-wins').textContent      = state.stats.roundsWon[0];
    document.getElementById('stats-ew-wins').textContent      = state.stats.roundsWon[1];
    document.getElementById('stats-ns-kaputhis').textContent  = state.stats.kaputhis[0];
    document.getElementById('stats-ew-kaputhis').textContent  = state.stats.kaputhis[1];
    document.getElementById('stats-ns-defends').textContent   = state.stats.defends[0];
    document.getElementById('stats-ew-defends').textContent   = state.stats.defends[1];

    const mvpIdx = state.stats.tricksWonByPlayer
        .indexOf(Math.max(...state.stats.tricksWonByPlayer));
    document.getElementById('stats-mvp').textContent =
        `${PLAYER_NAMES[mvpIdx]} (${state.stats.tricksWonByPlayer[mvpIdx]} tricks)`;

    document.getElementById('stats-modal').classList.remove('hidden');
}

/* ===== EVENT LISTENERS ===== */

// Sort hand
document.getElementById('sort-btn').addEventListener('click', () => {
    Sound.init();
    sortHand();
});

// Show stats
document.getElementById('show-stats-btn').addEventListener('click', () => {
    Sound.init();
    showStatsPanel();
});
document.getElementById('show-stats-btn-match').addEventListener('click', () => {
    showStatsPanel();
});
document.getElementById('stats-close-btn').addEventListener('click', () => {
    document.getElementById('stats-modal').classList.add('hidden');
});

// Mute toggle
document.getElementById('mute-btn').addEventListener('click', () => {
    Sound.init();
    state.muted = !state.muted;
    document.getElementById('mute-btn').textContent = state.muted ? '🔇' : '🔊';
});

// Joker toggle
document.getElementById('joker-toggle').addEventListener('change', e => {
    state.jokerEnabled = e.target.checked;
    appendLog(`Joker mode ${state.jokerEnabled ? 'enabled 🃏' : 'disabled'}`, 'info');
});

// Log sidebar toggle
document.getElementById('log-toggle-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('log-sidebar');
    sidebar.classList.toggle('collapsed');
});
document.getElementById('log-close-btn').addEventListener('click', () => {
    document.getElementById('log-sidebar').classList.add('collapsed');
});

// Play again (match win)
document.getElementById('match-play-again-btn').addEventListener('click', () => {
    Sound.init();
    document.getElementById('match-win-overlay').classList.add('hidden');
    // Reset full match
    state.tokens     = [0, 0];
    state.matchOver  = false;
    state.roundCount = 0;
    state.gameLog    = [];
    state.stats      = {
        tricksWonByPlayer: [0, 0, 0, 0],
        roundsWon:   [0, 0],
        kaputhis:    [0, 0],
        defends:     [0, 0],
        trumpsCalled: [0, 0, 0, 0],
    };
    document.getElementById('game-log-list').innerHTML = '';
    document.getElementById('show-stats-btn').style.display = 'none';
    updateScoreboard();
    const btn = document.getElementById('start-btn');
    btn.textContent    = 'Start Game';
    btn.style.display  = 'inline-block';
    document.getElementById('sort-btn').style.display = 'none';
});
