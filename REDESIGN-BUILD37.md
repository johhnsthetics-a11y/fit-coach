# BUILD37 — Ajustes finais de ergonomia do treino do aluno

## Direção Preserve

Manter o fluxo e os dados da BUILD36, alterando apenas as interações pedidas: ação por série, descanso, encerramento discreto, seletor de dias, toggle superior, estrelas e painel de exercício. A identidade permanece Coach Fit Pro, com layout responsivo e leitura clara em tema claro/escuro.

## Preservar

- Registros reais de série, carga, repetições; descanso com pausa/retomada e pulo; conclusão normal e antecipada; histórico, rating, feedback, XP e ranking.
- Prévia sem gravação real, sem callbacks reais e sem XP; a celebração continua apenas pós-rating salvo e baseada em XP real positivo.
- Ícones, cores de marca, safe area, navegação inferior e seleção real dos dias que já existem no plano. Não inventar datas de calendário quando o plano só traz nomes de dias.
- StoreKit, preços, assinaturas, notificações, persistência e migrations da BUILD36 permanecem intocados.

## Alterar

- Remover a barra suspensa com “Registrar série e descansar”/“Encerrar sessão”; restaurar a ação “Concluir série” dentro do card da série.
- Expor apenas “Encerrar treino” de forma pequena e discreta no cabeçalho de execução; conservar diálogo de confirmação e encerramento real.
- Remover o lembrete de treino desta tela.
- Restaurar o toggle de tema ao lado do chat no cabeçalho mobile.
- Usar amarelo dourado legível nas estrelas selecionadas nos dois temas.
- Reposicionar o seletor de dias logo abaixo do cabeçalho como painel responsivo recolhível com chevron; remover o calendário que abria conteúdo distante.
- Mover “Pular descanso” para logo após o temporizador, mantendo pausa e ajuste do timer.
- Harmonizar o painel nome/instrução/vídeo no tema claro, com texto legível e largura fluida.

## Risco e fallback

O risco principal é a remoção do action bar não deixar nenhuma forma de registrar a série ou encerrar sessão. O botão por série mantém a chamada existente a `completeSet`; a ação discreta mantém a confirmação existente. Se os dias do plano não contiverem datas reais, exibir somente o valor existente (`day`) e foco, sem derivar datas do calendário.
