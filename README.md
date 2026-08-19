# Omi Card Game

A browser-based implementation of the Sri Lankan partnership trick-taking card game Omi.

## Single Player v1.0.0

This repository contains the completed **Single Player v1** scope from implementation-plan Patches **0–19**. The release focuses on accurate Standard Omi rules, a reusable authoritative game engine, fair AI, a polished responsive interface, accessibility, persistence and release-grade regression coverage.

### Included in v1

- Standard 32-card Omi rules using ranks 7 through Ace;
- compulsory trump selection after the first four cards;
- counter-clockwise deal and play;
- caller/defender/Kapothi scoring, 4–4 carry and 10-token match target;
- pure authoritative `GameEngine` with action/event contracts and serializable sessions;
- one human player plus three fair-information AI players;
- Casual and Smart AI difficulties;
- Main Menu and complete 11-step Tutorial;
- responsive premium game table and production card renderer;
- presentation-only deal, play and trick-collection animations;
- persistent sound, speed, motion and AI settings;
- save/continue match across supported game phases;
- fair Hint system and Previous Trick viewer;
- hand-result and match-result flows with statistics;
- keyboard, touch, focus-management, reduced-motion and forced-colors hardening;
- deterministic full-match regression tests and static release QA.

Joker, pass-trump and other house-rule variations remain intentionally excluded from Standard Mode.

## Application routes

```text
user-owned welcome.html
        ↓
main-menu.html
   ├── tutorial.html
   ├── game.html
   └── game.html?resume=1   (only when a valid active save exists)
```

The repository currently keeps `index.html` as a neutral compatibility entry that redirects to `main-menu.html`. The final cinematic Welcome page is maintained separately by the user and only needs to preserve the `main-menu.html` routing contract. See `docs/welcome-routing-contract.md`.

## Architecture

```text
UI / Presentation
       ↓
SinglePlayerController
       ↓
GameEngine
       ↑
Fair AI strategies
```

The authoritative engine remains independent from DOM, CSS, Web Audio, browser storage and presentation timers. Game rules are therefore testable without a browser and remain suitable for a future server-authoritative multiplayer controller.

## Project structure

```text
index.html                       Neutral fallback entry → Main Menu
main-menu.html                   Navigation, Continue Match and Settings
tutorial.html                    11-step Standard Omi tutorial
game.html                        Single-player game table
script.js                        Single Player v1 presentation integration
style.css                        Gameplay stylesheet entry point
styles/                          Shared design, cards, table, animation and accessibility CSS
src/engine/                      Authoritative rules/actions/events/state/session
src/controllers/                 Single-player orchestration
src/ai/                          Fair-information AI strategies
src/audio/                       Browser presentation audio
src/storage/                     Settings and active-match persistence
src/ui/                          Rendering, motion, focus, hints and result helpers
scripts/check.mjs                JavaScript syntax verification
scripts/qa.mjs                   Static release/architecture QA
tests/                           Node automated regression suite
docs/release-qa.md               Required manual browser/device QA
docs/single-player-v1-release.md Release scope and boundary
```

## Requirements

- Modern browser with ES module support
- Node.js 20+ for automated verification

## Run locally

Serve the project over HTTP rather than opening the HTML files directly:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Release verification

Run the complete automated release gate:

```bash
npm run verify
```

This runs syntax checks, the full Node test suite and static release QA.

Manual browser/device verification is also required before merging or tagging a release. Follow:

```text
docs/release-qa.md
```

## Release boundary

**Single Player v1 is feature-complete.** Do not add further single-player features during release hardening unless they fix a verified defect.

The next planned product phase is online multiplayer. Multiplayer should reuse the existing rules model with a server-authoritative controller/transport rather than duplicating or rewriting Omi rules in the browser.
