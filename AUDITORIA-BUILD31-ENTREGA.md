# Auditoria de entrega — BUILD31

## Baseline

- Fonte: `CoachFitPro_BUILD30_TREINOS_ALUNO_GAMIFICADO_SOURCE.zip`.
- SHA-256: `bec0b9403e9204bec650979b7b7aadf54eb2c8f9ebcd200e058b7323b4cfbfb6`.
- Modo: Redesign · Preserve, ajuste visual solicitado pelo usuário.
- BUILD30 foi copiada para nova pasta de trabalho e não foi modificada.

## Alteração funcional/visual

A causa do print era o `max-width: 420px` da regra global `.mobile-workout-tabs`, que também restringia a barra no desktop. A folha do workspace agora substitui esse limite com `max-width: none`. Container queries distribuem as cinco áreas em uma linha de cinco colunas em painéis largos, três colunas em painéis médios e faixa rolável em painéis estreitos. Título, subtítulos e rótulos usam escala fluida, peso e tracking reforçados; o stack tipográfico vem herdado do app. Não houve inclusão de fonte externa, asset, tonalidade ou componente adicional.

## Integridade dos contratos

Não foram alterados dados ou callbacks do treinador/aluno, regras de publicação, filtros, localStorage, eventos analytics, Supabase, migrations, payloads de sessão, notificações, StoreKit ou assinatura/preços. `src/App.jsx` teve apenas seu marcador de release atualizado. O projeto Xcode avança `CURRENT_PROJECT_VERSION` para 31 nos targets Debug/Release; marketing version permanece 1.0. O workflow continua com `verify` como padrão e exige seleção explícita de `testflight` para upload.

## Arquivos de código atualizados

`src/trainer-workout-build30.css` (tipografia e layout responsivo); `src/App.jsx` (marcador); `public/version.txt`; `public/service-worker.js`; `ios/App/App.xcodeproj/project.pbxproj`; `.github/workflows/coachfit-ios-testflight.yml`; `scripts/ios-intro-offer-regression.test.mjs`; `scripts/student-workout-rating.test.mjs` (apenas rótulo); `scripts/workouts-regression.test.mjs` (teste de layout por container). Foram adicionados este relatório, `README-BUILD31.md` e `REDESIGN-BUILD31.md`.

## Evidências

- `pnpm test`: 491 passaram, zero falharam; inclui assert de cinco colunas, três colunas e scroll estreito.
- `pnpm test:subscription`: 50 passaram, zero falharam.
- Typecheck: passou.
- Lint/theme/canonical alignment: 6 passaram, zero falharam.
- Build web: concluído em 9,64 s; Vite sinalizou chunk principal acima de 600 KB (~1,24 MB minificado).
- Fixture pública fictícia removida; `dist` e dependências estão excluídos do ZIP.

Não foram executados browser acceptance, testes de viewport no navegador, cap sync, Xcode archive, workflow, upload ao TestFlight, push ao GitHub ou publicação. O build web não substitui compilação iOS.