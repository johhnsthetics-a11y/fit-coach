# Atualização - Gerenciamento, planos e cobrança inteligente

## O que mudou

- A página **Configurações** agora aparece como **Gerenciamento**.
- Em **Gerenciamento > Planos cadastrados**, ao adicionar, editar ou remover um plano, o app salva automaticamente.
- Cada plano pode ter nome, valor, ciclo, descrição e mensagem própria de cobrança.
- Ao cadastrar ou editar um aluno, o plano escolhido passa a orientar o valor, o ciclo e a próxima cobrança.
- Em **Recebimentos > Gerar cobrança**, o vencimento é calculado pelo plano do aluno e pelo histórico de cobranças.
- A página inicial de vendas recebeu ajuste nos títulos dinâmicos para encaixar melhor no desktop.

## Arquivos principais para subir no GitHub

Suba a pasta completa do pacote mantendo a estrutura:

- `App.jsx`
- `index.css`
- `src/App.jsx`
- `src/index.css`
- demais arquivos de configuração que já acompanham o pacote

## Supabase

Esta atualização não exige um SQL novo se o SQL de planos personalizados já foi aplicado.

Se algum campo de planos personalizados ainda não existir no banco, rode novamente o arquivo:

- `supabase_branding_planos_cobranca.sql`

