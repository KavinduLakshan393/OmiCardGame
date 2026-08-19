/* ============================================================
   OMI CARD GAME — Legacy presentation/controller layer

   Batch 1 architecture note:
   - Standard Omi rules and state transitions now live in src/engine/.
   - This file remains responsible for DOM rendering, audio, AI timing,
     animations, and existing prototype controls until later patches.
   ============================================================ */

import {
    GameEngine,
    OmiRuleError,
    PHASE,
    PLAYER_NAMES,
    RANKS,
    cardStrength,
    isRed,
    rankValue,
    resolveTrick as resolveTrickState,
    suitSymbol,
    teamOf,
} from './src/engine/index.js';

const game = new GameEngine();
const state = game.state;

/* Presentation/session-only state. None of these values participate in rules. */
const runtime = {
    processing: false,
    dealing: false,
    muted: false,
    stats: {
        tricksWonByPlayer: [0, 0, 0, 0],
        roundsWon: [0, 0],
        kaputhis: [0, 0],
        defends: [0, 0],
        trumpsCalled: [0, 0, 0, 0],
    },
    gameLog: [],
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
        if (runtime.muted || !this.ctx) return;
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
        const active = state.phase === PHASE.PLAYING && pid === state.turnIndex && !runtime.processing && !runtime.dealing;
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
    if (state.turnIndex !== 0 || runtime.processing || runtime.dealing) return;

    const container = document.getElementById('p0-hand');
    if (!container) return;

    const legalIndices = new Set(game.getLegalCardIndices(0));
    container.querySelectorAll('.card-wrapper').forEach((wrapper, index) => {
        const cardEl = wrapper.querySelector('.card');
        if (!cardEl) return;
        cardEl.classList.remove('card-valid', 'card-invalid');
        cardEl.classList.add(legalIndices.has(index) ? 'card-valid' : 'card-invalid');
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
                if (runtime.dealing || runtime.processing) return;
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
            m.className = 'mini-card ' + (isRed(card.suit) ? 'red' : 'black');
            m.textContent = `${card.rank}${suitSymbol(card.suit)}`;
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
    return resolveTrickState(state.currentTrick, state.trump).winner;
}

function getValidIndices(pid) {
    return game.getLegalCardIndices(pid);
}

function aiPlay(pid) {
    if (state.turnIndex !== pid || runtime.processing) return;
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
            .filter(i => hand[i].suit !== state.trump)
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
        const winStrength = cardStrength(winnerCard, ledSuit, state.trump);

        const canBeat = i => cardStrength(hand[i], ledSuit, state.trump) > winStrength;

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
                .sort((a, b) => cardStrength(hand[a], ledSuit, state.trump) - cardStrength(hand[b], ledSuit, state.trump));

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
        counts[c.suit]++;
        maxRnk[c.suit] = Math.max(maxRnk[c.suit], rankValue(c.rank));
    });
    // Prefer suit with most cards, break ties by highest rank
    const best = Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || maxRnk[b[0]] - maxRnk[a[0]])[0][0];
    confirmTrump(best);
}

/* ===== HAND SORT ===== */
function sortHand() {
    const suitOrder = { Hearts: 0, Diamonds: 1, Clubs: 2, Spades: 3 };
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

    game.startHand();
    runtime.processing = false;
    runtime.dealing = true;

    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('sort-btn').style.display = 'inline-block';

    clearCardHighlights();
    updateTrickHistoryPanel();
    updateScoreboard();
    updateTrumpBadge();
    updateTurnBadges();

    appendLog(`── Hand ${state.handNumber} started ──`, 'round');
    setStatus('Dealing the first four cards…');

    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'flex';

    // Traditional Omi is dealt in batches of four, beginning to dealer's right.
    dealCurrentPhase({
        onComplete: () => {
            runtime.dealing = false;
            if (deckPile) deckPile.style.display = 'none';
            beginTrumpSelection();
        },
    });
}

/**
 * Animate one standard batch of four cards at a time. The engine owns the
 * cards and deal order; this UI layer owns only the timing between batches.
 */
function dealCurrentPhase({ onComplete }) {
    const dealOneBatch = () => {
        const result = game.dealNextBatch();
        Sound.play('card');
        renderHand(result.playerIndex);

        if (result.phaseComplete) {
            onComplete();
            return;
        }

        setTimeout(dealOneBatch, 220);
    };

    setTimeout(dealOneBatch, 200);
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

    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', event => {
        Sound.init();
        document.getElementById('modal-overlay').classList.add('hidden');
        confirmTrump(event.currentTarget.dataset.suit);
    });
});

function confirmTrump(suit) {
    try {
        game.selectTrump(suit);
    } catch (error) {
        console.error('Unable to select trump:', error);
        setStatus('Unable to select trump. Please restart the hand.');
        return;
    }

    runtime.stats.trumpsCalled[state.trumpCaller]++;
    Sound.play('trump');
    updateTrumpBadge();

    const callerName = PLAYER_NAMES[state.trumpCaller];
    appendLog(`${callerName} chose <b>${suit}</b> ${suitSymbol(suit)} as trump`, 'trump');
    setStatus(`${callerName} chose ${suit}. Dealing the final four cards…`);

    runtime.dealing = true;
    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'flex';

    dealCurrentPhase({
        onComplete: () => {
            runtime.dealing = false;
            if (deckPile) deckPile.style.display = 'none';
            refreshUI();
            setStatus(`${callerName} leads first!`);
            processTurn();
        },
    });
}

/* ===== TURN PROCESSING ===== */
function processTurn() {
    if (runtime.processing || runtime.dealing || state.phase !== PHASE.PLAYING) return;
    updateTurnBadges();

    if (state.turnIndex === 0) {
        setStatus('YOUR TURN! Click a card to play.');
        highlightValidCards();
    } else {
        const aiPid = state.turnIndex;
        setStatus(`${PLAYER_NAMES[aiPid]} is thinking…`);
        setTimeout(() => aiPlay(aiPid), 750);
    }
}

function tryPlayCard(playerIndex, cardIndex) {
    if (runtime.processing || runtime.dealing || state.phase !== PHASE.PLAYING) return false;

    const hand = state.hands[playerIndex];
    const card = hand[cardIndex];
    if (!card) return false;

    if (!game.isLegalPlay(playerIndex, cardIndex)) {
        if (playerIndex === 0 && state.currentTrick.length > 0) {
            setStatus(`Must follow suit: ${state.currentTrick[0].card.suit}!`);
        }
        return false;
    }

    let result;
    try {
        result = game.playCard(playerIndex, cardIndex);
    } catch (error) {
        if (error instanceof OmiRuleError) {
            if (playerIndex === 0) setStatus(error.message);
            return false;
        }
        throw error;
    }

    Sound.play('card');
    appendLog(`${PLAYER_NAMES[playerIndex]} played ${card.rank}${suitSymbol(card.suit)}`, 'play');

    clearCardHighlights();
    refreshUI();

    if (result.trickComplete) {
        runtime.processing = true;
        setTimeout(resolveCompletedTrick, 1000);
    } else {
        processTurn();
    }
    return true;
}

function resolveCompletedTrick() {
    const preview = game.peekCurrentTrickResult();

    const slotMap = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
    const winSlot = document.getElementById('trick-' + slotMap[preview.winner]);
    if (winSlot) {
        winSlot.classList.add('winner-flash');
        setTimeout(() => winSlot.classList.remove('winner-flash'), 700);
    }

    const trickNum = state.trickHistory.length + 1;
    Sound.play('trick');
    appendLog(`${PLAYER_NAMES[preview.winner]} won trick #${trickNum}`, 'trick');
    showTrickWinBanner(`${PLAYER_NAMES[preview.winner]} wins the trick!`);

    setTimeout(() => {
        const result = game.completeTrick();
        runtime.stats.tricksWonByPlayer[result.winner]++;
        runtime.processing = false;

        refreshUI();
        setStatus(`${PLAYER_NAMES[result.winner]} won trick #${result.trickNum}!`);

        if (result.handComplete) {
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

    let result;
    try {
        result = game.scoreCurrentHand();
    } catch (error) {
        console.error('Unable to score completed hand:', error);
        setStatus('Unable to score this hand. Please restart the match.');
        return;
    }

    let msg;
    if (result.tied) {
        const carryLabel = result.nextCarryTokens === 1 ? 'token' : 'tokens';
        msg = `TIED 4–4! No tokens awarded. ${result.nextCarryTokens} carry ${carryLabel} for the next decisive hand.`;
        Sound.play('card');
    } else {
        runtime.stats.roundsWon[result.winnerTeam]++;
        if (result.isDefense) runtime.stats.defends[result.winnerTeam]++;
        if (result.isKapothi) runtime.stats.kaputhis[result.winnerTeam]++;

        const teamLabel = result.winnerTeam === 0 ? 'NS' : 'EW';
        const carryText = result.carryAwarded > 0
            ? ` (${result.baseTokens} base + ${result.carryAwarded} carry)`
            : '';

        if (result.isKapothi) {
            msg = `KAPOTHI! ${teamLabel} swept all 8 tricks! +${result.tokensAwarded} tokens${carryText}`;
            Sound.play('kaputhi');
        } else if (result.isDefense) {
            msg = `DEFENDED! ${teamLabel} +${result.tokensAwarded} tokens${carryText} (NS ${ns} – EW ${ew})`;
            Sound.play('lose');
        } else {
            msg = `${teamLabel} won! +${result.tokensAwarded} token${result.tokensAwarded === 1 ? '' : 's'}${carryText} (NS ${ns} – EW ${ew})`;
            Sound.play('win');
        }
    }

    appendLog(`── ${msg} ──`, 'result');
    setStatus(msg);
    updateScoreboard();
    updateTrickHistoryPanel();

    if (result.matchOver) {
        showMatchWin();
        return;
    }

    const roundOverlay = document.getElementById('round-overlay');
    document.getElementById('round-overlay-msg').textContent = msg;
    roundOverlay.classList.remove('hidden');
    if (result.isKapothi) fireConfetti();
    setTimeout(() => roundOverlay.classList.add('hidden'), 2200);

    setTimeout(() => {
        const btn = document.getElementById('start-btn');
        btn.textContent = 'Next Hand';
        btn.style.display = 'inline-block';
        document.getElementById('sort-btn').style.display = 'none';
        document.getElementById('show-stats-btn').style.display = 'inline-block';
    }, 2300);
}

function showMatchWin() {
    if (!state.matchOver) return false;

    const nsWon = state.tokens[0] >= state.matchTokenTarget;
    const winnerLabel = nsWon ? 'NS (You & Partner)' : 'EW (Opponents)';
    appendLog(`🏆 MATCH WON by ${winnerLabel}!`, 'match');

    setTimeout(() => {
        const overlay = document.getElementById('match-win-overlay');
        document.getElementById('match-winner-text').textContent = `🏆 ${winnerLabel} wins the match!`;
        document.getElementById('match-stats-text').textContent =
            `NS: ${state.tokens[0]} tokens | EW: ${state.tokens[1]} tokens | Target: ${state.matchTokenTarget}`;
        overlay.classList.remove('hidden');
        if (nsWon) fireConfetti();
    }, 800);

    return true;
}

/* ===== CONFETTI ===== */
function fireConfetti() {
    if (typeof globalThis.confetti !== 'function') return;
    globalThis.confetti({ particleCount: 180, spread: 80, origin: { y: 0.55 } });
    setTimeout(() => globalThis.confetti({ particleCount: 80, spread: 55, origin: { x: 0.1, y: 0.6 } }), 350);
    setTimeout(() => globalThis.confetti({ particleCount: 80, spread: 55, origin: { x: 0.9, y: 0.6 } }), 550);
}

/* ===== STATS PANEL ===== */
function showStatsPanel() {
    const totalTricks = Math.max(1,
        runtime.stats.tricksWonByPlayer.reduce((a, b) => a + b, 0));

    document.getElementById('stats-tricks-body').innerHTML =
        PLAYER_NAMES.map((name, i) => {
            const t   = runtime.stats.tricksWonByPlayer[i];
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

    document.getElementById('stats-ns-wins').textContent      = runtime.stats.roundsWon[0];
    document.getElementById('stats-ew-wins').textContent      = runtime.stats.roundsWon[1];
    document.getElementById('stats-ns-kaputhis').textContent  = runtime.stats.kaputhis[0];
    document.getElementById('stats-ew-kaputhis').textContent  = runtime.stats.kaputhis[1];
    document.getElementById('stats-ns-defends').textContent   = runtime.stats.defends[0];
    document.getElementById('stats-ew-defends').textContent   = runtime.stats.defends[1];

    const mvpIdx = runtime.stats.tricksWonByPlayer
        .indexOf(Math.max(...runtime.stats.tricksWonByPlayer));
    document.getElementById('stats-mvp').textContent =
        `${PLAYER_NAMES[mvpIdx]} (${runtime.stats.tricksWonByPlayer[mvpIdx]} tricks)`;

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
    runtime.muted = !runtime.muted;
    document.getElementById('mute-btn').textContent = runtime.muted ? '🔇' : '🔊';
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
    // Reset the pure rules engine and presentation-only statistics separately.
    game.resetMatch();
    runtime.processing = false;
    runtime.dealing = false;
    runtime.gameLog = [];
    runtime.stats = {
        tricksWonByPlayer: [0, 0, 0, 0],
        roundsWon: [0, 0],
        kaputhis: [0, 0],
        defends: [0, 0],
        trumpsCalled: [0, 0, 0, 0],
    };
    document.getElementById('game-log-list').innerHTML = '';
    document.getElementById('show-stats-btn').style.display = 'none';
    refreshUI();
    const btn = document.getElementById('start-btn');
    btn.textContent    = 'Start Game';
    btn.style.display  = 'inline-block';
    document.getElementById('sort-btn').style.display = 'none';
});
