import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_PIP_LAYOUTS } from '../src/ui/cardRenderer.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('production number-card pip layouts contain the correct pip count', () => {
    for (const rank of ['7', '8', '9', '10']) {
        assert.equal(CARD_PIP_LAYOUTS[rank].length, Number(rank));
    }
});

test('game page exposes responsive four-seat table and previous-trick control', () => {
    const html = read('../game.html');
    for (const id of ['player-0', 'player-1', 'player-2', 'player-3', 'trick-table', 'previous-trick-btn']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    assert.doesNotMatch(html, /id=["']log-toggle-btn["']/);
    assert.doesNotMatch(html, /id=["']log-sidebar["']/);
});

test('game stylesheet composes table, cards and animation layers', () => {
    const css = read('../style.css');
    assert.match(css, /styles\/table\.css/);
    assert.match(css, /styles\/cards\.css/);
    assert.match(css, /styles\/animations\.css/);
    assert.doesNotMatch(css, /game-legacy\.css/);
});

test('playing-card renderer no longer uses chess-piece placeholders', () => {
    const renderer = read('../src/ui/cardRenderer.js');
    assert.doesNotMatch(renderer, /♔|♕|♘/);
    assert.match(renderer, /createCourtArt/);
    assert.match(renderer, /pip-grid/);
});

test('gameplay animation helpers remain outside the engine', () => {
    const animations = read('../src/ui/animations.js');
    assert.match(animations, /animateCardPlay/);
    assert.match(animations, /animateTrickCollection/);
    const engine = read('../src/engine/GameEngine.js');
    assert.doesNotMatch(engine, /animateCardPlay|animateTrickCollection|document\.|window\./);
});

test('mobile gameplay includes coarse-pointer two-tap selection support', () => {
    const script = read('../script.js');
    assert.match(script, /pointer: coarse/);
    assert.match(script, /selectedCardIndex/);
    assert.match(script, /Tap again to play/);
});
