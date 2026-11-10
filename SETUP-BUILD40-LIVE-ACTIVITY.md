# BUILD40 — descanso acompanhado em segundo plano

## O que esta fonte implementa

Durante o descanso real do aluno, o app iOS sincroniza um horário final absoluto com uma Live Activity nativa. Em aparelhos e versões compatíveis, ela mostra a contagem na Tela Bloqueada e, quando disponível, na Dynamic Island. O app também agenda um alerta local para o fim do descanso. Pausar cancela o alerta pendente; retomar ou ajustar o tempo sincroniza a nova deadline. Ao sair do estado de descanso, a atividade nativa é encerrada.

A sessão continua usando a fonte de verdade existente. O deadline é guardado localmente por aluno/treino para reconciliar o contador quando o app volta ao primeiro plano. Prévia do treinador e execução web não criam atividades, alertas nem snapshots persistidos. Esta funcionalidade não requer migration, Supabase ou um novo envio APNs para cada segundo: o timer da Live Activity é renderizado pelo próprio iOS a partir da data final, e o alerta é local.

## Permissões e compatibilidade

- Live Activities dependem do suporte do iOS e da preferência do usuário; a extensão está configurada a partir do iOS/iPadOS 16.1. A propriedade `ActivityViewContext.isStale` só existe a partir do iOS/iPadOS 16.2 e está protegida por verificação de disponibilidade. A Dynamic Island só aparece em dispositivos que a oferecem. [Documentação Apple](https://developer.apple.com/documentation/WidgetKit/ActivityViewContext/isStale)
- O alerta local depende da autorização de notificações. A solicitação é contextual, na tela de descanso. Se a permissão já tiver sido negada, o aluno recebe um atalho para Ajustes.
- Em iOS 15, com Live Activities desativadas ou sem suporte, o cronômetro permanece na tela e o alerta local funciona quando autorizado.
- Se o aluno não autorizar notificações, o app não deve prometer um alerta; o texto de estado explica a limitação. O preview continua explicitamente sem efeitos nativos.

## Configuração necessária para assinatura iOS/TestFlight

A BUILD40 acrescenta o target `CoachFitRestActivityExtension`, com Bundle Identifier `br.com.coachfitpro.ios.restactivity`. O perfil atual do app principal não assina automaticamente esse novo target. Antes de uma operação assinada de TestFlight:

1. Crie/registre na Apple Developer Account o App ID explícito `br.com.coachfitpro.ios.restactivity` para a extensão WidgetKit.
2. Gere um provisioning profile de distribuição para esse App ID, associado ao certificado Apple Distribution utilizado pelo app.
3. Cadastre no GitHub Actions o secret `IOS_REST_ACTIVITY_PROVISIONING_PROFILE_BASE64` com o conteúdo Base64 desse profile. Mantenha também o secret existente `IOS_PROVISIONING_PROFILE_BASE64` do app principal e os demais segredos de assinatura já usados.
4. Execute primeiro `verify`, que continua sendo a operação padrão do workflow e compila sem assinatura, portanto não precisa do novo profile. Só selecione `testflight` depois que o App ID/profile da extensão e o secret estiverem configurados e a compilação de verificação passar.

O workflow valida que cada profile corresponde ao Bundle Identifier correto, mapeia os dois durante exportação e tenta limpar os arquivos temporários ao terminar. O pipeline/GitHub não foi executado nesta entrega.

## Validação em dispositivo antes de declarar o recurso pronto para produção

Esta entrega é fonte preparada, não um archive iOS. Ainda é necessário compilar no runner macOS/Xcode e testar em um iPhone físico: iniciar descanso, sair do app, pausar/retomar, ajustar o tempo, pular descanso e verificar o alerta na hora prevista com as permissões concedidas e negadas. A extensão WidgetKit, as permissões do aparelho e a entrega do alerta não puderam ser exercitadas neste Sandbox Linux.

A notificação já existente ao treinador quando o aluno salva a conclusão do treino é um fluxo separado e não foi modificada por esta integração.
