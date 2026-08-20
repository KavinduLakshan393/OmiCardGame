/**
 * Match History and Player Rating Storage
 *
 * Persists completed match results and maintains an Omi-specific rating.
 * Rating starts at 1000. Wins earn ~+25, losses cost ~-20, scaled by speed
 * and Kapothis. History is capped at the last MAX_HISTORY_ENTRIES matches.
 *
 * Storage key: 'omi.history.v1'
 */

export const HISTORY_KEY = 'omi.history.v1';
export const HISTORY_SCHEMA_VERSION = 1;
export const STARTING_RATING = 1000;
const MAX_HISTORY_ENTRIES = 50;

function safeStorage(storage) {
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
        ? storage
        : null;
}

/**
 * Computes the rating delta for a completed match.
 * @param {{ outcome: 'win'|'loss', handsPlayed: number, kapothisFor: number, kapothisAgainst: number }} result
 * @returns {number} integer rating delta (positive or negative)
 */
export function computeRatingDelta({ outcome, handsPlayed, kapothisFor, kapothisAgainst }) {
    const isWin = outcome === 'win';

    // Base points — wins earn more than losses cost (encourage engagement)
    let delta = isWin ? 25 : -20;

    // Speed bonus/penalty — fewer hands = more decisive = bigger delta
    // A match can go 1–∞ hands (realistically 1–15). Normalise around 5.
    const speedFactor = Math.max(0.6, Math.min(1.4, 5 / Math.max(1, handsPlayed)));
    delta = Math.round(delta * speedFactor);

    // Kapothi bonuses/penalties (±5 each)
    delta += kapothisFor * 5;
    delta -= kapothisAgainst * 5;

    // Keep delta in a sane range
    return Math.max(-60, Math.min(60, delta));
}

/**
 * Returns a blank history record.
 */
export function emptyHistory() {
    return {
        schemaVersion: HISTORY_SCHEMA_VERSION,
        rating: STARTING_RATING,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        kapothisFor: 0,
        kapothisAgainst: 0,
        history: [],
    };
}

/**
 * Loads history from localStorage. Returns emptyHistory() if nothing is stored
 * or the saved data is invalid.
 * @param {Storage} [storage]
 * @returns {object}
 */
export function loadHistory(storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return emptyHistory();

    try {
        const raw = store.getItem(HISTORY_KEY);
        if (!raw) return emptyHistory();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.schemaVersion !== HISTORY_SCHEMA_VERSION) return emptyHistory();
        return {
            schemaVersion: HISTORY_SCHEMA_VERSION,
            rating: Number.isFinite(parsed.rating) ? parsed.rating : STARTING_RATING,
            totalMatches: Number.isInteger(parsed.totalMatches) ? parsed.totalMatches : 0,
            wins: Number.isInteger(parsed.wins) ? parsed.wins : 0,
            losses: Number.isInteger(parsed.losses) ? parsed.losses : 0,
            kapothisFor: Number.isInteger(parsed.kapothisFor) ? parsed.kapothisFor : 0,
            kapothisAgainst: Number.isInteger(parsed.kapothisAgainst) ? parsed.kapothisAgainst : 0,
            history: Array.isArray(parsed.history) ? parsed.history : [],
        };
    } catch {
        return emptyHistory();
    }
}

/**
 * Saves an updated history record back to localStorage.
 * @param {object} data
 * @param {Storage} [storage]
 */
function persistHistory(data, storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return;
    store.setItem(HISTORY_KEY, JSON.stringify(data));
}

/**
 * Records a completed match result, updates the rating, and persists everything.
 *
 * @param {{
 *   outcome: 'win'|'loss',
 *   finalScore: [number, number],
 *   handsPlayed: number,
 *   kapothisFor: number,
 *   kapothisAgainst: number,
 *   durationMs: number,
 * }} matchResult
 * @param {Storage} [storage]
 * @returns {{ ratingBefore: number, ratingAfter: number, ratingDelta: number }}
 */
export function saveMatchResult(matchResult, storage = globalThis.localStorage) {
    const data = loadHistory(storage);

    const ratingBefore = data.rating;
    const ratingDelta = computeRatingDelta(matchResult);
    const ratingAfter = Math.max(0, ratingBefore + ratingDelta);

    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playedAt: Date.now(),
        outcome: matchResult.outcome,
        finalScore: matchResult.finalScore,
        handsPlayed: matchResult.handsPlayed,
        kapothisFor: matchResult.kapothisFor,
        kapothisAgainst: matchResult.kapothisAgainst,
        durationMs: matchResult.durationMs,
        ratingBefore,
        ratingAfter,
        ratingDelta,
    };

    data.rating = ratingAfter;
    data.totalMatches += 1;
    if (matchResult.outcome === 'win') data.wins += 1;
    else data.losses += 1;
    data.kapothisFor += matchResult.kapothisFor;
    data.kapothisAgainst += matchResult.kapothisAgainst;

    // Prepend and cap history
    data.history = [entry, ...data.history].slice(0, MAX_HISTORY_ENTRIES);

    persistHistory(data, storage);
    return { ratingBefore, ratingAfter, ratingDelta };
}

/**
 * Permanently clears all match history and resets rating.
 * @param {Storage} [storage]
 */
export function clearHistory(storage = globalThis.localStorage) {
    const store = safeStorage(storage);
    if (!store) return;
    store.removeItem(HISTORY_KEY);
}
