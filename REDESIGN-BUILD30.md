# BUILD30 — Treinos organizado e experiência do aluno

## Base e aprovação

Fonte: CoachFitPro_BUILD29_CORRIGIDA_SOURCE.zip, SHA-256 `85b36988872bae38d9472a62b02430915e22a8ae6a4c5ef1020a7db1d8e090d9`. ZIP original preservado. Modo Redesign · Preserve. Usuário aprovou proposta e v0 visual e pediu avaliação final apenas com estrelas, sem números visíveis, e mais interatividade/gamificação.

## Direção aprovada

No treinador, separar Planos, Rascunhos, Exercícios, Alunos e Evolução. Abrir plano substitui lista por detalhe. Ferramentas expressa/clássica ficam sob demanda, sem repetição abaixo de todas as abas. No aluno, priorizar exercício e série atual, concluídas compactas revisáveis e descanso integrado; preservar cardio, orientação e mídia vinculada. Prévia e sessão real compartilham a mesma superfície visual; controles de simulação externos no desktop e apresentação ampla no celular.

## Design Read

Variação 4, movimento 3 (feedback breve), densidade aluno 5/treinador 7, dependência de assets 2, fidelidade 10. Fonte e tokens de brand-spec.md mantidos. Gamificação é resposta a ações reais: progresso teal, estado concluído, celebração breve e seleção de estrelas. Sem inventar XP, streaks, rankings, recompensas ou indicadores clínicos. Não há alegação de indução de dopamina. Reduced motion deve desligar animações sem perder feedback.

## Contratos protegidos

Callbacks/props públicos, analytics/source, localStorage, metadata schemaVersion 2, idempotência/RPC, setLogs/cardioLogs/completionToken, timer, sincronização, conclusão versus encerramento, rating e notificações preservados. Avaliação visual sem números; valores 1–5 internos e nomes acessíveis mantidos. StoreKit/preços, financeiro, mensagens, dietas e backend fora do escopo. Não publicar, executar workflow ou enviar TestFlight nesta tarefa.

## Estado

Integração concluída em cópia isolada. `pnpm test` passou 490/490; regressões de Treinos/prévias 84/84; `pnpm test:subscription` 50/50; typecheck, lint (6 verificações) e build web passaram. Fixture e `dist` foram removidos. Ver `AUDITORIA-BUILD30-ENTREGA.md` e `README-BUILD30.md`.

Versão comercial 1.0; build iOS 30. O workflow segue `verify` por padrão e não foi executado; não houve Xcode archive nem envio ao TestFlight. Confirmar disponibilidade do build 30 no App Store Connect antes de selecionar manualmente `testflight`.
