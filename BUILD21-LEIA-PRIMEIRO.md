# Coach Fit Pro — Build 21 (iOS 1.0)

A branch foi criada sobre `work/build18-storekit-price-parity-20261103`, preservando configurações de Supabase da compilação anterior.

## Integração da atualização

Antes de executar a pipeline, faça upload do arquivo **`build21.patch`** para a raiz desta branch via GitHub > Add file > Upload files.

SHA-256 obrigatório:
`c7f92ac9f0e2a6d458c67f05f44f150e30ed1dfceffae2c778b2378facd80ca8`.

O workflow aplica esse patch somente em sua máquina de compilação após validar o hash, antes de rodar os testes e construir o iOS. Sem ele, a compilação para explicitamente e não envia uma versão antiga. O patch cobre as mudanças no StoreKit, interface nativa Minha assinatura, CSS, testes, cache e número iOS 21.

O projeto original Build 18 permanece visível nesta branch até o patch ser integrado em um commit de código-fonte. **Para desenvolver uma próxima build, não use esta branch sem integrar o patch nos arquivos-fonte primeiro.** O patch não é aplicado ao repositório de forma permanente pelo workflow de TestFlight.

## Como publicar

Em Actions > `Coach Fit Pro - iOS TestFlight (manual)`:
1. Branch: `work/build21-minha-assinatura-final-20261104`.
2. Operation: `verify`; Version: `1.0`; Build number: `21`.
3. Após aprovação, execute novamente com Operation: `testflight`, mesma branch/versão/build.

`pnpm exec cap sync ios` reconstruirá o vínculo SPM com o pacote `@coachfit/storekit` instalado no runner. Não use o caminho absoluto/temporário `CoachFitPro_BUILD19/node_modules` contido no ZIP original. A branch preserva a configuração pública `.env.production` verificada da Build 18; o workflow também aceita os secrets VITE do GitHub.

No TestFlight, validar uma conta elegível e uma inelegível à oferta, preço em BRL quando a conta Apple realmente tiver storefront Brasil, restauração, vínculo da assinatura ao login, chat e preview de dieta.

## Limites
- A auditoria recebida relata 461 testes gerais e 47 de assinatura aprovados.
- Os 47 testes de assinatura passaram independentemente na cópia do patch aplicada sobre a Build 18.
- Xcode, assinatura, App Store Connect e pagamento Apple real não foram executados neste ambiente.
- Nenhuma migração SQL ou seed de demonstração foi aplicada.
