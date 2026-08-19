import { AI_DIFFICULTY, AIPlayer } from '../ai/AIPlayer.js';
import { buildAIKnowledge } from '../ai/knowledge.js';
import { ACTION } from '../engine/actions.js';
import { cardId } from '../engine/cards.js';
import { PHASE, PLAYER_COUNT } from '../engine/constants.js';
import { EVENT } from '../engine/events.js';
import { GameEngine, OmiRuleError } from '../engine/GameEngine.js';

const asyncNoop = async () => {};

const DEFAULT_HOOKS = Object.freeze({
    onEvents: asyncNoop,
    afterDealBatch: asyncNoop,
    onHumanTrumpRequired: asyncNoop,
    beforeAITrump: asyncNoop,
    beforeAITurn: asyncNoop,
    onHumanTurn: asyncNoop,
    afterCardPlayed: asyncNoop,
    beforeTrickComplete: asyncNoop,
    afterTrickComplete: asyncNoop,
    beforeHandScore: asyncNoop,
    afterHandScored: asyncNoop,
});

/**
 * Orchestrates one human plus three AI players without knowing anything about
 * HTML, CSS, audio, or concrete animation implementations.
 *
 * Presentation code can provide asynchronous hooks. The controller awaits
 * those hooks before advancing authoritative state, which gives animations a
 * clean completion boundary while keeping all timing out of the rules engine.
 */
export class SinglePlayerController {
    constructor({
        engine = new GameEngine(),
        humanPlayerId = 0,
        difficulty = AI_DIFFICULTY.SMART,
        aiRng = Math.random,
        hooks = {},
    } = {}) {
        if (!(engine instanceof GameEngine)) {
            throw new TypeError('engine must be a GameEngine');
        }
        if (!Number.isInteger(humanPlayerId) || humanPlayerId < 0 || humanPlayerId >= PLAYER_COUNT) {
            throw new RangeError(`Invalid human player id: ${humanPlayerId}`);
        }

        this.engine = engine;
        this.humanPlayerId = humanPlayerId;
        this.hooks = { ...DEFAULT_HOOKS, ...hooks };
        this._queue = Promise.resolve();
        this._pendingTasks = 0;
        this._aiPlayers = new Map();

        for (let playerId = 0; playerId < PLAYER_COUNT; playerId += 1) {
            if (playerId !== humanPlayerId) {
                this._aiPlayers.set(playerId, new AIPlayer({ difficulty, rng: aiRng }));
            }
        }
    }

    get state() {
        return this.engine.state;
    }

    get isBusy() {
        return this._pendingTasks > 0;
    }

    getSnapshot() {
        return this.engine.getSnapshot();
    }

    getLegalHumanCardIndices() {
        return this.engine.getLegalCardIndices(this.humanPlayerId);
    }

    setDifficulty(difficulty) {
        for (const player of this._aiPlayers.values()) {
            player.setDifficulty(difficulty);
        }
    }

    startMatch() {
        return this.#enqueue(async () => {
            await this.#dispatch({ type: ACTION.START_MATCH });
            await this.#dealCurrentPhase();
            await this.#continueFromTrumpSelection();
            return this.getSnapshot();
        });
    }

    startNextHand() {
        return this.#enqueue(async () => {
            await this.#dispatch({ type: ACTION.START_NEXT_HAND });
            await this.#dealCurrentPhase();
            await this.#continueFromTrumpSelection();
            return this.getSnapshot();
        });
    }

    /**
     * Continue an engine restored from a persisted session.
     *
     * A browser may close between any two presentation hooks. Resume therefore
     * handles every rule phase, including a four-card trick waiting to be
     * collected or a hand waiting to be scored.
     */
    resumeMatch() {
        return this.#enqueue(async () => {
            if (this.state.phase === PHASE.IDLE) {
                throw new OmiRuleError('NO_ACTIVE_MATCH', 'There is no active match to resume');
            }
            if (this.state.phase === PHASE.MATCH_COMPLETE || this.state.phase === PHASE.HAND_COMPLETE) {
                return this.getSnapshot();
            }
            if ([PHASE.DEAL_INITIAL, PHASE.DEAL_REMAINING].includes(this.state.phase)) {
                await this.#dealCurrentPhase();
                if (this.state.phase === PHASE.TRUMP_SELECTION) {
                    await this.#continueFromTrumpSelection();
                } else if (this.state.phase === PHASE.PLAYING) {
                    await this.#driveTurnsUntilHumanOrHandEnd();
                }
                return this.getSnapshot();
            }
            if (this.state.phase === PHASE.TRUMP_SELECTION) {
                await this.#continueFromTrumpSelection();
                return this.getSnapshot();
            }
            if (this.state.phase === PHASE.HAND_SCORING) {
                await this.#scorePendingHand();
                return this.getSnapshot();
            }
            if (this.state.phase === PHASE.PLAYING && this.state.currentTrick.length === PLAYER_COUNT) {
                await this.#finishCurrentTrick();
            }
            if (this.state.phase === PHASE.PLAYING) {
                await this.#driveTurnsUntilHumanOrHandEnd();
            }
            return this.getSnapshot();
        });
    }

    selectTrump(suit) {
        return this.#enqueue(async () => {
            if (this.state.trumpCaller !== this.humanPlayerId) {
                throw new OmiRuleError('WRONG_TRUMP_CALLER', 'The human player is not the trump caller');
            }

            await this.#selectTrumpAndContinue(this.humanPlayerId, suit);
            return this.getSnapshot();
        });
    }

    playHumanCard(cardIndexOrId) {
        return this.#enqueue(async () => {
            if (this.state.phase !== PHASE.PLAYING) {
                throw new OmiRuleError('INVALID_PHASE', `Cannot play during ${this.state.phase}`);
            }
            if (this.state.turnIndex !== this.humanPlayerId) {
                throw new OmiRuleError('WRONG_TURN', 'It is not the human player\'s turn');
            }

            const action = this.#humanPlayAction(cardIndexOrId);
            await this.#playActionAndAdvance(action);
            return this.getSnapshot();
        });
    }

    resetMatch() {
        return this.#enqueue(async () => {
            await this.#dispatch({ type: ACTION.RESET_MATCH });
            return this.getSnapshot();
        });
    }

    #humanPlayAction(cardIndexOrId) {
        if (typeof cardIndexOrId === 'string') {
            return {
                type: ACTION.PLAY_CARD,
                playerId: this.humanPlayerId,
                cardId: cardIndexOrId,
            };
        }

        if (!Number.isInteger(cardIndexOrId)) {
            throw new OmiRuleError('INVALID_CARD', 'Card selection must be a card id or integer index');
        }

        const card = this.state.hands[this.humanPlayerId][cardIndexOrId];
        if (!card) {
            throw new OmiRuleError('INVALID_CARD', `Invalid card index: ${cardIndexOrId}`);
        }

        return {
            type: ACTION.PLAY_CARD,
            playerId: this.humanPlayerId,
            cardId: cardId(card),
        };
    }

    async #continueFromTrumpSelection() {
        if (this.state.phase !== PHASE.TRUMP_SELECTION) return;

        if (this.state.trumpCaller === this.humanPlayerId) {
            await this.hooks.onHumanTrumpRequired({
                playerId: this.humanPlayerId,
                state: this.getSnapshot(),
            });
            return;
        }

        const playerId = this.state.trumpCaller;
        await this.hooks.beforeAITrump({ playerId, state: this.getSnapshot() });
        const knowledge = buildAIKnowledge(this.state, playerId);
        const suit = this.#aiFor(playerId).chooseTrump(knowledge);
        await this.#selectTrumpAndContinue(playerId, suit);
    }

    async #selectTrumpAndContinue(playerId, suit) {
        await this.#dispatch({
            type: ACTION.SELECT_TRUMP,
            playerId,
            suit,
        });
        await this.#dealCurrentPhase();
        await this.#driveTurnsUntilHumanOrHandEnd();
    }

    async #dealCurrentPhase() {
        const phase = this.state.phase;
        if (![PHASE.DEAL_INITIAL, PHASE.DEAL_REMAINING].includes(phase)) return;

        while (this.state.phase === phase) {
            const result = await this.#dispatch({ type: ACTION.DEAL_NEXT_BATCH });
            const dealEvent = result.events.find(event => event.type === EVENT.CARDS_DEALT);
            await this.hooks.afterDealBatch({
                event: dealEvent,
                state: result.state,
            });
        }
    }

    async #driveTurnsUntilHumanOrHandEnd() {
        while (this.state.phase === PHASE.PLAYING) {
            if (this.state.turnIndex === this.humanPlayerId) {
                await this.hooks.onHumanTurn({
                    playerId: this.humanPlayerId,
                    legalCardIndices: this.getLegalHumanCardIndices(),
                    state: this.getSnapshot(),
                });
                return;
            }

            const playerId = this.state.turnIndex;
            await this.hooks.beforeAITurn({ playerId, state: this.getSnapshot() });
            const knowledge = buildAIKnowledge(this.state, playerId);
            const selectedCardId = this.#aiFor(playerId).chooseCard(knowledge);

            await this.#playActionAndAdvance({
                type: ACTION.PLAY_CARD,
                playerId,
                cardId: selectedCardId,
            }, { continueLoop: false });

            if (this.state.phase !== PHASE.PLAYING) return;
        }
    }

    async #playActionAndAdvance(action, { continueLoop = true } = {}) {
        const result = await this.#dispatch(action);
        const cardEvent = result.events.find(event => event.type === EVENT.CARD_PLAYED);
        await this.hooks.afterCardPlayed({ event: cardEvent, state: result.state });

        if (cardEvent.trickComplete) {
            await this.#finishCurrentTrick();
        }

        if (continueLoop && this.state.phase === PHASE.PLAYING) {
            await this.#driveTurnsUntilHumanOrHandEnd();
        }
    }

    async #finishCurrentTrick() {
        const preview = this.engine.peekCurrentTrickResult();
        await this.hooks.beforeTrickComplete({
            preview,
            state: this.getSnapshot(),
        });

        const result = await this.#dispatch({ type: ACTION.COMPLETE_TRICK });
        const trickEvent = result.events.find(event => event.type === EVENT.TRICK_COMPLETED);
        await this.hooks.afterTrickComplete({
            event: trickEvent,
            state: result.state,
        });

        if (this.state.phase === PHASE.HAND_SCORING) {
            await this.#scorePendingHand();
        }
    }

    async #scorePendingHand() {
        await this.hooks.beforeHandScore({ state: this.getSnapshot() });
        const scoreResult = await this.#dispatch({ type: ACTION.SCORE_HAND });
        const handEvent = scoreResult.events.find(event => event.type === EVENT.HAND_COMPLETED);
        await this.hooks.afterHandScored({
            event: handEvent,
            events: scoreResult.events,
            state: scoreResult.state,
        });
    }

    async #dispatch(action) {
        const result = this.engine.dispatch(action);
        await this.hooks.onEvents(result.events, result.state);
        return result;
    }

    #aiFor(playerId) {
        const player = this._aiPlayers.get(playerId);
        if (!player) throw new Error(`No AI configured for player ${playerId}`);
        return player;
    }

    #enqueue(task) {
        this._pendingTasks += 1;
        const run = this._queue.then(task, task);
        this._queue = run.catch(() => {});
        return run.finally(() => {
            this._pendingTasks -= 1;
        });
    }
}
