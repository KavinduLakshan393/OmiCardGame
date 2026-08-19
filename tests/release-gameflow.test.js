import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTION,
    GameEngine,
    PHASE,
    cardId,
} from '../src/engine/index.js';

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function dealCurrentPhase(game) {
    while ([PHASE.DEAL_INITIAL, PHASE.DEAL_REMAINING].includes(game.state.phase)) {
        game.dispatch({ type: ACTION.DEAL_NEXT_BATCH });
    }
}

function playOneHand(game) {
    if (game.state.phase === PHASE.IDLE) {
        game.dispatch({ type: ACTION.START_MATCH });
    } else if (game.state.phase === PHASE.HAND_COMPLETE) {
        game.dispatch({ type: ACTION.START_NEXT_HAND });
    } else {
        throw new Error(`Cannot start deterministic hand from ${game.state.phase}`);
    }

    dealCurrentPhase(game);

    assert.equal(game.state.phase, PHASE.TRUMP_SELECTION);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [4, 4, 4, 4]);

    const caller = game.state.trumpCaller;
    const suit = game.state.hands[caller][0].suit;
    game.dispatch({ type: ACTION.SELECT_TRUMP, playerId: caller, suit });
    dealCurrentPhase(game);

    assert.equal(game.state.phase, PHASE.PLAYING);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [8, 8, 8, 8]);

    let completedTricks = 0;
    while (game.state.phase === PHASE.PLAYING) {
        if (game.state.currentTrick.length === 4) {
            game.dispatch({ type: ACTION.COMPLETE_TRICK });
            completedTricks += 1;
            continue;
        }

        const playerId = game.state.turnIndex;
        const legal = game.getLegalCardIndices(playerId);
        assert.ok(legal.length > 0, 'active player must always have a legal move');
        const selected = game.state.hands[playerId][legal[0]];
        game.dispatch({
            type: ACTION.PLAY_CARD,
            playerId,
            cardId: cardId(selected),
        });
    }

    assert.equal(completedTricks, 8);
    assert.equal(game.state.trickHistory.length, 8);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [0, 0, 0, 0]);
    assert.equal(game.state.teamTricks[0] + game.state.teamTricks[1], 8);

    const previousTokens = [...game.state.tokens];
    const scoreResult = game.dispatch({ type: ACTION.SCORE_HAND });
    assert.ok([PHASE.HAND_COMPLETE, PHASE.MATCH_COMPLETE].includes(scoreResult.state.phase));
    assert.ok(scoreResult.state.tokens[0] >= previousTokens[0]);
    assert.ok(scoreResult.state.tokens[1] >= previousTokens[1]);
    return scoreResult.state;
}

test('100 deterministic complete matches terminate without impossible state', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
        const game = new GameEngine({ rng: seededRng(seed) });
        let hands = 0;

        while (game.state.phase !== PHASE.MATCH_COMPLETE && hands < 40) {
            playOneHand(game);
            hands += 1;
        }

        assert.equal(game.state.phase, PHASE.MATCH_COMPLETE, `seed ${seed} must finish`);
        assert.ok(game.state.tokens.some(tokens => tokens >= game.state.matchTokenTarget));
        assert.ok(hands > 0 && hands < 40, `seed ${seed} completed in a sane number of hands`);
        assert.equal(game.state.currentTrick.length, 0);
        assert.deepEqual(game.state.hands.map(hand => hand.length), [0, 0, 0, 0]);
    }
});

test('reset after a completed match returns a clean release-ready state', () => {
    const game = new GameEngine({ rng: seededRng(404) });
    while (game.state.phase !== PHASE.MATCH_COMPLETE) playOneHand(game);

    const result = game.dispatch({ type: ACTION.RESET_MATCH });
    assert.equal(result.state.phase, PHASE.IDLE);
    assert.deepEqual(result.state.tokens, [0, 0]);
    assert.deepEqual(result.state.teamTricks, [0, 0]);
    assert.deepEqual(result.state.hands, [[], [], [], []]);
    assert.equal(result.state.trump, null);
    assert.equal(result.state.handNumber, 0);
    assert.equal(result.state.matchOver, false);
});
