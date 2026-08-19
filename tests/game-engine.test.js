import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GameEngine,
    PHASE,
    PLAYER,
    STANDARD_MATCH_TARGET,
    dealOrderFromDealer,
    nextCounterClockwise,
    playerToDealerRight,
} from '../src/engine/index.js';

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

test('counter-clockwise order follows South -> East -> North -> West', () => {
    assert.equal(nextCounterClockwise(PLAYER.SOUTH), PLAYER.EAST);
    assert.equal(nextCounterClockwise(PLAYER.EAST), PLAYER.NORTH);
    assert.equal(nextCounterClockwise(PLAYER.NORTH), PLAYER.WEST);
    assert.equal(nextCounterClockwise(PLAYER.WEST), PLAYER.SOUTH);
});

test('player to dealer right chooses trump and deal begins there', () => {
    assert.equal(playerToDealerRight(PLAYER.WEST), PLAYER.SOUTH);
    assert.deepEqual(
        dealOrderFromDealer(PLAYER.WEST),
        [PLAYER.SOUTH, PLAYER.EAST, PLAYER.NORTH, PLAYER.WEST],
    );
});

test('standard match target is 10 tokens', () => {
    const game = new GameEngine();
    assert.equal(game.state.matchTokenTarget, STANDARD_MATCH_TARGET);
    assert.equal(game.state.matchTokenTarget, 10);
});

test('deal occurs as four-card batch, trump selection, then four-card batch', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(123) });
    game.startHand();

    assert.equal(game.state.phase, PHASE.DEAL_INITIAL);
    assert.equal(game.state.trumpCaller, PLAYER.SOUTH);

    for (let i = 0; i < 4; i += 1) game.dealNextBatch();
    assert.equal(game.state.phase, PHASE.TRUMP_SELECTION);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [4, 4, 4, 4]);
    assert.equal(game.remainingDeckCards, 16);

    game.selectTrump('Hearts');
    assert.equal(game.state.phase, PHASE.DEAL_REMAINING);

    for (let i = 0; i < 4; i += 1) game.dealNextBatch();
    assert.equal(game.state.phase, PHASE.PLAYING);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [8, 8, 8, 8]);
    assert.equal(game.remainingDeckCards, 0);
    assert.equal(game.state.turnIndex, PLAYER.SOUTH);
});

test('play advances counter-clockwise and trick winner leads next', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(456) });
    game.startHand();
    for (let i = 0; i < 4; i += 1) game.dealNextBatch();
    game.selectTrump('Spades');
    for (let i = 0; i < 4; i += 1) game.dealNextBatch();

    const expectedOrder = [PLAYER.SOUTH, PLAYER.EAST, PLAYER.NORTH, PLAYER.WEST];
    for (let turn = 0; turn < expectedOrder.length; turn += 1) {
        const pid = expectedOrder[turn];
        assert.equal(game.state.turnIndex, pid);
        const legal = game.getLegalCardIndices(pid);
        const result = game.playCard(pid, legal[0]);
        if (turn < 3) assert.equal(result.trickComplete, false);
    }

    const preview = game.peekCurrentTrickResult();
    const result = game.completeTrick();
    assert.equal(result.winner, preview.winner);
    assert.equal(game.state.turnIndex, result.winner);
});

test('dealer rotates to the right after a completed hand', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST });
    game.state.phase = PHASE.HAND_SCORING;
    game.state.trumpCaller = PLAYER.SOUTH;
    game.state.teamTricks = [5, 3];

    const result = game.scoreCurrentHand();
    assert.equal(result.nextDealerIndex, PLAYER.SOUTH);
    assert.equal(game.state.dealerIndex, PLAYER.SOUTH);
});

test('a complete eight-trick hand can run from deal through scoring', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(789) });
    game.startHand();
    for (let i = 0; i < 4; i += 1) game.dealNextBatch();
    game.selectTrump('Diamonds');
    for (let i = 0; i < 4; i += 1) game.dealNextBatch();

    let completedTricks = 0;
    while (game.state.phase === PHASE.PLAYING) {
        const pid = game.state.turnIndex;
        const legal = game.getLegalCardIndices(pid);
        const play = game.playCard(pid, legal[0]);
        if (play.trickComplete) {
            game.completeTrick();
            completedTricks += 1;
        }
    }

    assert.equal(completedTricks, 8);
    assert.equal(game.state.trickHistory.length, 8);
    assert.deepEqual(game.state.hands.map(hand => hand.length), [0, 0, 0, 0]);
    assert.equal(game.state.phase, PHASE.HAND_SCORING);

    const score = game.scoreCurrentHand();
    assert.ok(score.tied || score.tokensAwarded >= 1);
    assert.ok([PHASE.HAND_COMPLETE, PHASE.MATCH_COMPLETE].includes(game.state.phase));
});

test('match is complete when a team reaches 10 or more tokens', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST });
    game.state.tokens = [9, 0];
    game.state.phase = PHASE.HAND_SCORING;
    game.state.trumpCaller = PLAYER.SOUTH;
    game.state.teamTricks = [5, 3];

    const result = game.scoreCurrentHand();
    assert.deepEqual(game.state.tokens, [10, 0]);
    assert.equal(result.matchOver, true);
    assert.equal(game.state.phase, PHASE.MATCH_COMPLETE);
});
