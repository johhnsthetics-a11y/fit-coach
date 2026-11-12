# BUILD41 — Colaboração profissional por paciente

## Decisão aprovada

**Modo:** extensão + redesign · preservar. Integrar a área Equipe e colaboração clínica seletiva, sem trocar a identidade Coach Fit Pro. A direção visual reutiliza Plus Jakarta Sans, logo, ícones e tokens atuais, com prioridade mobile, temas claro/escuro e estados inequívocos de equipe, convite, autorização e consentimento.

## Regras de produto

Um profissional pode administrar uma equipe e participar de várias outras simultaneamente. Cada equipe tem responsável, membros e convites independentes; sair/remover afeta apenas aquela equipe e suas concessões. Aceitar convite não libera pacientes. O responsável escolhe uma especialidade complementar e pacientes atuais elegíveis, por lote ou individualmente; cada paciente consente separadamente. Pacientes futuros não são incluídos automaticamente. A autorização só funciona enquanto membro, concessão e consentimento estiverem ativos.

Nutricionista autorizado cria/edita somente dietas de pacientes consentidos. Treinador autorizado cria/edita somente treinos desses pacientes. Não são compartilhados outras carteiras, conversas, finanças, faturamento, cadastro completo ou questionários/anamneses dos pacientes delegados. A conta de nutricionista só recebe Treinos quando há uma delegação de treino aceita para sua carteira; a visualização do responsável é read-only. O responsável treinador acompanha dietas de origem colaborativa somente para leitura. Ownership permanece com o profissional responsável; `created_by`, `updated_by` e `collaboration_delegation_id` registram autoria e origem.

O aluno autenticado aceita, recusa ou revoga. Identidade e avatar assinado do colaborador só aparecem após consentimento ativo. Prévia por convite não recebe a superfície Equipe nem identidade de colaboradores.

## Implementação

A migration aditiva `supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql` cria equipes, convites, concessões, consentimento, auditoria e projeções mínimas, com RLS, funções `SECURITY DEFINER` de `search_path` fixo e sem acesso direto às tabelas por `anon`/`authenticated`. Os RPCs que acessam dados colaborativos chamam o gate server-side; os RPCs de revogação/saída/remoção permanecem disponíveis para encerrar acesso mesmo se a assinatura vencer.

O gate preserva o contrato comercial: reconhece os status web de `isSubscriptionCurrent`, afiliados `active`, e entitlement Apple verificado pelo backend. `apple-subscription-sync` exige JWT, consulta App Store Server API em produção/Sandbox, verifica JWS com a biblioteca oficial Apple e confere `appAccountToken`, Bundle ID, App ID e produto antes de gravar. Entitlement Apple é privado para service-role, não pode ser transferido entre contas e só passa nas RPCs enquanto vigente e verificado nos últimos 60 segundos. O cliente nunca grava/declara um booleano de assinatura como prova.

As chamadas StoreKit existentes foram ligadas à sincronização server-side para compra/restauração e antes de ações colaborativas; IDs, preços, checkout e termos não mudaram. As funções `apple-subscription-sync` e `student-avatar` passaram `deno check` local. App Store Server Notifications V2 não está implementado, e o gate não foi validado contra um Supabase remoto nem Apple Sandbox real.

## Segurança e validação

PGlite cobriu os caminhos positivos web/afiliado/Apple, o bloqueio sem entitlement, expiração, grace vigente, acesso direto à tabela negado, não transferência da transação Apple, multi-equipe, consentimento/revogação, isolamento por área e autoria. Testes estáticos conferem RLS, gates, JWT, appAccountToken e que a revogação/saída não dependem de assinatura ativa. Esses testes não substituem teste em staging.

BUILD40 e sua extensão Live Activity permanecem preservadas. Nenhuma regra de preço, produto, checkout ou versão comercial foi alterada. O crash da build 27 é confirmado como TCC por ausência de `NSCameraUsageDescription`; a chave foi incluída na fonte, mas precisa de nova build e teste físico.

## Estado de entrega

`pnpm test` (508), `pnpm test:database`, `pnpm test:professional-collaboration` (9 contratos estáticos + PGlite), `pnpm test:subscription` (50), `pnpm test:ios-privacy` (2), lint, typecheck, build Vite e Deno check passaram localmente. O build Vite tem aviso não bloqueante de chunks acima de 600 kB. Nenhuma migration foi aplicada; nenhuma Edge Function foi implantada; não houve `cap sync`, Xcode archive, workflow, push, deploy ou TestFlight.

Próxima sequência segura: validar primeiro em Supabase de staging com secrets Apple criados no App Store Connect; validar compra Sandbox e cenários negativos; revisar e obter autorização específica antes de aplicar migration/implantar em produção. Em separado, anexar screenshot de App Review e submeter os três IAPs com uma nova versão/binário. Consulte `APPLE-SUBSCRIPTION-SERVER-SETUP.md` para o procedimento manual.