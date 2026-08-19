# Welcome Page Integration Contract

The Welcome page is owned and maintained separately by the user.

Batch 3 does **not** redesign, replace, or recreate the approved Welcome-page logo or its cinematic logo-building animation.

## Target route

The application routing contract is now:

```text
welcome.html
    ↓ Tap to Start
main-menu.html
    ↓ Play Solo
game.html
```

## Current repository fallback

The repository does not contain the user's final Welcome page asset. Therefore `index.html` is a deliberately neutral compatibility redirect to `main-menu.html`.

When the user adds the final Welcome page, it can either:

1. be saved as `welcome.html` and linked from the hosting entry point; or
2. replace the neutral `index.html` redirect.

In both cases, **Tap to Start must navigate to `main-menu.html`**.

## Logo integrity

The approved primary Omi logo must not be recreated, approximated, or geometrically modified by application code. The Batch 3 Main Menu uses only a typographic `Omi` wordmark and normal card-suit symbols because the approved logo asset is not present in the attached codebase.

When the official logo asset is added later, it should be referenced directly as an image/SVG asset and remain unchanged.

## Separation of responsibilities

The Welcome page must contain no Omi game-rule logic. Main Menu navigation, Tutorial navigation, and gameplay remain separate application concerns.
