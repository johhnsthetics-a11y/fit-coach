# BUILD36 — Treino do aluno: ajuste de hierarquia e ergonomia

## Direção

**Preserve:** manter os cinco estados do treino do aluno e os componentes existentes, com intervenções concentradas no resumo da aba, na execução de séries, no rating e na paleta clara. A linguagem visual continua Coach Fit Pro — teal sóbrio, cartões legíveis, alvos de toque confortáveis e tipografia Plus Jakarta Sans — sem uma nova identidade ou dependências visuais.

## Preservar

- Sessões, cargas, repetições, temporizador, pausa/retomada, navegação entre exercícios, encerramento antecipado, conclusão normal, histórico, XP e ranking permanecem baseados nos registros reais existentes.
- A prévia do treinador continua local e sem gravar sessão, avaliação ou feedback, sem executar callbacks reais e sem conceder XP.
- A celebração BUILD35 permanece como confirmação visual após rating persistido; esta BUILD não calcula nem concede XP adicional.
- Assinaturas, preços, StoreKit, notificações, backend fora das migrations pontuais, e todas as áreas fora do treino do aluno permanecem protegidos.

## Melhorar

- Reduzir a pilha de cabeçalhos genéricos somente na aba Treino; o cabeçalho global do app e a navegação continuam disponíveis.
- Levar a ação principal do overview para perto do progresso, mantendo uma única ação de iniciar/continuar e preservando o acesso ao lembrete.
- Reencaixar metas de séries/repetições em telas estreitas, centralizar a ação única de registrar série e descansar acima da navegação inferior e deixar o encerramento antecipado visualmente discreto.
- Ao terminar ou pular o descanso, posicionar a próxima série atual no centro da área útil, sem foco automático no campo de carga.
- Fazer o tema claro do treino usar superfícies brancas harmonizadas, reforçar o contraste dos estados de estrelas e usar ícones sol/lua compreensíveis no alternador de tema do aluno.
- Acrescentar campo opcional de feedback abaixo das estrelas e salvá-lo atomicamente com o rating, limitado a 500 caracteres e visível junto ao registro real.
- Corrigir o qualificador PL/pgSQL obsoleto na RPC de encerramento antecipado com migration aditiva, sem alterar a barreira financeira, o wrapper público, o payload ou as migrações antigas.

## Remover

- Remover somente a duplicidade visual da mesma ação de registrar série (ação no card e barra inferior); não remover o ato de registrar nem o encerramento por imprevisto.
- Remover da aba Treino os blocos globais redundantes que repetem nome/objetivo do aluno e nome do app; eles continuam disponíveis nas demais abas.

## Dials de design

- **Hierarquia:** Treino em primeiro plano; metadados e ações secundárias abaixo ou discretas.
- **Cor:** no modo claro, fundo branco puro e cinzas/teal para separadores; no modo escuro, tokens atuais Coach Fit Pro sem alteração.
- **Feedback:** estrelas selecionadas de contraste explícito; feedback textual opcional e curto; sem estados ou valores de exemplo.
- **Movimento:** transições breves para troca de tema e rolagem suave para a próxima série; desativadas/atenuadas conforme `prefers-reduced-motion`.
- **Ergonomia:** layouts que quebram antes de cortar textos, controles de pelo menos 44 px e espaço reservado para safe area e navegação inferior.

## Integração de dados e compatibilidade

O feedback é salvo pela nova RPC `rate_student_workout_log_with_feedback`, que primeiro delega à RPC de rating existente e, na mesma transação, atualiza o campo opcional `rating_feedback` do log validado. A RPC antiga permanece disponível para versões anteriores do app. A nova migration de encerramento corrige apenas o corpo da função interna `_unchecked`; não muda a função pública protegida. Nenhuma migration é aplicada ao banco neste trabalho.
