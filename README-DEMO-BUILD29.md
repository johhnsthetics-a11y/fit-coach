# Coach Fit Pro — BUILD29

Este ZIP contém o **pacote-fonte atualizado**, pronto para a próxima etapa de revisão e envio pelo workflow existente. Foi construído sobre o anexo BUILD28 enviado pelo usuário e inclui duas frentes: o redesign de Treinos para o treinador aprovado anteriormente e uma melhoria explícita da sessão de execução real do treino pelo aluno.

## O que foi atualizado

Na área Treinos do treinador, a BUILD29 incorpora seletivamente o workspace aprovado da BUILD26 sobre as melhorias mais recentes da BUILD28. Planos, Biblioteca e Alunos usam uma navegação unificada; a retomada de rascunho é uma escolha explícita; salvar, personalizar/usar como base e publicar/atribuir têm intenções separadas; a biblioteca diferencia filtros/origem; e a área Alunos torna os planos múltiplos mais acessíveis. O documento [`REDESIGN-BUILD29.md`](REDESIGN-BUILD29.md) registra escopo, fronteiras e contratos preservados.

Na experiência do aluno, o ajuste está no `StudentWorkoutExecution` que a tela real `StudentMobileApp` já usa com callbacks de persistência, sincronização, conclusão e notificação — não somente na prévia do treinador. Ao registrar cada série, agora há estado textual, progresso acessível do exercício, confirmação contextual e descanso visível. A ação do mobile acompanha a série atual; ao focar um campo de carga/repetições, a barra fixa cede lugar ao controle inline. A conclusão desfoca o campo sem abrir o teclado para a série seguinte.

## Validação realizada

| Verificação | Resultado |
|---|---:|
| `pnpm typecheck` | passou |
| `pnpm lint` | passou; 6 verificações canônicas |
| `pnpm test` | 486/486 passaram |
| `pnpm test:subscription` | 50/50 passaram |
| `pnpm build` | passou; Vite transformou 943 módulos |

O build web mantém um aviso não bloqueante de chunk principal acima de 600 kB. Os testes/build usaram uma fixture pública fictícia temporária; `.env.production` e `dist` foram removidos antes do empacotamento.

A regressão nova de execução renderiza a sessão com `preview=false` e estado real restaurado: uma série concluída de três, série seguinte atual, progresso 1/3 e CTA contextual. Ela também verifica que concluir a série não força o foco no campo da seguinte. Isso confirma a integração no código compartilhado da sessão real, mas **não substitui a validação visual no TestFlight**.

## Próximo passo — workflow iOS

O projeto mantém a versão de marketing `1.0`, avança o build para `29` e deixa o número `29` como default do input do workflow. O default da operação permanece `verify` por segurança: essa opção compila/verifica, mas não envia ao TestFlight.

Depois de colocar este fonte no branch pretendido do repositório, abra **Actions → Coach Fit Pro - iOS TestFlight (manual) → Run workflow**. Para solicitar o envio, selecione explicitamente `operation: testflight`, `version: 1.0` e `build_number: 29`. Antes, confirme no App Store Connect que build 29 ainda não foi usado para a versão 1.0. A operação `testflight` requer os secrets de assinatura/distribuição Apple, App Store Connect e a configuração pública do Supabase definidos no próprio workflow; eles não estão nem devem ser colocados neste ZIP.

Se quiser apenas validar o runner antes do envio, use `operation: verify`. Nenhum workflow foi executado nesta tarefa, e o arquivo aqui entregue não é um IPA assinado nem uma build já publicada.

## Limites e preservação

O ZIP BUILD28 original permaneceu intacto (SHA-256: `a56759d2a0e0461628d49004a090690916c0a765aac7a2b3b4e0dab5a054e578`). StoreKit, preços, cobrança, schema/RPC/Edge Functions, sessões do aluno, rating, APNs e demais páginas ficam fora do redesign; os contratos de persistência existentes foram mantidos. Não foram executados `cap sync`, `xcodebuild archive`, GitHub push, TestFlight ou QA visual em dispositivo físico.
