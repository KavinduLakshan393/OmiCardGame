# Omi Single Player v1.0.0

## Release scope

Single Player v1 delivers the complete offline/local solo experience planned in Patches 0–19:

- Standard 32-card Omi rules;
- compulsory trump after the first four cards;
- counter-clockwise deal/play;
- correct trick resolution and standard token scoring;
- 10-token match target and 4–4 carry;
- pure authoritative rules engine;
- action/event architecture;
- one human + three fair-information AI players;
- Casual and Smart AI modes;
- Main Menu and 11-step Tutorial;
- responsive game table and production card renderer;
- deal/play/trick animations;
- persistent settings and synthesized browser audio;
- save/continue match;
- fair hints and Previous Trick;
- hand/match result screens and statistics;
- keyboard/touch/reduced-motion accessibility hardening;
- expanded deterministic regression and release QA tooling.

## Entry route

The repository currently uses:

```text
index.html → main-menu.html
```

This is intentional. The cinematic Welcome page is user-owned and can replace the neutral `index.html` entry later, provided its final action routes to `main-menu.html`.

## Standard Mode exclusions

The following remain intentionally outside Single Player v1 Standard Mode:

- Joker;
- pass-trump;
- custom scoring;
- alternative deck sizes;
- online multiplayer;
- accounts/rankings/social features.

## Verification

```bash
npm run verify
```

Manual device/browser QA remains required before release tagging. See `docs/release-qa.md`.

## Multiplayer readiness

The release keeps rules/state independent from DOM, audio, persistence and presentation timing. Future online multiplayer should place a server-authoritative transport/controller above the same rules model rather than rewriting Omi rules in the browser.
