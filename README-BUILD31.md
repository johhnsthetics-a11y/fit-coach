# Coach Fit Pro — BUILD31

Fonte derivada da BUILD30 entregue pelo SHA-256 `bec0b9403e9204bec650979b7b7aadf54eb2c8f9ebcd200e058b7323b4cfbfb6`. A pasta BUILD30 e seu ZIP permanecem intactos.

## Ajuste visual

A navegação de Treinos agora ocupa a largura disponível em desktops, sem o limite herdado de 420 px. As cinco áreas ficam lado a lado quando o painel comporta; em largura média passam a uma grade de três colunas; no celular preservam navegação horizontal rolável. Os títulos e rótulos receberam escala fluida, maior presença e respiro. A família tipográfica é herdada do app; nenhuma fonte, cor rogue ou asset foi introduzido.

O código de interação e os rótulos Planos, Rascunhos, Exercícios, Alunos e Evolução foram preservados. Não houve mudança nos fluxos, dados, permissões, analytics, contratos de backend, sessão do aluno, StoreKit, assinatura ou preços.

## Verificações

`pnpm test`: **491/491**; `pnpm test:subscription`: **50/50**; `pnpm typecheck`: passou; `pnpm lint`: 6/6; `pnpm build`: concluído. A compilação web ainda sinaliza chunk JavaScript principal maior que 600 KB (aprox. 1,24 MB minificado); não foi alterada a estratégia de divisão do bundle nesta mudança visual. Fixtures `.env.production` e `dist` foram removidos antes de empacotar.

Não foram feitos browser acceptance, cap sync, archive/Xcode, workflow GitHub, upload TestFlight ou publicação.

## Run workflow

O workflow conserva `operation: verify` como default e passa a sugerir build iOS **31**, versão comercial **1.0**. Para solicitar upload, selecione `testflight` explicitamente e confirme antes no App Store Connect que o build 31 está disponível/inédito. O workflow não foi executado.