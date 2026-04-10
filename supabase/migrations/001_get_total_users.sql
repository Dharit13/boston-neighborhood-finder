-- Enables the public user-count display on the sign-in page.
--
-- SECURITY DEFINER lets the function read auth.users (which the anon role
-- cannot access directly). Only the scalar count is returned — no rows,
-- emails, or IDs leak. This is the standard Supabase pattern for exposing
-- safe aggregate stats to unauthenticated clients.

create or replace function public.get_total_users()
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

grant execute on function public.get_total_users() to anon, authenticated;
