create or replace function get_student_anamnesis(invite_code text)
returns setof student_anamneses
language sql
security definer
set search_path = public
begin atomic
  select sa.*
  from student_anamneses sa
  join student_invites si on si.student_id = sa.student_id
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
  limit 1;
end;

grant execute on function get_student_anamnesis(text) to anon, authenticated;
