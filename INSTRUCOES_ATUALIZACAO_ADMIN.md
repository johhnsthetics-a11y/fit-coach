# Atualização Admin Master - FIT COACH PRO

## Acesso correto

Depois do deploy, acesse:

https://coachfitpro.com.br/admin

O Admin Master aceita somente:

sac@coachfitpro.com.br

## Ordem recomendada

1. Executar o SQL do arquivo `supabase_admin_master.sql`, caso ainda não tenha executado.
2. Subir todos os arquivos deste ZIP no GitHub.
3. Aguardar o deploy da Cloudflare.
4. Abrir `https://coachfitpro.com.br/admin` em aba anônima.
5. Fazer login com `sac@coachfitpro.com.br`.

## Correção aplicada nesta versão

Esta versão cria uma entrada real de build em `admin/index.html`, além da rota interna React `/admin`.
Também adiciona regras em `public/_redirects` para a Cloudflare entregar `/admin/index.html` quando o usuário acessar `/admin`.

Isso evita que `coachfitpro.com.br/admin` caia na página principal de vendas.

## Se ainda abrir a página de vendas

1. Confirme se o arquivo `admin/index.html` subiu para o GitHub.
2. Confirme se `public/_redirects` subiu com as regras de `/admin`.
3. Aguarde o deploy novo finalizar na Cloudflare.
4. Teste em aba anônima.
5. Se necessário, limpe cache/purge cache na Cloudflare.
