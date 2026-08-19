const PREFERENCES_KEY = 'omi.menu.preferences.v1';
const TUTORIAL_COMPLETE_KEY = 'omiTutorialCompleted';

const DEFAULT_PREFERENCES = Object.freeze({
    difficulty: 'smart',
    sound: 'on',
});

function loadPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
        return {
            difficulty: saved.difficulty === 'casual' ? 'casual' : DEFAULT_PREFERENCES.difficulty,
            sound: saved.sound === 'off' ? 'off' : DEFAULT_PREFERENCES.sound,
        };
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
}

function savePreferences(preferences) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsButton = document.getElementById('settings-button');
const settingsMenuButton = document.getElementById('settings-menu-button');
const settingsClose = document.getElementById('settings-close');
const difficultySetting = document.getElementById('difficulty-setting');
const soundSetting = document.getElementById('sound-setting');
const playSoloLink = document.getElementById('play-solo-link');
const tutorialLink = document.getElementById('tutorial-link');

let preferences = loadPreferences();
let lastFocusedElement = null;

function updatePlayLink() {
    const params = new URLSearchParams({
        difficulty: preferences.difficulty,
        sound: preferences.sound,
    });
    playSoloLink.href = `game.html?${params.toString()}`;
}

function syncControls() {
    difficultySetting.value = preferences.difficulty;
    soundSetting.value = preferences.sound;
    updatePlayLink();

    const tutorialComplete = localStorage.getItem(TUTORIAL_COMPLETE_KEY) === 'true';
    tutorialLink.dataset.complete = String(tutorialComplete);
}

function openSettings() {
    lastFocusedElement = document.activeElement;
    settingsBackdrop.hidden = false;
    settingsClose.focus();
}

function closeSettings() {
    settingsBackdrop.hidden = true;
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
}

function commitPreferences() {
    preferences = {
        difficulty: difficultySetting.value === 'casual' ? 'casual' : 'smart',
        sound: soundSetting.value === 'off' ? 'off' : 'on',
    };
    savePreferences(preferences);
    updatePlayLink();
}

settingsButton.addEventListener('click', openSettings);
settingsMenuButton.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);

difficultySetting.addEventListener('change', commitPreferences);
soundSetting.addEventListener('change', commitPreferences);

settingsBackdrop.addEventListener('click', event => {
    if (event.target === settingsBackdrop) closeSettings();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !settingsBackdrop.hidden) closeSettings();
});

window.addEventListener('pageshow', syncControls);
syncControls();
