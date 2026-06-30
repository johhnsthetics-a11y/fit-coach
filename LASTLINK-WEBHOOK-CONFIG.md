# Lastlink webhook

URL configurada na Lastlink:

```text
https://zrlcisuuekudczkbapil.supabase.co/functions/v1/lastlink-webhook
```

Segredos que precisam existir na Supabase Edge Function:

```text
LASTLINK_WEBHOOK_TOKEN=cole-aqui-o-token-do-webhook-da-lastlink
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-da-supabase
```

Eventos recomendados na Lastlink:

- Pagamento aprovado
- Assinatura criada/ativa
- Renovação paga
- Pagamento recusado/falhou
- Assinatura cancelada
- Reembolso
- Chargeback/contestação

Observação importante: o e-mail usado no checkout precisa ser o mesmo e-mail da conta criada no FIT COACH. É assim que o webhook identifica qual coach deve ser desbloqueado.
