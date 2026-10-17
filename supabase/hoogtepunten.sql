-- 180's en hoge finishes per speler per wedstrijd. Veilig om opnieuw te draaien.
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('180', 'finish')),
  value integer check (value is null or (value between 100 and 170)),
  created_at timestamptz not null default now(),
  check ((kind = 'finish') = (value is not null))
);

alter table public.highlights enable row level security;

drop policy if exists "admin only" on public.highlights;
create policy "admin only" on public.highlights
  for all to authenticated using (true) with check (true);

drop policy if exists "Iedereen mag lezen" on public.highlights;
create policy "Iedereen mag lezen" on public.highlights
  for select to anon using (true);

grant select on public.highlights to anon;
grant select, insert, update, delete on public.highlights to authenticated;
