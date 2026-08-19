import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTION,
    EVENT,
    GameEngine,
    OmiRuleError,
    PHASE,
    PLAYER,
    cardId,
} from '../src/engine/index.js';

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

test('dispatch emits match/hand events and detached state snapshots', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(10) });
    const result = game.dispatch({ type: ACTION.START_MATCH });

    assert.deepEqual(result.events.map(event => event.type), [EVENT.MATCH_STARTED, EVENT.HAND_STARTED]);
    assert.equal(result.state.phase, PHASE.DEAL_INITIAL);

    result.state.tokens[0] = 99;
    assert.equal(game.state.tokens[0], 0, 'returned snapshot must not mutate authoritative state');
});

test('deal actions emit trump-required and deal-completed boundaries', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(11) });
    game.dispatch({ type: ACTION.START_MATCH });

    let finalInitial;
    for (let i = 0; i < 4; i += 1) {
        finalInitial = game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    }

    assert.ok(finalInitial.events.some(event => event.type === EVENT.INITIAL_CARDS_DEALT));
    assert.ok(finalInitial.events.some(event => event.type === EVENT.TRUMP_REQUIRED));
    assert.equal(game.state.phase, PHASE.TRUMP_SELECTION);

    game.dispatch({
        type: ACTION.SELECT_TRUMP,
        playerId: PLAYER.SOUTH,
        suit: 'Hearts',
    });

    let finalRemaining;
    for (let i = 0; i < 4; i += 1) {
        finalRemaining = game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    }

    assert.ok(finalRemaining.events.some(event => event.type === EVENT.DEAL_COMPLETED));
    assert.equal(game.state.phase, PHASE.PLAYING);
});

test('PLAY_CARD accepts stable card ids and emits card/trick events', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(12) });
    game.dispatch({ type: ACTION.START_MATCH });
    for (let i = 0; i < 4; i += 1) game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    game.dispatch({ type: ACTION.SELECT_TRUMP, playerId: PLAYER.SOUTH, suit: 'Spades' });
    for (let i = 0; i < 4; i += 1) game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });

    for (let turn = 0; turn < 4; turn += 1) {
        const playerId = game.state.turnIndex;
        const legalIndex = game.getLegalCardIndices(playerId)[0];
        const id = cardId(game.state.hands[playerId][legalIndex]);
        const result = game.dispatch({ type: ACTION.PLAY_CARD, playerId, cardId: id });
        assert.equal(result.events[0].type, EVENT.CARD_PLAYED);

        if (turn === 3) {
            assert.ok(result.events.some(event => event.type === EVENT.TRICK_READY));
        }
    }

    const completion = game.dispatch({ type: ACTION.COMPLETE_TRICK });
    assert.equal(completion.events[0].type, EVENT.TRICK_COMPLETED);
});

test('action validation rejects wrong trump caller', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(13) });
    game.dispatch({ type: ACTION.START_MATCH });
    for (let i = 0; i < 4; i += 1) game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });

    assert.throws(
        () => game.dispatch({ type: ACTION.SELECT_TRUMP, playerId: PLAYER.EAST, suit: 'Clubs' }),
        error => error instanceof OmiRuleError && error.code === 'WRONG_TRUMP_CALLER',
    );
});
