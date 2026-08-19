# Welcome Page Integration Contract

The Welcome page is owned and maintained separately by the user.

Batch 1 does **not** redesign, replace, or generate the Welcome page.

## Target route

Once the Main Menu patch is implemented, the intended application flow is:

```text
welcome.html
    ↓ Tap to Start
main-menu.html
    ↓ Play Solo
game.html
```

## Current Batch 1 limitation

The attached codebase currently contains only `index.html`, which remains the playable prototype entry point during Batch 1.

Renaming or splitting this page is intentionally deferred until the Main Menu integration patch so Batch 1 does not introduce unrelated routing/UI regressions.

## Required compatibility

The separately maintained Welcome page should eventually navigate only to `main-menu.html` and must not contain Omi game-rule logic.
