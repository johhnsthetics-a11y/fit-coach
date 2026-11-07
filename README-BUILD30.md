# Coach Fit Pro — BUILD30

Fonte derivada de `CoachFitPro_BUILD29_CORRIGIDA_SOURCE.zip` (SHA-256 do arquivo recebido: `85b36988872bae38d9472a62b02430915e22a8ae6a4c5ef1020a7db1d8e090d9`). O ZIP recebido foi preservado; esta BUILD30 foi preparada em uma cópia isolada.

## O que foi atualizado

- **Treinos do treinador:** áreas separadas para Planos, Rascunhos, Exercícios, Alunos e Evolução. Detalhes só aparecem após abrir um plano, e as ferramentas expressa/clássica ficam recolhidas até serem solicitadas — eliminando conteúdo repetido no scroll.
- **Visão do aluno:** prévia ampla e responsiva, com controles da jornada separados do executor. Mantém o plano/aluno selecionados e reutiliza `StudentWorkoutExecution`, sem gravar sessão, séries ou avaliação reais durante a prévia.
- **Execução real do aluno:** contexto do treino mais visível; série atual destacada, séries já feitas resumidas, progresso claro, descanso integrado e ação principal contextual. A jornada ficou mais interativa com feedback breve em estados reais, sem inventar XP, streaks, rankings ou recompensas.
- **Avaliação final:** estrelas visuais sem numerais aparentes. A seleção numérica interna 1–5 e os rótulos acessíveis continuam para preservar o envio e a leitura por tecnologia assistiva.
- **Identificação da fonte:** app, cache/service worker, testes e projeto Xcode avançados para BUILD30. O workflow mantém `operation: verify` como padrão; `testflight` continua uma opção explícita.

## Validação feita

- `pnpm test`: **490/490** testes passaram.
- Regressões específicas de Treinos e prévias: **84/84** passaram.
- `pnpm test:subscription`: **50/50** passaram.
- `pnpm typecheck`: passou.
- `pnpm lint`: passou (6 verificações).
- `pnpm build`: build web concluído.
- Fixture Supabase de teste removida; `dist` não está incluído.

Não foi executado teste de aceitação visual em navegador, archive do Xcode, workflow do GitHub, envio ao TestFlight nem publicação. A compilação web não equivale a uma compilação iOS/TestFlight.

## Para a outra IA / Run workflow

A fonte está pronta para revisão e execução manual. O workflow `.github/workflows/coachfit-ios-testflight.yml` tem versão `1.0`, número de build padrão `30` e operação padrão `verify`. **Para solicitar upload, selecione explicitamente `testflight` no Run workflow** e confirme antes no App Store Connect que o build `30` ainda está disponível para a versão `1.0`. Não presuma que o workflow já foi executado.

Nenhuma chave, `.env.production`, diretório `dist`, assinatura, preço, alteração de StoreKit, migração de banco ou dado real foi adicionado por esta mudança.