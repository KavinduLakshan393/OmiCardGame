/* ============================================================
   OMI CARD GAME — Single Player v1 presentation integration

   Architecture boundary:
   - Standard Omi rules/state live in src/engine/.
   - Single-player sequencing lives in src/controllers/.
   - This module binds browser UI, audio, persistence and animations to those
     layers without mutating authoritative rule state directly.
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
import { AudioManager } from './src/audio/AudioManager.js';
import { SinglePlayerController } from './src/controllers/SinglePlayerController.js';
import {
    clearSavedGame,
    createSaveRecord,
    loadGame,
    normalizeStats,
    saveGame,
} from './src/storage/saveGame.js';
import { loadSettings, saveSettings } from './src/storage/settings.js';
import { animateCardPlay, animateTrickCollection, markDealtCards, pulseWinningCard } from './src/ui/animations.js';
import { createCardElement, createMiniCardElement } from './src/ui/cardRenderer.js';
import { buildHumanHint } from './src/ui/hints.js';
import { activateFocusTrap, deactivateFocusTrap } from './src/ui/focusTrap.js';
import { configureMotion, wait as delay } from './src/ui/motion.js';
import { handResultView, matchResultView } from './src/ui/results.js';
import { saveMatchResult } from './src/storage/history.js';

const gameParams = new URLSearchParams(window.location.search);
let settings = loadSettings();

// Preserve compatibility with Batch 3 links while making Patch 12 settings
// authoritative and persistent from this point forward.
if (gameParams.has('difficulty') || gameParams.has('sound')) {
    settings = saveSettings({
        ...settings,
        difficulty: gameParams.get('difficulty') === 'casual' ? 'casual' : settings.difficulty,
        sound: gameParams.has('sound') ? gameParams.get('sound') !== 'off' : settings.sound,
    });
}
configureMotion(settings);

const wantsResume = gameParams.get('resume') === '1';
let resumeRecord = wantsResume ? loadGame() : null;
let engine = new GameEngine();

if (resumeRecord) {
    try {
        engine = GameEngine.fromSession(resumeRecord.engineSession);
    } catch (error) {
        console.warn('Discarding an invalid Omi save.', error);
        clearSavedGame();
        resumeRecord = null;
    }
}

const initialDifficulty = settings.difficulty === 'casual'
    ? AI_DIFFICULTY.CASUAL
    : AI_DIFFICULTY.SMART;

const controller = new SinglePlayerController({
    engine,
    humanPlayerId: 0,
    difficulty: initialDifficulty,
    hooks: {
        onEvents: handleEngineEvents,
        afterDealBatch: handleDealBatchAnimation,
        onHumanTrumpRequired: handleHumanTrumpRequired,
        beforeAITrump: handleBeforeAITrump,
        beforeAITurn: handleBeforeAITurn,
        onHumanTurn: handleHumanTurn,
        afterCardPlayed: handleAfterCardPlayed,
        beforeTrickComplete: handleBeforeTrickComplete,
        afterTrickComplete: handleAfterTrickComplete,
        beforeHandScore: handleBeforeHandScore,
        afterHandScored: handleAfterHandScored,
    },
});

const game = controller.engine;
const state = controller.state;
const Sound = new AudioManager({ enabled: settings.sound });

function freshStats() {
    return normalizeStats({
        tricksWonByPlayer: [0, 0, 0, 0],
        roundsWon: [0, 0],
        kaputhis: [0, 0],
        defends: [0, 0],
        trumpsCalled: [0, 0, 0, 0],
        startedAt: Date.now(),
    });
}

/* Presentation/session-only state. None of these values participate in rules. */
const runtime = {
    processing: false,
    dealing: false,
    muted: !settings.sound,
    stats: resumeRecord ? normalizeStats(resumeRecord.stats) : freshStats(),
    gameLog: [],
    selectedCardIndex: null,
    pendingPlayRect: null,
    humanSortEnabled: false,
};

function openModalSurface(element, { initialFocus = null, onEscape = null } = {}) {
    if (!element) return;
    element.classList.remove('hidden');
    activateFocusTrap(element, { initialFocus, onEscape });
}

function closeModalSurface(element, { restoreFocus = true } = {}) {
    if (!element) return;
    deactivateFocusTrap(element, { restoreFocus });
    element.classList.add('hidden');
}

function persistActiveMatch() {
    if ([PHASE.IDLE, PHASE.MATCH_COMPLETE].includes(state.phase)) {
        if (state.phase === PHASE.MATCH_COMPLETE) clearSavedGame();
        return;
    }

    try {
        saveGame(createSaveRecord({
            engineSession: game.exportSession(),
            stats: runtime.stats,
        }));
    } catch (error) {
        console.warn('Unable to persist Omi match.', error);
    }
}

/* ===== UI HELPERS ===== */
function setStatus(msg) {
    document.getElementById('status-banner').textContent = msg;
}

function updateScoreboard() {
    document.getElementById('ns-tricks').textContent = state.teamTricks[0];
    document.getElementById('ew-tricks').textContent = state.teamTricks[1];
    document.getElementById('ns-tokens').textContent = state.tokens[0];
    document.getElementById('ew-tokens').textContent = state.tokens[1];

    state.hands.forEach((hand, playerId) => {
        const counter = document.getElementById(`p${playerId}-count`);
        if (counter) counter.textContent = hand.length;
    });
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
    container.querySelectorAll('.card-wrapper').forEach(wrapper => {
        const cardEl = wrapper.querySelector('.card');
        if (!cardEl) return;
        const cardIndex = Number(wrapper.dataset.cardIndex);
        const legal = legalIndices.has(cardIndex);
        cardEl.classList.remove('card-valid', 'card-invalid');
        cardEl.classList.add(legal ? 'card-valid' : 'card-invalid');
        if ('disabled' in wrapper) wrapper.disabled = !legal;
        wrapper.setAttribute('aria-disabled', String(!legal));
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
    return createCardElement(card, { faceDown });
}

/* ===== HAND RENDERING ===== */
function humanCardEntries(cards) {
    const entries = cards.map((card, cardIndex) => ({ card, cardIndex }));
    if (!runtime.humanSortEnabled) return entries;

    const suitOrder = { Hearts: 0, Diamonds: 1, Clubs: 2, Spades: 3 };
    return entries.sort((a, b) => {
        const suitDelta = suitOrder[a.card.suit] - suitOrder[b.card.suit];
        return suitDelta !== 0 ? suitDelta : rankValue(b.card.rank) - rankValue(a.card.rank);
    });
}

function renderHand(playerId) {
    const isAI = playerId !== 0;
    const isVertical = playerId === 1 || playerId === 3;
    const containerId = ['p0-hand', 'p1-hand', 'p2-hand', 'p3-hand'][playerId];
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const cards = state.hands[playerId];
    const count = cards.length;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const entries = playerId === 0
        ? humanCardEntries(cards)
        : cards.map((card, cardIndex) => ({ card, cardIndex }));

    entries.forEach(({ card, cardIndex }, visualIndex) => {
        const wrapper = document.createElement(playerId === 0 ? 'button' : 'div');
        wrapper.className = `card-wrapper${playerId === 0 ? ' card-control' : ''}`;
        wrapper.dataset.cardIndex = String(cardIndex);

        if (playerId === 0) {
            wrapper.type = 'button';
            wrapper.disabled = true;
            wrapper.setAttribute('aria-disabled', 'true');
            wrapper.setAttribute('aria-label', `${card.rank} of ${card.suit}`);
        }

        const cardEl = buildCard(card, isAI);
        if (playerId === 0) cardEl.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(cardEl);

        if (isVertical) {
            if (visualIndex > 0) wrapper.style.marginTop = '-48px';
            wrapper.style.zIndex = String(visualIndex + 1);
        } else if (playerId === 2) {
            if (visualIndex > 0) wrapper.style.marginLeft = '-30px';
            wrapper.style.zIndex = String(visualIndex + 1);
        } else {
            const mid = (count - 1) / 2;
            const angle = Math.max(-15, Math.min(15, (visualIndex - mid) * 4.2));
            const yArc = Math.pow(visualIndex - mid, 2) * 1.7;
            const restingTransform = `rotate(${angle}deg) translateY(${yArc}px)`;
            wrapper.style.transform = restingTransform;
            if (visualIndex > 0) wrapper.style.marginLeft = 'clamp(-42px, -3vw, -26px)';
            wrapper.style.zIndex = String(visualIndex + 1);

            if (runtime.selectedCardIndex === cardIndex) {
                cardEl.classList.add('card-selected');
                wrapper.style.transform = 'rotate(0deg) translateY(-24px) scale(1.04)';
                wrapper.style.zIndex = '240';
            }

            wrapper.addEventListener('mouseenter', () => {
                if (coarsePointer || cardEl.classList.contains('card-invalid')) return;
                wrapper.style.transform = 'rotate(0deg) translateY(-24px) scale(1.06)';
                wrapper.style.zIndex = '220';
            });
            wrapper.addEventListener('mouseleave', () => {
                if (runtime.selectedCardIndex === cardIndex) return;
                wrapper.style.transform = restingTransform;
                wrapper.style.zIndex = String(visualIndex + 1);
            });

            wrapper.addEventListener('click', () => {
                if (runtime.dealing || runtime.processing) return;
                if (state.turnIndex !== 0) {
                    setStatus(`Not your turn – waiting for ${PLAYER_NAMES[state.turnIndex]}.`);
                    return;
                }
                if (!state.trump) return;

                if (coarsePointer && runtime.selectedCardIndex !== cardIndex) {
                    runtime.selectedCardIndex = cardIndex;
                    renderHand(0);
                    setStatus(`${card.rank} of ${card.suit} selected. Tap again to play.`);
                    return;
                }

                runtime.pendingPlayRect = wrapper.getBoundingClientRect();
                runtime.selectedCardIndex = null;
                const ok = tryPlayCard(0, cardIndex);
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

    const counter = document.getElementById(`p${playerId}-count`);
    if (counter) counter.textContent = count;

    if (playerId === 0) requestAnimationFrame(() => highlightValidCards());
}

function renderAllHands() { [0, 1, 2, 3].forEach(id => renderHand(id)); }

/* ===== TRICK HISTORY PANEL ===== */
function updateTrickHistoryPanel() {
    const panel = document.getElementById('trick-history-panel');
    const button = document.getElementById('previous-trick-btn');
    const title = document.getElementById('previous-trick-title');
    if (!panel) return;
    panel.innerHTML = '';

    const previous = state.trickHistory.at(-1);
    if (!previous) {
        panel.innerHTML = '<span class="history-empty">No completed trick yet.</span>';
        if (button) button.disabled = true;
        if (title) title.textContent = 'No completed trick';
        return;
    }

    if (button) button.disabled = false;
    if (title) title.textContent = `Trick ${previous.trickNum} · ${PLAYER_NAMES[previous.winner]} won`;
    previous.plays.forEach(({ player, card }) => {
        const play = document.createElement('div');
        play.className = `previous-trick-play${player === previous.winner ? ' is-winner' : ''}`;
        const label = document.createElement('span');
        label.className = 'previous-trick-player';
        label.textContent = PLAYER_NAMES[player];
        play.append(label, createMiniCardElement(card));
        panel.appendChild(play);
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
    persistActiveMatch();
}

async function handleDealBatchAnimation({ event }) {
    runtime.dealing = true;
    Sound.play('card');
    renderHand(event.playerIndex);
    const container = document.getElementById(['p0-hand', 'p1-hand', 'p2-hand', 'p3-hand'][event.playerIndex]);
    markDealtCards(container, event.cards.length, event.playerIndex);
    await delay(460);

    // DEAL_COMPLETED is emitted before this presentation hook finishes.
    // Release the temporary dealing guard once authoritative state has
    // advanced, otherwise the human card buttons remain disabled.
    runtime.dealing = [PHASE.DEAL_INITIAL, PHASE.DEAL_REMAINING].includes(state.phase);
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
    // A human-turn hook can only occur after dealing has finished. Clear
    // both UI guards before enabling the legal native card buttons.
    runtime.processing = false;
    runtime.dealing = false;
    updateTurnBadges();
    setStatus('YOUR TURN! Click a card to play.');
    highlightValidCards();
}

async function handleAfterCardPlayed({ event }) {
    if (!event) return;
    const slotMap = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
    const target = document.getElementById(`trick-${slotMap[event.playerId]}`);
    await animateCardPlay({
        card: event.card,
        playerId: event.playerId,
        targetElement: target,
        sourceRect: event.playerId === 0 ? runtime.pendingPlayRect : null,
    });
    runtime.pendingPlayRect = null;
}

async function handleBeforeTrickComplete({ preview }) {
    runtime.processing = true;
    updateTurnBadges();

    const slotMap = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
    const winningSlot = document.getElementById(`trick-${slotMap[preview.winner]}`);
    await pulseWinningCard(winningSlot);

    const trickNum = state.trickHistory.length + 1;
    Sound.play('trick');
    appendLog(`${PLAYER_NAMES[preview.winner]} won trick #${trickNum}`, 'trick');
    showTrickWinBanner(`${PLAYER_NAMES[preview.winner]} wins the trick`);
    await delay(320);

    await animateTrickCollection({
        winnerId: preview.winner,
        slotElements: ['north', 'east', 'south', 'west'].map(side => document.getElementById(`trick-${side}`)),
    });
}

async function handleAfterTrickComplete({ event }) {
    runtime.stats.tricksWonByPlayer[event.winner]++;
    runtime.processing = false;
    persistActiveMatch();
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
    persistActiveMatch();
}

/* ===== HAND SORT ===== */
function sortHand() {
    runtime.humanSortEnabled = true;
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

    if (state.phase === PHASE.IDLE) {
        clearSavedGame();
        runtime.stats = freshStats();
    }

    runtime.processing = false;
    runtime.dealing = true;
    runtime.selectedCardIndex = null;

    document.getElementById('start-btn').hidden = true;
    document.getElementById('sort-btn').hidden = false;

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

    const overlay = document.getElementById('modal-overlay');
    openModalSurface(overlay, { initialFocus: overlay.querySelector('.suit-btn') });
}

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', event => {
        Sound.init();
        closeModalSurface(document.getElementById('modal-overlay'));
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
    if (!result.tied) {
        runtime.stats.roundsWon[result.winnerTeam]++;
        if (result.isDefense) runtime.stats.defends[result.winnerTeam]++;
        if (result.isKapothi) runtime.stats.kaputhis[result.winnerTeam]++;
    }

    if (result.tied) {
        Sound.play('card');
    } else if (result.isKapothi) {
        Sound.play('kapothi');
    } else if (result.winnerTeam === 0) {
        Sound.play('win');
    } else {
        Sound.play('lose');
    }

    updateScoreboard();
    updateTrickHistoryPanel();

    if (result.matchOver) {
        showMatchWin();
        return;
    }

    const view = handResultView({ result, state });
    appendLog(`── ${view.title}: ${view.tokenAward} ──`, 'result');
    setStatus(`${view.title}. ${view.tokenAward}.`);

    document.getElementById('hand-result-eyebrow').textContent = view.eyebrow;
    document.getElementById('hand-result-title').textContent = view.title;
    document.getElementById('hand-result-summary').textContent = view.summary;
    document.getElementById('hand-result-tricks').textContent = view.trickScore;
    document.getElementById('hand-result-tokens').textContent = view.tokenAward;
    document.getElementById('hand-result-carry').textContent = view.carry;
    document.getElementById('hand-result-dealer').textContent = view.nextDealer;
    const handOverlay = document.getElementById('hand-result-overlay');
    openModalSurface(handOverlay, { initialFocus: document.getElementById('hand-next-btn') });

    if (result.isKapothi) fireConfetti();
}

function showMatchWin() {
    if (!state.matchOver) return false;

    const view = matchResultView({ state, stats: runtime.stats });
    clearSavedGame();
    appendLog(`🏆 MATCH WON by ${view.title}!`, 'match');

    // Persist to match history and compute rating delta
    const elapsedMs = Math.max(0, Date.now() - (runtime.stats.startedAt ?? Date.now()));
    const { ratingDelta } = saveMatchResult({
        outcome: view.winnerTeam === 0 ? 'win' : 'loss',
        finalScore: [state.tokens[0], state.tokens[1]],
        handsPlayed: state.handNumber,
        kapothisFor: runtime.stats.kaputhis[0] ?? 0,
        kapothisAgainst: runtime.stats.kaputhis[1] ?? 0,
        durationMs: elapsedMs,
    });

    closeModalSurface(document.getElementById('hand-result-overlay'), { restoreFocus: false });
    document.getElementById('match-result-eyebrow').textContent = view.eyebrow;
    document.getElementById('match-winner-text').textContent = view.title;
    document.getElementById('match-result-summary').textContent = view.winnerTeam === 0
        ? 'You and your partner reached the 10-token target first.'
        : 'The opposing partnership reached the 10-token target first.';
    document.getElementById('match-final-score').textContent = view.finalScore;
    document.getElementById('match-hands-played').textContent = view.handsPlayed;
    document.getElementById('match-kapothis').textContent = `${view.kapothis[0]} – ${view.kapothis[1]}`;
    document.getElementById('match-duration').textContent = view.duration;

    // Show rating delta badge if element exists
    const ratingBadge = document.getElementById('match-rating-delta');
    if (ratingBadge) {
        const sign = ratingDelta >= 0 ? '+' : '';
        ratingBadge.textContent = `${sign}${ratingDelta} Rating`;
        ratingBadge.className = `rating-delta-badge ${ratingDelta >= 0 ? 'rating-delta--win' : 'rating-delta--loss'}`;
        ratingBadge.hidden = false;
    }

    const matchOverlay = document.getElementById('match-win-overlay');
    openModalSurface(matchOverlay, { initialFocus: document.getElementById('match-play-again-btn') });

    if (view.winnerTeam === 0) fireConfetti();
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

    const statsModal = document.getElementById('stats-modal');
    openModalSurface(statsModal, {
        initialFocus: document.getElementById('stats-close-btn'),
        onEscape: closeStatsPanel,
    });
}

function closeStatsPanel() {
    closeModalSurface(document.getElementById('stats-modal'));
}

function updateMuteButton() {
    const button = document.getElementById('mute-btn');
    if (!button) return;
    button.textContent = runtime.muted ? '🔇' : '🔊';
    button.setAttribute('aria-label', runtime.muted ? 'Enable sound' : 'Mute sound');
    button.title = runtime.muted ? 'Enable sound' : 'Mute sound';
}

/* Reflect menu-selected sound preference before the first interaction. */
updateMuteButton();
Sound.setEnabled(!runtime.muted);

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
document.getElementById('stats-close-btn').addEventListener('click', closeStatsPanel);

// Mute toggle
document.getElementById('mute-btn').addEventListener('click', () => {
    Sound.init();
    runtime.muted = !runtime.muted;
    Sound.setEnabled(!runtime.muted);
    settings = saveSettings({ ...settings, sound: !runtime.muted });
    updateMuteButton();
    syncSettingsModal();
});

// ── Pause Menu ────────────────────────────────────────────────────────
const pauseMenu = document.getElementById('pause-menu');
const menuBtn = document.getElementById('menu-btn');

function openPauseMenu() {
    menuBtn.setAttribute('aria-expanded', 'true');
    openModalSurface(pauseMenu, {
        initialFocus: document.getElementById('pause-continue-btn'),
        onEscape: closePauseMenu,
    });
}
function closePauseMenu({ restoreFocus = true } = {}) {
    menuBtn.setAttribute('aria-expanded', 'false');
    closeModalSurface(pauseMenu, { restoreFocus });
}

menuBtn.addEventListener('click', () => {
    if (!pauseMenu.classList.contains('hidden')) {
        closePauseMenu();
    } else {
        openPauseMenu();
    }
});
document.getElementById('pause-continue-btn').addEventListener('click', () => closePauseMenu());
document.getElementById('pause-stats-btn').addEventListener('click', () => {
    closePauseMenu({ restoreFocus: false });
    showStatsPanel();
});
document.getElementById('pause-settings-btn').addEventListener('click', () => {
    closePauseMenu({ restoreFocus: false });
    openSettingsModal();
});
// "Back to Main Menu" is a plain <a> — no extra JS needed.

// ── Settings Modal ────────────────────────────────────────────────────
const settingsModal = document.getElementById('settings-modal');
const difficultySetting = document.getElementById('difficulty-setting');
const soundSetting = document.getElementById('sound-setting');
const animationSpeedSetting = document.getElementById('animation-speed-setting');
const reducedMotionSetting = document.getElementById('reduced-motion-setting');
const settingsCloseBtn = document.getElementById('settings-close-btn');

function syncSettingsModal() {
    settings = loadSettings();
    difficultySetting.value = settings.difficulty;
    soundSetting.value = (!runtime.muted && settings.sound) ? 'on' : 'off';
    animationSpeedSetting.value = settings.animationSpeed ?? 'normal';
    reducedMotionSetting.value = settings.reducedMotion ?? 'system';
}

function openSettingsModal() {
    syncSettingsModal();
    openModalSurface(settingsModal, {
        initialFocus: settingsCloseBtn,
        onEscape: closeSettingsModal,
    });
}
function closeSettingsModal() {
    closeModalSurface(settingsModal);
}

function commitGameSettings() {
    const isSoundOn = soundSetting.value === 'on';
    runtime.muted = !isSoundOn;
    Sound.setEnabled(isSoundOn);
    updateMuteButton();

    const newDiff = difficultySetting.value === 'casual' ? 'casual' : 'smart';
    controller.setDifficulty(newDiff === 'casual' ? AI_DIFFICULTY.CASUAL : AI_DIFFICULTY.SMART);

    settings = saveSettings({
        difficulty: newDiff,
        sound: isSoundOn,
        animationSpeed: animationSpeedSetting.value,
        reducedMotion: reducedMotionSetting.value,
    });
    configureMotion(settings);
}

difficultySetting.addEventListener('change', commitGameSettings);
soundSetting.addEventListener('change', commitGameSettings);
animationSpeedSetting.addEventListener('change', commitGameSettings);
reducedMotionSetting.addEventListener('change', commitGameSettings);
settingsCloseBtn.addEventListener('click', closeSettingsModal);

settingsModal.addEventListener('click', event => {
    if (event.target === settingsModal) closeSettingsModal();
});

// Fair-information helper popovers remain non-modal but move focus to their
// close control so keyboard/screen-reader users immediately enter the surface.
const hintPopover = document.getElementById('hint-popover');
const hintButton = document.getElementById('hint-btn');
const previousTrickPopover = document.getElementById('previous-trick-popover');
const previousTrickButton = document.getElementById('previous-trick-btn');
let helperReturnFocus = null;

function closeHelperPopover(popover, trigger, { restoreFocus = true } = {}) {
    if (!popover || popover.classList.contains('hidden')) return;
    popover.classList.add('hidden');
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && helperReturnFocus instanceof HTMLElement) {
        helperReturnFocus.focus({ preventScroll: true });
    }
    helperReturnFocus = null;
}

function openHelperPopover(popover, trigger, closeButton) {
    helperReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    popover.classList.remove('hidden');
    trigger?.setAttribute('aria-expanded', 'true');
    closeButton?.focus({ preventScroll: true });
}

hintButton.addEventListener('click', () => {
    closeHelperPopover(previousTrickPopover, previousTrickButton, { restoreFocus: false });
    const hint = buildHumanHint(controller.getSnapshot(), 0);
    document.getElementById('hint-title').textContent = hint.title;
    document.getElementById('hint-message').textContent = hint.message;
    openHelperPopover(hintPopover, hintButton, document.getElementById('hint-close'));
});
document.getElementById('hint-close').addEventListener('click', () => {
    closeHelperPopover(hintPopover, hintButton);
});

// Previous trick popover
previousTrickButton.addEventListener('click', () => {
    if (!previousTrickPopover.classList.contains('hidden')) {
        closeHelperPopover(previousTrickPopover, previousTrickButton);
        return;
    }
    closeHelperPopover(hintPopover, hintButton, { restoreFocus: false });
    updateTrickHistoryPanel();
    openHelperPopover(previousTrickPopover, previousTrickButton, document.getElementById('previous-trick-close'));
});
document.getElementById('previous-trick-close').addEventListener('click', () => {
    closeHelperPopover(previousTrickPopover, previousTrickButton);
});

// Hand result actions
function closeHandResultAndStartNext() {
    closeModalSurface(document.getElementById('hand-result-overlay'), { restoreFocus: false });
    startRound();
}
document.getElementById('hand-next-btn').addEventListener('click', closeHandResultAndStartNext);
document.getElementById('hand-stats-btn').addEventListener('click', showStatsPanel);

// Play again (match win)
document.getElementById('match-play-again-btn').addEventListener('click', () => {
    Sound.init();
    closeModalSurface(document.getElementById('match-win-overlay'), { restoreFocus: false });

    controller.resetMatch().then(() => {
        runtime.processing = false;
        runtime.dealing = false;
        runtime.gameLog = [];
        runtime.stats = freshStats();
        clearSavedGame();
        document.getElementById('game-log-list').innerHTML = '';
        document.getElementById('show-stats-btn').hidden = true;
        refreshUI();
        const btn = document.getElementById('start-btn');
        btn.textContent    = 'Start Game';
        btn.hidden = false;
        document.getElementById('sort-btn').hidden = true;
    }).catch(error => handleControllerError(error, 'Unable to reset the match.'));
});


// Close non-modal helper popovers without interrupting the match.
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!hintPopover.classList.contains('hidden')) {
        closeHelperPopover(hintPopover, hintButton);
    } else if (!previousTrickPopover.classList.contains('hidden')) {
        closeHelperPopover(previousTrickPopover, previousTrickButton);
    }
});

window.addEventListener('pagehide', persistActiveMatch);

function bootstrapGamePage() {
    refreshUI();

    if (!resumeRecord) {
        setStatus('Ready for a match?');
        return;
    }

    const startButton = document.getElementById('start-btn');
    const sortButton = document.getElementById('sort-btn');
    sortButton.hidden = state.hands[0].length === 0;

    if (state.phase === PHASE.HAND_COMPLETE) {
        startButton.textContent = 'Next Hand';
        startButton.hidden = false;
        document.getElementById('show-stats-btn').hidden = false;
        setStatus(`Saved match restored after hand ${state.handNumber}.`);
        return;
    }

    startButton.hidden = true;
    setStatus('Resuming saved match…');
    controller.resumeMatch()
        .then(() => persistActiveMatch())
        .catch(error => handleControllerError(error, 'Unable to resume the saved match.'));
}

bootstrapGamePage();
