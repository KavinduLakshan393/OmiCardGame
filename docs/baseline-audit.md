# Omi Prototype — Baseline Audit for Batch 1

This audit captures the attached `Omi(1).zip` state before Batch 1 changes.
It is intended to make later refactors traceable and reversible.

## Original files

| File | SHA-256 |
|---|---|
| `README.md` | `f7d4bcdf60a321ab5ed6c3b0aafa4c11679cacc2bce76be926c02ee30cc46802` |
| `index.html` | `91d0e05c69eea95b4a7fc6186e2f1a80bcfd59f53f169beb5957e66f60cb8f35` |
| `script.js` | `cf6dee45e83aa622506eeb1a1ce8edcad3a8ded1f2d476caec0c20ab01ef3619` |
| `style.css` | `3eea2eee80a8886534260a86c2b21fdd0d6fc4830cc03b5342b2019c2952382a` |

The uploaded ZIP does not contain `.git` metadata, so branch history cannot be audited from the archive itself.

## Existing route / entry point

The prototype contains one application page:

```text
index.html
  └── script.js
```

`style.css` exists but is intentionally empty. The current UI CSS is embedded in `index.html`.

The Welcome and Main Menu pages from the implementation plan are not present in this ZIP. They remain future integration points; the user is maintaining the basic Welcome page separately.

## Existing player mapping

The prototype uses numeric seat IDs:

```text
0 = South / Human / You
1 = West / AI opponent
2 = North / AI partner
3 = East / AI opponent
```

Partnerships are:

```text
North + South = Team 0 / NS
East + West   = Team 1 / EW
```

## Original state object

Before Batch 1, the single global `state` object combines rules, presentation state, settings, statistics, and logging:

```text
hands
teamTricks
trump
trumpCaller
trumpPassChain
currentTrick
turnIndex
dealerIndex
processing
dealing
playedCards
trickHistory
tokens
matchTokenTarget
matchOver
roundCount
jokerEnabled
muted
stats
gameLog
deck
```

## Original rules-related behaviour

The baseline implementation contained the following non-standard behaviour relative to the approved implementation plan:

- optional Joker support;
- 33-card deck when Joker was enabled;
- trump pass chain;
- 8-token match target;
- Kapothi worth 2 tokens;
- 4-4 treated as a defending win instead of a carry;
- clockwise `+1` seat progression;
- dealer rotation using `+1`;
- trump caller calculated using `dealer + 1`;
- cards visually dealt one card at a time rather than four-card batches.

## Existing rule / AI functions

Rules and AI were mixed into `script.js`, including:

```text
getCurrentTrickWinner
getValidIndices
cardStrength
aiPlay
aiPickTrump
tryPlayCard
resolveTrick
endRound
checkMatchWin
```

## Existing DOM / presentation functions

Examples include:

```text
setStatus
updateScoreboard
updateTrumpBadge
updateTurnBadges
updateTrickSlots
highlightValidCards
buildCard
renderHand
updateTrickHistoryPanel
appendLog
showTrickWinBanner
fireConfetti
showStatsPanel
```

## Timer-coupled game flow

The baseline uses `setTimeout` and `requestAnimationFrame` throughout dealing, AI turns, trick resolution, overlays, and visual effects.

Batch 1 intentionally extracts **rules** from those timers, but the legacy UI/controller still uses presentation timers. Complete action/event sequencing is deferred to Patch 3 as specified in the implementation plan.
