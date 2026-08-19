/**
 * Domain events emitted after successful engine transitions.
 *
 * Events describe what happened; they do not contain DOM nodes, timers,
 * audio objects, or presentation callbacks. This keeps them serializable and
 * suitable for logging, tests, save-state diagnostics, and later networking.
 */
export const EVENT = Object.freeze({
    MATCH_STARTED: 'MATCH_STARTED',
    MATCH_RESET: 'MATCH_RESET',
    HAND_STARTED: 'HAND_STARTED',
    CARDS_DEALT: 'CARDS_DEALT',
    INITIAL_CARDS_DEALT: 'INITIAL_CARDS_DEALT',
    TRUMP_REQUIRED: 'TRUMP_REQUIRED',
    TRUMP_SELECTED: 'TRUMP_SELECTED',
    DEAL_COMPLETED: 'DEAL_COMPLETED',
    CARD_PLAYED: 'CARD_PLAYED',
    TRICK_READY: 'TRICK_READY',
    TRICK_COMPLETED: 'TRICK_COMPLETED',
    HAND_TIED: 'HAND_TIED',
    TOKENS_AWARDED: 'TOKENS_AWARDED',
    HAND_COMPLETED: 'HAND_COMPLETED',
    MATCH_COMPLETED: 'MATCH_COMPLETED',
});

export function createEvent(type, payload = {}) {
    if (!Object.values(EVENT).includes(type)) {
        throw new RangeError(`Unknown event type: ${String(type)}`);
    }
    return Object.freeze({ type, ...payload });
}
