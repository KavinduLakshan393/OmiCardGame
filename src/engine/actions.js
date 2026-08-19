/**
 * Commands accepted by the Omi game engine.
 *
 * Keeping command names in one module prevents UI/controller code from
 * depending on string literals and gives the future multiplayer server a
 * stable protocol surface.
 */
export const ACTION = Object.freeze({
    START_MATCH: 'START_MATCH',
    START_NEXT_HAND: 'START_NEXT_HAND',
    DEAL_NEXT_BATCH: 'DEAL_NEXT_BATCH',
    SELECT_TRUMP: 'SELECT_TRUMP',
    PLAY_CARD: 'PLAY_CARD',
    COMPLETE_TRICK: 'COMPLETE_TRICK',
    SCORE_HAND: 'SCORE_HAND',
    RESET_MATCH: 'RESET_MATCH',
});

export function assertAction(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
        throw new TypeError('action must be an object');
    }
    if (!Object.values(ACTION).includes(action.type)) {
        throw new RangeError(`Unknown action type: ${String(action.type)}`);
    }
}
