# BUILD28 — Integração da prévia do treino

A BUILD28 parte da BUILD27 e incorpora a jornada de prévia da BUILD25 ao app atual.

## Incluído

- Jornada de quatro etapas (visão geral, plano, execução e resumo) nas três entradas do treinador.
- Executor do aluno em modo de simulação, sem salvar sessão, XP ou avaliação.
- Indicadores reais vazios no resumo demonstrativo e totais planejados identificados separadamente.
- Rating somente visual e desativado na prévia.
- Estilos responsivos para temas claro e escuro.
- Notificações, chat e melhorias de cadastro/exclusão de alunos preservados da BUILD27.
- Marcadores de cache atualizados; build iOS 28, versão de marketing 1.0.

## Run workflow

Use `workflow_dispatch`, versão `1.0`, build `28` e operação `verify`. Confirme no App Store Connect que o número 28 ainda está livre para a versão 1.0. A operação `verify` compila e verifica o projeto no runner macOS sem enviar ao TestFlight.

Este branch não altera StoreKit, preços, cobrança, banco de dados ou Edge Functions. O deploy web é um passo separado via Cloudflare Wrangler.
