# Coach Fit Pro — iOS 1.0 (21)

Branch: `work/build21-minha-assinatura-final-20261104`.

## Fonte de referência

Esta branch contém os arquivos-fonte da Build 21 integrados diretamente no GitHub, incluindo o layout de **Minha assinatura**, a tipografia e CSS correspondentes, as validações StoreKit de preço estruturado/moeda, as proteções de vínculo da conta e os testes atualizados.

A base foi a Build 18 já existente no GitHub; os arquivos novos e modificados foram reproduzidos a partir do ZIP `CoachFitPro_BUILD21_MINHA_ASSINATURA_FINAL.zip`, preservando os módulos que não mudaram. As alterações da Build 19/20 incluídas no ZIP 21 estão refletidas nos arquivos atualizados, sem sobrescrever o restante do projeto. O projeto iOS mantém a versão de marketing 1.0 e o número de build 21.

**Não é necessário enviar um patch ou outro ZIP ao GitHub.** As alterações estão presentes diretamente na árvore de arquivos. Não use arquivos de versões anteriores ou protótipos como base para futuras alterações.

## TestFlight
No GitHub Actions, execute `Coach Fit Pro - iOS TestFlight (manual)`, selecionando:
- Branch: `work/build21-minha-assinatura-final-20261104`
- Operation: `verify`
- Version: `1.0`
- Build number: `21`

Quando verify passar, execute novamente com `operation=testflight`, mantendo a mesma branch, versão e build.

O workflow preserva a configuração pública `.env.production` válida da Build 18, compatível com o fallback de variáveis VITE do Supabase, evitando o erro de segredos vazios ocorrido na Build 18. Nunca use `service_role` ou `sb_secret_` em Vite. `pnpm exec cap sync ios` reconstroi os caminhos do pacote Swift da sessão atual: o caminho temporário `CoachFitPro_BUILD19/node_modules` do ZIP original não foi adotado.

## Validação
- 47 testes de assinatura e StoreKit aprovados em execução independente no ZIP enviado e no patch local sobre a Build 18.
- A auditoria que acompanha o envio relata 461 testes gerais aprovados, lint/typecheck/build e sync iOS.
- A compilação nativa com Xcode, assinatura iOS, folha de compra real e envio App Store Connect ainda dependem do workflow.
- Nenhum SQL/migração do Supabase, contas de demonstração ou deploy web foram alterados.

No TestFlight, compare o resumo com a folha Apple; confira conta elegível/inelegível à oferta, valores reais em BRL, restaurar compras e login correto. Cancele se houver divergência de valores.
