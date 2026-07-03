# COACH FIT PRO — Admin separado /admin

## Acesso
Depois do deploy, acesse:

https://coachfitpro.com.br/admin

Login permitido como Admin Master:

sac@coachfitpro.com.br

## Importante para Cloudflare
Esta versão remove totalmente o arquivo `public/_redirects`, porque a Cloudflare estava recusando o deploy por loop de redirect.

Antes de subir no GitHub, confirme que NÃO existe mais este arquivo no repositório:

public/_redirects

Se ele ainda aparecer no GitHub, delete manualmente.

O `package.json` também foi ajustado para apagar qualquer `dist/_redirects` depois do build.

## SQL
Não precisa rodar outro SQL se o SQL Admin Master anterior já foi executado.
