# BUILD29 — Treinos do treinador + execução real do aluno

**Estado:** pacote-fonte isolado, baseado em `CoachFitPro_BUILD28.zip`; não enviado ao GitHub, App Store Connect ou TestFlight.

**SHA-256 do anexo original BUILD28:** `a56759d2a0e0461628d49004a090690916c0a765aac7a2b3b4e0dab5a054e578`. O ZIP recebido foi preservado sem modificação.

**Modo:** Redesign · Preserve.

## Design Read e posicionamento

- **Artefato:** área Treinos do treinador e sessão real do plano no app móvel do aluno.
- **Público:** treinador que organiza/prescreve planos e aluno que registra séries durante o treino.
- **Linguagem visual:** ferramenta operacional Coach Fit Pro, verde-grafite/teal; prioridade para leitura rápida e próxima ação, sem estética SaaS genérica.
- **Dials da execução:** variação visual 4/10; movimento 2/10; densidade 5/10; dependência de assets 4/10; fidelidade à marca 10/10.
- **Função narrativa:** acompanhar uma sessão em andamento e confirmar o próximo passo.
- **Distância de leitura:** curta, no iPhone e com uso de uma mão.
- **Temperatura:** ativa e encorajadora, sem agressividade.
- **Capacidade:** estado atual, progresso e ação da série legíveis sem competir com timer, teclado ou navegação inferior.

A direção reutiliza a proposta de treino do aluno, `brand-spec.md`, os tokens e assets da fonte BUILD28. Não foi introduzida fonte, imagem, cor de marca ou dependência externa.

## Preservar, melhorar, remover

**Preservar:** melhorias já presentes no anexo BUILD28, incluindo notificações de conclusão, chat, contas/convites, cadastro e exclusão, temas, prévia BUILD25, execução/cardio, sincronização, rating, StoreKit e os demais domínios.

**Melhorar:** integrar seletivamente o workspace aprovado de Treinos do treinador da BUILD26, usando BUILD25 como ancestral comum para preservar mudanças mais novas da BUILD28; na sessão real do aluno, transformar a transição pendente → atual → concluída em uma sequência visível, mostrar contagem/progresso por exercício, resumir o registro e o descanso e apresentar uma ação contextual no celular.

**Remover:** retomada silenciosa/atalhos do treinador com intenção ambígua e a dependência de uma troca de cor pouco evidente como único sinal de série concluída. A opção de revisar ou reabrir uma série continua disponível.

## O que foi integrado em Treinos do treinador

- Manager comum para desktop e mobile, com Planos, Biblioteca e Alunos como áreas independentes.
- Decisão explícita de continuar, descartar ou iniciar sem substituir silenciosamente o rascunho local existente; progresso da edição fica no armazenamento local já existente.
- Ações separadas de salvar rascunho, usar plano como base/personalizar e publicar/atribuir; publicação exige revisão e destinatário visível.
- Biblioteca com busca prioritária, filtros independentes e estados de origem/sincronização/fallback; exercícios selecionados ficam visíveis.
- Área Alunos com busca e filtros próprios, planos publicados acessíveis por pessoa e ações de criar/editar/usar como base sem atribuição imediata.
- Os componentes clássicos continuam disponíveis no painel de ferramentas secundárias; contratos e callbacks de `Workouts` permanecem compatíveis.

A integração foi feita por merge de três vias — BUILD28 atual, BUILD25 como ancestral e BUILD26 aprovado como alteração — em vez de substituir `App.jsx` inteiro por uma cópia anterior.

## O que foi alterado na sessão real do aluno

A sessão autenticada em `StudentMobileApp` chama `StudentWorkoutExecution` com os callbacks reais de carregar, salvar, concluir, encerrar e avaliar. O redesenho foi aplicado nesse componente compartilhado pela execução real e pela prévia — não apenas ao modo de demonstração.

- Cada série apresenta o estado textual **Concluída**, **Série atual** ou **Pendente**, além da carga/repetições registradas e da meta.
- Uma barra acessível mostra `concluídas/total` do exercício atual; o topo também resume exercícios e séries concluídos no dia. Os valores são calculados dos `setLogs` existentes.
- Após concluir, um feedback anuncia a série, a próxima pendente e o descanso atual, sem depender apenas da mudança de cor ou do timer flutuante.
- No mobile, a barra de próxima ação oferece registrar/concluir a série ou avançar quando o exercício está completo. Quando um campo de série recebe foco, a barra cede espaço e os controles inline permanecem utilizáveis.
- Concluir uma série desfoca o campo e **não abre automaticamente o teclado** para a série seguinte. Se faltar repetição, a validação existente continua levando ao campo que precisa de correção.
- A barra considera a safe area e a navegação inferior. Cardio mantém os controles próprios.

## Contratos protegidos

- Não mudar estrutura/serialização de `setLogs`/`cardioLogs`, `workoutSession.js`, chaves de sessão, `completionToken`, timer, descanso, idempotência ou callbacks reais da sessão.
- Preservar diferença entre concluir e encerrar antecipadamente, rating apenas após conclusão integral, resumo, sincronização e notificação ao treinador.
- Preservar callbacks/props do treinador, analytics/source, `saveRemoteWorkout`, RPC `save_coach_workout`, ownership, idempotência e metadata de treino.
- A leitura opcional do catálogo não cria schema, tabela, RPC, migração ou contrato de gravação.
- Não alterar StoreKit, preços, cobrança, financeiro, APNs, dietas, mensagens, Supabase schema/RPC/Edge Functions.
- Preservar `1.0` como versão de marketing e avançar somente o build iOS para `29`.

## Marcadores e workflow

O marcador do app, `public/version.txt` e cache do service worker são idênticos: `coach-fit-pro-trainer-student-execution-build29-20261106`. Os dois `CURRENT_PROJECT_VERSION` do Xcode e o default/fallback `build_number` do workflow foram avançados para 29; a versão de marketing permanece 1.0. A operação default do workflow continua `verify` para não enviar uma build por acidente.

Para envio manual pelo workflow incluído, selecionar `operation=testflight`, `version=1.0` e `build_number=29`, após confirmar no App Store Connect que o build 29 ainda está livre. `operation=verify` compila/verifica sem enviar ao TestFlight. A operação `testflight` exige os secrets de assinatura Apple, perfil de provisionamento, App Store Connect e configuração pública do Supabase já esperados pelo workflow.

## Validação executada

- `pnpm typecheck`: passou.
- `pnpm lint`: passou; theme smoke e alinhamento canônico da versão passaram.
- Suíte completa `pnpm test`: **486/486 passaram**.
- `pnpm test:subscription`: **50/50 passaram**.
- `pnpm build`: compilação web Vite passou (943 módulos). Vite manteve o aviso não bloqueante de chunk principal maior que 600 kB.
- A regressão nova renderiza o executor com `preview=false` e uma sessão real restaurada em que a série 1 já foi concluída; confirma progresso 1/3, série 2 atual e a ação **Concluir série 2**, além de verificar que não há auto-foco no próximo campo.
- A fixture temporária de `.env.production` continha URL pública e chave publishable fictícia apenas para os testes/build. O arquivo e `dist` foram removidos; nenhum segredo foi incluído.

## Não executado / rollback

Não foram executados `cap sync`, `xcodebuild archive`, assinatura/exportação IPA, GitHub push, workflow, upload ou instalação no TestFlight/dispositivo. Os testes provam o caminho de código e os contratos em ambiente automatizado, não substituem a conferência visual final no iPhone. O rollback é o ZIP BUILD28 original preservado, sem modificações.
