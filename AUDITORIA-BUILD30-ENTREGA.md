# Auditoria de entrega — BUILD30

## Baseline e escopo

- Baseline recebida: `CoachFitPro_BUILD29_CORRIGIDA_SOURCE.zip`.
- SHA-256 baseline: `85b36988872bae38d9472a62b02430915e22a8ae6a4c5ef1020a7db1d8e090d9`.
- Modo: Redesign · Preserve, aprovado pelo usuário.
- Escopo: organização da página Treinos do treinador, visualização fiel do aluno, experiência real de execução e feedback final por estrelas.
- A fonte anexada e os ZIPs anteriores permanecem intactos.

## Mudanças da BUILD30

1. Navegação do treinador separada em Planos, Rascunhos, Exercícios, Alunos e Evolução; busca/filtros são contextuais e ferramentas legadas ficam sob demanda.
2. A prévia do aluno ganhou composição desktop lado a lado e layout mobile responsivo, usa a jornada `overview → plan → execution → summary` e reutiliza `StudentWorkoutExecution` em modo preview.
3. A sessão real destaca a série corrente, resume séries concluídas, deixa progresso e descanso mais legíveis e contextualiza a ação primária mobile.
4. A avaliação final mostra estrelas sem numerais na interface; o número 1–5 continua como valor interno e semanticamente acessível.
5. Feedback visual usa os tokens existentes da marca, estados reais e movimento breve; `prefers-reduced-motion` é respeitado. Nenhuma métrica de gamificação não existente foi inventada.
6. Marcadores da aplicação, service worker, teste de cache e projeto iOS identificam build 30; workflow continua no modo `verify` por padrão.

## Contratos protegidos

- O componente de sessão `src/workoutSession.js`, persistência e resumo da execução permaneceram byte a byte iguais à baseline.
- `src/supabaseApi.js`, StoreKit (`src/iosStoreKit.js`), painéis de assinatura e demais superfícies comerciais permaneceram iguais.
- Não houve migração, alteração de schema/RPC/backend, preço, produto, chave de localStorage, payload de conclusão ou política de notificação.
- `src/WorkoutCompletionRating.jsx` e `src/workoutCompletionRating.css` mudaram apenas na apresentação/feedback de estrelas: números visuais removidos, valor interno e rótulos acessíveis preservados.
- Prévia do treinador segue sem gravar sessão, progresso ou rating real.

## Arquivos alterados

`REDESIGN-BUILD30.md`; `src/App.jsx`; `src/WorkoutCompletionRating.jsx`; `src/workoutCompletionRating.css`; `src/student-workout-build30.css` (novo); `src/trainer-workout-build30.css` (novo); `public/version.txt`; `public/service-worker.js`; `ios/App/App.xcodeproj/project.pbxproj`; `.github/workflows/coachfit-ios-testflight.yml`; `scripts/ios-intro-offer-regression.test.mjs`; `scripts/student-workout-rating.test.mjs` (novo); `scripts/workouts-regression.test.mjs`.

## Evidências

- `pnpm test`: **490 passaram, 0 falharam**.
- Treinos/prévias: **84 passaram, 0 falharam**.
- `pnpm test:subscription`: **50 passaram, 0 falharam**.
- Typecheck: passou.
- Lint/theme/canonical checks: **6 passaram, 0 falharam**.
- `pnpm build`: compilação web concluída.
- `public/version.txt`, cache do service worker e `CURRENT_PROJECT_VERSION` nos targets Debug/Release alinhados em 30.
- A comparação com a baseline registra 13 arquivos modificados; os arquivos de assinatura, sessão e Supabase listados acima são byte a byte iguais.
- Fixture de teste removida; `dist` e dependências não fazem parte do ZIP-fonte.

## Limites

Não houve browser acceptance, validação responsiva automatizada, `cap sync`, archive/Xcode, Run workflow, upload ao TestFlight, GitHub push ou publicação. O build web não valida assinatura nem distribuição iOS. O workflow é manual, e o valor padrão de `operation` permanece `verify`; qualquer upload exige selecionar `testflight` e confirmar que o número 30 é inédito/disponível no App Store Connect.