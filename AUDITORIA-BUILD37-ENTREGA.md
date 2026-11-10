# Auditoria de entrega — Coach Fit Pro BUILD37

Data: 10/11/2026  
Base: BUILD36, copiada para uma pasta de trabalho isolada. A fonte e o ZIP das builds anteriores foram preservados.

## Ajustes entregues

| Área | Alteração |
|---|---|
| Ações de série | Removida a barra inferior suspensa “Registrar série e descansar” / “Encerrar sessão”. O botão “Concluir série” voltou ao card da série e mantém o handler existente de gravação e avanço para descanso. |
| Encerramento antecipado | Mantido o fluxo e a confirmação atuais, com apenas “Encerrar treino” em estilo discreto no cabeçalho da execução, descanso e exercício concluído. |
| Lembrete | Removido somente o card “Lembrete de treino” da tela do aluno; o componente compartilhado e outras notificações não foram alterados. |
| Tema | Restaurado o controle claro/escuro no cabeçalho mobile, ao lado do chat. Estrelas selecionadas agora usam dourado/amarelo com contraste tanto no dark quanto no light. |
| Dia do treino | Retirado o ícone de calendário do cabeçalho interno. O dia/foco atuais aparecem logo abaixo dele, num acordeão recolhível que lista os dias realmente existentes no plano. Não se inventam datas de calendário quando o plano contém apenas nomes de dias. |
| Descanso | “Pular descanso” foi movido para logo abaixo do cronômetro; pausa, retomada e ajustes de tempo continuam disponíveis. |
| Exercício | Nome, instrução e consulta à execução/vídeo foram agrupados num painel; o tema claro ganhou superfícies quase brancas, texto legível e largura fluida. O cabeçalho final usa coluna automática para caber em telas estreitas. |
| BUILD37 | Marcador do app, versão pública, cache, número nativo e default de build do workflow foram alinhados à BUILD37; a operação default continua `verify`. |

## Arquivos alterados nesta etapa

- `src/App.jsx`: estrutura das telas e controles descritos acima.
- `src/student-workout-polish-build37.css`: ajustes responsivos e visuais escopados à experiência de treino.
- `src/main.jsx`: importação do CSS BUILD37.
- `scripts/student-workout-preview-flow.test.mjs`, `scripts/workouts-regression.test.mjs`, `scripts/theme-smoke.mjs` e `scripts/ios-intro-offer-regression.test.mjs`: regressões atualizadas ao comportamento e marcador BUILD37.
- `public/version.txt`, `public/service-worker.js`, `ios/App/App.xcodeproj/project.pbxproj` e `.github/workflows/coachfit-ios-testflight.yml`: alinhamento de build/cache.
- `REDESIGN-BUILD37.md`: decisões Preserve e limites de escopo.

## Dados e áreas protegidas

O diff BUILD36→BUILD37 foi auditado. Nesta etapa, `src/supabaseApi.js`, `src/workoutSession.js`, StoreKit/assinaturas, preços, migrations, banco, notificações e backend não tiveram alterações. Permanecem incluídos no pacote os ajustes funcionais/migrations herdados da BUILD36 (incluindo a correção SQL 42P01 e o feedback de avaliação); não foram aplicados ao Supabase do usuário.

Os fluxos reais continuam usando os handlers existentes. A prévia do treinador permanece local e sem gravação. A animação de XP herdada da BUILD35 continua baseada apenas em XP real, positivo e já persistido; esta etapa não cria nova concessão de recompensa.

## Verificações executadas

| Verificação | Resultado |
|---|---:|
| `pnpm test` | 498/498 aprovados, 0 falhas |
| `pnpm test:subscription` | 50/50 aprovados |
| `pnpm lint` / smoke de tema e alinhamento canônico | aprovados, 6/6 verificações canônicas |
| `pnpm typecheck` | aprovado |
| `pnpm build` | concluído; Vite transformou 950 módulos |
| Higiene de build | `.env.production` fictício temporário e `dist/` removidos |
| Auditoria do diff | nenhum arquivo protegido listado como alterado |

O build ainda exibe o aviso de bundle JavaScript maior que 600 kB já presente no projeto. A divisão de chunks ficou fora do escopo desta atualização e não impediu o build.

## Não executado

Não houve teste em iPhone físico/TestFlight, `cap sync`, archive Xcode, execução do workflow, push GitHub, publicação/deploy ou alteração no Supabase. O ZIP é fonte para revisão e para o fluxo de build autorizado pelo usuário.