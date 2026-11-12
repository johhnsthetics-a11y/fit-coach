# Auditoria de entrega — Coach Fit Pro BUILD41

**Base:** BUILD40, mantida intacta em diretório separado. **Versão iOS:** 1.0. **Build:** 41. **Status:** fonte implementada e validada localmente; staging, credenciais, migração/Edge Functions remotas e validação nativa ainda não executados.

## Resumo executivo

BUILD41 adiciona Equipes com múltiplos vínculos independentes e colaboração seletiva por paciente/área. Aceitar convite não compartilha prontuário; o responsável escolhe pacientes e área complementar, e cada aluno/paciente consente individualmente. Revogar, remover ou sair afeta somente a delegação/equipe correspondente.

O colaborador recebe somente a projeção mínima da especialidade autorizada. Nutricionista convidado pode montar dietas; treinador convidado pode montar treinos. O responsável consegue acompanhar o conteúdo de origem colaborativa em modo somente leitura. O consentimento habilita a identidade/foto do colaborador ao aluno. Autoria e ownership da carteira são preservados (`coach_id`, `created_by`, `updated_by`, `collaboration_delegation_id`). Questionários/anamneses de pacientes delegados, conversas, finanças e carteira global não são compartilhados.

## Gate de assinatura/entitlement no servidor

O bloqueio identificado antes do avanço — RPCs autenticados sem verificação server-side de acesso profissional — foi corrigido **na fonte BUILD41**, sem mudar preços, IDs de produto, checkout ou regras comerciais existentes. O helper do banco aceita apenas a lista de status web já usada por `isSubscriptionCurrent`, afiliado com `active = true`, ou entitlement Apple persistido e validado recentemente. Não existe bypass de master admin no banco nem sinal `active` confiado ao cliente.

A função `apple-subscription-sync` exige JWT, valida a sessão contra Supabase, confirma papel profissional, consulta os status de produção/Sandbox na App Store Server API, valida as respostas assinadas com a biblioteca oficial da Apple e exige correspondência do `appAccountToken` com o UUID autenticado, Bundle ID e produto. A gravação usa service-role no backend. RLS/revogação impedem acesso direto à tabela Apple por `anon`/`authenticated`; transações originais não podem ser transferidas entre contas. O freshness TTL é de um minuto, alinhado ao cache da função. Período Apple em grace só é aceito enquanto vigente.

A chamada StoreKit existente foi conectada a essa sincronização para compra, restauração e antes das operações colaborativas. Falha de rede não desfaz a prova local de compra, mas as RPCs novas continuam negando acesso até o backend confirmar. `student-avatar` também passou por correção de tipos Deno e continua entregando foto de colaborador somente após consentimento/equipe/área ativa.

**Limite decisivo:** o gate está implementado e testado localmente, não ativado em Supabase. A migration não foi aplicada; `apple-subscription-sync` e `student-avatar` não foram implantadas; não houve teste de Apple Sandbox real. Portanto, não publicar/ativar a colaboração para usuários reais antes de testar em staging e obter autorização explícita para qualquer alteração no projeto de produção. App Store Server Notifications V2 não foi implementado; a função atual atualiza sob demanda.

## Retorno da Apple relativo à build 27

O crash report `AF362978-DA18-480A-9DCB-461C49DEA393` identifica `EXC_CRASH`/`SIGABRT`, namespace `TCC`, com a mensagem de que faltava `NSCameraUsageDescription` no Info.plist. O caminho de câmera do menu “Take Photo” é consistente com a falha. A fonte atual `ios/App/App/Info.plist` contém a justificativa e o teste `pnpm test:ios-privacy` confirma que Debug/Release usam o Info.plist. Isso não altera o binário 27; um novo archive ainda precisa ser testado em iPhone/iPad antes de declarar a correção à Apple.

Guideline 2.1(b) é uma tarefa separada no App Store Connect. Os IDs usados no código são `br.com.coachfitpro.ios.profissional.mensal`, `br.com.coachfitpro.ios.profissional.semestral` e `br.com.coachfitpro.ios.profissional.anual`. Confirme que os registros correspondem aos produtos da conta e inclua cada assinatura, com seu **App Review screenshot**, na submissão de uma nova versão/binário. Nada foi enviado no App Store Connect.

O App ID numérico `6827708756` veio de `adam_id`/`storeInfo.itemID` do crash report, com Bundle ID `br.com.coachfitpro.ios`; não é o ID do listing de terceiro mencionado anteriormente.

## Matriz de acesso BUILD41

| Ator | Permitido | Não recebe por esta colaboração |
|---|---|---|
| Responsável que convida nutricionista | Selecionar pacientes; ler dieta colaborativa e autoria; manter a própria carteira | Editar/arquivar a dieta atribuída à colaboração; acessar a carteira do membro |
| Nutricionista autorizada | Ver pacientes consentidos; criar/editar dietas deles; usar normalmente a carteira própria | Conversas, finanças, cadastro completo, questionários/anamneses do paciente delegado e outras áreas |
| Responsável nutricionista que convida treinador | Ler Treinos/logs consentidos em página somente leitura | Editar como treinador, acessar carteira do membro, conversas ou finanças |
| Treinador autorizado | Ver/salvar Treinos consentidos usando projeção mínima | Nutrição, cadastro completo, upload de vídeo nesta área, progressão/arquivamento do conteúdo compartilhado, chats e finanças |
| Aluno/paciente autenticado | Aceitar, recusar e revogar consentimento; ver identidade/foto após aceite | Consentir por outro paciente ou ver dados de outros clientes |

## Arquivos modificados/adicionados

- Integração React: `src/App.jsx`, `src/ProfessionalTeamWorkspace.jsx`, `src/StudentProfessionalCollaborationRequests.jsx`, `src/ProfessionalDelegatedWorkoutReadOnly.jsx` e seus CSS BUILD41.
- API e entitlement: `src/supabaseApi.js`, `src/iosStoreKit.js`, `supabase/functions/apple-subscription-sync/index.ts`, `supabase/functions/apple-subscription-sync/deno.json`, `supabase/functions/apple-subscription-sync/deno.lock`, certificados públicos Apple G2/G3, `supabase/functions/student-avatar/index.ts` e `supabase/config.toml`.
- Banco e regressões: `supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql`, `scripts/product-database.test.mjs`, `scripts/professional-team-build41.test.mjs`, `scripts/ios-privacy-regression.test.mjs`, além dos markers BUILD41 já sincronizados.
- iOS/versão e docs: `ios/App/App/Info.plist`, arquivos de versionamento/workflow previamente alinhados, `REDESIGN-BUILD41.md`, este relatório, `APPLE-SUBSCRIPTION-SERVER-SETUP.md` e `APPLE-SERVER-VERIFICATION-RESEARCH.md`.

Os produtos, preços, `MARKETING_VERSION` 1.0 e Bundle ID permanecem. O número de build local é 41. O plugin Swift StoreKit e a apresentação comercial não foram alterados; o módulo JS existente apenas envia a prova de entitlements ao backend novo. A BUILD40 permanece intacta.

## Validações executadas

- `pnpm test`: **508 aprovados, 0 falhas**.
- `pnpm test:professional-collaboration`: **9 testes estáticos aprovados**, mais cenários PGlite de múltiplas equipes, consentimento, isolamento, dietas/treinos, gate sem entitlement, web/afiliado/Apple, expiração, grace e não transferência da transação.
- `pnpm test:database`: concluído com sucesso, incluindo regressões de banco existentes, colaboração e notificações/check-ins.
- `pnpm test:subscription`: **50 aprovados, 0 falhas**.
- `pnpm test:ios-privacy`: **2 aprovados**, incluindo a chave de câmera no target app.
- `pnpm lint`, `pnpm typecheck` e `pnpm build`: concluídos com sucesso. O build Vite mantém aviso não bloqueante de chunks maiores que 600 kB. A suíte/build usou fixture pública fictícia temporária; `.env.production` e `dist` foram removidos.
- Deno 2.9.8 `deno check` passou para `apple-subscription-sync/index.ts` e `student-avatar/index.ts`.
- Certificados raiz Apple incluídos foram validados como X.509 DER públicos. Nenhuma chave privada Apple foi gravada no repositório.

PGlite e Deno não substituem teste remoto. Não foram usadas credenciais Apple/Supabase em testes reais, nem testada compra Sandbox, URL assinada em ambiente remoto ou execução nativa no dispositivo.

## Ações manuais ainda necessárias

1. Preparar projeto Supabase de staging distinto do projeto de produção configurado em `supabase/config.toml`.
2. Criar a chave In-App Purchase no App Store Connect e configurar os Edge Function secrets de staging descritos em `APPLE-SUBSCRIPTION-SERVER-SETUP.md`.
3. Aplicar a migration e implantar `apple-subscription-sync` e `student-avatar` em staging; validar contas web, afiliado, Apple Sandbox, expiração, grace, consentimento, revogação e isolamento.
4. Somente após sucesso em staging e autorização explícita, planejar/aplicar/implantar os mesmos componentes em produção.
5. Fazer `cap sync`, compilar/archive a build 1.0 (41), testar câmera/fotos em iPad e iPhone e cumprir o requisito de perfis/certificados da Live Activity herdada da BUILD40.
6. No App Store Connect, preencher screenshot de App Review e associar/enviar os três produtos IAP/subscriptions junto com a nova versão. A build 41 ainda não foi carregada ou enviada.

**Nenhuma migration remota, Edge Function, build iOS, publicação, workflow GitHub, push ou envio/TestFlight foi executado.**
