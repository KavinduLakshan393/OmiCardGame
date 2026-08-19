import { chooseCasualCard, chooseCasualTrump } from './casualAI.js';
import { chooseSmartCard, chooseSmartTrump } from './smartAI.js';

export const AI_DIFFICULTY = Object.freeze({
    CASUAL: 'CASUAL',
    SMART: 'SMART',
});

function assertDifficulty(difficulty) {
    if (!Object.values(AI_DIFFICULTY).includes(difficulty)) {
        throw new RangeError(`Unsupported AI difficulty: ${difficulty}`);
    }
}

/**
 * Small strategy facade used by the controller.
 * The AI receives a fair knowledge view and returns declarative decisions;
 * it never receives the engine or manipulates the DOM/state itself.
 */
export class AIPlayer {
    constructor({ difficulty = AI_DIFFICULTY.SMART, rng = Math.random } = {}) {
        assertDifficulty(difficulty);
        if (typeof rng !== 'function') throw new TypeError('AI rng must be a function');
        this.difficulty = difficulty;
        this.rng = rng;
    }

    setDifficulty(difficulty) {
        assertDifficulty(difficulty);
        this.difficulty = difficulty;
    }

    chooseTrump(knowledge) {
        return this.difficulty === AI_DIFFICULTY.CASUAL
            ? chooseCasualTrump(knowledge, this.rng)
            : chooseSmartTrump(knowledge);
    }

    chooseCard(knowledge) {
        return this.difficulty === AI_DIFFICULTY.CASUAL
            ? chooseCasualCard(knowledge, this.rng)
            : chooseSmartCard(knowledge);
    }
}
