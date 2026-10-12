begin;

update public.workouts
set active = (publication_status = 'published')
where active is distinct from (publication_status = 'published');

create or replace function public.sync_workout_publication_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.publication_status is null
    or new.publication_status not in ('draft', 'published', 'archived') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.publication_status in ('draft', 'archived') then
      new.active := false;
    elsif new.active is false then
      new.publication_status := 'archived';
    else
      new.active := true;
    end if;
  elsif new.publication_status is distinct from old.publication_status then
    new.active := new.publication_status = 'published';
  elsif new.active is distinct from old.active then
    new.active := new.active is true;
    new.publication_status := case when new.active is true then 'published' else 'archived' end;
  else
    new.active := new.publication_status = 'published';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_workout_publication_lifecycle on public.workouts;
create trigger sync_workout_publication_lifecycle
before insert or update of active, publication_status on public.workouts
for each row
execute function public.sync_workout_publication_lifecycle();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_publication_active_check'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
    add constraint workouts_publication_active_check
    check (
      (publication_status = 'published' and active is true)
      or (publication_status in ('draft', 'archived') and active is false)
    );
  end if;
end
$$;

revoke all on function public.sync_workout_publication_lifecycle() from public;

commit;
