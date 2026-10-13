create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  match_date timestamptz not null,
  is_home boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Ingelogde gebruikers beheren wedstrijden"
  on public.matches for all
  to authenticated
  using (true)
  with check (true);
