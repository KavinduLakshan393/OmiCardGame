import { loadSettings, saveSettings } from '../storage/settings.js';
import { loadGame } from '../storage/saveGame.js';
import { loadHistory } from '../storage/history.js';
import { activateFocusTrap, deactivateFocusTrap } from './focusTrap.js';
import { configureMotion } from './motion.js';

// Show player rating badge if any matches have been played
function syncRatingBadge() {
    const badge = document.getElementById('menu-rating-badge');
    const ratingValue = document.getElementById('menu-rating-value');
    if (!badge || !ratingValue) return;
    const history = loadHistory();
    if (history.totalMatches > 0) {
        ratingValue.textContent = history.rating;
        badge.hidden = false;
    }
}

const TUTORIAL_COMPLETE_KEY = 'omiTutorialCompleted';

const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsButton = document.getElementById('settings-button');
const settingsMenuButton = document.getElementById('settings-menu-button');
const settingsClose = document.getElementById('settings-close');
const settingsPanel = settingsBackdrop.querySelector('.settings-panel');
const difficultySetting = document.getElementById('difficulty-setting');
const soundSetting = document.getElementById('sound-setting');
const animationSpeedSetting = document.getElementById('animation-speed-setting');
const reducedMotionSetting = document.getElementById('reduced-motion-setting');
const playSoloLink = document.getElementById('play-solo-link');
const continueMatchLink = document.getElementById('continue-match-link');
const continueMatchCaption = document.getElementById('continue-match-caption');
const tutorialLink = document.getElementById('tutorial-link');

let preferences = loadSettings();
let lastFocusedElement = null;

function updatePlayLink() {
    // Settings are persistent now. The URL remains clean and shareable.
    playSoloLink.href = 'game.html';
}

function syncContinueMatch() {
    const saved = loadGame();
    continueMatchLink.hidden = !saved;
    if (saved) {
        const handNumber = saved.engineSession.state?.handNumber ?? 1;
        continueMatchCaption.textContent = `Resume hand ${handNumber}`;
    }
}

function syncControls() {
    preferences = loadSettings();
    configureMotion(preferences);
    difficultySetting.value = preferences.difficulty;
    soundSetting.value = preferences.sound ? 'on' : 'off';
    animationSpeedSetting.value = preferences.animationSpeed;
    reducedMotionSetting.value = preferences.reducedMotion;
    updatePlayLink();
    syncContinueMatch();

    const tutorialComplete = localStorage.getItem(TUTORIAL_COMPLETE_KEY) === 'true';
    tutorialLink.dataset.complete = String(tutorialComplete);
}

function openSettings() {
    lastFocusedElement = document.activeElement;
    settingsBackdrop.hidden = false;
    activateFocusTrap(settingsPanel, {
        initialFocus: settingsClose,
        onEscape: closeSettings,
    });
}

function closeSettings() {
    deactivateFocusTrap(settingsPanel, { restoreFocus: false });
    settingsBackdrop.hidden = true;
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus({ preventScroll: true });
}

function commitPreferences() {
    preferences = saveSettings({
        difficulty: difficultySetting.value,
        sound: soundSetting.value !== 'off',
        animationSpeed: animationSpeedSetting.value,
        reducedMotion: reducedMotionSetting.value,
    });
    configureMotion(preferences);
    updatePlayLink();
}

settingsButton.addEventListener('click', openSettings);
settingsMenuButton.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);

for (const control of [difficultySetting, soundSetting, animationSpeedSetting, reducedMotionSetting]) {
    control.addEventListener('change', commitPreferences);
}

settingsBackdrop.addEventListener('click', event => {
    if (event.target === settingsBackdrop) closeSettings();
});


window.addEventListener('pageshow', syncControls);
syncControls();
syncRatingBadge();
