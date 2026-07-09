# Coach Fit Pro - Checklist de Fumaca P0

Use este checklist depois do deploy e depois dos SQLs P0.

## Autenticacao

- [ ] Cadastro de treinador
- [ ] Login correto
- [ ] Login incorreto
- [ ] Recuperacao de senha
- [ ] Sessao persistente
- [ ] Logout

## Admin Master

- [ ] `sac@coachfitpro.com.br` acessa Admin Master
- [ ] Coach comum nao ve Admin Master
- [ ] Usuario comum nao acessa URL administrativa
- [ ] Usuario comum nao altera configuracoes administrativas
- [ ] Usuario comum nao altera `users.role`

## Treinador

- [ ] Criar aluno
- [ ] Editar aluno
- [ ] Criar treino
- [ ] Editar treino
- [ ] Criar dieta
- [ ] Enviar mensagem
- [ ] Criar cobranca

## Aluno

- [ ] Entrar pelo codigo
- [ ] Aceitar consentimento
- [ ] Responder anamnese
- [ ] Abrir treino
- [ ] Registrar treino
- [ ] Abrir dieta
- [ ] Enviar mensagem
- [ ] Enviar check-in

## Storage

- [ ] Upload de foto
- [ ] Upload de anexo
- [ ] Upload de video
- [ ] Leitura autorizada
- [ ] Bloqueio de leitura indevida

## Financeiro

- [ ] Checkout abre
- [ ] Webhook recebe evento
- [ ] Assinatura e liberada
- [ ] Coach acessa apenas dados proprios

## Deploy

- [ ] Build funciona
- [ ] SPA funciona
- [ ] Rotas funcionam
- [ ] PWA carrega
- [ ] Console sem erro critico

## Validacao P0 de banco

- [ ] `supabase_admin_master_sac_exclusivo_20260709.sql` aplicado
- [ ] `supabase_p0_security_hardening_20260709.sql` aplicado
- [ ] `supabase_rls_fix.sql` nao foi executado
- [ ] `supabase_storage_setup.sql` nao foi executado
- [ ] `schema.sql` nao foi executado sozinho em producao
