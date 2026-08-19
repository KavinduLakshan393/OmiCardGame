import { PHASE, PLAYER, STANDARD_MATCH_TARGET } from './constants.js';

export function createInitialState({
    dealerIndex = PLAYER.WEST,
    matchTokenTarget = STANDARD_MATCH_TARGET,
} = {}) {
    return {
        hands: [[], [], [], []],
        teamTricks: [0, 0],
        trump: null,
        trumpCaller: null,
        currentTrick: [],
        turnIndex: null,
        dealerIndex,
        playedCards: [],
        trickHistory: [],

        tokens: [0, 0],
        carryTokens: 0,
        matchTokenTarget,
        matchOver: false,
        handNumber: 0,
        phase: PHASE.IDLE,
    };
}
