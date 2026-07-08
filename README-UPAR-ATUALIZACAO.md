# Como subir esta atualização

1. Extraia o `.zip`.
2. Abra a pasta extraída.
3. Envie para o GitHub todos os arquivos da raiz e mantenha as pastas `src`, `public` e `supabase` com os arquivos dentro delas.
4. Confirme que `src/App.jsx`, `src/index.css`, `public/` e `supabase/functions/cartpanda-webhook/index.ts` continuam nas pastas corretas.
5. Aguarde o Cloudflare fazer o deploy.

## O que mudou nesta versão

- Mockups da página inicial agora mostram áreas reais do app e podem ser clicados para trazer a tela de trás para frente.
- App do aluno ganhou execução de treino com registro de carga por exercício.
- Ao concluir treino, o aluno soma XP e evolui no ranking.
- A área do aluno no painel do treinador agora mostra uma prévia mais fiel do que o aluno vê.
- Dashboard financeiro foi ajustado para os valores não quebrarem abaixo do `R$`.
- Cobranças agora puxam plano, valor e vencimento conforme o plano cadastrado pelo treinador.
- Configurações ganharam opção de cobrança automática por ciclo do plano.
- Build validado com sucesso.

## Importante

Não envie `.env`, `node_modules`, `dist` nem `_redirects` para o GitHub.
