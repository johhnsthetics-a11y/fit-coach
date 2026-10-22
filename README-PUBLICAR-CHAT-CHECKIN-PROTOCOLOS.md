# Atualizacao: Chat, Check-ins e Organizacao de Protocolos

## Como publicar

1. Envie para o GitHub todos os arquivos deste pacote, mantendo exatamente as mesmas pastas.
2. Confirme o commit na branch usada para producao e abra/mescle o pull request normalmente.
3. Aguarde o deploy automatico do projeto.

## Supabase

Nao ha SQL nem migracao nova para executar. O agendamento de check-in reutiliza o campo `students.next_checkin`, que ja existe no banco.

## O que foi atualizado

- Seletor de plano de fundo do chat integrado ao cabecalho e corrigido para o layout atual.
- Botao de personalizacao profissional, com nome do fundo ativo, indicador visual e selecao acessivel.
- Presets e previews adaptados separadamente aos temas claro e escuro.
- Campo de mensagem mobile estabilizado acima do teclado, sem salto causado por `scrollIntoView`.
- Saudacao duplicada removida da area do aluno/paciente.
- Agendamento de check-in por data, com status explicito para aluno/paciente e aviso local quando vence.
- Data agendada preservada no envio do check-in e notificacao existente ao profissional mantida.
- Organizacao de Protocolos responsiva, com filtros compactos no celular, destaque de concluidos e sincronizacao mais segura.

## Validacoes executadas

- 70 testes direcionados aprovados.
- Build de producao aprovado.
- Typecheck leve aprovado.
- Verificacao de tema aprovada.

Observacao: a notificacao de vencimento e local ao navegador e aparece quando o aplicativo esta aberto ou e reaberto, desde que a permissao de notificacoes esteja ativa. Push com o aplicativo completamente fechado exige infraestrutura adicional de Web Push/APNs e nao faz parte deste pacote.
