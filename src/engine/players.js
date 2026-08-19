import { PLAYER_COUNT, TEAM } from './constants.js';

function assertPlayerIndex(playerIndex) {
    if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= PLAYER_COUNT) {
        throw new RangeError(`Invalid player index: ${playerIndex}`);
    }
}

/** Move one seat counter-clockwise around the table. */
export function nextCounterClockwise(playerIndex) {
    assertPlayerIndex(playerIndex);
    return (playerIndex + PLAYER_COUNT - 1) % PLAYER_COUNT;
}

/** In standard Omi, the player to the dealer's right selects trump and leads. */
export function playerToDealerRight(dealerIndex) {
    return nextCounterClockwise(dealerIndex);
}

/** Return all seats in counter-clockwise deal/play order, beginning to dealer's right. */
export function dealOrderFromDealer(dealerIndex) {
    assertPlayerIndex(dealerIndex);
    const order = [];
    let player = playerToDealerRight(dealerIndex);
    for (let i = 0; i < PLAYER_COUNT; i += 1) {
        order.push(player);
        player = nextCounterClockwise(player);
    }
    return order;
}

export function teamOf(playerIndex) {
    assertPlayerIndex(playerIndex);
    return playerIndex === 0 || playerIndex === 2 ? TEAM.NS : TEAM.EW;
}

export function partnerOf(playerIndex) {
    assertPlayerIndex(playerIndex);
    return (playerIndex + 2) % PLAYER_COUNT;
}
