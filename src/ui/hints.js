import { cardId, rankValue, suitSymbol } from '../engine/cards.js';
import { PHASE } from '../engine/constants.js';
import { partnerOf } from '../engine/players.js';
import { resolveTrick } from '../engine/trick.js';

function cardLabel(card) {
    return `${card.rank}${suitSymbol(card.suit)}`;
}

/**
 * Produce a fair-information hint for the human player.
 * The function only inspects the supplied public state plus the human hand.
 */
export function buildHumanHint(state, humanPlayerId = 0) {
    if (!state || !Array.isArray(state.hands?.[humanPlayerId])) {
        return { title: 'Hint unavailable', message: 'The current hand is not available.' };
    }

    if (state.phase === PHASE.TRUMP_SELECTION && state.trumpCaller === humanPlayerId) {
        const counts = new Map();
        for (const card of state.hands[humanPlayerId]) {
            const entry = counts.get(card.suit) ?? { count: 0, strength: 0 };
            entry.count += 1;
            entry.strength += rankValue(card.rank);
            counts.set(card.suit, entry);
        }
        const best = [...counts.entries()].sort((a, b) =>
            b[1].count - a[1].count || b[1].strength - a[1].strength,
        )[0];
        return best
            ? {
                title: 'Choosing trump',
                message: `${best[0]} is your longest first-four suit (${best[1].count} card${best[1].count === 1 ? '' : 's'}). Length and high cards are useful when choosing trump.`,
            }
            : { title: 'Choosing trump', message: 'Choose the suit that gives your first four cards the strongest combination of length and high cards.' };
    }

    if (state.phase !== PHASE.PLAYING) {
        return { title: 'Game hint', message: 'Start or continue the hand to receive a play-specific hint.' };
    }

    if (state.turnIndex !== humanPlayerId) {
        return {
            title: 'Watch the table',
            message: 'It is not your turn. Watch which suits players follow or fail to follow; that public information becomes valuable later in the hand.',
        };
    }

    const hand = state.hands[humanPlayerId];
    if (hand.length === 0) return { title: 'Hand complete', message: 'All eight cards have been played.' };

    if (state.currentTrick.length === 0) {
        const nonTrump = hand.filter(card => card.suit !== state.trump).sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
        const candidate = nonTrump[0] ?? [...hand].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
        return {
            title: 'You are leading',
            message: candidate
                ? `Any card is legal. If you want to conserve strength, ${cardLabel(candidate)} is your lowest available lead.`
                : 'Any card in your hand is legal when you lead a trick.',
            cardId: candidate ? cardId(candidate) : null,
        };
    }

    const leadSuit = state.currentTrick[0].card.suit;
    const matching = hand.filter(card => card.suit === leadSuit);
    const legalCards = matching.length ? matching : hand;
    const currentWinner = resolveTrick(state.currentTrick, state.trump).winner;
    const partner = partnerOf(humanPlayerId);

    if (currentWinner === partner) {
        const lowest = [...legalCards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
        return {
            title: matching.length ? `Follow ${leadSuit}` : `You are void in ${leadSuit}`,
            message: `${matching.length ? `You must follow ${leadSuit}. ` : `You may play any suit. `}Your partner is currently winning, so preserving strength is often sensible. Your lowest legal card is ${cardLabel(lowest)}.`,
            cardId: cardId(lowest),
        };
    }

    const winningCards = legalCards
        .filter(card => resolveTrick([...state.currentTrick, { player: humanPlayerId, card }], state.trump).winner === humanPlayerId)
        .sort((a, b) => rankValue(a.rank) - rankValue(b.rank));

    if (winningCards.length) {
        const lowestWinner = winningCards[0];
        return {
            title: matching.length ? `Follow ${leadSuit}` : `You are void in ${leadSuit}`,
            message: `${matching.length ? `You must follow ${leadSuit}. ` : `You may play any suit. `}${cardLabel(lowestWinner)} is the lowest legal card in your hand that takes the lead right now.`,
            cardId: cardId(lowestWinner),
        };
    }

    const lowest = [...legalCards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
    return {
        title: matching.length ? `Follow ${leadSuit}` : `You are void in ${leadSuit}`,
        message: `${matching.length ? `You must follow ${leadSuit}. ` : `You may play any suit. `}None of your legal cards can currently take the lead, so ${cardLabel(lowest)} preserves the most rank strength.`,
        cardId: cardId(lowest),
    };
}
