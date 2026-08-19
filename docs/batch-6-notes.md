# Batch 6 Notes — Patches 16–19

Batch 6 is the release-hardening batch for Omi Single Player v1. It intentionally adds no new game mode or rules variation.

## Patch 16 — Automated Test Expansion

- Added deterministic full-match regression simulation across 100 seeds.
- Added engine session round-trip coverage across every resumable phase boundary.
- Added release accessibility/static-contract tests.
- Added `scripts/qa.mjs` for local asset references, duplicate IDs, dialog labelling, DOM-ID contracts, architecture purity and release metadata.
- Added `npm run verify` as the single release verification command.

## Patch 17 — Responsive and Accessibility QA

- Human playing cards are native keyboard-focusable buttons.
- Illegal cards are disabled at the control level, not only visually dimmed.
- The human-hand skip-link target is programmatically focusable.
- Trump, Statistics, hand-result, match-result and Main Menu Settings dialogs use a reusable stack-aware focus trap.
- Hint and Previous Trick popovers move focus into the opened surface and restore it to the trigger.
- Modal focus works correctly when Statistics is opened above a result dialog.
- Motion preferences now apply consistently to Main Menu, Tutorial and gameplay.
- Explicit Full Motion can override the device preference; Reduce Motion always suppresses non-essential transitions.
- Added forced-colors focus treatment and keyboard focus styling for playing cards.
- Added short-height scrolling fallbacks for Main Menu and Tutorial layouts.
- Added an accessible caption/header structure to the statistics table.

## Patch 18 — Release Candidate Hardening

- Presentation-only hand sorting no longer mutates `GameEngine.state.hands`.
- Stable engine card indices are preserved even when the human hand is visually sorted.
- Mute control now exposes a state-appropriate accessible name.
- Removed prototype/foundation wording from the release-facing menu and integration header.
- Release verification now checks that engine/controller/AI boundaries remain free of browser dependencies.

## Patch 19 — Single Player v1

- Project version set to `1.0.0`.
- README updated for the Single Player v1 release boundary.
- Added release and QA documentation.
- Welcome page remains intentionally user-owned; `index.html` continues to be a neutral compatibility entry that routes to `main-menu.html` until the final Welcome page replaces it.

## Architecture invariant

The authoritative Omi engine remains synchronous and independent of DOM, CSS, audio, local storage, browser timers and animation APIs. This remains the required foundation for future server-authoritative multiplayer.
