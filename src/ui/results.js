import { PLAYER_NAMES } from '../engine/constants.js';

function teamName(team) {
    return team === 0 ? 'Your Team' : 'Opponents';
}

export function handResultView({ result, state }) {
    if (!result || !state) throw new TypeError('result and state are required');

    if (result.tied) {
        return {
            eyebrow: 'Hand Complete',
            title: '4–4 Draw',
            tone: 'tie',
            trickScore: `${state.teamTricks[0]} – ${state.teamTricks[1]}`,
            tokenAward: 'No tokens awarded',
            carry: `${result.nextCarryTokens} carry token${result.nextCarryTokens === 1 ? '' : 's'} now waiting`,
            nextDealer: PLAYER_NAMES[state.dealerIndex],
            summary: 'The carry will be added to the next decisive hand.',
        };
    }

    const winner = teamName(result.winnerTeam);
    const detail = result.isKapothi
        ? 'Kapothi — all 8 tricks'
        : result.isDefense
            ? 'Successful defense'
            : 'Trump team victory';

    return {
        eyebrow: 'Hand Complete',
        title: result.isKapothi ? 'Kapothi!' : `${winner} win`,
        tone: result.winnerTeam === 0 ? 'win' : 'loss',
        trickScore: `${state.teamTricks[0]} – ${state.teamTricks[1]}`,
        tokenAward: `+${result.tokensAwarded} token${result.tokensAwarded === 1 ? '' : 's'}`,
        carry: result.carryAwarded > 0
            ? `${result.baseTokens} base + ${result.carryAwarded} carry`
            : `${result.baseTokens} base token${result.baseTokens === 1 ? '' : 's'}`,
        nextDealer: PLAYER_NAMES[state.dealerIndex],
        summary: detail,
    };
}

export function matchResultView({ state, stats }) {
    if (!state?.matchOver) throw new TypeError('match result requires a completed match');
    const winnerTeam = state.tokens[0] >= state.matchTokenTarget ? 0 : 1;
    const elapsedMs = Math.max(0, Date.now() - (stats?.startedAt ?? Date.now()));
    const totalMinutes = Math.max(1, Math.round(elapsedMs / 60000));

    return {
        winnerTeam,
        eyebrow: winnerTeam === 0 ? 'Victory' : 'Match Complete',
        title: winnerTeam === 0 ? 'Your Team Wins' : 'Opponents Win',
        finalScore: `${state.tokens[0]} – ${state.tokens[1]}`,
        handsPlayed: state.handNumber,
        kapothis: [stats?.kaputhis?.[0] ?? 0, stats?.kaputhis?.[1] ?? 0],
        duration: `${totalMinutes} min`,
    };
}
