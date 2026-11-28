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

  RT.save = async function (r) {
    if (!db) return;
    const { error } = await db.from(TABLE).upsert(toRow(r));
    if (error) console.warn('[RT] save failed', error.message);
  };

  async function start() {
    if (!window.supabase || !window.supabase.createClient) { console.warn('[RT] supabase-js not loaded, offline mode'); return; }
    db = window.supabase.createClient(URL, KEY);
    const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: true });
    if (error) { console.warn('[RT] load failed, offline mode', error.message); db = null; return; }
    RT.ready = true;
    RT.onLoad && RT.onLoad(data.map(toApp));
    db.channel('reports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (p) => {
        if (p.eventType === 'DELETE') return;
        RT.onChange && RT.onChange(toApp(p.new));
      })
      .subscribe((s) => console.info('[RT] channel', s));
  }

  window.RT = RT;
  /* نبدأ بعد ما يجهز app.js ويربط onLoad/onChange */
  window.addEventListener('load', start);
})();
