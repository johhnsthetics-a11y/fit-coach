# Guia manual — entitlement Apple server-side e itens pendentes da App Review

## Situação desta cópia

A BUILD41 agora contém um gate de assinatura no banco para fontes já reconhecidas pelo app (assinatura web e afiliado ativo) e para assinaturas Apple verificadas no servidor. A Edge Function `apple-subscription-sync` consulta a App Store Server API, valida os JWS com a biblioteca oficial da Apple, confere o UUID autenticado em `appAccountToken` e o Bundle ID, e grava o estado somente com a chave service-role. A tabela Apple não pode ser lida/escrita por `anon` ou `authenticated`; a transação original não pode ser transferida para outra conta. RPCs de colaboração exigem verificação recente (um minuto). Revogar, sair ou remover continua permitido mesmo sem assinatura ativa.

Também foi corrigida a chamada local de compra/restauração para passar `accountId` e o produto apresentado aos métodos StoreKit existentes; preços, IDs e condições não foram alterados. A validação Deno das funções `apple-subscription-sync` e `student-avatar` passou localmente, e os cenários PGlite passaram.

**Nada foi aplicado em Supabase nem implantado.** O `project_id` em `supabase/config.toml` aponta para o projeto de produção `zrlcisuuekudczkbapil`; não execute comandos sem conferir explicitamente o projeto de destino. Esta entrega é código-fonte. Não houve `cap sync`, archive Xcode, GitHub workflow, deploy, TestFlight ou teste de compra real/Sandbox.

## 1. Preparar e validar em staging primeiro

Use um projeto Supabase de staging separado do projeto de produção. Confirme que ele já possui as tabelas e colunas de base referenciadas pela migration, incluindo `public.users`, `public.students`, `public.coach_subscriptions`, `public.affiliate_professionals`, `public.nutrition_plans` e `public.workouts`.

No SQL Editor **do projeto de staging**, aplique o arquivo completo:

`supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql`

Essa migration é aditiva, mas também instala as RPCs, políticas e triggers BUILD41. Se a migration já tiver sido aplicada em qualquer ambiente, não a reaplique manualmente; confirme o estado da tabela `supabase_migrations.schema_migrations` e faça qualquer correção futura em uma nova migration.

## 2. Criar a chave da App Store Server API

No App Store Connect, gere uma chave de **In-App Purchase** em Users and Access → Integrations → In-App Purchase. Guarde o arquivo `.p8` com segurança e copie o Issuer ID e Key ID. A chave privada costuma ser baixada uma única vez; não a envie por chat, não a coloque em Git, `.env` do cliente, build do app ou ZIP.

Identificadores já confirmados nesta cópia:

- Bundle ID: `br.com.coachfitpro.ios`.
- Apple App ID: `6827708756`, conferido nos campos `adam_id`/`storeInfo.itemID` do crash report da build 27.
- Produtos referenciados pelo StoreKit: `br.com.coachfitpro.ios.profissional.mensal`, `br.com.coachfitpro.ios.profissional.semestral` e `br.com.coachfitpro.ios.profissional.anual`.

Configure como **secrets de Edge Functions do projeto de staging**, nunca como variáveis Vite/client-side:

- `APPLE_IAP_ISSUER_ID`
- `APPLE_IAP_KEY_ID`
- `APPLE_IAP_PRIVATE_KEY` (conteúdo integral do `.p8`, preservando as quebras de linha)
- `APPLE_APP_ID=6827708756`
- `APPLE_BUNDLE_ID=br.com.coachfitpro.ios`

`SUPABASE_URL` é fornecida pelo runtime Supabase. A função usa `SUPABASE_SERVICE_ROLE_KEY` se disponível; se o runtime não a fornecer, configure o secret `FITCOACH_SERVICE_ROLE_KEY` apenas para a função. Essa chave concede privilégios administrativos ao backend: jamais a inclua no app ou em resposta pública.

Com Supabase CLI autenticada e o ref de staging verificado, os comandos devem sempre indicar esse ref. Exemplo, substituindo `<STAGING_REF>` pelo projeto correto e usando o caminho real guardado do `.p8`:

```bash
supabase secrets set --project-ref <STAGING_REF> \
  APPLE_IAP_ISSUER_ID="$APPLE_IAP_ISSUER_ID" \
  APPLE_IAP_KEY_ID="$APPLE_IAP_KEY_ID" \
  APPLE_IAP_PRIVATE_KEY="$(cat /caminho-seguro/AuthKey_XXXXXX.p8)" \
  APPLE_APP_ID=6827708756 \
  APPLE_BUNDLE_ID=br.com.coachfitpro.ios
```

## 3. Implantar e validar as funções em staging

Somente depois de a tabela existir e os secrets estarem configurados, implante as funções necessárias para o consentimento/foto e o entitlement Apple:

```bash
supabase functions deploy apple-subscription-sync --project-ref <STAGING_REF>
supabase functions deploy student-avatar --project-ref <STAGING_REF>
```

`apple-subscription-sync` exige JWT (`verify_jwt = true`) e também valida novamente a sessão no servidor. `student-avatar` conserva os fluxos atuais de fotos e só devolve a foto do colaborador para o aluno autenticado quando a delegação da especialidade, equipe e consentimento estão ativos.

Execute testes controlados em staging antes de produção:

1. Conta profissional sem assinatura web, Apple ou afiliação: criação/consulta de equipe deve ser negada por RPC, mesmo chamando o endpoint diretamente.
2. Assinatura web ativa com um dos status aceitos pelo `isSubscriptionCurrent` atual, e afiliado com `active = true`: as RPCs devem continuar autorizadas. Status fora da lista atual não deve ser improvisado; confirme o estado real do provedor primeiro.
3. Compra Apple Sandbox na conta Coach Fit Pro correta: o `appAccountToken` deve corresponder ao UUID autenticado, o produto deve ser um dos três IDs existentes e o servidor deve confirmar `active=true` antes de liberar as RPCs.
4. Transação Apple pertencente a outra conta, expirada, revogada, sem `appAccountToken`, bundle diferente ou verificação mais antiga que um minuto: deve ser negada.
5. Período de cobrança em grace válido: deve permanecer autorizado somente enquanto a data de grace estiver vigente.
6. Consentimento por paciente, remoção/saída da equipe e revogação, incluindo avatar do colaborador depois do consentimento; verifique que outras equipes e carteiras não mudam.

A implementação não inclui App Store Server Notifications V2. O estado é atualizado sob demanda e tem janela curta; configurar notifications assinadas para refletir renovações/revogações sem depender de uma nova abertura do app é uma etapa operacional recomendada, não entregue aqui.

## 4. Produção — somente após autorização e aprovação do staging

Depois de validar staging e revisar os resultados, planeje a janela de produção e confirme por escrito o ref de destino. Aplique a migration **uma única vez** em produção, configure os mesmos secrets no projeto correto e implante as duas funções. Não use o ref que está salvo em `supabase/config.toml` sem reconferir o destino. Esta tarefa não autorizou e não executou nenhum desses passos.

## 5. Resolver em separado o retorno da Apple da build 27

### Guideline 2.1(a) — foto/câmera

O crash report anexado é conclusivo: `EXC_CRASH`/`SIGABRT`, namespace `TCC`, por ausência de `NSCameraUsageDescription` no Info.plist ao abrir “Take Photo”. A cópia BUILD41 já inclui uma descrição em `ios/App/App/Info.plist` e o teste `pnpm test:ios-privacy`. Isso **não altera o binário 27** e não prova, por si só, que uma nova build foi validada em dispositivo.

Para fechar o item, o responsável pela publicação ainda precisa gerar uma nova build iOS incorporando esse Info.plist e testar em iPad/iPhone: escolher foto da biblioteca, tirar foto, cancelar e salvar uma foto. Só então afirmar à App Review que a correção foi testada.

### Guideline 2.1(b) — compras dentro do app

No App Store Connect, abra cada assinatura mensal, semestral e anual; confirme ID, preço/localização, grupo, metadados e **App Review screenshot** no registro de cada produto. Em seguida, associe os IAPs/subscriptions à nova versão da app (a nova build, depois de compilada e carregada) e envie os produtos junto com essa versão para revisão. O print de Home ou do seletor de foto não substitui o screenshot de App Review da tela real de assinatura. Nenhum produto foi enviado por esta tarefa.

## O que ainda não foi comprovado

Os testes foram locais: PGlite simula o banco e Deno verifica tipos/imports, mas não exercitam credenciais Apple reais, projeto Supabase remoto, compra Sandbox, Xcode, TestFlight ou App Review. Não descreva a colaboração ou o crash como validado em produção até completar esses passos.