# Auditoria — Coach Fit Pro build 21

## Resultado

O aviso permanente “O app confere novamente preço, moeda e condições…” foi removido da tela **Minha assinatura**. O botão usa uma mensagem de progresso mais natural e o resumo de assinatura ativa tem copy orientada ao usuário. A varredura de texto do runtime não encontrou a mensagem removida, a nota de ambiente de teste, nem rótulos de mock/protótipo. Não há HTML de demonstração, harness ou arquivos de protótipo no workspace de distribuição.

A validação nativa de montante/moeda/termos e conta permanece ativa antes da compra. A retirada foi apenas da mensagem fixa; não reduz a proteção contra divergência de preço nem transfere assinaturas entre contas.

## Comparação com BUILD20

A BUILD20 e o ZIP já entregues permanecem preservados. A BUILD21 usa uma nova cópia isolada e muda a copy da tela, o namespace CSS interno para um nome neutro, os markers/cache, o build number e os testes correspondentes. Os arquivos de assinatura/web protegidos foram comparados por hash e permaneceram idênticos à BUILD20: `src/iosStoreKit.js`, `src/iosProductPresentation.js`, `src/iosIntroOffer.js`, `src/iosStoreKitPrice.js`, `src/iosBrazilPlanPriceReference.js`, `src/iosPurchaseVerification.js`, `src/WebSubscriptionPanel.jsx` e `CoachFitStoreKitPlugin.swift`.

Não houve mudança nos valores comerciais, produto/ID StoreKit, oferta Apple, checkout web/Cartpanda, verificação de entitlements, recuperação/restauração, proteção de conta, seeds SQL, treinos/dietas ou demais áreas.

## Verificações

| Verificação | Resultado |
|---|---|
| `pnpm test` | 461 passaram; 0 falharam. Fixture temporária de configuração publicável removida após o teste. |
| `pnpm run test:subscription` | 47 passaram; 0 falharam. |
| `pnpm run typecheck` | Passou. |
| `pnpm run lint` | 6 contratos passaram; 0 falharam. |
| `pnpm run build` | Passou; aviso não bloqueante de chunk grande. |
| `pnpm run ios:sync` | Passou; plugin local `@coachfit/storekit` detectado. |
| Browser acceptance Chromium | Passou em 390×844, 768×1024, 1280×720, 1440×900 e 320×740. Sem overflow horizontal e sem erros de página. |
| Copy e estados | Verificada ausência do aviso fixo e de texto de teste no modo padrão/ativo; elegibilidade introduzida, preço BRL, compra cancelada no mock sem acesso, restauração mockada e catálogo vazio bloqueado exercitados. Nenhuma chamada ao backend ou StoreKit real. |
| Versão/segredos | Markers web/iOS sincronizados; Xcode 1.0 (21); `.env.production` ausente no ZIP. |

## Limites

O teste visual usou produtos StoreKit simulados somente no harness temporário de QA, já removido; isso não alterou a interface final nem a cotação do app. A folha Apple real depende de Apple ID, elegibilidade e storefront e **não foi validada**. O preço exibido pelo StoreKit e a cobrança final devem ser confirmados no TestFlight; cancele se a folha divergir do resumo.

O ambiente Linux não tem Xcode; portanto archive assinado, provisionamento e upload ao TestFlight ainda precisam ser feitos no macOS/Xcode ou workflow autorizado. Nenhuma compra, publicação, alteração remota no App Store Connect ou deploy foi realizada.
