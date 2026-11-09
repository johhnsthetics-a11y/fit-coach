# Coach Fit Pro — BUILD34

BUILD34 refina a experiência existente de treino do aluno, baseada no fluxo Figma da BUILD33. O foco foi tornar os controles mais fáceis de reconhecer e tocar, reduzir mensagens sem informação, orientar o retorno do descanso e melhorar a composição entre celular, tablet e desktop.

## O que mudou

- Ícones de navegação/edição/play-pause/confirmação/info usam SVG do sistema existente e rótulos acessíveis.
- Alvos de toque: 44×44 px para edição e 48 px de altura para controles do descanso.
- Feedback antigo é limpo ao iniciar sessão nova; erro não fica atrás da barra fixa.
- Ao terminar descanso, o retorno ao exercício leva ao contêiner útil no mobile, respeita movimento reduzido e não altera a prévia.
- A largura adapta-se a mobile/tablet/desktop sem ampliar indevidamente a prévia embutida do treinador.
- Tema claro e escuro mantêm tokens Coach Fit Pro. Sem novas dependências.

## Validação executada

- Suíte integral: 495/495.
- Regressões focadas de preview, sessão, fluxo e rating: 23/23.
- Typecheck e lint/theme smoke: passaram; alinhamento canônico 6/6.
- Teste de assinatura/StoreKit: 50/50.
- Build web Vite: concluído.
- Browser cloud: percurso completo da prévia — visão geral, execução, descanso, exercício concluído e resumo — medido em 320/390/768/1280 px, sem overflow horizontal; tema claro conferido a 320 px.
- A prévia deixou contadores de gravação/conclusão/encerramento/rating em zero e não escreveu no localStorage.

## Handoff

- Identificador do app e build iOS avançados para BUILD34; versão comercial 1.0 preservada.
- O workflow iOS continua com `verify` como operação padrão e `build_number` 34 por padrão. Upload só deve ocorrer quando o usuário selecionar explicitamente a operação de TestFlight.
- Não foram executados `cap sync`, archive Xcode, workflow GitHub, TestFlight, deploy ou push.
- A fixture de configuração pública usada nos testes/build foi removida; o diretório `dist` também é removido do ZIP-fonte.

Consulte `AUDITORIA-BUILD34-ENTREGA.md` para a lista de arquivos alterados, contratos preservados e evidências detalhadas.