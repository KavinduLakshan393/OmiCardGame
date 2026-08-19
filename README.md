# Omi Card Game

A browser-based implementation of the Sri Lankan partnership trick-taking card game Omi.

## Batch 3 status

The current branch now contains implementation-plan Patches 0–8.

### Product/navigation foundation

- neutral repository entry (`index.html`) routes to the Main Menu until the user-owned Welcome page is added;
- `main-menu.html` provides Play Solo, Tutorial and Settings;
- `game.html` is the existing playable single-player table;
- `tutorial.html` provides the complete 11-step Standard Omi tutorial;
- Tutorial completion is recorded locally and surfaced in the Main Menu;
- Main Menu Casual/Smart difficulty and initial sound selections are passed into a solo match.

### Design foundation

- shared design tokens, spacing, motion and colour variables;
- Cormorant Garamond for menu/tutorial display typography;
- Manrope for application UI;
- Barlow Condensed for gameplay display labels/scores;
- Georgia for card typography;
- legacy game CSS extracted from HTML into a dedicated stylesheet;
- reduced-motion browser preference respected globally.

### Single-player architecture from Batches 1–2

- explicit engine actions and serializable domain events;
- stable `cardId`-based play commands;
- detached engine state snapshots;
- DOM-independent `SinglePlayerController`;
- controller-owned human/AI sequencing;
- Casual and Smart fair-information AI;
- public card tracking, partner awareness and known-void inference;
- 32-card Standard Omi rules with compulsory trump, 4–4 carry and 10-token target.

Joker and pass-trump remain intentionally excluded from Standard Mode.

## Application routes

```text
user-owned welcome.html
        ↓
main-menu.html
   ├── tutorial.html
   └── game.html
```

The final Welcome page is maintained separately by the user. See `docs/welcome-routing-contract.md`.

## Project structure

```text
index.html                       Neutral fallback entry → Main Menu
main-menu.html                   Main navigation hub
tutorial.html                    11-step Standard Omi tutorial
game.html                        Current playable single-player game
script.js                        Legacy gameplay presentation/audio hooks
style.css                        Gameplay stylesheet entry point
styles/                          Shared tokens, typography, menu/tutorial/game CSS
src/engine/                      Authoritative Omi rules/actions/events/state
src/controllers/                 Single-player orchestration
src/ai/                          Fair-information AI strategies
src/ui/                          Main Menu and Tutorial UI modules
scripts/check.mjs                Cross-platform JS syntax check
tests/                           Node built-in automated tests
docs/                            Batch/audit documentation
```

## Requirements

- Modern browser with ES module support
- Node.js 20+ for tests

## Run locally

Serve the project over HTTP:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

The fallback entry redirects to the Main Menu.

## Run tests

```bash
npm test
```

Run syntax checks:

```bash
npm run check
```

## Current development boundary

Batch 3 intentionally stops before the responsive game-table rebuild. Patch 9 is the next implementation step, followed by the production card component and gameplay animation system.
