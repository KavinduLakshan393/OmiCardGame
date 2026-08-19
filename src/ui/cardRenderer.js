import { isRed, suitSymbol } from '../engine/index.js';

const PIP_LAYOUTS = Object.freeze({
    '7': [[1,0],[1,1],[1,2],[1,3],[0,0],[2,0],[0,3]],
    '8': [[0,0],[2,0],[0,1],[2,1],[0,3],[2,3],[0,4],[2,4]],
    '9': [[0,0],[2,0],[0,1],[2,1],[1,2],[0,3],[2,3],[0,4],[2,4]],
    '10': [[0,0],[2,0],[0,1],[2,1],[1,1],[1,3],[0,3],[2,3],[0,4],[2,4]],
});

function appendCorner(cardElement, rank, symbol, position) {
    const corner = document.createElement('div');
    corner.className = `card-corner card-corner--${position}`;

    const rankEl = document.createElement('span');
    rankEl.className = 'card-rank';
    rankEl.textContent = rank;

    const suitEl = document.createElement('span');
    suitEl.className = 'card-corner-suit';
    suitEl.textContent = symbol;

    corner.append(rankEl, suitEl);
    cardElement.appendChild(corner);
}

function createPipGrid(rank, symbol) {
    const grid = document.createElement('div');
    grid.className = 'pip-grid';

    for (const [column, row] of PIP_LAYOUTS[rank] ?? []) {
        const pip = document.createElement('span');
        pip.className = `pip${row >= 3 ? ' upside' : ''}`;
        pip.textContent = symbol;
        pip.style.gridColumn = String(column + 1);
        pip.style.gridRow = String(row + 1);
        grid.appendChild(pip);
    }

    return grid;
}

function createCourtArt(rank, symbol) {
    const court = document.createElement('div');
    court.className = 'court-art';
    court.dataset.rank = rank;

    const suit = document.createElement('span');
    suit.className = 'court-suit';
    suit.textContent = symbol;
    court.appendChild(suit);
    return court;
}

/**
 * Creates the single production card component used by hands, the trick area,
 * trump preview, and animation clones. It does not know or enforce any rules.
 */
export function createCardElement(card, { faceDown = false } = {}) {
    const element = document.createElement('div');

    if (faceDown) {
        element.className = 'card face-down';
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    const symbol = suitSymbol(card.suit);
    element.className = `card ${isRed(card.suit) ? 'red' : 'black'}`;
    element.dataset.rank = card.rank;
    element.dataset.suit = card.suit;
    element.setAttribute('aria-label', `${card.rank} of ${card.suit}`);

    appendCorner(element, card.rank, symbol, 'tl');
    appendCorner(element, card.rank, symbol, 'br');

    const center = document.createElement('div');
    center.className = 'card-center-art';

    if (card.rank === 'A') {
        const ace = document.createElement('span');
        ace.className = 'card-ace-mark';
        ace.textContent = symbol;
        center.appendChild(ace);
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
        center.appendChild(createCourtArt(card.rank, symbol));
    } else {
        center.appendChild(createPipGrid(card.rank, symbol));
    }

    element.appendChild(center);
    return element;
}

export function createMiniCardElement(card) {
    const element = document.createElement('div');
    element.className = `mini-card ${isRed(card.suit) ? 'red' : 'black'}`;
    element.textContent = `${card.rank}${suitSymbol(card.suit)}`;
    element.setAttribute('aria-label', `${card.rank} of ${card.suit}`);
    return element;
}

export const CARD_PIP_LAYOUTS = PIP_LAYOUTS;
