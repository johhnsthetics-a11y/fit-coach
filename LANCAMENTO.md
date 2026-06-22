# FIT COACH - Checklist final

## 1. Supabase

Para a base que já está funcionando, execute somente:

- `supabase_pre_lancamento.sql`

Depois confira no Table Editor se `workout_exercises` possui:

- `muscle_group`
- `equipment`
- `instructions`
- `video_url`

Em Authentication > URL Configuration:

- defina a URL publicada como Site URL;
- adicione a mesma URL em Redirect URLs;
- mantenha também a URL local durante os testes.

Não publique chaves `service_role`. No frontend use apenas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 2. GitHub e Cloudflare

Suba todo o conteúdo do pacote final, mantendo a pasta `src`.

Configuração:

- Build command: `pnpm run build`
- Deploy command: `pnpm dlx wrangler@4 deploy`
- Output directory: `dist`

Cadastre no Cloudflare as duas variáveis do Supabase e execute um novo deploy.

## 3. Teste antes de convidar treinadores

1. Crie uma conta de coach.
2. Preencha Configurações.
3. Cadastre um aluno e confirme o código.
4. Entre como aluno em janela anônima.
5. Aceite o consentimento e envie a anamnese.
6. Crie treino com vídeo, dieta, avaliação, compromisso e cobrança.
7. Envie check-in com foto e mensagem pelo portal do aluno.
8. Marque a cobrança como paga e confirme o status após recarregar.
9. Arquive o treino e a dieta de teste e confirme que saíram do portal do aluno.
10. Teste o fluxo “Esqueci minha senha”.
11. Recarregue as duas telas e confirme que os dados continuam salvos.
12. Teste no celular e no desktop.
13. Exclua o aluno de teste ao terminar.

## 4. Operação inicial

Comece com poucos coaches e alunos reais. Acompanhe diariamente:

- falhas de login;
- convites expirados;
- fotos não enviadas;
- cobranças vencidas;
- mensagens sem resposta;
- check-ins pendentes.
