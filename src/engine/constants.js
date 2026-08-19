/**
 * Canonical constants for the standard Omi ruleset.
 *
 * Player indices intentionally preserve the prototype's existing UI mapping:
 *   0 = South (human), 1 = West, 2 = North, 3 = East.
 * Counter-clockwise play therefore moves 0 -> 3 -> 2 -> 1 -> 0.
 */
export const SUITS = Object.freeze(['Hearts', 'Diamonds', 'Clubs', 'Spades']);
export const RANKS = Object.freeze(['7', '8', '9', '10', 'J', 'Q', 'K', 'A']);

export const PLAYER = Object.freeze({
    SOUTH: 0,
    WEST: 1,
    NORTH: 2,
    EAST: 3,
});

export const PLAYER_NAMES = Object.freeze(['You', 'West', 'Partner', 'East']);

export const TEAM = Object.freeze({
    NS: 0,
    EW: 1,
});

export const PHASE = Object.freeze({
    IDLE: 'IDLE',
    DEAL_INITIAL: 'DEAL_INITIAL',
    TRUMP_SELECTION: 'TRUMP_SELECTION',
    DEAL_REMAINING: 'DEAL_REMAINING',
    PLAYING: 'PLAYING',
    HAND_SCORING: 'HAND_SCORING',
    HAND_COMPLETE: 'HAND_COMPLETE',
    MATCH_COMPLETE: 'MATCH_COMPLETE',
});

export const STANDARD_MATCH_TARGET = 10;
export const PLAYER_COUNT = 4;
export const INITIAL_BATCH_SIZE = 4;
export const FINAL_HAND_SIZE = 8;
export const TRICKS_PER_HAND = 8;
