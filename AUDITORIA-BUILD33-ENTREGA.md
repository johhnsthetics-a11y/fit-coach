# Auditoria de entrega — BUILD33

## Origem e limite

- ZIP recebido: `CoachFitPro_WEB_PUBLICACAO_FIGMA_20261109.zip`.
- SHA-256 de origem: `dab8b6c3b13d87cb39299b4157826c9261d88298360670f2304cc969b4bbae28`.
- Modo: **Redesign · Preserve**. Escopo funcional restrito às cinco etapas da experiência de treino do aluno e à prévia correspondente.
- A aplicação original e o ZIP de entrada foram mantidos intactos; o trabalho ocorreu em cópia separada.

## Arquivos de produto alterados

- `src/App.jsx`: usa título plano/dia sem duplicação nas cinco etapas; progresso segmentado e sequência; estados coerentes do executor; prévia local; duração sem cronometragem real apresentada como indisponível.
- `src/student-workout-figma-dark.css`: superfície dark oficial acima do reset legado, acento teal, progresso/estados do Figma e cascata de CTA contrastante no tema claro.
- `scripts/student-workout-preview-flow.test.mjs`: cobre as cinco telas, modo sem gravação, tokens dos dois temas e cabeçalho sem repetição.

## Identificação de build e documentos

- `public/version.txt`, `public/service-worker.js`, `src/App.jsx`, `ios/App/App.xcodeproj/project.pbxproj`, `scripts/ios-intro-offer-regression.test.mjs` e `.github/workflows/coachfit-ios-testflight.yml` identificam a BUILD33/cache. Versão comercial permanece `1.0`; a operação padrão do workflow continua `verify`.
- `README-BUILD33.md`, `REDESIGN-BUILD33.md`, `TODO-BUILD33.md` e este arquivo registram escopo, evidências e limites.

## Contratos conferidos como inalterados

Comparação com o ZIP recebido confirmou sem mudanças: `src/supabaseApi.js`, `src/workoutSession.js`, `src/WorkoutCompletionRating.jsx`, `src/workoutCompletionRating.css` e `src/workoutCardio.js`. StoreKit/preços, backend/Supabase, histórico e esquema de sessão não receberam alterações. Marcadores de build/cache não alteram regras comerciais.

`preview=true` continua sem callback real de salvar sessão, concluir treino, encerrar ou enviar avaliação. Browser Acceptance instrumentou sentinelas e verificou `preview writes=0`; avaliações reais continuam sendo enviadas apenas pelo fluxo real do aluno. Nenhuma chamada backend foi feita durante QA.

## Evidências de validação

| Verificação | Resultado |
|---|---|
| Browser Acceptance / Chromium | PASS: 390×844 e 320×740; overview, execution, rest, exercise-complete, summary e early-end |
| Interações | PASS: pause/resume, ajuste de descanso, pular, voltar, editar registro, avançar, concluir, nova sessão e encerramento antecipado |
| Layout estreito | PASS: overflow horizontal `0`; conteúdo e CTA acessíveis |
| Isolamento de prévia | PASS: callbacks de persistência `0`; escritas em storage `0` |
| Testes focados de treino/prévia/sessão/rating | PASS: 22/22 |
| Suíte completa `pnpm test` | PASS: 494/494 |
| `pnpm test:subscription` | PASS: 50/50 |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS: theme smoke + 6 alinhamentos canônicos |
| `pnpm build` | PASS; aviso não fatal de chunk JavaScript >600 kB |

As capturas das cinco telas e do encerramento ficaram fora do ZIP em `/home/ubuntu/coachfit-build33/qa-evidence`. O build local usou uma fixture Supabase publicável fictícia exigida pelo teste; `.env.production` foi removido. O diretório `dist` local também foi removido para evitar incluir assets compilados com configuração de teste; o workflow deve recompilar usando os secrets reais do projeto.

## O que não foi executado

`cap sync`, archive/Xcode, browser real de dispositivo iOS, workflow GitHub, publicação web, push, submissão ou upload para TestFlight não foram executados. O ZIP é fonte para revisão/compilação; não representa uma versão já enviada à Apple.