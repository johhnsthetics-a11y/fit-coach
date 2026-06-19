# FitCoach - Checklist de lancamento

## Supabase

1. Execute todos os arquivos SQL entregues, incluindo:
   - `supabase_coach_settings.sql`
   - `supabase_student_portal_secure.sql`
   Execute exatamente nessa ordem.
2. Em Authentication > URL Configuration, configure a URL publicada.
3. Mantenha apenas a chave publica `anon` no frontend.
4. Nunca publique a `service_role`.

## Primeira configuracao

1. Entre como treinador.
2. Abra Configuracoes e preencha marca, nome profissional, CREF, WhatsApp e email.
3. Cadastre um aluno real de teste.
4. Crie treino, dieta, avaliacao, cobranca e compromisso.
5. Gere um convite e teste em uma janela anonima.
6. Aceite o consentimento do aluno.
7. Envie check-in, mensagem e conclusao de treino pelo portal do aluno.

## Publicacao

O projeto esta preparado para Vercel ou Netlify.

Variaveis obrigatorias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Comandos:

- Desenvolvimento: `npm run dev`
- Build: `npm run build`
- Previa: `npm run preview`

## Operacao inicial

Comece com um grupo pequeno de treinadores e alunos. Valide diariamente:

- novos cadastros;
- convites;
- uploads de check-in;
- mensagens;
- cobrancas;
- agenda;
- avaliacoes e graficos.
