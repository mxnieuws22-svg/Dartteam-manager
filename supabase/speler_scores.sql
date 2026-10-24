-- 501 gewonnen en legs per speler per wedstrijd. Veilig om opnieuw te draaien.
alter table public.lineup add column if not exists won_501 boolean;
alter table public.lineup add column if not exists legs_won integer check (legs_won is null or legs_won >= 0);
alter table public.lineup add column if not exists legs_lost integer check (legs_lost is null or legs_lost >= 0);
