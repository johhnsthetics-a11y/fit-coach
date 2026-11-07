# BUILD31 — Tipografia e navegação de Treinos

## Base e modo

Derivada da fonte BUILD30, entregue como `CoachFitPro_BUILD30_TREINOS_ALUNO_GAMIFICADO_SOURCE.zip` (SHA-256 `bec0b9403e9204bec650979b7b7aadf54eb2c8f9ebcd200e058b7323b4cfbfb6`). Modo **Redesign · Preserve**, ajuste visual restrito ao workspace Treinos do treinador.

## Design Read e decisões

Artifact: workspace desktop/mobile para prescrição. Audience: treinador que passa a maior parte do trabalho montando e acompanhando treinos. Linguagem: tipografia firme e escaneável dentro da identidade Coach Fit Pro; fonte herdada da aplicação, sem carregamento de outra família. Dials: variação 4, movimento 2, densidade 7, assets 1, fidelidade de marca 10.

A navegação é informação estrutural, não um subtítulo comprimido: no painel com largura ≥900 px, as cinco áreas — Planos, Rascunhos, Exercícios, Alunos e Evolução — usam cinco colunas iguais e visíveis; entre 620 e 899 px, usam grade de três colunas; em espaço menor, seguem em faixa horizontal rolável com snap e alvos confortáveis. O `max-width: 420px` herdado de uma regra móvel foi removido especificamente deste componente.

Títulos usam escala fluida, pesos mais fortes e espaçamento de letras ajustado; descrições ficam mais legíveis. Cores, superfície ativa, fonte base, tab semantics, foco e nomes das áreas são mantidos. Não foram acrescentados assets ou dados fictícios.

## Preservação

Nenhum fluxo, callback, seleção de aba, filtro, storage, analytics, payload, StoreKit, preço, Supabase ou sessão do aluno foi alterado. A mudança visual está restrita à folha `trainer-workout-build30.css`; os demais deltas de código atualizam apenas os marcadores de build e as regressões correspondentes. BUILD30 foi preservada.

## Estado

BUILD31: `pnpm test` passou 491/491; `pnpm test:subscription` 50/50; typecheck, lint (6 verificações) e build web passaram. O bundle principal continua emitindo aviso Vite de tamanho (>600 KB); esta tarefa não fez code-splitting do app. Ver `README-BUILD31.md` e `AUDITORIA-BUILD31-ENTREGA.md`. Não foi executado browser acceptance, Xcode archive, Run workflow, TestFlight ou publicação.