/* ===== GAME ENGINE ===== */
const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function suitSymbol(suit) {
    return { Hearts:'♥', Diamonds:'♦', Clubs:'♣', Spades:'♠' }[suit];
}
function rankValue(rank) { return RANKS.indexOf(rank); }
function isRed(suit) { return suit === 'Hearts' || suit === 'Diamonds'; }

class Card { constructor(s,r){ this.suit=s; this.rank=r; } }

class Deck {
    constructor() { this.reset(); }
    reset() {
        this.cards = [];
        for (const s of SUITS) for (const r of RANKS) this.cards.push(new Card(s,r));
        this.shuffle();
    }
    shuffle() {
        for (let i=this.cards.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [this.cards[i],this.cards[j]]=[this.cards[j],this.cards[i]];
        }
    }
    deal(n) { return this.cards.splice(this.cards.length-n, n); }
}

/* ===== GAME STATE ===== */
// Players: 0=South(You), 1=West, 2=North(Partner), 3=East
// Teams: NS = [0,2],  EW = [1,3]
const state = {
    hands:      [[], [], [], []],
    tricks:     [0, 0, 0, 0],      // tricks per player this round
    tokens:     [[0], [0]],         // team tokens: [NS, EW]
    teamTricks: [0, 0],             // cumulative tricks per team this round
    trump:      null,
    trumpCaller: null,
    currentTrick: [],               // [{player, card}]
    turnIndex:  0,
    dealerIndex: 3,                 // rotates each round
    processing:  false,
    deck: new Deck()
};

function teamOf(playerIndex) { return (playerIndex === 0 || playerIndex === 2) ? 0 : 1; }

/* ===== UI HELPERS ===== */
function setStatus(msg) { document.getElementById('status-banner').textContent = msg; }

function updateScoreboard() {
    document.getElementById('ns-tricks').textContent = state.teamTricks[0];
    document.getElementById('ew-tricks').textContent = state.teamTricks[1];
    document.getElementById('ns-tokens').textContent = state.tokens[0][0];
    document.getElementById('ew-tokens').textContent = state.tokens[1][0];
}

function updateTrumpBadge() {
    const icon = document.getElementById('trump-icon');
    const caller = document.getElementById('trump-caller');
    if (state.trump) {
        icon.textContent = suitSymbol(state.trump);
        icon.style.color = isRed(state.trump) ? '#d00' : '#eee';
        const names = ['You','West','Partner','East'];
        caller.textContent = names[state.trumpCaller];
    } else {
        icon.textContent = '–';
        icon.style.color = '#fff';
        caller.textContent = '';
    }
}

function updateTurnBadges() {
    const playerIds = [0,1,2,3];
    playerIds.forEach(pid => {
        const area = document.getElementById(`player-${pid}`);
        if (!area) return;
        const badge = area.querySelector('.turn-badge');
        if (pid === state.turnIndex && !state.processing) {
            area.classList.add('active-turn');
            if (badge) { badge.classList.remove('hidden'); badge.textContent = pid===0?'Your Turn!':'...'; }
        } else {
            area.classList.remove('active-turn');
            if (badge) badge.classList.add('hidden');
        }
    });
}

function updateTrickSlots() {
    const slotMap = { 0:'south', 1:'west', 2:'north', 3:'east' };
    ['north','south','west','east'].forEach(d => {
        document.getElementById('trick-'+d).innerHTML = '';
    });
    state.currentTrick.forEach(({player, card}) => {
        const slot = document.getElementById('trick-'+slotMap[player]);
        if (slot) slot.appendChild(buildCard(card, false));
    });
}

/* ===== CARD RENDERING ===== */
function buildCard(card, faceDown) {
    const div = document.createElement('div');
    div.className = 'card' + (faceDown ? ' face-down' : (isRed(card.suit)?' red':' black'));
    if (!faceDown) {
        const sym = suitSymbol(card.suit);
        // Top-left corner
        const tl = document.createElement('div'); tl.className = 'card-tl';
        tl.innerHTML = `<span class="cr">${card.rank}</span><span class="cs">${sym}</span>`;
        // Center
        const center = document.createElement('div');
        if (card.rank === 'A') {
            center.className = 'card-center';
            center.textContent = sym;
            center.style.fontSize = '2.2rem';
        } else if (['K','Q','J'].includes(card.rank)) {
            center.className = 'card-center court';
            const icons = {K:'♔', Q:'♕', J:'♘'};
            center.innerHTML = `${icons[card.rank]}<span class="court-sub">${sym}</span>`;
        } else {
            center.className = 'card-center';
            center.textContent = sym;
        }
        // Bottom-right corner
        const br = document.createElement('div'); br.className = 'card-br';
        br.innerHTML = `<span class="cr">${card.rank}</span><span class="cs">${sym}</span>`;
        div.appendChild(tl);
        div.appendChild(center);
        div.appendChild(br);
    }
    return div;
}

/* ===== HAND RENDERING ===== */
function renderHand(playerId) {
    const isAI = playerId !== 0;
    const cards = state.hands[playerId];
    const isVertical = (playerId === 1 || playerId === 3);
    const containerId = (playerId === 0) ? 'p0-hand' :
                        (playerId === 1) ? 'p1-hand' :
                        (playerId === 2) ? 'p2-hand' : 'p3-hand';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const n = cards.length;
    cards.forEach((card, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';

        const cardEl = buildCard(card, isAI);
        wrapper.appendChild(cardEl);

        if (isVertical) {
            // Side players – overlap vertically, show face-down
            if (index > 0) wrapper.style.marginTop = '-68px';
            wrapper.style.zIndex = String(index + 1);
            wrapper.style.cursor = 'default';
        } else if (playerId === 2) {
            // North partner – horizontal overlap, face-down
            if (index > 0) wrapper.style.marginLeft = '-40px';
            wrapper.style.zIndex = String(index + 1);
            wrapper.style.cursor = 'default';
        } else {
            // South (You) – fanned arc, face-up, clickable
            const mid = (n - 1) / 2;
            const angle = (index - mid) * 5;
            const yArc  = Math.pow(index - mid, 2) * 2.5;
            wrapper.style.setProperty('--fan-rotate', `${angle}deg`);
            wrapper.style.setProperty('--fan-y', `${yArc}px`);
            wrapper.style.transform = `rotate(${angle}deg) translateY(${yArc}px)`;
            wrapper.style.transformOrigin = 'bottom center';
            if (index > 0) wrapper.style.marginLeft = '-38px';
            wrapper.style.zIndex = String(index + 1);

            // Hover: un-rotate and lift
            wrapper.addEventListener('mouseenter', () => {
                wrapper.style.transform = `rotate(0deg) translateY(-28px) scale(1.12)`;
                wrapper.style.zIndex = '200';
            });
            wrapper.addEventListener('mouseleave', () => {
                wrapper.style.transform = `rotate(${angle}deg) translateY(${yArc}px)`;
                wrapper.style.zIndex = String(index + 1);
            });

            // Click to play
            wrapper.addEventListener('click', () => {
                if (state.turnIndex !== 0) {
                    const names=['You','West','Partner','East'];
                    setStatus(`Not your turn – waiting for ${names[state.turnIndex]}.`);
                    return;
                }
                if (state.processing || !state.trump) return;
                const ok = tryPlayCard(0, index);
                if (!ok) {
                    cardEl.classList.remove('shake');
                    void cardEl.offsetWidth; // reflow to restart animation
                    cardEl.classList.add('shake');
                    setTimeout(() => cardEl.classList.remove('shake'), 400);
                }
            });
        }

        container.appendChild(wrapper);
    });
}

function renderAllHands() {
    [0,1,2,3].forEach(id => renderHand(id));
}

function refreshUI() {
    renderAllHands();
    updateScoreboard();
    updateTrumpBadge();
    updateTrickSlots();
    updateTurnBadges();
}

/* ===== GAME FLOW ===== */
document.getElementById('start-btn').addEventListener('click', startRound);

function startRound() {
    // Reset round state
    state.deck.reset();
    state.hands = [[], [], [], []];
    state.teamTricks = [0, 0];
    state.trump = null;
    state.currentTrick = [];
    state.processing = false;
    state.trumpCaller = (state.dealerIndex + 1) % 4;
    state.turnIndex = state.trumpCaller;

    // Deal first 4 cards each
    for (let p=0; p<4; p++) state.hands[p].push(...state.deck.deal(4));

    document.getElementById('start-btn').style.display = 'none';
    refreshUI();

    const names = ['You','West','Partner','East'];
    setStatus(`${names[state.trumpCaller]} is choosing trump…`);

    if (state.trumpCaller === 0) {
        showTrumpModal();
    } else {
        setTimeout(aiPickTrump, 900);
    }
}

function aiPickTrump() {
    const hand = state.hands[state.trumpCaller];
    // Count suits and pick the most common
    const counts = { Hearts:0, Diamonds:0, Clubs:0, Spades:0 };
    hand.forEach(c => counts[c.suit]++);
    const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    confirmTrump(best);
}

function showTrumpModal() {
    const preview = document.getElementById('hand-preview');
    preview.innerHTML = '';
    state.hands[0].forEach((card, i) => {
        const w = document.createElement('div');
        w.className = 'card-wrapper';
        w.appendChild(buildCard(card, false));
        if (i > 0) w.style.marginLeft = '-28px';
        w.style.zIndex = String(i+1);
        preview.appendChild(w);
    });
    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        document.getElementById('modal-overlay').classList.add('hidden');
        confirmTrump(e.currentTarget.dataset.suit);
    });
});

function confirmTrump(suit) {
    state.trump = suit;
    // Deal remaining 4 cards each
    for (let p=0; p<4; p++) state.hands[p].push(...state.deck.deal(4));
    refreshUI();
    const names = ['You','West','Partner','East'];
    setStatus(`${names[state.trumpCaller]} chose ${suit} as trump! ${names[state.trumpCaller]} leads first.`);
    processTurn();
}

/* ===== TURN PROCESSING ===== */
function processTurn() {
    if (state.processing) return;
    updateTurnBadges();
    const names = ['You','West','Partner','East'];
    if (state.turnIndex === 0) {
        setStatus('YOUR TURN! Click a card to play.');
    } else {
        setStatus(`${names[state.turnIndex]} is thinking…`);
        setTimeout(() => aiPlay(state.turnIndex), 750);
    }
}

function aiPlay(pid) {
    if (state.turnIndex !== pid || state.processing) return;
    const hand = state.hands[pid];
    let valid = [];
    if (state.currentTrick.length > 0) {
        const ledSuit = state.currentTrick[0].card.suit;
        valid = hand.map((_,i)=>i).filter(i => hand[i].suit === ledSuit);
    }
    if (valid.length === 0) valid = hand.map((_,i)=>i);
    // Play highest valid card
    valid.sort((a,b) => rankValue(hand[b].rank) - rankValue(hand[a].rank));
    tryPlayCard(pid, valid[0]);
}

function tryPlayCard(playerIndex, cardIndex) {
    if (state.processing) return false;
    const hand  = state.hands[playerIndex];
    const card  = hand[cardIndex];

    // Follow-suit rule
    if (state.currentTrick.length > 0) {
        const ledSuit = state.currentTrick[0].card.suit;
        if (card.suit !== ledSuit && hand.some(c => c.suit === ledSuit)) {
            if (playerIndex === 0) setStatus(`Must follow suit: ${ledSuit}!`);
            return false;
        }
    }

    // Remove from hand, add to trick
    hand.splice(cardIndex, 1);
    state.currentTrick.push({ player: playerIndex, card });
    refreshUI();

    if (state.currentTrick.length === 4) {
        state.processing = true;
        setTimeout(resolveTrick, 1100);
    } else {
        state.turnIndex = (state.turnIndex + 1) % 4;
        processTurn();
    }
    return true;
}

function resolveTrick() {
    const ledSuit = state.currentTrick[0].card.suit;
    let best = -1, winner = -1;
    for (const {player, card} of state.currentTrick) {
        let val = -1;
        if (card.suit === state.trump) val = rankValue(card.rank) + 100;
        else if (card.suit === ledSuit) val = rankValue(card.rank);
        if (val > best) { best=val; winner=player; }
    }

    const team = teamOf(winner);
    state.teamTricks[team]++;

    state.currentTrick = [];
    state.turnIndex = winner;
    state.processing = false;
    refreshUI();

    const names = ['You','West','Partner','East'];
    setStatus(`${names[winner]} won the trick!`);

    if (state.hands[0].length === 0) {
        setTimeout(endRound, 900);
    } else {
        setTimeout(processTurn, 700);
    }
}

function endRound() {
    const ns = state.teamTricks[0];
    const ew = state.teamTricks[1];
    const callerTeam = teamOf(state.trumpCaller);
    const defTeam    = 1 - callerTeam;

    let msg = `Round Over! NS ${ns} vs EW ${ew}. `;
    if (state.teamTricks[callerTeam] >= 5) {
        const bonus = state.teamTricks[callerTeam] === 8 ? 2 : 1;
        state.tokens[callerTeam][0] += bonus;
        msg += state.teamTricks[callerTeam] === 8
            ? `KAPUTHI! ${callerTeam===0?'NS':'EW'} swept all 8 tricks! (+2 tokens)`
            : `${callerTeam===0?'NS':'EW'} won the round! (+1 token)`;
    } else {
        state.tokens[defTeam][0] += 2;
        msg += `DEFENDED! ${callerTeam===0?'NS':'EW'} failed. ${defTeam===0?'NS':'EW'} gets +2 tokens.`;
    }

    setStatus(msg);
    updateScoreboard();
    state.dealerIndex = (state.dealerIndex + 1) % 4;

    const btn = document.getElementById('start-btn');
    btn.textContent = 'Next Round';
    btn.style.display = 'inline-block';
}
