/* خريطة SVG مضمّنة: سحب وتكبير سلس بالماوس واللمس، بدون أي خادم.
   أثناء الحركة نحرّك طبقة وحدة بـ CSS (سريع)، وبعدها نثبّت الرسم مرة وحدة. */
(function () {
  'use strict';
  const M = window.MAPDATA;
  const NS = 'http://www.w3.org/2000/svg';
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
  const TOP = merc(M.bbox.n);
  const proj = (lat, lng) => [(lng - M.bbox.w) * M.K, (TOP - merc(lat)) * M.K];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function MapView(el, opts = {}) {
    el.classList.add('mv');
    el.innerHTML = `<div class="mv-stage"><svg class="mv-svg" aria-hidden="true"><g class="mv-world">
        <path class="m-park" d="${M.layers.park}"/><path class="m-water" d="${M.layers.water}"/>
        <path class="m-minor" d="${M.layers.minor}"/><path class="m-mid" d="${M.layers.mid}"/>
        <path class="m-major" d="${M.layers.major}"/><path class="m-rail" d="${M.layers.rail}"/>
        <g class="mv-static"></g><g class="mv-routes"></g></g></svg></div>
      <div class="mv-labels" aria-hidden="true">${(M.labels || []).map((l) => `<span data-x="${l.x}" data-y="${l.y}" data-a="${l.a}" data-ar="${l.ar}" data-en="${l.en}">${l.ar}</span>`).join('')}</div>
      <div class="mv-markers"></div>
      <div class="mv-ctrl"><button type="button" class="mv-btn" data-z="1" aria-label="+"><svg class="ic"><use href="#i-plus"/></svg></button><button type="button" class="mv-btn" data-z="-1" aria-label="−"><svg class="ic"><use href="#i-dash"/></svg></button></div>
      <span class="mv-attr" lang="en" dir="ltr">© OpenStreetMap contributors</span>`;
    const stage = el.querySelector('.mv-stage'), svg = el.querySelector('svg'), world = el.querySelector('.mv-world');
    const routes = el.querySelector('.mv-routes'), stat = el.querySelector('.mv-static'), mk = el.querySelector('.mv-markers');
    const labs = [...el.querySelectorAll('.mv-labels span')];
    const st = { s: 0.3, tx: 0, ty: 0 }; let markers = []; let lastFit = null; let anim = 0;
    const g = { a: 1, x: 0, y: 0 }; // حركة مؤقتة على الطبقة
    const pad = () => (opts.pad ? opts.pad() : { t: 40, r: 40, b: 40, l: 40 });
    /* العلامات والأسماء برا الطبقة: تتحرك مع الخريطة بس ما يتغير حجمها أبداً */
    const eff = () => ({ s: g.a * st.s, x: g.a * st.tx + g.x, y: g.a * st.ty + g.y });
    const place = (m, e = eff()) => { m.el.style.transform = `translate(${m.p[0] * e.s + e.x}px, ${m.p[1] * e.s + e.y}px)`; };
    const placeLabels = (e = eff()) => labs.forEach((l) => { l.style.transform = `translate(${l.dataset.x * e.s + e.x}px, ${l.dataset.y * e.s + e.y}px) translate(-50%, -50%) rotate(${l.dataset.a}deg)`; });

    function apply() { // رسم ثابت (مرة وحدة بعد كل حركة)
      world.setAttribute('transform', `translate(${st.tx} ${st.ty}) scale(${st.s})`);
      el.classList.toggle('mv-near', st.s > 1.4); el.classList.toggle('mv-names', st.s > 0.55); el.classList.toggle('mv-far', st.s < 0.4);
      placeLabels(); markers.forEach((m) => place(m));
    }
    const showGesture = () => { stage.style.transform = `translate(${g.x}px, ${g.y}px) scale(${g.a})`; const e = eff(); placeLabels(e); markers.forEach((m) => place(m, e)); };
    function commit() {
      if (g.a === 1 && g.x === 0 && g.y === 0) return;
      st.s *= g.a; st.tx = g.a * st.tx + g.x; st.ty = g.a * st.ty + g.y;
      g.a = 1; g.x = 0; g.y = 0; stage.style.transform = ''; apply();
    }
    function bounds(pts) { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
    function target(b, maxS) {
      const P = pad(), w = el.clientWidth - P.l - P.r, h = el.clientHeight - P.t - P.b;
      const bw = Math.max(b[2] - b[0], 1), bh = Math.max(b[3] - b[1], 1), s = Math.min(w / bw, h / bh, maxS || 6);
      return { s, tx: P.l + (w - bw * s) / 2 - b[0] * s, ty: P.t + (h - bh * s) / 2 - b[1] * s };
    }
    function tween(to, ms) { // الانتقال كحركة طبقة، وبعدها تثبيت
      cancelAnimationFrame(anim); commit();
      if (reduce() || !ms) { Object.assign(st, to); apply(); return; }
      const A = to.s / st.s, X = to.tx - A * st.tx, Y = to.ty - A * st.ty, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        g.a = 1 + (A - 1) * e; g.x = X * e; g.y = Y * e; showGesture();
        if (k < 1) anim = requestAnimationFrame(step); else { g.a = 1; g.x = 0; g.y = 0; stage.style.transform = ''; Object.assign(st, to); apply(); }
      };
      anim = requestAnimationFrame(step);
    }
    function fitLatLng(list, ms = 700, maxS) { lastFit = [list, maxS]; tween(target(bounds(list.map((p) => proj(p[0], p[1]))), maxS), ms); }

    function setMarkers(list) {
      mk.innerHTML = ''; markers = list.map((m) => {
        const e = document.createElement(m.onClick ? 'button' : 'div');
        if (m.onClick) { e.type = 'button'; e.addEventListener('click', m.onClick); }
        e.className = 'mv-mk ' + (m.cls || ''); e.innerHTML = m.html;
        if (m.label) e.setAttribute('aria-label', m.label);
        mk.appendChild(e); const o = { el: e, p: proj(m.lat, m.lng) }; place(o); return o;
      }); return markers.map((m) => m.el);
    }
    function moveMarker(elm, lat, lng, worldPt) { const m = markers.find((x) => x.el === elm); if (!m) return; m.p = worldPt || proj(lat, lng); place(m); }

    const pathD = (pts) => 'M' + pts.map((p) => proj(p[0], p[1]).map((v) => v.toFixed(1)).join(' ')).join('L');
    function route(pts, cls, draw, layer) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', pathD(pts)); p.setAttribute('class', 'mv-route ' + (cls || ''));
      p.setAttribute('vector-effect', 'non-scaling-stroke'); (layer || routes).appendChild(p);
      if (draw && !reduce()) { // يرسم المسار تدريجياً
        const full = p.getAttribute('d'), L = p.getTotalLength(), N = 48, t0 = performance.now();
        const q = Array.from({ length: N + 1 }, (_, i) => p.getPointAtLength((L * i) / N));
        const step = (now) => {
          const k = Math.min(1, (now - t0) / draw), n = Math.max(1, Math.round(k * N));
          p.setAttribute('d', k >= 1 ? full : 'M' + q.slice(0, n + 1).map((v) => v.x.toFixed(1) + ' ' + v.y.toFixed(1)).join('L'));
          if (k < 1) requestAnimationFrame(step);
        };
        p.setAttribute('d', 'M0 0'); requestAnimationFrame(step);
      }
      return p;
    }
    const clearRoutes = () => { routes.innerHTML = ''; };

    /* السحب والتكبير */
    const ptrs = new Map(); let pinch = null, wheelT = 0;
    function zoomAt(f, cx, cy) { // f نسبة، والمركز بإحداثيات الشاشة داخل الخريطة
      const total = st.s * g.a * f; if (total < 0.12 || total > 14) return;
      g.a *= f; g.x = cx - (cx - g.x) * f; g.y = cy - (cy - g.y) * f; showGesture();
    }
    svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); cancelAnimationFrame(anim); el.classList.add('mv-moving'); });
    svg.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) { g.x += e.clientX - prev[0]; g.y += e.clientY - prev[1]; showGesture(); }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = el.getBoundingClientRect();
        if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch = d;
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { el.classList.remove('mv-moving'); commit(); } };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
      clearTimeout(wheelT); wheelT = setTimeout(commit, 160);
    }, { passive: false });
    el.querySelectorAll('.mv-btn').forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.z === '1' ? 1.5 : 1 / 1.5, cx = el.clientWidth / 2, cy = el.clientHeight / 2;
      tween({ s: st.s * f, tx: cx - (cx - st.tx) * f, ty: cy - (cy - st.ty) * f }, 250);
    }));
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (lastFit) fitLatLng(lastFit[0], 0, lastFit[1]); }).observe(el);

    const setLang = (lang) => labs.forEach((l) => { l.textContent = lang === 'en' ? l.dataset.en : l.dataset.ar; });
    (opts.lines || []).forEach((pts) => route(pts, 'metro', 0, stat));
    return { fitLatLng, setMarkers, moveMarker, route, clearRoutes, proj, setLang };
  }
  window.MapView = MapView;
})();
