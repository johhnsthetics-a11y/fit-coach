# Auditoria de entrega — BUILD32

## Baseline e escopo

BUILD32 deriva do ZIP BUILD31 `CoachFitPro_BUILD31_TREINOS_TIPOGRAFIA_SOURCE.zip`, SHA-256 `be381b71addf9355ec3baae1a07caf0363174315ee140ef0fbccb94969293d10`. A baseline não foi modificada. O modo é Redesign · Preserve, limitado a tipografia do workspace Treinos do treinador e ao marcador de release.

## Mudança de tipografia

A fonte anteriormente indicada em CSS mas não empacotada foi substituída, somente em títulos e elementos de display da área Treinos, por Barlow Condensed local em pesos 600/700/800. Os WOFF2 usam a cobertura Latin com as letras necessárias para português; os arquivos foram validados pelo cabeçalho `wOF2`. `OFL-Barlow.txt` acompanha os arquivos e a licença SIL Open Font License 1.1 foi conferida no repositório Barlow. As referências oficiais são [Google Fonts — Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) e [repositório Barlow](https://github.com/jpt/barlow).

O CSS usa URLs locais `/assets/fonts/...`; não há requisição a fonts.googleapis.com ou fonts.gstatic.com. O corpo do app conserva sua família global. A folha existente do treinador mantém o layout BUILD31: cinco colunas em contêiner largo, três colunas em largura média e faixa rolável em contêiner estreito.

## Contratos e release

`src/App.jsx` recebe somente novo valor para `COACH_FIT_PRO_BUILD_MARKER`. `public/version.txt`, cache do service worker, teste de cache, `CURRENT_PROJECT_VERSION` e default do workflow avançam para 32. O workflow mantém `verify` como padrão e exige seleção explícita de `testflight`. Marketing version permanece 1.0.

`src/supabaseApi.js`, `src/workoutSession.js`, `src/workoutCardio.js`, StoreKit, assinatura/preços, rating, migrations, callbacks, analytics e payloads permanecem byte a byte iguais à BUILD31. Não houve mudanças em fluxo, backend ou dados.

## Validação e limites

- `pnpm test`: 492 passaram, zero falharam; inclui existência/magic bytes de cada WOFF2 e licença.
- `pnpm test:subscription`: 50 passaram, zero falharam.
- Typecheck: passou.
- Lint, tema e alinhamento canônico: 6 passaram, zero falharam.
- Build web: concluído em 9,53 s; continua o aviso do Vite para o chunk principal (~1,24 MB minificado).
- `.env.production` fictício e `dist` foram removidos. O ZIP exclui `.env*`, dependências, caches e artefatos compilados.

Não foram executados browser acceptance, comparação visual em navegador, cap sync, Xcode archive, workflow GitHub, upload TestFlight, push ou publicação.