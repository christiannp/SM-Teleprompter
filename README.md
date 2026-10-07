# SM Teleprompter

A web rebuild (macOS, Chrome) of the Windows **SM/GMS Teleprompter v5.4B** stage strip. It shows the clock, a countdown, operator messages and the healing queue on the stage monitor, layered over the live lyrics from **OpenLP** or **ProPresenter**.

- **Control** window (`app/index.html`) and **display** window (`app/display.html`) run on the same Mac. The display goes on the 2nd screen.
- The two windows sync over `BroadcastChannel`, keep state in `localStorage`, and work offline (service worker).
- There's no build step and no server code: plain HTML, CSS and JS.

**Live:** [control](https://chrisnp.fun/app/tele/) · [stage display](https://chrisnp.fun/app/tele/display.html)

## Repo layout

| Path | What |
|---|---|
| `app/` | The web app exactly as deployed: `index.html`, `display.html`, `css/`, `js/`, `icons/`, `manifest.webmanifest`, `sw.js` |
| `docs/original-app-spec.md` | How the original Windows app behaves, plus the decisions for the web version |
| `docs/lyrics-integration.md` | How to show OpenLP or ProPresenter lyrics under the strip (built-in stage outputs first, plugins, API fallback) |

## Deploy to the VPS

The app is served from `/var/www/html/app/tele` on chrisnp.fun. To update it after pushing to `main`, open hPanel → VPS → Web console and run:

```sh
cd /var/www/uploads && curl -fsSL -o sm-teleprompter.zip https://github.com/christiannp/SM-Teleprompter/archive/refs/heads/main.zip && rm -rf SM-Teleprompter-main && python3 -m zipfile -e sm-teleprompter.zip . && cp -r SM-Teleprompter-main/app/. /var/www/html/app/tele/ && chown -R www-data:www-data /var/www/html/app/tele
```

Only `app/` is copied to the web root. The service worker is network-first, so changes show on the next load.

## Status

- Web 1.0 is live.
- It hasn't been tested yet against a real OpenLP install or on the booth Mac.
- History: the first build lived in `christiannp/gms-teleprompter-web` (now archived). Its files were moved here unchanged.
