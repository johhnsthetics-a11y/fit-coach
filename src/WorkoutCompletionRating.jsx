import { useEffect, useState } from 'react'
import './workoutCompletionRating.css'

const STAR_VALUES = [1, 2, 3, 4, 5]
const MAX_FEEDBACK_LENGTH = 500

function RatingStarIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
      <path d="m12 2.75 2.84 5.75 6.35.92-4.59 4.47 1.08 6.32L12 17.23l-5.68 2.98 1.08-6.32-4.59-4.47 6.35-.92L12 2.75Z" />
    </svg>
  )
}

function readRating(log) {
  const value = Number(log?.rating ?? log?.studentRating ?? log?.student_rating ?? 0)
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0
}

function readFeedback(log) {
  return String(log?.ratingFeedback ?? log?.rating_feedback ?? '').slice(0, MAX_FEEDBACK_LENGTH)
}

export default function WorkoutCompletionRating({ log, onSubmit, preview = false }) {
  const [selectedRating, setSelectedRating] = useState(() => preview ? 0 : readRating(log))
  const [savedRating, setSavedRating] = useState(() => preview ? 0 : readRating(log))
  const [feedback, setFeedback] = useState(() => preview ? '' : readFeedback(log))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    const nextRating = preview ? 0 : readRating(log)
    setSelectedRating(nextRating)
    setSavedRating(nextRating)
    setFeedback(preview ? '' : readFeedback(log))
    setError('')
    setConfirmation('')
  }, [log?.id, log?.rating, log?.studentRating, log?.student_rating, log?.ratingFeedback, log?.rating_feedback, preview])

  if (!log?.id || log.endedEarly) return null

  async function saveRating() {
    if (preview || saving || selectedRating < 1 || selectedRating > 5) return
    if (typeof onSubmit !== 'function') {
      setError('Não foi possível salvar sua avaliação agora. Tente novamente.')
      return
    }
    setSaving(true)
    setError('')
    setConfirmation('')
    try {
      const feedbackToSave = feedback.trim().slice(0, MAX_FEEDBACK_LENGTH)
      const result = await onSubmit(selectedRating, feedbackToSave)
      if (!result) throw new Error('Não foi possível confirmar o salvamento da avaliação.')
      const confirmedRating = readRating(result) || selectedRating
      setSelectedRating(confirmedRating)
      setSavedRating(confirmedRating)
      setFeedback(readFeedback(result) || feedbackToSave)
      setConfirmation('Avaliação salva. Obrigado por compartilhar sua experiência.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar sua avaliação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const feedbackId = `student-workout-rating-feedback-${log.id}`

  return (
    <section className="student-workout-rating-panel" aria-labelledby="student-workout-rating-title" data-preview-rating={preview ? 'true' : undefined}>
      <div className="student-workout-rating-heading">
        <span className="student-workout-rating-emblem" aria-hidden="true"><RatingStarIcon className="h-4 w-4" /></span>
        <div>
          <p>SEU FEEDBACK</p>
          <h4 id="student-workout-rating-title">Como foi o treino?</h4>
          <span>Compartilhe como você se sentiu nesta sessão.</span>
        </div>
      </div>
      <div className="student-workout-rating-stars" role="group" aria-label="Avalie o treino de uma a cinco estrelas">
        {STAR_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={value <= selectedRating ? 'is-selected' : ''}
            aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
            aria-pressed={selectedRating === value}
            disabled={saving || preview}
            onClick={() => {
              setSelectedRating(value)
              setError('')
              setConfirmation('')
            }}
          >
            <span aria-hidden="true"><RatingStarIcon className="h-5 w-5" /></span>
          </button>
        ))}
      </div>
      <p className="student-workout-rating-caption" aria-live="polite">
        {selectedRating ? 'Avaliação selecionada. Toque nas estrelas para ajustar.' : 'Toque em uma estrela para avaliar'}
      </p>
      <label className="student-workout-rating-feedback" htmlFor={feedbackId}>
        <span>Quer deixar um comentário? <small>(opcional)</small></span>
        <textarea
          id={feedbackId}
          value={feedback}
          maxLength={MAX_FEEDBACK_LENGTH}
          rows={3}
          disabled={preview || saving}
          aria-describedby={`${feedbackId}-count`}
          placeholder="Conte ao treinador como foi o treino ou o que você percebeu."
          onChange={(event) => {
            setFeedback(event.target.value.slice(0, MAX_FEEDBACK_LENGTH))
            setError('')
            setConfirmation('')
          }}
        />
        <small id={`${feedbackId}-count`} aria-live="polite">{feedback.length}/{MAX_FEEDBACK_LENGTH}</small>
      </label>
      {preview ? <p className="student-workout-rating-preview-note" role="note">A avaliação real será enviada pelo aluno no app. Esta prévia não salva estrelas nem feedback.</p> : null}
      <button
        type="button"
        className="student-workout-rating-submit"
        disabled={preview || saving || selectedRating < 1}
        onClick={preview ? undefined : saveRating}
      >
        {preview ? 'Enviar avaliação pelo app do aluno' : saving ? 'Salvando avaliação…' : savedRating ? 'Atualizar avaliação' : 'Enviar avaliação'}
      </button>
      {confirmation ? <p className="student-workout-rating-confirmation" role="status">{confirmation}</p> : null}
      {error ? <p className="student-workout-rating-error" role="alert">{error}</p> : null}
    </section>
  )
}
