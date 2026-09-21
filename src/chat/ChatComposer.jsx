import { useEffect, useRef, useState } from 'react'
import { useChatComposer } from './useChatComposer'
import { AudioMessage } from './AudioMessage'
import { AudioRecorder } from './AudioRecorder'
import { formatChatAttachmentLabel } from './AttachmentMessage'

function IconSlot({ Icon, name, fallback }) {
  return Icon ? <Icon name={name} className="chat-action-icon" /> : <span aria-hidden="true">{fallback}</span>
}

function AttachmentPreview({ file, preview, onRemove }) {
  const isAudio = String(file?.type || '').startsWith('audio/')
  return (
    <div className="chat-attachment-preview">
      {isAudio
        ? <AudioMessage src={preview} label={formatChatAttachmentLabel(file?.name, file?.type)} />
        : <img src={preview} alt="Prévia da imagem selecionada" />}
      <div className="chat-attachment-preview-copy">
        <strong title={file?.name || ''}>{formatChatAttachmentLabel(file?.name, file?.type)}</strong>
        <span>{isAudio ? 'Áudio pronto para enviar' : 'Imagem pronta para enviar'}</span>
      </div>
      <button type="button" onClick={onRemove} aria-label="Remover anexo">×</button>
    </div>
  )
}

export function ChatComposer({
  role,
  studentId,
  placeholder = 'Mensagem',
  disabled = false,
  buildPayload,
  onSend,
  Icon,
  suggestion = '',
}) {
  const textareaRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const {
    draft,
    setDraft,
    attachment,
    attachmentPreview,
    sending,
    error,
    setError,
    clearAttachment,
    selectAttachment,
    submit,
    retry,
  } = useChatComposer({
    context: { role, studentId },
    onSend,
    buildPayload,
  })
  const hasContent = Boolean(draft.trim() || attachment)
  const unavailable = disabled || sending

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '44px'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 144)}px`
  }, [draft])

  function handleKeyDown(event) {
    const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (isCoarsePointer || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.nativeEvent?.isComposing) return
    event.preventDefault()
    if (hasContent && !unavailable) event.currentTarget.form?.requestSubmit()
  }

  return (
    <form className={`chat-compose ${recording ? 'chat-compose-recording' : ''}`} onSubmit={submit}>
      {suggestion && !hasContent && !recording ? (
        <div className="chat-suggestion">
          <span><strong>Resposta sugerida</strong><small>{suggestion}</small></span>
          <button type="button" onClick={() => setDraft(suggestion)}>Usar</button>
        </div>
      ) : null}
      {attachmentPreview ? <AttachmentPreview file={attachment} preview={attachmentPreview} onRemove={clearAttachment} /> : null}
      <div className="chat-compose-row">
        {!recording ? (
          <label className={`chat-attach-button ${unavailable ? 'chat-action-disabled' : ''}`} aria-label="Anexar foto ou áudio" title="Anexar foto ou áudio">
            <IconSlot Icon={Icon} name="paperclip" fallback="＋" />
            <input type="file" accept="image/*,audio/*" onChange={selectAttachment} disabled={unavailable} />
          </label>
        ) : null}
        {!recording ? (
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={unavailable}
            enterKeyHint="send"
            autoCapitalize="sentences"
            spellCheck="true"
            aria-label={placeholder}
          />
        ) : null}
        {hasContent && !recording ? (
          <button type="submit" className="chat-send-button" disabled={unavailable} aria-label="Enviar mensagem" title="Enviar mensagem">
            <IconSlot Icon={Icon} name="send" fallback="➤" />
          </button>
        ) : (
          <AudioRecorder
            disabled={unavailable}
            onRecorded={selectAttachment}
            onError={setError}
            onRecordingChange={setRecording}
            Icon={Icon}
          />
        )}
      </div>
      {sending ? <p className="chat-send-status" role="status">Enviando mensagem...</p> : null}
      {error ? (
        <div className="chat-send-error" role="alert">
          <span>{error}</span>
          {hasContent && !sending ? <button type="button" onClick={retry}>Tentar novamente</button> : null}
        </div>
      ) : null}
    </form>
  )
}
