# BUILD32 — Tipografia de Treinos

## Design Read

Artifact: workspace profissional de prescrição, sobretudo desktop. Audience: treinadores que precisam localizar Planos, Rascunhos, Exercícios, Alunos e Evolução rapidamente. Visual language: display tipográfico atlético controlado com leitura operacional. Mode: **Redesign · Preserve**. Dials: variação 4, movimento 2, densidade 7, assets 1, fidelidade de marca 9.

## Direção tipográfica

A família global do app continua sendo usada em textos corridos, descrições, filtros e controles. A pedidos do usuário, os títulos de áreas e seções, nomes de planos e números-resumo da área Treinos passam a usar **Barlow Condensed** nos pesos 600, 700 e 800. O desenho condensado dá mais caráter à prescrição esportiva, diferencia títulos do conteúdo de leitura e deixa os cinco nomes de navegação mais fáceis de escanear no desktop.

Os três WOFF2 latinos ficam localmente em `public/assets/fonts/` e carregam apenas quando a folha do treinador é usada; não se consulta Google Fonts durante a execução e não é necessária conectividade para buscar as fontes. O restante da tipografia e a interface do aluno não mudam. A licença SIL OFL 1.1 está incluída junto aos arquivos. A família foi escolhida do catálogo oficial Google Fonts e a licença foi conferida no repositório de origem Barlow.

O ajuste BUILD31 de largura e distribuição das áreas é mantido: cinco colunas em painéis largos, três em painéis médios e faixa rolável em painéis estreitos. O lettering novo usa escala fluida e pesos reais da família; descrições permanecem com a fonte de corpo. Nenhum fluxo, dado, cor, componente, callback ou regra de treino foi alterado.

## Proteções e validação

A BUILD31 foi preservada e copiada para BUILD32. App.jsx só recebe o marcador de release. Payloads, sessões, Supabase, analítica, StoreKit, assinatura e preços ficam intactos. `pnpm test` passou 492/492; `pnpm test:subscription` 50/50; typecheck, lint e build web passaram. Ver `README-BUILD32.md` e `AUDITORIA-BUILD32-ENTREGA.md`. Não foi feito browser acceptance, archive iOS, workflow ou upload TestFlight.