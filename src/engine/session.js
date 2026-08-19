import { Card, cardId } from './cards.js';
import { PHASE, PLAYER_COUNT, RANKS, SUITS } from './constants.js';

export const ENGINE_SESSION_VERSION = 1;

function assertCardData(card, label = 'card') {
    if (!card || typeof card !== 'object' || !SUITS.includes(card.suit) || !RANKS.includes(card.rank)) {
        throw new TypeError(`Invalid ${label}`);
    }
}

export function hydrateCard(card) {
    assertCardData(card);
    return new Card(card.suit, card.rank);
}

function hydratePlay(play, label) {
    if (!play || !Number.isInteger(play.player) || play.player < 0 || play.player >= PLAYER_COUNT) {
        throw new TypeError(`Invalid ${label} player`);
    }
    return { player: play.player, card: hydrateCard(play.card) };
}

function assertIntegerArray(value, length, label, min = 0) {
    if (!Array.isArray(value) || value.length !== length || value.some(n => !Number.isInteger(n) || n < min)) {
        throw new TypeError(`Invalid ${label}`);
    }
}

/**
 * Validate and rehydrate a serialized engine state.
 * Only JSON-safe rule state is accepted; no functions/browser values survive.
 */
export function hydrateState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new TypeError('Invalid saved engine state');
    }
    if (!Object.values(PHASE).includes(snapshot.phase)) throw new TypeError('Invalid saved phase');
    if (!Array.isArray(snapshot.hands) || snapshot.hands.length !== PLAYER_COUNT) throw new TypeError('Invalid saved hands');

    const state = {
        hands: snapshot.hands.map((hand, player) => {
            if (!Array.isArray(hand)) throw new TypeError(`Invalid saved hand ${player}`);
            return hand.map(hydrateCard);
        }),
        teamTricks: [...snapshot.teamTricks],
        trump: snapshot.trump,
        trumpCaller: snapshot.trumpCaller,
        currentTrick: (snapshot.currentTrick ?? []).map((play, i) => hydratePlay(play, `current trick play ${i}`)),
        turnIndex: snapshot.turnIndex,
        dealerIndex: snapshot.dealerIndex,
        playedCards: [...(snapshot.playedCards ?? [])],
        trickHistory: (snapshot.trickHistory ?? []).map((trick, i) => {
            if (!Number.isInteger(trick?.trickNum) || trick.trickNum !== i + 1) {
                throw new TypeError(`Invalid saved trick number at position ${i + 1}`);
            }
            if (!Number.isInteger(trick.winner) || trick.winner < 0 || trick.winner >= PLAYER_COUNT) {
                throw new TypeError(`Invalid saved trick winner at position ${i + 1}`);
            }
            if (!Array.isArray(trick.plays) || trick.plays.length !== PLAYER_COUNT) {
                throw new TypeError(`Saved trick ${i + 1} must contain four plays`);
            }
            return {
                trickNum: trick.trickNum,
                winner: trick.winner,
                plays: trick.plays.map((play, j) => hydratePlay(play, `trick ${i + 1} play ${j + 1}`)),
            };
        }),
        tokens: [...snapshot.tokens],
        carryTokens: snapshot.carryTokens,
        matchTokenTarget: snapshot.matchTokenTarget,
        matchOver: Boolean(snapshot.matchOver),
        handNumber: snapshot.handNumber,
        phase: snapshot.phase,
    };

    assertIntegerArray(state.teamTricks, 2, 'team tricks');
    assertIntegerArray(state.tokens, 2, 'token scores');
    if (!Number.isInteger(state.carryTokens) || state.carryTokens < 0) throw new TypeError('Invalid carry tokens');
    if (!Number.isInteger(state.matchTokenTarget) || state.matchTokenTarget <= 0) throw new TypeError('Invalid match target');
    if (!Number.isInteger(state.handNumber) || state.handNumber < 0) throw new TypeError('Invalid hand number');

    for (const [key, value] of [['dealer', state.dealerIndex], ['turn', state.turnIndex], ['trump caller', state.trumpCaller]]) {
        if (value !== null && (!Number.isInteger(value) || value < 0 || value >= PLAYER_COUNT)) {
            throw new TypeError(`Invalid ${key} player`);
        }
    }
    if (state.trump !== null && !SUITS.includes(state.trump)) throw new TypeError('Invalid saved trump');
    if (state.currentTrick.length > PLAYER_COUNT) throw new TypeError('Saved current trick contains too many plays');
    if (state.teamTricks[0] + state.teamTricks[1] !== state.trickHistory.length) {
        throw new TypeError('Saved trick counts do not match trick history');
    }

    const publicPlayedIds = [
        ...state.trickHistory.flatMap(trick => trick.plays.map(play => cardId(play.card))),
        ...state.currentTrick.map(play => cardId(play.card)),
    ];
    if (state.playedCards.length !== publicPlayedIds.length ||
        new Set(state.playedCards).size !== state.playedCards.length ||
        publicPlayedIds.some(id => !state.playedCards.includes(id))) {
        throw new TypeError('Saved played-card ledger does not match public tricks');
    }

    return state;
}

/** Ensure the active card zones contain one complete, duplicate-free Omi deck. */
export function validateActiveCards(state, deckCards = []) {
    const cards = [
        ...state.hands.flat(),
        ...state.currentTrick.map(play => play.card),
        ...state.trickHistory.flatMap(trick => trick.plays.map(play => play.card)),
        ...deckCards,
    ];

    if (state.phase === PHASE.IDLE) {
        if (cards.length !== 0) throw new TypeError('Idle save must not contain active cards');
        return;
    }

    if (cards.length !== 32) {
        throw new TypeError(`Saved match must contain 32 cards across active zones; found ${cards.length}`);
    }
    const ids = cards.map(cardId);
    if (new Set(ids).size !== ids.length) throw new TypeError('Saved match contains duplicate cards');
}
