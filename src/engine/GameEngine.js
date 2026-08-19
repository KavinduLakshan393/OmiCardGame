import {
    INITIAL_BATCH_SIZE,
    PHASE,
    PLAYER,
    PLAYER_COUNT,
    STANDARD_MATCH_TARGET,
} from './constants.js';
import { ACTION, assertAction } from './actions.js';
import { cardId } from './cards.js';
import { Deck } from './deck.js';
import { EVENT, createEvent } from './events.js';
import { dealOrderFromDealer, nextCounterClockwise, playerToDealerRight, teamOf } from './players.js';
import { assertTrumpSuit, getLegalCardIndices, isLegalPlay } from './rules.js';
import { scoreHand } from './scoring.js';
import { cloneState } from './snapshot.js';
import { ENGINE_SESSION_VERSION, hydrateCard, hydrateState, validateActiveCards } from './session.js';
import { createInitialState } from './state.js';
import { resolveTrick } from './trick.js';

export class OmiRuleError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'OmiRuleError';
        this.code = code;
    }
}

/**
 * Pure authoritative rules/state engine for standard Omi.
 *
 * The engine is synchronous and deliberately contains no DOM access, audio,
 * animation delays, or AI decisions. Consumers send explicit actions through
 * dispatch() and receive serializable domain events describing the result.
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

    /** Return a detached, JSON-safe copy of authoritative state. */
    getSnapshot() {
        return cloneState(this.state);
    }

    /**
     * Export every rule-owned value required to resume this exact match.
     * Presentation state (DOM, audio, timers, UI statistics) is intentionally
     * excluded and is persisted by the application layer separately.
     */
    exportSession() {
        return {
            version: ENGINE_SESSION_VERSION,
            initialDealerIndex: this.initialDealerIndex,
            state: this.getSnapshot(),
            deckCards: this._deck ? this._deck.cards.map(card => ({ suit: card.suit, rank: card.rank })) : [],
            dealOrder: [...this._dealOrder],
            dealCursor: this._dealCursor,
        };
    }

    /** Restore a previously exported engine session after strict validation. */
    restoreSession(session) {
        if (!session || typeof session !== 'object' || session.version !== ENGINE_SESSION_VERSION) {
            throw new TypeError('Unsupported or invalid engine session');
        }

        const state = hydrateState(session.state);
        const deckCards = Array.isArray(session.deckCards) ? session.deckCards.map(hydrateCard) : [];
        validateActiveCards(state, deckCards);

        const dealOrder = Array.isArray(session.dealOrder) ? [...session.dealOrder] : [];
        if (state.phase !== PHASE.IDLE && dealOrder.length !== PLAYER_COUNT) {
            throw new TypeError('Active saved match requires a complete deal order');
        }
        if (dealOrder.length !== 0 && (
            new Set(dealOrder).size !== PLAYER_COUNT ||
            dealOrder.some(player => !Number.isInteger(player) || player < 0 || player >= PLAYER_COUNT)
        )) {
            throw new TypeError('Invalid saved deal order');
        }
        if (!Number.isInteger(session.dealCursor) || session.dealCursor < 0 || session.dealCursor > PLAYER_COUNT) {
            throw new TypeError('Invalid saved deal cursor');
        }
        if (!Number.isInteger(session.initialDealerIndex) || session.initialDealerIndex < 0 || session.initialDealerIndex >= PLAYER_COUNT) {
            throw new TypeError('Invalid saved initial dealer');
        }

        this.initialDealerIndex = session.initialDealerIndex;
        this.state = state;
        this._deck = state.phase === PHASE.IDLE ? null : Deck.fromCards(deckCards, { rng: this.rng });
        this._dealOrder = dealOrder;
        this._dealCursor = session.dealCursor;
        return this.getSnapshot();
    }

    static fromSession(session, { rng = Math.random } = {}) {
        const engine = new GameEngine({ rng });
        engine.restoreSession(session);
        return engine;
    }

    /**
     * Apply one explicit game command and return the resulting events/state.
     *
     * This is the preferred integration surface for controllers and, later,
     * the server-side multiplayer transport. Low-level methods remain public
     * for focused rules tests, but application code should use dispatch().
     */
    dispatch(action) {
        assertAction(action);
        let events;

        switch (action.type) {
            case ACTION.START_MATCH:
                events = this.#dispatchStartMatch();
                break;
            case ACTION.START_NEXT_HAND:
                events = this.#dispatchStartNextHand();
                break;
            case ACTION.DEAL_NEXT_BATCH:
                events = this.#dispatchDealNextBatch();
                break;
            case ACTION.SELECT_TRUMP:
                events = this.#dispatchSelectTrump(action);
                break;
            case ACTION.PLAY_CARD:
                events = this.#dispatchPlayCard(action);
                break;
            case ACTION.COMPLETE_TRICK:
                events = this.#dispatchCompleteTrick();
                break;
            case ACTION.SCORE_HAND:
                events = this.#dispatchScoreHand();
                break;
            case ACTION.RESET_MATCH:
                events = this.#dispatchResetMatch(action);
                break;
            default:
                // assertAction() guarantees this branch is unreachable.
                throw new RangeError(`Unsupported action type: ${action.type}`);
        }

        return {
            events,
            state: this.getSnapshot(),
        };
    }

    #dispatchStartMatch() {
        if (this.state.phase !== PHASE.IDLE) {
            throw new OmiRuleError('INVALID_PHASE', `Cannot start a match during ${this.state.phase}`);
        }

        const hand = this.startHand();
        return [
            createEvent(EVENT.MATCH_STARTED, {
                targetTokens: this.state.matchTokenTarget,
                dealerIndex: this.state.dealerIndex,
            }),
            createEvent(EVENT.HAND_STARTED, {
                handNumber: this.state.handNumber,
                ...hand,
            }),
        ];
    }

    #dispatchStartNextHand() {
        if (this.state.phase !== PHASE.HAND_COMPLETE) {
            throw new OmiRuleError('INVALID_PHASE', `Cannot start the next hand during ${this.state.phase}`);
        }

        const hand = this.startHand();
        return [createEvent(EVENT.HAND_STARTED, {
            handNumber: this.state.handNumber,
            ...hand,
        })];
    }

    #dispatchDealNextBatch() {
        const stage = this.state.phase;
        const result = this.dealNextBatch();
        const events = [createEvent(EVENT.CARDS_DEALT, {
            stage,
            playerIndex: result.playerIndex,
            cards: result.cards,
            remainingCards: result.remainingCards,
        })];

        if (result.phaseComplete && stage === PHASE.DEAL_INITIAL) {
            events.push(createEvent(EVENT.INITIAL_CARDS_DEALT, {
                trumpCaller: this.state.trumpCaller,
                handSizes: this.state.hands.map(hand => hand.length),
            }));
            events.push(createEvent(EVENT.TRUMP_REQUIRED, {
                playerId: this.state.trumpCaller,
            }));
        }

        if (result.phaseComplete && stage === PHASE.DEAL_REMAINING) {
            events.push(createEvent(EVENT.DEAL_COMPLETED, {
                firstPlayer: this.state.turnIndex,
                handSizes: this.state.hands.map(hand => hand.length),
            }));
        }

        return events;
    }

    #dispatchSelectTrump(action) {
        if (!Number.isInteger(action.playerId)) {
            throw new OmiRuleError('INVALID_PLAYER', 'SELECT_TRUMP requires an integer playerId');
        }
        if (action.playerId !== this.state.trumpCaller) {
            throw new OmiRuleError('WRONG_TRUMP_CALLER', `Player ${action.playerId} cannot select trump`);
        }

        const result = this.selectTrump(action.suit);
        return [createEvent(EVENT.TRUMP_SELECTED, {
            playerId: action.playerId,
            suit: result.trump,
        })];
    }

    #dispatchPlayCard(action) {
        if (!Number.isInteger(action.playerId)) {
            throw new OmiRuleError('INVALID_PLAYER', 'PLAY_CARD requires an integer playerId');
        }

        const hand = this.state.hands[action.playerId];
        if (!Array.isArray(hand)) {
            throw new OmiRuleError('INVALID_PLAYER', `Invalid player ${action.playerId}`);
        }

        const index = this.#resolveActionCardIndex(hand, action);
        const result = this.playCard(action.playerId, index);
        const events = [createEvent(EVENT.CARD_PLAYED, {
            playerId: result.playerIndex,
            card: result.card,
            cardId: cardId(result.card),
            trickComplete: result.trickComplete,
            nextPlayer: result.nextPlayer,
        })];

        if (result.trickComplete) {
            const preview = this.peekCurrentTrickResult();
            events.push(createEvent(EVENT.TRICK_READY, {
                winner: preview.winner,
                winningCard: preview.winningCard,
                leadSuit: preview.leadSuit,
                plays: this.state.currentTrick.map(play => ({
                    player: play.player,
                    card: play.card,
                })),
            }));
        }

        return events;
    }

    #resolveActionCardIndex(hand, action) {
        if (typeof action.cardId === 'string') {
            const index = hand.findIndex(card => cardId(card) === action.cardId);
            if (index < 0) {
                throw new OmiRuleError('INVALID_CARD', `Card ${action.cardId} is not in the player's hand`);
            }
            return index;
        }

        if (Number.isInteger(action.cardIndex)) {
            return action.cardIndex;
        }

        throw new OmiRuleError('INVALID_CARD', 'PLAY_CARD requires cardId or cardIndex');
    }

    #dispatchCompleteTrick() {
        const result = this.completeTrick();
        return [createEvent(EVENT.TRICK_COMPLETED, {
            trickNum: result.trickNum,
            winner: result.winner,
            winningCard: result.winningCard,
            leadSuit: result.leadSuit,
            team: result.team,
            handPlayComplete: result.handComplete,
        })];
    }

    #dispatchScoreHand() {
        const result = this.scoreCurrentHand();
        const events = [];

        if (result.tied) {
            events.push(createEvent(EVENT.HAND_TIED, {
                nextCarryTokens: result.nextCarryTokens,
            }));
        } else {
            events.push(createEvent(EVENT.TOKENS_AWARDED, {
                winnerTeam: result.winnerTeam,
                baseTokens: result.baseTokens,
                carryAwarded: result.carryAwarded,
                tokensAwarded: result.tokensAwarded,
                isDefense: result.isDefense,
                isKapothi: result.isKapothi,
                tokens: result.tokens,
            }));
        }

        events.push(createEvent(EVENT.HAND_COMPLETED, {
            handNumber: this.state.handNumber,
            teamTricks: [...this.state.teamTricks],
            callerTeam: result.callerTeam,
            result,
        }));

        if (result.matchOver) {
            const winnerTeam = this.state.tokens[0] >= this.state.matchTokenTarget ? 0 : 1;
            events.push(createEvent(EVENT.MATCH_COMPLETED, {
                winnerTeam,
                tokens: [...this.state.tokens],
                targetTokens: this.state.matchTokenTarget,
            }));
        }

        return events;
    }

    #dispatchResetMatch(action) {
        const dealerIndex = action.dealerIndex ?? this.initialDealerIndex;
        this.resetMatch({ dealerIndex });
        return [createEvent(EVENT.MATCH_RESET, {
            dealerIndex: this.state.dealerIndex,
            targetTokens: this.state.matchTokenTarget,
        })];
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
     * The caller controls when this method runs; animation timing stays out of
     * the engine.
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
