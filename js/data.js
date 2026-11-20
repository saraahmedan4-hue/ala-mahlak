/* بيانات تجريبية ثابتة (seed). الإحداثيات من OpenStreetMap (ODbL). */
window.SEED = {
  places: [
    { id: 'pnu', osm: 'way/161612193', lat: 24.8514415, lng: 46.7213108, faults90: 2,
      name: { ar: 'جامعة الأميرة نورة', en: 'Princess Nourah University' },
      kind: { ar: 'جامعة · ونقطة وصولها المحطة', en: 'University · reached via its station' } },
    { id: 'kafd', osm: 'way/1220645868', lat: 24.7656964, lng: 46.6407087, faults90: 1,
      name: { ar: 'KAFD', en: 'KAFD' },
      kind: { ar: 'مركز أعمال', en: 'Business district' } },
    { id: 'rpark', osm: 'way/636659011', lat: 24.7569124, lng: 46.6300962, faults90: 6,
      name: { ar: 'الرياض بارك', en: 'Riyadh Park' },
      kind: { ar: 'مول', en: 'Mall' } },
    { id: 'blvd', osm: 'way/1218670088', lat: 24.7684171, lng: 46.6044742, faults90: 2,
      name: { ar: 'بوليفارد الرياض', en: 'Boulevard Riyadh' },
      kind: { ar: 'ترفيه', en: 'Entertainment' } },
    { id: 'museum', osm: 'relation/6196003', lat: 24.6471421, lng: 46.7107035, faults90: 5,
      name: { ar: 'المتحف الوطني', en: 'National Museum' },
      kind: { ar: 'تعليمي', en: 'Education' } }
  ],

  /* الجهات بنوعها العام، بدون أسماء شركات */
  authorities: {
    metro: { ar: 'تشغيل المترو', en: 'Metro operations' },
    sidewalk: { ar: 'البلدية للرصيف', en: 'Municipality (sidewalks)' },
    building: { ar: 'إدارة المبنى', en: 'Building management' }
  },

  /* status: confirmed | pending | temporary | forwarded ; severity: high | medium */
  reports: [
    { id: 'r1', place: 'rpark', issue: 'ramp', severity: 'high', status: 'confirmed', authority: 'sidewalk', time: '08:12', merged: 2,
      title: { ar: 'منحدر البوابة 3 مسدود بسيارة', en: 'Gate 3 ramp blocked by a car' },
      checks: ['presence', 'second'] },
    { id: 'r2', place: 'museum', issue: 'elevator', severity: 'high', status: 'confirmed', authority: 'metro', time: '09:40', merged: 1,
      title: { ar: 'مصعد مدخل المحطة متوقف', en: 'Station entrance elevator stopped' },
      checks: ['presence', 'log'] },
    { id: 'r3', place: 'rpark', issue: 'elevator', severity: 'medium', status: 'pending', authority: 'building', time: '10:05', merged: 1,
      title: { ar: 'مصعد المواقف بطيء ويتوقف', en: 'Parking elevator slow and stopping' },
      checks: ['presence'] },
    { id: 'r4', place: 'blvd', issue: 'ramp', severity: 'medium', status: 'temporary', authority: 'sidewalk', time: '10:30', merged: 1, expires: 6,
      title: { ar: 'حاجز أعمال صيانة عند المنحدر', en: 'Maintenance barrier at the ramp' },
      checks: ['presence', 'behavior'] },
    { id: 'r5', place: 'pnu', issue: 'door', severity: 'medium', status: 'pending', authority: 'building', time: '11:18', merged: 1,
      title: { ar: 'الباب الآلي عند المدخل ما يفتح', en: 'Automatic entrance door not opening' },
      checks: ['presence'] }
  ],

  /* البلاغ اللي ترسله المستخدمة من الرحلة الذهبية */
  journeyReport: { id: 'live', place: 'kafd', issue: 'elevator', severity: 'high', status: 'pending', authority: 'metro', merged: 1, live: true,
    title: { ar: 'مصعد المدخل الشرقي في محطة KAFD متوقف', en: 'KAFD station east entrance elevator stopped' },
    draft: { ar: 'مصعد المدخل الشرقي في محطة KAFD متوقف. المستفيدة تحوّلت للمدخل الغربي (+4 دقائق). ما فيه أي بيانات شخصية.',
             en: 'The east entrance elevator at KAFD station is stopped. The rider was moved to the west entrance (+4 min). No personal data included.' },
    checks: ['presence', 'behavior', 'log'] },

  altRoutesToday: 37
};
