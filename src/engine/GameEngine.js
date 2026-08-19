import {
    INITIAL_BATCH_SIZE,
    PHASE,
    PLAYER,
    PLAYER_COUNT,
    STANDARD_MATCH_TARGET,
} from './constants.js';
import { cardId } from './cards.js';
import { Deck } from './deck.js';
import { dealOrderFromDealer, nextCounterClockwise, playerToDealerRight, teamOf } from './players.js';
import { assertTrumpSuit, getLegalCardIndices, isLegalPlay } from './rules.js';
import { scoreHand } from './scoring.js';
import { resolveTrick } from './trick.js';
import { createInitialState } from './state.js';

export class OmiRuleError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'OmiRuleError';
        this.code = code;
    }
}

/**
 * Pure Omi rules/state engine for the standard 32-card game.
 *
 * This class deliberately contains no DOM access, audio calls, animation
 * timers, or browser-specific presentation logic. The legacy UI coordinates
 * animation timing around these synchronous state transitions.
 */
export class GameEngine {
    constructor({
        dealerIndex = PLAYER.WEST,
        matchTokenTarget = STANDARD_MATCH_TARGET,
        rng = Math.random,
    } = {}) {
        this.initialDealerIndex = dealerIndex;
        this.rng = rng;
        this.state = createInitialState({ dealerIndex, matchTokenTarget });
        this._deck = null;
        this._dealOrder = [];
        this._dealCursor = 0;
    }

    resetMatch({ dealerIndex = this.initialDealerIndex } = {}) {
        const target = this.state.matchTokenTarget;
        const fresh = createInitialState({ dealerIndex, matchTokenTarget: target });
        Object.keys(this.state).forEach(key => delete this.state[key]);
        Object.assign(this.state, fresh);
        this._deck = null;
        this._dealOrder = [];
        this._dealCursor = 0;
        return this.state;
    }

    startHand() {
        if (this.state.matchOver) {
            throw new OmiRuleError('MATCH_OVER', 'Cannot start a hand after the match has ended');
        }
        if (![PHASE.IDLE, PHASE.HAND_COMPLETE].includes(this.state.phase)) {
            throw new OmiRuleError('INVALID_PHASE', `Cannot start a hand during ${this.state.phase}`);
        }

        this.state.hands = [[], [], [], []];
        this.state.teamTricks = [0, 0];
        this.state.trump = null;
        this.state.trumpCaller = playerToDealerRight(this.state.dealerIndex);
        this.state.currentTrick = [];
        this.state.turnIndex = this.state.trumpCaller;
        this.state.playedCards = [];
        this.state.trickHistory = [];
        this.state.handNumber += 1;
        this.state.phase = PHASE.DEAL_INITIAL;

        this._deck = new Deck({ rng: this.rng });
        this._dealOrder = dealOrderFromDealer(this.state.dealerIndex);
        this._dealCursor = 0;

        return {
            dealerIndex: this.state.dealerIndex,
            trumpCaller: this.state.trumpCaller,
            dealOrder: [...this._dealOrder],
        };
    }

    /**
     * Deal the next batch of four cards during either deal phase.
     * The caller controls *when* this method runs; therefore animation timing
     * stays outside the engine.
     */
    dealNextBatch() {
        if (![PHASE.DEAL_INITIAL, PHASE.DEAL_REMAINING].includes(this.state.phase)) {
            throw new OmiRuleError('INVALID_PHASE', `Cannot deal during ${this.state.phase}`);
        }
        if (!this._deck) {
            throw new OmiRuleError('NO_DECK', 'No active deck is available');
        }
        if (this._dealCursor >= PLAYER_COUNT) {
            throw new OmiRuleError('DEAL_COMPLETE', 'All players have already received this batch');
        }

        const playerIndex = this._dealOrder[this._dealCursor];
        const cards = this._deck.deal(INITIAL_BATCH_SIZE);
        this.state.hands[playerIndex].push(...cards);
        this._dealCursor += 1;

        const phaseComplete = this._dealCursor === PLAYER_COUNT;
        if (phaseComplete) {
            if (this.state.phase === PHASE.DEAL_INITIAL) {
                this.state.phase = PHASE.TRUMP_SELECTION;
            } else {
                this.state.phase = PHASE.PLAYING;
                this.state.turnIndex = this.state.trumpCaller;
            }
        }

        return {
            playerIndex,
            cards: [...cards],
            phaseComplete,
            remainingCards: this._deck.remaining,
        };
    }

    selectTrump(suit) {
        if (this.state.phase !== PHASE.TRUMP_SELECTION) {
            throw new OmiRuleError('INVALID_PHASE', `Trump cannot be selected during ${this.state.phase}`);
        }
        assertTrumpSuit(suit);

        this.state.trump = suit;
        this.state.phase = PHASE.DEAL_REMAINING;
        this._dealCursor = 0;

        return {
            trump: suit,
            trumpCaller: this.state.trumpCaller,
        };
    }

    getLegalCardIndices(playerIndex) {
        return getLegalCardIndices(this.state.hands[playerIndex], this.state.currentTrick);
    }

    isLegalPlay(playerIndex, cardIndex) {
        return isLegalPlay(this.state.hands[playerIndex], this.state.currentTrick, cardIndex);
    }

    playCard(playerIndex, cardIndex) {
        if (this.state.phase !== PHASE.PLAYING) {
            throw new OmiRuleError('INVALID_PHASE', `Cards cannot be played during ${this.state.phase}`);
        }
        if (playerIndex !== this.state.turnIndex) {
            throw new OmiRuleError('WRONG_TURN', `It is not player ${playerIndex}'s turn`);
        }

        const hand = this.state.hands[playerIndex];
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) {
            throw new OmiRuleError('INVALID_CARD', `Invalid card index: ${cardIndex}`);
        }
        if (!isLegalPlay(hand, this.state.currentTrick, cardIndex)) {
            throw new OmiRuleError('MUST_FOLLOW_SUIT', 'Player must follow the lead suit when able');
        }

        const [card] = hand.splice(cardIndex, 1);
        this.state.currentTrick.push({ player: playerIndex, card });
        this.state.playedCards.push(cardId(card));

        const trickComplete = this.state.currentTrick.length === PLAYER_COUNT;
        if (!trickComplete) {
            this.state.turnIndex = nextCounterClockwise(playerIndex);
        }

        return {
            playerIndex,
            card,
            trickComplete,
            nextPlayer: trickComplete ? null : this.state.turnIndex,
        };
    }

    peekCurrentTrickResult() {
        if (this.state.currentTrick.length !== PLAYER_COUNT) {
            throw new OmiRuleError('TRICK_INCOMPLETE', 'A trick must contain four cards before it can be resolved');
        }
        return resolveTrick(this.state.currentTrick, this.state.trump);
    }

    completeTrick() {
        const result = this.peekCurrentTrickResult();
        const team = teamOf(result.winner);
        this.state.teamTricks[team] += 1;

        const trickNum = this.state.trickHistory.length + 1;
        this.state.trickHistory.push({
            trickNum,
            plays: this.state.currentTrick.map(play => ({ player: play.player, card: play.card })),
            winner: result.winner,
        });

        this.state.currentTrick = [];
        this.state.turnIndex = result.winner;

        const handComplete = this.state.hands.every(hand => hand.length === 0);
        if (handComplete) {
            this.state.phase = PHASE.HAND_SCORING;
        }

        return {
            ...result,
            trickNum,
            team,
            handComplete,
        };
    }

    scoreCurrentHand() {
        if (this.state.phase !== PHASE.HAND_SCORING) {
            throw new OmiRuleError('INVALID_PHASE', `Hand cannot be scored during ${this.state.phase}`);
        }

        const callerTeam = teamOf(this.state.trumpCaller);
        const result = scoreHand({
            teamTricks: this.state.teamTricks,
            callerTeam,
            carryTokens: this.state.carryTokens,
        });

        this.state.carryTokens = result.nextCarryTokens;
        if (!result.tied) {
            this.state.tokens[result.winnerTeam] += result.tokensAwarded;
        }

        this.state.matchOver = this.state.tokens.some(tokens => tokens >= this.state.matchTokenTarget);
        this.state.dealerIndex = nextCounterClockwise(this.state.dealerIndex);
        this.state.phase = this.state.matchOver ? PHASE.MATCH_COMPLETE : PHASE.HAND_COMPLETE;

        return {
            ...result,
            callerTeam,
            tokens: [...this.state.tokens],
            matchOver: this.state.matchOver,
            nextDealerIndex: this.state.dealerIndex,
        };
    }

    get remainingDeckCards() {
        return this._deck?.remaining ?? 0;
    }
}
