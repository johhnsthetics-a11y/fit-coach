# Revisao do produto - 16/09/2026

## Resultado e limites

Correcoes implementadas e verificadas localmente. Esta revisao NAO certifica
producao nem aprovacao na App Store. Nao houve escrita no Supabase real.
Nao existe historico Git nesta pasta. O estado anterior foi preservado em
`__audit_backup_20260916`.

## Correcoes relevantes

- PostgreSQL: erro real 42702 em save_student_workout_session, causado pela
  ambiguidade entre parametro e coluna completion_token. Migration corretiva
  separada; conclusao transacional, idempotente e validada contra as series.
- Endpoint legado sem validacao de series teve EXECUTE revogado para clientes.
- Questionarios: persistencia remota de modelos, atribuicoes, snapshots e
  respostas, ownership, convite valido, deduplicacao e atualizacao periodica.
  Antes, salvar no servidor era um stub e atribuicoes so existiam no navegador.
- Outra e observacoes persistem; validacao, falha de envio, reenvio e rascunhos
  separados por aluno/questionario. XP de questionarios chega ao inicio do aluno.
- Sessao expirada/logout limpam o estado da conta; respostas tardias sao rejeitadas.
  Chat limpa rascunho/anexo ao trocar aluno. Historico filtra os check-ins.
- Progresso concluido vence estado atrasado. Falha de recuperacao remota nao
  autoriza autosave vazio; rascunho fica no aparelho com opcao de reconectar.
- Agenda do aluno mostra todos os compromissos futuros. Navegacao desktop e
  alternador de tema restaurados, antes ocultados por hidden !important.
- Pagamento nao confirma mensagem que falhou. PDF abre a janela corretamente.
- Cache PWA nao armazena APIs/autorizacao nem remove caches de outros aplicativos.
- Depoimentos sem origem verificavel substituidos por informacoes do produto.
  Notificacao imediata nao e mais apresentada como lembrete agendado.

## Validacao executada

- Scripts existentes typecheck (checagem leve por contratos, NAO tsc) e lint
  (theme-smoke), build Vite, 47 testes Node/React: aprovados.
- PostgreSQL PGlite, schema minimo de teste: migrations reais, ownership, convite
  de outro aluno, respostas obrigatorias, Outra, observacoes, deduplicacao,
  conclusao incompleta rejeitada, progresso atrasado e replay idempotente.
- 48 cenarios no Chrome: Treinos por menu/URL/refresh, contas vazias, dados legados,
  biblioteca, busca, favoritos, visualizar e adicionar, quatro larguras.
- 152 verificacoes no Chrome: 13 areas do profissional, 9 abas do aluno e paginas
  publicas em 320/360/390/430/768/1440 px. Sem overflow horizontal ou erro de
  console detectado. Fluxos de resposta e execucao exercitados em 390/1440 px,
  incluindo falha de envio, refresh, troca de questionario e tema claro/escuro.
- Fixtures apenas nos testes. Autenticacao real, pagamentos, uploads e todas as
  operacoes CRUD em producao NAO foram executados. Teste SQL nao e clone do banco.
- CI adicionada para typecheck/lint/testes/PostgreSQL/build em push e pull request.

## Publicacao desta atualizacao

Aplicar primeiro, em staging e depois no Supabase de destino:
1. 20260916_workout_session_integrity.sql
2. 20260916_questionnaire_sync.sql

As migrations 20260911_secure_workout_publish.sql e
20260915_workout_flow_readiness.sql sao pre-requisitos ja entregues anteriormente;
NAO reaplicar automaticamente. As copias no GitHub preservam historico e testes.
Nao executar SQL da pasta de testes: ele cria somente um banco descartavel.

Depois publicar os arquivos GITHUB mantendo os caminhos. Nao substituir a raiz
por esta pasta incremental, nao apagar arquivos existentes e nao enviar .env,
node_modules, backups ou evidencias. Configurar as variaveis Supabase no host.

## Pendencias obrigatorias antes do lancamento

- Aplicar as migrations e validar com duas contas reais de teste e dois alunos
  em staging. Schema, policies instaladas, Storage e Edge Functions reais nao
  estavam acessiveis nesta revisao. Exercitar pagamentos e uploads sem cobrancas reais.
- Implementar/deployar exclusao de conta: delete-coach-account retorna 501.
  Nao foi inventado um cascade destrutivo sem conhecer todos os relacionamentos,
  arquivos de Storage e requisitos de retencao. Incluir processo para dados do aluno.
- Validar privacidade, termos, consentimento, retencao e canal de suporte com os
  responsaveis juridico/empresarial. A exportacao nao substitui exclusao.
- Antes da App Store: projeto iOS, conta Apple, assinatura/provisionamento,
  bundle identifier, declaracoes de privacidade/permissoes e decisao sobre
  cobranca/login. O projeto atual e web/PWA; nao ha app iOS pronto para submissao.

## Recomendado / futuro

- Recomendado: testar Safari/iPhone fisico, offline/retomada, carga e alertas de
  producao; transformar typecheck/lint leves em analise estatica completa.
- Recomendado: reduzir bundle principal (~899 KB antes de gzip). Build ainda
  avisa sobre tamanho e importacao estatica/dinamica do mesmo modulo.
- Futuro: lembretes realmente agendados e melhorias de performance incrementais.

Referencias oficiais Apple para a etapa de publicacao:
https://developer.apple.com/support/offering-account-deletion-in-your-app/
https://developer.apple.com/app-store/review/guidelines/
