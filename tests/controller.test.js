import test from 'node:test';
import assert from 'node:assert/strict';
import { SinglePlayerController } from '../src/controllers/SinglePlayerController.js';
import { AI_DIFFICULTY } from '../src/ai/AIPlayer.js';
import { GameEngine, PHASE, PLAYER } from '../src/engine/index.js';

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

test('controller deals first four and pauses for human trump selection', async () => {
    let requestedTrump = false;
    const controller = new SinglePlayerController({
        engine: new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(20) }),
        hooks: {
            onHumanTrumpRequired: async () => { requestedTrump = true; },
        },
    });

    await controller.startMatch();

    assert.equal(controller.state.phase, PHASE.TRUMP_SELECTION);
    assert.deepEqual(controller.state.hands.map(hand => hand.length), [4, 4, 4, 4]);
    assert.equal(controller.state.trumpCaller, PLAYER.SOUTH);
    assert.equal(requestedTrump, true);
});

test('controller handles second deal and AI turns until human input is required', async () => {
    const controller = new SinglePlayerController({
        engine: new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(21) }),
        difficulty: AI_DIFFICULTY.SMART,
    });

    await controller.startMatch();
    await controller.selectTrump('Hearts');

    assert.equal(controller.state.phase, PHASE.PLAYING);
    assert.deepEqual(controller.state.hands.map(hand => hand.length), [8, 8, 8, 8]);
    assert.equal(controller.state.turnIndex, PLAYER.SOUTH);

    const legal = controller.getLegalHumanCardIndices();
    await controller.playHumanCard(legal[0]);

    assert.equal(controller.state.phase, PHASE.PLAYING);
    assert.equal(controller.state.turnIndex, PLAYER.SOUTH);
    assert.equal(controller.state.hands[PLAYER.SOUTH].length, 7);
});

test('controller can complete and score an entire hand with fair AI', async () => {
    const controller = new SinglePlayerController({
        engine: new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(22) }),
        difficulty: AI_DIFFICULTY.SMART,
    });

    await controller.startMatch();
    await controller.selectTrump('Diamonds');

    let humanPlays = 0;
    while (controller.state.phase === PHASE.PLAYING) {
        assert.equal(controller.state.turnIndex, PLAYER.SOUTH);
        const legal = controller.getLegalHumanCardIndices();
        await controller.playHumanCard(legal[0]);
        humanPlays += 1;
        assert.ok(humanPlays <= 8, 'a hand cannot require more than eight human card plays');
    }

    assert.equal(humanPlays, 8);
    assert.ok([PHASE.HAND_COMPLETE, PHASE.MATCH_COMPLETE].includes(controller.state.phase));
    assert.equal(controller.state.trickHistory.length, 8);
    assert.deepEqual(controller.state.hands.map(hand => hand.length), [0, 0, 0, 0]);
    assert.equal(controller.state.teamTricks[0] + controller.state.teamTricks[1], 8);
});
