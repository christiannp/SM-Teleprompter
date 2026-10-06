# SM Teleprompter

A web rebuild (macOS, Chrome) of the Windows **SM/GMS Teleprompter v5.4B** stage strip. It shows the clock, a countdown, operator messages and the healing queue on the stage monitor, layered over the live lyrics from **OpenLP** or **ProPresenter**.

- **Control** window (`index.html`) and **display** window (`display.html`) run on the same Mac. The display goes on the 2nd screen.
- The two windows sync over `BroadcastChannel`, keep state in `localStorage`, and work offline.
- It will be hosted at `chrisnp.fun/app/tele`.

## Docs

- [`docs/original-app-spec.md`](docs/original-app-spec.md): how the original Windows app behaves, plus the decisions for the web version.
- [`docs/lyrics-integration.md`](docs/lyrics-integration.md): how to show OpenLP or ProPresenter lyrics under the teleprompter strip (built-in stage outputs first, plugins, API fallback).

## Status

Spec stage. The code comes next.
