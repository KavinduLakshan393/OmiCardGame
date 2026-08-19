# Omi Card Game

A browser-based implementation of the Sri Lankan partnership trick-taking card game Omi.

## Batch 1 status

The project now uses a pure rules/state engine under `src/engine/` while retaining the current prototype UI.

Implemented standard-mode foundations:

- 32-card deck: 7 through Ace in all four suits;
- four fixed partnership players;
- counter-clockwise deal and play;
- dealer-right trump selection after the first four cards;
- mandatory trump selection;
- second four-card batch after trump;
- standard follow-suit and trick rules;
- 10-token match target;
- caller 5–7 tricks: 1 token;
- defenders 5–7 tricks: 2 tokens;
- Kapothi: 3 tokens;
- 4-4: no immediate award, with carry to the next decisive hand.

Joker and pass-trump are intentionally not part of Standard Mode.

## Project structure

```text
index.html              Current prototype UI / game entry
script.js               Legacy presentation/controller and AI timing
src/engine/             Pure Omi rules and state engine
tests/                  Node built-in test suite
docs/                   Batch/audit documentation
style.css                Reserved for later CSS extraction
```

## Requirements

- Modern browser with ES module support
- Node.js 20+ for tests

## Run locally

Because `script.js` now uses native ES modules, serve the directory over HTTP instead of opening `index.html` directly with `file://`.

For example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Run tests

No npm dependencies are required.

```bash
npm test
```

Optional syntax check:

```bash
npm run check
```

## Welcome / Main Menu

The basic Welcome page is maintained separately by the user. Main Menu integration is scheduled for Patch 6. See `docs/welcome-routing-contract.md`.
