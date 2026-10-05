-- Takes, 5 Oct (Robert approved both changes the same day).
-- 1. A coach can open a recording only if the singer sent that take to that
--    coach (a row in takes for that recording, naming that coach). The
--    singer can always open their own (takes_read_own, unchanged).
-- 2. A take may have no coach: a take only saved is kept online, visible to
--    the singer only (tk_read already reads student_id = me or coach_id = me,
--    so a row with no coach is the singer's alone).
-- Nothing else changes; no row or file is touched.

drop policy if exists takes_read_coach on storage.objects;
create policy takes_read_coach on storage.objects for select to authenticated
  using (bucket_id = 'takes' and exists (
    select 1 from public.takes t where t.audio_path = objects.name and t.coach_id = auth.uid()));

alter table public.takes alter column coach_id drop not null;

drop policy if exists tk_ins on public.takes;
create policy tk_ins on public.takes for insert to authenticated
  with check (student_id = auth.uid() and (coach_id is null or is_my_coach(coach_id)));
