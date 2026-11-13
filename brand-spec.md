# Brand spec — Coach Fit Pro

## Assets oficiais no projeto

- **Wordmark horizontal transparente:** `public/assets/fit-coach-logo.png` (1600 × 284). Referenciar como imagem; não redesenhar nem substituir por silhueta CSS.
- **Arquivo-fonte do mesmo lockup:** `public/assets/fit-coach-logo-source.png` (1600 × 284; transparente).
- **Marca quadrada em fundo branco:** `public/logoabre.png` (1024 × 1024); usar apenas quando o fundo branco fizer sentido no componente.
- **Ícone oficial dark:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024 × 1024; verde/teal sobre verde-grafite).
A tela nativa usa o mesmo componente final da aplicação compilada.

## Screenshots reais do produto

- `public/assets/sales-screens/overview-dark.png` e `overview-light.png`
- `public/assets/sales-screens/workouts-dark.png` e `workouts-light.png`
- `public/assets/sales-screens/nutrition-dark.png` e `nutrition-light.png`

As seis imagens são capturas diretas do código atual da aplicação em viewport mobile de 390 × 844 CSS px, exportadas em 1170 × 2532 px (DPR 3) com fixtures locais sintéticas; nenhum backend ou dado pessoal real participou. A captura foi feita por emulação mobile no Chromium, não em um iPhone físico. O showcase referencia os arquivos por `<img>` e alterna o tema coerente com a página. Os PNGs permanecem sem edição ou crop. A moldura externa reserva 20 px proporcionais para a safe area em sua escala reduzida e posiciona statusbar/notch dentro dessa região, deixando a imagem completa do app visível.

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

## Tipografia do app

Por solicitação explícita do usuário, **Plus Jakarta Sans** é a família tipográfica única em todas as telas, incluindo Treinos, vendas e números/temporizadores da interface. A fonte variável fica auto-hospedada em `public/assets/fonts/PlusJakartaSans-VF.ttf`, pesos 200–800; a licença SIL Open Font License 1.1 acompanha o arquivo em `public/assets/fonts/OFL-Plus-Jakarta-Sans.txt`. Os seletores devem herdar essa família, mantendo a hierarquia por tamanho, peso, espaçamento e largura — sem fonte condensada separada.

Fonte verificada: [Google Fonts — Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans); origem/licença: [Tokotype/PlusJakartaSans](https://github.com/tokotype/PlusJakartaSans).

## Restrições de marca e conteúdo

- Aplicar os tokens com contraste apropriado em cada tema; não inverter para “preto/branco” genérico.
- Preservar o arquivo de logo/ícone original e citar este documento em referências de implementação.
- Preservar as capturas comerciais como imagens diretas da interface atual com fixtures sintéticas; nunca usar dados pessoais ou redesenhar as telas à mão. Distinguir captura mobile emulada de captura feita em dispositivo físico.
- A página oficial [app.coachfitpro.com.br](https://app.coachfitpro.com.br) posiciona o Coach Fit Pro para profissionais/consultorias e apresenta condições web próprias; essas ofertas não são fonte de preço para a assinatura Apple.
- Textos legais, preços e termos da tela nativa permanecem ligados ao fluxo StoreKit existente, não a conteúdo ilustrativo.
