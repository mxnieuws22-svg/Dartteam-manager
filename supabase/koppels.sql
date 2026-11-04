-- Koppels per wedstrijd: wie speelde samen en of het koppel won. Veilig om opnieuw te draaien.
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_a uuid not null references public.players(id) on delete cascade,
  player_b uuid not null references public.players(id) on delete cascade,
  won boolean,
  legs_won integer check (legs_won is null or legs_won >= 0),
  legs_lost integer check (legs_lost is null or legs_lost >= 0),
  created_at timestamptz not null default now(),
  check (player_a <> player_b)
);

alter table public.pairs enable row level security;

drop policy if exists "admin only" on public.pairs;
create policy "admin only" on public.pairs
  for all to authenticated using (true) with check (true);

drop policy if exists "Iedereen mag lezen" on public.pairs;
create policy "Iedereen mag lezen" on public.pairs
  for select to anon using (true);

grant select on public.pairs to anon;
grant select, insert, update, delete on public.pairs to authenticated;
