# Live lyrics under the teleprompter — findings (Oct 2026)

How the SM Teleprompter display gets the live lyric from **OpenLP** or **ProPresenter** onto the same stage monitor. The teleprompter strip (clock · countdown · message) sits on top, and the lyric sits underneath.

User's preference: use each lyrics app's **built-in** stage output first. Add an adapter (our own code reading their API) only where it's really needed.

## At a glance

| | OpenLP 3.x | ProPresenter 7 |
|---|---|---|
| **Built-in (do first)** | Embed OpenLP's web stage view in an iframe under the TOP bar. A custom stage view lets us style it. | Stage layout with native Current/Next Slide Text; bring the teleprompter in as a Live Video input (NDI). |
| **Plugin** | Possible later (Python/Qt). | Not possible. No plugin SDK, only the network API. |
| **Adapter (fallback)** | WebSocket `:4317` + `/api/v2/controller/live-items` | `/v1/status/slide?chunked=true` + `/v1/status/layers?chunked=true` |

## OpenLP

**Built-in stage view.** It's served by OpenLP's Remote plugin at `http://localhost:4316/stage`. This is exactly the iframe layer in the current spec.

**Custom stage view.** Use one to control the look: hide OpenLP's own clock (the strip already has one) and size the text for the area below the TOP bar.
- Go to Tools → Open Data Folder.
- Create `stages/sm/` there, with `stage.html`, `stage.css` and `stage.js` copied from OpenLP's custom-stage-view sample.
- Iframe `http://localhost:4316/stage/sm` instead of `/stage`.

**Live data, if we render the lyric ourselves.**
- `ws://localhost:4317` pushes `{"results": {"item", "service", "slide", ...}}` on every change. Messages arrive as a Blob, so read them with `await event.data.text()`.
- When `item` changes, refetch `GET http://localhost:4316/api/v2/controller/live-items`.
- That returns `slides[]` with `text`, `tag` (V1, C1…) and `selected`. "Next" is the slide at `selected + 1`.

**Hosting caveat.**
- The control and display pages are planned at `https://chrisnp.fun/app/tele`, and they iframe or fetch `http://localhost:4316`.
- Browsers allow this only because `localhost` / `127.0.0.1` count as trustworthy origins.
- A **LAN IP** (`http://192.168.x.x:4316`) from an HTTPS page is blocked as mixed content. So OpenLP must run on the same Mac (as decided). Otherwise the app has to be served over plain http on the LAN.

**To verify on the real Mac:**
- Recent Chrome may show a one-time *local network access* permission prompt when a public site reaches `localhost`. Allow it once.
- Confirm OpenLP doesn't send headers that block framing.

## ProPresenter 7

There's **no web stage view** to iframe.

**Built-in path.** Build a ProPresenter stage layout:
- Bottom: the native *Current Slide Text* and *Next Slide Text* objects.
- Top band: a shape filled with a **Live Video input** carrying the SM display over NDI. Any window/screen-to-NDI capture tool works (NDI Tools, or OBS with NDI).
- ProPresenter supports NDI input, and stage-layout shapes can be filled with live video.

**Adapter path (needs 7.9+).**
- Turn on Settings → Network → Network API. The user picks the port; 1025 is common.
- `GET /v1/status/slide?chunked=true` streams `{current:{text,notes,uuid}, next:{…}}`.
- Gotcha: after the operator clears, ProPresenter **keeps reporting the last text**. Watch `GET /v1/status/layers?chunked=true` to blank the lyric.
- Likely CORS problem: community projects proxy the API (nginx or a local server), so a page on `chrisnp.fun` probably can't read it directly. Expect a tiny local proxy if we go this way.

## Plugins

- **OpenLP:** open source, Python and Qt. Plugins are `plugins/<name>/<name>plugin.py`. Newer OpenLP code also loads *community* plugins from a `contrib` folder inside the data folder. Check the installed version first. Only worth it if the strip should live *inside* OpenLP.
- **ProPresenter:** closed source with no SDK. Integration goes through the network API, MIDI and Companion.

## Suggested setting in the display

`lyricsSource`:
- `openlp-stage` (iframe `/stage/sm`, default)
- `openlp-api`
- `propresenter-api` (needs the local proxy)
- `none`

The ProPresenter built-in path needs no code on our side. It's purely a ProPresenter stage-layout setup.

## Sources
- OpenLP manual, Stage View: https://manual.openlp.org/stage_view.html
- OpenLP v1 → v2 API: https://discuss.openlp.org/d/5955-openlp-v1-api-eventually-going-away
- Renewed Vision, stage screens in Pro7: https://www.renewedvision.com/blog/video-how-to-create-stage-screens-in-propresenter-7
- ProPresenter features (NDI in/out): https://www.renewedvision.com/es/propresenter/all-features
- ProPresenter OpenAPI (community copy): https://github.com/jeffmikels/ProPresenter-API
