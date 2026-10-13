-- Bezoekers (niet ingelogd) mogen alleen lezen; schrijven kan alleen via de bestaande "admin only"-regels.
create policy "Iedereen mag lezen" on public.players for select to anon using (true);
create policy "Iedereen mag lezen" on public.matches for select to anon using (true);
create policy "Iedereen mag lezen" on public.availability for select to anon using (true);
create policy "Iedereen mag lezen" on public.lineup for select to anon using (true);
