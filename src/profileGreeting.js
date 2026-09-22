import { getFirstName, getLocalGreeting } from './studentAccess.js'

export const PROFILE_PRESETS = {
  trainer: {
    id: 'trainer',
    eyebrow: 'Central do treinador',
    audienceSingular: 'aluno',
    audiencePlural: 'alunos',
    subtitle: 'Acompanhe seus alunos e mantenha cada evolução sob controle.',
  },
  nutritionist: {
    id: 'nutritionist',
    eyebrow: 'Central do nutricionista',
    audienceSingular: 'paciente',
    audiencePlural: 'pacientes',
    subtitle: 'Acompanhe seus pacientes e organize sua rotina de atendimento.',
  },
  student: {
    id: 'student',
    eyebrow: 'Sua área de treino',
    audienceSingular: 'treino',
    audiencePlural: 'treinos',
    subtitle: 'Acompanhe sua evolução e mantenha o foco no seu objetivo.',
  },
  patient: {
    id: 'patient',
    eyebrow: 'Sua área de acompanhamento',
    audienceSingular: 'plano',
    audiencePlural: 'planos',
    subtitle: 'Acompanhe seu plano alimentar e sua evolução de forma simples.',
  },
  master: {
    id: 'master',
    eyebrow: 'Central master',
    audienceSingular: 'conta',
    audiencePlural: 'contas',
    subtitle: 'Supervisione contas, planos e a operação da plataforma.',
  },
}

export function getProfilePreset(profile) {
  return PROFILE_PRESETS[profile] || PROFILE_PRESETS.trainer
}

export function buildGreetingLine(name, date = new Date()) {
  const firstName = String(name || '').trim() ? getFirstName(name) : ''
  const greeting = getLocalGreeting(date)
  return firstName ? `${greeting}, ${firstName}.` : `${greeting}.`
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural
}

/**
 * Builds the optional contextual sentence. Returns an empty string whenever the
 * underlying data is missing, so the UI never invents metrics.
 */
export function buildProfileContextLine(profile, stats = {}) {
  const preset = getProfilePreset(profile)

  if (profile === 'trainer' || profile === 'nutritionist' || profile === 'master') {
    const pendingReviews = Number(stats.pendingReviews)
    if (Number.isFinite(pendingReviews) && pendingReviews > 0) {
      return `${pendingReviews} ${pluralize(pendingReviews, 'retorno aguarda', 'retornos aguardam')} sua análise.`
    }

    const upcoming = Number(stats.upcomingAppointments)
    if (Number.isFinite(upcoming) && upcoming > 0) {
      return `${upcoming} ${pluralize(upcoming, 'atendimento agendado', 'atendimentos agendados')} nos próximos dias.`
    }

    const active = Number(stats.activePeople)
    if (Number.isFinite(active) && active > 0) {
      return `Você acompanha ${active} ${pluralize(active, preset.audienceSingular, preset.audiencePlural)} no momento.`
    }

    return ''
  }

  if (stats.nextAppointmentLabel) {
    return `Seu próximo atendimento é ${stats.nextAppointmentLabel}.`
  }

  const available = Number(stats.availablePlans)
  if (Number.isFinite(available) && available > 0) {
    return `Você tem ${available} ${pluralize(available, preset.audienceSingular, preset.audiencePlural)} liberado${available === 1 ? '' : 's'} para hoje.`
  }

  return ''
}
