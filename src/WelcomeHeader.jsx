import React, { useEffect, useState } from 'react'
import { buildGreetingLine, getProfilePreset } from './profileGreeting'

function getWelcomeInitials(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return initials || '•'
}

function WelcomeAvatar({ name, photo, size = 'lg', onClick, busy = false, label = '' }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [photo])

  const sizeClass = size === 'sm'
    ? 'h-11 w-11 text-[11px]'
    : 'h-14 w-14 text-sm sm:h-16 sm:w-16 sm:text-base'

  const avatar = photo && !imageFailed ? (
      <img
        src={photo}
        alt={`Foto de ${name || 'perfil'}`}
        onError={() => setImageFailed(true)}
        loading="lazy"
        className={`${sizeClass} rounded-full border border-white/12 object-cover shadow-sm shadow-black/30`}
      />
  ) : (
    <span
      aria-label={`Iniciais de ${name || 'perfil'}`}
      className={`${sizeClass} grid place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 font-black uppercase tracking-wide text-emerald-100`}
    >
      {getWelcomeInitials(name)}
    </span>
  )

  if (!onClick) return <span className="shrink-0">{avatar}</span>

  const avatarLabel = label || `Alterar foto de perfil de ${name || 'usuario'}`
  return (
    <button
      type="button"
      aria-label={avatarLabel}
      aria-busy={busy}
      title={avatarLabel}
      disabled={busy}
      onClick={onClick}
      className="group relative shrink-0 rounded-full outline-none transition hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-wait disabled:opacity-70"
    >
      {avatar}
      <span aria-hidden="true" className="absolute bottom-0 right-0 grid h-6 min-w-6 place-items-center rounded-full border-2 border-zinc-950 bg-emerald-400 px-1 text-[10px] font-black text-zinc-950 shadow-lg transition group-hover:bg-emerald-300">
        {busy ? '...' : '+'}
      </span>
    </button>
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
  onAvatarClick = null,
  avatarBusy = false,
  avatarLabel = '',
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
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
          <WelcomeAvatar name={name} photo={photo} onClick={onAvatarClick} busy={avatarBusy} label={avatarLabel} />
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

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
