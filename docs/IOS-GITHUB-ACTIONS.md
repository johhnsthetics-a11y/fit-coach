# Coach Fit Pro — GitHub Actions iOS / TestFlight

Este procedimento prepara compilações iOS pelo runner macOS padrão do GitHub Actions sem usar Xcode localmente.

## Estado e cuidados

- Fluxo **manual**: só executa em **Actions → Coach Fit Pro - iOS TestFlight (manual) → Run workflow**.
- **verify** (padrão): instala dependências, executa testes, compila Vite, sincroniza Capacitor e verifica a compilação nativa sem assinatura. Não envia nada à Apple.
- **testflight**: adicionalmente assina com o certificado Apple Distribution e envia a IPA à App Store Connect. **Não publica automaticamente na App Store**.
- Bundle ID fixo: `br.com.coachfitpro.ios`; não altere o identificador nem cadastre outro aplicativo.
- A pasta **ios** precisa ser adicionada do ZIP que funcionou no Xcode, preservando AppDelegate, Info.plist, AppIcon, projeto Xcode e plugin StoreKit 2. O fluxo **não executa `cap add ios`**.
- O ZIP funcional tem arquivos **.env.production** e arquivos gerados: **não envie o ZIP inteiro para o repositório público**. Envie somente o projeto nativo revisado, nunca segredos, `.p12`, `.p8`, `.mobileprovision`, `node_modules` ou `dist`.
- `ios/App/CapApp-SPM/Package.swift` pode referenciar um caminho pnpm gerado localmente. `pnpm exec cap sync ios` deve regenerar referências; verifique as dependências no runner.
- O workflow usa `macos-latest`. Verifique os logs de `xcodebuild -version` e a disponibilidade do SDK exigido; não há garantia de que a versão disponível no runner corresponda exatamente ao Xcode local.

## GitHub Secrets obrigatórios somente para TestFlight

Adicione em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Conteúdo |
|---|---|
| `IOS_DISTRIBUTION_P12_BASE64` | Bytes base64 do arquivo `.p12` Apple Distribution que contém chave privada |
| `IOS_P12_PASSWORD` | Senha do `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Bytes base64 do perfil de distribuição `.mobileprovision` correspondente |
| `APPLE_TEAM_ID` | ID de equipe Apple Developer do perfil |
| `ASC_API_KEY_BASE64` | Bytes base64 da chave API `.p8` do App Store Connect |
| `ASC_KEY_ID` | Key ID da chave API do App Store Connect |
| `ASC_ISSUER_ID` | Issuer ID da chave API do App Store Connect |

**Base64 não é criptografia.** Insira estes dados exclusivamente como Secrets. Nunca cole valores em conversas, issues, commits ou pull requests.

No Windows, é possível converter um arquivo local para base64 com PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\CAMINHO\arquivo.p12"))
```
Repita para `.mobileprovision` e `.p8`, usando o caminho respectivo. Copie a saída **diretamente** para o secret no GitHub, sem salvar em arquivos públicos.

A chave API pode ser criada em **App Store Connect → Users and Access → Integrations → App Store Connect API** por alguém com permissões adequadas. O arquivo `.p8` só pode ser baixado uma vez.

## Ordem de implantação

1. Revise e adicione o projeto `ios` funcional ao repositório, sem segredos nem diretórios gerados.
2. Confirme que a versão web corrigida está no GitHub e `pnpm run build` passa.
3. Mescle o PR do workflow após revisar o código e as permissões.
4. Execute o modo **verify** primeiro. Corrija qualquer falha antes de configurar a distribuição.
5. Configure os sete Secrets no GitHub. Confirme que o perfil usa o certificado `.p12` correto.
6. Execute **testflight** com uma versão e um número de build ainda não utilizados, por exemplo `1.0 (2)`, e acompanhe o processamento na Apple.
7. Teste preços de assinatura, StoreKit, login, treinos, dietas e chat no TestFlight antes de solicitar revisão.

Se já enviou `1.0 (1)`, use um novo número de build; subir uma versão com número repetido falhará. Atualizar o GitHub **não** altera sozinho o aplicativo instalado no TestFlight.

Este workflow é uma base de automação e precisa ser validado no runner macOS antes de ser considerado operacional.
