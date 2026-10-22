# Coach Fit Pro - alinhamento e hidratacao

Pacote consolidado das atualizacoes de chat, check-ins, organizacao de protocolos, meta de agua e alinhamento geral do aplicativo em 22/10/2026.

## Como aplicar

1. Extraia o arquivo ZIP.
2. Envie o conteudo da pasta extraida para a raiz do repositorio no GitHub, preservando exatamente as pastas `public`, `scripts` e `src`.
3. Quando o GitHub perguntar, confirme a substituicao dos arquivos existentes.
4. Nao envie a pasta externa `COACH-FIT-PRO-ALINHAMENTO-HIDRATACAO-20261022`; envie os arquivos e pastas que estao dentro dela.
5. Aguarde o deploy automatico do projeto.

## Supabase

Esta atualizacao nao exige SQL nem migracao nova no Supabase.

## Arquivos canonicos

O aplicativo e compilado a partir de `src/main.jsx`, `src/App.jsx`, `src/index.css` e `src/supabaseApi.js`. Nao substitua esses arquivos por copias antigas existentes na raiz do repositorio.

## Validacao executada

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run test:database`
- `pnpm run build`
- testes de navegador de nutricionista e paciente em resolucoes mobile e desktop

Todos os testes acima passaram antes da criacao deste pacote.
