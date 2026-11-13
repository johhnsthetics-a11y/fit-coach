# BUILD45 — Plano de auditoria e correções de interface

## Modo e leitura do design

**Modo:** Redesign · Preserve. **Público:** treinadores, nutricionistas e alunos. **Linguagem visual:** produto fitness operacional com acabamento premium, hierarquia objetiva e energia controlada. **Dials:** variação visual 2/10 (mudanças locais), movimento 3/10 (microtransições úteis), densidade igual à existente, dependência de assets igual à existente, fidelidade de marca 10/10.

## Preservar

Manter logo e assets existentes, Plus Jakarta Sans, cores preto/menta e temas claro/escuro. Preservar navegação e papéis, dados reais, chaves de persistência, fluxo de sessão/descanso/XP/avaliação, convites e consentimentos, e todos os contratos de assinatura, preços, StoreKit, checkout, autorização, backend e Supabase.

## Melhorar

Remover o default de 10 repetições em exercícios novos, separar visualmente a meta prescrita do que o aluno registrou, reconhecer o treino de hoje somente quando o próprio rótulo do dia corresponder de forma única ao dia da semana local, e evitar gravar ou iniciar uma sessão por mera sugestão. Expandir a biblioteca local apenas com nomes que não duplicam o catálogo atual por nome normalizado; reduzir aliases redundantes/ambíguos sem fundir exercícios distintos. Aplicar correções pontuais de semântica, foco, feedback e tipografia somente quando a alteração não modificar contrato de negócio, privacidade ou consentimento.

## Remover

Não adicionar números/dados fictícios, recomendações de treino/nutrição, variações biomecânicas não verificadas nem animações decorativas. Não prometer sincronização que não esteja comprovada.

## Contratos protegidos e maior risco

Preços, IDs de produtos, StoreKit, checkout, entitlement, Supabase/RLS, permissões, consentimento, autoria, notificações, dados e fluxos existentes de treino não serão alterados por conveniência visual. O risco maior é a seleção automática criar/alterar uma sessão. Fallback: se não houver rótulo de semana inequívoco, houver mais de um dia correspondente, ou existir progresso/restauração, usar o estado salvo ou manter a seleção manual. A sugestão só se torna seleção persistível após ação explícita do aluno para iniciar/abrir o dia.

## Organização

A cópia de trabalho isolada está em `work/fit-coach-main`. As notas, testes focados e documentação da auditoria permanecem na raiz dessa cópia; os originais BUILD43/BUILD44 não serão editados.