# Busca de Alunos e Construtor de Anamnese

## Objetivo

Permitir que treinadores e nutricionistas encontrem rapidamente um aluno ou paciente por nome, e-mail ou CPF e criem anamneses personalizadas, com envio imediato ou agendado. A solicitação deve aparecer como prioridade para o aluno, sem bloquear as demais ferramentas, e a resposta concluída mais recente deve alimentar automaticamente o painel de anamnese usado durante a montagem da dieta.

## Escopo

- Adicionar busca local na carteira de alunos por nome, e-mail e CPF.
- Adicionar uma seção `Anamnese` dentro da área `Alunos`/`Pacientes`.
- Permitir criar, editar e reutilizar modelos de anamnese.
- Permitir adicionar, remover, reordenar e configurar perguntas.
- Permitir envio imediato ou agendado para um aluno/paciente vinculado.
- Permitir marcar a solicitação como prioridade obrigatória, sem bloquear treino, dieta, chat ou outras áreas.
- Exibir solicitações disponíveis como prioridade no portal do aluno/paciente.
- Manter histórico de envios e respostas por aluno.
- Atualizar a anamnese canônica do aluno quando uma resposta for concluída.
- Exibir na montagem da dieta a anamnese canônica mais recente, incluindo respostas personalizadas.

Ficam fora do escopo bloqueio total do aplicativo, envio por WhatsApp, notificações push nativas e automações recorrentes de reenvio.

## Estratégia de Reutilização

O projeto já possui `nutrition_questionnaires`, `nutrition_questionnaire_assignments`, renderizador de perguntas, validação de respostas e integração com o portal do aluno. Esses componentes serão ampliados, sem criar um segundo motor de formulários.

Os modelos receberão um tipo explícito:

- `nutrition`: questionários nutricionais existentes;
- `anamnesis`: modelos de anamnese disponíveis na nova seção de Alunos.

As atribuições continuarão guardando um snapshot do modelo no momento do envio. Assim, editar um modelo depois não altera perguntas que já foram enviadas.

## Modelo de Dados

### `nutrition_questionnaires`

Adicionar:

- `questionnaire_type text not null default 'nutrition'`, limitado a `nutrition` e `anamnesis`.

Os registros existentes permanecem como `nutrition`.

### `nutrition_questionnaire_assignments`

Adicionar:

- `scheduled_for timestamptz not null default now()`;
- `priority_required boolean not null default false`.

`sent_at` continua representando quando a atribuição foi criada. `scheduled_for` determina quando ela pode aparecer para o aluno. O status existente continua `Pendente` ou `Respondido`.

O índice de atribuição pendente continua impedindo duplicação acidental do mesmo modelo para o mesmo aluno. Um novo envio do mesmo modelo enquanto houver pendência atualizará o snapshot, o horário agendado e a prioridade da atribuição existente.

### `student_anamneses`

Permanece como a fonte canônica da anamnese mais recente de cada aluno. Ao concluir uma atribuição do tipo `anamnesis`, o backend:

1. valida todas as perguntas obrigatórias;
2. conclui a atribuição e preserva suas respostas como histórico;
3. faz `upsert` em `student_anamneses` com o JSON completo de respostas;
4. atualiza as colunas padronizadas quando existirem chaves conhecidas, como peso, altura, objetivo e restrições;
5. limpa `student_update_requested_at`;
6. cria a notificação profissional de nova anamnese recebida.

O relógio e o `updated_at` do banco definem qual versão é a mais recente.

## Contratos de Backend

### Salvar modelo

O salvamento direto continua protegido por RLS e passa a enviar `questionnaire_type`. A interface da seção Anamnese lista apenas modelos do tipo `anamnesis`; a área atual de Nutrição lista apenas `nutrition`.

### Enviar ou agendar anamnese

Criar um RPC autenticado específico, `assign_student_anamnesis`, com:

- ID do modelo;
- ID do aluno;
- data/hora de disponibilidade;
- indicador de prioridade obrigatória.

O RPC valida que modelo e aluno pertencem ao profissional autenticado, exige modelo do tipo `anamnesis`, aplica snapshot e retorna a atribuição criada ou atualizada.

### Portal do aluno

O carregamento por convite retorna apenas atribuições com `scheduled_for <= now()` ou já respondidas. A interface também atualiza os dados ao recuperar foco da janela, permitindo que uma solicitação agendada apareça sem novo login quando o aluno voltar ao aplicativo.

O aluno não recebe acesso antecipado às perguntas de uma anamnese futura.

### Envio da resposta

O RPC atual de resposta será mantido por compatibilidade. Quando o snapshot for do tipo `anamnesis`, ele executará a atualização transacional da anamnese canônica e da notificação, além de concluir a atribuição.

## Interface Profissional

### Carteira

A lista de alunos recebe uma busca fixa acima dos perfis. A filtragem:

- ignora maiúsculas, minúsculas e acentos para nome e e-mail;
- compara CPF somente por dígitos;
- mostra contagem filtrada;
- mantém o aluno selecionado mesmo quando o filtro muda;
- apresenta estado vazio específico quando não houver correspondência.

### Navegação em Alunos

Adicionar duas abas no topo da área:

- `Carteira`;
- `Anamnese`.

A aba Carteira preserva ficha, acesso, cobrança, edição e anamnese manual existentes.

### Página Anamnese

A página terá três áreas responsivas:

1. **Modelos**: lista, criação, duplicação, edição e status rascunho/ativo.
2. **Editor**: título, descrição e perguntas reordenáveis.
3. **Enviar**: aluno, envio imediato/agendado, prioridade obrigatória e confirmação.

Tipos de pergunta suportados pelo renderizador existente:

- texto curto;
- texto longo;
- número;
- seleção única;
- seleção múltipla.

Cada pergunta possui enunciado, tipo, obrigatoriedade e opções quando aplicável. IDs estáveis são preservados ao editar ou reordenar.

Uma seção de histórico mostra aluno, modelo, data programada, status, conclusão e prioridade. Conteúdo futuro não é exposto ao portal do aluno antes do horário.

## Interface do Aluno/Paciente

Quando existir uma anamnese pendente e disponível:

- a Visão Geral mostra um card de prioridade acima das atividades comuns;
- o card informa profissional, título e que a resposta foi solicitada;
- o botão abre o formulário existente de questionários;
- `priority_required` altera apenas hierarquia visual e texto, sem bloquear navegação;
- após concluir, o card desaparece e a resposta fica no histórico.

Se houver mais de uma solicitação, a mais antiga disponível é apresentada primeiro e as demais permanecem acessíveis na central.

## Integração com Nutrição

O formulário de dieta continua recebendo `anamneses`, mas seleciona explicitamente a anamnese do aluno e considera seu `updatedAt`. Como `student_anamneses` é atualizado transacionalmente na conclusão, o painel flutuante passa a mostrar automaticamente:

- data da atualização;
- origem: aluno/paciente ou profissional;
- campos padronizados usados pelos cálculos;
- perguntas e respostas personalizadas da versão atual.

Nenhuma resposta pendente ou futura será usada na prescrição.

## Segurança e Integridade

- RLS continua restringindo modelos por `coach_id`.
- Atribuições permanecem sem escrita direta pelo cliente; criação e resposta passam pelos RPCs.
- O RPC profissional valida vínculo entre profissional, modelo e aluno.
- O RPC do aluno valida convite ativo, aluno, profissional, atribuição, disponibilidade e snapshot.
- Respostas têm limite de tamanho e validação de tipos/opções.
- `anon` não recebe acesso direto às tabelas.
- O `upsert` da anamnese e a conclusão da atribuição ocorrem na mesma transação.

## Compatibilidade e Migração

- Modelos e atribuições existentes recebem defaults compatíveis.
- Questionários nutricionais atuais continuam na área Nutrição e mantêm gamificação.
- O formulário manual de anamnese na ficha do aluno continua disponível.
- A API mantém nomes existentes e adiciona funções específicas, evitando quebra de chamadas antigas.
- A migration será idempotente e duplicada nas pastas `supabase/migrations` e `SUPABASE/migrations`, seguindo o padrão atual do repositório.

## Estados de Erro

- Busca sem resultado: mensagem local, sem chamada ao banco.
- Modelo inválido: destacar pergunta incompleta antes do salvamento.
- Agendamento no passado: converter para envio imediato.
- Aluno ou modelo sem vínculo: erro `42501` com mensagem profissional.
- Falha de rede: preservar rascunho do editor na tela e permitir nova tentativa.
- Resposta incompleta: manter respostas locais e destacar a primeira pergunta obrigatória.
- Falha ao atualizar anamnese canônica: reverter toda a conclusão da atribuição.

## Testes

### Modelo e interface

- busca por nome, e-mail, CPF formatado e CPF sem pontuação;
- filtro sem correspondência;
- separação entre modelos `nutrition` e `anamnesis`;
- criação, remoção, reordenação e validação de perguntas;
- seleção entre envio imediato e agendado;
- prioridade sem bloqueio de navegação;
- painel da dieta exibindo respostas personalizadas e `updatedAt`.

### Banco

- profissional não atribui modelo ou aluno de outra conta;
- atribuição futura não aparece ao aluno;
- atribuição disponível aparece ao aluno;
- resposta obrigatória incompleta falha;
- resposta válida conclui atribuição e atualiza `student_anamneses` atomicamente;
- resposta mais recente substitui a versão canônica sem apagar histórico;
- acesso anônimo direto às tabelas permanece bloqueado.

### Regressão

- questionários nutricionais atuais continuam funcionando;
- anamnese manual do profissional continua funcionando;
- portal, dieta e gamificação continuam renderizando;
- typecheck, lint, suíte completa, testes de banco e build de produção passam.

## Critérios de Conclusão

- Profissional pesquisa a carteira por nome, e-mail ou CPF.
- Profissional cria um modelo de anamnese com perguntas próprias.
- Profissional envia imediatamente ou agenda para um aluno/paciente.
- Solicitação disponível aparece como prioridade sem bloquear o aplicativo.
- Aluno responde e o profissional recebe a versão atualizada.
- A montagem da dieta mostra a anamnese concluída mais recente.
- Dados de contas distintas não se misturam.
- Fluxos existentes de questionário e anamnese continuam operacionais.
