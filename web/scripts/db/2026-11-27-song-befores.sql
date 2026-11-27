-- Robert, 27 Nov (his song features, approved 16 Nov): "Your first take is
-- your Before". The first take saved of each song is its Before; the singer
-- can choose another. That choice is kept on the singer's account, so it
-- follows them to a new phone, as their takes do. Only the singer can read
-- or change their own; not a coach, not anyone else.
--
-- Its own table, as tension_spots (3 Nov), because nothing else could hold
-- it: a take can't be changed once saved (the takes table has no update
-- rule, and this adds none), and the old app (index.html) lists every row
-- of a singer's takes table, so a marker row there would show up in it.
-- No change to the takes, results or any other table, or to who can read
-- or write them. A take is named by its id, the name of its recording
-- online; a song by its title, as takes find their song on a new phone.
create table if not exists public.song_befores (
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_title text not null check (length(song_title) between 1 and 300),
  take_id text not null check (length(take_id) between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key (student_id, song_title)
);

alter table public.song_befores enable row level security;
revoke all on public.song_befores from anon;
grant select, insert, update, delete on public.song_befores to authenticated;

create policy sb_read on public.song_befores for select to authenticated using (student_id = auth.uid());
create policy sb_ins on public.song_befores for insert to authenticated with check (student_id = auth.uid());
create policy sb_upd on public.song_befores for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy sb_del on public.song_befores for delete to authenticated using (student_id = auth.uid());
