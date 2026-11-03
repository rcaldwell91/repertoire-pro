-- Robert, 3 Nov: the "Ah" tension check's ticks, kept on the singer's
-- account so later exercises can remind them. Only the singer can read or
-- change their own; not a coach, not anyone else. Kept in its own table
-- rather than on profiles, because a singer's coach can read their profile.
create table if not exists public.tension_spots (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  spots text[] not null default '{}'
    check (spots <@ array['chin', 'jaw', 'wide', 'face', 'tongue', 'neck']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.tension_spots enable row level security;
revoke all on public.tension_spots from anon;
grant select, insert, update, delete on public.tension_spots to authenticated;

create policy ts_read on public.tension_spots for select to authenticated using (user_id = auth.uid());
create policy ts_ins on public.tension_spots for insert to authenticated with check (user_id = auth.uid());
create policy ts_upd on public.tension_spots for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ts_del on public.tension_spots for delete to authenticated using (user_id = auth.uid());
