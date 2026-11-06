import { useEffect, useRef, useState } from 'react'
import './studentMealPhotoJournal.css'

const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const MAX_STORED_PHOTO_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
])
const IMAGE_EXTENSIONS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
}

function normalizedImageType(file) {
  const suppliedType = String(file?.type || '').toLowerCase()
  if (ALLOWED_IMAGE_TYPES.has(suppliedType)) return suppliedType
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTENSIONS[extension] || ''
}

export async function prepareStudentMealPhoto(file) {
  if (!file || !Number(file.size)) throw new Error('Escolha uma foto da refeição para continuar.')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('A foto deve ter até 15 MB. Escolha uma imagem menor e tente novamente.')
  const imageType = normalizedImageType(file)
  if (!imageType) throw new Error('Use uma imagem JPEG, PNG, WebP, HEIC ou AVIF.')

  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    let bitmap
    try {
      bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas unavailable')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84))
      if (blob && blob.size > 0 && blob.size <= MAX_STORED_PHOTO_BYTES) {
        const safeName = `refeicao-${Date.now()}.jpg`
        return typeof File === 'function'
          ? new File([blob], safeName, { type: 'image/jpeg', lastModified: Date.now() })
          : blob
      }
    } catch {
      // Se o navegador não conseguir decodificar o formato (por exemplo, HEIC), usa o original validado.
    } finally {
      bitmap?.close?.()
    }
  }

  if (file.size > MAX_STORED_PHOTO_BYTES) {
    throw new Error('Não foi possível otimizar esta imagem para o envio. Escolha uma foto de até 10 MB em JPEG, PNG ou WebP.')
  }
  const extension = Object.entries(IMAGE_EXTENSIONS).find(([, type]) => type === imageType)?.[0] || 'jpg'
  const safeName = `refeicao-${Date.now()}.${extension}`
  return typeof File === 'function'
    ? new File([file], safeName, { type: imageType, lastModified: Date.now() })
    : new Blob([file], { type: imageType })
}

function currentMealName() {
  const hour = new Date().getHours()
  if (hour < 10) return 'Café da manhã'
  if (hour < 15) return 'Almoço'
  if (hour < 18) return 'Lanche'
  return 'Jantar'
}

function formatMealDate(value) {
  const date = new Date(value || '')
  if (!Number.isFinite(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function MealPhotoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3A1.5 1.5 0 0 1 21.5 9v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
      <circle cx="12" cy="13" r="3.6" />
      <path d="M18 10h.01" />
    </svg>
  )
}

export default function StudentMealPhotoJournal({ logs = [], loading = false, loadError = '', nutritionPlanId = '', onSave, onRefresh }) {
  const [formOpen, setFormOpen] = useState(false)
  const [mealName, setMealName] = useState(currentMealName)
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!photoFile || typeof URL?.createObjectURL !== 'function') {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  function resetForm() {
    setFormOpen(false)
    setMealName(currentMealName())
    setNotes('')
    setPhotoFile(null)
    setSaveError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submitMealPhoto(event) {
    event.preventDefault()
    if (saving) return
    setSaveError('')
    setSavedMessage('')
    if (!photoFile) {
      setSaveError('Adicione uma foto da refeição para registrar.')
      return
    }
    if (typeof onSave !== 'function') {
      setSaveError('O registro de refeição não está disponível agora. Verifique sua conexão e tente novamente.')
      return
    }

    setSaving(true)
    try {
      const optimizedPhoto = await prepareStudentMealPhoto(photoFile)
      const savedLog = await onSave({
        mealName: mealName.trim(),
        notes: notes.trim(),
        nutritionPlanId,
        photoFile: optimizedPhoto,
      })
      if (!savedLog?.id) throw new Error('Não foi possível confirmar o registro da refeição.')
      setSavedMessage('Refeição registrada com sucesso.')
      resetForm()
    } catch (error) {
      setSaveError(error?.message || 'Não foi possível registrar sua refeição. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const recentLogs = (Array.isArray(logs) ? logs : []).slice(0, 6)

  return (
    <section className="student-meal-photo-journal" aria-labelledby="student-meal-photo-title">
      <div className="student-meal-photo-heading">
        <span className="student-meal-photo-heading-icon"><MealPhotoIcon /></span>
        <div>
          <p>ACOMPANHAMENTO ALIMENTAR</p>
          <h4 id="student-meal-photo-title">Registre sua refeição</h4>
          <span>Envie uma foto para acompanhar sua rotina alimentar.</span>
        </div>
      </div>
      {!formOpen ? (
        <button type="button" className="student-meal-photo-open" onClick={() => { setFormOpen(true); setSavedMessage(''); setSaveError('') }}>
          <span aria-hidden="true">＋</span>
          <span>Registrar refeição com foto</span>
        </button>
      ) : (
        <form className="student-meal-photo-form" onSubmit={submitMealPhoto}>
          <label className="student-meal-photo-field">
            <span>Qual refeição?</span>
            <select value={mealName} onChange={(event) => setMealName(event.target.value)} disabled={saving}>
              {['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Outra refeição'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <input
            ref={fileInputRef}
            className="student-meal-photo-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            capture="environment"
            aria-label="Foto da refeição"
            onChange={(event) => {
              setPhotoFile(event.target.files?.[0] || null)
              setSaveError('')
            }}
            disabled={saving}
          />
          <button type="button" className="student-meal-photo-choose" disabled={saving} onClick={() => fileInputRef.current?.click()}>
            <MealPhotoIcon />{photoFile ? 'Trocar foto' : 'Tirar foto ou escolher da galeria'}
          </button>
          {previewUrl ? (
            <div className="student-meal-photo-preview">
              <img src={previewUrl} alt="Prévia da foto selecionada para a refeição" />
              <span>Foto selecionada para esta refeição</span>
              <button type="button" onClick={() => { setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} disabled={saving} aria-label="Remover foto">Remover</button>
            </div>
          ) : <p className="student-meal-photo-hint">A foto é necessária. JPEG, PNG, WebP, HEIC ou AVIF; até 15 MB antes da otimização.</p>}
          <label className="student-meal-photo-field">
            <span>Observação <small>opcional</small></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={240} placeholder="Ex.: refeição feita fora de casa" disabled={saving} />
          </label>
          <div className="student-meal-photo-actions">
            <button type="button" className="is-secondary" onClick={resetForm} disabled={saving}>Cancelar</button>
            <button type="submit" className="is-primary" disabled={saving || !photoFile}>{saving ? 'Enviando foto…' : 'Salvar refeição'}</button>
          </div>
          {saveError ? <p className="student-meal-photo-error" role="alert">{saveError}</p> : null}
        </form>
      )}
      {savedMessage ? <p className="student-meal-photo-success" role="status">{savedMessage}</p> : null}
      <div className="student-meal-photo-history">
        <div className="student-meal-photo-history-heading">
          <strong>Refeições registradas</strong>
          <button type="button" onClick={onRefresh} disabled={loading || typeof onRefresh !== 'function'} aria-label="Atualizar refeições registradas">{loading ? 'Atualizando…' : 'Atualizar'}</button>
        </div>
        {loading ? <p className="student-meal-photo-muted" role="status">Carregando seus registros…</p> : null}
        {loadError ? <div className="student-meal-photo-error" role="alert"><span>{loadError}</span><button type="button" onClick={onRefresh} disabled={typeof onRefresh !== 'function'}>Tentar novamente</button></div> : null}
        {!loading && !loadError && recentLogs.length === 0 ? <p className="student-meal-photo-muted">Suas refeições registradas aparecerão aqui.</p> : null}
        {recentLogs.length ? (
          <div className="student-meal-photo-log-list">
            {recentLogs.map((log) => (
              <article key={log.id} className="student-meal-photo-log">
                {log.photoUrl ? <img src={log.photoUrl} alt={`Foto da refeição: ${log.mealName || 'refeição'}`} loading="lazy" /> : <span className="student-meal-photo-missing" aria-label="Foto privada não carregada"><MealPhotoIcon /></span>}
                <div>
                  <strong>{log.mealName || 'Refeição'}</strong>
                  <time dateTime={log.recordedAt || log.consumedAt || log.createdAt}>{formatMealDate(log.recordedAt || log.consumedAt || log.createdAt)}</time>
                  {log.notes ? <p>{log.notes}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
