(function () {
  'use strict';
  const D = window.SEED, I = window.I18N;
  const $ = (s, r = document) => r.querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* الحالة داخل الصفحة نفسها */
  const S = {
    lang: 'ar', theme: 'dark',
    reports: clone(D.reports),
    altRoutes: D.altRoutesToday,
    agents: { plan: 'plan_idle', comp: 'comp_idle', rep: 'rep_idle' },
    phone: false, step: 1, rated: false, timers: [],
    modes: { map: true, sound: false, vib: true }
  };

  const t = (k, v) => {
    let s = (I[S.lang][k] ?? I.ar[k] ?? k);
    if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]);
    return s;
  };
  const L = (o) => (o && (o[S.lang] || o.ar)) || '';
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const place = (id) => D.places.find((p) => p.id === id);

  /* ===== درجة الموثوقية: قواعد واضحة ===== */
  function penalty(r) {
    const high = r.severity === 'high';
    let p = 0;
    if (r.status === 'confirmed' || r.status === 'forwarded') p = high ? 3 : 2;
    else if (r.status === 'pending') p = high ? 1.5 : 1;
    else if (r.status === 'temporary') p = 1;
    return p + Math.max(0, (r.merged || 1) - 1) * 0.5;
  }
  function score(pid) {
    const pl = place(pid);
    let s = 10 - Math.min(2, pl.faults90 * 0.3);
    S.reports.filter((r) => r.place === pid).forEach((r) => { s -= penalty(r); });
    return Math.max(0, Math.round(s * 10) / 10);
  }
  const level = (s) => (s >= 7 ? 'high' : s >= 4 ? 'medium' : 'low');
  function reason(pid) {
    const rs = S.reports.filter((r) => r.place === pid).sort((a, b) => penalty(b) - penalty(a));
    if (!rs.length) return t('reasonNone');
    return t('reasonFrom', { t: L(rs[0].title), s: statusWord(rs[0]) });
  }
  function levelChip(s) {
    const lv = level(s), n = lv === 'high' ? 3 : lv === 'medium' ? 2 : 1;
    const dots = [0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    return `<span class="level ${lv}"><span class="dots" aria-hidden="true">${dots}</span>${t('lvl_' + lv)}</span>`;
  }
  function statusWord(r) {
    return r.status === 'forwarded' ? t('st_forwarded', { a: L(D.authorities[r.authority]) }) : t('st_' + r.status);
  }

  /* ===== نصوص ثابتة ===== */
  function renderStatic() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = S.theme;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    const lb = $('#langBtn'); lb.textContent = t('langBtn'); lb.lang = S.lang === 'ar' ? 'en' : 'ar';
    $('#themeLabel').textContent = S.theme === 'dark' ? t('themeLight') : t('themeDark');
    $('#map').setAttribute('aria-label', t('mapTitle'));
  }

  /* ===== الأرقام ===== */
  function renderKPIs() {
    $('#kpiReports').textContent = S.reports.length;
    $('#kpiAlt').textContent = S.altRoutes;
    const worst = D.places.map((p) => ({ p, s: score(p.id) })).sort((a, b) => a.s - b.s)[0];
    $('#kpiWorst').textContent = L(worst.p.name);
    $('#kpiWorstNote').textContent = `${t('kpiWorstNote')}: ${worst.s.toFixed(1)}/10`;
  }
  function bump(id) {
    const el = $(id).closest('.kpi'); el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 2500);
  }

  /* ===== قائمة الأماكن ===== */
  function renderPlaces() {
    $('#placeList').innerHTML = D.places.map((p) => {
      const s = score(p.id);
      return `<li class="place" id="pl-${p.id}">
        ${levelChip(s)}
        <div><div class="place-name">${L(p.name)}</div><div class="place-reason">${reason(p.id)}</div></div>
        <div class="score">${s.toFixed(1)}<small>/10</small></div></li>`;
    }).join('');
  }
  function flashPlace(id) {
    const el = $('#pl-' + id); if (!el) return;
    el.classList.add('flash'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => el.classList.remove('flash'), 2000);
  }

  /* ===== البلاغات ===== */
  const stChip = {
    confirmed: ['warn', 'i-stop'], pending: ['muted', 'i-clock'], temporary: ['info', 'i-hourglass'], forwarded: ['ok', 'i-check']
  };
  const issueIc = { elevator: 'i-elevator', ramp: 'i-ramp', door: 'i-door' };
  function renderReports() {
    const sev = { high: 0, medium: 1 };
    const list = S.reports.slice().sort((a, b) => (sev[a.severity] - sev[b.severity]) || (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.time.localeCompare(a.time));
    $('#reports').innerHTML = list.map((r) => {
      const [tone, ic] = stChip[r.status];
      const canApprove = r.status === 'pending' || r.status === 'temporary';
      const canForward = r.status !== 'forwarded';
      return `<li class="report${r.live && r.fresh ? ' is-new fade-in' : ''}">
        <div class="report-top">
          <span class="report-ic">${icon(issueIc[r.issue])}</span>
          <div style="flex:1;min-width:0">
            <div class="report-title">${L(r.title)}</div>
            <div class="report-meta"><span>${icon('i-pin', 'ic')} ${L(place(r.place).name)}</span><span>${t('issue_' + r.issue)}</span><span>${r.time}</span></div>
          </div>
        </div>
        <div class="chips">
          ${r.live && r.fresh ? `<span class="chip new">${t('newBadge')}</span>` : ''}
          <span class="chip ${tone}">${icon(ic)}${statusWord(r)}</span>
          <span class="chip ${r.severity === 'high' ? 'warn' : 'muted'}">${t('sev_' + r.severity)}</span>
          ${r.merged > 1 ? `<span class="chip info">${icon('i-branch')}${r.merged === 2 ? t('merged') : t('mergedN', { n: r.merged })}</span>` : ''}
        </div>
        ${r.status === 'temporary' ? `<div class="muted">${t('expires', { h: r.expires })}</div>` : ''}
        <ul class="checks">${r.checks.map((c) => `<li>${t('ck_' + c)}</li>`).join('')}</ul>
        ${r.draft ? `<div class="draft"><b>${t('draftLabel')}</b>${L(r.draft)}</div>` : ''}
        <div class="report-actions">
          <span class="authority">${t('suggested')}: <b>${L(D.authorities[r.authority])}</b></span>
          <span style="flex:1"></span>
          ${canApprove ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${r.id}" type="button">${t('approve')}</button>` : ''}
          ${canForward ? `<button class="btn btn-ghost btn-sm" data-act="forward" data-id="${r.id}" type="button">${icon('i-send', 'ic flip')}${t('forward')}</button>` : ''}
        </div></li>`;
    }).join('');
  }
  $('#reports').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const r = S.reports.find((x) => x.id === b.dataset.id); if (!r) return;
    r.fresh = false;
    if (b.dataset.act === 'approve') {
      r.status = 'confirmed';
      setAgent('rep', 'rep_approved'); setAgent('plan', 'plan_update');
    } else {
      r.status = 'forwarded';
      setAgent('rep', 'rep_forwarded');
    }
    refreshBoard(); flashPlace(r.place);
  });

  /* ===== الوكلاء ===== */
  const agentDefs = [
    { k: 'plan', ic: 'i-map' }, { k: 'comp', ic: 'i-wheel' }, { k: 'rep', ic: 'i-flag' }
  ];
  function renderAgents() {
    $('#agents').innerHTML = agentDefs.map((a) => `<div class="agent" id="ag-${a.k}">
      <div class="agent-head"><span class="agent-ic">${icon(a.ic)}</span>
        <div><div class="agent-name">${t('ag_' + a.k)}</div><div class="agent-when">${t('ag_' + a.k + '_when')}</div></div></div>
      <div class="agent-now">${t('nowDid')}:</div>
      <div class="agent-did">«${t(S.agents[a.k])}»</div></div>`).join('');
  }
  function setAgent(k, key) {
    S.agents[k] = key; renderAgents();
    const el = $('#ag-' + k); el.classList.add('pulse');
    setTimeout(() => el && el.classList.remove('pulse'), 2500);
  }

  /* ===== الخريطة ===== */
  let map = null, markers = {}, fallback = false;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function mapStyle() {
    return {
      version: 8,
      sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': css('--map-land') } },
        { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': css('--map-bg'), 'fill-opacity': 0.6 } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': css('--map-water') } },
        { id: 'bld', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': css('--map-bg'), 'fill-opacity': 0.7 } },
        { id: 'minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', 'class', 'minor', 'service', 'tertiary'],
          paint: { 'line-color': css('--map-road'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 15, 3] } },
        { id: 'major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', 'class', 'primary', 'secondary', 'trunk', 'motorway'],
          paint: { 'line-color': css('--map-major'), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 15, 7] } },
        { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', 'class', 'rail', 'transit'],
          paint: { 'line-color': css('--map-rail'), 'line-width': 1.5, 'line-dasharray': [3, 2] } }
      ]
    };
  }
  function markerEl(p) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'marker';
    b.addEventListener('click', () => flashPlace(p.id));
    return b;
  }
  function paintMarker(el, p) {
    const s = score(p.id);
    const [dx, dy] = OFFS[p.id] || [0, -34];
    el.classList.remove('high', 'medium', 'low'); el.classList.add(level(s));
    el.innerHTML = `<span class="marker-pin"></span><span class="marker-bubble" style="--dx:${dx}px;--dy:${dy}px"><span class="marker-dot ${level(s)}"><span>${s.toFixed(1)}</span></span><span class="marker-name">${L(p.name)}</span></span>`;
    el.setAttribute('aria-label', `${L(p.name)}: ${s.toFixed(1)}/10, ${t('lvl_' + level(s))}`);
  }
  /* إزاحة الفقاعة عن النقطة عشان الأماكن القريبة ما تتغطى */
  const OFFS = { pnu: [0, -34], museum: [0, -34], kafd: [86, -30], rpark: [40, 36], blvd: [-96, -28] };
  function renderMarkers() { D.places.forEach((p) => markers[p.id] && paintMarker(markers[p.id], p)); }

  function initMap() {
    const box = $('#map');
    let loaded = false;
    try {
      map = new maplibregl.Map({
        container: box, style: mapStyle(), attributionControl: false,
        bounds: [[46.585, 24.635], [46.735, 24.865]], fitBoundsOptions: { padding: 50 },
        dragRotate: false, pitchWithRotate: false, cooperativeGestures: true
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      const fit = () => map.fitBounds([[46.585, 24.635], [46.735, 24.865]], { padding: 50, duration: 0 });
      map.on('load', () => { loaded = true; map.resize(); fit(); });
      if ('ResizeObserver' in window) new ResizeObserver(() => { if (map) { map.resize(); fit(); } }).observe(box);
      D.places.forEach((p) => {
        const el = markerEl(p); markers[p.id] = el; paintMarker(el, p);
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
      });
      setTimeout(() => { if (!loaded) useFallback(); }, 12000);
    } catch (e) { useFallback(); }
  }
  function useFallback() {
    if (fallback) return; fallback = true;
    try { map && map.remove(); } catch (e) { /* ignore */ }
    map = null; markers = {};
    const box = $('#map'); box.innerHTML = '';
    const w = document.createElement('div'); w.className = 'map-fallback';
    const [x0, x1, y0, y1] = [46.585, 46.735, 24.635, 24.865];
    D.places.forEach((p) => {
      const el = markerEl(p); markers[p.id] = el; paintMarker(el, p);
      el.style.left = ((p.lng - x0) / (x1 - x0) * 100) + '%';
      el.style.top = ((y1 - p.lat) / (y1 - y0) * 100) + '%';
      w.appendChild(el);
    });
    const note = document.createElement('p'); note.dataset.i18n = 'mapFallback'; note.textContent = t('mapFallback');
    w.appendChild(note); box.appendChild(w);
  }

  function refreshBoard() { renderKPIs(); renderPlaces(); renderReports(); renderMarkers(); }

  /* ===== الاهتزاز والصوت ===== */
  const VIB = {
    blocked: [120, 80, 120, 80, 120], notready: [700], right: [150, 100, 150], left: [150, 100, 450],
    lift: [450, 100, 150], next: [80, 60, 80, 60, 80, 60, 80], arrive: [400, 150, 400]
  };
  let vibTimers = [];
  function buzz(kind) {
    const pat = VIB[kind];
    if (S.modes.vib && navigator.vibrate) { try { navigator.vibrate(pat); } catch (e) { /* ignore */ } }
    const bar = $('#vibBar');
    bar.hidden = !S.modes.vib;
    S.lastVib = kind; $('#vibLabel').textContent = t('vib_' + kind);
    const pulses = pat.filter((_, i) => i % 2 === 0);
    $('#vibPulses').innerHTML = pulses.map((ms) => `<i style="width:${Math.max(8, ms / 14)}px"></i>`).join('');
    vibTimers.forEach(clearTimeout); vibTimers = [];
    const els = $('#vibPulses').children;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { [...els].forEach((e) => e.classList.add('on')); return; }
    let at = 0;
    pat.forEach((ms, i) => {
      if (i % 2 === 0) {
        const el = els[i / 2];
        vibTimers.push(setTimeout(() => el.classList.add('on'), at));
        vibTimers.push(setTimeout(() => el.classList.remove('on'), at + ms));
      }
      at += ms;
    });
    vibTimers.push(setTimeout(() => [...els].forEach((e) => e.classList.add('on')), at + 100));
  }
  function say(text) {
    if (!S.modes.sound || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = S.lang === 'ar' ? 'ar-SA' : 'en-US'; u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  /* ===== التطبيق: الرحلة الذهبية ===== */
  const head = (n) => `<div class="scr-step"><span>${t('step', { n })}</span><span class="progress" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span></div>`;
  const comp = (txt) => `<div class="companion"><svg class="mark" aria-hidden="true"><use href="#logo"/></svg><div>${txt}</div></div>`;
  const modeBtn = (k, ic) => `<button class="mode" type="button" data-mode="${k}" aria-pressed="${S.modes[k]}">${icon('i-check', 'tick')}${icon(ic)}<span>${t('mode_' + k)}</span><span class="on-word">${t('active')}</span></button>`;

  const screens = {
    1: () => `${head(1)}
      <h2 class="scr-title">${t('where')}</h2>
      <div class="p-card"><div class="od"><span>${t('from')}</span><b>${L(place('pnu').name)}</b><span>${t('to')}</span><b>${L(place('kafd').name)}</b></div></div>
      <div class="p-card">
        <div class="chips"><span class="chip ok">${icon('i-check')}${t('stepFree')}</span>${levelChip((score('pnu') + score('kafd')) / 2)}</div>
        <div class="p-row">${icon('i-elevator')}<span>${t('liftEntrances')}</span></div>
        <div class="p-row">${icon('i-clock')}<b>${t('duration')}</b><span class="muted">· ${t('metroLine')}</span></div>
        <p class="reason">${t('reasonRoute')}</p>
      </div>
      ${comp(t('planLine'))}
      <div><div class="muted" style="margin-bottom:6px">${t('modesTitle')}</div>
        <div class="modes">${modeBtn('map', 'i-map')}${modeBtn('sound', 'i-sound')}${modeBtn('vib', 'i-vib')}</div></div>
      <div class="actions">
        <button class="btn btn-primary btn-block" data-go="start" type="button">${t('start')}${icon('i-arrow', 'ic flip')}</button>
        <button class="btn btn-ghost btn-block" data-go="help" type="button">${icon('i-help')}${t('help')}</button>
      </div>`,
    2: () => `${head(2)}
      ${S.modes.map ? `<div class="big-ic info">${icon('i-metro')}</div>` : ''}
      <p class="instruction">${t('ride')}</p>
      <p>${t('rideSub')}</p>
      <div class="line-stops" aria-hidden="true"><span>${L(place('pnu').name)}</span><span class="seg on"></span><span class="seg"></span><span>KAFD</span></div>
      <p class="muted">${t('stops')}</p>
      <div class="p-card fade-in" id="announce" hidden><div class="p-row">${icon('i-sound')}<b>${t('announce')}</b></div><p>${t('announceText')}</p></div>`,
    3: () => `${head(3)}
      <div class="chips"><span class="chip warn">${icon('i-stop')}${t('st_stopped')} ✕</span></div>
      ${S.modes.map ? `<div class="big-ic warn">${icon('i-elevator')}</div>` : ''}
      ${comp(`<span class="instruction" style="font-size:22px">${t('obstacle')}</span>`)}
      <div class="p-card alt">
        <div class="chips"><span class="chip info">${icon('i-branch')}${t('altPlan')}</span></div>
        <h3>${t('altDesc')}</h3><p>${t('altDir')}</p>
      </div>
      <div class="actions"><button class="btn btn-primary btn-block" data-go="take" type="button">${t('takeMe')}${icon('i-arrow', 'ic flip')}</button></div>`,
    4: () => `${head(4)}
      ${S.modes.map ? `<div class="big-ic info">${icon('i-flag')}</div>` : ''}
      <h2 class="scr-title">${t('permQ')}</h2>
      ${comp(t('permNote'))}
      <div class="p-card"><div class="kv"><span>${t('permPlace')}</span><b>${t('permPlaceV')}</b><span>${t('permType')}</span><b>${t('permTypeV')}</b></div>
        <p class="reason">${icon('i-check', 'ic')} ${t('ck_presence')} · ${t('permNo')}</p></div>
      <div class="actions">
        <button class="btn btn-primary btn-block" data-go="yes" type="button">${t('yes')}</button>
        <button class="btn btn-ghost btn-block" data-go="no" type="button">${t('noThanks')}</button>
      </div>`,
    5: () => `${head(5)}
      <div class="big-ic ok">${icon('i-check')}</div>
      <h2 class="scr-title">${t('arrived')}</h2>
      ${S.rated ? `${comp(t('thanks'))}<div class="actions"><button class="btn btn-ghost btn-block" data-go="again" type="button">${t('again')}</button></div>`
        : `<p class="instruction">${t('how')}</p>
      <div class="rate actions">
        <button class="btn btn-primary btn-block" data-go="rate" type="button">${t('r_comfy')}</button>
        <button class="btn btn-ghost btn-block" data-go="rate" type="button">${t('r_ok')}</button>
        <button class="btn btn-ghost btn-block" data-go="rate" type="button">${t('r_hard')}</button>
      </div>`}`
  };

  function clearTimers() { S.timers.forEach(clearTimeout); S.timers = []; }
  function renderScreen(focus) {
    const sc = $('#screen');
    sc.innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:16px;flex:1">${screens[S.step]()}</div>`;
    sc.firstElementChild.style.minHeight = '100%';
    sc.scrollTop = 0;
    if (S.step === 2 && S.announced) $('#announce').hidden = false;
    if (focus) { const h = sc.querySelector('.scr-title, .instruction'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }
  function go(step) {
    clearTimers(); S.step = step; renderScreen(true);
    if (step === 2) {
      S.announced = false;
      setAgent('comp', 'comp_ride'); buzz('right'); say(t('ride') + ' ' + t('rideSub'));
      S.timers.push(setTimeout(() => { S.announced = true; const a = $('#announce'); if (a) a.hidden = false; buzz('next'); say(t('announceText')); }, 2500));
      S.timers.push(setTimeout(() => go(3), 7000));
    }
    if (step === 3) {
      buzz('blocked'); say(t('obstacle'));
      S.altRoutes += 1; setAgent('comp', 'comp_reroute'); refreshBoard(); bump('#kpiAlt');
    }
    if (step === 4) { buzz('left'); setAgent('rep', 'rep_draft'); say(t('permQ') + ' ' + t('permNote')); }
    if (step === 5) { buzz('arrive'); setAgent('comp', 'comp_arrived'); say(t('arrived') + ' ' + t('how')); }
  }
  function sendReport() {
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const ex = S.reports.find((r) => r.id === 'live');
    if (ex) { ex.merged += 1; ex.fresh = true; ex.time = time; }
    else S.reports.push(Object.assign(clone(D.journeyReport), { time, fresh: true }));
    setAgent('rep', 'rep_sent'); refreshBoard(); bump('#kpiReports'); flashPlace('kafd');
    toast(t('sentToast'));
  }
  function toast(msg) {
    const el = $('#toast'); el.innerHTML = icon('i-check') + msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  $('#screen').addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { const k = m.dataset.mode; S.modes[k] = !S.modes[k]; m.setAttribute('aria-pressed', S.modes[k]); if (k === 'vib' && !S.modes.vib) $('#vibBar').hidden = true; return; }
    const b = e.target.closest('[data-go]'); if (!b) return;
    const a = b.dataset.go;
    if (a === 'start') go(2);
    else if (a === 'help') openSheet(`<h3 id="sheetTitle">${t('help')}</h3><p>${t('helpText')}</p><button class="btn btn-primary btn-block" data-close type="button">${t('ok')}</button>`);
    else if (a === 'take') go(4);
    else if (a === 'yes') { sendReport(); go(5); }
    else if (a === 'no') { setAgent('rep', 'rep_skip'); go(5); }
    else if (a === 'rate') { S.rated = true; renderScreen(true); }
    else if (a === 'again') { S.rated = false; $('#vibBar').hidden = true; setAgent('comp', 'comp_idle'); go(1); }
  });

  /* ===== الورقة السفلية ===== */
  let lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    $('#sheetBody').innerHTML = html; $('#sheet').hidden = false;
    const f = $('#sheetBody').querySelector('button'); f && f.focus();
  }
  function closeSheet() { $('#sheet').hidden = true; lastFocus && lastFocus.focus && lastFocus.focus(); }
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet' || e.target.closest('[data-close]')) return closeSheet();
    const tr = e.target.closest('[data-try]'); if (tr) buzz(tr.dataset.try);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  $('#vibWhat').addEventListener('click', () => {
    openSheet(`<h3 id="sheetTitle">${t('vibList')}</h3>` + Object.keys(VIB).map((k) => {
      const pulses = VIB[k].filter((_, i) => i % 2 === 0).map((ms) => `<i class="on" style="width:${Math.max(8, ms / 14)}px"></i>`).join('');
      return `<div class="vib-item"><b>${t('vib_' + k)}</b><span class="vib-pulses" aria-hidden="true">${pulses}</span><button class="btn btn-ghost btn-sm" data-try="${k}" type="button">${t('vibTry')}</button></div>`;
    }).join('') + `<button class="btn btn-primary btn-block" data-close type="button">${t('close')}</button>`);
  });

  /* ===== فتح/إغلاق الجوال ===== */
  function setPhone(open) {
    S.phone = open;
    $('#phoneWrap').hidden = !open;
    $('#layout').classList.toggle('with-phone', open);
    $('#tryBtn').setAttribute('aria-expanded', open);
    if (open) {
      if (S.step === 1) setAgent('plan', 'plan_done');
      renderScreen(false);
      const h = $('#screen .scr-title, #screen .instruction'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      if (matchMedia('(max-width: 1100px)').matches) document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      $('#tryBtn').focus();
    }
  }
  $('#tryBtn').addEventListener('click', () => setPhone(!S.phone));
  $('#backBtn').addEventListener('click', () => setPhone(false));

  $('#langBtn').addEventListener('click', () => {
    S.lang = S.lang === 'ar' ? 'en' : 'ar';
    renderStatic(); refreshBoard(); renderAgents(); if (S.phone) renderScreen(false);
    if (S.lastVib) $('#vibLabel').textContent = t('vib_' + S.lastVib);
  });
  $('#themeBtn').addEventListener('click', () => {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    renderStatic();
    if (map) map.setStyle(mapStyle());
  });

  /* بداية */
  renderStatic(); refreshBoard(); renderAgents(); initMap();
})();
