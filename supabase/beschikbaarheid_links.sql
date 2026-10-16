-- Persoonlijke links waarmee spelers zonder account kunnen aangeven of ze kunnen.
-- Draai dit script één keer in de SQL Editor van het Supabase-project Dartteam.

-- Derde antwoord "nog niet zeker": een extra veld bij de beschikbaarheid. Bij "nog niet zeker" staat
-- is_available op false en is_maybe op true, zodat het nergens als "kan" meetelt.
alter table public.availability
  add column if not exists is_maybe boolean not null default false;

-- 1. Geheime token per speler. Alleen ingelogde beheerders kunnen deze tabel lezen;
--    bezoekers kunnen er niet bij (de tokens staan dus niet in de openbare spelerslijst).
create table if not exists public.player_tokens (
  player_id uuid primary key references public.players (id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);

alter table public.player_tokens enable row level security;

drop policy if exists "admin only" on public.player_tokens;
create policy "admin only" on public.player_tokens
  for all to authenticated using (true) with check (true);

-- Bezoekers hebben geen enkel recht op deze tabel; beheerders (ingelogd) wel.
revoke all on public.player_tokens from anon;
grant select, insert, update, delete on public.player_tokens to authenticated;

-- Bestaande spelers krijgen een token.
insert into public.player_tokens (player_id)
select id from public.players
on conflict (player_id) do nothing;

-- Nieuwe spelers krijgen automatisch een token.
create or replace function public.create_player_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_tokens (player_id) values (new.id)
  on conflict (player_id) do nothing;
  return new;
end;
$$;

drop trigger if exists players_create_token on public.players;
create trigger players_create_token
  after insert on public.players
  for each row execute function public.create_player_token();

-- 2. Wat een speler met zijn link ziet: eigen naam en de komende wedstrijden met eigen keuze.
create or replace function public.my_availability(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_player_id uuid;
  v_name text;
begin
  select p.id, p.name into v_player_id, v_name
  from public.player_tokens t
  join public.players p on p.id = t.player_id
  where t.token = p_token and p.is_active;

  if v_player_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'name', v_name,
    'matches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'opponent', m.opponent,
          'match_date', m.match_date,
          'is_home', m.is_home,
          'location', m.location,
          'is_available', a.is_available,
          'is_maybe', a.is_maybe
        ) order by m.match_date
      )
      from public.matches m
      left join public.availability a
        on a.match_id = m.id and a.player_id = v_player_id
      where m.status = 'planned' and m.match_date >= current_date
    ), '[]'::jsonb)
  );
end;
$$;

-- 3. Een speler kan alleen zijn eigen beschikbaarheid voor een komende wedstrijd zetten.
-- De oude versie (zonder p_maybe) weghalen, anders zijn er twee functies met dezelfde naam.
drop function if exists public.set_my_availability(uuid, uuid, boolean);

create or replace function public.set_my_availability(
  p_token uuid,
  p_match_id uuid,
  p_available boolean,
  p_maybe boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  select p.id into v_player_id
  from public.player_tokens t
  join public.players p on p.id = t.player_id
  where t.token = p_token and p.is_active;

  if v_player_id is null then
    raise exception 'Ongeldige link';
  end if;

  if not exists (
    select 1 from public.matches
    where id = p_match_id and status = 'planned' and match_date >= current_date
  ) then
    raise exception 'Wedstrijd niet beschikbaar';
  end if;

  insert into public.availability (match_id, player_id, is_available, is_maybe)
  values (p_match_id, v_player_id, p_available and not p_maybe, p_maybe)
  on conflict (match_id, player_id)
  do update set is_available = excluded.is_available, is_maybe = excluded.is_maybe;
end;
$$;

revoke all on function public.my_availability(uuid) from public;
revoke all on function public.set_my_availability(uuid, uuid, boolean, boolean) from public;
revoke all on function public.create_player_token() from public;
grant execute on function public.my_availability(uuid) to anon, authenticated;
grant execute on function public.set_my_availability(uuid, uuid, boolean, boolean) to anon, authenticated;
