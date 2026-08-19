import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM, scoreHand } from '../src/engine/index.js';

test('trump-calling team earns 1 token for 5-7 tricks', () => {
    const result = scoreHand({ teamTricks: [5, 3], callerTeam: TEAM.NS });
    assert.equal(result.winnerTeam, TEAM.NS);
    assert.equal(result.tokensAwarded, 1);
    assert.equal(result.isDefense, false);
});

test('defending team earns 2 tokens for 5-7 tricks', () => {
    const result = scoreHand({ teamTricks: [3, 5], callerTeam: TEAM.NS });
    assert.equal(result.winnerTeam, TEAM.EW);
    assert.equal(result.tokensAwarded, 2);
    assert.equal(result.isDefense, true);
});

test('Kapothi awards 3 base tokens to either team', () => {
    const result = scoreHand({ teamTricks: [0, 8], callerTeam: TEAM.NS });
    assert.equal(result.winnerTeam, TEAM.EW);
    assert.equal(result.baseTokens, 3);
    assert.equal(result.tokensAwarded, 3);
    assert.equal(result.isKapothi, true);
});

test('4-4 awards no immediate token and adds one carry token', () => {
    const result = scoreHand({ teamTricks: [4, 4], callerTeam: TEAM.NS, carryTokens: 0 });
    assert.equal(result.tied, true);
    assert.equal(result.tokensAwarded, 0);
    assert.equal(result.nextCarryTokens, 1);
});

test('carry tokens are added to the next decisive hand and then reset', () => {
    const result = scoreHand({ teamTricks: [6, 2], callerTeam: TEAM.NS, carryTokens: 2 });
    assert.equal(result.baseTokens, 1);
    assert.equal(result.carryAwarded, 2);
    assert.equal(result.tokensAwarded, 3);
    assert.equal(result.nextCarryTokens, 0);
});
