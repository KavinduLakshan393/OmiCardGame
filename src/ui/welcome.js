import { loadSettings } from '../storage/settings.js';
import { configureMotion, isReducedMotion } from './motion.js';

const REVEAL_TIME_SECONDS = 6.85;
const EXIT_DURATION_MS = 620;

const stage = document.getElementById('welcome-stage');
const video = document.getElementById('welcome-video');
const skipButton = document.getElementById('welcome-skip');
const startButton = document.getElementById('welcome-start');

configureMotion(loadSettings());

let ready = false;
let settled = false;
let leaving = false;

function revealHome() {
    if (ready) return;
    ready = true;
    stage.classList.add('is-ready');
    skipButton.hidden = true;
}

function settleOnPoster() {
    if (settled) return;
    settled = true;
    video.pause();
    stage.classList.add('is-settled');
}

function finishIntro() {
    revealHome();
    settleOnPoster();
}

function handlePlaybackProgress() {
    if (!ready && video.currentTime >= REVEAL_TIME_SECONDS) {
        revealHome();
    }
}

async function startIntro() {
    if (isReducedMotion()) {
        finishIntro();
        return;
    }

    try {
        // Explicit play() complements the autoplay attribute and gives us a
        // controlled fallback when a browser declines autoplay for any reason.
        await video.play();
    } catch {
        finishIntro();
    }
}

function skipIntro() {
    if (leaving) return;
    finishIntro();
}

function enterMainMenu(event) {
    event.preventDefault();
    if (leaving) return;

    leaving = true;
    startButton.setAttribute('aria-disabled', 'true');
    stage.classList.add('is-leaving');

    if (isReducedMotion()) {
        window.location.assign(startButton.href);
        return;
    }

    window.setTimeout(() => {
        window.location.assign(startButton.href);
    }, EXIT_DURATION_MS);
}

video.addEventListener('timeupdate', handlePlaybackProgress);
video.addEventListener('ended', finishIntro, { once: true });
video.addEventListener('error', finishIntro, { once: true });
skipButton.addEventListener('click', skipIntro);
startButton.addEventListener('click', enterMainMenu);

// A page restored from the browser's back-forward cache must never remain in
// the partially faded leaving state.
window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leaving = false;
    stage.classList.remove('is-leaving');
    startButton.removeAttribute('aria-disabled');
    finishIntro();
});

startIntro();
