-- Spelers die alleen de 501 spelen en niet meedoen met de koppels. Veilig om opnieuw te draaien.
alter table public.players add column if not exists only_501 boolean not null default false;
