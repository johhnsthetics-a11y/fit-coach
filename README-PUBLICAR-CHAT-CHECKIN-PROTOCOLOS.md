# Atualizacao: Chat, Check-ins, Protocolos e Hidratacao

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
- Nova pagina Agua para aluno e paciente, com acesso direto no menu mobile e atalho no Inicio.
- Registro diario com botoes de 250 ml, 350 ml e 500 ml, historico local e opcao de desfazer.
- Marcos de 25%, 50%, 75% e 100%, animacao de conquista e aviso no celular quando a meta e concluida.
- Experiencia responsiva e adaptada aos temas claro e escuro, sem consumo adicional do Supabase.

## Validacoes executadas

- 373 testes automatizados aprovados.
- Build de producao aprovado.
- Typecheck leve aprovado.
- Verificacao de tema aprovada.

Observacao: as notificacoes de check-in e de meta de agua usam a permissao do navegador. A comemoracao da hidratacao funciona dentro do aplicativo; push com o aplicativo completamente fechado exige infraestrutura adicional de Web Push/APNs e nao faz parte deste pacote.
