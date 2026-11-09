# Coach Fit Pro — BUILD33 (fonte)

Atualização limitada à experiência de treino do aluno, alinhada às cinco telas Figma no tema escuro e preservando o tema claro existente. A prévia do treinador reutiliza o mesmo executor em modo local, sem gravar sessão ou avaliação.

## O que mudou

- Visão geral do treino com contagens/progresso segmentado e sequência real de exercícios.
- Execução, descanso, exercício concluído e resumo organizados em etapas coerentes, com edição de carga/repetições, timer, pausa/retomada, salto e retorno.
- Títulos de plano/dia iguais são exibidos uma única vez; métricas sem dado (como duração sem timer na prévia) aparecem como indisponíveis, não como números inventados.
- Tema dark usa `#0B1516`, superfícies `#111E20` e teal `#4EE9D0`; tema claro mantém o acento `#087F72` com contraste.
- Avaliação mostra somente estrelas; escala e nomes acessíveis e gravação real permanecem preservados.

## Build

- Identificador interno/public/cache: `coach-fit-pro-workout-experience-build33-20261109`.
- Número iOS: `33`; versão comercial permanece `1.0`.
- Workflow iOS continua com `verify` como operação padrão e build number `33`. Nenhum workflow, archive ou upload para TestFlight foi executado.
- O ZIP é fonte limpa: exclui `node_modules`, `.env*`, `dist` compilado, caches e harnesses/capturas temporários. O workflow deve compilar com os secrets públicos reais do projeto; a fixture fictícia usada localmente foi removida.

## Validações executadas

- Browser Acceptance em Chromium: `390×844` e `320×740`; seis estados (incluindo encerramento antecipado) e fluxos de pausa/retomada, ajuste/pulo de descanso, voltar, editar registro, avançar, concluir e iniciar outra sessão. Overflow horizontal: `0`; escritas da prévia: `0`.
- Testes focados do aluno: `22/22`; suíte completa `pnpm test`: `494/494`; `pnpm test:subscription`: `50/50`.
- `pnpm typecheck`: passou; `pnpm lint`: passou (theme smoke e 6 verificações de alinhamento); `pnpm build`: passou.
- O Vite emitiu aviso não fatal sobre um chunk JavaScript acima de 600 kB. Xcode archive, `cap sync`, GitHub workflow, publicação e TestFlight não foram executados.