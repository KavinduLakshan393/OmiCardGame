# Omi Single Player v1 — Release QA

This document separates **automated release gates** from **manual browser/device verification**.

## Automated release gate

Run:

```bash
npm run verify
```

The command must complete successfully and performs:

1. JavaScript syntax verification.
2. Full Node test suite.
3. Static release QA.

Automated coverage includes:

- 32-card deck integrity and deterministic shuffle;
- legal move / follow-suit enforcement;
- trump and trick resolution;
- scoring, Kapothi, carry and 10-token match completion;
- action/event contracts;
- fair-information AI boundaries;
- single-player controller flow;
- save/session validation and restore boundaries;
- 100 deterministic complete-match simulations;
- tutorial rule consistency;
- playing-card rendering contracts;
- persistent settings, hints and result-view contracts;
- HTML local-reference checks and duplicate-ID checks;
- literal JavaScript DOM-ID checks against their owning page;
- accessibility contracts for keyboard cards, focus traps and helper popovers;
- engine/controller/AI browser-dependency boundary checks;
- Single Player v1 release metadata.

## Manual browser QA required before merge/tag

Serve the repository over HTTP:

```bash
python -m http.server 8000
```

Then verify the following in a normal browser.

### Desktop — 1440×900 or similar

- Main Menu loads without clipping.
- Settings opens, traps Tab/Shift+Tab and restores focus when closed.
- Tutorial completes all 11 steps with mouse and keyboard.
- Start a solo match and complete at least one full hand.
- Human cards are playable with keyboard Enter/Space when legal.
- Illegal cards cannot receive an actionable play.
- Trump selection traps focus inside its mandatory modal.
- Hint and Previous Trick return focus to their trigger when closed.
- Hand Result and Match Result dialogs receive focus correctly.
- Statistics can open above a result dialog and return focus correctly when closed.
- No blocking console errors occur.

### Responsive widths

Check approximately:

- 1280×720 desktop/laptop;
- 1024×768 tablet landscape;
- 768×1024 tablet portrait;
- 390×844 mobile portrait;
- 844×390 mobile landscape.

Confirm:

- no clipped actionable controls;
- cards remain readable and tappable;
- current trick remains visible;
- score, trump and status remain understandable;
- Main Menu and Tutorial can scroll on short viewports;
- result dialogs remain within the viewport and scroll internally when required.

### Touch interaction

On a coarse-pointer device/emulation:

- first tap selects a legal human card;
- second tap plays it;
- illegal cards remain disabled;
- selection never changes authoritative card identity after visual sorting.

### Motion settings

Verify all three settings:

- **Use device setting** follows `prefers-reduced-motion`;
- **Reduce motion** suppresses non-essential motion on Main Menu, Tutorial and gameplay;
- **Full motion** enables presentation motion even when the device preference is reduced.

### Persistence

- Start a match, leave during initial deal/trump/play, then use Continue Match.
- Resume during an in-progress trick.
- Resume after a completed hand.
- Corrupt/invalid save data is discarded safely.
- Completed match does not leave Continue Match available.

## Release decision

Single Player v1 is ready to merge/tag only when:

- `npm run verify` passes;
- the manual browser QA above is completed without a release-blocking defect;
- the final user-owned Welcome page integration, when added, still routes to `main-menu.html` and does not import game logic.
