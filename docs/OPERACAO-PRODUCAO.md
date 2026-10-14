# Operação de produção

## Situação atual

O projeto Supabase `Coach Fit` (`zrlcisuuekudczkbapil`) está no plano gratuito. Nesse plano, a proteção nativa contra senhas vazadas e os backups automáticos do Supabase não estão disponíveis. O aplicativo aplica uma política forte para novas senhas como controle compensatório, mas isso não substitui a consulta de senhas vazadas do plano Pro.

## Monitoramento

O workflow `Production health` verifica de hora em hora:

- aplicativo publicado;
- tela de login;
- política de privacidade;
- saúde do Supabase Auth.

Uma indisponibilidade faz o workflow falhar e aparece em **GitHub > Actions**. Mantenha as notificações de Actions habilitadas para o proprietário do repositório.

## Backup criptografado

O workflow `Encrypted production backup` exporta diariamente banco e arquivos do Supabase, criptografa tudo antes do envio e grava somente o arquivo cifrado em um bucket privado do Cloudflare R2. Nada é anexado ao workflow do repositório público.

Para ativá-lo:

1. Crie no R2 um bucket privado exclusivo para backup e configure ciclo de vida de 30 dias.
2. Em **GitHub > Settings > Secrets and variables > Actions**, cadastre:
   - `SUPABASE_DB_URL`: conexão pelo Session Pooler com a senha do banco codificada para URL;
   - `SUPABASE_URL`: URL do projeto Coach Fit;
   - `SUPABASE_SERVICE_ROLE_KEY`: somente como secret, nunca como variável pública;
   - `BACKUP_ENCRYPTION_PASSWORD`: senha longa, aleatória e guardada fora do GitHub;
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET`.
3. Crie a variável de repositório `PRODUCTION_BACKUPS_ENABLED` com valor `true`.
4. Execute manualmente o workflow uma vez e confirme no R2 os arquivos `.tar.gz.enc` e `.sha256`.
5. Faça trimestralmente um teste de restauração em projeto separado. Um backup que nunca foi restaurado ainda não foi validado.

Não torne o bucket público e não armazene a senha de criptografia junto com os backups.

## Senhas

No plano gratuito, mantenha em **Supabase > Authentication > Providers > Email**:

- mínimo de 10 caracteres;
- exigência de letras maiúsculas, minúsculas, números e símbolos.

Ao migrar para o plano Pro, ative também **Leaked password protection**. As senhas existentes continuam válidas; a regra reforçada será aplicada em novos cadastros e alterações.

## App Store

O pacote Capacitor já preparado continua dependendo de ações que não podem ser executadas no Windows nem sem a conta Apple:

- reservar o Bundle ID e criar o app no App Store Connect;
- aceitar contratos e cadastrar dados fiscais/bancários;
- criar os produtos de Compra no App;
- solicitar o entitlement de compras externas para o Brasil;
- compilar, assinar e testar no iPhone/TestFlight pelo Xcode.

Para compras digitais no Brasil a partir do iOS 26.5, o checkout Cartpanda dentro do app exige o entitlement de compras externas e a Compra no App da Apple com destaque igual ou maior. Não envie o binário com apenas o link Cartpanda.

Referências oficiais:

- https://developer.apple.com/br/support/payment-options-on-the-app-store-in-brazil/
- https://developer.apple.com/br/support/app-distribution-in-brazil
- https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow
- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/docs/guides/platform/backups
