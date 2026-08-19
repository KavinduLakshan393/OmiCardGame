import { createCardElement } from './cardRenderer.js';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : ms));

function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function markDealtCards(container, count, playerId) {
    if (!container || count <= 0) return;
    const wrappers = [...container.querySelectorAll('.card-wrapper')].slice(-count);
    const vectors = {
        0: ['0px', '-150px', '-4deg'],
        1: ['150px', '0px', '8deg'],
        2: ['0px', '150px', '4deg'],
        3: ['-150px', '0px', '-8deg'],
    };
    const [x, y, rotate] = vectors[playerId] ?? ['0px', '-100px', '-5deg'];

    wrappers.forEach((wrapper, index) => {
        wrapper.classList.remove('deal-in');
        wrapper.style.setProperty('--deal-index', index);
        wrapper.style.setProperty('--deal-x', x);
        wrapper.style.setProperty('--deal-y', y);
        wrapper.style.setProperty('--deal-rotate', rotate);
        void wrapper.offsetWidth;
        wrapper.classList.add('deal-in');
    });
}

export async function animateCardPlay({ card, playerId, targetElement, sourceRect = null }) {
    if (!card || !targetElement || reducedMotion()) return;

    const targetRect = targetElement.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;

    const sourceElement = document.getElementById(`player-${playerId}`);
    const fallbackRect = sourceElement?.getBoundingClientRect();
    const startRect = sourceRect ?? fallbackRect;
    if (!startRect) return;

    const sourceCenter = centerOf(startRect);
    const targetCenter = centerOf(targetRect);
    const flying = createCardElement(card);
    flying.classList.add('play-flight');
    flying.style.left = `${sourceCenter.x - targetRect.width / 2}px`;
    flying.style.top = `${sourceCenter.y - targetRect.height / 2}px`;
    flying.style.width = `${targetRect.width}px`;
    flying.style.height = `${targetRect.height}px`;
    document.body.appendChild(flying);

    const realCard = targetElement.querySelector('.card');
    if (realCard) realCard.style.opacity = '0';

    await new Promise(resolve => {
        const animation = flying.animate([
            { transform: 'translate3d(0,0,0) rotate(-6deg) scale(.88)', opacity: .82 },
            {
                transform: `translate3d(${targetCenter.x - sourceCenter.x}px, ${targetCenter.y - sourceCenter.y}px, 0) rotate(0deg) scale(1)`,
                opacity: 1,
            },
        ], {
            duration: 360,
            easing: 'cubic-bezier(.19,1,.22,1)',
            fill: 'forwards',
        });
        animation.addEventListener('finish', resolve, { once: true });
        animation.addEventListener('cancel', resolve, { once: true });
    });

    flying.remove();
    if (realCard) realCard.style.opacity = '';
}

export async function pulseWinningCard(slot) {
    if (!slot) return;
    const card = slot.querySelector('.card');
    if (!card || reducedMotion()) return;
    card.classList.add('trick-winner-pulse');
    await sleep(650);
    card.classList.remove('trick-winner-pulse');
}

export async function animateTrickCollection({ winnerId, slotElements }) {
    if (reducedMotion()) return;
    const winner = document.getElementById(`player-${winnerId}`);
    if (!winner) return;
    const destination = centerOf(winner.getBoundingClientRect());
    const clones = [];

    for (const slot of slotElements) {
        const card = slot?.querySelector('.card');
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        const clone = card.cloneNode(true);
        clone.classList.add('collect-clone');
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        document.body.appendChild(clone);
        card.style.opacity = '0';
        clones.push({ clone, source: card, rect });
    }

    if (!clones.length) return;
    await sleep(25);

    clones.forEach(({ clone, rect }, index) => {
        clone.style.left = `${destination.x - rect.width / 2}px`;
        clone.style.top = `${destination.y - rect.height / 2}px`;
        clone.style.transform = `scale(.62) rotate(${(index - 1.5) * 5}deg)`;
        clone.style.opacity = '.18';
    });

    await sleep(440);
    clones.forEach(({ clone, source }) => {
        clone.remove();
        source.style.opacity = '';
    });
}
