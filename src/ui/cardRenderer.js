import { isRed, suitSymbol } from '../engine/index.js';

/**
 * Creates the single production card component used by hands, the trick area,
 * trump preview, and animation clones. It relies on image assets for faces.
 */
export function createCardElement(card, { faceDown = false } = {}) {
    const element = document.createElement('div');

    if (faceDown) {
        element.className = 'card face-down';
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    element.className = `card ${isRed(card.suit) ? 'red' : 'black'}`;
    element.dataset.rank = card.rank;
    element.dataset.suit = card.suit;
    element.setAttribute('aria-label', `${card.rank} of ${card.suit}`);

    // Map suit and rank to filename (e.g., 'Spades' and 'K' -> 'SK.png')
    const suitInitial = card.suit.charAt(0).toUpperCase();
    const imageName = `${suitInitial}${card.rank}.png`;
    element.style.backgroundImage = `url('assets/cards/${imageName}')`;

    return element;
}

export function createMiniCardElement(card) {
    const element = document.createElement('div');
    element.className = `mini-card ${isRed(card.suit) ? 'red' : 'black'}`;
    element.textContent = `${card.rank}${suitSymbol(card.suit)}`;
    element.setAttribute('aria-label', `${card.rank} of ${card.suit}`);
    return element;
}
