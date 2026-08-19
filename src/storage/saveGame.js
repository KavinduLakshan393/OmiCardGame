import { PHASE } from '../engine/constants.js';

export const SAVE_GAME_KEY = 'omi.single-player.save.v1';
export const SAVE_SCHEMA_VERSION = 1;

function safeStorage(storage) {
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
        ? storage
        : null;
}

export function normalizeStats(stats = {}) {
    const array4 = value => Array.isArray(value) && value.length === 4
        ? value.map(n => Number.isInteger(n) && n >= 0 ? n : 0)
        : [0, 0, 0, 0];
    const array2 = value => Array.isArray(value) && value.length === 2
        ? value.map(n => Number.isInteger(n) && n >= 0 ? n : 0)
        : [0, 0];

    return {
        tricksWonByPlayer: array4(stats.tricksWonByPlayer),
        roundsWon: array2(stats.roundsWon),
        kaputhis: array2(stats.kaputhis),
        defends: array2(stats.defends),
        trumpsCalled: array4(stats.trumpsCalled),
        startedAt: Number.isFinite(stats.startedAt) ? stats.startedAt : Date.now(),
    };
}

export function createSaveRecord({ engineSession, stats, savedAt = Date.now() }) {
    if (!engineSession || typeof engineSession !== 'object') {
        throw new TypeError('engineSession is required');
    }
    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        savedAt,
        engineSession,
        stats: normalizeStats(stats),
    };
}

export function saveGame(record, storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return false;
    store.setItem(SAVE_GAME_KEY, JSON.stringify(record));
    return true;
}

export function loadGame(storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return null;

    try {
        const raw = store.getItem(SAVE_GAME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new TypeError('Unsupported save schema');
        if (!Number.isFinite(parsed.savedAt)) throw new TypeError('Invalid saved timestamp');
        if (!parsed.engineSession || typeof parsed.engineSession !== 'object') throw new TypeError('Missing engine session');
        const phase = parsed.engineSession.state?.phase;
        if (!Object.values(PHASE).includes(phase) || phase === PHASE.IDLE || phase === PHASE.MATCH_COMPLETE) {
            throw new TypeError('Save does not contain an active match');
        }
        return {
            schemaVersion: parsed.schemaVersion,
            savedAt: parsed.savedAt,
            engineSession: parsed.engineSession,
            stats: normalizeStats(parsed.stats),
        };
    } catch {
        clearSavedGame(store);
        return null;
    }
}

export function hasSavedGame(storage = globalThis.localStorage) {
    return loadGame(storage) !== null;
}

export function clearSavedGame(storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store || typeof store.removeItem !== 'function') return false;
    store.removeItem(SAVE_GAME_KEY);
    return true;
}
