# Indicacoes profissionais e comissao de afiliados

## Objetivo

Permitir que um treinador ou nutricionista afiliado indique novos profissionais para o Coach Fit Pro e receba 50% de comissao sobre cada pagamento profissional confirmado, independentemente de o plano ser mensal, semestral ou anual.

O fluxo existente de comissoes sobre alunos e pacientes continua funcionando sem alteracao de regra. As duas origens de comissao permanecem separadas no banco e aparecem consolidadas, com detalhamento, nas interfaces do afiliado e do Admin Master.

## Regras comerciais

- A comissao profissional corresponde a 50% do valor efetivamente confirmado pela Cartpanda.
- A mesma porcentagem vale para planos mensais, semestrais e anuais.
- Cada renovacao confirmada tambem gera comissao.
- Pagamentos pendentes ou falhos nao geram comissao.
- Reembolso e chargeback retiram o lancamento dos totais, preservando o historico para auditoria.
- Um webhook repetido nao pode gerar um segundo lancamento.
- Uma conta profissional que ja possui assinatura ativa antes da indicacao nao pode ser atribuida retroativamente.
- Um e-mail profissional pode pertencer a apenas uma indicacao vigente. A primeira indicacao valida impede atribuicoes concorrentes.

## Fluxo do afiliado

1. O afiliado abre `Comissoes` e acessa `Cadastrar Treinador/Nutricionista`.
2. Informa o e-mail do profissional e seleciona `Treinador` ou `Nutricionista`.
3. O backend valida que a conta atual e um afiliado ativo, normaliza o e-mail e cria uma indicacao com token aleatorio.
4. O aplicativo exibe um link no dominio oficial, com acoes para copiar e compartilhar.
5. O convidado abre o link e entra ou cria a conta usando exatamente o e-mail indicado.
6. O backend confirma que o token, o e-mail autenticado e o tipo profissional sao compativeis e vincula a conta a indicacao.
7. O profissional segue para a ativacao ja existente e escolhe o plano mensal, semestral ou anual.
8. A Cartpanda confirma o pagamento pelo webhook existente.
9. O webhook atualiza a assinatura profissional e registra um lancamento idempotente de comissao de 50% para o afiliado correto.
10. Os relatorios do afiliado e do Admin Master passam a exibir o pagamento confirmado.

## Modelo de dados

### `affiliate_professionals`

Adicionar `professional_type`, limitado a `trainer` ou `nutritionist`. Esse campo representa o tipo do proprio afiliado cadastrado pelo Admin Master e permite que o seletor solicitado seja persistido antes mesmo de a conta ser localizada em `users`.

Dados existentes serao preenchidos pelo papel encontrado em `users`; quando nao houver correspondencia, o valor seguro padrao sera `trainer` ate o Admin Master revisar o cadastro.

### `affiliate_professional_referrals`

Tabela de atribuicao entre afiliado e profissional indicado:

- `id` UUID;
- `affiliate_id` referenciando `affiliate_professionals`;
- `affiliate_email` normalizado para preservar historico;
- `referred_email` normalizado;
- `professional_type` (`trainer` ou `nutritionist`);
- `invite_token_hash`, sem armazenar o token aberto;
- `status` (`pending`, `claimed`, `converted`, `canceled`);
- `referred_user_id`, preenchido depois da validacao autenticada;
- `claimed_at`, `converted_at`, `created_at` e `updated_at`.

Deve existir unicidade para impedir duas indicacoes vigentes do mesmo e-mail. O token aberto sera mostrado somente na resposta de criacao e nao sera recuperavel posteriormente; o afiliado podera cancelar e gerar uma nova indicacao quando necessario.

### `affiliate_professional_payments`

Livro-caixa das comissoes sobre assinaturas profissionais:

- `id` UUID;
- `referral_id`;
- `affiliate_id` e `affiliate_email`;
- `referred_user_id`;
- `webhook_event_id` unico;
- `provider_order_id` e `provider_subscription_id`;
- `plan_cycle` e identificacao do produto quando disponiveis;
- `gross_amount_cents` com o valor efetivamente confirmado;
- `commission_rate` fixado em `0.5000` no lancamento;
- `commission_cents` calculado a partir do valor confirmado;
- `status` (`paid`, `refunded`, `chargeback`);
- datas de pagamento, reversao, criacao e atualizacao.

O valor e a taxa sao gravados em cada lancamento para manter o historico correto caso a regra comercial mude no futuro.

## Backend e seguranca

### Criacao da indicacao

Uma RPC autenticada cria a indicacao. Ela deve:

- resolver o afiliado a partir de `auth.uid()` e do e-mail da conta autenticada;
- confirmar que o afiliado esta ativo;
- validar e normalizar o e-mail indicado;
- validar o tipo profissional;
- impedir autoindicacao;
- impedir captura de profissional com assinatura ja ativa;
- impedir conflito com outra indicacao vigente;
- gerar token criptograficamente aleatorio e armazenar apenas seu hash;
- retornar o token aberto uma unica vez para montagem do link oficial.

### Reivindicacao da indicacao

Uma segunda RPC autenticada recebe o token aberto. Ela deve:

- comparar o hash do token;
- exigir que o e-mail autenticado seja igual ao e-mail indicado;
- validar que o papel escolhido no cadastro seja compativel;
- impedir reivindicacao de outra conta;
- persistir `referred_user_id` e marcar a indicacao como `claimed`.

O frontend pode preservar temporariamente o token durante login/cadastro, mas a autorizacao nunca depende apenas do navegador ou da URL.

### RLS

- Afiliados podem criar, listar e cancelar somente suas proprias indicacoes por RPC.
- Afiliados podem consultar somente seus proprios lancamentos por RPC de relatorio.
- O Admin Master continua sendo o unico usuario com acesso ao relatorio financeiro consolidado.
- As tabelas nao terao escrita direta para `anon` ou `authenticated`.
- O webhook usa a credencial de servidor somente na Edge Function; nenhum segredo chega ao frontend.
- Funcoes privilegiadas verificam `auth.uid()` internamente, fixam `search_path` e recebem grants minimos.

## Integracao Cartpanda

O webhook `cartpanda-webhook` continuara como fonte de verdade.

No caminho de pagamento profissional confirmado, depois de identificar o usuario e atualizar `coach_subscriptions`, o webhook procura uma indicacao `claimed` daquele usuario. Quando encontrada:

- valida que o afiliado segue ativo;
- usa o valor realmente confirmado pela Cartpanda;
- calcula `commission_cents` como 50% do valor bruto em centavos;
- insere em `affiliate_professional_payments` com conflito ignorado por `webhook_event_id`;
- marca a indicacao como `converted` na primeira confirmacao.

Nos eventos de reembolso ou chargeback, o webhook localiza o lancamento por pedido ou assinatura e altera o status sem apagar o registro. Eventos atrasados nao podem reativar um pagamento terminal nem duplicar comissao.

Se o payload nao possuir valor monetario confiavel, o webhook atualiza a assinatura, registra o erro de comissionamento para auditoria e nao inventa um valor de comissao.

## Frontend do afiliado

A pagina `Comissoes` mantera um unico cabecalho e recebera:

- totais consolidados de comissao;
- separacao visual entre `Alunos/Pacientes` e `Profissionais indicados`;
- quantidade de indicados, convertidos e pagamentos confirmados;
- lista de treinadores/nutricionistas indicados com e-mail, tipo, status, plano, ultimo pagamento, valor pago e comissao;
- formulario `Cadastrar Treinador/Nutricionista` com e-mail obrigatorio, seletor de tipo, botao de gerar acesso, copiar link e compartilhar;
- exportacao PDF contendo as duas origens de comissao;
- estados de carregamento, vazio, erro e conflito de atribuicao.

O link usara o dominio oficial do aplicativo e um parametro opaco. A pagina de ativacao e os cards de planos existentes serao reutilizados sem criar um segundo checkout.

## Admin Master

### Cadastro de Afiliados

O formulario passa a exigir a escolha `Treinador` ou `Nutricionista` antes de `Vincular profissional`. A lista persiste e mostra o tipo selecionado mesmo quando a conta profissional ainda nao existe.

Quando a conta ja existir, uma divergencia entre o tipo selecionado e o papel real deve ser informada ao Admin Master em vez de ser corrigida silenciosamente.

### Financeiro de Afiliados

Cada afiliado exibira, separadamente:

- alunos/pacientes trazidos e pagantes;
- treinadores/nutricionistas indicados e pagantes;
- pagamentos por origem;
- receita confirmada por origem;
- comissao de 25% sobre alunos/pacientes;
- comissao de 50% sobre profissionais;
- total consolidado.

Ao expandir o afiliado, o Admin Master podera consultar cada profissional indicado, tipo, plano, valor pago, comissao, pedido, assinatura e data. CSV e PDF incluem os novos lancamentos sem misturar suas taxas.

## Relatorios

As RPCs `get_my_commission_report` e `get_affiliate_finance_report` serao estendidas de forma compativel. Os campos existentes permanecem para nao quebrar o frontend publicado. Novos blocos identificarao explicitamente:

- `studentCommissions`;
- `professionalCommissions`;
- totais separados por origem;
- total consolidado.

## Tratamento de casos limites

- E-mail diferente do convite: bloquear reivindicacao e manter indicacao pendente.
- E-mail ja indicado por outro afiliado: bloquear nova indicacao e informar conflito sem revelar dados do outro afiliado.
- Conta ja pagante: bloquear atribuicao retroativa.
- Link perdido: permitir cancelar a indicacao pendente e gerar outra.
- Webhook antes da volta ao aplicativo: o backend registra normalmente e a tela atualiza na proxima sincronizacao.
- Webhook repetido: a chave unica impede duplicacao.
- Reembolso ou chargeback: o valor deixa os totais, mas permanece no historico.
- Afiliado desativado: nao pode criar novas indicacoes e novos pagamentos nao geram comissao enquanto estiver inativo.

## Compatibilidade e rollout

- Nenhum dado atual de comissao de alunos/pacientes sera migrado para as novas tabelas.
- As novas migrations serao aditivas e nao destrutivas.
- A Edge Function sera publicada somente depois das migrations.
- O frontend sera publicado depois de RPCs e webhook estarem disponiveis.
- O cadastro administrativo existente recebera backfill de tipo profissional.

## Validacao

Os testes devem comprovar:

- criacao de indicacao apenas por afiliado ativo;
- isolamento entre afiliados;
- token opaco e validacao por hash;
- e-mail e tipo obrigatorios;
- bloqueio de conflito e autoindicacao;
- reivindicacao pelo usuario correto;
- bloqueio de conta ja pagante;
- comissao de 50% para mensal, semestral e anual;
- renovacao gerando novo lancamento;
- webhook duplicado sem duplicacao;
- reembolso e chargeback retirando valores dos totais;
- relatorios do afiliado e Admin Master com separacao e consolidado;
- seletor de tipo no Cadastro de Afiliados;
- link oficial e responsividade das novas interfaces;
- testes, lint, typecheck e build de producao.
