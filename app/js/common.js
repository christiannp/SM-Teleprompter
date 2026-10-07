/* GMS Teleprompter (web) — shared between control and display windows */
'use strict';

const GMS = (() => {
  const VERSION = 'web 1.2';
  const CH_NAME = 'gms-teleprompter';
  const K = {
    settings: 'gmsTele.settings.v1',
    template: 'gmsTele.template.v1',
    state: 'gmsTele.state.v1',
    draft: 'gmsTele.draft.v1',
  };

  const DEFAULT_SETTINGS = {
    // Normal (TOP) mode — same defaults as the original registry values
    normalWidth: 1024, normalHeight: 200,
    normalClockSize: 40, normalCountdownSize: 70, normalMessageSize: 55,
    normalMessageAlign: 'center',
    // Fullscreen mode
    fullWidth: 1024, fullHeight: 768,
    fullClockSize: 100, fullCountdownSize: 100, fullMessageSize: 80,
    fullMessageAlign: 'center',
    // Web-only
    stageScreen: '',                 // label of the stage screen ('' = auto: first screen that isn't the control's)
    openlpEnabled: true,
    openlpUrl: 'http://localhost:4316/stage',
    openlpPlacement: 'below',        // 'below' the TOP bar, or 'behind' it (overlay like the original)
    healLeftTitle: 'LEFT - B',
    healRightTitle: 'RIGHT - A',
  };

  const DEFAULT_TEMPLATE = [
    'CHECK SOUND',
    '',
    'COUNTDOWN CLIP (OPTIONAL) --> DI LIVE KALO BISA LIVE',
    '',
    'GREETING :',
    '[NAMA GREETER]',
    '',
    'OPENING CLIP (OPTIONAL) --> DI LIVE KALO BISA LIVE',
    '',
    'SONG 1 ([NAMA WL]):',
    'JUDUL LAGU 1',
    '',
    'NEXT SONG ([NAMA WL]): --> TAMPIL SAAT ENDING',
    'JUDUL LAGU 2',
    '',
    'SONG 2 ([NAMA WL]):',
    'JUDUL LAGU 2',
    '',
    'NEXT SONG ([NAMA WL]): --> TAMPIL SAAT ENDING',
    'JUDUL LAGU 3',
    '',
    'SONG 3 ([NAMA WL]):',
    'JUDUL LAGU 3',
    '',
    'DOA & FIRMAN TUHAN :',
    '[NAMA PEMBICARA]',
    '',
    'SERMONT : --> APABILA PEMBICARA DARI LUAR NEGERI',
    '[NAMA PEMBICARA]',
    '',
    'MINISTRY TIME :',
    '[NAMA ORANG YANG MEMIMPIN MINISTRY TIME]',
    '',
    'DOA PERPULUHAN :',
    '[NAMA ORANG]',
    '',
    'DOA PERSEMBAHAN :',
    '[NAMA ORANG]',
    '',
    'DOA BERKAT :',
    '[NAMA ORANG]',
    '',
  ].join('\n');

  const DEFAULT_STATE = {
    mode: 'top',          // 'top' | 'heal' | 'full'
    ct: false,            // giant countdown (CT button)
    displayOn: true,
    message: '',          // text live on stage
    liveIndex: -1,        // template entry currently on stage (-1 = free text / none)
    countdown: { running: false, endAt: 0 },
    heal: { left: [], right: [] },
    blinkAt: 0,
    rev: 0,
  };

  /* ---------- storage (never throws) ---------- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return structuredClone(fallback);
      const v = JSON.parse(raw);
      if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) return { ...structuredClone(fallback), ...v };
      return v;
    } catch { return structuredClone(fallback); }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function loadText(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; } }
  function saveText(key, value) { try { localStorage.setItem(key, value); } catch {} }

  /* ---------- template parsing ----------
     Same rules as template.txt in the original: entries are separated by blank lines.
     Extra: anything after "-->" on a line is an operator note — kept for the run sheet, never sent to the stage. */
  function parseTemplate(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const entries = [];
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const shown = [], notes = [];
      for (const ln of cur) {
        const i = ln.indexOf('-->');
        if (i >= 0) { shown.push(ln.slice(0, i).trimEnd()); const n = ln.slice(i + 3).trim(); if (n) notes.push(n); }
        else shown.push(ln.trimEnd());
      }
      while (shown.length && !shown[shown.length - 1].trim()) shown.pop();
      entries.push({ lines: shown, text: shown.join('\n'), note: notes.join(' · '), raw: cur.join('\n') });
      cur = [];
    };
    for (const ln of lines) {
      if (!ln.trim()) flush(); else cur.push(ln);
    }
    flush();
    return entries;
  }

  /* ---------- countdown maths (mirrors the original's 1-second tick) ---------- */
  function countdownInfo(cd, now = Date.now()) {
    if (!cd || !cd.running) return { active: false };
    const remS = Math.ceil((cd.endAt - now) / 1000);          // whole seconds left (negative = overtime)
    let stageMin = Math.ceil(remS / 60);                        // stage shows minutes, rounded up
    if (Object.is(stageMin, -0)) stageMin = 0;
    const red = Math.floor(remS / 60) <= 10;                    // original: red once the minute counter is ≤ 10
    const abs = Math.abs(remS);
    const mmss = (remS < 0 ? '-' : '') + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0');
    return { active: true, remS, stageMin: String(stageMin), red, mmss, over: remS < 0 };
  }

  function clockText(withSeconds, d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + (withSeconds ? ':' + p(d.getSeconds()) : '');
  }

  const ptToPx = (pt) => pt * 96 / 72;   // Delphi font sizes are points at 96 dpi

  /* ---------- messaging between windows ---------- */
  let ch = null;
  try { ch = new BroadcastChannel(CH_NAME); } catch {}
  const listeners = [];
  if (ch) ch.onmessage = (e) => listeners.forEach((fn) => fn(e.data));
  function post(msg) { if (ch) try { ch.postMessage(msg); } catch {} }
  function on(fn) { listeners.push(fn); }

  return {
    VERSION, K, DEFAULT_SETTINGS, DEFAULT_TEMPLATE, DEFAULT_STATE,
    load, save, loadText, saveText, parseTemplate, countdownInfo, clockText, ptToPx, post, on,
  };
})();
