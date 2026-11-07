# Brand spec — Coach Fit Pro

## Assets oficiais no projeto

- **Wordmark horizontal transparente:** `public/assets/fit-coach-logo.png` (1600 × 284). Referenciar como imagem; não redesenhar nem substituir por silhueta CSS.
- **Arquivo-fonte do mesmo lockup:** `public/assets/fit-coach-logo-source.png` (1600 × 284; transparente).
- **Marca quadrada em fundo branco:** `public/logoabre.png` (1024 × 1024); usar apenas quando o fundo branco fizer sentido no componente.
- **Ícone oficial dark:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024 × 1024; verde/teal sobre verde-grafite).
A tela nativa usa o mesmo componente final da aplicação compilada.

## Tokens que vêm do código atual

| Papel | Dark | Light |
|---|---|---|
| Superfície base do painel | `#0B1516` | `#FFFFFF` |
| Cartão | `#111E20` | `#F5FAF9` |
| Texto primário | `#F4FFFD` | `#0D2523` |
| Texto secundário | `#A7BDBA` | `#425C58` |
| Acento teal | `#4EE9D0` | `#087F72` |
| Direção de fundo | verde-grafite | branco/mint suave |

A identidade do ícone e dos logos usa uma gradação verde → teal. O acento ajuda a indicar seleção, acesso ativo e ação primária; não é usado como fundo de blocos de texto longos. O corpo da aplicação continua herdando a família tipográfica global.

## Tipografia de exibição da área Treinos

Por solicitação explícita do usuário, a área profissional **Treinos** usa Barlow Condensed somente em títulos, rótulos das cinco áreas, nomes de planos e indicadores numéricos. Pesos 600, 700 e 800 ficam auto-hospedados em `public/assets/fonts/` para uso offline e no app iOS; títulos preservam boa leitura sem substituir a fonte do corpo. A licença SIL Open Font License 1.1 está incluída em `public/assets/fonts/OFL-Barlow.txt`.

Fonte e projeto: [Google Fonts — Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) e [repositório Barlow com licença OFL 1.1](https://github.com/jpt/barlow).

## Restrições de marca e conteúdo

- Aplicar os tokens com contraste apropriado em cada tema; não inverter para “preto/branco” genérico.
- Preservar o arquivo de logo/ícone original e citar este documento em referências de implementação.
- A página oficial [app.coachfitpro.com.br](https://app.coachfitpro.com.br) posiciona o Coach Fit Pro para profissionais/consultorias e apresenta condições web próprias; essas ofertas não são fonte de preço para a assinatura Apple.
- Textos legais, preços e termos da tela nativa permanecem ligados ao fluxo StoreKit existente, não a conteúdo ilustrativo.
