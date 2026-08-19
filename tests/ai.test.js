import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_DIFFICULTY, AIPlayer } from '../src/ai/AIPlayer.js';
import { buildAIKnowledge } from '../src/ai/knowledge.js';
import { chooseSmartCard, chooseSmartTrump } from '../src/ai/smartAI.js';
import { Card, PHASE, PLAYER, createInitialState } from '../src/engine/index.js';

function stateFor(playerId, ownHand, currentTrick = []) {
    const state = createInitialState();
    state.phase = PHASE.PLAYING;
    state.trump = 'Hearts';
    state.turnIndex = playerId;
    state.hands[playerId] = ownHand;
    state.currentTrick = currentTrick;
    return state;
}

test('AI knowledge exposes own hand and public information but no hidden hands', () => {
    const state = createInitialState();
    state.hands[PLAYER.EAST] = [new Card('Clubs', 'A')];
    state.hands[PLAYER.SOUTH] = [new Card('Hearts', 'A')];
    state.hands[PLAYER.NORTH] = [new Card('Diamonds', 'A')];
    state.hands[PLAYER.WEST] = [new Card('Spades', 'A')];

    const knowledge = buildAIKnowledge(state, PLAYER.EAST);

    assert.equal('hands' in knowledge, false);
    assert.deepEqual(knowledge.ownHand, [{ suit: 'Clubs', rank: 'A' }]);
    assert.equal(JSON.stringify(knowledge).includes('Diamonds'), false);
    assert.equal(JSON.stringify(knowledge).includes('Spades'), false);
});

test('Casual AI always chooses from the legal card set', () => {
    const state = stateFor(
        PLAYER.EAST,
        [new Card('Clubs', '7'), new Card('Hearts', 'A'), new Card('Clubs', 'K')],
        [{ player: PLAYER.SOUTH, card: new Card('Clubs', '10') }],
    );
    const knowledge = buildAIKnowledge(state, PLAYER.EAST);
    const ai = new AIPlayer({ difficulty: AI_DIFFICULTY.CASUAL, rng: () => 0.99 });
    const selected = ai.chooseCard(knowledge);

    assert.ok(knowledge.legalCards.some(entry => entry.cardId === selected));
    assert.notEqual(selected, 'A-Hearts', 'AI must follow Clubs when it holds Clubs');
});

test('Smart AI prefers the longest/highest first-four suit for trump', () => {
    const state = createInitialState();
    state.hands[PLAYER.EAST] = [
        new Card('Spades', 'A'),
        new Card('Spades', 'K'),
        new Card('Spades', '7'),
        new Card('Hearts', 'A'),
    ];
    const knowledge = buildAIKnowledge(state, PLAYER.EAST);
    assert.equal(chooseSmartTrump(knowledge), 'Spades');
});

test('Smart AI ducks low when its partner is already winning', () => {
    const state = stateFor(
        PLAYER.NORTH,
        [new Card('Clubs', '7'), new Card('Clubs', 'A'), new Card('Hearts', '7')],
        [
            { player: PLAYER.SOUTH, card: new Card('Clubs', 'K') },
            { player: PLAYER.EAST, card: new Card('Clubs', 'Q') },
        ],
    );
    const knowledge = buildAIKnowledge(state, PLAYER.NORTH);

    assert.equal(chooseSmartCard(knowledge), '7-Clubs');
});


test('AI knowledge infers publicly known void suits from off-suit plays', () => {
    const state = createInitialState();
    state.trump = 'Hearts';
    state.trickHistory = [{
        trickNum: 1,
        winner: PLAYER.SOUTH,
        plays: [
            { player: PLAYER.SOUTH, card: new Card('Clubs', 'A') },
            { player: PLAYER.EAST, card: new Card('Spades', '7') },
            { player: PLAYER.NORTH, card: new Card('Clubs', 'K') },
            { player: PLAYER.WEST, card: new Card('Hearts', '8') },
        ],
    }];

    const knowledge = buildAIKnowledge(state, PLAYER.NORTH);
    assert.deepEqual(knowledge.knownVoidSuits[PLAYER.EAST], ['Clubs']);
    assert.deepEqual(knowledge.knownVoidSuits[PLAYER.WEST], ['Clubs']);
    assert.deepEqual(knowledge.knownVoidSuits[PLAYER.SOUTH], []);
});
