-- Een wedstrijd waarvan de datum nog niet zeker is, krijgt de aanduiding "mogelijk". Veilig om opnieuw te draaien.
alter table public.matches add column if not exists date_tentative boolean not null default false;
