# Organização de Protocolos

## Objetivo

Dar a treinadores e nutricionistas uma rotina simples para planejar, acompanhar e registrar as ações que precisam executar com cada aluno ou paciente, sem depender de planilhas. A feature complementa a Agenda existente sem misturar tarefas com compromissos.

## Experiência

- A página Agenda ganha duas abas: **Compromissos** e **Organização de Protocolos**. O fluxo atual de compromissos e sua visualização pelo aluno permanecem iguais.
- A nova aba organiza tarefas por data, com navegação por dia e semana, contadores de pendentes/concluídas e filtros por pessoa, categoria, prioridade e status.
- Cada tarefa tem título, categoria (Treino, Nutrição, Acompanhamento ou Geral), data, prioridade, aluno/paciente opcional, observações e status (Pendente, Em andamento, Concluída ou Cancelada).
- O profissional pode criar, editar, concluir, reabrir e excluir tarefas. Alterações só são consideradas concluídas após confirmação do Supabase; falhas preservam a edição local no formulário e exibem erro recuperável.
- O PDF exporta as tarefas do período/filtros selecionados, identifica profissional, período e pessoa vinculada, e é gerado no navegador com o padrão imprimível já usado pelo app. Nenhum PDF ou anexo é guardado no Supabase.
- A lista carrega ao abrir a aba; cada gravação atualiza o painel local depois do sucesso remoto. Um comando de atualizar permite buscar mudanças feitas em outra sessão. Não haverá polling contínuo nem inclusão de tarefas no portal do aluno.

## Dados e segurança

Criar `public.coach_protocol_tasks` com UUID, `coach_id`, `student_id` opcional, título, categoria, data planejada, prioridade, observações, status e timestamps. `coach_id` referencia `public.users(id)` e é obrigatório; `student_id` referencia `public.students(id)` com `ON DELETE SET NULL`, preservando a tarefa se o cadastro do aluno for removido. Categorias aceitas: `training`, `nutrition`, `follow_up`, `general`; prioridades: `low`, `normal`, `high`; status: `pending`, `in_progress`, `done`, `canceled`. Índices por profissional/data e profissional/aluno/data dão suporte às consultas da agenda.

RLS fica habilitada. Operações autenticadas são limitadas a `coach_id = auth.uid()`; policies de inserção e atualização verificam `WITH CHECK` que o aluno vinculado pertence ao mesmo coach, com `USING` equivalente para leitura/alteração e exclusão. `coach_id` não pode ser alterado pelo cliente. Não se criam policies públicas nem acesso de leitura para alunos. A tabela guarda somente texto e datas, sem imagens ou arquivos.

## Arquitetura

- Um componente isolado para Organização de Protocolos, montado dentro da tela Agenda.
- Funções explícitas de listar, salvar e excluir no `supabaseApi.js`, reaproveitando a autenticação e o tratamento de erros existente.
- Migração SQL idempotente para tabela, índices, RLS, grants e policies.
- Integração pequena no `App.jsx`: preservar `Agenda` e adicionar a aba/componente, com os alunos e o identificador do profissional atual.
- Sem nova dependência. O PDF usa a janela de impressão do navegador.

## Estados e validação

A tela deve tratar carregamento, erro com nova tentativa, lista vazia, ausência de alunos, salvamento e exclusão. Validar título e data; impedir vínculo a aluno de outro coach também no banco. Datas são apresentadas no fuso local. O conteúdo do PDF respeita filtros e intervalo atualmente selecionados.

Validar conversão de dados, segurança de isolamento entre profissionais, operações CRUD e exportação. Executar a suíte de testes focada e o build. O deploy e a aplicação da migração no projeto Supabase de produção não fazem parte desta implementação local.

## Fora de escopo

Não alterar compromissos existentes, prescrições de treino/dieta, tarefas automáticas da Visão geral ou portal do aluno. Não criar recorrência, anexos, notificações automáticas ou colaboração entre profissionais nesta primeira versão.
