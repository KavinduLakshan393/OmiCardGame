# Batch 3 Notes — Patches 6, 7 and 8

Batch 3 implements the first production-facing navigation and visual foundation on top of the Batch 2 engine/controller/AI architecture.

## Patch 6 — Main Menu Integration

Added:

- `main-menu.html` as the official post-Welcome navigation hub;
- Play Solo → `game.html`;
- Tutorial → `tutorial.html`;
- functional Main Menu settings for Casual/Smart AI and initial sound state;
- keyboard/focus-safe settings dialog;
- Tutorial completion indicator;
- a neutral `index.html` redirect while the user-owned Welcome page remains external;
- renamed the playable prototype entry from `index.html` to `game.html`.

The approved primary Omi logo was **not** recreated because its source asset is not present in the attached repository. Main Menu uses typography and standard suit symbols only.

## Patch 7 — Complete Tutorial

Added an 11-step tutorial covering:

1. players and partnerships;
2. the 32-card deck;
3. card ranking;
4. first-four deal and compulsory trump;
5. leading and counter-clockwise play;
6. following suit;
7. trump behaviour;
8. trick resolution;
9. hand scoring;
10. 4–4 carry and 10-token match target;
11. beginner strategy.

Tutorial features:

- Back / Next / Finish;
- Left / Right keyboard navigation;
- Escape to Main Menu;
- step progress indicator;
- responsive visual rule examples;
- `omiTutorialCompleted = true` stored after Finish.

## Patch 8 — Global Design System and Typography

Added:

- `styles/tokens.css`;
- `styles/base.css`;
- `styles/typography.css`;
- `styles/menu.css`;
- `styles/tutorial.css`;
- `styles/game-legacy.css`.

Typography roles:

- Cormorant Garamond — Welcome/Main Menu/Tutorial editorial display;
- Manrope — application UI;
- Barlow Condensed — scores and gameplay display labels;
- Georgia — playing-card typography.

Gameplay palette tokens are defined now but the full table redesign remains intentionally deferred to Patch 9.

The old embedded CSS was extracted from the game document into `styles/game-legacy.css`, so presentation is no longer embedded directly in `game.html`.

## Deliberately deferred

Batch 3 does not implement:

- the final user-owned Welcome screen;
- the approved primary-logo asset;
- responsive gameplay-table redesign (Patch 9);
- new playing-card component (Patch 10);
- gameplay animation architecture (Patch 11);
- full settings/audio persistence architecture (Patch 12).
