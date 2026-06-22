# FIT COACH - Checklist final

## 1. Supabase

Para a base que já está funcionando, execute somente:

- `supabase_cpf_aluno.sql`

Em uma instalação nova, o arquivo `supabase_pre_lancamento.sql` já inclui as atualizações de aluno transferido e CPF.

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
3. Cadastre um aluno novo e confirme o código.
4. Entre como aluno em janela anônima.
5. Aceite o consentimento e envie a anamnese.
6. Cadastre outro aluno marcando “Aluno já acompanhado”.
7. Confirme que ele aceita o consentimento e entra direto no portal sem nova anamnese.
8. Crie treino com vídeo, dieta, avaliação, compromisso e cobrança.
9. Envie check-in com foto e mensagem pelo portal do aluno.
10. Marque a cobrança como paga e confirme o status após recarregar.
11. Arquive o treino e a dieta de teste e confirme que saíram do portal do aluno.
12. Teste o fluxo “Esqueci minha senha”.
13. Recarregue as duas telas e confirme que os dados continuam salvos.
14. Teste no celular e no desktop.
15. Exclua os alunos de teste ao terminar.

## 4. Operação inicial

Comece com poucos coaches e alunos reais. Acompanhe diariamente:

- falhas de login;
- convites expirados;
- fotos não enviadas;
- cobranças vencidas;
- mensagens sem resposta;
- check-ins pendentes.
