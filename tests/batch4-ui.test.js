import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createCardElement, createMiniCardElement } from '../src/ui/cardRenderer.js';
import { SUITS, RANKS } from '../src/engine/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('production 32-card artwork image assets are present for all suits and ranks', () => {
    assert.equal(typeof createCardElement, 'function');
    assert.equal(typeof createMiniCardElement, 'function');

    for (const suit of SUITS) {
        const suitInitial = suit.charAt(0).toUpperCase();
        for (const rank of RANKS) {
            const assetPath = join(__dirname, '..', 'assets', 'cards', `${suitInitial}${rank}.png`);
            assert.ok(existsSync(assetPath), `Missing card artwork image: ${suitInitial}${rank}.png`);
        }
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

test('playing-card renderer uses production card artwork and creates card elements', () => {
    const renderer = read('../src/ui/cardRenderer.js');
    assert.doesNotMatch(renderer, /♔|♕|♘/);
    assert.match(renderer, /assets\/cards/);
    assert.match(renderer, /createCardElement/);
    assert.match(renderer, /createMiniCardElement/);
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

