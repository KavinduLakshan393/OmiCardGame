# Batch 1 — Implementation Notes

Batch 1 covers implementation-plan Patches 0, 1, and 2.

## Patch 0 — Baseline Protection and Preparation

Completed:

- recorded checksums for the attached baseline files;
- documented current route and state structure;
- documented mixed rule/UI/AI responsibilities;
- documented the Welcome page integration contract;
- retained the current `index.html` entry point to avoid premature routing changes.

## Patch 1 — Traditional Omi Rules Correction

Completed:

- standard 32-card deck only;
- Joker removed from Standard Mode;
- trump passing removed from Standard Mode;
- match target changed to 10 tokens;
- Kapothi corrected to 3 base tokens;
- 4-4 corrected to no immediate award plus one carry token;
- carry is accumulated across repeated ties and applied to the next decisive hand;
- first four cards are dealt in four-card batches;
- trump is selected after the first four cards;
- final four cards are then dealt in four-card batches;
- play and dealer rotation normalized to counter-clockwise/right rotation;
- trump caller is the player to the dealer's right;
- trick winner leads the next trick;
- initial dealer is West so the existing human player (South) selects trump in the first hand while remaining rules-correct.

## Patch 2 — Pure Rules Engine Extraction

Added `src/engine/`:

```text
constants.js
cards.js
deck.js
players.js
rules.js
trick.js
scoring.js
state.js
GameEngine.js
index.js
```

The engine contains no:

- DOM access;
- CSS knowledge;
- Web Audio calls;
- confetti calls;
- animation timers.

The legacy `script.js` now acts as a presentation/controller layer and imports the engine as an ES module.

## Deliberately deferred

The following are **not** part of Batch 1:

- action/event dispatch architecture — Patch 3;
- dedicated `SinglePlayerController` — Patch 4;
- fair-knowledge AI module extraction — Patch 5;
- Main Menu — Patch 6;
- complete Tutorial — Patch 7;
- typography/UI redesign — Patch 8 onward.

## Verification completed

Automated tests cover:

- 32-card deck;
- deterministic injected RNG;
- counter-clockwise seat order;
- dealer-right trump caller;
- two-stage four-card dealing;
- follow-suit legality;
- trump trick resolution;
- caller scoring;
- defender scoring;
- Kapothi;
- 4-4 carry;
- dealer rotation;
- trick winner leading next.

Final automated verification for this Batch 1 delivery: **22 tests passed, 0 failed** using Node's built-in test runner.
