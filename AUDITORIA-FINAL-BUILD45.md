# Auditoria final de design e UX — Coach Fit Pro BUILD45

**Data:** 13 de novembro de 2026  
**Modo:** Redesign · Preserve  
**Resultado:** fluxos críticos testados passaram; fonte preparada para handoff técnico. Este parecer não equivale a publicação nem a aprovação da Apple.

## Parecer executivo

A BUILD45 aplica melhorias pontuais de clareza, responsividade e acessibilidade sem introduzir uma identidade visual paralela. Preserva o branding preto/menta, a tipografia Plus Jakarta Sans, os dados existentes e os contratos de negócio. Os pontos funcionais pedidos — retirar o default de 10 repetições, sugerir o dia de treino apenas quando há correspondência explícita e inequívoca, e ampliar a biblioteca sem duplicatas canônicas — têm implementação e regressões dedicadas.

A auditoria inicial de 12 áreas registrou média estática **7,32/10 antes das correções**. Esse valor não é uma nota final, um resultado de QA nem uma certificação; não foi calculada nova nota geral. Os testes cobrem os fluxos descritos abaixo, mas não demonstram que todas as telas foram exercitadas em dispositivo físico, leitor de tela ou backend real.

## As 12 áreas revisadas

1. **Início profissional e navegação global:** menus mobile, estados ativos, foco e coerência de navegação.
2. **Alunos, pacientes e perfis profissionais:** separação de contexto e ausência de dados de outro aluno nos testes de fixture.
3. **Treinos profissionais:** navegação entre planos, rascunhos, exercícios e alunos; prévia responsiva do aluno.
4. **Biblioteca do treinador:** ampliação local, nomes comuns, normalização/deduplicação e tratamento de aliases ambíguos.
5. **Nutrição profissional e dietas:** restauração de plano, vários planos ativos e escolha do plano no portal do aluno.
6. **Mensagens e notificações:** layout do chat, áudio, estados, foco e overflow em telas estreitas.
7. **Assinaturas, planos e financeiro:** contratos protegidos; verificações de regressão, sem redesign comercial nesta BUILD.
8. **Equipe, convites e consentimentos:** escopos e testes de colaboração preservados; nenhuma migration ou política remota alterada.
9. **Portal do aluno — início, menu e navegação:** sidebar e menu responsivos, temas e estados de navegação.
10. **Execução do treino pelo aluno:** overview, série, descanso, exercício concluído, resumo, avaliação, feedback e XP.
11. **Dieta, refeições, hidratação e bem-estar:** múltiplos planos ativos, diário de refeição e contraste/semântica dos controles.
12. **Agenda, avaliações, check-ins, importação, configurações e ferramentas restantes:** inspeção de código e regressões existentes; não se declara browser QA individual de cada superfície desta área.

A lista acima retoma as 12 áreas da auditoria-base. A cobertura dinâmica é desigual: as áreas explicitamente listadas em “QA browser” foram exercitadas com Playwright; as demais foram avaliadas por código, testes automatizados e comparação de contratos, não por uma sessão manual completa de cada tela.

## Correções e decisões verificadas

### Treino do dia e repetições

- `src/workoutDaySelection.js` só retorna um índice quando o rótulo do dia contém explicitamente o dia da semana local e existe **uma única** correspondência. Rótulos genéricos como “Dia 1”, dias duplicados ou dados inválidos mantêm escolha manual.
- A sugestão não inicia uma sessão nem grava seleção/progresso por si só. Estado salvo, sessão restaurada e progresso explícito têm precedência; a ação do aluno continua necessária para iniciar/abrir o treino.
- Um exercício novo não recebe `10` como valor pré-preenchido de repetições. A meta prescrita e as repetições efetivamente realizadas são apresentadas separadamente; a entrada realizada começa vazia.
- A regressão verifica correspondência de hoje, fallback manual, ausência de persistência automática, campo de repetições vazio e diferença entre meta e realizado.

### Biblioteca de exercícios

- A biblioteca local foi ampliada com movimentos de uso comum e a busca trata normalização de nomes e aliases sem fundir exercícios biomecanicamente distintos.
- A regressão confirma que o catálogo local continua disponível quando a API retorna lista vazia e verifica ausência de duplicatas canônicas entre os itens BUILD45 adicionados.

### Design, temas e acessibilidade

- Foi mantida a identidade existente — preto/menta, Plus Jakarta Sans, ícones do produto e temas claro/escuro. A família Inter isolada da área Dieta foi removida para preservar consistência tipográfica.
- Menus mobile receberam estado acessível; diálogos cobertos receberam Escape, contenção/restauração de foco; o seletor semanal da dieta usa botão nativo; áudio ganhou contraste e foco visível.
- As transições existentes permanecem sutis e orientadas à tarefa. Regras `prefers-reduced-motion` já presentes desativam movimento nas superfícies cobertas, incluindo a celebração de XP; foi adicionada uma regressão explícita para proteger essa regra. O contador de XP também evita a contagem animada quando a preferência está ativa.
- Os testes não substituem avaliação manual com VoiceOver, TalkBack, teclado ou medidor de contraste em dispositivo real.

### Dieta, treinos e confiabilidade de estado

- Corrigido o callback que ignorava o booleano de restauração de dieta e podia arquivar novamente o plano restaurado.
- O portal do aluno ganhou seletor responsivo e acessível quando há vários planos alimentares ativos; antes, a contagem podia considerar mais de um enquanto a interface mostrava apenas o primeiro.
- Fluxo de treino do aluno preserva séries, cargas, repetições, descanso, pausa/retomada, avanço, encerramento antecipado, histórico, avaliação, feedback e XP. O acesso pós-conclusão “Ver detalhes da sessão” leva à área real “Progresso”. A prévia permanece demonstrativa e não grava dados na conta.
- As suítes browser foram alinhadas ao markup real do app (incluindo descanso em tela integral, modal XP e sidebar desktop), em vez de depender de seletores de versões anteriores.

## QA browser executado

Execução local com Playwright/Chromium e fixtures de teste; nenhum usuário real ou backend Supabase foi usado.

- `scripts/workouts-browser.mjs`: **6 verificações aprovadas** — fluxo Treinos em 1440 e 390 px, com menu, URL direta e refresh; navegação de retorno e console passaram.
- `scripts/student-workout-diet-browser.mjs`: aprovado em 390 e 1440 px — treino, avaliação de 1–5 estrelas, celebração XP, detalhes da sessão e diário de foto da refeição.
- `scripts/product-browser.mjs`: **27 verificações**, sem problemas, em 320 px; **58 verificações**, sem problemas, em 390 e 1440 px.
- `scripts/nutrition-browser.mjs`: aprovado em 320, 390 e 1440 px, incluindo planos ativos, arquivar/restaurar e navegação de dieta.
- `scripts/chat-browser.mjs`: aprovado para profissional e aluno em 300, 320, 360, 375, 390, 414, 768 e 1440 px; verificou mensagens longas, envio/rascunho, mídia/áudio, estados, tema e overflow.
- `scripts/student-sidebar-browser.mjs`: sidebar premium aprovada em 390 e 1440 px, com temas, estado ativo, rótulos e layout responsivo.

Esses resultados são “visual/browser acceptance” com dados sintéticos, não comparação com baseline visual formal nem QA em iPhone/iPad físico.

## Regressões, colaboração e build

- `pnpm test`: **517 passaram, 0 falharam**.
- `pnpm test:database`: passou com PGlite local; sem conexão ou alteração remota.
- `pnpm lint`: passou, 6 verificações.
- `pnpm typecheck`: passou.
- `pnpm test:professional-collaboration`: passou — memberships em múltiplas equipes, consentimento por paciente, escopo de nutrição/treino e saída independente.
- `pnpm test:subscription`: **50 passaram, 0 falharam**.
- `pnpm test:ios-privacy`: **2 passaram, 0 falharam**.
- `pnpm build`: Vite concluiu com sucesso. Permanece um aviso de chunk principal acima de 600 kB (aprox. 1,36 MB minificado/365 kB gzip); code-splitting é oportunidade de otimização futura, não bloqueio desta entrega.

Para a checagem de configuração/build foi usado arquivo temporário com URL de projeto esperada e chave pública fictícia no formato de teste. Nenhum segredo de serviço ou dado de usuário foi usado. O arquivo temporário e `dist` foram removidos; `.env.example` foi preservado.

## Contratos protegidos e marcador BUILD45

- Comparação byte a byte verificou **47 caminhos protegidos** de StoreKit, preços, checkout, entitlements, cobrança e equipes; todos são idênticos à BUILD44.
- `.github/workflows/coachfit-ios-testflight.yml` e `ios/App/App.xcodeproj/project.pbxproj` diferem apenas pelo número BUILD44→BUILD45; `CURRENT_PROJECT_VERSION` está em 45 e `MARKETING_VERSION` continua `1.0`.
- Marcadores em `src/App.jsx`, `public/version.txt`, cache do service worker e regressão de workflow estão sincronizados com BUILD45.
- Não foram aplicadas migrations remotas; não houve deploy de Edge Function, deploy web, push/workflow GitHub, `cap sync`, archive Xcode, TestFlight ou ação no App Store Connect.

## Limites e pendências

- Não houve teste físico em iPhone/iPad, VoiceOver/TalkBack, rede real, Supabase/RLS, APNs, StoreKit ou compra real. As fixtures não provam autorização ou sincronização de backend.
- A BUILD45 está pronta para o handoff do **código-fonte e QA local**; não declarar como “10/10 certificada”, pronta para publicação ou aprovada pela Apple sem as verificações externas correspondentes.
- Permanecem independentes as ações manuais exigidas pela Apple para IAPs pendentes (captura de revisão/metadados no App Store Connect) e teste físico do fluxo de câmera no iPad. Esta entrega não as executa.
