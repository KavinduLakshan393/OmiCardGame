import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('human cards use native button controls without mutating authoritative hand order', () => {
    const script = read('script.js');
    assert.match(script, /createElement\(playerId === 0 \? 'button' : 'div'\)/);
    assert.match(script, /wrapper\.setAttribute\('aria-label'/);
    assert.match(script, /wrapper\.disabled = !legal/);
    assert.doesNotMatch(script, /state\.hands\[0\]\.sort\s*\(/);
});

test('game helper controls expose popover relationships and skip target is focusable', () => {
    const html = read('game.html');
    assert.match(html, /id="hint-btn"[^>]+aria-controls="hint-popover"[^>]+aria-expanded="false"/);
    assert.match(html, /id="previous-trick-btn"[^>]+aria-controls="previous-trick-popover"[^>]+aria-expanded="false"/);
    assert.match(html, /id="p0-hand"[^>]+tabindex="-1"/);
    assert.match(html, /<caption class="visually-hidden">Tricks won by player<\/caption>/);
});

test('modal focus trap is shared by game and main menu', () => {
    assert.equal(existsSync('src/ui/focusTrap.js'), true);
    assert.match(read('script.js'), /activateFocusTrap/);
    assert.match(read('src/ui/main-menu.js'), /activateFocusTrap/);
});

test('motion preference is applied to welcome, main menu, tutorial and gameplay', () => {
    assert.match(read('src/ui/welcome.js'), /configureMotion\(loadSettings\(\)\)/);
    assert.match(read('src/ui/main-menu.js'), /configureMotion\(preferences\)/);
    assert.match(read('src/ui/tutorial.js'), /configureMotion\(loadSettings\(\)\)/);
    assert.match(read('script.js'), /configureMotion\(settings\)/);
    assert.match(read('styles/base.css'), /html\[data-motion="reduced"\]/);
    assert.match(read('styles/base.css'), /html:not\(\[data-motion="full"\]\)/);
});

test('game stylesheet contains explicit keyboard card focus treatment', () => {
    const entry = read('style.css');
    const css = read('styles/accessibility.css');
    assert.match(entry, /styles\/accessibility\.css/);
    assert.match(css, /\.card-control:focus-visible \.card/);
    assert.match(css, /forced-colors: active/);
});
