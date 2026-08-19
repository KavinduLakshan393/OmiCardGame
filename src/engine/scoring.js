import { TEAM, TRICKS_PER_HAND } from './constants.js';

function assertTeam(team) {
    if (team !== TEAM.NS && team !== TEAM.EW) {
        throw new RangeError(`Invalid team: ${team}`);
    }
}

/**
 * Score one completed Omi hand.
 *
 * A 4-4 hand transfers no tokens immediately. Each tied hand contributes one
 * carry token, which is added to the next decisive hand. Carry is then reset.
 */
export function scoreHand({ teamTricks, callerTeam, carryTokens = 0 }) {
    if (!Array.isArray(teamTricks) || teamTricks.length !== 2) {
        throw new TypeError('teamTricks must contain exactly two values');
    }
    if (!teamTricks.every(Number.isInteger) || teamTricks.some(value => value < 0)) {
        throw new RangeError('teamTricks must contain non-negative integers');
    }
    if (teamTricks[0] + teamTricks[1] !== TRICKS_PER_HAND) {
        throw new RangeError(`A completed hand must contain exactly ${TRICKS_PER_HAND} tricks`);
    }
    assertTeam(callerTeam);
    if (!Number.isInteger(carryTokens) || carryTokens < 0) {
        throw new RangeError('carryTokens must be a non-negative integer');
    }

    if (teamTricks[0] === 4 && teamTricks[1] === 4) {
        return {
            tied: true,
            winnerTeam: null,
            isKapothi: false,
            isDefense: false,
            baseTokens: 0,
            carryAwarded: 0,
            tokensAwarded: 0,
            nextCarryTokens: carryTokens + 1,
        };
    }

    const winnerTeam = teamTricks[0] > 4 ? TEAM.NS : TEAM.EW;
    const winningTricks = teamTricks[winnerTeam];
    const isKapothi = winningTricks === TRICKS_PER_HAND;
    const isDefense = winnerTeam !== callerTeam;
    const baseTokens = isKapothi ? 3 : (isDefense ? 2 : 1);

    return {
        tied: false,
        winnerTeam,
        isKapothi,
        isDefense,
        baseTokens,
        carryAwarded: carryTokens,
        tokensAwarded: baseTokens + carryTokens,
        nextCarryTokens: 0,
    };
}
