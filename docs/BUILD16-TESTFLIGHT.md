# Coach Fit Pro — iOS 1.0 (16)

Branch: `work/build16-demo-20261103`
Base: `work/build15-subscription-copy-clean-20261103` (750a8d0).

## Mudancas funcionais
- Portal do paciente: `inviteCode` passado para `StudentMobileApp` e chat, corrigindo referencia indefinida.
- Mensagens: layout de uma coluna no mobile e quebra de erros longos.
- Versao de build iOS incrementada de 15 para 16, marketing 1.0.
- Cache e marcador de versao atualizados para build 16.
- StoreKit, regras de elegibilidade da Apple e painel de assinatura mantidos da build 15.

## Dados de demonstracao
O arquivo `scripts/qa-seed-nutritionist-patient-demo.sql` e um seed **opcional** que precisa de contas Auth confirmadas, previamente criadas no Supabase. Nao foi executado ao criar esta branch. Ele grava dados em banco e concede acesso de QA temporario (30 dias), nao representa uma compra Apple. Nao execute em producao sem revisar os efeitos e a politica de contas de revisao.

## Validacao e publicacao
- Execute o workflow `Coach Fit Pro - iOS TestFlight (manual)` nesta branch com operation `verify`, version `1.0`, build_number `16`.
- So depois de verify passar, execute o mesmo workflow com operation `testflight`.
- Teste em iPhone real o login de profissional, paciente, dieta, chat, denuncia/bloqueio, exclusao da conta e assinatura, incluindo Restaurar compras e a oferta introduzida somente quando elegivel.
- Nao execute workflows da `main` para esta build.
- O pacote ZIP recebido inclui arquivos de build gerados; o workflow compila novamente e sincroniza o projeto iOS.

Status de deploy: nao enviado ao TestFlight por este commit. O upload exige o workflow manual e credenciais Apple configuradas.
