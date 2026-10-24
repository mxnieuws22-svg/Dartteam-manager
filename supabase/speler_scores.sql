-- Legs en gemiddelde per speler per wedstrijd. Veilig om opnieuw te draaien.
alter table public.lineup add column if not exists legs_won integer check (legs_won is null or legs_won >= 0);
alter table public.lineup add column if not exists legs_lost integer check (legs_lost is null or legs_lost >= 0);
alter table public.lineup add column if not exists average numeric(5,2) check (average is null or (average >= 0 and average < 200));
