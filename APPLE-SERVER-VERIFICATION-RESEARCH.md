# Pesquisa: validação server-side de assinaturas Apple para BUILD41

## Decisão técnica

As RPCs profissionais precisam consultar um gate no banco que aceite apenas uma destas fontes confiáveis: assinatura web vigente (`coach_subscriptions`), afiliado ativo (`affiliate_professionals`) ou entitlement Apple verificado e recente, vinculado ao UUID autenticado por `appAccountToken`. Um booleano enviado pelo cliente ou estado nativo local não deve gravar entitlement no backend.

Para Apple, o fluxo recomendado é uma Supabase Edge Function autenticada receber um transaction ID do StoreKit, consultar a App Store Server API para produção e sandbox e validar os dados assinados retornados com a biblioteca oficial Apple. A implementação local BUILD41 agora faz essa consulta sob demanda, persiste apenas o estado necessário (original transaction ID, usuário vinculado, produto, ambiente, status, validade e timestamp de verificação) e exige verificação recente (TTL de um minuto) antes de RPCs profissionais. O App Store Server Notifications V2 não foi implementado; revogações serão percebidas pela consulta seguinte ou expiração do TTL, portanto a configuração de notifications continua uma melhoria operacional recomendada.

O plugin atual passa `appAccountToken(accountId)` à compra e retorna `originalId` para entitlements. A Edge Function compara o appAccountToken autenticado e o bundle ID antes de persistir; o cliente não pode escrever na tabela Apple. A verificação preserva o estado local de StoreKit caso a rede falhe, mas RPCs protegidos continuam negando o acesso até o servidor confirmar. O Deno `check` da função passou localmente. A migration e a função ainda não foram implantadas em Supabase.

## Referências

- Apple — Get All Subscription Statuses: endpoint de produção e sandbox, status por grupo e códigos 1 (ativo) e 4 (billing grace period): https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses
- Apple — Status Response: resposta inclui dados assinados de transação e renovação: https://developer.apple.com/documentation/appstoreserverapi/statusresponse
- Apple — API Keys para App Store Server API: chave privada baixada uma única vez; guardá-la em segredo, nunca no cliente ou repositório: https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests
- Apple — App Store Server Notifications V2: payloads JWS assinados para eventos de compra, renovação e revogação: https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications
- Apple — Node App Store Server Library: cliente API e SignedDataVerifier para validar dados assinados da Apple: https://github.com/apple/app-store-server-library-node
- Apple — SignedDataVerifier: verifica e decodifica transaction, renewal info e notification JWS; produção exige appAppleId: https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html
- Apple — AppStoreServerAPIClient: `getAllSubscriptionStatuses(anyTransactionId, status?)`: https://apple.github.io/app-store-server-library-node/classes/AppStoreServerAPIClient.html
- Supabase — Edge Function dependencies: suporta dependências npm com `npm:` e ambiente Deno: https://supabase.com/docs/guides/functions/dependencies
- Apple — certificados públicos raiz usados pelo `SignedDataVerifier`: https://www.apple.com/certificateauthority/
- npm — versão fixada da biblioteca oficial Apple usada pela função (3.1.0): https://registry.npmjs.org/@apple/app-store-server-library/latest

## Identificadores e estado local

- Bundle ID: `br.com.coachfitpro.ios`.
- Apple App ID numérico: `6827708756`, confirmado nos campos `adam_id`/`storeInfo.itemID` do crash report anexado da build 27; não confundir com o listing de terceiro citado na conversa.
- SDK Apple: `@apple/app-store-server-library` fixada na Edge Function; `deno.json` usa `nodeModulesDir: auto`, e a compilação de tipos foi validada com Deno.
- A checagem da assinatura por RPC aceita os mesmos status web já usados no app, afiliado ativo e entitlement Apple vigente/recentemente verificado; master admin não recebe bypass no banco.

Nenhuma chave Apple, migration, função ou configuração foi aplicada em produção por causa desta pesquisa. A criação da chave IAP, a instalação de secrets e a configuração dos URLs de notificação permanecem operações manuais futuras.
