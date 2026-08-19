# Omi Card Game

A browser-based implementation of the Sri Lankan partnership trick-taking card game Omi.

## Batch 5 status

The current branch contains implementation-plan Patches **0–15**.

### Product experience

- neutral repository entry (`index.html`) routes to the Main Menu until the user-owned Welcome page is added;
- Main Menu provides Play Solo, Continue Match, Tutorial and persistent Settings;
- complete 11-step Standard Omi tutorial;
- responsive premium game table and production card renderer;
- presentation-only deal/play/trick animations;
- fair-play Hint system and richer Previous Trick view;
- dedicated hand-result and match-result dialogs.

### Persistent settings and save/resume

- Smart/Casual AI difficulty;
- Sound On/Off;
- Relaxed/Normal/Fast presentation speed;
- System/Reduced/Full motion preference;
- versioned local save record;
- strict engine-session validation and card rehydration;
- conditional Continue Match menu action;
- resume support across deal, trump, trick-play, hand-scoring and hand-complete boundaries;
- corrupt/completed saves are discarded safely.

### Architecture

- 32-card Standard Omi rules with compulsory trump, 4–4 carry and 10-token target;
- pure authoritative `GameEngine` with serializable actions/events/state;
- DOM-independent `SinglePlayerController`;
- Casual and Smart AI constrained to fair/public information;
- dedicated `AudioManager`, storage modules, motion configuration and UI helpers;
- rules engine remains free of DOM, audio, browser-storage and animation dependencies.

Joker and pass-trump remain intentionally excluded from Standard Mode.

## Application routes

```text
user-owned welcome.html
        ↓
main-menu.html
   ├── tutorial.html
   ├── game.html
   └── game.html?resume=1   (only when an active save exists)
```

The final Welcome page is maintained separately by the user. See `docs/welcome-routing-contract.md`.

## Project structure

```text
index.html                       Neutral fallback entry → Main Menu
main-menu.html                   Navigation, Continue Match and Settings
tutorial.html                    11-step Standard Omi tutorial
game.html                        Single-player table
script.js                        Gameplay presentation integration
style.css                        Gameplay stylesheet entry point
styles/                          Shared tokens, table/cards/animation/results CSS
src/engine/                      Authoritative rules/actions/events/state/session
src/controllers/                 Single-player orchestration
src/ai/                          Fair-information AI strategies
src/audio/                       Browser presentation audio
src/storage/                     Settings and active-match persistence
src/ui/                          UI rendering, hints, results and motion helpers
scripts/check.mjs                Cross-platform JS syntax check
tests/                           Node built-in automated tests
docs/                            Batch/audit documentation
```

## Requirements

- Modern browser with ES module support
- Node.js 20+ for tests

## Run locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Verification

```bash
npm test
npm run check
```

## Next development boundary

Batch 5 completes feature Patches 12–15. The remaining release-hardening work is:

- Patch 16 — expanded automated regression coverage;
- Patch 17 — responsive/accessibility QA;
- Patch 18 — release-candidate freeze and fixes;
- Patch 19 — Single Player v1 release.
