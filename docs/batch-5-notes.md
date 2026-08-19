# Batch 5 Notes — Patches 12–15

## Patch 12 — Audio and Settings

- Added `src/audio/AudioManager.js` and removed the inline procedural sound implementation from gameplay integration.
- Added versioned persistent settings in `src/storage/settings.js`.
- Added Smart/Casual difficulty, Sound, Animation Speed, and Motion preferences to Main Menu Settings.
- Added `src/ui/motion.js`; presentation delays and Web Animations now scale with the selected speed and honor reduced-motion configuration.
- Game mute changes persist back to the shared settings record.

## Patch 13 — Save and Resume

- Added versioned active-match records in `src/storage/saveGame.js`.
- Added complete engine session export/restore including undealt deck cards, deal order, deal cursor and authoritative state.
- Added strict restoration validation, card rehydration and duplicate-card detection.
- Added `SinglePlayerController.resumeMatch()` covering deal, trump, playing, four-card pending trick, hand scoring and hand-complete boundaries.
- Main Menu conditionally exposes Continue Match.
- Completed/corrupt saves are cleared safely.

## Patch 14 — Hint System and Previous Trick

- Added fair-information `src/ui/hints.js`.
- Hints use only the human hand and public match information; hidden AI hands are never inspected.
- Added contextual follow-suit, partner-winning, lowest-winning and conservation hints.
- Previous Trick now labels each player and highlights the trick winner.

## Patch 15 — End-of-Hand and Match Results

- Replaced the transient hand-result message with a dedicated result dialog.
- Hand results show trick score, token award/breakdown, carry information and next dealer.
- Match results show winner, final token score, hands played, Kapothi totals and elapsed match duration.
- Added result styling in `styles/results.css`.

## Architecture boundary

All settings, audio, persistence, hinting and result presentation remain outside the Omi rules engine. Engine restore logic is JSON-safe and browser-independent so the same state model remains suitable for future server-authoritative multiplayer.
