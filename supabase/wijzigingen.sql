-- Logboek van wijzigingen in wie kan: wie, wanneer, van welk antwoord naar welk antwoord.
-- Veilig om opnieuw te draaien. Alleen de beheerder kan het logboek lezen.
create table if not exists public.availability_log (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  player_id uuid not null,
  old_answer text not null,
  new_answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists availability_log_created_idx
  on public.availability_log (created_at desc);

alter table public.availability_log enable row level security;

drop policy if exists "admin only" on public.availability_log;
create policy "admin only" on public.availability_log
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.availability_log to authenticated;

-- Schrijft bij elke wijziging in availability een regel weg, ook als een speler via een link antwoordt.
-- "Nog niet zeker" wordt via to_jsonb gelezen, zodat dit ook werkt als dat veld nog niet bestaat.
create or replace function public.log_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := 'open';
  v_new text := 'open';
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := case
      when coalesce((to_jsonb(old) ->> 'is_maybe')::boolean, false) then 'nog niet zeker'
      when old.is_available then 'kan'
      else 'kan niet'
    end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := case
      when coalesce((to_jsonb(new) ->> 'is_maybe')::boolean, false) then 'nog niet zeker'
      when new.is_available then 'kan'
      else 'kan niet'
    end;
  end if;

  -- Verdwijnt een wedstrijd of speler, dan verdwijnen de antwoorden mee: dat hoeft niet gelogd.
  if tg_op = 'DELETE' and (
    not exists (select 1 from public.matches where id = old.match_id)
    or not exists (select 1 from public.players where id = old.player_id)
  ) then
    return old;
  end if;

  if v_old is distinct from v_new then
    insert into public.availability_log (match_id, player_id, old_answer, new_answer)
    values (
      coalesce(new.match_id, old.match_id),
      coalesce(new.player_id, old.player_id),
      v_old,
      v_new
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists availability_log_trigger on public.availability;
create trigger availability_log_trigger
  after insert or update or delete on public.availability
  for each row execute function public.log_availability();
