# Welcome Page Integration Contract

The repository now contains the production Welcome/Home page at `index.html` using the user-supplied cinematic intro video.

## Route

```text
index.html
    ↓ Intro video / Tap to Start
main-menu.html
    ↓ Play Solo
game.html
```

The Welcome page remains presentation-only. It contains no Omi rules, AI or game-state logic.

## Intro media

The approved supplied media is stored as:

```text
assets/video/omi-intro.mp4
assets/video/omi-intro-poster.jpg
```

The poster is an exact late frame extracted from the supplied video so the final intertwined Omi suit emblem is preserved rather than recreated or approximated.

## Welcome behaviour

1. The muted, inline 8-second intro attempts to autoplay.
2. The `Omi` title, subtitle and `Tap to Start` control reveal near the final emblem formation.
3. When the video ends, the video layer settles onto the extracted final-frame poster.
4. Tapping/clicking anywhere during the intro skips directly to the final Welcome state; it does **not** bypass the `Tap to Start` decision.
5. `Tap to Start` performs a short cinematic fade and navigates to `main-menu.html`.
6. If autoplay fails, the static final state is shown immediately.
7. Reduced-motion preference skips video playback and shows the static final state immediately.

## Audio

The Welcome video is intentionally muted for reliable browser autoplay. Gameplay sound remains controlled by the existing persistent Omi sound setting.

## Logo integrity

No generated or reconstructed logo is placed over the video. The emblem visible in the final Welcome state comes directly from the supplied intro footage/poster frame.
