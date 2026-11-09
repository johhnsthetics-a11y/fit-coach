# BUILD35 — celebração de XP após avaliação

## Decisão de produto

**Modo: Redesign · Preserve, extensão pontual.** A sessão real continua concedendo e persistindo XP uma única vez ao concluir o treino. A celebração fullscreen é uma confirmação visual posterior, acionada somente depois que a avaliação por estrelas foi confirmada pelo fluxo real de salvamento. O total mostrado vem exclusivamente de `completedLog.xpAwarded`; valor zero não gera prêmio visual.

## Preservar / melhorar / remover

- **Preservar:** as cinco telas e a sequência de treino, o envio 1–5 estrelas, o cálculo/registro real de XP, ranking, histórico, notificação ao treinador e todos os contratos de sincronização existentes.
- **Melhorar:** criar um único momento de celebração em tela cheia, com a avaliação salva visível, total real de XP, ação clara para continuar, foco acessível, Escape e suporte a tema claro/escuro e `prefers-reduced-motion`.
- **Remover:** nenhuma função existente; impedir apenas a duplicação visual do toast de XP do treino durante a etapa de avaliação.

## Direção visual

Tela de recompensa do aluno em celular: breve, celebratória e focada em um único dado real. Mantém Plus Jakarta Sans e os tokens oficiais Coach Fit Pro: teal `#4EE9D0` no tema escuro e `#087F72` no claro, com superfícies e textos oficiais do respectivo tema. Animação curta de entrada e contagem do XP, sem partículas ou dados decorativos que pareçam métricas reais; movimento reduzido remove a coreografia, não o conteúdo.

Dials para esta extensão: variação 3/10, movimento 4/10, densidade 1/10, dependência de assets 1/10, fidelidade à marca 10/10.

## Contratos protegidos e risco

Nenhuma mudança a Supabase, StoreKit, preços, assinaturas, migrations, ledger de XP, dados do ranking, fluxo de conclusão ou telas fora de treino. A prévia continua sem gravação e sem celebração. A única integração é no retorno confirmado da avaliação já existente; falha de gravação não abre a celebração. Risco principal: mostrar valor divergente do registro real; mitigação: usar apenas o delta `xpAwarded` já calculado no resumo e não criar nova escrita ou concessão. Reversão: remover overlay, estado e folha CSS BUILD35, mantendo intacta a persistência atual.
