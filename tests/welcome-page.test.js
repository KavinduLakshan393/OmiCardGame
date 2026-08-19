import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Welcome page ships the supplied intro media and final-frame poster', () => {
    for (const path of [
        'assets/video/omi-intro.mp4',
        'assets/video/omi-intro-poster.jpg',
        'styles/welcome.css',
        'src/ui/welcome.js',
    ]) {
        assert.equal(existsSync(path), true, `${path} should exist`);
        assert.ok(statSync(path).size > 0, `${path} should not be empty`);
    }
});

test('Welcome page exposes the required title and Tap to Start CTA', () => {
    const html = read('index.html');
    assert.match(html, /<h1 class="welcome-title" id="welcome-title">Omi<\/h1>/);
    assert.match(html, /<span>Tap to Start<\/span>/);
    assert.match(html, /id="welcome-start" href="main-menu\.html"/);
    assert.match(html, /A Sri Lankan card game/);
});

test('intro video is autoplay-safe and has a static fallback', () => {
    const html = read('index.html');
    assert.match(html, /<video[\s\S]*\bautoplay\b/);
    assert.match(html, /<video[\s\S]*\bmuted\b/);
    assert.match(html, /<video[\s\S]*\bplaysinline\b/);
    assert.match(html, /poster="assets\/video\/omi-intro-poster\.jpg"/);
    assert.match(html, /<noscript>/);
});

test('Welcome controller can reveal, skip and transition without game dependencies', () => {
    const source = read('src/ui/welcome.js');
    assert.match(source, /REVEAL_TIME_SECONDS\s*=\s*6\.85/);
    assert.match(source, /function finishIntro\(\)/);
    assert.match(source, /skipButton\.addEventListener\('click', skipIntro\)/);
    assert.match(source, /window\.location\.assign\(startButton\.href\)/);
    assert.doesNotMatch(source, /GameEngine|SinglePlayerController|AIPlayer/);
});

test('Welcome CSS supports portrait video containment and reduced motion', () => {
    const css = read('styles/welcome.css');
    assert.match(css, /@media \(orientation: portrait\)/);
    assert.match(css, /\.welcome-video\s*\{[\s\S]*object-fit:\s*contain/);
    assert.match(css, /html\[data-motion="reduced"\]/);
});
