# Configuração da Cartpanda no FIT COACH

## 1. Rode o SQL

No Supabase, abra o SQL Editor e rode o arquivo:

`supabase_cartpanda_assinatura.sql`

Ele cria a tabela de eventos da Cartpanda e garante que a assinatura do coach tenha os campos necessários.

## 2. Configure os secrets da função

No Supabase, vá em:

`Edge Functions` > `Secrets`

Adicione:

`FITCOACH_SERVICE_ROLE_KEY`

Valor: sua chave `service_role` do Supabase.

`CARTPANDA_WEBHOOK_TOKEN`

Valor: crie uma senha/token sua. Use letras e números, sem espaço.

Exemplo de formato:

`cartpanda-fitcoach-2026-token`

## 3. Faça deploy da função

No Supabase, crie/deploy a função:

`cartpanda-webhook`

O arquivo da função fica em:

`supabase/functions/cartpanda-webhook/index.ts`

## 4. URL para colar na Cartpanda

Cole esta URL no campo `Postback URL` da Cartpanda.

Troque `SEU_TOKEN_AQUI` pelo mesmo valor cadastrado em `CARTPANDA_WEBHOOK_TOKEN`.

```text
https://zrlcisuuekudczkbapil.supabase.co/functions/v1/cartpanda-webhook?token=SEU_TOKEN_AQUI&event=cartpanda_postback&email={email}&amount={total_price}&amount_net={amount_net}&product_id={product_id}&product_name={product_name}&order_id={order_id}&order_type={order_type}&phone={phone_number}&created_at={datetime_full}&is_test={is_test}
```

## 5. URL de retorno após a compra

Na Cartpanda, configure a página de obrigado/redirecionamento para:

```text
https://app.coachfitpro.com.br/?pagamento=confirmado
```

## 6. Link do checkout no Cloudflare

Quando o checkout da Cartpanda estiver pronto, troque a variável do Cloudflare:

`VITE_FITCOACH_FIRST_MONTH_CHECKOUT_URL`

Valor: o link do checkout de entrada da Cartpanda.

Se tiver um checkout separado para renovação mensal, configure também:

`VITE_FITCOACH_REGULAR_CHECKOUT_URL`

## 7. Como testar

Depois de uma compra teste, rode no Supabase:

```sql
select
  received_at,
  event_type,
  buyer_email,
  product_name,
  provider_order_id,
  subscription_status,
  processed,
  processing_error
from public.payment_webhook_events
where provider = 'cartpanda'
order by received_at desc
limit 10;
```

Se `processed` aparecer como `true` e `subscription_status` como `active`, o painel do coach será liberado automaticamente.
