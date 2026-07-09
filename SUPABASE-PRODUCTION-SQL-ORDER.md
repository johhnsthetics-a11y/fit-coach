# Coach Fit Pro - Ordem Oficial de SQLs em Producao

Use este documento antes de rodar qualquer SQL no Supabase.

## Antes de comecar

1. Fazer backup das tabelas principais.
2. Confirmar que o Admin Master usa exatamente o e-mail `sac@coachfitpro.com.br`.
3. Nao executar SQLs antigos de prototipo.
4. Rodar cada SQL uma vez e validar antes de continuar.

## Backup minimo recomendado

Exportar pelo Supabase:

- `users`
- `students`
- `student_invites`
- `coach_settings`
- `coach_subscriptions`
- `app_admin_settings`
- `lead_events`
- `workouts`
- `workout_exercises`
- `workout_logs`
- `nutrition_plans`
- `nutrition_meals`
- `messages`
- `checkins`
- `checkin_photos`
- `invoices`
- `payments`
- `subscriptions`
- `exercise_library`
- `storage.objects`

## Ordem oficial

1. `schema.sql`
   - Use apenas se o banco ainda nao tiver as tabelas base.
   - Nao execute sozinho em producao.

2. `supabase_auth_security.sql`
   - Remove politicas abertas de prototipo.
   - Aplica isolamento por treinador nas tabelas base.

3. SQLs de estrutura funcional, quando ainda nao estiverem aplicados:
   - `supabase_student_invites.sql`
   - `supabase_student_portal_secure.sql`
   - `supabase_workouts.sql`
   - `supabase_workout_logs.sql`
   - `supabase_nutrition.sql`
   - `supabase_messages.sql`
   - `supabase_chat_fotos.sql`
   - `supabase_private_checkin_photos.sql`
   - `supabase_invoices.sql`
   - `supabase_assessments.sql`
   - `supabase_appointments.sql`
   - `supabase_coach_settings.sql`
   - `supabase_cartpanda_assinatura.sql`
   - `supabase_exercise_library.sql`
   - `supabase_ascendapi_exercise_cache.sql`

4. `supabase_admin_master_sac_exclusivo_20260709.sql`
   - Fecha Admin Master para `sac@coachfitpro.com.br`.
   - Protege configuracoes globais, eventos de lead e biblioteca central de exercicios.

5. `supabase_p0_security_hardening_20260709.sql`
   - Protege `users.role` contra escalonamento de privilegio por usuario comum.
   - Nao duplica comandos do Admin Master.

## SQLs obsoletos ou que exigem cuidado

| Arquivo | Status | Motivo | Substituto |
|---|---|---|---|
| `supabase_rls_fix.sql` | Nunca executar em producao | Recria policies abertas com `using (true)` e `with check (true)` | `supabase_auth_security.sql` |
| `supabase_storage_setup.sql` | Nunca executar em producao | Deixa `checkin-photos` publico e amplo | `supabase_private_checkin_photos.sql` |
| `schema.sql` | Usar apenas em banco novo | Nao contem todas as politicas atuais | Rodar a ordem oficial completa depois |
| `supabase_auth_security_step1.sql` / `step2.sql` | Legado | Foram substituidos pelo arquivo consolidado | `supabase_auth_security.sql` |
| `supabase_portal_secure_01.sql`, `02.sql`, `03.sql` | Legado por partes | Pode confundir ordem de aplicacao | `supabase_student_portal_secure.sql` |
| `supabase_portal_sem_dollar_01.sql`, `02.sql` | Legado operacional | Criado para contornar editor, nao e fonte final | `supabase_student_portal_secure.sql` |
| `supabase_lastlink_assinatura.sql` | Obsoleto | Lastlink foi trocada por Cartpanda | `supabase_cartpanda_assinatura.sql` |
| `supabase_checkout_teste_5_reais.sql` | Obsoleto | Era checkout de teste | Checkouts oficiais da Cartpanda |

## Storage - situacao atual

| Bucket | Politica atual | Risco | Alteracao necessaria | Pode quebrar fluxo atual? |
|---|---|---|---|---|
| `checkin-photos` | Pode ser privado com leitura por assinatura/coach nos SQLs recentes | Medio se rodar SQL antigo publico | Manter `supabase_private_checkin_photos.sql`; nao usar `supabase_storage_setup.sql` | Baixo se aplicado na ordem correta |
| `message-attachments` | Publico para leitura e upload amplo em `supabase_chat_fotos.sql` | Medio: anexos do chat ficam publicos por URL | P1: padronizar path por aluno/convite e criar policies por vinculo | Sim, se restringir sem migrar paths |
| `workout-videos` | Publico para leitura, upload por autenticado | Medio: qualquer coach autenticado pode gravar no bucket | P1: incluir coach_id no path e policy por dono | Sim, pois path atual usa `workoutId/index` |
| `exercise-library-videos` | Publico para leitura, escrita so Admin Master | Baixo: biblioteca foi intencionalmente publica | Manter publico para videos padrao | Nao |

## Validacao depois dos SQLs

- Entrar com `sac@coachfitpro.com.br` e ver Admin Master.
- Entrar com coach comum e confirmar que Admin Master nao aparece.
- Criar/editar aluno com coach comum.
- Criar treino e dieta.
- Aluno entrar por codigo.
- Enviar mensagem e check-in.
- Testar upload de foto, anexo e video.
- Confirmar checkout Cartpanda e liberacao de assinatura.
- Confirmar que coach comum nao consegue alterar `users.role`.

## Rollback

1. Nao desfazer para policies abertas.
2. Se Admin Master ficar bloqueado, confirmar se o e-mail no Supabase Auth e exatamente `sac@coachfitpro.com.br`.
3. Em emergencia, ajustar temporariamente a policy para um unico e-mail especifico. Nunca usar wildcard de dominio.
4. Restaurar backup das tabelas afetadas se algum dado visual desaparecer.
5. Para `users.role`, remover somente o trigger se for indispensavel:

```sql
drop trigger if exists coachfit_protect_user_role_trigger on public.users;
drop function if exists public.coachfit_protect_user_role();
```
