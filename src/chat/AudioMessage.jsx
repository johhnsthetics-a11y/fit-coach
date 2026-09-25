import { useEffect, useMemo, useRef, useState } from 'react'

function formatAudioTime(value = 0) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function buildWaveform(seed = '', count = 42) {
  let hash = 2166136261
  for (const char of String(seed || 'audio')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return Array.from({ length: count }, (_, index) => {
    hash ^= index + 1
    hash = Math.imul(hash, 16777619)
    return 28 + (Math.abs(hash) % 72)
  })
}

export function AudioMessage({ src, label = 'Mensagem de áudio' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [error, setError] = useState('')
  const waveform = useMemo(() => buildWaveform(src), [src])
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0

  useEffect(() => {
    const audio = audioRef.current
    setError('')
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    if (audio) {
      try {
        audio.pause()
        audio.load()
      } catch {}
    }

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
    if (!audio || !duration) return
    const nextTime = Math.min(duration, Math.max(0, Number(event.target.value || 0)))
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function cyclePlaybackRate() {
    const rates = [1, 1.5, 2]
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    if (audioRef.current) audioRef.current.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  const displayTime = playing || currentTime > 0 ? currentTime : duration

  return (
    <div className="chat-audio-message">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
        onCanPlay={() => setError('')}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(0)
        }}
        onDurationChange={(event) => {
          const nextDuration = Number(event.currentTarget.duration)
          if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration)
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = Number(event.currentTarget.duration)
          if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration)
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onError={() => setError('Não foi possível carregar este áudio.')}
      />

      <button
        type="button"
        className="chat-audio-play"
        onClick={togglePlayback}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
      </button>

      <div className="chat-audio-track">
        <span className="chat-audio-label">{label}</span>

        <div className="chat-audio-waveform" aria-hidden="true">
          {waveform.map((height, index) => {
            const played = index / Math.max(1, waveform.length - 1) <= progress
            return (
              <i
                key={index}
                className={played ? 'is-played' : ''}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </div>

        <input
          className="chat-audio-wave-range"
          type="range"
          min="0"
          max={Math.max(duration, 0)}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          aria-label="Posição do áudio"
          disabled={!duration}
        />

        <span className="chat-audio-time">{formatAudioTime(displayTime)}</span>
      </div>

      <button
        type="button"
        className="chat-audio-rate"
        onClick={cyclePlaybackRate}
        aria-label={`Velocidade ${playbackRate}x`}
      >
        {playbackRate}x
      </button>

      {error ? <p className="chat-audio-error" role="alert">{error}</p> : null}
    </div>
  )
}
