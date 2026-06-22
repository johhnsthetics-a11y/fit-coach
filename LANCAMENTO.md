# FIT COACH - Checklist final

## 1. Supabase

Para a base que já está funcionando, execute:

- `supabase_cpf_aluno.sql`
- `supabase_assinatura_coach.sql`

Em uma instalação nova, o arquivo `supabase_pre_lancamento.sql` já inclui aluno transferido, CPF e ciclo individual da assinatura.

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

Quando o checkout da assinatura estiver pronto, cadastre também:

- `VITE_FITCOACH_BILLING_URL`

O valor final deve ser recalculado no servidor do checkout antes da cobrança. A tela do app apresenta uma estimativa transparente, mas não deve ser usada como única fonte para debitar o treinador.

Regra comercial configurada no app:

- primeiro mês: `R$ 9,90`, com taxa de manutenção totalmente isenta;
- meses seguintes: `R$ 49,90` mais `2%` sobre o valor mensal dos planos dos alunos ativos cadastrados;
- o fechamento deve apresentar o cálculo por aluno antes do pagamento.

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
