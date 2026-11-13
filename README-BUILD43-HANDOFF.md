# Coach Fit Pro — BUILD43 / Equipes

Esta cópia corresponde ao código publicado no `main` e no app web em 12/11/2026.

- Commit do `main` publicado: `1cfdc41a5260c1238404ce5fd30dd8740a9654e`
- Cloudflare Worker: versão 506, ativa (100%)
- Supabase Edge Function `professional-team-invitation`: versão 10, ativa
- Marcador da interface: `coach-fit-pro-team-workspace-build43-20261112`

## Alterações desta entrega

- Recebimento de convites da equipe carregado independentemente do carregamento do painel, com proteção contra troca de conta durante a busca.
- Convite recebido direciona à equipe correta.
- A área do membro mostra somente os alunos/pacientes selecionados para aquela colaboração e abre o editor correspondente de treino ou dieta.
- Retorno da edição para a equipe preserva a seleção do colaborador.
- O envio do convite usa o HTML da função Supabase, sem depender do template do Resend.

## Para continuar o desenvolvimento

1. Instale dependências com `pnpm install --frozen-lockfile`.
2. Configure localmente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.production` para compilar. Não use `service_role` nem inclua credenciais no próximo pacote.
3. Rode `pnpm run build` para gerar `dist/` antes de publicar.

A pasta `dist/` e o arquivo `.env.production` foram omitidos para não incluir assets compilados antigos ou configuração local. Nenhuma migration foi necessária nesta entrega.
