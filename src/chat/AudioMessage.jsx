import { useEffect, useRef, useState } from 'react'

function formatAudioTime(value = 0) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function AudioMessage({ src, label = 'Mensagem de áudio' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (!audio) return
      try { audio.pause() } catch {}
    }
  }, [src])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    setError('')
    if (!audio.paused) {
      audio.pause()
      return
    }
    try {
      await audio.play()
    } catch {
      setPlaying(false)
      setError('Não foi possível reproduzir este áudio.')
    }
  }

  function seek(event) {
    const audio = audioRef.current
    if (!audio) return
    const nextTime = Number(event.target.value || 0)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function cyclePlaybackRate() {
    const rates = [1, 1.5, 2]
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    if (audioRef.current) audioRef.current.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  return (
    <div className="chat-audio-message">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onError={() => setError('Não foi possível carregar este áudio.')}
      />
      <button type="button" className="chat-audio-play" onClick={togglePlayback} aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}>
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
      </button>
      <div className="chat-audio-track">
        <span className="chat-audio-label">{label}</span>
        <input
          type="range"
          min="0"
          max={Math.max(duration, 0)}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          aria-label="Posição do áudio"
          disabled={!duration}
        />
        <span className="chat-audio-time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
      </div>
      <button type="button" className="chat-audio-rate" onClick={cyclePlaybackRate} aria-label={`Velocidade ${playbackRate}x`}>
        {playbackRate}x
      </button>
      {error ? <p className="chat-audio-error" role="alert">{error}</p> : null}
    </div>
  )
}
