# Integracao AscendAPI / RapidAPI

## Secrets necessarios na Supabase

Em Supabase > Edge Functions > Secrets, cadastre:

```txt
ASCENDAPI_RAPIDAPI_KEY
```

Valor: sua chave `X-RapidAPI-Key`.

```txt
ASCENDAPI_RAPIDAPI_HOST
```

Valor:

```txt
edb-with-videos-and-images-by-ascendapi.p.rapidapi.com
```

## SQL necessario

Rode no SQL Editor:

1. `supabase_exercise_library.sql`
2. `supabase_ascendapi_exercise_cache.sql`

## Edge Function

Crie/deploy a funcao:

```txt
ascendapi-exercises
```

Codigo:

```txt
supabase/functions/ascendapi-exercises/index.ts
```

No `supabase/config.toml`, ela fica com:

```toml
[functions.ascendapi-exercises]
verify_jwt = true
```

## Como funciona no app

- O coach cadastra um exercicio.
- Clica em **Buscar na AscendAPI**.
- A funcao da Supabase chama a AscendAPI com a chave secreta.
- O exercicio volta com video/imagem/instrucao/musculo.
- O app salva essa ficha no Supabase para economizar o plano free.
- Se nao houver video, o app mostra ficha tecnica e botao de busca no YouTube.

