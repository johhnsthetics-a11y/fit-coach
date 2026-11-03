# Coach Fit Pro — build 14: validação de prévia da dieta

Alterações integradas seletivamente do ZIP `CoachFitPro_BUILD14_PREVIEW_DIETA_PACIENTE.zip` sobre a branch 13 validada. **Não importar o ZIP integralmente**: ele contém versões mais antigas de StoreKit, do chat e de políticas de Storage de fotos.

## Entrega
- Prévia `NutritionStudentDietPreview` usa `StudentDietExperience` com dados do rascunho atual, incluindo nomes, porções e macros.
- Modo `previewMode` preserva o estado do paciente: não lê nem grava marcação/favoritos no `localStorage`.
- Registro de água dentro da prévia é temporário; a tela real mantém `onAddWater` e `onOpenWater`.
- PDF no preview só quando o plano permite o download.
- CSS responsivo e temas claro/escuro isolados dos cartões reais.
- Cache e `CURRENT_PROJECT_VERSION` sincronizados para iOS 1.0 (14), preservando a lógica de limpeza de caches anteriores.
- Testes de regressão de nutrição incluídos em `pnpm test`, `test:student-wellness` e verificação iOS.

## Checklist para teste em iPhone físico (TestFlight, após aprovação CI)
1. Nutricionista: abrir paciente fictício, criar rascunho e selecionar `Visão do paciente`. Confirmar nomes, gramas, horários, macros e tema.
2. Na prévia: marcar/desmarcar refeição, favoritar e adicionar água. Fechar e reabrir; confirmar que a prévia recomeça vazia, sem afetar o histórico do paciente.
3. Na conta paciente: abrir a dieta e confirmar que progresso, favoritos e hidratação anteriores permanecem intactos.
4. Alternar tema claro e escuro, testar iPhone pequeno e desktop; validar rolagem e botão de fechar.
5. Desabilitar a permissão de PDF e conferir que a prévia não mostra ação de baixar.
6. Chat: mensagens, áudios, anexos, bloqueio/desbloqueio e denúncias sem regressão.
7. Dieta: registrar foto privada de refeição e avaliação de treino, sem vazamento entre contas.
8. Plano mensal: sem aviso redundante; conferir oferta R$ 9,90 somente para Apple ID elegível, e valor real confirmado na folha de compra Apple.
9. Excluir conta de teste descartável e verificar que ela não retorna após login.
10. Confirmar ausência de erros no console, no Supabase e no TestFlight.

## Publicação
- Não reaplicar `20261103130000_student_workout_rating_meal_photos.sql` do ZIP enviado: a versão original permite acesso inseguro às fotos por caminho. A migração revisada `20261103131000` já foi aplicada anteriormente.
- Não rodar `testflight` antes de `Quality checks` e `iOS verify` terem passado, e antes de confirmar que o número 14 ainda não foi utilizado no App Store Connect.
- Nenhum deploy web ou merge automático faz parte deste PR.
