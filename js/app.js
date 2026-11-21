(function () {
  'use strict';
  const D = window.SEED, I = window.I18N;
  const $ = (s, r = document) => r.querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* الحالة داخل الصفحة نفسها (مشتركة بين الواجهتين) */
  const S = {
    lang: 'ar', theme: 'dark', view: 'home',
    reports: clone(D.reports), altRoutes: D.altRoutesToday, mergeShown: false,
    modes: { map: true, sound: false, vib: true },
    u: { mode: 'search', dest: null, i: 0, q: '', rated: false },
    timers: [], open: {}
  };
  const t = (k, v) => { let s = I[S.lang][k] ?? I.ar[k] ?? k; if (v) for (const n in v) s = s.split('{' + n + '}').join(v[n]); return s; };
  const L = (o) => (o && (o[S.lang] || o.ar)) || '';
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const place = (id) => D.places.find((p) => p.id === id);
  const spark = (txt, cls = '') => `<div class="ai ${cls}">${icon('i-spark', 'ic ai-ic')}<span>${txt}</span></div>`;

  /* ===== الموثوقية: قواعد واضحة ===== */
  function penalty(r) {
    const high = r.severity === 'high'; let p = 0;
    if (r.status === 'confirmed' || r.status === 'forwarded') p = high ? 3 : 2;
    else if (r.status === 'pending') p = high ? 1.5 : 1;
    else if (r.status === 'temporary') p = 1;
    return p + Math.max(0, (r.merged || 1) - 1) * 0.5;
  }
  function score(pid) {
    let s = 10 - Math.min(2, place(pid).faults90 * 0.3);
    S.reports.forEach((r) => { if (r.place === pid) s -= penalty(r); });
    return Math.max(0, Math.round(s * 10) / 10);
  }
  const level = (s) => (s >= 7 ? 'high' : s >= 4 ? 'medium' : 'low');
  const dots = (lv) => { const n = lv === 'high' ? 3 : lv === 'medium' ? 2 : 1; return `<span class="dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; };
  const levelChip = (pid, long) => { const lv = level(score(pid)); return `<span class="level ${lv}">${dots(lv)}${t((long ? 'lvl_' : 'lvlS_') + lv)}</span>`; };
  const FEATS = ['elevator', 'ramp', 'entrance', 'toilet', 'parking'];
  const issueFeat = { elevator: 'elevator', ramp: 'ramp', door: 'entrance' };
  function feat(pid, f) {
    const base = place(pid).feats[f]; if (base === 'none') return 'none';
    return S.reports.some((r) => r.place === pid && issueFeat[r.issue] === f && r.status !== 'forwarded') ? 'down' : base;
  }
  const featMark = { ok: '✓', down: '✕', none: '–' };

  /* ===== عام ===== */
  function renderStatic() {
    const h = document.documentElement;
    h.lang = S.lang; h.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; h.dataset.theme = S.theme;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-act=lang]').forEach((b) => { b.textContent = t('langBtn'); b.setAttribute('aria-label', t('langName')); b.lang = S.lang === 'ar' ? 'en' : 'ar'; });
    document.querySelectorAll('[data-act=theme]').forEach((b) => b.setAttribute('aria-label', t('theme')));
    $('#switchLabel').textContent = S.view === 'gov' ? t('viewUser') : t('viewGov');
  }
  function toast(msg) {
    const el = $('#toast'); el.innerHTML = icon('i-check') + `<span>${msg}</span>`; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3200);
  }
  let lastFocus = null;
  function openSheet(html) { lastFocus = document.activeElement; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; const f = $('#sheetBody button'); f && f.focus(); }
  function closeSheet() { $('#sheet').hidden = true; lastFocus && lastFocus.focus && lastFocus.focus(); }

  /* الاهتزاز والصوت */
  const VIB = { blocked: [120, 80, 120, 80, 120], notready: [700], right: [150, 100, 150], left: [150, 100, 450], lift: [450, 100, 150], next: [80, 60, 80, 60, 80, 60, 80], arrive: [400, 150, 400] };
  const pulses = (k) => VIB[k].filter((_, i) => i % 2 === 0).map((ms) => `<i style="width:${Math.max(8, ms / 14)}px"></i>`).join('');
  function buzz(k) {
    S.lastVib = k;
    if (S.modes.vib && navigator.vibrate) { try { navigator.vibrate(VIB[k]); } catch (e) { /* ignore */ } }
    const bar = $('#vibBar'); if (!bar) return;
    bar.hidden = !S.modes.vib; bar.querySelector('.vib-p').innerHTML = pulses(k); bar.querySelector('.vib-l').textContent = t('vib_' + k);
    const els = [...bar.querySelectorAll('.vib-p i')];
    if (reduce()) { els.forEach((e) => e.classList.add('on')); return; }
    let at = 0; VIB[k].forEach((ms, i) => { if (i % 2 === 0) { const e = els[i / 2]; setTimeout(() => e.classList.add('on'), at); setTimeout(() => e.classList.remove('on'), at + ms); } at += ms; });
  }
  /* يختار أوضح صوت موجود بالجهاز: سعودي أولاً، ثم عربي، والأصوات الطبيعية والرجالية لها أولوية */
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const ar = S.lang === 'ar', vs = speechSynthesis.getVoices().filter((v) => (v.lang || '').toLowerCase().startsWith(ar ? 'ar' : 'en'));
    const score = (v) => (/sa/i.test(v.lang) ? 4 : 0) + (/natural|neural|premium|enhanced|online/i.test(v.name) ? 3 : 0) + (/google|microsoft/i.test(v.name) ? 1 : 0)
      + (/maged|majed|hamed|naayf|tarik|shakir|fahed|male|daniel|guy/i.test(v.name) ? 2 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0] || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => { S.voice = null; });
  function say(key) {
    if (!S.modes.sound || !('speechSynthesis' in window)) return;
    const text = I[S.lang]['say_' + key] || t('s_' + key);
    try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text), v = pickVoice();
      if (v) u.voice = v; u.lang = v ? v.lang : (S.lang === 'ar' ? 'ar-SA' : 'en-US'); u.rate = 0.92; u.pitch = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  /* ===== التنقل بين الواجهات ===== */
  let userMap = null, govMap = null;
  const METRO = [D.routes.kafd.pts, D.routes.museum.pts];
  function setView(v) {
    S.view = v; document.body.dataset.view = v; renderStatic(); window.scrollTo(0, 0);
    if (v === 'user') {
      if (!userMap) userMap = MapView($('#userMap'), { pad: userPad, lines: METRO });
      renderUser(true);
    } else if (v === 'gov') {
      if (!govMap) govMap = MapView($('#govMap'), { lines: METRO, pad: () => ({ t: 90, r: 110, b: 70, l: 110 }) });
      renderGov(true);
    }
    const h = document.querySelector(v === 'home' ? '#homeName' : v === 'user' ? '#panel h1' : '#gov h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  function userPad() {
    const wide = matchMedia('(min-width: 900px)').matches, p = $('#panel');
    if (wide) { const w = p.offsetWidth + 40; return S.lang === 'ar' ? { t: 90, r: w + 40, b: 90, l: 110 } : { t: 90, r: 110, b: 90, l: w + 40 }; }
    return { t: 50, r: 60, b: 60, l: 60 };
  }

  /* ===== واجهة المستخدم ===== */
  function clearTimers() { S.timers.forEach(clearTimeout); S.timers = []; }
  const later = (fn, ms) => S.timers.push(setTimeout(fn, ms));
  const featRow = (pid) => `<span class="feats">${FEATS.map((f) => { const s = feat(pid, f); return `<span class="feat ${s}" title="${t('f_' + f)}: ${t('fs_' + s)}">${icon('i-' + f)}<span class="sr">${t('f_' + f)}: ${t('fs_' + s)}</span></span>`; }).join('')}</span>`;
  const topRow = (back) => `<div class="p-top">${back ? `<button class="icon-btn" data-u="back" type="button" aria-label="${t('back')}">${icon('i-arrow', 'ic flip')}</button>` : '<span></span>'}<span class="p-top-end">${S.u.mode === 'trip' ? `<button class="pill-btn" data-u="help" type="button">${icon('i-help')}<span>${t('help')}</span></button>` : ''}<button class="icon-btn" data-u="settings" type="button" aria-label="${t('settings')}">${icon('i-gear')}</button></span></div>`;
  const stepper = (n) => `<div class="stepper" aria-label="${t('stepOf', { n })}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<span>${t('stepOf', { n })}</span></div>`;
  const vibBar = `<div class="vib-bar" id="vibBar" hidden>${icon('i-vib')}<span class="vib-p" aria-hidden="true"></span><strong class="vib-l"></strong><button class="link-btn" data-u="vibinfo" type="button">؟</button></div>`;

  function panelHTML() {
    const u = S.u;
    if (u.mode === 'search') {
      const q = u.q.trim().toLowerCase();
      const list = D.places.filter((p) => (!q || (p.name.ar + p.name.en + p.kind.ar + p.kind.en).toLowerCase().includes(q)));
      return `${topRow(false)}
        <h1 class="p-title">${t('where')}</h1>
        <div class="from">${icon('i-home')}${t('fromYou')}</div>
        <label class="search">${icon('i-search')}<input id="q" type="search" value="${u.q}" placeholder="${t('search')}" autocomplete="off"></label>
        <ul class="dest-list">${list.map((p) => `<li><button class="dest" data-dest="${p.id}" type="button">
          <span class="dest-main"><span class="dest-name">${L(p.name)}</span><span class="dest-kind">${L(p.kind)}</span></span>
          ${levelChip(p.id)}${featRow(p.id)}${icon('i-chev', 'ic dest-chev flip')}</button></li>`).join('') || `<li class="muted">${t('noResults')}</li>`}</ul>`;
    }
    const p = place(u.dest), r = D.routes[u.dest];
    if (u.mode === 'place') {
      return `${topRow(true)}
        <h1 class="p-title">${L(p.name)}</h1>
        <div class="place-sub">${L(p.kind)} ${levelChip(p.id, true)}</div>
        <section class="block"><h2>${t('readiness')}</h2><ul class="feat-list">${FEATS.map((f) => { const s = feat(p.id, f); return `<li class="${s}">${icon('i-' + f)}<span>${t('f_' + f)}</span><b>${featMark[s]} ${t('fs_' + s)}</b></li>`; }).join('')}</ul></section>
        <section class="block"><h2>${t('yourRoute')}</h2>
          <div id="aiLine">${spark(t('thinking'), 'thinking')}</div>
          <div class="stats" id="stats" hidden>
            <span>${icon('i-clock')}<b>${t('mins', { n: r.min })}</b></span><span>${icon('i-check')}${t('stepFree')}</span>
            <span>${icon('i-elevator')}${t('lifts', { n: r.lifts })}</span><span>${icon('i-metro')}${L(r.line)}</span></div>
        </section>
        <div class="actions"><button class="btn btn-primary" data-u="start" type="button">${t('start')}${icon('i-arrow', 'ic flip')}</button>
          <button class="btn btn-ghost" data-u="help" type="button">${icon('i-help')}${t('help')}</button></div>`;
    }
    /* الرحلة: خطوة بخطوة بزر «التالي» */
    const steps = tripSteps(u.dest), i = u.i, s = steps[i], total = steps.length;
    let body = '';
    const nextBtn = (label, act = 'next') => `<div class="actions"><button class="btn btn-primary" data-u="${act}" type="button">${label}${icon('i-arrow', 'ic flip')}</button></div>`;
    if (s.k === 'obstacle') body = `<span class="chip warn">${icon('i-stop')}${t('fs_down')} ✕</span>
      <p class="instruction">${t('obstacle')}</p>${spark(t('rerouted'))}${nextBtn(t('takeMe'))}`;
    else if (s.k === 'perm') body = `<p class="instruction">${t('permQ')}</p><p class="sub">${t('permNote')}</p>
      <div class="report-card">${spark(t('drafted'))}<dl><dt>${t('permPlace')}</dt><dd id="tw1"></dd><dt>${t('permType')}</dt><dd id="tw2"></dd></dl></div>
      <div class="actions"><button class="btn btn-primary" data-u="yes" type="button">${t('yes')}</button><button class="btn btn-ghost" data-u="no" type="button">${t('noThanks')}</button></div>`;
    else if (s.k === 'arrive') body = `<div class="big-ic ok">${icon('i-check')}</div><p class="instruction">${t('arrived')}</p>` + (u.rated
      ? `<p class="sub">${t('thanks')}</p><div class="actions"><button class="btn btn-primary" data-u="again" type="button">${t('again')}</button></div>`
      : `<p class="sub">${t('how')}</p><div class="actions rate">${['r_comfy', 'r_ok', 'r_hard'].map((k) => `<button class="btn btn-ghost" data-u="rate" type="button">${t(k)}</button>`).join('')}</div>`);
    else body = `<div class="big-ic${s.k === 'detour' ? ' alt' : ''}">${icon(s.ic)}</div>
      <p class="instruction">${t('s_' + s.k)}</p>
      ${s.k === 'ride' ? `<p class="sub">${t('rideStops')}</p><div class="card-soft">${icon('i-sound')}<div><b>${t('announce')}</b><p>${t('announceText')}</p></div></div>` : ''}
      ${s.k === 'detour' ? spark(t('rerouted')) : ''}
      ${nextBtn(t('next'))}`;
    return `${topRow(true)}<div class="stepper" aria-label="${t('stage' + s.stage)} ${i + 1}/${total}">${steps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="trip-dest"><b>${t('stage' + s.stage)}</b><span>${i + 1} / ${total}</span><span class="sep">·</span>${icon('i-flag')}${L(p.name)}</div>${body}${vibBar}`;
  }

  function renderUser(fit) {
    $('#panel').innerHTML = panelHTML();
    const q = $('#q'); if (q && S.u.focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    if (S.lastVib && S.u.mode === 'trip') { const b = $('#vibBar'); if (b) { b.hidden = !S.modes.vib; b.querySelector('.vib-p').innerHTML = pulses(S.lastVib); b.querySelector('.vib-l').textContent = t('vib_' + S.lastVib); b.querySelectorAll('i').forEach((i) => i.classList.add('on')); } }
    if (fit) userMapScene();
  }

  const homeMk = () => ({ lat: D.origin.lat, lng: D.origin.lng, cls: 'home', html: `<span class="home-mk">${icon('i-home')}</span>` });
  const originMk = () => ({ lat: D.origin.lat, lng: D.origin.lng, cls: 'me', html: '<span class="me-dot"></span>' });
  const destMk = (p, active) => ({ lat: p.lat, lng: p.lng, cls: 'pin p-' + p.id + ' lab-' + p.lab + ' ' + level(score(p.id)) + (active ? ' active' : ''), label: L(p.name),
    onClick: S.u.mode === 'search' ? () => pickDest(p.id) : null,
    html: `<span class="pin-dot">${dots(level(score(p.id)))}</span><span class="pin-name">${L(p.name)}</span>` });

  /* نسبة نقطة من المسار (حسب الطول) */
  function fracAt(pts, idx) {
    const d = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.91);
    let tot = 0, upto = 0; for (let k = 1; k < pts.length; k++) { const s = d(pts[k], pts[k - 1]); tot += s; if (k <= idx) upto += s; }
    return upto / tot;
  }
  /* خطوات الرحلة لكل وجهة (stage = الخطوات الخمس في HANDOFF) */
  function tripSteps(dest) {
    const r = D.routes[dest];
    const st = fracAt(r.pts, 1), al = r.alightIdx ? fracAt(r.pts, r.alightIdx) : 0.985;
    const base = [
      { k: 'walk', stage: 2, ic: 'i-walk', f: 0, zoom: 'start' },
      { k: 'gates', stage: 2, ic: 'i-gates', f: st, vib: 'right', zoom: 'start' },
      { k: 'lift', stage: 2, ic: 'i-lift-down', f: st, vib: 'lift', zoom: 'start' },
      { k: 'ride', stage: 2, ic: 'i-metro', f: (st + al) / 2, zoom: 'all' },
      { k: 'alight', stage: 2, ic: 'i-alight', f: al, vib: 'next', zoom: 'end' }
    ];
    return base.concat(r.obstacle ? [
      { k: 'obstacle', stage: 3, f: 0.995, vib: 'blocked', zoom: 'end' },
      { k: 'detour', stage: 3, ic: 'i-turn-left', alt: true, vib: 'left', zoom: 'end' },
      { k: 'perm', stage: 4, alt: true, zoom: 'end' },
      { k: 'arrive', stage: 5, alt: true, vib: 'arrive', zoom: 'end' }
    ] : [
      { k: 'exit', stage: 2, ic: 'i-lift-up', f: 1, vib: 'lift', zoom: 'end' },
      { k: 'arrive', stage: 5, f: 1, vib: 'arrive', zoom: 'end' }
    ]);
  }

  function userMapScene() {
    const u = S.u; userMap.clearRoutes();
    if (u.mode === 'search') {
      userMap.setMarkers([...D.places.map((p) => destMk(p)), homeMk()]);
      userMap.fitLatLng([[D.origin.lat, D.origin.lng], ...D.places.map((p) => [p.lat, p.lng])]);
      return;
    }
    const p = place(u.dest), r = D.routes[u.dest];
    if (u.mode === 'place') {
      userMap.setMarkers([destMk(p, true), homeMk()]);
      userMap.fitLatLng(r.pts, 700, 3);
      thinkAnimation(r);
      return;
    }
    const steps = tripSteps(u.dest), s = steps[u.i];
    const obsIdx = steps.findIndex((x) => x.k === 'obstacle'), showStop = obsIdx >= 0 && u.i >= obsIdx, rer = steps.some((x, k) => x.alt && k <= u.i);
    const els = userMap.setMarkers([destMk(p, true), ...(showStop ? [{ lat: 24.7676, lng: 46.6431, cls: 'stop', html: icon('i-stop') }] : []), homeMk(), originMk()]);
    S.meEl = els[els.length - 1];
    S.routePath = userMap.route(r.pts, rer ? 'chosen old' : 'chosen');
    if (rer) userMap.route(r.alt, 'alt', s.k === 'detour' && S.meAt && !S.meAt.alt ? 900 : 0);
    S.altPath = rer ? userMap.route(r.alt, 'measure') : null; // مسار مخفي للقياس
    const n = r.pts.length, endBox = r.obstacle ? [[24.7700, 46.6470], [24.7660, 46.6405]] : r.pts.slice(r.alightIdx || n - 2);
    if (s.zoom === 'start') userMap.fitLatLng([r.pts[0], r.pts[1]], 700, 7);
    else if (s.zoom === 'end') userMap.fitLatLng(endBox, 700, r.obstacle ? 9 : 6);
    else userMap.fitLatLng(r.pts, 700, 3);
    moveMe(s.alt ? { alt: true, f: 1 } : { alt: false, f: s.f });
  }
  /* تحريك نقطتك بهدوء من مكانها للخطوة الجاية */
  function pointAt(at) {
    const path = at.alt ? S.altPath : S.routePath; if (!path) return null;
    const pt = path.getPointAtLength(path.getTotalLength() * Math.min(1, at.f)); return [pt.x, pt.y];
  }
  function moveMe(to) {
    if (!S.meEl) return;
    let from = S.meAt || to;
    if (to.alt && !from.alt) from = { alt: true, f: 0 };
    if (!to.alt && from.alt) from = to;
    S.meAt = to;
    const a = pointAt(from), b = pointAt(to); if (!a || !b) return;
    if (reduce() || (a[0] === b[0] && a[1] === b[1])) { userMap.moveMarker(S.meEl, 0, 0, b); return; }
    const t0 = performance.now(), dur = 1100, el = S.meEl;
    const step = (now) => {
      if (el !== S.meEl) return;
      const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      userMap.moveMarker(el, 0, 0, pointAt({ alt: to.alt, f: from.f + (to.f - from.f) * e }));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ✦ لحظة التفكير: 3 مسارات، اثنين يبهتون ويبقى الأوثق */
  function thinkAnimation(r) {
    clearTimers();
    const off = (k) => r.pts.map((p, i) => (i === 0 || i === r.pts.length - 1 ? p : [p[0] + k * 0.006 * Math.sin(i), p[1] - k * 0.008 * Math.cos(i * 1.3)]));
    const c1 = userMap.route(off(1), 'cand', 700), c2 = userMap.route(off(-1), 'cand', 700), c3 = userMap.route(r.pts, 'cand', 700);
    const done = () => {
      [c1, c2].forEach((c) => c.classList.add('fade')); c3.classList.add('chosen');
      const a = $('#aiLine'); if (a) a.innerHTML = spark(`${t('chose')} ${L(r.why)}`, 'done');
      const s = $('#stats'); if (s) s.hidden = false;
    };
    if (reduce()) done(); else later(done, 1500);
  }

  function pickDest(id) { S.u = { ...S.u, mode: 'place', dest: id, focusQ: false }; renderUser(true); focusTitle(); }
  function focusTitle() { const h = $('#panel .p-title, #panel .instruction'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }

  function goStep(i, forward) {
    clearTimers(); const steps = tripSteps(S.u.dest), s = steps[i];
    S.u.i = i; renderUser(true); focusTitle();
    if (!forward) return;
    if (s.vib) buzz(s.vib);
    if (s.k === 'obstacle') S.altRoutes += 1;
    if (s.k === 'perm') { typeInto($('#tw1'), t('permPlaceV'), 300); typeInto($('#tw2'), t('permTypeV'), 300 + t('permPlaceV').length * 28 + 150); }
    else if (s.k !== 'perm') { const pv = $('#tw1'); if (pv) pv.textContent = t('permPlaceV'); }
    say(s.k);
  }
  function startTrip() {
    Object.assign(S.u, { mode: 'trip', i: 0, rated: false }); S.meAt = null;
    goStep(0, true);
  }
  function typeInto(el, text, delay) {
    if (!el) return; if (reduce()) { el.textContent = text; return; }
    el.classList.add('typing'); let i = 0;
    later(function step() { if (!el.isConnected) return; el.textContent = text.slice(0, ++i); if (i < text.length) later(step, 28); else el.classList.remove('typing'); }, delay);
  }
  function stamp() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  /* أي بلاغ جديد: لو نفس المكان ونفس العطل موجود، يندمج معه */
  function addReport(rep) {
    const ex = rep.issue !== 'other' && S.reports.find((r) => r.place === rep.place && r.issue === rep.issue && r.status !== 'forwarded');
    if (ex) { ex.merged = (ex.merged || 1) + 1; ex.time = stamp(); ex.fresh = true; if (rep.note) ex.note = rep.note; if (ex.severity === 'medium') ex.severity = 'high'; S.lastUp = ex.place; }
    else S.reports.push(Object.assign({ merged: 1, checks: ['presence'], status: 'pending' }, rep, { id: 'u' + (S.reports.length + 1), time: stamp(), fresh: true }));
    toast(t('sent'));
  }

  $('#panel').addEventListener('input', (e) => { if (e.target.id === 'q') { S.u.q = e.target.value; S.u.focusQ = true; renderUser(false); } });
  $('#panel').addEventListener('click', (e) => {
    const d = e.target.closest('[data-dest]'); if (d) return pickDest(d.dataset.dest);
    const b = e.target.closest('[data-u]'); if (!b) return;
    const a = b.dataset.u;
    if (a === 'back') { if (S.u.mode === 'trip' && S.u.i > 0) return goStep(S.u.i - 1, false); clearTimers(); S.u = { ...S.u, mode: S.u.mode === 'trip' ? 'place' : 'search', focusQ: false }; S.meAt = null; renderUser(true); focusTitle(); }
    else if (a === 'start') startTrip();
    else if (a === 'help') openSheet(`<h2 id="sheetTitle">${t('help')}</h2><p>${t('helpText')}</p><button class="btn btn-primary" data-close type="button">${t('ok')}</button>`);
    else if (a === 'settings') openSettings();
    else if (a === 'vibinfo') openVib();
    else if (a === 'next') goStep(S.u.i + 1, true);
    else if (a === 'yes') { addReport(clone(D.journeyReport)); goStep(S.u.i + 1, true); }
    else if (a === 'no') goStep(S.u.i + 1, true);
    else if (a === 'rate') { S.u.rated = true; renderUser(false); focusTitle(); }
    else if (a === 'again') { S.u = { mode: 'search', dest: null, i: 0, q: '', rated: false }; S.lastVib = null; S.meAt = null; renderUser(true); focusTitle(); }
  });
  function openSettings() {
    const mb = (k, ic) => `<button class="mode" type="button" data-mode="${k}" aria-pressed="${S.modes[k]}">${icon('i-check', 'ic tick')}${icon(ic)}<span>${t('mode_' + k)}</span><span class="on-word">${t('active')}</span></button>`;
    openSheet(`<h2 id="sheetTitle">${t('modesTitle')}</h2><div class="modes">${mb('map', 'i-map')}${mb('sound', 'i-sound')}${mb('vib', 'i-vib')}</div>
      <button class="link-btn" data-open-vib type="button">${icon('i-vib')}${t('vibList')}</button>
      <button class="btn btn-primary" data-close type="button">${t('close')}</button>`);
  }
  function openVib() {
    openSheet(`<h2 id="sheetTitle">${t('vibList')}</h2><ul class="vib-list">${Object.keys(VIB).map((k) => `<li><b>${t('vib_' + k)}</b><span class="vib-p on" aria-hidden="true">${pulses(k)}</span><button class="btn btn-ghost btn-sm" data-try="${k}" type="button">${t('vibTry')}</button></li>`).join('')}</ul>
      <button class="btn btn-primary" data-close type="button">${t('close')}</button>`);
  }
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet' || e.target.closest('[data-close]')) return closeSheet();
    const m = e.target.closest('[data-mode]'); if (m) { const k = m.dataset.mode; S.modes[k] = !S.modes[k]; m.setAttribute('aria-pressed', S.modes[k]); return; }
    if (e.target.closest('[data-open-vib]')) return openVib();
    const tr = e.target.closest('[data-try]'); if (tr && navigator.vibrate) { try { navigator.vibrate(VIB[tr.dataset.try]); } catch (er) { /* ignore */ } tr.closest('li').classList.add('flash'); setTimeout(() => tr.closest('li').classList.remove('flash'), 600); }
    else if (tr) { tr.closest('li').classList.add('flash'); setTimeout(() => tr.closest('li').classList.remove('flash'), 600); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  /* ===== زر «بلّغ» الدائم ===== */
  const REP_TYPES = ['elevator', 'ramp', 'door', 'other'];
  const REP_AUTH = { elevator: 'metro', ramp: 'sidewalk', door: 'building', other: 'building' };
  function openReport() {
    const u = S.u, steps = u.mode === 'trip' ? tripSteps(u.dest) : null;
    const ctx = u.mode === 'place' || (steps && u.i >= steps.findIndex((x) => x.k === 'alight')) ? u.dest : 'pnu';
    S.rep = { type: null, place: ctx, note: '' };
    openSheet(`<h2 id="sheetTitle">${t('reportTitle')}</h2>
      <textarea id="repNote" class="note" rows="3" placeholder="${t('notePh')}" aria-label="${t('notePh')}"></textarea>
      <div class="block"><h2>${t('reportType')}</h2><div class="types">${REP_TYPES.map((k) => `<button class="type" type="button" data-rtype="${k}" aria-pressed="false">${icon(issueIc[k])}<span>${t('issue_' + k)}</span></button>`).join('')}</div></div>
      <label class="block"><h2>${t('reportWhere')}</h2><select id="repPlace" class="select">${D.places.map((p) => `<option value="${p.id}"${p.id === ctx ? ' selected' : ''}>${L(p.name)}</option>`).join('')}</select></label>
      ${spark(t('permNote'))}
      <div class="sheet-actions"><button class="btn btn-primary" data-send type="button" disabled>${t('send')}</button><button class="btn btn-ghost" data-close type="button">${t('cancel')}</button></div>`);
  }
  $('#reportFab').addEventListener('click', () => { openReport(); const n = $('#repNote'); if (n) n.focus(); });
  $('#sheet').addEventListener('change', (e) => { if (e.target.id === 'repPlace' && S.rep) S.rep.place = e.target.value; });
  $('#sheet').addEventListener('input', (e) => { if (e.target.id === 'repNote' && S.rep) { S.rep.note = e.target.value.trim(); $('#sheet [data-send]').disabled = !(S.rep.type || S.rep.note); } });
  $('#sheet').addEventListener('click', (e) => {
    const ty = e.target.closest('[data-rtype]');
    if (ty) { S.rep.type = ty.dataset.rtype; $('#sheet').querySelectorAll('[data-rtype]').forEach((b) => b.setAttribute('aria-pressed', b === ty)); $('#sheet [data-send]').disabled = false; return; }
    if (e.target.closest('[data-send]') && S.rep && (S.rep.type || S.rep.note)) {
      const k = S.rep.type || 'other', note = S.rep.note;
      addReport({ place: S.rep.place, issue: k, severity: k === 'elevator' || k === 'ramp' ? 'high' : 'medium', authority: REP_AUTH[k], note,
        title: k === 'other' && note ? { ar: note.slice(0, 60), en: note.slice(0, 60) } : { ar: I.ar['issue_' + k], en: I.en['issue_' + k] } });
      S.rep = null; closeSheet();
      if (S.u.mode !== 'trip') renderUser(true);
    }
  });

  /* ===== واجهة الهيئة ===== */
  const stChip = { confirmed: ['ok', 'i-check'], pending: ['muted', 'i-clock'], temporary: ['warn', 'i-hourglass'], forwarded: ['info', 'i-arrow'] };
  const issueIc = { elevator: 'i-elevator', ramp: 'i-ramp', door: 'i-door', other: 'i-more' };
  /* ✦ قوة البلاغ: تكبر بدون أرقام */
  function strengthChip(r) {
    const n = r.merged || 1, lv = n >= 4 ? 3 : n >= 2 ? 2 : 1;
    const merged = lv > 1 && !S.mergeShown && r.id === 'r1' ? 1 : lv; // قبل حركة الدمج الأولى
    return `<span class="chip ai${r.fresh && lv > 1 ? ' grow' : ''}" title="${t('strTitle')}">${icon('i-spark')}<span class="dots" aria-hidden="true">${[1, 2, 3].map((k) => `<i class="${k <= merged ? 'on' : ''}"></i>`).join('')}</span>${t('str' + merged)}</span>`;
  }
  function aiSummary() {
    const by = {}; S.reports.forEach((r) => { by[r.issue] = (by[r.issue] || 0) + 1; });
    const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
    const worst = D.places.slice().sort((a, b) => score(a.id) - score(b.id))[0];
    const lines = [];
    const live = S.reports.find((r) => r.fresh && r.status === 'pending');
    if (live) lines.push(t('aiNew', { p: L(place(live.place).name) }));
    if (S.lastUp) lines.push(t('aiUp', { p: L(place(S.lastUp).name) }));
    const metroLifts = new Set(S.reports.filter((r) => r.issue === 'elevator' && r.authority === 'metro' && r.status !== 'forwarded').map((r) => r.place));
    if (metroLifts.size >= 2) lines.push(t('aiPattern'));
    lines.push(t('aiTop', { i: t('is_' + top), p: L(worst.name) }));
    return lines.slice(0, 2);
  }
  function renderKPIs() {
    const worst = D.places.slice().sort((a, b) => score(a.id) - score(b.id))[0];
    $('#kpis').innerHTML = `
      <div class="kpi"><span>${t('kpiReports')}</span><b>${S.reports.length}</b></div>
      <div class="kpi"><span>${t('kpiAlt')}</span><b>${S.altRoutes}</b></div>
      <div class="kpi"><span>${t('kpiWorst')}</span><b class="kpi-place">${L(worst.name)}</b><em>${score(worst.id).toFixed(1)}<small>/10</small></em></div>
      <div class="kpi ai-card">${icon('i-spark', 'ic ai-ic')}<div><span>${t('aiTitle')}</span>${aiSummary().map((l) => `<p>${l}</p>`).join('')}</div></div>`;
  }
  function rowHTML(r, dup) {
    const [tone, ic] = stChip[r.status], open = S.open[r.id] && !dup;
    const canApprove = r.status === 'pending' || r.status === 'temporary', canForward = r.status !== 'forwarded';
    const isNew = !!r.fresh;
    return `<li class="row${isNew ? ' is-new' : ''}${dup ? ' dup' : ''}${open ? ' open' : ''}" data-id="${r.id}">
      <button class="row-main" type="button" aria-expanded="${!!open}" data-toggle="${r.id}">
        <span class="row-ic sev-${r.severity}">${icon(issueIc[r.issue])}</span>
        <span class="row-txt"><b>${L(r.title)}</b><span>${L(place(r.place).name)} · ${r.time}</span></span>
        <span class="row-chips">${isNew ? `<span class="chip new">${t('newBadge')}</span>` : ''}${strengthChip(r)}<span class="chip ${tone}">${icon(ic)}${t('st_' + r.status)}</span></span>
      </button>
      <div class="row-act">${canApprove ? `<button class="btn btn-primary btn-sm" data-act-r="approve" data-id="${r.id}" type="button">${t('approve')}</button>` : ''}${canForward ? `<button class="btn btn-ghost btn-sm" data-act-r="forward" data-id="${r.id}" type="button">${icon('i-arrow', 'ic flip')}${t('forwardTo', { a: L(D.authorities[r.authority]) })}</button>` : ''}</div>
      ${open ? `<div class="row-more">
        <ul class="checks">${r.checks.map((c) => `<li>${t('ck_' + c)}</li>`).join('')}</ul>
        <p><span class="muted">${t('authority')}:</span> <b>${L(D.authorities[r.authority])}</b> · <span class="muted">${t('sev_' + r.severity)}</span></p>
        ${r.status === 'temporary' ? `<p class="muted">${t('expires', { h: r.expires })}</p>` : ''}
        ${r.note ? `<p class="note-view">«${r.note.replace(/</g, '&lt;')}»</p>` : ''}${r.draft ? spark(`<b>${t('draft')}:</b> ${L(r.draft)}`) : ''}</div>` : ''}
    </li>`;
  }
  function renderRows() {
    const sev = { high: 0, medium: 1 };
    const list = S.reports.slice().sort((a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || sev[a.severity] - sev[b.severity] || b.time.localeCompare(a.time));
    $('#rows').innerHTML = list.map((r) => rowHTML(r) + (r.id === 'r1' && !S.mergeShown ? rowHTML(r, true) : '')).join('');
    $('#repCount').textContent = S.reports.length;
  }
  function govMarkers() {
    govMap.setMarkers(D.places.map((p) => { const s = score(p.id), lv = level(s); return { lat: p.lat, lng: p.lng, cls: 'score p-' + p.id + ' lab-' + p.lab + ' ' + lv, label: `${L(p.name)} ${s.toFixed(1)}/10`,
      html: `<span class="sc">${s.toFixed(1)}</span><span class="pin-name">${L(p.name)}</span>` }; }));
    $('#legend').innerHTML = ['high', 'medium', 'low'].map((lv) => `<span class="level ${lv}">${dots(lv)}${t('lvlS_' + lv)}</span>`).join('');
  }
  function renderGov(fit) {
    renderKPIs(); renderRows(); govMarkers();
    if (fit) govMap.fitLatLng(D.places.map((p) => [p.lat, p.lng]), 0);
    if (!S.mergeShown) setTimeout(() => {
      const d = $('#rows .dup'); if (d) d.classList.add('merging');
      setTimeout(() => { S.mergeShown = true; if (S.view === 'gov') renderRows(); }, reduce() ? 0 : 600);
    }, 1400);
  }
  $('#rows').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act-r]');
    if (a) {
      const r = S.reports.find((x) => x.id === a.dataset.id); if (!r) return;
      r.status = a.dataset.actR === 'approve' ? 'confirmed' : 'forwarded'; r.fresh = false;
      renderGov(false); return;
    }
    const tg = e.target.closest('[data-toggle]'); if (tg) { S.open[tg.dataset.toggle] = !S.open[tg.dataset.toggle]; renderRows(); }
  });

  /* ===== أزرار عامة ===== */
  document.addEventListener('click', (e) => {
    const v = e.target.closest('[data-go-view]'); if (v) return setView(v.dataset.goView);
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'switch') setView(S.view === 'gov' ? 'user' : 'gov');
    if (a.dataset.act === 'lang') { S.lang = S.lang === 'ar' ? 'en' : 'ar'; renderStatic(); [userMap, govMap].forEach((m) => m && m.setLang(S.lang)); if (S.view === 'user') renderUser(true); if (S.view === 'gov') renderGov(true); }
    if (a.dataset.act === 'theme') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; renderStatic(); }
  });

  renderStatic();
})();
