# Omi Card Game

A browser-based implementation of the Sri Lankan partnership trick-taking card game Omi.

## Batch 2 status

The current branch now contains the single-player architecture defined by implementation-plan Patches 3, 4, and 5 on top of the Batch 1 standard-rules engine.

Implemented foundations:

- explicit engine actions and serializable domain events;
- stable `cardId`-based play commands suitable for future networking;
- detached engine state snapshots for controller/AI consumers;
- dedicated DOM-independent `SinglePlayerController`;
- controller-owned human/AI turn sequencing and animation-completion hooks;
- extracted Casual and Smart AI strategies;
- fair AI knowledge views that expose no hidden teammate/opponent hands;
- public card tracking, partner awareness, and known-void-suit inference;
- the existing prototype UI now talks to the controller instead of directly running AI/game-flow transitions.

Standard Omi foundations from Batch 1 remain unchanged:

- 32-card deck: 7 through Ace in all four suits;
- counter-clockwise deal and play;
- dealer-right compulsory trump selection after the first four cards;
- second four-card batch after trump;
- standard follow-suit and trick rules;
- 10-token match target;
- caller 5–7 tricks: 1 token;
- defenders 5–7 tricks: 2 tokens;
- Kapothi: 3 tokens;
- 4-4: no immediate award, with carry to the next decisive hand.

Joker and pass-trump remain intentionally excluded from Standard Mode.

## Project structure

```text
index.html                       Current prototype UI / game entry
script.js                        Presentation, audio, DOM rendering, animation hooks
src/engine/                      Authoritative Omi rules, actions, events and state
src/controllers/                 Single-player orchestration
src/ai/                          Fair-information AI strategies and knowledge model
scripts/check.mjs                Cross-platform project syntax check
tests/                           Node built-in automated tests
docs/                            Batch/audit documentation
style.css                        Reserved for later CSS extraction
```

## Requirements

- Modern browser with ES module support
- Node.js 20+ for tests

## Run locally

Serve the directory over HTTP instead of opening `index.html` with `file://`.

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

## Run tests

No npm dependencies are required.

```bash
npm test
```

Run syntax checks across `script.js` and all `src/**/*.js` files:

```bash
npm run check
```

## Welcome / Main Menu

The basic Welcome page is maintained separately by the user. Main Menu integration remains scheduled for Patch 6, followed by the complete Tutorial in Patch 7. See `docs/welcome-routing-contract.md`.
