create or replace function public.increment_user_experience(
  p_user_id text,
  p_delta integer
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_delta <= 0 then
    return;
  end if;

  update public.user_profiles
  set experience = coalesce(experience, 0) + p_delta
  where user_id::text = p_user_id;

  if not found then
    raise exception 'user profile % not found', p_user_id
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.increment_user_experience(text, integer) from public;
grant execute on function public.increment_user_experience(text, integer) to service_role;
