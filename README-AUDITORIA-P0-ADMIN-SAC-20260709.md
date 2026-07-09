# Atualizacao Coach Fit Pro - Auditoria P0 Admin Master

## O que foi corrigido

- Admin Master exclusivo para `sac@coachfitpro.com.br`.
- SQLs antigos ajustados para nao liberar painel master para outros e-mails.
- `schema.sql` deixou de recriar politicas abertas de prototipo.
- Criado relatorio de auditoria do estado atual do app.

## Subir no GitHub

Envie estes arquivos para o GitHub mantendo as pastas:

- `App.jsx`
- `index.css`
- `supabaseApi.js`
- `schema.sql`
- `supabase_admin_master.sql`
- `supabase_exercise_library.sql`
- `supabase_ascendapi_exercise_cache.sql`
- `supabase_lead_events_admin.sql`
- `supabase_admin_master_sac_exclusivo_20260709.sql`
- `AUDITORIA-COACH-FIT-PRO-20260709.md`
- `README-AUDITORIA-P0-ADMIN-SAC-20260709.md`
- `src/App.jsx`
- `src/index.css`
- `src/supabaseApi.js`

## Rodar na Supabase

No SQL Editor da Supabase, rode:

`supabase_admin_master_sac_exclusivo_20260709.sql`

Esse arquivo garante que apenas `sac@coachfitpro.com.br` consiga alterar configuracoes globais, ver eventos de lead e gerenciar a biblioteca central de exercicios.

## Validacao feita

Build local aprovado com `pnpm run build`.
