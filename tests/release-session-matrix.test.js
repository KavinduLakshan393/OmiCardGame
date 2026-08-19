import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTION,
    GameEngine,
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

function assertRoundTrip(game, label) {
    const exported = game.exportSession();
    const restored = GameEngine.fromSession(exported, { rng: seededRng(999) });
    assert.deepEqual(restored.getSnapshot(), game.getSnapshot(), `${label}: state`);
    assert.deepEqual(restored.exportSession(), exported, `${label}: complete engine session`);
    return restored;
}

function finishInitialDeal(game) {
    while (game.state.phase === PHASE.DEAL_INITIAL) {
        game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    }
}

function finishRemainingDeal(game) {
    while (game.state.phase === PHASE.DEAL_REMAINING) {
        game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    }
}

function playLegal(game) {
    const playerId = game.state.turnIndex;
    const index = game.getLegalCardIndices(playerId)[0];
    const selected = game.state.hands[playerId][index];
    game.dispatch({ type: ACTION.PLAY_CARD, playerId, cardId: cardId(selected) });
}

test('engine session round-trips every resumable phase boundary', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(87) });
    game.dispatch({ type: ACTION.START_MATCH });
    assertRoundTrip(game, 'start of initial deal');

    game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    assertRoundTrip(game, 'mid initial deal');

    finishInitialDeal(game);
    assert.equal(game.state.phase, PHASE.TRUMP_SELECTION);
    assertRoundTrip(game, 'trump selection');

    game.dispatch({ type: ACTION.SELECT_TRUMP, playerId: game.state.trumpCaller, suit: 'Clubs' });
    game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    assertRoundTrip(game, 'mid remaining deal');

    finishRemainingDeal(game);
    assert.equal(game.state.phase, PHASE.PLAYING);
    assertRoundTrip(game, 'start of play');

    playLegal(game);
    playLegal(game);
    assertRoundTrip(game, 'partial trick');

    playLegal(game);
    playLegal(game);
    assert.equal(game.state.currentTrick.length, 4);
    assertRoundTrip(game, 'complete trick awaiting collection');

    game.dispatch({ type: ACTION.COMPLETE_TRICK });
    assertRoundTrip(game, 'between tricks');

    while (game.state.phase === PHASE.PLAYING) {
        if (game.state.currentTrick.length === 4) game.dispatch({ type: ACTION.COMPLETE_TRICK });
        else playLegal(game);
    }
    assert.equal(game.state.phase, PHASE.HAND_SCORING);
    assertRoundTrip(game, 'hand scoring');

    game.dispatch({ type: ACTION.SCORE_HAND });
    if (game.state.phase === PHASE.HAND_COMPLETE) {
        assertRoundTrip(game, 'hand complete');
    }
});

test('restored pending trick resolves to the same winner and next state', () => {
    const game = new GameEngine({ rng: seededRng(111) });
    game.dispatch({ type: ACTION.START_MATCH });
    finishInitialDeal(game);
    game.dispatch({ type: ACTION.SELECT_TRUMP, playerId: game.state.trumpCaller, suit: 'Hearts' });
    finishRemainingDeal(game);
    for (let i = 0; i < 4; i += 1) playLegal(game);

    const restored = GameEngine.fromSession(game.exportSession());
    const originalResult = game.dispatch({ type: ACTION.COMPLETE_TRICK });
    const restoredResult = restored.dispatch({ type: ACTION.COMPLETE_TRICK });

    assert.deepEqual(restoredResult.events, originalResult.events);
    assert.deepEqual(restoredResult.state, originalResult.state);
});
