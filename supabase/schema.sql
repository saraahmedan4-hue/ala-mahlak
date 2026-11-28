-- على مهلك · قاعدة البيانات (Supabase)
-- شغّليه مرة وحدة من: Supabase > SQL Editor > New query > Run

-- جدول البلاغات (نفس شكل البلاغ في التطبيق)
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  place       text not null check (place in ('pnu','kafd','rpark','blvd','museum')),
  issue       text not null check (issue in ('elevator','ramp','door','toilet','parking','other')),
  severity    text not null default 'medium' check (severity in ('high','medium')),
  status      text not null default 'pending' check (status in ('confirmed','pending','temporary','forwarded','fixed')),
  authority   text check (authority in ('metro','sidewalk','building')),
  title_ar    text check (char_length(title_ar) <= 200),
  title_en    text check (char_length(title_en) <= 200),
  note        text check (char_length(note) <= 500),
  merged      int  not null default 1 check (merged between 1 and 999),
  checks      text[] not null default '{presence}',
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- قفل قواعد الكتابة: الكل يقرأ ويضيف ويحدّث، ومحد يحذف
alter table public.reports enable row level security;
create policy "read"   on public.reports for select using (true);
create policy "insert" on public.reports for insert with check (true);
create policy "update" on public.reports for update using (true);

-- تحديث لحظي بين الجوالات
alter publication supabase_realtime add table public.reports;

-- بيانات البداية (نفس البلاغات التجريبية)
insert into public.reports (place, issue, severity, status, authority, merged, title_ar, title_en, checks) values
('rpark','ramp','high','confirmed','sidewalk',4,'منحدر البوابة 3 مسدود بسيارة','Gate 3 ramp blocked by a car','{presence,second}'),
('rpark','door','medium','pending','building',1,'المدخل المخصص مقفل','Accessible entrance locked','{presence}'),
('rpark','elevator','medium','pending','building',2,'مصعد المواقف يتوقف','Parking elevator keeps stopping','{presence}'),
('blvd','ramp','medium','temporary','sidewalk',3,'حاجز صيانة عند المنحدر','Maintenance barrier at the ramp','{presence,behavior}'),
('blvd','door','medium','pending','building',1,'الباب الآلي ما يفتح','Automatic door won''t open','{presence}');
