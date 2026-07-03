# Atualização Admin Master - Coach Fit Pro

## Antes de subir no GitHub

1. No Supabase, abra o SQL Editor.
2. Execute o arquivo `supabase_admin_master.sql` inteiro.
3. Confirme que o login `sac@coachfitpro.com.br` existe no Auth do Supabase.
4. Faça o deploy deste projeto atualizado no GitHub/Cloudflare.

## Ordem recomendada

1. Backup do repositório atual.
2. Aplicar `supabase_admin_master.sql` no Supabase.
3. Subir os arquivos atualizados no GitHub.
4. Aguardar o deploy da Cloudflare.
5. Entrar com `sac@coachfitpro.com.br`.
6. Abrir `Admin Master`.
7. Salvar uma alteração pequena de teste, por exemplo o aviso da página.
8. Abrir a página de vendas em aba anônima para confirmar a alteração.

## O que esta versão adiciona

- Admin Master liberado apenas para `sac@coachfitpro.com.br`.
- Edição dos textos principais da página de vendas.
- Editor avançado da página principal por JSON.
- Edição dos planos, preços, selos, descrições e links Cartpanda.
- Configurações de suporte, aviso de manutenção e criação de conta.
- Controle visual de cores.
- Módulos editáveis no Admin.
- Listagem administrativa de coaches e assinaturas.
- Botões para ativar, deixar pendente ou bloquear assinatura manualmente.
- SQL atualizado com policies RLS para proteger escrita administrativa.

## Observação

Depois desta atualização, mudanças comerciais e de conteúdo poderão ser feitas no Admin Master sem novo upload no GitHub. Ainda será necessário GitHub/Cloudflare quando a mudança for estrutural de código, nova tela complexa, nova integração ou alteração pesada de lógica.

## Build

Build validado com:

```bash
npm run build
```
