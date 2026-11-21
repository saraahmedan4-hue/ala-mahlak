/* بيانات تجريبية ثابتة (seed). الإحداثيات من OpenStreetMap (ODbL). */
/* البيت (حي النرجس) ← محطة جامعة الأميرة نورة 2 (OSM way/638630925) ← الخط 4 */
const HOME = [[24.8620, 46.6990], [24.8596, 46.7044], [24.8500, 46.7110]];
window.SEED = {
  origin: { lat: 24.8620, lng: 46.6990 }, // البيت
  places: [
    { id: 'pnu', lab: 'e', lat: 24.8514415, lng: 46.7213108, faults90: 2,
      name: { ar: 'جامعة الأميرة نورة', en: 'Princess Nourah University' }, kind: { ar: 'جامعة', en: 'University' },
      feats: { elevator: 'ok', ramp: 'ok', entrance: 'ok', toilet: 'ok', parking: 'ok' } },
    { id: 'kafd', lab: 'e', lat: 24.7656964, lng: 46.6407087, faults90: 1,
      name: { ar: 'KAFD', en: 'KAFD' }, kind: { ar: 'مركز أعمال', en: 'Business district' },
      feats: { elevator: 'ok', ramp: 'ok', entrance: 'ok', toilet: 'ok', parking: 'ok' } },
    { id: 'rpark', lab: 's', lat: 24.7569124, lng: 46.6300962, faults90: 6,
      name: { ar: 'الرياض بارك', en: 'Riyadh Park' }, kind: { ar: 'مول', en: 'Mall' },
      feats: { elevator: 'ok', ramp: 'ok', entrance: 'ok', toilet: 'ok', parking: 'ok' } },
    { id: 'blvd', lab: 'w', lat: 24.7684171, lng: 46.6044742, faults90: 2,
      name: { ar: 'بوليفارد الرياض', en: 'Boulevard Riyadh' }, kind: { ar: 'ترفيه', en: 'Entertainment' },
      feats: { elevator: 'none', ramp: 'ok', entrance: 'ok', toilet: 'ok', parking: 'ok' } },
    { id: 'museum', lab: 'e', lat: 24.6471421, lng: 46.7107035, faults90: 5,
      name: { ar: 'المتحف الوطني', en: 'National Museum' }, kind: { ar: 'تعليمي', en: 'Education' },
      feats: { elevator: 'ok', ramp: 'ok', entrance: 'ok', toilet: 'ok', parking: 'none' } }
  ],

  /* مسارات تجريبية من محطة الجامعة [lat, lng] */
  routes: {
    pnu: { min: 18, station: { ar: 'جامعة الأميرة نورة 1', en: 'Princess Nourah University 1' },  lifts: 2, alightIdx: 3,
      line: { ar: 'المترو · الخط 4', en: 'Metro · Line 4' },
      why: { ar: 'بوديك للمدخل الجنوبي، لأن الباب الآلي في المدخل الرئيسي ما يفتح.', en: "Taking you to the south entrance, because the main entrance automatic door won't open." },
      pts: [...HOME, [24.8416, 46.7174], [24.8470, 46.7195], [24.8514, 46.7213]] },
    kafd: { min: 42, station: { ar: 'مركز الملك عبدالله المالي', en: 'King Abdullah Financial District' },  lifts: 2,
      line: { ar: 'المترو · الخط 4', en: 'Metro · Line 4' },
      why: { ar: 'مصاعد المحطتين شغالة.', en: 'Elevators at both stations work.' },
      pts: [...HOME, [24.8416, 46.7174], [24.8300, 46.7120], [24.8150, 46.7000], [24.7990, 46.6850], [24.7850, 46.6700], [24.7760, 46.6540], [24.7690, 46.6460], [24.7676, 46.6431]],
      alt: [[24.7690, 46.6460], [24.7702, 46.6441], [24.7694, 46.6416]] },
    rpark: { min: 49, station: { ar: 'مركز الملك عبدالله المالي', en: 'King Abdullah Financial District' },  lifts: 2,
      line: { ar: 'المترو · الخط 4', en: 'Metro · Line 4' },
      why: { ar: 'بوديك للبوابة 1، لأن منحدر البوابة 3 مسدود.', en: 'Taking you to gate 1, because the gate 3 ramp is blocked.' },
      pts: [...HOME, [24.8416, 46.7174], [24.8300, 46.7120], [24.8150, 46.7000], [24.7990, 46.6850], [24.7850, 46.6700], [24.7760, 46.6540], [24.7676, 46.6431], [24.7620, 46.6370], [24.7569, 46.6301]] },
    blvd: { min: 54, station: { ar: 'مركز الملك عبدالله المالي', en: 'King Abdullah Financial District' },  lifts: 2,
      line: { ar: 'المترو · الخط 4', en: 'Metro · Line 4' },
      why: { ar: 'كل المصاعد على طريقك شغالة.', en: 'Every elevator on your way works.' },
      pts: [...HOME, [24.8416, 46.7174], [24.8300, 46.7120], [24.8150, 46.7000], [24.7990, 46.6850], [24.7850, 46.6700], [24.7760, 46.6540], [24.7700, 46.6330], [24.7690, 46.6200], [24.7684, 46.6045]] },
    museum: { min: 46, lifts: 2,
      line: { ar: 'المترو · الخط 4 ثم 1', en: 'Metro · Line 4 then 1' },
      why: { ar: 'مصاعد المحطتين شغالة.', en: 'Elevators at both stations work.' },
      /* رحلة العرض: عطل مفاجئ في مصعد المخرج الرئيسي بمحطة المتحف (OSM way/638609595) */
      demo: true, alightIdx: 9, fault: [24.6456, 46.7138],
      pts: [...HOME, [24.8416, 46.7174], [24.8200, 46.7200], [24.7900, 46.7210], [24.7500, 46.7160], [24.7100, 46.7120], [24.6800, 46.7110], [24.6470, 46.7128], [24.6456, 46.7138]],
      alt: [[24.6470, 46.7128], [24.6468, 46.7114], [24.6471, 46.7101]] }
  },

  authorities: {
    metro: { ar: 'تشغيل المترو', en: 'Metro operations' },
    sidewalk: { ar: 'البلدية (الأرصفة)', en: 'Municipality (sidewalks)' },
    building: { ar: 'إدارة المبنى', en: 'Building management' }
  },

  /* status: confirmed | pending | temporary | forwarded ; severity: high | medium */
  reports: [
    { id: 'r1', place: 'rpark', issue: 'ramp', severity: 'high', status: 'confirmed', authority: 'sidewalk', time: '08:12', merged: 2,
      title: { ar: 'منحدر البوابة 3 مسدود بسيارة', en: 'Gate 3 ramp blocked by a car' }, checks: ['presence', 'second'] },
    { id: 'r2', place: 'kafd', issue: 'ramp', severity: 'medium', status: 'pending', authority: 'sidewalk', time: '09:40', merged: 1,
      title: { ar: 'عوائق على منحدر الممر الجانبي', en: 'Obstacles on the side walkway ramp' }, checks: ['presence'] },
    { id: 'r3', place: 'rpark', issue: 'elevator', severity: 'medium', status: 'pending', authority: 'building', time: '10:05', merged: 1,
      title: { ar: 'مصعد المواقف يتوقف', en: 'Parking elevator keeps stopping' }, checks: ['presence'] },
    { id: 'r4', place: 'blvd', issue: 'ramp', severity: 'medium', status: 'temporary', authority: 'sidewalk', time: '10:30', merged: 1, expires: 6,
      title: { ar: 'حاجز صيانة عند المنحدر', en: 'Maintenance barrier at the ramp' }, checks: ['presence', 'behavior'] },
    { id: 'r5', place: 'pnu', issue: 'door', severity: 'medium', status: 'pending', authority: 'building', time: '11:18', merged: 1,
      title: { ar: 'الباب الآلي ما يفتح', en: "Automatic door won't open" }, checks: ['presence'] }
  ],

  /* العطل اللي يرصده النظام وسط رحلة العرض */
  demoFault: { place: 'museum', issue: 'elevator', severity: 'high', status: 'pending', authority: 'metro', demo: true,
    title: { ar: 'مصعد المخرج الرئيسي في محطة المتحف متوقف', en: 'Museum station main exit elevator stopped' },
    draft: { ar: 'مصعد المخرج الرئيسي في محطة المتحف الوطني تعطّل. حوّلت 4 رحلات للمخرج الغربي (منحدر، +3 دقائق).', en: 'The main exit elevator at National Museum station broke down. 4 trips moved to the west exit (ramp, +3 min).' },
    checks: ['log', 'behavior'] },

  altRoutesToday: 37
};
