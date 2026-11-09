# Auditoria de entrega — BUILD36

## Resultado

Cópia de fonte isolada da BUILD35 com correções concentradas na experiência de treino do aluno. A BUILD35 e o ZIP anterior permaneceram intocados. O marcador web/cache e o número de build iOS foram alinhados à BUILD36; a operação padrão do workflow continua `verify`.

## Ajustes implementados

| Arquivo/área | Alteração |
|---|---|
| `src/App.jsx` | Redução de cabeçalhos repetidos somente na aba Treino; lembrete mantido abaixo do fluxo principal; “Iniciar/Continuar treino” movido para perto do resumo/progresso; remoção visual da ação duplicada dentro do card; encerramento antecipado mantido como ação secundária; rolagem centralizada para a próxima série depois de concluir ou pular o descanso; feedback enviado junto ao rating e exposto no histórico; toggle do aluno passa a indicar a próxima aparência com sol/lua. |
| `src/student-workout-polish-build36.css` | Superfície branca para o tema claro do treino, alvos e conteúdo contidos em telas estreitas, barra de ação centralizada acima da navegação inferior, encerramento sutil, estrelas com preenchimento legível e transição do tema respeitando movimento reduzido. |
| `src/WorkoutCompletionRating.jsx`, `src/student-workout-polish-build36.css`, `src/main.jsx` | Ícone vetorial de estrela, campo opcional de feedback após as estrelas (até 500 caracteres), estado de salvamento e confirmação; o modo de prévia mantém os controles desabilitados e não envia estrelas ou feedback. A folha antiga `workoutCompletionRating.css` permaneceu intacta. |
| `src/supabaseApi.js` e migrations novas | Inclusão do feedback textual na mesma transação do rating, mantendo a RPC antiga disponível a versões anteriores. Migration de reparo corrige a referência PL/pgSQL ao nome público antigo na rotina interna de encerramento. |
| `scripts/*` | Regressões para rating/previsão, limite do feedback, erro `42P01`, foco pós-descanso, alinhamento das versões e identidade do tema. |
| `public/version.txt`, `public/service-worker.js`, Xcode project e workflow | Marcador BUILD36, cache e `CURRENT_PROJECT_VERSION`/default do workflow alinhados para 36; versão comercial permanece 1.0 e `verify` continua o padrão. |
| `REDESIGN-BUILD36.md` | Registro da direção Preserve, melhorias e contratos protegidos. |

## Dados e segurança

O XP continua derivado exclusivamente dos registros de treino concluído persistidos, com o mesmo cálculo/deduplicação anterior. Esta build não cria nova concessão de XP: a celebração BUILD35 permanece posterior à confirmação do rating e só aparece quando o `xpAwarded` real é positivo. Treinos encerrados antecipadamente continuam sem avaliação de conclusão ou XP de conclusão.

A avaliação mantém a validação existente de convite, acesso financeiro e log realmente concluído. A nova RPC `rate_student_workout_log_with_feedback` delega primeiro à `rate_student_workout_log`, grava até 500 caracteres no mesmo `workout_log` e retorna o registro confirmado. A RPC antiga permanece disponível e o campo novo tem valor padrão vazio.

A migration `20261109173600_fix_early_end_session_parameter_scope.sql` altera apenas a definição da função interna `end_student_workout_session_unchecked`, corrigindo o qualificador de `completion_token`. Ela não substitui o wrapper público que faz a verificação financeira.

As migrations não foram aplicadas a um projeto Supabase real. Para o reparo do erro e a gravação do feedback passarem a valer no backend publicado, execute as duas migrations incluídas no ZIP, nesta ordem: `20261109173600_fix_early_end_session_parameter_scope.sql` e `20261109173700_student_workout_rating_feedback.sql`.

## Verificações executadas

| Verificação | Resultado |
|---|---:|
| Regressões direcionadas de rating, preview, treino e PGlite | 107/107 aprovadas |
| Suíte integral `pnpm test` | 498/498 aprovadas |
| `pnpm typecheck` | Aprovado |
| `pnpm lint` (theme smoke + alinhamento canônico) | Aprovado; 6/6 testes canônicos |
| `pnpm test:subscription` | 50/50 aprovadas |
| `pnpm build` (Vite) | Aprovado; 949 módulos transformados |

O build Vite manteve o aviso de chunk JavaScript principal acima de 600 kB após minificação; não impediu a compilação e não foi ampliado o escopo para code-splitting nesta correção.

## Não executado

Não houve browser acceptance em dispositivo físico, `cap sync`, Xcode archive, execução do workflow, push GitHub, deploy, TestFlight, cobrança nem operação remota no Supabase. A validação do `42P01` foi feita em banco PGlite efêmero: o teste reproduziu o erro antes da migration e confirmou o sucesso depois dela.

A fixture temporária de `.env.production` usou somente uma chave publicável fictícia e foi removida. O ZIP final não deve conter `.env*`, `dist`, `node_modules`, caches ou `qa`.
