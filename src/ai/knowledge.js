import { cardId } from '../engine/cards.js';
import { PLAYER_COUNT } from '../engine/constants.js';
import { partnerOf, teamOf } from '../engine/players.js';
import { getLegalCardIndices } from '../engine/rules.js';

function assertPlayerId(playerId) {
    if (!Number.isInteger(playerId) || playerId < 0 || playerId >= PLAYER_COUNT) {
        throw new RangeError(`Invalid AI player id: ${playerId}`);
    }
}

function copyCard(card) {
    return Object.freeze({ suit: card.suit, rank: card.rank });
}

function copyPlay(play) {
    return Object.freeze({ player: play.player, card: copyCard(play.card) });
}

function inferKnownVoidSuits(completedTricks, currentTrick) {
    const voids = Array.from({ length: PLAYER_COUNT }, () => new Set());
    const tricks = [
        ...completedTricks.map(trick => trick.plays),
        currentTrick,
    ];

    for (const plays of tricks) {
        if (plays.length < 2) continue;
        const leadSuit = plays[0].card.suit;
        for (const play of plays.slice(1)) {
            if (play.card.suit !== leadSuit) voids[play.player].add(leadSuit);
        }
    }

    return Object.freeze(voids.map(suits => Object.freeze([...suits])));
}

/**
 * Build the complete information an AI player is allowed to observe.
 *
 * Crucially, this view exposes only the AI player's own hand plus public
 * information. No teammate/opponent hidden hand is copied into the view.
 */
export function buildAIKnowledge(state, playerId) {
    assertPlayerId(playerId);

    const ownHand = state.hands[playerId].map(copyCard);
    const currentTrick = state.currentTrick.map(copyPlay);
    const completedTricks = state.trickHistory.map(trick => Object.freeze({
        trickNum: trick.trickNum,
        winner: trick.winner,
        plays: Object.freeze(trick.plays.map(copyPlay)),
    }));

    const publicPlayedCards = [
        ...completedTricks.flatMap(trick => trick.plays.map(play => play.card)),
        ...currentTrick.map(play => play.card),
    ];
    const knownVoidSuits = inferKnownVoidSuits(completedTricks, currentTrick);

    const legalIndices = getLegalCardIndices(ownHand, currentTrick);
    const legalCards = legalIndices.map(index => Object.freeze({
        index,
        cardId: cardId(ownHand[index]),
        card: ownHand[index],
    }));

    return Object.freeze({
        playerId,
        teamId: teamOf(playerId),
        partnerId: partnerOf(playerId),
        ownHand: Object.freeze(ownHand),
        legalCards: Object.freeze(legalCards),
        currentTrick: Object.freeze(currentTrick),
        completedTricks: Object.freeze(completedTricks),
        publicPlayedCards: Object.freeze(publicPlayedCards),
        knownVoidSuits,
        trump: state.trump,
        trumpCaller: state.trumpCaller,
        currentPlayerId: state.turnIndex,
        dealerId: state.dealerIndex,
        handNumber: state.handNumber,
        teamTricks: Object.freeze([...state.teamTricks]),
        tokens: Object.freeze([...state.tokens]),
        carryTokens: state.carryTokens,
        matchTokenTarget: state.matchTokenTarget,
        phase: state.phase,
    });
}
