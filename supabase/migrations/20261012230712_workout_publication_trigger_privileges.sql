begin;

revoke all on function public.sync_workout_publication_lifecycle() from public;
revoke execute on function public.sync_workout_publication_lifecycle()
  from anon, authenticated, service_role;

commit;
