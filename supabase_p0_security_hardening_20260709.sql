-- Coach Fit Pro - P0 Security Hardening
-- Execute este SQL depois do backup e depois do supabase_admin_master_sac_exclusivo_20260709.sql.
-- Objetivo: impedir escalonamento de privilegio pelo campo users.role sem quebrar cadastro ou edicao de perfil.

create or replace function public.coachfit_protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_email text;
  requester_role text;
begin
  requester_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  requester_role := coalesce(auth.role(), '');

  -- No cadastro inicial, permite o papel padrao usado pelo app.
  -- Se uma conta comum tentar nascer com papel administrativo, normaliza para Coach principal.
  if tg_op = 'INSERT' then
    if new.role is null or trim(new.role) = '' then
      new.role := 'Coach principal';
    elsif requester_email <> 'sac@coachfitpro.com.br'
      and requester_role <> 'service_role'
      and lower(new.role) in ('admin', 'administrator', 'administrador', 'admin master', 'master', 'owner', 'superadmin', 'super admin')
    then
      new.role := 'Coach principal';
    end if;

    return new;
  end if;

  -- Em atualizacoes comuns, preserva o role antigo.
  -- Assim o treinador ainda pode editar dados de perfil, mas nao eleva permissao.
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    if requester_email <> 'sac@coachfitpro.com.br'
      and requester_role <> 'service_role'
    then
      new.role := old.role;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.coachfit_protect_user_role()
is 'Protege users.role contra escalonamento de privilegio por usuarios comuns. Admin Master sac@coachfitpro.com.br e service_role podem alterar quando necessario.';

drop trigger if exists coachfit_protect_user_role_trigger on public.users;

create trigger coachfit_protect_user_role_trigger
before insert or update on public.users
for each row
execute function public.coachfit_protect_user_role();
