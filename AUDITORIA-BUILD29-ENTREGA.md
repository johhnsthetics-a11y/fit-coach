# Auditoria de entrega — Coach Fit Pro BUILD29

## Origem e preservação

- Fonte fornecida: `/home/ubuntu/upload/CoachFitPro_BUILD28.zip`.
- SHA-256 da fonte: `a56759d2a0e0461628d49004a090690916c0a765aac7a2b3b4e0dab5a054e578`.
- Integridade do arquivo recebido: teste CRC do ZIP sem erro; 481 membros, incluindo diretórios, e 424 arquivos-fonte.
- A fonte foi extraída em uma cópia separada. O ZIP BUILD28 não foi alterado.
- A comparação final mantém todos os arquivos-fonte originais; nenhuma remoção de arquivo-fonte foi identificada. A entrega terá seis arquivos adicionados: este relatório, `README-DEMO-BUILD29.md`, `REDESIGN-BUILD29.md`, `src/TrainerExerciseLibrary.jsx` e duas folhas de estilo BUILD29.
- A cópia tem 430 arquivos-fonte após a inclusão desta auditoria. O ZIP da BUILD29 é plano, mantendo os caminhos de repositório na raiz, e seu checksum SHA-256 segue em arquivo lateral `.sha256`.

## Escopo incorporado

1. **Treinos do treinador:** merge seletivo do workspace aprovado na BUILD26, com BUILD25 como ancestral e BUILD28 como fonte atual. Mudanças em `App.jsx`, `supabaseApi.js`, `main.jsx`, `TrainerExerciseLibrary.jsx` e `trainer-workout-workspace.css` convergem o fluxo; evitam retomada/publicação ambígua; diferenciam filtros e estado de catálogo; e ampliam a área Alunos. Formulário clássico/ferramentas existentes permanecem acessíveis.
2. **Treino real do aluno:** `StudentWorkoutExecution` foi alterado, componente chamado pela rota autenticada de `StudentMobileApp` e também reutilizado pela prévia. A alteração não ficou limitada à demonstração: estado textual por série, progresso acessível, feedback contextual, descanso resumido e CTA móvel aparecem na sessão compartilhada. Foco e safe area foram tratados sem persistência paralela.
3. **Entrega iOS:** marketing version continua `1.0`; marcador do app, `public/version.txt` e `CACHE_NAME` do service worker estão sincronizados em `coach-fit-pro-trainer-student-execution-build29-20261106`; `CURRENT_PROJECT_VERSION` avançou de 28 para 29 em ambos os targets; e o workflow informa/defaulta build 29. O default `operation=verify` foi mantido — envio exige escolha explícita de `testflight`.

## Arquivos alterados em relação ao ZIP BUILD28

| Área | Arquivos modificados |
|---|---|
| App / dados | `src/App.jsx`, `src/supabaseApi.js`, `src/main.jsx` |
| iOS / release | `ios/App/App.xcodeproj/project.pbxproj`, `.github/workflows/coachfit-ios-testflight.yml`, `public/version.txt`, `public/service-worker.js` |
| Regressões / roteiro | `scripts/ios-intro-offer-regression.test.mjs`, `scripts/workout-flow-contract.test.mjs`, `scripts/workouts-browser.mjs`, `scripts/workouts-regression.test.mjs` |

Novos arquivos de implementação: `src/TrainerExerciseLibrary.jsx`, `src/trainer-workout-workspace.css` e `src/student-workout-execution-build29.css`. Os dois documentos de handoff e este relatório completam os seis arquivos adicionados.

`src/supabaseApi.js` recebeu mudanças apenas na **leitura** opcional da biblioteca, para transmitir estado de sincronização e campos de origem/taxonomia existentes. O diff não adiciona coluna, tabela, migração, RPC ou escrita nova.

## Fronteiras críticas comparadas

- Todos os arquivos `supabase/`, os SQL `supabase_*.sql` e os arquivos de plugin nativo `plugins/coachfit-storekit/ios/...` comparados byte a byte permanecem iguais ao ZIP recebido.
- Assets iOS sob `ios/App/App/`, `src/workoutSession.js`, `src/workoutCardio.js`, `src/WorkoutCompletionRating.jsx`, `src/workoutCompletionRating.css` e painéis/arquivos de StoreKit e compra (`src/NativeIosSubscriptionPanel.jsx`, `src/WebSubscriptionPanel.jsx`, `src/iosPurchaseVerification.js`, `src/iosStoreKit.js`, `src/iosStoreKitPrice.js`, `src/nativeIosSubscription.css`, `src/subscriptionPresentation.js`) não mudaram.
- `project.pbxproj` difere apenas por `CURRENT_PROJECT_VERSION = 28` → `29` nos dois targets; identificador de pacote e versão 1.0 foram preservados.
- Os testes de fluxo mantêm cobertos conclusão/notificação, sessão, convite/vínculo, publicação, preços StoreKit e verificação de compra.

## Evidência de validação

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` | passou |
| `pnpm lint` | passou; theme smoke e 6 verificações canônicas |
| `pnpm test` | 486/486 passaram |
| `pnpm test:subscription` | 50/50 passaram |
| `pnpm build` | passou; Vite compilou 943 módulos |
| Marcadores app/public/service worker | correspondem exatamente |
| Teste do ZIP BUILD28 de entrada | CRC íntegro; SHA preservado |
| `.env.production` temporário e `dist` | removidos após teste/build |

A regressão de sessão real renderiza `StudentWorkoutExecution` com `preview=false` e sessão restaurada, com uma das três séries concluída. Confere progresso 1/3, série 2 indicada como atual, CTA `Concluir série 2`, acessibilidade do progresso e ausência de auto-focus no campo da série seguinte.

**Saídas não bloqueantes observadas:** o runner Node imprime `[ERROR] The build was canceled` depois do resumo da regressão SSR, mas encerra com código 0; na suíte final, 486 passaram e nenhuma falhou/cancelou. O build web também informa chunk principal acima de 600 kB, sem falha de compilação. Essas mensagens estão registradas para que a IA que executar o workflow não as confunda com um teste reprovado.

## Empacotamento e próximos limites

A cópia contém os artefatos do usuário existentes, incluindo `__qa-output`; o empacotamento deve omitir dependências/cache/saídas geradas (`node_modules`, `.git`, `dist`, `.vite`, `coverage`, `__pycache__`, arquivos `.env*` exceto `.env.example`, IPA/archives temporários). A fixture pública fictícia usada na validação não está no pacote. Não foram criados segredos, credenciais ou alterações de backend.

Não executados: sincronização Capacitor, compilação/assinatura Xcode, workflow GitHub, upload/instalação no TestFlight ou verificação visual em iPhone físico. O ZIP é fonte para handoff. Para o envio pelo workflow existente: branch com este código, `operation=testflight`, `version=1.0`, `build_number=29`, e secrets/configuração públicos já preparados no repositório. Confirme antes que o build 29 está disponível no App Store Connect.
