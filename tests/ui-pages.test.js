import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Batch 3 application pages exist', () => {
    for (const path of ['index.html', 'main-menu.html', 'tutorial.html', 'game.html']) {
        assert.equal(existsSync(path), true, `${path} should exist`);
    }
});

test('index provides the cinematic Welcome page and routes Tap to Start to main menu', () => {
    const html = read('index.html');
    assert.match(html, /id="welcome-video"/);
    assert.match(html, /assets\/video\/omi-intro\.mp4/);
    assert.match(html, /id="welcome-title">Omi<\/h1>/);
    assert.match(html, /id="welcome-start" href="main-menu\.html"/);
    assert.doesNotMatch(html, /http-equiv="refresh"/);
});

test('main menu routes Play Solo and Tutorial correctly', () => {
    const html = read('main-menu.html');
    assert.match(html, /id="play-solo-link"[^>]+href="game\.html"/);
    assert.match(html, /id="tutorial-link"[^>]+href="tutorial\.html"/);
    assert.match(html, /id="settings-menu-button"/);
});

test('game page uses extracted stylesheet and ES-module gameplay entry', () => {
    const html = read('game.html');
    assert.match(html, /href="style\.css"/);
    assert.match(html, /type="module" src="script\.js"/);
    assert.doesNotMatch(html, /<style>/);
});

test('shared design-system files are present', () => {
    for (const path of [
        'styles/tokens.css',
        'styles/base.css',
        'styles/typography.css',
        'styles/menu.css',
        'styles/tutorial.css',
        'styles/game-legacy.css',
    ]) {
        assert.equal(existsSync(path), true, `${path} should exist`);
    }

    const tokens = read('styles/tokens.css');
    assert.match(tokens, /--font-ui:/);
    assert.match(tokens, /--font-display:/);
    assert.match(tokens, /--font-card:/);
    assert.match(tokens, /--table-felt:\s*#0b5b3a/i);
    assert.match(tokens, /--accent-gold:\s*#e8c46a/i);
});
