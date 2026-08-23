import test from 'node:test';
import assert from 'node:assert/strict';
import { Card, PHASE, PLAYER, createInitialState } from '../src/engine/index.js';
import { buildHumanHint } from '../src/ui/hints.js';
import { handResultView, matchResultView } from '../src/ui/results.js';

test('hint enforces follow-suit advice using only human/public state', () => {
    const state = createInitialState();
    state.phase = PHASE.PLAYING;
    state.trump = 'Hearts';
    state.turnIndex = PLAYER.SOUTH;
    state.hands[PLAYER.SOUTH] = [new Card('Clubs', '7'), new Card('Hearts', 'A')];
    state.currentTrick = [{ player: PLAYER.EAST, card: new Card('Clubs', '10') }];

    const hint = buildHumanHint(state, PLAYER.SOUTH);
    assert.match(hint.title, /Follow Clubs/);
    assert.match(hint.message, /must follow Clubs/i);
    assert.doesNotMatch(JSON.stringify(hint), /hidden|opponent hand/i);
});

test('hint recognizes when the human partner is currently winning', () => {
    const state = createInitialState();
    state.phase = PHASE.PLAYING;
    state.trump = 'Hearts';
    state.turnIndex = PLAYER.SOUTH;
    state.hands[PLAYER.SOUTH] = [new Card('Clubs', '7'), new Card('Clubs', 'A')];
    state.currentTrick = [
        { player: PLAYER.NORTH, card: new Card('Clubs', 'K') },
        { player: PLAYER.WEST, card: new Card('Clubs', 'Q') },
    ];
    const hint = buildHumanHint(state, PLAYER.SOUTH);
    assert.match(hint.message, /partner is currently winning/i);
    assert.equal(hint.cardId, '7-Clubs');
});

test('hand result view includes tricks, token detail, carry and next dealer', () => {
    const state = createInitialState();
    state.teamTricks = [6, 2];
    state.dealerIndex = PLAYER.SOUTH;
    const view = handResultView({
        state,
        result: {
            tied: false,
            winnerTeam: 0,
            tokensAwarded: 2,
            carryAwarded: 1,
            baseTokens: 1,
            isKapothi: false,
            isDefense: false,
        },
    });
    assert.equal(view.trickScore, '6 – 2');
    assert.equal(view.tokenAward, '+2 tokens');
    assert.match(view.carry, /1 base \+ 1 carry/);
    assert.equal(view.nextDealer, 'You');
});

test('match result view exposes final score, hands and Kapothis', () => {
    const state = createInitialState();
    state.matchOver = true;
    state.tokens = [10, 7];
    state.handNumber = 6;
    const view = matchResultView({
        state,
        stats: { kaputhis: [1, 0], startedAt: Date.now() - 120000 },
    });
    assert.equal(view.winnerTeam, 0);
    assert.equal(view.finalScore, '10 – 7');
    assert.equal(view.handsPlayed, 6);
    assert.deepEqual(view.kapothis, [1, 0]);
});

test('hint preserves trump when non-trump lead card is sufficient to win', () => {
    const state = createInitialState();
    state.phase = PHASE.PLAYING;
    state.trump = 'Spades';
    state.turnIndex = PLAYER.SOUTH;
    state.hands[PLAYER.SOUTH] = [new Card('Hearts', '8'), new Card('Spades', '7')];
    state.currentTrick = [
        { player: PLAYER.EAST, card: new Card('Hearts', '7') },
    ];
    const hint = buildHumanHint(state, PLAYER.SOUTH);
    // 8 of Hearts has strength 1 (beats 7 of Hearts lead); 7 of Spades has strength 100.
    // The hint should recommend 8 of Hearts, preserving the trump.
    assert.equal(hint.cardId, '8-Hearts');
});

test('hint discards non-trump before wasting trump when unable to win', () => {
    const state = createInitialState();
    state.phase = PHASE.PLAYING;
    state.trump = 'Spades';
    state.turnIndex = PLAYER.SOUTH;
    state.hands[PLAYER.SOUTH] = [new Card('Diamonds', '8'), new Card('Spades', '7')];
    // East led Clubs A, West trumped with Spades A
    state.currentTrick = [
        { player: PLAYER.EAST, card: new Card('Clubs', 'A') },
        { player: PLAYER.WEST, card: new Card('Spades', 'A') },
    ];
    const hint = buildHumanHint(state, PLAYER.SOUTH);
    // South is void in Clubs. 7 of Spades cannot beat Ace of Spades.
    // Hint should recommend discarding 8 of Diamonds instead of wasting 7 of Spades.
    assert.equal(hint.cardId, '8-Diamonds');
});


