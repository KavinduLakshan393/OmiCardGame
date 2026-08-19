import { rankValue } from './cards.js';
import { assertTrumpSuit, leadSuitOf } from './rules.js';

/**
 * Convert a card into a comparable strength for one trick.
 * Off-suit, non-trump cards cannot win and therefore receive -1.
 */
export function cardStrength(card, leadSuit, trumpSuit) {
    if (!card) return -1;
    assertTrumpSuit(trumpSuit);

    if (card.suit === trumpSuit) return 100 + rankValue(card.rank);
    if (card.suit === leadSuit) return rankValue(card.rank);
    return -1;
}

/** Resolve a non-empty trick without mutating it. */
export function resolveTrick(currentTrick, trumpSuit) {
    if (!Array.isArray(currentTrick) || currentTrick.length === 0) {
        throw new Error('Cannot resolve an empty trick');
    }
    assertTrumpSuit(trumpSuit);

    const leadSuit = leadSuitOf(currentTrick);
    let winningPlay = currentTrick[0];
    let bestStrength = cardStrength(winningPlay.card, leadSuit, trumpSuit);

    for (let i = 1; i < currentTrick.length; i += 1) {
        const play = currentTrick[i];
        const strength = cardStrength(play.card, leadSuit, trumpSuit);
        if (strength > bestStrength) {
            winningPlay = play;
            bestStrength = strength;
        }
    }

    return {
        winner: winningPlay.player,
        winningCard: winningPlay.card,
        leadSuit,
        strength: bestStrength,
    };
}
