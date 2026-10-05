-- Takes, 5 Oct (Robert approved both changes the same day). Applied as
-- below, editing the two rules in place (ALTER POLICY: the database
-- connector cannot show its confirmation for DROP in this chat app).
-- 1. A take may have no coach: a take only saved is kept online, visible to
--    the singer only (tk_read already reads student_id = me or coach_id = me).
-- 2. A coach can open a recording only while still linked to the singer,
--    and only if the singer sent that take to that coach. The singer can
--    always open their own (takes_read_own, unchanged).
-- Nothing else changed; no row or file was touched.

alter table public.takes alter column coach_id drop not null;

alter policy tk_ins on public.takes
  with check (student_id = auth.uid() and (coach_id is null or is_my_coach(coach_id)));

alter policy takes_read_coach on storage.objects
  using (bucket_id = 'takes' and teaches(path_owner(name)) and exists (
    select 1 from public.takes t where t.audio_path = objects.name and t.coach_id = auth.uid()));
