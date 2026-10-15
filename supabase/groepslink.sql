-- Eén gezamenlijke link voor de groepsapp: spelers kiezen hun eigen naam en geven aan of ze kunnen.
-- Draai dit script één keer in de SQL Editor van het Supabase-project Dartteam.
-- Het werkt los van de persoonlijke links (beschikbaarheid_links.sql).

-- 1. Eén geheime groepstoken. Alleen ingelogde beheerders kunnen die lezen.
create table if not exists public.team_link (
  id boolean primary key default true check (id),
  token uuid not null default gen_random_uuid()
);

alter table public.team_link enable row level security;

drop policy if exists "admin only" on public.team_link;
create policy "admin only" on public.team_link
  for all to authenticated using (true) with check (true);

revoke all on public.team_link from anon;
grant select, insert, update, delete on public.team_link to authenticated;

insert into public.team_link (id) values (true) on conflict (id) do nothing;

-- 2. Wat de groepspagina toont: actieve spelers en de komende wedstrijden met ieders keuze.
create or replace function public.team_availability(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.team_link where token = p_token) then
    return null;
  end if;

  return jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.players p
      where p.is_active
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'opponent', m.opponent,
          'match_date', m.match_date,
          'is_home', m.is_home,
          'location', m.location,
          'availability', coalesce((
            select jsonb_object_agg(a.player_id::text, a.is_available)
            from public.availability a
            where a.match_id = m.id
          ), '{}'::jsonb)
        ) order by m.match_date
      )
      from public.matches m
      where m.status = 'planned' and m.match_date >= current_date
    ), '[]'::jsonb)
  );
end;
$$;

-- 3. Beschikbaarheid van een actieve speler voor een komende geplande wedstrijd zetten.
create or replace function public.set_team_availability(
  p_token uuid,
  p_player_id uuid,
  p_match_id uuid,
  p_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.team_link where token = p_token) then
    raise exception 'Ongeldige link';
  end if;

  if not exists (
    select 1 from public.players where id = p_player_id and is_active
  ) then
    raise exception 'Onbekende speler';
  end if;

  if not exists (
    select 1 from public.matches
    where id = p_match_id and status = 'planned' and match_date >= current_date
  ) then
    raise exception 'Wedstrijd niet beschikbaar';
  end if;

  insert into public.availability (match_id, player_id, is_available)
  values (p_match_id, p_player_id, p_available)
  on conflict (match_id, player_id)
  do update set is_available = excluded.is_available;
end;
$$;

revoke all on function public.team_availability(uuid) from public;
revoke all on function public.set_team_availability(uuid, uuid, uuid, boolean) from public;
grant execute on function public.team_availability(uuid) to anon, authenticated;
grant execute on function public.set_team_availability(uuid, uuid, uuid, boolean) to anon, authenticated;
