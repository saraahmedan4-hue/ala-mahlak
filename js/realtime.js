/* على مهلك · الربط اللحظي (Supabase)
   البلاغات تنحفظ في جدول reports وتوصل لكل الجوالات لحظياً.
   المفتاح هنا "publishable" عام ومسموح يكون في الكود، والحماية من قواعد RLS في القاعدة.
   لو Supabase ما اشتغل، التطبيق يكمل بالبيانات التجريبية بدون ما يتعطل. */
(function () {
  'use strict';
  const URL = 'https://wdfpufpvmxhkupiykcrb.supabase.co';
  const KEY = 'sb_publishable_5MHyh6W8AxnLGBdCx4ccGQ_tluMrbgI';
  const TABLE = 'reports';

  const hhmm = (iso) => { const d = iso ? new Date(iso) : new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));

  /* من شكل القاعدة إلى شكل التطبيق */
  function toApp(row) {
    const r = {
      id: row.id, place: row.place, issue: row.issue, severity: row.severity, status: row.status,
      authority: row.authority, merged: row.merged, checks: row.checks || ['presence'],
      title: { ar: row.title_ar || '', en: row.title_en || row.title_ar || '' },
      time: hhmm(row.updated_at || row.created_at)
    };
    if (row.note) r.note = row.note;
    if (row.demo) r.demo = true;
    return r;
  }
  /* من شكل التطبيق إلى شكل القاعدة */
  function toRow(r) {
    return {
      id: r.id, place: r.place, issue: r.issue, severity: r.severity || 'medium', status: r.status || 'pending',
      authority: r.authority || null, merged: r.merged || 1, checks: r.checks || ['presence'],
      title_ar: (r.title && r.title.ar) || null, title_en: (r.title && r.title.en) || null,
      note: r.note || null, demo: !!r.demo, updated_at: new Date().toISOString()
    };
  }

  const RT = { ready: false, id: uuid, onChange: null, onLoad: null };
  let db = null;

  /* حد البلاغات من نفس الجهاز: 5 بالدقيقة (والقاعدة تحد 30 بالدقيقة للكل) */
  const LIMIT = 5, sentAt = [];
  RT.allow = function () {
    const now = Date.now();
    while (sentAt.length && now - sentAt[0] > 60000) sentAt.shift();
    if (sentAt.length >= LIMIT) return false;
    sentAt.push(now); return true;
  };

  RT.save = async function (r) {
    if (!db) return;
    const { error } = await db.from(TABLE).upsert(toRow(r));
    if (error) console.warn('[RT] save failed', error.message);
  };

  /* إعادة الديمو: تمسح البلاغات وترجع التجريبية، وكل الجوالات تعيد التحميل */
  RT.reset = async function () {
    if (!db) return location.reload();
    const { error } = await db.rpc('reset_demo');
    if (error) { console.warn('[RT] reset failed', error.message); return; }
    await chan.send({ type: 'broadcast', event: 'reset', payload: {} });
    location.reload();
  };

  /* زر صغير بالطرف: ضغطة طويلة (ثانيتين) تعيد الديمو */
  function resetButton() {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '↺'; b.setAttribute('aria-label', 'Reset demo (long press)');
    b.title = 'اضغط مطولاً لإعادة الديمو';
    b.style.cssText = 'position:fixed;bottom:6px;left:6px;z-index:9999;width:28px;height:28px;border-radius:50%;border:0;opacity:.25;background:#888;color:#fff;font-size:14px;cursor:pointer;touch-action:none';
    let timer = null;
    const down = (e) => { e.preventDefault(); b.style.opacity = '.9'; timer = setTimeout(() => { b.textContent = '…'; RT.reset(); }, 2000); };
    const up = () => { clearTimeout(timer); b.style.opacity = '.25'; };
    b.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, up));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(b);
  }

  let chan = null;
  async function load() {
    const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: true });
    if (error) { console.warn('[RT] load failed', error.message); return false; }
    RT.onLoad && RT.onLoad(data.map(toApp));
    return true;
  }

  async function start() {
    resetButton();
    if (!window.supabase || !window.supabase.createClient) { console.warn('[RT] supabase-js not loaded, offline mode'); return; }
    db = window.supabase.createClient(URL, KEY);
    if (!(await load())) { console.warn('[RT] offline mode'); db = null; return; }
    RT.ready = true;
    chan = db.channel('reports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (p) => {
        if (p.eventType === 'DELETE') return;
        RT.onChange && RT.onChange(toApp(p.new));
      })
      .on('broadcast', { event: 'reset' }, () => location.reload())
      .subscribe((s) => console.info('[RT] channel', s));
    /* إعادة اتصال: لما يرجع النت أو ترجع الصفحة للواجهة، نسحب آخر حالة */
    window.addEventListener('online', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  }

  window.RT = RT;
  /* نبدأ بعد ما يجهز app.js ويربط onLoad/onChange */
  window.addEventListener('load', start);
})();
