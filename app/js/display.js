/* GMS Teleprompter (web) — stage display window */
'use strict';
(() => {
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const $ = (id) => document.getElementById(id);
  const el = {
    canvas: $('canvas'), stage: $('stage'),
    clockBox: $('clockBox'), clock: $('clock'),
    cdBox: $('cdBox'), cd: $('cd'),
    msgBox: $('msgBox'), msg: $('msg'),
    heal: $('heal'), healL: $('healL'), healR: $('healR'),
    openlp: $('openlp'), ph: $('openlpPlaceholder'),
    blink: $('blink'), start: $('start'), screenName: $('screenName'),
  };
  const instanceId = Math.random().toString(36).slice(2);

  let settings = GMS.load(GMS.K.settings, GMS.DEFAULT_SETTINGS);
  let state = GMS.load(GMS.K.state, GMS.DEFAULT_STATE);
  let lastBlinkAt = state.blinkAt || 0;
  let dismissed = false;
  let screenLabel = '';

  if (PREVIEW) document.body.classList.add('preview');

  /* ---------------- layout ---------------- */
  const px = GMS.ptToPx;
  function place(node, x, y, w, h) {
    node.style.left = x + 'px'; node.style.top = y + 'px';
    node.style.width = Math.max(0, w) + 'px'; node.style.height = Math.max(0, h) + 'px';
  }
  let geom = { mode: 'top', s: 1, W: 1024, H: 200, NH: 200 };

  function layout() {
    const S = settings;
    const vw = window.innerWidth, vh = window.innerHeight;
    const mode = state.ct ? 'ct' : state.mode;
    const W = (mode === 'full' || mode === 'ct') ? (+S.fullWidth || 1024) : (+S.normalWidth || 1024);
    const s = vw / W;
    const NH = +S.normalHeight || 200;
    let H = vh / s;
    if (mode === 'top') H = Math.min(NH, H);
    geom = { mode, s, W, H, NH };

    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    el.canvas.style.transform = `scale(${s})`;

    const big = mode === 'full';
    const clockPt = big ? S.fullClockSize : S.normalClockSize;
    const cdPt = big ? S.fullCountdownSize : S.normalCountdownSize;
    const msgPt = big ? S.fullMessageSize : S.normalMessageSize;
    const align = big ? S.fullMessageAlign : S.normalMessageAlign;

    el.clock.style.fontSize = px(clockPt) + 'px';
    el.msg.style.textAlign = align || 'center';
    el.msg.dataset.base = px(msgPt);

    if (big) {
      // FULL: clock top-left, countdown top-right, message underneath
      place(el.clockBox, 0, 0, 385, 161);
      place(el.cdBox, W - 281, 0, 281, 161);
      place(el.msgBox, 0, 161, W, H - 161);
      el.cd.style.fontSize = px(cdPt) + 'px';
    } else {
      // TOP / HEAL / CT share the original "normal" band: clock + countdown column on the left, message on the right
      place(el.clockBox, 0, 0, 185, 65);
      place(el.msgBox, 185, 0, W - 185, NH);
      if (mode === 'ct') {
        // CT: countdown takes over everything under the band, at 5x the normal countdown size (fitted to the screen)
        const h = H - NH;
        place(el.cdBox, 0, NH, W, h);
        el.cd.style.fontSize = Math.min(px(cdPt) * 5, h * 0.95, W / 1.9) + 'px';
      } else {
        place(el.cdBox, 0, 64, 185, Math.min(105, NH - 64));
        el.cd.style.fontSize = px(cdPt) + 'px';
      }
    }

    // Healing queue panel (HEAL mode)
    const healOn = mode === 'heal';
    el.heal.hidden = !healOn;
    if (healOn) {
      const top = NH, h = H - NH;
      place(el.heal, 0, top, W, h);
      const k = Math.max(0.3, Math.min(1, (h - 15) / 480));
      el.heal.style.paddingTop = (9 + 6 * k) + 'px';
      el.heal.querySelector('.heal-rule').style.height = '9px';
      for (const col of [el.healL, el.healR]) {
        col.style.gridTemplateRows = `${78 * k}px ${226 * k}px ${170 * k}px`;
        col.querySelector('.heal-title').style.fontSize = 67 * k + 'px';
        col.querySelector('.heal-count').style.fontSize = 213 * k + 'px';
        col.querySelector('.heal-name').style.fontSize = 64 * k + 'px';
      }
    }

    layoutOpenlp();
    fitMessage();
  }

  function layoutOpenlp() {
    const layer = PREVIEW ? el.ph : el.openlp;
    const other = PREVIEW ? el.openlp : el.ph;
    other.hidden = true;
    const want = settings.openlpEnabled && settings.openlpUrl && (PREVIEW || olp.up);
    layer.hidden = !want;
    if (!want) return;
    const below = settings.openlpPlacement !== 'behind';
    const topPx = (state.displayOn && geom.mode === 'top' && below) ? Math.round(geom.NH * geom.s) : 0;
    layer.style.top = topPx + 'px';
    layer.style.height = `calc(100% - ${topPx}px)`;
  }

  // Shrink long messages so they never get cut off (down to 55% of the configured size)
  function fitMessage() {
    const base = +el.msg.dataset.base || 73;
    let size = base;
    el.msg.style.fontSize = size + 'px';
    const boxH = el.msgBox.clientHeight;
    let guard = 0;
    while (el.msg.scrollHeight > boxH + 1 && size > base * 0.55 && guard++ < 40) {
      size *= 0.95;
      el.msg.style.fontSize = size + 'px';
    }
  }

  /* ---------------- content ---------------- */
  function render() {
    el.stage.classList.toggle('off', !state.displayOn);
    if (el.msg.textContent !== state.message) el.msg.textContent = state.message || '';
    const h = state.heal || { left: [], right: [] };
    fillHeal(el.healL, settings.healLeftTitle, h.left || []);
    fillHeal(el.healR, settings.healRightTitle, h.right || []);
    layout();
    tick();
  }
  function fillHeal(col, title, list) {
    col.querySelector('.heal-title').textContent = title || '';
    col.querySelector('.heal-count').textContent = String(list.length);
    col.querySelector('.heal-name').textContent = list[0] || '';
  }

  function tick() {
    el.clock.textContent = GMS.clockText(false);
    const info = GMS.countdownInfo(state.countdown);
    const txt = info.active ? info.stageMin : '';
    if (el.cd.textContent !== txt) el.cd.textContent = txt;
    el.cd.classList.toggle('red', !!(info.active && info.red));
  }
  setInterval(tick, 250);

  /* ---------------- blink (black/yellow x3, 100 ms steps) ---------------- */
  let blinking = false;
  function blink() {
    if (blinking) return;
    blinking = true;
    const seq = ['#000', '#ff0', '#000', '#ff0', '#000', '#ff0'];
    let i = 0;
    el.blink.classList.add('on');
    const step = () => {
      if (i >= seq.length) { el.blink.classList.remove('on'); blinking = false; return; }
      el.blink.style.background = seq[i++];
      setTimeout(step, 100);
    };
    step();
  }

  /* ---------------- OpenLP stage view layer ---------------- */
  const olp = { up: false, url: '', timer: 0 };
  async function probe(url) {
    try { await fetch(url, { mode: 'no-cors', cache: 'no-store' }); return true; } catch { return false; }
  }
  async function olpLoop() {
    clearTimeout(olp.timer);
    if (PREVIEW) { layoutOpenlp(); return; }
    const url = settings.openlpEnabled ? (settings.openlpUrl || '').trim() : '';
    if (!url) {
      olp.up = false; olp.url = '';
      el.openlp.removeAttribute('src');
      layoutOpenlp(); heartbeat();
      olp.timer = setTimeout(olpLoop, 5000);
      return;
    }
    const ok = await probe(url);
    if (ok && (!olp.up || olp.url !== url)) { el.openlp.src = url; olp.url = url; }
    if (!ok && olp.up) el.openlp.removeAttribute('src');
    const changed = ok !== olp.up;
    olp.up = ok;
    layoutOpenlp();
    if (changed) heartbeat();
    olp.timer = setTimeout(olpLoop, ok ? 10000 : 4000);
  }
  function reloadOpenlp() { olp.up = false; olp.url = ''; el.openlp.removeAttribute('src'); olpLoop(); }

  /* ---------------- fullscreen on the stage screen ---------------- */
  async function pickScreen() {
    if (!('getScreenDetails' in window)) return null;
    try {
      const sd = await window.getScreenDetails();
      const want = settings.stageScreen;
      return (want && sd.screens.find((s) => s.label === want)) || sd.currentScreen || null;
    } catch { return null; }
  }
  async function goFullscreen() {
    const scr = await pickScreen();
    try {
      await document.documentElement.requestFullscreen(scr ? { screen: scr, navigationUI: 'hide' } : { navigationUI: 'hide' });
    } catch {
      try { await document.documentElement.requestFullscreen(); } catch {}
    }
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else goFullscreen();
  }
  async function updateStart() {
    if (PREVIEW) { el.start.hidden = true; return; }
    el.start.hidden = !!document.fullscreenElement || dismissed;
    if (!el.start.hidden) {
      try {
        const p = await navigator.permissions.query({ name: 'window-management' });
        if (p.state === 'granted') {
          const scr = await pickScreen();
          screenLabel = scr && scr.label ? scr.label : '';
        }
      } catch {}
      el.screenName.textContent = screenLabel || 'this screen';
    }
    heartbeat();
  }
  $('goFull').addEventListener('click', goFullscreen);
  $('dismiss').addEventListener('click', () => { dismissed = true; updateStart(); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) dismissed = false; updateStart(); layout(); });
  document.addEventListener('dblclick', () => { if (!PREVIEW) toggleFullscreen(); });
  document.addEventListener('keydown', (e) => {
    if (PREVIEW) return;
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
  let curTimer = 0;
  document.addEventListener('mousemove', () => {
    if (PREVIEW) return;
    document.body.classList.add('cursor');
    clearTimeout(curTimer);
    curTimer = setTimeout(() => document.body.classList.remove('cursor'), 2000);
  });

  /* ---------------- sync with the control window ---------------- */
  function heartbeat() {
    if (PREVIEW) return;
    GMS.post({
      type: 'display-status', id: instanceId, w: window.innerWidth, h: window.innerHeight,
      fs: !!document.fullscreenElement, screen: screenLabel, openlp: olp.up, at: Date.now(),
    });
  }
  setInterval(heartbeat, 2000);

  function apply(newState, newSettings) {
    const prevOlp = settings.openlpEnabled + '|' + settings.openlpUrl;
    if (newSettings) settings = { ...GMS.DEFAULT_SETTINGS, ...newSettings };
    if (newState) {
      state = { ...GMS.DEFAULT_STATE, ...newState };
      if (state.blinkAt && state.blinkAt > lastBlinkAt) {
        if (Date.now() - state.blinkAt < 3000) blink();
        lastBlinkAt = state.blinkAt;
      }
    }
    render();
    if (prevOlp !== settings.openlpEnabled + '|' + settings.openlpUrl) reloadOpenlp();
  }

  GMS.on((m) => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'state') apply(m.state, m.settings);
    else if (m.type === 'reload-openlp') reloadOpenlp();
    else if (m.type === 'ping') heartbeat();
  });
  // Backup path: localStorage events (also covers a display opened before the control)
  window.addEventListener('storage', (e) => {
    if (e.key === GMS.K.state) apply(GMS.load(GMS.K.state, GMS.DEFAULT_STATE), null);
    else if (e.key === GMS.K.settings) apply(null, GMS.load(GMS.K.settings, GMS.DEFAULT_SETTINGS));
  });

  window.addEventListener('resize', () => { layout(); heartbeat(); });
  window.addEventListener('beforeunload', () => GMS.post({ type: 'display-closed', id: instanceId }));

  render();
  olpLoop();
  updateStart();
  GMS.post({ type: 'hello', from: PREVIEW ? 'preview' : 'display' });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
})();
