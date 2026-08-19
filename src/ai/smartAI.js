import { rankValue } from '../engine/cards.js';
import { SUITS } from '../engine/constants.js';
import { teamOf } from '../engine/players.js';
import { cardStrength, resolveTrick } from '../engine/trick.js';

function byRankAscending(a, b) {
    return rankValue(a.card.rank) - rankValue(b.card.rank);
}

function byRankDescending(a, b) {
    return rankValue(b.card.rank) - rankValue(a.card.rank);
}

/**
 * Pick trump using only the first four visible cards.
 * Suit length is the primary signal; high-card strength breaks close ties.
 */
export function chooseSmartTrump(knowledge) {
    const scores = new Map(SUITS.map(suit => [suit, 0]));

    for (const card of knowledge.ownHand) {
        // Length is intentionally weighted more heavily than one isolated high card.
        const highCardBonus = rankValue(card.rank) / 10;
        scores.set(card.suit, scores.get(card.suit) + 10 + highCardBonus);
    }

    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1] || SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]))[0][0];
}

/**
 * Preserve the useful heuristics from the prototype while operating only on
 * the fair AI knowledge view.
 */
export function chooseSmartCard(knowledge) {
    const legal = [...knowledge.legalCards];
    if (legal.length === 0) throw new Error('Smart AI has no legal card to play');
    if (legal.length === 1) return legal[0].cardId;

    const isLeading = knowledge.currentTrick.length === 0;
    if (isLeading) return chooseLead(knowledge, legal);
    return chooseFollow(knowledge, legal);
}

function chooseLead(knowledge, legal) {
    const trump = knowledge.trump;
    const trumpSeen = knowledge.publicPlayedCards.filter(card => card.suit === trump).length;

    // Use an authoritative high trump early to draw opposing trump cards.
    const highTrumps = legal
        .filter(entry => entry.card.suit === trump && ['A', 'K', 'Q'].includes(entry.card.rank))
        .sort(byRankDescending);

    if (highTrumps.length > 0 && trumpSeen < 4) {
        return highTrumps[0].cardId;
    }

    // Otherwise pressure opponents with the strongest non-trump lead.
    const nonTrump = legal
        .filter(entry => entry.card.suit !== trump)
        .sort(byRankDescending);

    if (nonTrump.length > 0) return nonTrump[0].cardId;

    legal.sort(byRankDescending);
    return legal[0].cardId;
}

function chooseFollow(knowledge, legal) {
    const leadSuit = knowledge.currentTrick[0].card.suit;
    const current = resolveTrick(knowledge.currentTrick, knowledge.trump);
    const partnerWinning = teamOf(current.winner) === knowledge.teamId;
    const winningStrength = cardStrength(current.winningCard, leadSuit, knowledge.trump);

    if (partnerWinning) {
        // Preserve trump where possible while partner already controls the trick.
        const nonTrumpLow = legal
            .filter(entry => entry.card.suit !== knowledge.trump)
            .sort(byRankAscending);
        if (nonTrumpLow.length > 0) return nonTrumpLow[0].cardId;

        legal.sort(byRankAscending);
        return legal[0].cardId;
    }

    // Opponent is winning: spend only the lowest card that can take the trick.
    const winners = legal
        .filter(entry => cardStrength(entry.card, leadSuit, knowledge.trump) > winningStrength)
        .sort((a, b) =>
            cardStrength(a.card, leadSuit, knowledge.trump)
            - cardStrength(b.card, leadSuit, knowledge.trump));

    if (winners.length > 0) return winners[0].cardId;

    // Cannot win: discard a low non-trump before wasting trump.
    const nonTrumpLow = legal
        .filter(entry => entry.card.suit !== knowledge.trump)
        .sort(byRankAscending);
    if (nonTrumpLow.length > 0) return nonTrumpLow[0].cardId;

    legal.sort(byRankAscending);
    return legal[0].cardId;
}
