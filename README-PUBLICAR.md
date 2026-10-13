# Coach Fit Pro - acesso gratuito para aluno/paciente

Este e um pacote incremental. Aplique-o sobre o repositorio atual do Coach Fit Pro, preservando a estrutura das pastas. Ele nao e um projeto independente.

## Destino correto

- Aplicacao: `app.coachfitpro.com.br`
- Projeto Supabase: `Coach Fit`
- Project ref: `zrlcisuuekudczkbapil`

Confirme esses dados antes de executar qualquer comando para nao alterar outro projeto ou conta.

## Ordem segura de publicacao

1. Faca backup ou commit do repositorio atual.
2. Copie os arquivos deste pacote para a raiz do projeto, mantendo exatamente as pastas `src`, `scripts` e `supabase/migrations`.
3. Instale e valide localmente:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm run test:database
pnpm run typecheck
pnpm run build
```

4. Aplique primeiro a migracao do Supabase no projeto `Coach Fit`:

```powershell
pnpm dlx supabase@latest db push
```

Como alternativa, abra o SQL Editor do mesmo projeto e execute todo o arquivo `MIGRACAO-SUPABASE-EXECUTAR.sql`.

5. Somente depois de a migracao terminar sem erros, publique o frontend:

```powershell
pnpm run deploy
```

## Validacao depois da publicacao

1. Entre no Admin Master.
2. Abra `Acessos gratuitos`.
3. Cadastre o email exato da conta de teste e selecione `Aluno` ou `Paciente`.
4. Entre nessa conta e confirme que a Fatura mostra a liberacao administrativa e saldo aplicavel zero.
5. Confirme o acesso a todas as ferramentas e a ausencia de cobranca do aplicativo e do profissional.
6. Revogue o acesso no Admin Master e confirme que o fluxo normal de pagamento volta a ser aplicado.

## Observacoes

- A liberacao usa correspondencia exata de email, normalizada para letras minusculas.
- E possivel cadastrar o email antes de a conta existir.
- Nao ha credenciais, chaves ou segredos neste pacote.
- Nao publique apenas o frontend sem aplicar a migracao: a tela dependera das novas funcoes do banco.
