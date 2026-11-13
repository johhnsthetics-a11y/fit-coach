# Auditoria Apple 2.1 — BUILD43

## Resultado

A fonte recebida `CoachFitPro_BUILD43_EQUIPE_ATUALIZADO.zip` contém a correção de permissão de câmera solicitada na revisão da versão 1.0 (build 27): `ios/App/App/Info.plist` declara `NSCameraUsageDescription` com uma justificativa em português, e o target iOS do app aponta para esse plist. O teste automatizado `scripts/ios-privacy-regression.test.mjs` também está presente.

A fonte original, porém, tinha marcadores de release incoerentes: o app, `public/version.txt` e o service worker indicavam BUILD43, enquanto `CURRENT_PROJECT_VERSION` no Xcode e o padrão do workflow/teste estavam em 41. Na cópia corrigida, os quatro settings Xcode, o padrão de `build_number` do workflow e a assertion correspondente foram alinhados para **43**. A versão de marketing continua **1.0**.

## Alterações aplicadas à cópia corrigida

- Preservado o código BUILD43 da raiz, incluindo as alterações da área Equipe.
- Mantida a chave `NSCameraUsageDescription`; não alterados fluxos de seleção/captura de imagem.
- Alinhados os quatro `CURRENT_PROJECT_VERSION` do projeto iOS para `43`.
- Alinhados o valor padrão manual do workflow iOS e a variável `IOS_BUILD` para `43`; o workflow continua com operação de verificação separada de upload TestFlight.
- Atualizada a regressão de cache offline: BUILD43 é o cache corrente; o cache de colaboração BUILD41 é tratado como cache antigo conhecido. Nenhum comportamento do service worker da aplicação foi alterado.
- Removido do ZIP de entrega o `.env.production` que acompanhava o ZIP recebido. Ele era um fixture de teste do Supabase, não deve ser usado como configuração real. O workflow já aceita os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; configure os valores corretos no ambiente GitHub Actions. O `.env.example` foi preservado.
- A pasta `GITHUB/` aninhada foi preservada por cautela; ela contém seis cópias históricas de arquivos e `GITHUB/src/App.jsx` tem um marker antigo. **A raiz do ZIP é a fonte canônica para build; não sobrescreva arquivos da raiz com os da pasta `GITHUB/`.**

## Validações executadas nesta cópia

- `pnpm test:ios-privacy`: 2 testes aprovados, 0 falhas.
- `pnpm test:subscription`: 50 testes aprovados, 0 falhas. A fixture antiga do teste offline foi alinhada ao service worker BUILD43; os testes não exigiram alteração dos produtos nem dos preços.
- `pnpm lint`: smoke checks e 6 testes aprovados.
- `pnpm typecheck`: concluído.
- Verificados: marcador do app, `public/version.txt` e cache do service worker em BUILD43; Xcode/workflow/testes alinhados em build 43; `NSCameraUsageDescription` no plist efetivamente usado pelo app; IDs StoreKit mantidos.

Não foi executado `xcodebuild`, archive, upload, instalação em aparelho, chamada ao App Store Connect ou submissão. Portanto, o código está preparado para a próxima compilação, mas a correção de câmera ainda deve ser testada fisicamente em iPad e iPhone antes de declarar isso à Apple.

## Pendências no App Store Connect

A pendência de compra integrada não é resolvida por alteração no código-fonte. Verifique e submeta os produtos já referenciados pela aplicação, sem criar IDs duplicados ou alterar preços:

- `br.com.coachfitpro.ios.profissional.mensal`
- `br.com.coachfitpro.ios.profissional.semestral`
- `br.com.coachfitpro.ios.profissional.anual`

Complete os metadados e envie uma captura real de App Review para cada produto. Associe a versão iOS 1.0 e os produtos à mesma submissão conforme o App Store Connect solicitar; depois use **Submit for Review**. A presença dos product IDs no código não prova que os IAPs já foram enviados para análise.
