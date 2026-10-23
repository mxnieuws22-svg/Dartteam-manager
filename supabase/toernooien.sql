-- Ranking toernooien met datum. Veilig om opnieuw te draaien.
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ranking toernooi',
  tournament_date date not null,
  location text,
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

drop policy if exists "admin only" on public.tournaments;
create policy "admin only" on public.tournaments
  for all to authenticated using (true) with check (true);

drop policy if exists "Iedereen mag lezen" on public.tournaments;
create policy "Iedereen mag lezen" on public.tournaments
  for select to anon using (true);

grant select on public.tournaments to anon;
grant select, insert, update, delete on public.tournaments to authenticated;
