# Chat, check-ins e protocolos

## Objetivo

Corrigir o seletor de fundo do chat e a saudação duplicada, permitir que o profissional defina a próxima data de check-in e tornar a organização de protocolos consistente entre desktop e mobile.

## Implementação

- Integrar o acionamento do wallpaper ao cabeçalho React e manter a persistência existente.
- Manter uma única saudação temporal na área do aluno/paciente.
- Reutilizar `students.next_checkin` com data ISO, mostrar prazo e estado no portal e emitir aviso local deduplicado quando vencer.
- Exibir status textual nos protocolos, confirmar alterações antes de trocar o estado visível e compactar filtros/ações no mobile.
- Validar com testes direcionados, suíte principal, typecheck e build.
