-- Automatically create/update app profile rows when Auth users are created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'worker');

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when requested_role = 'admin' then 'admin'::public.app_role else 'worker'::public.app_role end
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role,
    is_active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill profiles for existing auth users that do not yet have one.
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)) as full_name,
  case
    when coalesce(u.raw_user_meta_data ->> 'role', 'worker') = 'admin' then 'admin'::public.app_role
    else 'worker'::public.app_role
  end as role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
