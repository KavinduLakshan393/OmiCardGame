# Batch 2 — Implementation Notes

Batch 2 implements implementation-plan Patches 3, 4, and 5.

## Patch 3 — Action and Event Architecture

Added engine command modules:

```text
src/engine/actions.js
src/engine/events.js
src/engine/snapshot.js
```

`GameEngine.dispatch(action)` is now the preferred application integration surface.

Implemented commands:

```text
START_MATCH
START_NEXT_HAND
DEAL_NEXT_BATCH
SELECT_TRUMP
PLAY_CARD
COMPLETE_TRICK
SCORE_HAND
RESET_MATCH
```

Important design decisions:

- `PLAY_CARD` accepts stable card IDs instead of depending on UI array indices;
- engine actions validate the acting player and current game phase;
- successful transitions produce serializable domain events;
- returned state is a detached snapshot and cannot mutate authoritative state;
- the rules engine still contains no presentation timers.

Implemented domain events include:

```text
MATCH_STARTED
MATCH_RESET
HAND_STARTED
CARDS_DEALT
INITIAL_CARDS_DEALT
TRUMP_REQUIRED
TRUMP_SELECTED
DEAL_COMPLETED
CARD_PLAYED
TRICK_READY
TRICK_COMPLETED
HAND_TIED
TOKENS_AWARDED
HAND_COMPLETED
MATCH_COMPLETED
```

## Patch 4 — Single-Player Controller

Added:

```text
src/controllers/SinglePlayerController.js
```

The controller now owns:

- match/hand orchestration;
- first-four and second-four deal progression;
- human trump input boundary;
- AI trump decisions;
- human turn boundary;
- AI turn sequencing;
- trick completion sequencing;
- hand scoring transition;
- serialized action queue;
- presentation animation-completion hooks.

The controller does not access the DOM or Web Audio API.

The current `script.js` supplies presentation hooks and remains responsible for:

- rendering;
- audio;
- status text;
- visual delays;
- winner flash;
- overlays;
- statistics UI.

## Patch 5 — Fair AI Architecture

Added:

```text
src/ai/AIPlayer.js
src/ai/knowledge.js
src/ai/casualAI.js
src/ai/smartAI.js
src/ai/index.js
```

### Casual AI

- always chooses a legal card;
- intentionally low-complexity/random play;
- random trump choice.

### Smart AI

Preserves and formalizes useful prototype heuristics:

- suit-length/high-card trump selection;
- partner awareness;
- lowest winning card behaviour;
- avoids wasting trump when partner is already winning;
- high-trump leading when appropriate;
- public card counting;
- known void-suit inference from public off-suit plays.

### Hidden-information boundary

AI receives:

- its own hand;
- legal cards;
- trump;
- current public trick;
- completed public tricks;
- public played cards;
- score/hand context;
- publicly inferable void suits.

AI does **not** receive teammate or opponent hidden hands.

## UI integration

The legacy prototype UI is still intentionally retained until the later UI redesign patches, but game flow has moved away from direct engine mutation:

```text
DOM / UI
   ↓
SinglePlayerController
   ↓
GameEngine.dispatch(...)
   ↑
Fair AI strategy
```

## Verification

Batch 2 automated verification covers:

- action/event sequencing;
- detached state snapshots;
- card-ID play actions;
- wrong trump-caller rejection;
- AI hidden-information boundary;
- Casual AI legality;
- Smart trump selection;
- Smart partner-aware ducking;
- public void-suit inference;
- controller first-four pause for human trump;
- second deal + AI turn orchestration;
- complete controller-driven eight-trick hand and scoring;
- all Batch 1 rule tests.

Final Batch 2 automated result: **34 tests passed, 0 failed**.

`npm run check` also validates syntax for `script.js` and all JavaScript files under `src/`.
