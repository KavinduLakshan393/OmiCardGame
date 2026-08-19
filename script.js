/* ============================================================
   OMI CARD GAME — Legacy presentation/controller layer

   Batch 1 architecture note:
   - Standard Omi rules and state transitions now live in src/engine/.
   - This file remains responsible for DOM rendering, audio, AI timing,
     animations, and existing prototype controls until later patches.
   ============================================================ */

import {
    EVENT,
    GameEngine,
    OmiRuleError,
    PHASE,
    PLAYER_NAMES,
    isRed,
    rankValue,
    suitSymbol,
    teamOf,
} from './src/engine/index.js';
import { AI_DIFFICULTY } from './src/ai/AIPlayer.js';
import { SinglePlayerController } from './src/controllers/SinglePlayerController.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Batch 3 menu preferences are passed as query parameters by main-menu.html.
 * The dedicated settings subsystem in Patch 12 will replace this lightweight
 * bootstrap bridge without changing the controller API. */
const gameParams = new URLSearchParams(window.location.search);
const initialDifficulty = gameParams.get('difficulty') === 'casual'
    ? AI_DIFFICULTY.CASUAL
    : AI_DIFFICULTY.SMART;
const initiallyMuted = gameParams.get('sound') === 'off';

const controller = new SinglePlayerController({
    engine: new GameEngine(),
    humanPlayerId: 0,
    difficulty: initialDifficulty,
    hooks: {
        onEvents: handleEngineEvents,
        afterDealBatch: handleDealBatchAnimation,
        onHumanTrumpRequired: handleHumanTrumpRequired,
        beforeAITrump: handleBeforeAITrump,
        beforeAITurn: handleBeforeAITurn,
        onHumanTurn: handleHumanTurn,
        beforeTrickComplete: handleBeforeTrickComplete,
        afterTrickComplete: handleAfterTrickComplete,
        beforeHandScore: handleBeforeHandScore,
        afterHandScored: handleAfterHandScored,
    },
});

const game = controller.engine;
const state = controller.state;

/* Presentation/session-only state. None of these values participate in rules. */
const runtime = {
    processing: false,
    dealing: false,
    muted: initiallyMuted,
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

/* ===== SINGLE-PLAYER CONTROLLER HOOKS ===== */
function handleEngineEvents(events) {
    for (const event of events) {
        switch (event.type) {
            case EVENT.HAND_STARTED:
                clearCardHighlights();
                refreshUI();
                appendLog(`── Hand ${event.handNumber} started ──`, 'round');
                setStatus('Dealing the first four cards…');
                break;

            case EVENT.TRUMP_REQUIRED:
                setStatus(`${PLAYER_NAMES[event.playerId]} is choosing trump…`);
                break;

            case EVENT.TRUMP_SELECTED: {
                runtime.stats.trumpsCalled[event.playerId]++;
                Sound.play('trump');
                updateTrumpBadge();
                const callerName = PLAYER_NAMES[event.playerId];
                appendLog(`${callerName} chose <b>${event.suit}</b> ${suitSymbol(event.suit)} as trump`, 'trump');
                setStatus(`${callerName} chose ${event.suit}. Dealing the final four cards…`);
                runtime.dealing = true;
                const deckPile = document.getElementById('deck-pile');
                if (deckPile) deckPile.style.display = 'flex';
                break;
            }

            case EVENT.DEAL_COMPLETED: {
                runtime.dealing = false;
                const deckPile = document.getElementById('deck-pile');
                if (deckPile) deckPile.style.display = 'none';
                refreshUI();
                setStatus(`${PLAYER_NAMES[event.firstPlayer]} leads first!`);
                break;
            }

            case EVENT.CARD_PLAYED:
                Sound.play('card');
                appendLog(`${PLAYER_NAMES[event.playerId]} played ${event.card.rank}${suitSymbol(event.card.suit)}`, 'play');
                clearCardHighlights();
                refreshUI();
                break;

            case EVENT.MATCH_RESET:
                refreshUI();
                break;

            default:
                break;
        }
    }
}

async function handleDealBatchAnimation({ event }) {
    runtime.dealing = true;
    Sound.play('card');
    renderHand(event.playerIndex);
    await delay(220);
}

async function handleHumanTrumpRequired() {
    runtime.dealing = false;
    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'none';
    showTrumpModal();
}

async function handleBeforeAITrump({ playerId }) {
    runtime.dealing = false;
    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'none';
    setStatus(`${PLAYER_NAMES[playerId]} is choosing trump…`);
    await delay(850);
}

async function handleBeforeAITurn({ playerId }) {
    runtime.processing = false;
    setStatus(`${PLAYER_NAMES[playerId]} is thinking…`);
    updateTurnBadges();
    await delay(750);
}

async function handleHumanTurn() {
    runtime.processing = false;
    updateTurnBadges();
    setStatus('YOUR TURN! Click a card to play.');
    highlightValidCards();
}

async function handleBeforeTrickComplete({ preview }) {
    runtime.processing = true;
    updateTurnBadges();
    await delay(1000);

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
    await delay(950);
}

async function handleAfterTrickComplete({ event }) {
    runtime.stats.tricksWonByPlayer[event.winner]++;
    runtime.processing = false;
    refreshUI();
    setStatus(`${PLAYER_NAMES[event.winner]} won trick #${event.trickNum}!`);
    await delay(event.handPlayComplete ? 1000 : 600);
}

async function handleBeforeHandScore() {
    runtime.processing = true;
}

async function handleAfterHandScored({ event }) {
    runtime.processing = false;
    presentHandResult(event.result);
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
    if (state.matchOver || controller.isBusy) return;
    if (![PHASE.IDLE, PHASE.HAND_COMPLETE].includes(state.phase)) return;

    runtime.processing = false;
    runtime.dealing = true;

    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('sort-btn').style.display = 'inline-block';

    clearCardHighlights();
    updateTrickHistoryPanel();
    updateScoreboard();
    updateTrumpBadge();
    updateTurnBadges();

    const deckPile = document.getElementById('deck-pile');
    if (deckPile) deckPile.style.display = 'flex';

    const operation = state.phase === PHASE.IDLE
        ? controller.startMatch()
        : controller.startNextHand();

    operation.catch(error => handleControllerError(error, 'Unable to start the hand.'));
}

function handleControllerError(error, fallbackMessage) {
    console.error(error);
    runtime.processing = false;
    runtime.dealing = false;

    if (error instanceof OmiRuleError) {
        setStatus(error.message);
    } else {
        setStatus(fallbackMessage);
    }

    updateTurnBadges();
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
    controller.selectTrump(suit)
        .catch(error => handleControllerError(error, 'Unable to select trump. Please restart the hand.'));
}

function tryPlayCard(playerIndex, cardIndex) {
    if (playerIndex !== 0 || runtime.processing || runtime.dealing || controller.isBusy) return false;
    if (state.phase !== PHASE.PLAYING || state.turnIndex !== 0) return false;

    const hand = state.hands[playerIndex];
    const card = hand[cardIndex];
    if (!card) return false;

    if (!game.isLegalPlay(playerIndex, cardIndex)) {
        if (state.currentTrick.length > 0) {
            setStatus(`Must follow suit: ${state.currentTrick[0].card.suit}!`);
        }
        return false;
    }

    controller.playHumanCard(cardIndex)
        .catch(error => handleControllerError(error, 'Unable to play that card.'));
    return true;
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

function presentHandResult(result) {
    const ns = state.teamTricks[0];
    const ew = state.teamTricks[1];

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

/* Reflect menu-selected sound preference before the first interaction. */
const initialMuteButton = document.getElementById('mute-btn');
if (initialMuteButton) initialMuteButton.textContent = runtime.muted ? '🔇' : '🔊';

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

    controller.resetMatch().then(() => {
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
    }).catch(error => handleControllerError(error, 'Unable to reset the match.'));
});
