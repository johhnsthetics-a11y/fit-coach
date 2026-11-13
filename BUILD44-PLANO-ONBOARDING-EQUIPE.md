# BUILD44 — Onboarding de convite da Equipe

## Objetivo e interpretação

Melhorar a entrada de um profissional convidado por e-mail, de modo que ele conclua o cadastro com o mesmo endereço e especialidade definidos no convite, veja o espaço profissional coerente com treinador/nutricionista e possa contratar o plano profissional para desbloquear as ferramentas próprias. “Virar cliente” é interpretado aqui como o profissional convidado tornar-se assinante do plano profissional — não como converter a conta em aluno/paciente.

## Comportamento solicitado

1. O convite continua sendo validado pelo servidor para o e-mail exato, papel profissional correspondente, estado pendente e validade do convite.
2. No login/cadastro vindo do convite, a tela mostra o e-mail de destino e o papel definidos pelo convite; o papel não pode ser trocado nessa jornada. O e-mail pode ser pré-preenchido usando somente o contexto mínimo do convite.
3. Se a confirmação de e-mail for necessária, o retorno preserva o identificador e a especialidade do convite. A pessoa recebe orientação para confirmar e depois entrar com o mesmo e-mail, sem perder a Equipe.
4. O aceite do convite continua explícito. A assinatura não remove nem substitui equipes, membros ou delegações já existentes.
5. Um membro sem assinatura vê na Equipe um caminho claro para contratar o plano profissional. Depois da confirmação, a tela de ativação informa que aguarde enquanto dados próprios e contexto das equipes são sincronizados; em seguida, abre as ferramentas próprias da especialidade da conta.

## Implementação e estrutura existente

- `src/App.jsx`: formulário de entrada por convite, roteamento para Equipe, chamada de validação e transição de ativação.
- `src/supabaseApi.js`: consulta autenticada/anonimamente segura do contexto mínimo do convite e normalização do resultado.
- `supabase/migrations/20261112213600_team_invite_signup_context_build44.sql`: RPC aditiva, identificada apenas pelo UUID do convite, que retorna e-mail, papel, equipe e validade de convites pendentes; nunca retorna lista de pacientes.
- `scripts/product-database.test.mjs` e `scripts/professional-team-build41.test.mjs`: regressões de RPC, e-mail/papel exatos, contexto expirado/aceito, navegação e confirmação.
- `AppLoading` existente será reutilizado com textos específicos de ativação, evitando uma identidade visual ou sistema paralelo.

## Direção visual

Extensão do Coach Fit Pro existente: fundo preto no dark, superfícies e contornos discretos, acento verde/menta, tipografia e componentes já usados no login/Equipe. A ativação é uma tela enxuta com marca existente, estado acessível de carregamento e instrução clara; sem novas animações pesadas ou marketing no meio do fluxo.

## Limites e contratos protegidos

Não alterar preços, IDs de produtos, StoreKit, permissões comerciais, fonte de entitlement, RLS/gates de dados, escopo de delegação, consentimento do aluno, papel da conta ou cadastro de pacientes. Após assinatura, liberar as ferramentas próprias do papel profissional atual; Treinos para nutricionista continua condicionado às regras de delegação existentes. Não aplicar migration em Supabase, publicar, enviar ao TestFlight nem executar workflow.

## Risco operacional

A nova pré-carga do convite depende de uma migration ainda não aplicada. Se a RPC estiver indisponível, o formulário poderá continuar recebendo o e-mail manualmente e a validação de cadastro existente continua sendo a autoridade; o convite jamais será aceito sem a conta autenticada e a validação server-side existentes. A migration deve ser aplicada primeiro em staging e testada antes de qualquer release.
