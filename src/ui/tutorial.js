import { loadSettings } from '../storage/settings.js';
import { configureMotion } from './motion.js';
import { TUTORIAL_STEPS } from './tutorialData.js';

configureMotion(loadSettings());

const TUTORIAL_COMPLETE_KEY = 'omiTutorialCompleted';

const progress = document.getElementById('tutorial-progress');
const kicker = document.getElementById('tutorial-kicker');
const title = document.getElementById('tutorial-title');
const body = document.getElementById('tutorial-body');
const rules = document.getElementById('tutorial-rules');
const visualStage = document.getElementById('visual-stage');
const visualCaption = document.getElementById('visual-caption');
const dots = document.getElementById('tutorial-dots');
const backButton = document.getElementById('tutorial-back');
const nextButton = document.getElementById('tutorial-next');
const copyPanel = document.getElementById('tutorial-copy');
const visualPanel = document.getElementById('tutorial-visual');

let currentIndex = 0;

const miniCard = (label, { red = false, state = '' } = {}) =>
    `<div class="mini-card-ui${red ? ' red' : ''}${state ? ` ${state}` : ''}">${label}</div>`;

function renderVisual(type) {
    switch (type) {
        case 'teams':
            return `
                <div class="seat-map">
                    <div class="team-axis vertical"></div>
                    <div class="team-axis horizontal"></div>
                    <div class="seat n">Partner</div>
                    <div class="seat s">You</div>
                    <div class="seat w">West</div>
                    <div class="seat e">East</div>
                </div>`;
        case 'deck':
            return `
                <div class="tutorial-card-fan">
                    <div class="tutorial-card-face">A♠</div>
                    <div class="tutorial-card-face red">K♥</div>
                    <div class="tutorial-card-face">Q♣</div>
                    <div class="tutorial-card-face red">J♦</div>
                </div>`;
        case 'ranking':
            return `<div class="rank-ladder">${['7','8','9','10','J','Q','K','A'].map(rank => `<div class="rank-tile">${rank}</div>`).join('')}</div>`;
        case 'trump':
            return `
                <div class="trump-demo">
                    <div class="four-cards">
                        ${miniCard('A♥', { red: true })}${miniCard('K♥', { red: true })}${miniCard('9♣')}${miniCard('7♠')}
                    </div>
                    <div class="suit-options" aria-label="Example trump selection">
                        <div class="suit-option">♠</div>
                        <div class="suit-option selected">♥</div>
                        <div class="suit-option">♦</div>
                        <div class="suit-option">♣</div>
                    </div>
                </div>`;
        case 'leading':
            return `
                <div class="lead-demo">
                    ${miniCard('Q♣')}
                    <div class="lead-caption">Lead suit · Clubs</div>
                </div>`;
        case 'follow':
            return `
                <div class="follow-demo">
                    <div class="lead-caption">Clubs were led</div>
                    <div class="legal-hand">
                        ${miniCard('A♠', { state: 'invalid' })}
                        ${miniCard('10♣', { state: 'valid' })}
                        ${miniCard('8♥', { red: true, state: 'invalid' })}
                        ${miniCard('7♣', { state: 'valid' })}
                    </div>
                </div>`;
        case 'trump-power':
            return `
                <div class="trick-map">
                    <div class="trick-card-ui n">A♣</div>
                    <div class="trick-card-ui w">K♣</div>
                    <div class="trick-card-ui e red winner">7♥</div>
                    <div class="trick-card-ui s">Q♣</div>
                </div>`;
        case 'resolve':
            return `
                <div class="trick-map">
                    <div class="trick-card-ui n">9♠</div>
                    <div class="trick-card-ui w winner">A♠</div>
                    <div class="trick-card-ui e red">K♦</div>
                    <div class="trick-card-ui s">Q♠</div>
                </div>`;
        case 'scoring':
            return `
                <div class="scoring-board">
                    <div class="scoring-row"><div class="scoring-name">Trump team<span class="scoring-sub">5–7 tricks</span></div><div class="scoring-value">+1</div></div>
                    <div class="scoring-row"><div class="scoring-name">Defenders<span class="scoring-sub">5–7 tricks</span></div><div class="scoring-value">+2</div></div>
                    <div class="scoring-row"><div class="scoring-name">Kapothi<span class="scoring-sub">8 tricks</span></div><div class="scoring-value">+3</div></div>
                </div>`;
        case 'target':
            return `
                <div class="target-demo">
                    <div class="target-number">10</div>
                    <div class="target-label">Tokens to win</div>
                </div>`;
        case 'ready':
            return `
                <div class="ready-demo">
                    <div class="ready-ring">✓</div>
                    <div class="target-label">Ready to play</div>
                </div>`;
        default:
            return '';
    }
}

function restartEntryAnimation() {
    for (const element of [copyPanel, visualPanel]) {
        element.style.animation = 'none';
        // Force layout so the animation can replay when the tutorial step changes.
        void element.offsetWidth;
        element.style.animation = '';
    }
}

function renderStep() {
    const step = TUTORIAL_STEPS[currentIndex];
    progress.textContent = `Step ${currentIndex + 1} of ${TUTORIAL_STEPS.length}`;
    kicker.textContent = step.kicker;
    title.textContent = step.title;
    body.textContent = step.body;
    rules.replaceChildren(...step.bullets.map(item => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
    }));

    visualStage.innerHTML = renderVisual(step.visual);
    visualCaption.textContent = step.caption;

    dots.innerHTML = TUTORIAL_STEPS.map((_, index) => {
        const classes = ['tutorial-dot'];
        if (index < currentIndex) classes.push('done');
        if (index === currentIndex) classes.push('active');
        return `<span class="${classes.join(' ')}"></span>`;
    }).join('');

    backButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next';
    restartEntryAnimation();
}

function move(direction) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= TUTORIAL_STEPS.length) return;
    currentIndex = nextIndex;
    renderStep();
}

backButton.addEventListener('click', () => move(-1));
nextButton.addEventListener('click', () => {
    if (currentIndex < TUTORIAL_STEPS.length - 1) {
        move(1);
        return;
    }

    localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true');
    window.location.assign('main-menu.html');
});

document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex === TUTORIAL_STEPS.length - 1) nextButton.click();
        else move(1);
    } else if (event.key === 'Escape') {
        window.location.assign('main-menu.html');
    }
});

renderStep();
