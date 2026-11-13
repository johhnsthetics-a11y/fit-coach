# Auditoria BUILD44 — onboarding de convite e ativação da Equipe

## Resumo

Esta cópia foi derivada da BUILD43 enviada pelo usuário e recebeu uma extensão pontual para o onboarding de profissionais convidados e para a transição pós-assinatura. O número da próxima compilação foi alinhado para **44** nos marcadores web/iOS. Não foi criado, arquivado, enviado ou publicado um binário.

## Comportamento implementado

- **Cadastro por convite:** ao abrir o link do convite, o login consulta uma nova RPC de contexto mínimo. A tela apresenta e pré-preenche o e-mail convidado, fixa o e-mail quando o contexto é válido, e fixa a especialidade (treinador ou nutricionista). A opção de cadastro como aluno fica oculta enquanto a pessoa está nessa jornada, para evitar criar o tipo de conta errado por engano.
- **Proteção do convite:** a conta continua sendo validada pelo fluxo server-side existente para o e-mail e a especialidade exatos. Alterar o campo ou manipular os parâmetros do link não substitui a validação do servidor. O convite continua pendente até a pessoa autenticada aceitá-lo explicitamente.
- **Confirmação de e-mail:** se o Supabase exigir confirmação, o link de retorno mantém `team_invite` e a especialidade na URL e direciona a pessoa para entrar novamente com o mesmo endereço. A tela orienta esse passo e preserva o caminho de aceite.
- **Privacidade do pré-cadastro:** `get_professional_team_invite_signup_context(uuid)` retorna somente UUID do convite, e-mail convidado, papel profissional, nome da equipe e validade. Exige convite pendente, não expirado, papel suportado e pacientes selecionados ainda pertencentes ao responsável. Não retorna IDs, nomes, dados clínicos ou conteúdo dos pacientes. A RPC pode ser chamada sem login porque é usada antes da autenticação; a validação autenticada de cadastro/aceite segue sendo a autoridade.
- **Assinatura sem perder Equipe:** um membro sem assinatura continua podendo usar o espaço de colaboração permitido e agora recebe, na área Equipe, um CTA claro para os planos profissionais. A assinatura ativa libera as ferramentas próprias do papel da conta; não remove o membro, a equipe nem as delegações aceitas. O teste PGlite cobre o membro convidado que assina e, depois, cria sua própria equipe, permanecendo nas duas.
- **Ativação após confirmação:** após a confirmação real do acesso web, Apple ou afiliado, o app mostra uma tela de carregamento com a marca e informa que sincronizará ferramentas/equipes. Depois atualiza os dados da carteira própria e da colaboração; em sucesso, abre a área profissional. Em falha temporária, há opções de tentar novamente, abrir Equipe ou sair.
- **Limites de assinatura:** não foram alterados IDs dos produtos, preços, períodos, telas de compra, elegibilidade de oferta ou verificação nativa StoreKit. A mudança relacionada à assinatura é somente a espera pela sincronização pós-confirmação e a transição de tela.

## Arquivos principais alterados

| Arquivo | Alteração |
|---|---|
| `src/App.jsx` | Contexto do convite no login/cadastro; preservação de papel/equipe no retorno de confirmação; CTA para assinatura dentro de Equipe; estado de ativação e tratamento de falha após entitlement confirmado. |
| `src/supabaseApi.js` | Wrapper que lê e normaliza o contexto mínimo da RPC de convite. |
| `supabase/migrations/20261112213600_team_invite_signup_context_build44.sql` | RPC aditiva, somente de leitura, para pré-preencher o formulário. |
| `scripts/product-database.test.mjs` | Cenários PGlite de exposição mínima, convite expirado/aceito e membro que assina sem perder a equipe. |
| `scripts/professional-team-build41.test.mjs` | Contratos estáticos do onboarding e da ativação. |
| `scripts/ios-purchase-verification.test.mjs` | Assertion atualizada para o comportamento pós-compra: assinante novo aguarda ativação; assinante já ativo retorna ao workspace. |
| `public/version.txt`, `public/service-worker.js`, `.github/workflows/coachfit-ios-testflight.yml`, `ios/App/App.xcodeproj/project.pbxproj`, `src/App.jsx`, `scripts/ios-intro-offer-regression.test.mjs` | Marcadores sincronizados para build 44; `MARKETING_VERSION` continua 1.0 e o workflow continua manual. |
| `BUILD44-PLANO-ONBOARDING-EQUIPE.md` | Registra escopo, interpretação e contratos protegidos. |

## Verificações executadas

- `pnpm test:professional-collaboration`: aprovado; 24 testes estáticos e os cenários PGlite de colaboração passaram.
- `pnpm test:subscription`: aprovado; 50/50 testes.
- `pnpm test`: aprovado; 510/510 testes. A saída imprimiu uma mensagem isolada de cancelamento de build, embora a suíte tenha terminado com zero falhas; o `pnpm build` executado em seguida concluiu normalmente.
- `pnpm test:database`: aprovado; PGlite e demais testes de banco concluídos sem falhas.
- `pnpm test:ios-privacy`: aprovado; 2/2 testes.
- `pnpm lint` e `pnpm typecheck`: aprovados.
- `pnpm build`: Vite concluiu a build web com sucesso. Permanece um aviso de bundle JavaScript grande (>600 kB), preexistente e fora do escopo desta extensão.
- `.env.production` fictício usado somente pelo teste/build local e `dist/` foram removidos após a execução.

Os testes automatizados não equivalem a uma execução real com e-mail, Supabase/StoreKit de staging ou aparelho iOS. Nenhum browser/device acceptance foi declarado como realizado.

## Pendências e implantação

1. Aplicar **em staging**, antes do app, a nova migration `supabase/migrations/20261112213600_team_invite_signup_context_build44.sql`, depois das migrations anteriores de Equipe/convite já requeridas pelo projeto.
2. Testar um convite para e-mail sem conta: confirmar e-mail e papel na tela, completar cadastro com o mesmo endereço, entrar, aceitar o convite e ver apenas a especialidade/pacientes autorizados.
3. Tentar e-mail/papel divergentes e convites expirados/cancelados; o servidor deve rejeitar o cadastro/aceite. Confirmar que a RPC pré-login não retorna dados de pacientes.
4. Testar a compra sandbox/web de uma conta convidada: aguardar a tela de ativação, confirmar ferramentas próprias do papel e verificar que Equipe/membro/delegações permanecem intactos. Repetir nos temas claro/escuro e em telas mobile/iPad.
5. Só após staging aprovado, planejar uma aplicação em produção e uma nova compilação. Esta entrega **não** aplicou migration, não chamou função Edge, não alterou Supabase real, não executou `cap sync`, Xcode Archive, workflow GitHub, deploy ou TestFlight.

Esta mudança trata o onboarding BUILD44 da Equipe; não constitui resposta/submissão dos itens de revisão Apple da BUILD27.