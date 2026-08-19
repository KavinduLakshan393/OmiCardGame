import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('main menu exposes persistent motion settings and conditional Continue Match', () => {
    const html = read('../main-menu.html');
    assert.match(html, /id="continue-match-link"/);
    assert.match(html, /id="animation-speed-setting"/);
    assert.match(html, /id="reduced-motion-setting"/);

    const js = read('../src/ui/main-menu.js');
    assert.match(js, /loadSettings/);
    assert.match(js, /loadGame/);
});

test('game page exposes fair hint and complete result dialogs', () => {
    const html = read('../game.html');
    for (const id of [
        'hint-btn', 'hint-popover', 'hand-result-overlay', 'hand-result-tricks',
        'hand-result-tokens', 'hand-result-dealer', 'match-final-score',
        'match-hands-played', 'match-kapothis', 'match-duration',
    ]) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
});

test('Patch 12 audio and storage remain outside the rules engine', () => {
    const engine = read('../src/engine/GameEngine.js');
    assert.doesNotMatch(engine, /AudioContext|localStorage|document\.|window\./);
    const script = read('../script.js');
    assert.match(script, /AudioManager/);
    assert.match(script, /persistActiveMatch/);
    assert.match(script, /buildHumanHint/);
});

test('result and motion styles are composed into gameplay CSS', () => {
    const css = read('../style.css');
    assert.match(css, /styles\/results\.css/);
    const resultCss = read('../styles/results.css');
    assert.match(resultCss, /result-score-grid/);
    assert.match(resultCss, /hint-popover/);
});
