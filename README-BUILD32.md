# Coach Fit Pro — BUILD32

## O que mudou

Esta cópia parte do ZIP BUILD31 com SHA-256 `be381b71addf9355ec3baae1a07caf0363174315ee140ef0fbccb94969293d10`. Para atender ao pedido de uma tipografia com mais personalidade de treino, Barlow Condensed local (pesos 600/700/800) foi aplicada somente a títulos, rótulos de navegação, nomes de plano e números-resumo dentro da área Treinos do treinador. O corpo, microcopy, outras páginas e experiência do aluno continuam com a fonte global já existente. A fonte não é carregada de um serviço externo; sua licença SIL OFL 1.1 acompanha os arquivos em `public/assets/fonts/`.

O layout BUILD31 também continua: navegação em cinco colunas para painéis largos, grade de três colunas para painéis médios e rolagem horizontal para espaço estreito. A versão comercial permanece 1.0 e o número iOS sobe para 32.

## Verificações

`pnpm test`: **492/492**; `pnpm test:subscription`: **50/50**; typecheck: passou; lint e verificações de tema/alinhamento: 6/6; build web: concluído em 9,53 s. A compilação mantém um aviso Vite de que o bundle principal é maior que 600 KB (aprox. 1,24 MB minificado); não foi alterada a estratégia de code splitting. A fixture fictícia `.env.production` e `dist` foram removidos antes de empacotar.

Não foram executados browser acceptance, validação visual de viewport no navegador, cap sync, Xcode archive, workflow GitHub, upload TestFlight nem publicação.

## Workflow iOS

`operation: verify` segue sendo o padrão; build number padrão passa a **32**. Para fazer upload, o operador deve selecionar `testflight` explicitamente e confirmar no App Store Connect que build 32 está disponível/inédito. Nenhuma operação de envio foi executada.