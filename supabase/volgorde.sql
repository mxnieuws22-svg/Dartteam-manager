-- De volgorde voor de 501 (geloot door de beheerder). Veilig om opnieuw te draaien.
alter table public.lineup add column if not exists position integer check (position is null or position >= 1);
