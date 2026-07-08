# Biblioteca de exercicios com videos

## O que esta atualizacao faz

- Cria uma tabela `exercise_library` no Supabase para armazenar a ficha de cada exercicio.
- Cria o bucket `exercise-library-videos` para videos padrao da biblioteca.
- O coach continua podendo subir video proprio em um treino especifico.
- Se o exercicio tiver video na biblioteca, o aluno assiste dentro do app.
- Se ainda nao tiver video, o app mostra uma ficha tecnica com musculo-alvo e orientacao.

## Como alimentar os videos

1. Rode o SQL `supabase_exercise_library.sql` no Supabase.
2. No Supabase, va em Storage.
3. Abra o bucket `exercise-library-videos`.
4. Envie o video do exercicio em MP4 ou WebM.
5. Copie a URL publica do arquivo.
6. Atualize o exercicio no SQL Editor:

```sql
update public.exercise_library
set video_url = 'COLE_A_URL_PUBLICA_DO_VIDEO_AQUI'
where name = 'Supino reto com barra';
```

## Observacao importante

Para o aluno ver video sem sair do app, o campo `video_url` precisa ser:

- URL publica de MP4/WebM do Supabase Storage; ou
- link incorporavel, como YouTube/Vimeo, caso voce queira usar temporariamente.

O caminho mais profissional e manter os videos proprios no Supabase Storage.

