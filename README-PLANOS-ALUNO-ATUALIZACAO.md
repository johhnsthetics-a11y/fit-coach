# Coach Fit Pro - Atualizacao de planos do aluno

## O que mudou

- No cadastro/edicao de aluno, o treinador pode escolher um plano ja cadastrado.
- O treinador tambem pode criar um plano novo direto no cadastro do aluno.
- Ao criar um plano novo ali, ele passa a aparecer em `Configuracoes > Planos e valores do treinador`.
- A tela de recebimentos/cobrancas passa a usar o valor e o ciclo do plano escolhido para cada aluno.
- O cadastro mostra um resumo com valor da cobranca, ciclo e equivalente mensal antes de salvar.

## Supabase

Nao precisa rodar SQL novo se voce ja aplicou a atualizacao de branding/planos.

Se aparecer erro de campo ausente em `coach_settings.custom_plans`, rode o arquivo:

`supabase_branding_planos_cobranca.sql`

## GitHub

Suba todos os arquivos mantendo as pastas `src`, `public` e `supabase` como estao no pacote.
