-- على مهلك · زر إعادة الديمو + حد البلاغات في الدقيقة
-- شغّليه مرة وحدة من: Supabase > SQL Editor > New query > Run

-- 1) إعادة الديمو: تمسح كل البلاغات وترجع الخمسة التجريبية
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reports where true;
  insert into public.reports (place, issue, severity, status, authority, merged, title_ar, title_en, checks) values
  ('rpark','ramp','high','confirmed','sidewalk',4,'منحدر البوابة 3 مسدود بسيارة','Gate 3 ramp blocked by a car','{presence,second}'),
  ('rpark','door','medium','pending','building',1,'المدخل المخصص مقفل','Accessible entrance locked','{presence}'),
  ('rpark','elevator','medium','pending','building',2,'مصعد المواقف يتوقف','Parking elevator keeps stopping','{presence}'),
  ('blvd','ramp','medium','temporary','sidewalk',3,'حاجز صيانة عند المنحدر','Maintenance barrier at the ramp','{presence,behavior}'),
  ('blvd','door','medium','pending','building',1,'الباب الآلي ما يفتح','Automatic door won''t open','{presence}');
end;
$$;
grant execute on function public.reset_demo() to anon, authenticated;

-- 2) حد البلاغات: أكثر من 30 بلاغ جديد في الدقيقة ينرفض
create or replace function public.limit_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.reports where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limit: too many reports, try again in a minute';
  end if;
  return new;
end;
$$;
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
for each row execute function public.limit_reports();
