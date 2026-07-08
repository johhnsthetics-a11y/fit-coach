# Coach Fit Pro - Planos e mensagens de cobranca por plano

## O que mudou

- A area `Planos e valores do treinador` deixou de usar cadastro por linha.
- Agora o treinador cadastra plano por campos simples:
  - nome do plano
  - valor
  - ciclo
  - o que inclui
  - mensagem de cobranca daquele plano
- Os planos cadastrados aparecem em cards com opcoes de editar e remover.
- Cada plano pode ter sua propria copy de cobranca.
- Ao gerar cobranca manual ou automatica, o app usa primeiro a mensagem do plano.
- Se o plano nao tiver mensagem propria, o app usa a mensagem padrao da conta.

## Variaveis disponiveis na mensagem

Use estas variaveis na copy:

- `{aluno}`
- `{plano}`
- `{valor}`
- `{vencimento}`
- `{pix}`
- `{whatsapp}`
- `{email}`

## Supabase

Nao precisa rodar SQL novo se `coach_settings.custom_plans` ja existe.

Se aparecer erro de campo ausente, rode:

`supabase_branding_planos_cobranca.sql`
