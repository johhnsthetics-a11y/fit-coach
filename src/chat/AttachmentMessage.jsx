import { AudioMessage } from './AudioMessage'

function isSafeAttachmentUrl(value = '') {
  const url = String(value || '').trim()
  return /^(https?:|blob:|data:image\/|data:audio\/)/i.test(url) || url.startsWith('/')
}

export function formatChatAttachmentLabel(name = '', type = '') {
  const safeName = String(name || '').trim()
  const isAudio = String(type || '').toLowerCase().startsWith('audio/')
  if (isAudio && (!safeName || /^audio-fitcoach-/i.test(safeName))) return 'Áudio gravado'
  return safeName || (isAudio ? 'Áudio gravado' : 'Anexo da conversa')
}

export function AttachmentMessage({ message }) {
  if (!message?.attachmentUrl || message?.deletedAt || !isSafeAttachmentUrl(message.attachmentUrl)) return null

  const type = String(message.attachmentType || '').toLowerCase()
  const url = String(message.attachmentUrl)
  const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(url)
  const isAudio = type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|wav|webm)(\?.*)?$/i.test(url)
  const label = formatChatAttachmentLabel(message.attachmentName, message.attachmentType)

  if (isAudio) {
    return <AudioMessage src={url} label={label} />
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="chat-image-attachment" aria-label={`Abrir ${label}`}>
        <img src={url} alt={message.attachmentName || 'Imagem enviada na conversa'} loading="lazy" width="320" height="240" />
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="chat-file-attachment">
      <span aria-hidden="true">↗</span>
      <span>{message.attachmentName || 'Abrir anexo'}</span>
    </a>
  )
}
