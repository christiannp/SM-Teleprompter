/* GMS Teleprompter (web) — operator control window */
'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const STRIP_W = 1200;

  let settings = GMS.load(GMS.K.settings, GMS.DEFAULT_SETTINGS);
  let state = GMS.load(GMS.K.state, GMS.DEFAULT_STATE);
  let templateText = GMS.loadText(GMS.K.template, GMS.DEFAULT_TEMPLATE);
  let entries = GMS.parseTemplate(templateText);
  const draft = GMS.load(GMS.K.draft, { minutes: 0, message: '', sel: -1, healL: '', healR: '' });

  const el = {
    strip: $('strip'), stripHome: $('stripHome'), ghost: $('stripGhost'),
    minutes: $('minutes'), tpl: $('tpl'), msg: $('msgInput'),
    ct: $('ct'), ctState: $('ctState'), power: $('power'),
    pvClock: $('pvClock'), pvCd: $('pvCd'), pvMsg1: $('pvMsg1'), pvMsg2: $('pvMsg2'),
    dot: $('dispDot'), status: $('dispStatus'), olpStatus: $('olpStatus'),
    runList: $('runList'), runCount: $('runCount'),
    pvFrame: $('pvFrame'), healCard: $('healCard'),
    healL: $('healL'), healR: $('healR'), healLCount: $('healLCount'), healRCount: $('healRCount'),
    toast: $('toast'),
  };

  /* ---------------- helpers ---------------- */
  let toastTimer = 0;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }
  function flash(btn) { if (!btn) return; btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 140); }
  const saveDraft = () => GMS.save(GMS.K.draft, draft);
  const lines = (t) => String(t || '').replace(/\r\n?/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);

  /* ---------------- state → display ---------------- */
  function broadcast() { GMS.post({ type: 'state', state, settings }); }
  function commit() {
    state.rev = (state.rev || 0) + 1;
    GMS.save(GMS.K.state, state);
    broadcast();
    render();
  }

  /* ---------------- countdown ---------------- */
  function setMinutes(v) {
    v = Math.max(0, Math.min(999, Math.round(+v || 0)));
    el.minutes.value = String(v);
    draft.minutes = v; saveDraft();
  }
  function countdownSet() {
    const m = Math.round(+el.minutes.value || 0);
    if (m <= 0) { el.minutes.focus(); return; }            // original ignores 0
    state.countdown = { running: true, endAt: Date.now() + m * 60000 };
    commit();
  }
  function countdownClear() {
    state.countdown = { running: false, endAt: 0 };
    setMinutes(0);
    commit();
  }

  /* ---------------- message ---------------- */
  function fillTemplateSelect() {
    const sel = el.tpl;
    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '-1'; ph.textContent = entries.length ? '— choose message template —' : '— no template —';
    sel.appendChild(ph);
    entries.forEach((e, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `${i + 1}. ${e.lines.join('  ·  ')}`;
      sel.appendChild(o);
    });
    sel.value = String(draft.sel);
  }
  function selectEntry(i, { focus = false } = {}) {
    if (i < -1 || i >= entries.length) return;
    draft.sel = i;
    if (i >= 0) el.msg.value = entries[i].text;
    el.tpl.value = String(i);
    draft.message = el.msg.value; saveDraft();
    renderRun(); markDirty();
    if (focus) {
      const li = el.runList.children[i];
      if (li) li.scrollIntoView({ block: 'nearest' });
    }
  }
  function messageSet() {
    state.message = el.msg.value.replace(/\s+$/, '');
    state.liveIndex = (draft.sel >= 0 && entries[draft.sel] && entries[draft.sel].text === state.message) ? draft.sel : -1;
    commit();
  }
  function messageClear() {
    el.msg.value = '';
    draft.message = ''; draft.sel = -1; saveDraft();
    el.tpl.value = '-1';
    state.message = ''; state.liveIndex = -1;
    commit();
  }
  function prev() { if (draft.sel > 0) selectEntry(draft.sel - 1, { focus: true }); }
  function next() { if (draft.sel < entries.length - 1) selectEntry(draft.sel + 1, { focus: true }); }
  function markDirty() { el.msg.classList.toggle('dirty', el.msg.value.replace(/\s+$/, '') !== (state.message || '')); }

  /* ---------------- tools / modes ---------------- */
  function doBlink() { state.blinkAt = Date.now(); commit(); }
  function toggleCT() { state.ct = !state.ct; commit(); }
  function setMode(m) { state.ct = false; state.mode = m; commit(); }       // mode buttons switch CT off, like the original
  function togglePower() { state.displayOn = !state.displayOn; commit(); }

  /* ---------------- healing queue ---------------- */
  function healCounts() {
    el.healLCount.textContent = String(lines(el.healL.value).length);
    el.healRCount.textContent = String(lines(el.healR.value).length);
  }
  function healUpdate() {
    state.heal = { left: lines(el.healL.value), right: lines(el.healR.value) };
    commit();
    toast('Healing queue updated');
  }
  function healNext(side) {
    const ta = side === 'L' ? el.healL : el.healR;
    const ls = lines(ta.value); ls.shift();
    ta.value = ls.join('\n');
    draft['heal' + side] = ta.value; saveDraft();
    healCounts();
    healUpdate();
  }

  /* ---------------- render ---------------- */
  function renderRun() {
    el.runCount.textContent = entries.length ? `${entries.length} entries` : '';
    const frag = document.createDocumentFragment();
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      li.dataset.i = String(i);
      if (i === draft.sel) li.classList.add('sel');
      if (i === state.liveIndex && state.message) li.classList.add('live');
      const t1 = document.createElement('div'); t1.className = 't1'; t1.textContent = e.lines[0] || '';
      li.appendChild(t1);
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'LIVE'; li.appendChild(tag);
      const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.title = 'Show on stage';
      go.innerHTML = '<svg><use href="#i-play"/></svg>'; li.appendChild(go);
      if (e.lines.length > 1) { const t2 = document.createElement('div'); t2.className = 't2'; t2.textContent = e.lines.slice(1).join('\n'); li.appendChild(t2); }
      if (e.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = e.note; li.appendChild(n); }
      frag.appendChild(li);
    });
    el.runList.replaceChildren(frag);
  }

  function render() {
    // CT + modes + power
    el.ct.classList.toggle('on', !!state.ct);
    el.ctState.textContent = state.ct ? 'ON' : 'OFF';
    el.strip.querySelectorAll('.seg button').forEach((b) => {
      const on = !state.ct && b.dataset.mode === state.mode;
      b.classList.toggle('sel', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    el.power.classList.toggle('on', !!state.displayOn);
    el.power.classList.toggle('off', !state.displayOn);
    el.power.querySelector('b').textContent = state.displayOn ? 'ON' : 'OFF';
    el.healCard.hidden = state.mode !== 'heal' || state.ct;
    // message preview (first two lines, like the original)
    const ml = String(state.message || '').split('\n');
    el.pvMsg1.textContent = ml[0] || '';
    el.pvMsg2.textContent = ml[1] || '';
    markDirty();
    renderRun();
    tick();
  }

  function tick() {
    el.pvClock.textContent = GMS.clockText(true);
    const info = GMS.countdownInfo(state.countdown);
    el.pvCd.textContent = info.active ? info.mmss : '';
    el.pvCd.classList.toggle('red', !!(info.active && info.red));
  }
  setInterval(tick, 250);

  /* ---------------- stage display window ---------------- */
  let displayWin = null;
  const displays = new Map();   // id -> last status
  async function screenDetails() {
    if (!('getScreenDetails' in window)) return null;
    try { return await window.getScreenDetails(); } catch { return null; }
  }
  function sameScreen(a, b) { return a && b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height; }
  function pickStage(sd) {
    if (!sd) return null;
    if (settings.stageScreen) {
      const s = sd.screens.find((x) => x.label === settings.stageScreen);
      if (s) return s;
    }
    return sd.screens.find((x) => !sameScreen(x, sd.currentScreen)) || null;
  }
  async function openDisplay() {
    if (displayWin && !displayWin.closed) {
      try { displayWin.focus(); } catch {}
      toast('Stage display is already open — click it to go fullscreen');
      return;
    }
    const sd = await screenDetails();
    const scr = pickStage(sd);
    let feat = 'popup';
    if (scr) feat += `,left=${scr.availLeft},top=${scr.availTop},width=${scr.availWidth},height=${scr.availHeight},fullscreen`;
    else feat += ',width=1024,height=640';
    let w = null;
    try { w = window.open('', 'gms-stage', feat); } catch {}
    if (!w) { toast('Pop-up was blocked — click Open display again'); return; }
    try {
      if (w.location.href === 'about:blank') w.location.replace(new URL('display.html', location.href).href);
    } catch {}
    displayWin = w;
    if (!scr) toast(sd ? 'Only one screen found — drag the display window to the stage monitor' : 'Drag the display window to the stage monitor, then double-click it');
  }

  function renderDisplayStatus() {
    const now = Date.now();
    for (const [id, d] of displays) if (now - d.at > 6000) displays.delete(id);
    const list = [...displays.values()];
    const d = list[0];
    let cls = '', text = 'No display';
    if (d) {
      cls = d.fs ? 'ok' : 'warn';
      text = d.fs ? `On stage${d.screen ? ' · ' + d.screen : ''} · ${d.w}×${d.h}` : 'Open — click it to go fullscreen';
      el.pvFrame.style.aspectRatio = `${d.w} / ${d.h}`;
    }
    el.status.className = 'status ' + cls; el.status.textContent = text;
    el.dot.className = 'dot ' + cls;
    let olp = '';
    if (settings.openlpEnabled && settings.openlpUrl) {
      olp = d ? (d.openlp ? 'OpenLP stage view connected' : `Waiting for OpenLP at ${settings.openlpUrl}`) : '';
    }
    el.olpStatus.textContent = olp;
  }
  setInterval(renderDisplayStatus, 1500);

  GMS.on((m) => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') broadcast();
    else if (m.type === 'display-status') { displays.set(m.id, m); renderDisplayStatus(); }
    else if (m.type === 'display-closed') { displays.delete(m.id); renderDisplayStatus(); }
  });

  /* ---------------- floating strip (always on top, Chrome Document PiP) ---------------- */
  let pipWin = null;
  function fitStrip(win = window) {
    const avail = win === window ? Math.min(document.documentElement.clientWidth - 32, STRIP_W) : win.innerWidth;
    const z = Math.min(win === window ? 1 : 2, avail / STRIP_W);
    el.strip.style.zoom = String(z);
    if (win === window) el.ghost.style.zoom = String(z);
  }
  async function floatStrip() {
    if (pipWin) { pipWin.close(); return; }
    if (!('documentPictureInPicture' in window)) { toast('Floating needs Google Chrome or Microsoft Edge'); return; }
    try {
      pipWin = await window.documentPictureInPicture.requestWindow({ width: Math.round(STRIP_W * 0.82), height: Math.round(112 * 0.82) });
    } catch { toast('Could not float the strip'); return; }
    for (const ss of [...document.styleSheets]) {
      try {
        const st = document.createElement('style');
        st.textContent = [...ss.cssRules].map((r) => r.cssText).join('\n');
        pipWin.document.head.appendChild(st);
      } catch {
        if (ss.href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = ss.href; pipWin.document.head.appendChild(l); }
      }
    }
    pipWin.document.title = 'GMS Teleprompter';
    pipWin.document.body.className = 'pip';
    const icons = document.querySelector('svg[aria-hidden]').cloneNode(true);
    pipWin.document.body.append(icons, el.strip);
    el.ghost.hidden = false;
    fitStrip(pipWin);
    pipWin.addEventListener('resize', () => fitStrip(pipWin));
    pipWin.document.addEventListener('keydown', onKey);
    pipWin.addEventListener('pagehide', () => {
      el.stripHome.prepend(el.strip);
      el.ghost.hidden = true;
      pipWin = null;
      fitStrip();
    });
  }

  /* ---------------- settings dialog ---------------- */
  const sDlg = $('settingsDlg'), sForm = $('settingsForm');
  function fillSettingsForm(src) {
    for (const [k, v] of Object.entries(src)) {
      const f = sForm.elements[k];
      if (!f) continue;
      if (f.type === 'checkbox') f.checked = !!v; else f.value = v;
    }
  }
  async function detectScreens(interactive) {
    const sel = $('stageScreen');
    const sd = interactive ? await screenDetails() : null;
    let ok = !!sd;
    if (!interactive) {
      try { ok = (await navigator.permissions.query({ name: 'window-management' })).state === 'granted'; } catch { ok = false; }
    }
    const list = ok ? (sd || await screenDetails()) : null;
    const cur = settings.stageScreen;
    sel.innerHTML = '<option value="">Auto (the other screen)</option>';
    if (list) for (const s of list.screens) {
      const o = document.createElement('option');
      o.value = s.label; o.textContent = `${s.label || 'Screen'} — ${s.width}×${s.height}${s.isPrimary ? ' (main)' : ''}`;
      sel.appendChild(o);
    }
    if (cur && ![...sel.options].some((o) => o.value === cur)) { const o = document.createElement('option'); o.value = cur; o.textContent = cur; sel.appendChild(o); }
    sel.value = cur;
    if (interactive && !list) toast('Screen detection needs Chrome and the “window management” permission');
  }
  function openSettings() {
    fillSettingsForm(settings);
    detectScreens(false);
    $('ver').textContent = GMS.VERSION;
    sDlg.showModal();
  }
  function readSettingsForm() {
    const out = { ...settings };
    for (const k of Object.keys(GMS.DEFAULT_SETTINGS)) {
      const f = sForm.elements[k];
      if (!f) continue;
      if (f.type === 'checkbox') out[k] = f.checked;
      else if (f.type === 'number') {
        const n = Math.round(+f.value);
        out[k] = Number.isFinite(n) && n > 0 ? Math.min(+f.max || 9999, Math.max(+f.min || 1, n)) : GMS.DEFAULT_SETTINGS[k];
      } else out[k] = f.value;
    }
    return out;
  }
  sForm.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'save') {
      settings = readSettingsForm();
      GMS.save(GMS.K.settings, settings);
      commit();
      touchOpenlp();
      toast('Settings have been saved');
    }
  });
  $('resetSettings').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset to default?')) fillSettingsForm(GMS.DEFAULT_SETTINGS);
  });
  $('detectScreens').addEventListener('click', () => detectScreens(true));
  $('reloadOlp').addEventListener('click', () => { GMS.post({ type: 'reload-openlp' }); toast('Reloading OpenLP stage view'); });

  /* ---------------- template editor ---------------- */
  const tDlg = $('tplDlg'), tForm = $('tplForm'), tText = $('tplText');
  function openTemplate() { tText.value = templateText; tDlg.showModal(); tText.focus(); }
  function applyTemplate(text) {
    templateText = text;
    GMS.saveText(GMS.K.template, templateText);
    entries = GMS.parseTemplate(templateText);
    if (draft.sel >= entries.length) draft.sel = -1;
    if (state.liveIndex >= entries.length) state.liveIndex = -1;
    saveDraft();
    fillTemplateSelect();
    renderRun();
  }
  tForm.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'save') { applyTemplate(tText.value); toast('Message template has been saved'); }
  });
  tDlg.addEventListener('cancel', (e) => {
    if (tText.value !== templateText && !confirm('Are you sure you want to close the editor?')) e.preventDefault();
  });
  tForm.querySelector('.x').addEventListener('click', (e) => {
    if (tText.value !== templateText && !confirm('Are you sure you want to close the editor?')) e.preventDefault();
  });
  $('tplImport').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    tText.value = await f.text();
    e.target.value = '';
    toast(`Loaded ${f.name} — press Save to use it`);
  });
  $('tplExport').addEventListener('click', () => {
    const blob = new Blob([tText.value.replace(/\r?\n/g, '\r\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'template.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------------- help dialog (OpenLP / ProPresenter) ---------------- */
  const hDlg = $('helpDlg');
  const helpTabs = [...hDlg.querySelectorAll('[role="tab"]')];
  const HELP_TAB_KEY = 'gmsTele.helpTab.v1';
  function selectHelpTab(name, focus) {
    const tab = helpTabs.find((t) => t.dataset.tab === name) || helpTabs[0];
    for (const t of helpTabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
    try { localStorage.setItem(HELP_TAB_KEY, tab.dataset.tab); } catch {}
  }
  function openHelp() {
    let last = 'openlp';
    try { last = localStorage.getItem(HELP_TAB_KEY) || last; } catch {}
    selectHelpTab(last, false);
    hDlg.showModal();
  }
  helpTabs.forEach((t, i) => {
    t.addEventListener('click', () => selectHelpTab(t.dataset.tab, true));
    t.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % helpTabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + helpTabs.length) % helpTabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = helpTabs.length - 1;
      if (j >= 0) { e.preventDefault(); selectHelpTab(helpTabs[j].dataset.tab, true); }
    });
  });
  $('helpToSettings').addEventListener('click', () => { hDlg.close(); openSettings(); });

  /* ---------------- wiring ---------------- */
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('minUp', () => setMinutes((+el.minutes.value || 0) + 1));
  on('minDown', () => setMinutes((+el.minutes.value || 0) - 1));
  el.minutes.addEventListener('change', () => setMinutes(el.minutes.value));
  el.minutes.addEventListener('keydown', (e) => { if (e.key === 'Enter') { setMinutes(el.minutes.value); countdownSet(); } });
  on('cdSet', countdownSet);
  on('cdClr', countdownClear);

  el.tpl.addEventListener('change', () => selectEntry(+el.tpl.value));
  el.msg.addEventListener('input', () => { draft.message = el.msg.value; saveDraft(); markDirty(); });
  on('prev', prev); on('next', next);
  on('msgSet', messageSet); on('msgClr', messageClear);
  on('editTpl', openTemplate); on('editTpl2', openTemplate);

  on('blink', doBlink); on('ct', toggleCT); on('power', togglePower);
  el.strip.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  on('openDisplay', openDisplay); on('openDisplay2', openDisplay);
  on('floatBtn', floatStrip); on('unfloat', () => pipWin && pipWin.close());
  on('settingsBtn', openSettings);
  on('helpBtn', openHelp);

  el.runList.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    selectEntry(+li.dataset.i);
    if (e.target.closest('.go')) messageSet();
  });
  el.runList.addEventListener('dblclick', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    selectEntry(+li.dataset.i); messageSet();
  });

  el.healL.addEventListener('input', () => { draft.healL = el.healL.value; saveDraft(); healCounts(); });
  el.healR.addEventListener('input', () => { draft.healR = el.healR.value; saveDraft(); healCounts(); });
  on('healUpdate', healUpdate);
  on('healLNext', () => healNext('L'));
  on('healRNext', () => healNext('R'));

  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'Enter') { e.preventDefault(); messageSet(); flash($('msgSet')); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); prev(); flash($('prev')); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); next(); flash($('next')); }
  }
  document.addEventListener('keydown', onKey);

  // other control tabs (rare) stay in sync through storage events
  window.addEventListener('storage', (e) => {
    if (e.key === GMS.K.state) { state = GMS.load(GMS.K.state, GMS.DEFAULT_STATE); render(); }
    else if (e.key === GMS.K.settings) { settings = GMS.load(GMS.K.settings, GMS.DEFAULT_SETTINGS); }
    else if (e.key === GMS.K.template) { applyTemplate(GMS.loadText(GMS.K.template, GMS.DEFAULT_TEMPLATE)); }
  });

  window.addEventListener('resize', () => { if (!pipWin) fitStrip(); });

  // Touch the OpenLP URL from this window too, so Chrome asks for local-network access here (where the operator is)
  function touchOpenlp() {
    const u = settings.openlpEnabled ? (settings.openlpUrl || '').trim() : '';
    if (u) fetch(u, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  }

  /* ---------------- boot ---------------- */
  setMinutes(draft.minutes || 0);
  el.msg.value = draft.message || '';
  el.healL.value = draft.healL || '';
  el.healR.value = draft.healR || '';
  healCounts();
  fillTemplateSelect();
  fitStrip();
  render();
  broadcast();
  GMS.post({ type: 'ping' });
  touchOpenlp();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
