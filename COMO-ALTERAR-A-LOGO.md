# Como alterar a logo do FIT COACH

## Prepare a imagem

- Formato: PNG.
- Nome exato: `fit-coach-logo.png`.
- Tamanho recomendado: 1600 x 284 px, ou outra resolução horizontal com a mesma proporção.
- Peso recomendado: até 500 KB.
- Use fundo transparente e deixe uma pequena margem ao redor do desenho.

## Troque os dois arquivos

Substitua a imagem antiga nestes locais, mantendo exatamente o mesmo nome:

1. `fit-coach-logo.png`
2. `src/fit-coach-logo.png`

Os dois arquivos devem ser cópias idênticas. Não coloque a logo na pasta `public` e não altere o código de importação.

## Atualize no GitHub

1. Abra o repositório do FIT COACH.
2. Envie o novo `fit-coach-logo.png` para a raiz e confirme a substituição.
3. Entre na pasta `src`.
4. Envie novamente o mesmo `fit-coach-logo.png` e confirme a substituição.
5. Confirme as alterações e aguarde o novo deploy da Cloudflare.

## Confira

Abra o app em uma janela anônima ou atualize a página com `Ctrl + F5`. O Vite cria um novo nome interno para a imagem em cada publicação, então a logo nova deve aparecer após o deploy terminar.
