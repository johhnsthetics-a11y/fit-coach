# Redesign profissional do chat

Data: 2026-09-20

## Contexto

O chat atual já oferece texto, áudio, imagens/anexos suportados, histórico, papel de parede, rascunho, envio otimista e retry. A revisão do código identificou, porém, uma divisão frágil da apresentação entre React e scripts que alteram o DOM depois da renderização, além de implementações duplicadas para aluno e profissional. Isso gera conflitos de altura, cabeçalho e composer, sobretudo no mobile, e dificulta manter áudio, scroll e estados visuais consistentes.

Esta entrega redesenha somente o módulo de chat. Os contratos atuais de autenticação, mensagens, Supabase, polling, permissões e preferências de papel de parede serão preservados.

## Objetivos

- Entregar uma experiência de mensageiro profissional, rápida e intuitiva.
- Tornar o mobile a experiência principal sem prejudicar tablet e desktop.
- Preservar texto, áudio, anexos atuais, histórico, papel de parede, rascunho, envio otimista e retry.
- Unificar apresentação e comportamento compartilhados entre aluno e profissional.
- Garantir que composer, histórico e ações permaneçam acessíveis com teclado virtual, notch e viewport pequena.
- Melhorar legibilidade, hierarquia, acessibilidade, feedback de envio e tolerância a rede instável.

## Não objetivos

- Alterar schema, RLS, autenticação ou contratos Supabase nesta fase.
- Trocar polling por Realtime sem uma necessidade funcional comprovada.
- Adicionar dependência visual grande ou um editor de mensagens complexo.
- Ampliar upload para documentos genéricos enquanto as políticas de Storage não forem endurecidas.
- Copiar identidade visual de WhatsApp, Telegram, iMessage ou Messenger.

## Direções aprovadas

### Aluno no mobile

O aluno terá chat imersivo em tela cheia. A conversa ocupa a viewport disponível, com cabeçalho compacto e fixo, ação de voltar, histórico rolável e composer ancorado acima da safe area e do teclado.

### Profissional no mobile

O profissional terá chat integrado à navegação atual do aplicativo. A conversa preserva o contexto operacional, mas usa o mesmo núcleo visual e interativo do aluno.

### Desktop e tablet amplo

O chat usa duas colunas: lista de conversas à esquerda e conversa ativa à direita. A lista mostra avatar, nome, prévia da última mensagem, horário e indicador de não lida quando esses dados existirem. A conversa selecionada fica claramente destacada.

## Arquitetura de componentes

O núcleo compartilhado será composto por componentes React com responsabilidades claras:

- `ChatHeader`: contato, contexto, voltar e ações secundárias.
- `ConversationListItem`: resumo e estado de seleção da conversa.
- `MessageList`: histórico, datas, agrupamento, carregamento e controle de scroll.
- `DateSeparator`: Hoje, Ontem ou data localizada.
- `MessageBubble`: texto, horário, direção, agrupamento e estado de envio.
- `AttachmentMessage`: imagem e metadados dos anexos atualmente suportados.
- `AudioMessage`: play/pause, duração e progresso sem player HTML cru visível.
- `MessageComposer`: rascunho, crescimento automático, anexar e alternância microfone/enviar.
- `AudioRecorder`: gravação, contador, cancelar, finalizar e enviar.
- `NewMessagesIndicator`: quantidade de novas mensagens e retorno ao fim.
- `EmptyChatState`: início de conversa sem aspecto de tela abandonada.

`StudentMessagePanel`, `StudentChatScreen` e `Messages` continuarão sendo pontos de entrada dos respectivos perfis, mas delegarão a apresentação ao núcleo compartilhado. Os callbacks e serviços existentes serão adaptados, não substituídos por um fluxo paralelo.

## Fluxo de dados e estado

1. O contêiner do perfil carrega contato, mensagens, preferências e callbacks existentes.
2. O núcleo de chat recebe mensagens normalizadas e nunca consulta outro usuário por conta própria.
3. O composer mantém o rascunho por conversa e restaura seu conteúdo após reabertura ou falha.
4. O envio cria um item otimista com identificador estável e estado `sending`.
5. O retorno do serviço reconcilia esse item com a mensagem persistida, sem duplicação.
6. Uma falha preserva conteúdo e anexo local, marca `failed` e expõe retry.
7. O retry reutiliza a identidade lógica da tentativa para evitar duplicação visual.
8. O polling atual continua atualizando o histórico e reconcilia mensagens por identificador persistido.

Nenhum erro será engolido. Falhas técnicas serão registradas pelos mecanismos existentes e traduzidas na interface para feedback acionável.

## Mensagens, datas e agrupamento

- Mensagens próprias ficam à direita e recebidas à esquerda.
- A largura máxima da bolha preserva leitura confortável em qualquer viewport.
- Mensagens consecutivas serão agrupadas quando tiverem o mesmo autor, estiverem no mesmo bloco de data e próximas no tempo.
- Nome e avatar não serão repetidos sem necessidade.
- O horário terá contraste discreto, porém legível.
- O agrupamento será interrompido por mudança de autor, data ou intervalo temporal relevante.
- Divisores usarão Hoje, Ontem ou data absoluta localizada em português.
- Texto longo, links, emojis e palavras extensas quebrarão sem causar scroll horizontal.

## Scroll e novas mensagens

- A primeira abertura posiciona a conversa nas mensagens mais recentes.
- Se o usuário estiver perto do fim, novas mensagens movem o histórico suavemente para baixo.
- Se estiver lendo conteúdo antigo, a posição é preservada e aparece o indicador de novas mensagens.
- O indicador informa a quantidade disponível quando ela puder ser determinada e leva ao final ao ser acionado.
- O carregamento de mídia não deve deslocar abruptamente a leitura; imagens terão dimensões estáveis.
- O comportamento respeita `prefers-reduced-motion`.

## Composer

- O textarea cresce até uma altura máxima e passa a rolar internamente depois dela.
- Sem texto ou anexo pendente, a ação principal é o microfone.
- Com conteúdo, a ação principal muda para enviar com transição curta e não decorativa.
- Enter envia no desktop; Shift+Enter cria nova linha. No mobile, o teclado mantém comportamento natural.
- O botão de anexar abre somente os tipos já autorizados pelo fluxo atual.
- Envio em andamento impede duplicação sem bloquear a edição de uma próxima mensagem quando seguro.
- Safe area, `100dvh` e `visualViewport` serão usados de forma progressiva para manter o composer acima do teclado.

## Áudio

- A gravação preserva a implementação atual de `MediaRecorder` e compatibilidade de MIME.
- Durante a gravação, a interface mostra estado ativo, tempo decorrido, cancelar e finalizar/enviar.
- O áudio enviado aparece imediatamente como mensagem otimista.
- `AudioMessage` controla um elemento de áudio não exposto como player nativo cru e oferece play/pause, duração e progresso.
- Falha de upload preserva a tentativa para retry sem gerar mensagens duplicadas.
- O script atual de decoração de áudio será aposentado apenas quando o componente React cobrir os mesmos casos.

## Anexos e imagens

- Imagens terão preview, carregamento estável e ação clara de abrir.
- Nome, tipo e informações disponíveis serão apresentados sem URL bruta.
- A interface não prometerá formatos que o backend atual não aceita.
- Upload genérico de documentos será tratado em trabalho futuro junto com políticas de Storage específicas por usuário e conversa.

## Papel de parede e temas

- A preferência atual de papel de parede será preservada.
- Uma camada de contraste controlada garantirá legibilidade sobre imagens claras ou escuras.
- Bolhas, estados, menus, anexos e áudio terão tokens próprios para modo claro e escuro.
- A personalização continuará subordinada ao contraste e não alterará o conteúdo das mensagens.

## Responsividade

- Validar 320, 360, 375, 390 e 414 px, tablet e desktop.
- Evitar `100vh` rígido; preferir `100dvh` com fallback e variável baseada em `visualViewport` onde necessária.
- Cabeçalho e composer ocupam altura estável; apenas a lista de mensagens rola.
- O último conteúdo terá padding suficiente para navbar e safe area.
- Não haverá scroll horizontal, controles cortados ou ações menores que uma área de toque confortável.
- No desktop, a conversa terá largura de leitura controlada dentro da coluna principal.

## Acessibilidade

- Botões de ícone terão nomes acessíveis e foco visível.
- A lista e os estados de envio terão semântica apropriada sem anunciar polling repetidamente.
- Contraste não dependerá apenas de cor; falha e envio usarão texto/ícone além da tonalidade.
- Operações principais serão acessíveis por teclado.
- Avatares decorativos terão tratamento correto e imagens informativas terão texto alternativo.

## Performance

- Componentes compartilhados evitarão listeners e mutações DOM duplicadas.
- Mensagens e itens de conversa serão memoizados somente onde medições mostrarem benefício claro.
- Imagens usarão carregamento e dimensões adequados.
- A implementação manterá paginação/carregamento atual; virtualização só será adicionada se testes com histórico extenso demonstrarem necessidade.
- Nenhuma dependência grande será introduzida para animação ou layout.

## Migração segura

1. Criar testes de contrato e comportamento para o núcleo compartilhado.
2. Introduzir componentes React mantendo serviços e callbacks atuais.
3. Migrar primeiro a apresentação comum de mensagens e estados.
4. Migrar composer e áudio com testes de regressão.
5. Aplicar as direções específicas de aluno, profissional e desktop.
6. Remover apenas as mutações DOM comprovadamente substituídas.
7. Validar que papel de parede, rascunho, retry, histórico e permissões não regrediram.

Cada etapa deve manter o aplicativo compilável e testável. Nenhuma remoção será feita apenas por o código parecer antigo.

## Testes e aceite

O desenvolvimento seguirá teste primeiro para comportamentos novos ou corrigidos. A validação final cobrirá:

- abrir conversa com e sem avatar e com nome longo;
- carregar histórico vazio, curto e extenso;
- enviar texto, texto longo, emoji e várias mensagens rápidas;
- preservar rascunho após troca de conversa, reload e falha;
- gravar, cancelar, enviar, reproduzir e repetir áudio;
- enviar e abrir imagem/anexo atualmente suportado;
- simular falha, manter conteúdo e executar retry sem duplicação;
- receber nova mensagem no fim e durante leitura antiga;
- trocar papel de parede sem perder contraste;
- navegar por teclado e conferir foco/nomes acessíveis;
- validar claro/escuro e `prefers-reduced-motion`;
- validar 320, 360, 375, 390, 414 px, tablet e desktop;
- conferir teclado virtual, safe area, scroll e ausência de overflow horizontal;
- executar lint, typecheck, testes existentes, novos testes e build.

O chat só será classificado como pronto para homologação quando texto, áudio, anexos atuais, rascunho, histórico, scroll, retry e responsividade forem demonstrados sem regressões relevantes.

## Riscos e acompanhamentos

- As políticas atuais do Storage de anexos precisam de endurecimento antes de ampliar formatos de arquivo; isso será uma entrega de segurança separada e baseada no schema real.
- Realtime verdadeiro não será declarado enquanto o transporte permanecer por polling.
- Testes de teclado virtual dependem de validação em navegador móvel real ou emulação compatível; qualquer limitação será registrada objetivamente.
- A migração dos scripts de aprimoramento DOM será incremental para evitar conflito com funcionalidades já estabilizadas.
