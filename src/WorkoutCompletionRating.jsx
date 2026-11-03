import { useEffect, useState } from 'react'
import './workoutCompletionRating.css'

const STAR_VALUES = [1, 2, 3, 4, 5]

function readRating(log) {
  const value = Number(log?.rating ?? log?.studentRating ?? log?.student_rating ?? 0)
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0
}

export default function WorkoutCompletionRating({ log, onSubmit }) {
  const [selectedRating, setSelectedRating] = useState(() => readRating(log))
  const [savedRating, setSavedRating] = useState(() => readRating(log))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    const nextRating = readRating(log)
    setSelectedRating(nextRating)
    setSavedRating(nextRating)
    setError('')
    setConfirmation('')
  }, [log?.id, log?.rating, log?.studentRating, log?.student_rating])

  if (!log?.id || log.endedEarly) return null

  async function saveRating() {
    if (saving || selectedRating < 1 || selectedRating > 5) return
    if (typeof onSubmit !== 'function') {
      setError('Não foi possível salvar sua avaliação agora. Tente novamente.')
      return
    }
    setSaving(true)
    setError('')
    setConfirmation('')
    try {
      const result = await onSubmit(selectedRating)
      if (!result) throw new Error('Não foi possível confirmar o salvamento da avaliação.')
      const confirmedRating = readRating(result) || selectedRating
      setSelectedRating(confirmedRating)
      setSavedRating(confirmedRating)
      setConfirmation('Avaliação salva. Obrigado por compartilhar sua experiência.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar sua avaliação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="student-workout-rating-panel" aria-labelledby="student-workout-rating-title">
      <div className="student-workout-rating-heading">
        <span className="student-workout-rating-emblem" aria-hidden="true">★</span>
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
            disabled={saving}
            onClick={() => {
              setSelectedRating(value)
              setError('')
              setConfirmation('')
            }}
          >
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>
      <p className="student-workout-rating-caption" aria-live="polite">
        {selectedRating ? `${selectedRating} de 5 ${selectedRating === 1 ? 'estrela selecionada' : 'estrelas selecionadas'}` : 'Toque em uma estrela para avaliar'}
      </p>
      <button
        type="button"
        className="student-workout-rating-submit"
        disabled={saving || selectedRating < 1}
        onClick={saveRating}
      >
        {saving ? 'Salvando avaliação…' : savedRating ? 'Atualizar avaliação' : 'Enviar avaliação'}
      </button>
      {confirmation ? <p className="student-workout-rating-confirmation" role="status">{confirmation}</p> : null}
      {error ? <p className="student-workout-rating-error" role="alert">{error}</p> : null}
    </section>
  )
}
