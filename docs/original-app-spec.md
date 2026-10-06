# GMS Teleprompter → web (macOS) — spec

Source: `GMS Teleprompter ver 5.4B.exe` (Delphi 7-era VCL, Windows) + `TEMPLATE.txt` + `README.docx`, in the user's folder "SM Teleprompter v5.4B". Behaviour below was decoded from the exe's form resources (DFM) and event-handler disassembly (Oct 2026).

## Decisions (user, 2026-10-07)
- Same Mac, 2nd monitor (control + display windows on one Mac, BroadcastChannel sync, offline-capable).
- Modernized look, same strip layout.
- Host on VPS: /var/www/html/app/tele (chrisnp.fun/app/tele).
- CT: decode & match.
- Stage monitor normally shows OpenLP stage view / lyrics under the TOP bar → web display embeds OpenLP's web stage view (default http://localhost:4316/stage) as the layer under the teleprompter.

## Original windows
- **Control strip** 1024×100, borderless, forced always-on-top. Sections: GMS logo · COUNTDOWN (minute spin 0–999, SET, CLR) · MESSAGE (template combo + edit icon, memo, ▲ prev, ▼ next, SET, CLR) · Blink (sun) · CT (stopwatch OFF/ON) · TOP / HEAL / FULL · Display ON/OFF switch · preview (CLOCK hh:nn:ss, COUNTDOWN "MM : SS", MESSAGE lines 1–2) · gear (settings) · X.
- **Display** borderless WS_POPUP, HWND_TOPMOST, placed at x = GeneralLeftPos (default 1440 = right of a 1440-wide operator screen), top 0. Panels are black at runtime; text font Impact. Clock white, countdown yellow (red when ≤10 min), message white.
- **Healing Queue control** (400×400): LEFT (B) and RIGHT (A) list memos, "Total Queue" counts, UPDATE. "Topmost item on queue list will be visible to display screen".
- **Settings** (registry HKCU\SOFTWARE\GMSTELEPROMPTER): GeneralLeftPos; Normal Width 1024, Height 200, Clock 40pt, Countdown 70pt, Message 55pt, Align Center; Fullscreen Width 1024, Height 768, Clock 100, Countdown 100, Message 80, Align Center. (Clock/countdown size fields were disabled in the UI.)
- **Template editor**: edits `template.txt` beside the exe. Entries separated by blank lines. Combo item = an entry's lines concatenated; message = lines joined by newline. Choosing an entry (or ▲/▼) only fills the message box — SET pushes it to the stage. Note: an entry is only stored when a blank line follows it.

## Display layouts (virtual px)
- **TOP / Normal** (window NormalWidth×NormalHeight): clock box (0,0,185,65); countdown box (0,64,185,105); message (185,0,W−185,H).
- **FULL** (FullscreenWidth×FullscreenHeight): clock (0,0,385,161); countdown (W−281,0,281,161); message (0,161,W,H−161).
- **HEAL** (NormalWidth × FullscreenHeight): top band as TOP; below: white 9px rule, two 480-wide columns: heading "LEFT - B" / "RIGHT - A" (Impact 67px white), big count of names (213px white), topmost name (64px yellow) at bottom.
- **CT ON**: window = fullscreen size; top band as TOP (clock + message); countdown panel fills everything below the message band, full width, font = 5 × normal countdown size. Any mode button turns CT off first.

## Behaviour
- Clock: stage hh:nn (24 h); control preview hh:nn:ss.
- Countdown SET (minutes > 0): starts; stage shows whole minutes remaining rounded up (e.g. 14:30 left → "15"); red when ≤10 min left; it does not stop at zero — keeps counting into negative minutes (overtime) in red. CLR: stops, blanks, resets spin to 0.
- Message SET → stage; CLR → clears box, stage, preview, deselects template.
- Blink: full display flashes black/yellow ×3 at 100 ms steps (~0.6 s).
- Display ON/OFF: fade in/out (alpha steps every 50 ms).

## Web version notes
- control (index.html) + display (display.html) sync via BroadcastChannel; state persisted in localStorage.
- Display opens on the 2nd screen using Chrome's Window Management API; one click on the display to go fullscreen there.
- OpenLP stage view is an iframe layer under the teleprompter layer (below or behind the TOP bar; full screen when display is OFF).
- Control strip can float always-on-top over OpenLP via Chrome Document Picture-in-Picture.
- Text after `-->` in a template line is treated as an operator note (shown in the run sheet, never sent to stage).
- Lyrics source options (OpenLP / ProPresenter): see [lyrics-integration.md](lyrics-integration.md).
