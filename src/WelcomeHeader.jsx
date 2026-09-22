import React, { useEffect, useState } from 'react'
import { buildGreetingLine, getProfilePreset } from './profileGreeting'

function getWelcomeInitials(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return initials || '•'
}

function WelcomeAvatar({ name, photo, size = 'lg' }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [photo])

  const sizeClass = size === 'sm'
    ? 'h-11 w-11 text-[11px]'
    : 'h-14 w-14 text-sm sm:h-16 sm:w-16 sm:text-base'

  if (photo && !imageFailed) {
    return (
      <img
        src={photo}
        alt={`Foto de ${name || 'perfil'}`}
        onError={() => setImageFailed(true)}
        loading="lazy"
        className={`${sizeClass} shrink-0 rounded-full border border-white/12 object-cover shadow-sm shadow-black/30`}
      />
    )
  }

  return (
    <span
      aria-label={`Iniciais de ${name || 'perfil'}`}
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 font-black uppercase tracking-wide text-emerald-100`}
    >
      {getWelcomeInitials(name)}
    </span>
  )
}

/**
 * Cabeçalho de boas-vindas reutilizável.
 * Um único componente atende treinador, aluno, nutricionista e paciente:
 * o conteúdo vem do perfil autenticado (`profile`) e dos dados já carregados.
 */
export default function WelcomeHeader({
  profile = 'trainer',
  name = '',
  photo = '',
  contextLine = '',
  subtitle = '',
  eyebrow = '',
  loading = false,
  actions = null,
  className = '',
}) {
  const preset = getProfilePreset(profile)
  const resolvedEyebrow = eyebrow || preset.eyebrow
  const resolvedSubtitle = subtitle || preset.subtitle

  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label="Carregando suas informações"
        className={`welcome-header mb-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-5 ${className}`}
      >
        <div className="flex items-center gap-4">
          <span className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-white/10 sm:h-16 sm:w-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-28 animate-pulse rounded bg-white/10" />
            <span className="block h-5 w-56 max-w-full animate-pulse rounded bg-white/10" />
            <span className="block h-3 w-72 max-w-full animate-pulse rounded bg-white/[0.07]" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Resumo personalizado do seu perfil"
      className={`welcome-header mb-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-lg shadow-black/10 sm:p-5 xl:mb-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <WelcomeAvatar name={name} photo={photo} />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300/90">{resolvedEyebrow}</p>
            <h2 className="mt-1.5 truncate text-[19px] font-black leading-tight tracking-tight text-white sm:text-2xl">
              {buildGreetingLine(name)}
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-zinc-400 sm:text-sm">
              {contextLine || resolvedSubtitle}
            </p>
          </div>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
