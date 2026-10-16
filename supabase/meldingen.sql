-- Pushmeldingen naar de telefoon van de beheerder zodra een speler zijn beschikbaarheid doorgeeft.
-- Draai dit script één keer in de SQL Editor van het Supabase-project Dartteam.
-- Daarna moet nog één geheim woord in de database en in Vercel worden gezet (zie de uitleg bij de PR).

-- Derde antwoord "nog niet zeker": een extra veld bij de beschikbaarheid. Bij "nog niet zeker" staat
-- is_available op false en is_maybe op true, zodat het nergens als "kan" meetelt.
alter table public.availability
  add column if not exists is_maybe boolean not null default false;

-- 1. Telefoons die meldingen willen ontvangen. Alleen ingelogde beheerders hebben toegang.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "admin only" on public.push_subscriptions;
create policy "admin only" on public.push_subscriptions
  for all to authenticated using (true) with check (true);

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- 2. Geheim woord waarmee de website bij de gegevens voor meldingen mag. Niemand kan deze tabel
--    lezen of schrijven via de website: alleen de functies hieronder (en jij in de SQL Editor).
create table if not exists public.push_config (
  id boolean primary key default true check (id),
  secret text not null
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- 3. Gegevens voor één melding: wie heeft wat doorgegeven, en naar welke telefoons de melding moet.
--    Werkt alleen met het geheime woord én een geldige groepslink of persoonlijke link.
create or replace function public.push_info(
  p_secret text,
  p_token uuid,
  p_player_id uuid,
  p_match_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_name text;
  v_opponent text;
  v_date date;
  v_available boolean;
  v_maybe boolean;
begin
  if not exists (select 1 from public.push_config where secret = p_secret) then
    return null;
  end if;

  -- Groepslink: de speler komt uit de aanvraag. Persoonlijke link: de speler volgt uit de token.
  if to_regclass('public.team_link') is not null then
    execute 'select case when exists (select 1 from public.team_link where token = $1) then $2 end'
      into v_player_id using p_token, p_player_id;
  end if;

  if v_player_id is null and to_regclass('public.player_tokens') is not null then
    execute 'select player_id from public.player_tokens where token = $1'
      into v_player_id using p_token;
  end if;

  if v_player_id is null then
    return null;
  end if;

  select name into v_name from public.players where id = v_player_id;
  select opponent, match_date into v_opponent, v_date from public.matches where id = p_match_id;
  select is_available, is_maybe into v_available, v_maybe from public.availability
    where match_id = p_match_id and player_id = v_player_id;

  if v_name is null or v_date is null then
    return null;
  end if;

  return jsonb_build_object(
    'player', v_name,
    'opponent', v_opponent,
    'match_date', v_date,
    'is_available', v_available,
    'is_maybe', coalesce(v_maybe, false),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
      from public.push_subscriptions
    ), '[]'::jsonb)
  );
end;
$$;

-- 4. Telefoons waarvan de melding niet meer aankomt (afgemeld of app verwijderd) opruimen.
create or replace function public.push_remove(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.push_config where secret = p_secret) then
    delete from public.push_subscriptions where endpoint = p_endpoint;
  end if;
end;
$$;

revoke all on function public.push_info(text, uuid, uuid, uuid) from public;
revoke all on function public.push_remove(text, text) from public;
grant execute on function public.push_info(text, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.push_remove(text, text) to anon, authenticated;
