/**
 * Persistent single-player preferences.
 *
 * Storage access is injected to keep this module testable outside a browser.
 * Invalid or legacy values are normalized rather than trusted directly.
 */
export const SETTINGS_KEY = 'omi.settings.v1';
export const LEGACY_MENU_SETTINGS_KEY = 'omi.menu.preferences.v1';

export const ANIMATION_SPEED = Object.freeze({
    RELAXED: 'relaxed',
    NORMAL: 'normal',
    FAST: 'fast',
});

export const REDUCED_MOTION = Object.freeze({
    SYSTEM: 'system',
    REDUCE: 'reduce',
    FULL: 'full',
});

export const DEFAULT_SETTINGS = Object.freeze({
    difficulty: 'smart',
    sound: true,
    animationSpeed: ANIMATION_SPEED.NORMAL,
    reducedMotion: REDUCED_MOTION.SYSTEM,
});

function safeStorage(storage) {
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
        ? storage
        : null;
}

export function normalizeSettings(candidate = {}) {
    return {
        difficulty: candidate.difficulty === 'casual' ? 'casual' : 'smart',
        sound: candidate.sound === false || candidate.sound === 'off' ? false : true,
        animationSpeed: Object.values(ANIMATION_SPEED).includes(candidate.animationSpeed)
            ? candidate.animationSpeed
            : ANIMATION_SPEED.NORMAL,
        reducedMotion: Object.values(REDUCED_MOTION).includes(candidate.reducedMotion)
            ? candidate.reducedMotion
            : REDUCED_MOTION.SYSTEM,
    };
}

function loadLegacy(storage) {
    try {
        const raw = storage.getItem(LEGACY_MENU_SETTINGS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeSettings({
            difficulty: parsed.difficulty,
            sound: parsed.sound,
        });
    } catch {
        return null;
    }
}

export function loadSettings(storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return { ...DEFAULT_SETTINGS };

    try {
        const raw = store.getItem(SETTINGS_KEY);
        if (raw) return normalizeSettings(JSON.parse(raw));
    } catch {
        // Fall through to migration/defaults.
    }

    const legacy = loadLegacy(store);
    if (legacy) {
        saveSettings(legacy, store);
        return legacy;
    }

    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings, storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    const normalized = normalizeSettings(settings);
    if (store) {
        store.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    }
    return normalized;
}

export function updateSettings(patch, storage = globalThis.localStorage) {
    const current = loadSettings(storage);
    return saveSettings({ ...current, ...patch }, storage);
}
