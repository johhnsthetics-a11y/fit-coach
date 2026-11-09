# BUILD33 — critérios de entrega

- [x] Adaptar a experiência real do aluno ao tema escuro Coach Fit Pro e manter o tema claro funcional.
- [x] Unificar visão geral, execução, descanso, exercício concluído e resumo no mesmo `StudentWorkoutExecution`.
- [x] Preservar registros/edição de séries, cargas/repetições, timer, pausa/retomada, avançar/voltar, encerramento antecipado, conclusão, histórico, XP e avaliação.
- [x] Remover dados demonstrativos falsos da revisão; a prévia permanece local e sem gravações/callbacks reais; tempo indisponível não é mostrado como `00:00`.
- [x] Browser Acceptance em Chromium: 390×844 e 320×740, cinco etapas, encerramento antecipado, pause/resume, ajuste/pulo de descanso, edição de registro, conclusão/nova sessão; overflow horizontal 0 e preview writes 0.
- [x] Suíte completa: 494/494; testes focados do fluxo do aluno: 22/22; assinatura/StoreKit: 50/50.
- [x] `pnpm typecheck`, `pnpm lint` e `pnpm build` passaram; fixture fictícia e `dist` foram removidos após o build.
- [x] ZIP-fonte BUILD33 criado com CRC/SHA-256 conferidos, sem fixture, `dist`, dependências, caches ou harness QA temporário.
- [x] Arquivos protegidos de StoreKit, Supabase e sessão confirmados inalterados; apenas marcadores técnicos de versão/cache fora do executor.
- [x] Nenhum `cap sync`, Xcode archive, workflow GitHub, publicação ou upload TestFlight foi executado.