# Batch 4 Notes — Patches 9–11

Batch 4 is the gameplay presentation overhaul. It intentionally changes the table, card component, and presentation animation layer without changing the authoritative Omi rules introduced in Batch 1 or the controller/AI boundaries introduced in Batch 2.

## Patch 9 — Responsive Game Table

- Replaces the fixed legacy grid with a responsive felt-table surface.
- Adds explicit player seats, identities, card counts, team HUD, trump display, and status/action area.
- Removes the visible debug game-log sidebar from normal gameplay.
- Adds a compact previous-trick popover while retaining the hidden diagnostic log sink for development instrumentation.
- Adds tablet, mobile, and landscape breakpoints.

## Patch 10 — Production Playing Cards

- Adds `src/ui/cardRenderer.js` as the single DOM card renderer.
- Implements real pip layouts for 7–10.
- Implements Ace presentation and original minimalist J/Q/K court treatment without chess-glyph placeholders.
- Adds branded Omi card backs.
- Adds legal, illegal, selected, table, opponent, and mini-card states.
- Adds coarse-pointer two-tap selection to reduce accidental mobile plays.

## Patch 11 — Gameplay Animations

- Adds `src/ui/animations.js`.
- Adds first/second deal entry motion.
- Adds card travel from player seat/hand to trick slot.
- Adds winning-card pulse and trick collection toward the winner.
- Keeps all presentation timing outside `src/engine`.
- Respects `prefers-reduced-motion`.

## Scope intentionally deferred

Patch 12 still owns the formal audio/settings subsystem. Patch 13 owns save/resume. Patch 14 owns hints and any richer trick-history UX. Patch 15 owns final result-screen feature completion, although Batch 4 restyles the existing overlays to fit the new game surface.
