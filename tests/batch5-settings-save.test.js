import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, PHASE, PLAYER, cardId } from '../src/engine/index.js';
import { SinglePlayerController } from '../src/controllers/SinglePlayerController.js';
import { loadSettings, saveSettings, updateSettings } from '../src/storage/settings.js';
import { clearSavedGame, createSaveRecord, hasSavedGame, loadGame, saveGame } from '../src/storage/saveGame.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    };
}

function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function dealToPlaying(game) {
    game.dispatch({ type: 'START_MATCH' });
    for (let i = 0; i < 4; i += 1) game.dispatch({ type: 'DEAL_NEXT_BATCH' });
    game.dispatch({ type: 'SELECT_TRUMP', playerId: PLAYER.SOUTH, suit: 'Hearts' });
    for (let i = 0; i < 4; i += 1) game.dispatch({ type: 'DEAL_NEXT_BATCH' });
}

test('settings persist all Patch 12 preferences and normalize invalid values', () => {
    const storage = memoryStorage();
    saveSettings({ difficulty: 'casual', sound: false, animationSpeed: 'fast', reducedMotion: 'reduce' }, storage);
    assert.deepEqual(loadSettings(storage), {
        difficulty: 'casual',
        sound: false,
        animationSpeed: 'fast',
        reducedMotion: 'reduce',
    });

    const updated = updateSettings({ animationSpeed: 'relaxed', difficulty: 'invalid' }, storage);
    assert.equal(updated.animationSpeed, 'relaxed');
    assert.equal(updated.difficulty, 'smart');
});

test('engine session round-trips an in-progress trick exactly', () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(42) });
    dealToPlaying(game);

    const player = game.state.turnIndex;
    const card = game.state.hands[player][game.getLegalCardIndices(player)[0]];
    game.dispatch({ type: 'PLAY_CARD', playerId: player, cardId: cardId(card) });

    const session = game.exportSession();
    const restored = GameEngine.fromSession(session, { rng: seededRng(42) });
    assert.deepEqual(restored.getSnapshot(), game.getSnapshot());
    assert.equal(restored.remainingDeckCards, game.remainingDeckCards);
    assert.deepEqual(restored.exportSession().dealOrder, session.dealOrder);
});

test('engine session rejects duplicate active cards', () => {
    const game = new GameEngine({ rng: seededRng(9) });
    dealToPlaying(game);
    const session = game.exportSession();
    session.state.hands[1][0] = { ...session.state.hands[0][0] };
    assert.throws(() => GameEngine.fromSession(session), /duplicate cards/i);
});

test('save store persists active record and clears corrupt data', () => {
    const storage = memoryStorage();
    const game = new GameEngine({ rng: seededRng(10) });
    dealToPlaying(game);
    const record = createSaveRecord({ engineSession: game.exportSession(), stats: { roundsWon: [1, 0] }, savedAt: 1234 });
    assert.equal(saveGame(record, storage), true);
    assert.equal(hasSavedGame(storage), true);
    assert.equal(loadGame(storage).savedAt, 1234);

    storage.setItem('omi.single-player.save.v1', '{broken json');
    assert.equal(loadGame(storage), null);
    assert.equal(hasSavedGame(storage), false);
    assert.equal(clearSavedGame(storage), true);
});

test('controller resumes a restored PLAYING state and stops at human input', async () => {
    const game = new GameEngine({ dealerIndex: PLAYER.WEST, rng: seededRng(18) });
    dealToPlaying(game);
    // Trump caller is South for West dealer, so this starts on the human turn.
    assert.equal(game.state.turnIndex, PLAYER.SOUTH);

    const restored = GameEngine.fromSession(game.exportSession());
    let humanTurnCalls = 0;
    const controller = new SinglePlayerController({
        engine: restored,
        humanPlayerId: PLAYER.SOUTH,
        hooks: { onHumanTurn: async () => { humanTurnCalls += 1; } },
    });
    await controller.resumeMatch();
    assert.equal(controller.state.phase, PHASE.PLAYING);
    assert.equal(controller.state.turnIndex, PLAYER.SOUTH);
    assert.equal(humanTurnCalls, 1);
});
