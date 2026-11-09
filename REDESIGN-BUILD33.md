# BUILD33 — Fidelidade Figma da execução do aluno

## Base e escopo

Baseline: `CoachFitPro_WEB_PUBLICACAO_FIGMA_20261109.zip` (SHA-256 `dab8b6c3b13d87cb39299b4157826c9261d88298360670f2304cc969b4bbae28`), extraída em cópia isolada. Modo **Redesign · Preserve**. Alterações restritas ao fluxo de treino do aluno: visão geral, execução, descanso, exercício concluído e resumo da sessão, incluindo a prévia do treinador que reutiliza `StudentWorkoutExecution`.

## Design Read

- Artefato: fluxo mobile de execução, estado e revisão de uma sessão de treino.
- Público: aluno do Coach Fit Pro, usando principalmente celular durante a atividade.
- Linguagem: interface esportiva funcional do Figma, com hierarquia compacta, progresso segmentado, foco no exercício/série atual e teal de marca como ação primária.
- Posicionamento: narrativa de uma única sessão; visualização a aproximadamente 10 cm; temperatura motivadora, mas profissional; capacidade prioriza ação principal e mantém detalhes reais alcançáveis por rolagem.
- Dials: variação 2/10, movimento 3/10, densidade 5/10, dependência de assets 2/10, fidelidade à marca 10/10.

## Sistema visual

Tokens escuros existentes em `brand-spec.md`: base `#0B1516`, cartões `#111E20`, texto `#F4FFFD`, texto secundário `#A7BDBA` e teal `#4EE9D0`. A ação primária usa teal com texto escuro para contraste. O tema claro mantém superfície branca, cartões mint e ação `#087F72` com texto branco. O bloco de CSS específico corrige a superfície transparente herdada do tema escuro e a cascata do botão no tema claro. Não foram introduzidas novas fontes nem imagens fictícias.

## Preservar / melhorar / remover

- **Preservar:** contratos e dados reais de sessão; edição de séries, carga e repetições; temporizador, pausa/retomada e salto; cardio; retorno ao overview; encerramento antecipado; conclusão, histórico, XP e avaliação 1–5; componentes e mídia vinculados; callbacks reais existentes.
- **Melhorar:** barras segmentadas alinhadas ao Figma; sequência executável também na prévia; retorno do descanso ao exercício em andamento; retorno da tela de exercício concluído para revisão/edição; mensagens e contadores refletem apenas registros efetivos; títulos de plano/dia não se repetem quando são iguais; duração sem cronometragem real aparece como indisponível na prévia, não como `00:00`.
- **Remover:** fallback demonstrativo que rotulava séries não concluídas como concluídas na tela de revisão; nenhum dado, mídia, recompensa ou resultado fictício foi adicionado à aplicação.

## Implementação por etapa

1. **Visão geral:** resumo do plano/dia, objetivo, contagem de exercícios/séries, estimativa, progresso segmentado e sequência de exercícios com CTA para iniciar/retomar.
2. **Execução:** exercício e mídia já associados, orientação, alvo de séries/repetições, registro/edição de carga e repetições e CTA contextual.
3. **Descanso:** timer circular, ajuste de ±15 s, pausa/retomada, próximo exercício/série e opção de pular, com retorno seguro à série.
4. **Exercício concluído:** somente séries registradas; registros continuam editáveis; próximo exercício ou revisão pendente permanece acessível.
5. **Resumo:** indicadores derivados da sessão, progressão, avaliação em estrelas sem números visíveis e retorno. Na prévia, dados/resultados locais ficam identificados e não são gravados.

## Contratos protegidos e risco

`preview=true` continua sem callbacks reais de conclusão, encerramento, avaliação ou salvamento da sessão; seus estados permanecem locais e nenhuma sessão/avaliação é salva no histórico. A sessão real mantém chaves, formato serializado, RPCs e semântica de conclusão/encerramento. `src/supabaseApi.js`, `src/workoutSession.js`, rating/StoreKit e preços permanecem iguais ao ZIP recebido. As únicas mudanças técnicas fora do executor são marcadores de versão/cache e o default de build number, sem alterar a operação padrão `verify` do workflow.

Maior risco: misturar uma transição de prévia com a gravação real do aluno. Mitigação: manter o guard `preview`, usar a mesma execução sem callbacks no portal, e confirmar por Browser Acceptance zero callbacks/escritas na prévia.

## Validação concluída

- Browser Acceptance em Chromium, viewports `390×844` e `320×740`; visão geral, execução, descanso, exercício concluído, resumo e encerramento antecipado; pausa/retomada, ajuste e pulo do descanso, retorno, edição, próximo exercício, conclusão e nova sessão; overflow horizontal `0`; escritas da prévia `0`; console sem erros do harness.
- Testes focados de sessão/prévia/contratos/rating: `22/22`.
- Suíte completa: `494/494`; `pnpm test:subscription`: `50/50`; `pnpm typecheck` e `pnpm lint`: passaram.
- `pnpm build`: passou com fixture pública fictícia temporária. Vite emitiu somente o aviso não fatal de chunk JavaScript maior que 600 kB.
- Capturas das cinco telas e estado de encerramento foram revisadas em `/home/ubuntu/coachfit-build33/qa-evidence`; a fixture e o harness QA foram removidos e as capturas ficam fora do ZIP-fonte.
- Não foram executados `cap sync`, archive/Xcode, workflow GitHub, publicação ou upload para TestFlight.

## Entrega

A mídia continua sendo carregada apenas de `image_url`/`video_url` existentes; sem asset, mantém-se a ficha/técnica atual. O ZIP é pacote-fonte, sem `.env.production`, dependências, `dist` pré-compilado ou harness temporário. O workflow recompila os assets usando a configuração pública já configurada no GitHub; operação padrão permanece `verify`. Não publicar nem enviar para TestFlight sem autorização explícita.