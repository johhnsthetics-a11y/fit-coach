import { useEffect, useMemo, useRef, useState } from 'react'
import './professional-team-build41.css'

const asList = (value) => (Array.isArray(value) ? value : [])
const asText = (value) => (value == null ? '' : String(value))
const sameId = (left, right) => asText(left) !== '' && asText(left) === asText(right)

function valueOf(object, ...keys) {
  for (const key of keys) {
    const value = object?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

function teamIdOf(team) {
  return valueOf(team, 'id', 'teamId', 'team_id', 'uuid')
}

function teamIdOfInvite(invite) {
  return valueOf(invite, 'teamId', 'team_id') || teamIdOf(invite?.team)
}

function personId(person) {
  return valueOf(person, 'id', 'userId', 'user_id', 'memberId', 'member_id', 'uuid')
}

function memberIdOf(member) {
  return valueOf(member, 'id', 'memberId', 'member_id', 'userId', 'user_id', 'uuid')
}

function candidateId(candidate) {
  return valueOf(candidate, 'id', 'studentId', 'student_id', 'patientId', 'patient_id', 'uuid')
}

function personName(person) {
  const profile = person?.profile || person?.user || person?.professional || {}
  const name = valueOf(person, 'name', 'fullName', 'full_name', 'displayName', 'display_name')
    || valueOf(profile, 'name', 'fullName', 'full_name', 'displayName', 'display_name')
    || [person?.firstName || person?.first_name, person?.lastName || person?.last_name].filter(Boolean).join(' ')
    || [profile?.firstName || profile?.first_name, profile?.lastName || profile?.last_name].filter(Boolean).join(' ')
  return asText(name || valueOf(person, 'email') || valueOf(profile, 'email'))
}

function roleText(role) {
  const raw = asText(role).trim()
  if (!raw) return 'Perfil profissional não informado'
  const normalized = raw.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('nutri')) return 'Nutricionista'
  if (normalized.includes('trainer') || normalized.includes('trein') || normalized.includes('personal')) return 'Treinador'
  return raw
}

function memberProfessionalRole(member) {
  const profile = member?.profile || member?.user || {}
  return valueOf(member, 'professionalRole', 'professional_role', 'professionalType', 'professional_type', 'specialty', 'profession')
    || valueOf(profile, 'professionalRole', 'professional_role', 'professionalType', 'professional_type', 'specialty', 'profession')
}

function areaForRole(role) {
  const normalized = asText(role).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('nutri')) return 'nutrition'
  if (normalized.includes('trainer') || normalized.includes('trein') || normalized.includes('personal') || normalized === 'coach') return 'workout'
  return ''
}

function areaLabel(area) {
  if (area === 'nutrition') return 'Nutrição'
  if (area === 'workout') return 'Treinos'
  return 'Área não informada'
}

function teamMembers(team) {
  return asList(valueOf(team, 'members', 'teamMembers', 'team_members', 'participants', 'memberships'))
}

function teamOwner(team) {
  const owner = team?.owner || team?.responsible || team?.leader || team?.ownerUser || team?.owner_user || null
  if (owner && typeof owner === 'object') return owner
  const createdBy = valueOf(team, 'createdBy', 'created_by', 'ownerId', 'owner_id', 'responsibleId', 'responsible_id')
  return createdBy ? { id: createdBy } : null
}

function isResponsible(team, currentUser) {
  const explicit = valueOf(team, 'isOwner', 'is_owner', 'isResponsible', 'is_responsible')
  if (explicit === true || explicit === 'true') return true
  const teamRole = asText(valueOf(team, 'memberRole', 'member_role', 'role', 'membershipRole', 'membership_role')).toLocaleLowerCase('pt-BR')
  if (['owner', 'responsible', 'admin', 'responsavel'].includes(teamRole)) return true
  const ownerId = personId(teamOwner(team))
  const userId = personId(currentUser)
  return sameId(ownerId, userId)
}

function statusOf(invite) {
  const raw = asText(valueOf(invite, 'status', 'state', 'inviteStatus', 'invite_status')).trim().toLocaleLowerCase('pt-BR')
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return 'pending'
  if (['pending', 'pendente', 'sent', 'enviado', 'invited', 'convidado', 'open', 'active', 'aguardando'].includes(normalized)) return 'pending'
  if (['accepted', 'aceito', 'accepted_by_user'].includes(normalized)) return 'accepted'
  if (['declined', 'recusado', 'rejected'].includes(normalized)) return 'declined'
  if (['cancelled', 'canceled', 'cancelado'].includes(normalized)) return 'cancelled'
  if (['expired', 'expirado'].includes(normalized)) return 'expired'
  return normalized
}

function statusLabel(status) {
  return ({ pending: 'Pendente', accepted: 'Aceito', declined: 'Recusado', cancelled: 'Cancelado', expired: 'Expirado' })[status]
    || (status ? status.charAt(0).toLocaleUpperCase('pt-BR') + status.slice(1) : 'Estado não informado')
}

function inviteDirection(invite, teams, currentUser) {
  const direction = asText(valueOf(invite, 'direction', 'inviteDirection', 'invite_direction', 'kind')).toLocaleLowerCase('pt-BR')
  if (['incoming', 'received', 'inbound', 'recebido', 'entrada'].includes(direction)) return 'incoming'
  if (['outgoing', 'sent', 'outbound', 'enviado', 'saida'].includes(direction)) return 'outgoing'
  const userId = personId(currentUser)
  const userEmail = asText(valueOf(currentUser, 'email')).toLocaleLowerCase('pt-BR')
  const recipientId = valueOf(invite, 'recipientId', 'recipient_id', 'inviteeId', 'invitee_id', 'targetUserId', 'target_user_id')
  const recipientEmail = asText(valueOf(invite, 'recipientEmail', 'recipient_email', 'email', 'inviteeEmail', 'invitee_email')).toLocaleLowerCase('pt-BR')
  if ((userId && sameId(recipientId, userId)) || (userEmail && recipientEmail === userEmail)) return 'incoming'
  const senderId = valueOf(invite, 'senderId', 'sender_id', 'inviterId', 'inviter_id', 'createdBy', 'created_by', 'creatorId', 'creator_id')
  const senderEmail = asText(valueOf(invite, 'senderEmail', 'sender_email', 'inviterEmail', 'inviter_email')).toLocaleLowerCase('pt-BR')
  if ((userId && sameId(senderId, userId)) || (userEmail && senderEmail === userEmail)) return 'outgoing'
  const team = teams.find((item) => sameId(teamIdOf(item), teamIdOfInvite(invite)))
  return team && isResponsible(team, currentUser) ? 'outgoing' : 'incoming'
}

function delegationTeamId(item) {
  return valueOf(item, 'teamId', 'team_id')
}

function delegationMemberId(item) {
  return valueOf(item, 'memberId', 'member_id', 'professionalId', 'professional_id', 'collaboratorId', 'collaborator_id', 'userId', 'user_id')
}

function delegationArea(item) {
  return asText(valueOf(item, 'area', 'scope', 'professionalArea', 'professional_area'))
}

function delegationStudentIds(item) {
  const ids = valueOf(item, 'studentIds', 'student_ids', 'patientIds', 'patient_ids', 'students')
  if (Array.isArray(ids)) return ids.map((entry) => (entry && typeof entry === 'object' ? candidateId(entry) : entry)).filter((entry) => entry !== '')
  const single = valueOf(item, 'studentId', 'student_id', 'patientId', 'patient_id')
  return single === '' ? [] : [single]
}

function messageText(message) {
  if (typeof message === 'string') return message
  return asText(valueOf(message, 'message', 'text', 'title', 'detail'))
}

function Icon({ name, className = '' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', className: `ptw-icon ${className}` }
  if (name === 'team') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  if (name === 'shield') return <svg {...common}><path d="M12 3 19 6v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-5" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (name === 'refresh') return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></svg>
  if (name === 'check') return <svg {...common}><path d="m20 6-11 11-5-5" /></svg>
  if (name === 'close') return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
  if (name === 'person') return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  return null
}

function NativeDialog({ children, titleId, onClose, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`ptw-dialog ${className}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}
    >
      {children}
    </dialog>
  )
}

function CreateOrInviteDialog({ dialog, teams, busy, onCreateTeam, onInviteMember, onClose }) {
  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [professionalRole, setProfessionalRole] = useState('')
  const team = teams.find((item) => sameId(teamIdOf(item), dialog.teamId))
  const isCreate = dialog.kind === 'create'
  const titleId = isCreate ? 'ptw-create-title' : 'ptw-invite-title'

  function submit(event) {
    event.preventDefault()
    if (busy) return
    if (isCreate) {
      const cleanName = teamName.trim()
      if (!cleanName || !onCreateTeam) return
      onCreateTeam(cleanName)
    } else {
      const cleanEmail = email.trim()
      if (!cleanEmail || !professionalRole || !onInviteMember || !teamIdOf(team)) return
      onInviteMember(teamIdOf(team), cleanEmail, professionalRole)
    }
    onClose()
  }

  return (
    <NativeDialog titleId={titleId} onClose={onClose} className="ptw-form-dialog">
      <form onSubmit={submit}>
        <div className="ptw-dialog-head">
          <div>
            <p className="ptw-kicker">{isCreate ? 'Nova participação' : 'Equipe · convite'}</p>
            <h3 id={titleId}>{isCreate ? 'Criar equipe' : 'Convidar profissional'}</h3>
            <p>{isCreate ? 'Crie uma equipe independente das demais em que você participa.' : `Convite para ${valueOf(team, 'name', 'title') || 'esta equipe'}.`}</p>
          </div>
          <button type="button" className="ptw-icon-button" aria-label="Fechar janela" onClick={onClose}><Icon name="close" /></button>
        </div>
        {isCreate ? (
          <label className="ptw-field">
            <span>Nome da equipe</span>
            <input autoFocus required maxLength={100} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Ex.: Equipe Centro" />
          </label>
        ) : (
          <div className="ptw-form-grid">
            <label className="ptw-field">
              <span>E-mail do profissional</span>
              <input autoFocus required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com" />
            </label>
            <label className="ptw-field">
              <span>Perfil profissional</span>
              <select required value={professionalRole} onChange={(event) => setProfessionalRole(event.target.value)}>
                <option value="">Selecione o perfil</option>
                <option value="trainer">Treinador</option>
                <option value="nutritionist">Nutricionista</option>
              </select>
            </label>
            <p className="ptw-inline-note"><Icon name="info" /> O convite cria apenas um vínculo de equipe. Ele não compartilha pacientes nem concede acesso à carteira de outro profissional.</p>
          </div>
        )}
        <div className="ptw-dialog-actions">
          <button type="button" className="ptw-button ptw-button-secondary" onClick={onClose}>Voltar</button>
          <button type="submit" className="ptw-button ptw-button-primary" disabled={busy || (isCreate ? !onCreateTeam : !onInviteMember)}>
            {busy ? 'Processando…' : isCreate ? 'Criar equipe' : 'Enviar convite'}
          </button>
        </div>
      </form>
    </NativeDialog>
  )
}

function ConfirmationDialog({ confirmation, busy, onConfirm, onClose }) {
  return (
    <NativeDialog titleId="ptw-confirm-title" onClose={onClose} className="ptw-confirm-dialog">
      <div className="ptw-dialog-head">
        <div>
          <p className="ptw-kicker">Confirmação necessária</p>
          <h3 id="ptw-confirm-title">{confirmation.title}</h3>
          <p>{confirmation.description}</p>
        </div>
        <button type="button" className="ptw-icon-button" aria-label="Fechar janela" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ptw-inline-note"><Icon name="shield" /> Esta ação se aplica somente à equipe, vínculo ou concessão indicada.</div>
      <div className="ptw-dialog-actions">
        <button type="button" className="ptw-button ptw-button-secondary" onClick={onClose}>Manter</button>
        <button type="button" className="ptw-button ptw-button-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Processando…' : confirmation.confirmLabel}</button>
      </div>
    </NativeDialog>
  )
}

export default function ProfessionalTeamWorkspace({
  currentUser = null,
  uiTheme = 'dark',
  teams: teamsProp = [],
  invites: invitesProp = [],
  candidates: candidatesProp = [],
  delegations: delegationsProp = [],
  busy = false,
  loading = false,
  error = '',
  notice = '',
  onRefresh,
  onCreateTeam,
  onInviteMember,
  onAcceptInvite,
  onDeclineInvite,
  onCancelInvite,
  onRemoveMember,
  onLeaveTeam,
  onSetDelegations,
  onRevokeDelegation,
}) {
  const teams = useMemo(() => asList(teamsProp), [teamsProp])
  const invites = useMemo(() => asList(invitesProp), [invitesProp])
  const candidates = useMemo(() => asList(candidatesProp), [candidatesProp])
  const delegations = useMemo(() => asList(delegationsProp), [delegationsProp])
  const isLoading = Boolean(loading)
  const isBusy = Boolean(busy || loading)
  const theme = uiTheme === 'light' ? 'light' : 'dark'
  const [selectedTeamId, setSelectedTeamId] = useState(() => asText(teamIdOf(teams[0])))
  const [dialog, setDialog] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [delegationMemberId, setDelegationMemberId] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])

  useEffect(() => {
    if (!teams.some((team) => sameId(teamIdOf(team), selectedTeamId))) setSelectedTeamId(asText(teamIdOf(teams[0])))
  }, [teams, selectedTeamId])

  const selectedTeam = teams.find((team) => sameId(teamIdOf(team), selectedTeamId)) || teams[0] || null
  const selectedTeamIdValue = teamIdOf(selectedTeam)
  const selectedIsResponsible = selectedTeam ? isResponsible(selectedTeam, currentUser) : false
  const selectedMembers = selectedTeam ? teamMembers(selectedTeam) : []
  const userId = personId(currentUser)
  const userEmail = asText(valueOf(currentUser, 'email'))
  const userName = personName(currentUser) || 'Sua conta profissional'
  const pendingInvites = invites.filter((invite) => statusOf(invite) === 'pending')
  const receivedInvites = pendingInvites.filter((invite) => inviteDirection(invite, teams, currentUser) === 'incoming')
  const selectedOutgoingInvites = selectedTeam
    ? pendingInvites.filter((invite) => sameId(teamIdOfInvite(invite), selectedTeamIdValue) && inviteDirection(invite, teams, currentUser) === 'outgoing')
    : []
  const historicalInvites = invites.filter((invite) => statusOf(invite) !== 'pending')
  const activeDelegationMember = selectedMembers.find((member) => sameId(memberIdOf(member), delegationMemberId))
  const activeDelegationArea = activeDelegationMember ? areaForRole(memberProfessionalRole(activeDelegationMember)) : ''
  const matchingDelegations = activeDelegationMember && selectedTeam
    ? delegations.filter((item) => sameId(delegationTeamId(item), selectedTeamIdValue)
      && sameId(delegationMemberId(item), memberIdOf(activeDelegationMember))
      && delegationArea(item) === activeDelegationArea)
    : []
  const storedStudentIds = [...new Set(matchingDelegations.flatMap(delegationStudentIds).map(asText).filter(Boolean))]
  const initialSelectedIdsRef = useRef([])
  const candidateIndex = new Map(candidates.map((candidate) => [asText(candidateId(candidate)), candidate]))
  const storedIdValues = new Map(matchingDelegations.flatMap(delegationStudentIds).map((id) => [asText(id), id]))

  function startDelegation(member) {
    const area = areaForRole(memberProfessionalRole(member))
    if (!area) return
    setDelegationMemberId(asText(memberIdOf(member)))
    const existing = delegations.filter((item) => sameId(delegationTeamId(item), selectedTeamIdValue)
      && sameId(delegationMemberId(item), memberIdOf(member))
      && delegationArea(item) === area)
    const ids = [...new Set(existing.flatMap(delegationStudentIds).map(asText).filter(Boolean))]
    initialSelectedIdsRef.current = ids
    setSelectedStudentIds(ids)
  }

  function closeDelegationEditor() {
    setDelegationMemberId('')
    setSelectedStudentIds([])
    initialSelectedIdsRef.current = []
  }

  function toggleStudent(id) {
    const key = asText(id)
    setSelectedStudentIds((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  function toggleAllCandidates(checked) {
    const eligibleIds = candidates.map(candidateId).map(asText).filter(Boolean)
    setSelectedStudentIds((current) => {
      const fixed = current.filter((id) => !candidateIndex.has(id))
      return checked ? [...new Set([...fixed, ...eligibleIds])] : fixed
    })
  }

  function saveDelegation() {
    if (!selectedTeamIdValue || !activeDelegationMember || !activeDelegationArea || !onSetDelegations) return
    const next = [...new Set(selectedStudentIds)]
    const removed = initialSelectedIdsRef.current.some((id) => !next.includes(id))
    const invoke = () => onSetDelegations(
      selectedTeamIdValue,
      memberIdOf(activeDelegationMember),
      activeDelegationArea,
      next.map((id) => candidateId(candidateIndex.get(id)) || storedIdValues.get(id) || id),
    )
    if (removed) {
      setConfirmation({
        title: 'Atualizar pacientes concedidos?',
        description: 'Pacientes desmarcados deixarão de constar nesta concessão. A liberação de qualquer dado continua condicionada ao consentimento aceito pelo próprio paciente no app.',
        confirmLabel: 'Atualizar concessão',
        run: invoke,
      })
    } else {
      invoke()
    }
  }

  function requestConfirmation(title, description, confirmLabel, run) {
    setConfirmation({ title, description, confirmLabel, run })
  }

  function executeConfirmation() {
    const action = confirmation?.run
    setConfirmation(null)
    if (action) action()
  }

  function askRemoveMember(member) {
    const id = memberIdOf(member)
    const name = personName(member) || 'Este profissional'
    if (!id || !selectedTeamIdValue) return
    requestConfirmation(
      'Remover este membro?',
      `${name} será removido somente de “${valueOf(selectedTeam, 'name', 'title') || 'esta equipe'}”. As demais participações permanecem independentes.`,
      'Remover membro',
      () => onRemoveMember?.(selectedTeamIdValue, id),
    )
  }

  function askLeaveTeam() {
    if (!selectedTeamIdValue) return
    requestConfirmation(
      'Sair desta equipe?',
      `Você sairá somente de “${valueOf(selectedTeam, 'name', 'title') || 'esta equipe'}”. Suas outras participações não serão alteradas.`,
      'Sair da equipe',
      () => onLeaveTeam?.(selectedTeamIdValue),
    )
  }

  function askCancelInvite(invite) {
    const inviteId = valueOf(invite, 'id', 'inviteId', 'invite_id', 'uuid')
    if (!inviteId) return
    const email = valueOf(invite, 'recipientEmail', 'recipient_email', 'email', 'inviteeEmail', 'invitee_email')
    requestConfirmation(
      'Cancelar este convite?',
      `${email || 'O profissional convidado'} será afetado somente neste convite da equipe.`,
      'Cancelar convite',
      () => onCancelInvite?.(inviteId),
    )
  }

  function askDeclineInvite(invite) {
    const inviteId = valueOf(invite, 'id', 'inviteId', 'invite_id', 'uuid')
    if (!inviteId) return
    const teamName = valueOf(invite, 'teamName', 'team_name') || valueOf(invite?.team, 'name', 'title') || 'esta equipe'
    requestConfirmation(
      'Recusar este convite?',
      `O convite para “${teamName}” será recusado. Outras participações em equipes não serão alteradas.`,
      'Recusar convite',
      () => onDeclineInvite?.(inviteId),
    )
  }

  function askRevokeDelegation(item) {
    const id = valueOf(item, 'id', 'delegationId', 'delegation_id', 'uuid')
    if (!id) return
    requestConfirmation(
      'Revogar esta concessão?',
      'A concessão indicada será revogada. O convite e as outras participações na equipe não serão alterados.',
      'Revogar concessão',
      () => onRevokeDelegation?.(id),
    )
  }

  const selectedTeamName = asText(valueOf(selectedTeam, 'name', 'title')) || 'Equipe sem nome informado'
  const selectionAll = candidates.length > 0 && candidates.every((candidate) => selectedStudentIds.includes(asText(candidateId(candidate))))
  const selectedNotice = messageText(notice)
  const selectedError = messageText(error)

  return (
    <section className="professional-team-workspace" data-theme={theme} aria-labelledby="ptw-title">
      <header className="ptw-page-head">
        <div className="ptw-page-copy">
          <p className="ptw-kicker">Workspace profissional</p>
          <h2 id="ptw-title">Equipe</h2>
          <p>Organize suas equipes e participações. Você pode ser responsável em uma e participar de outras.</p>
        </div>
        <div className="ptw-head-actions">
          <button type="button" className="ptw-button ptw-button-secondary" onClick={() => onRefresh?.()} disabled={isBusy || !onRefresh}>
            <Icon name="refresh" />{isBusy ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button type="button" className="ptw-button ptw-button-primary" onClick={() => setDialog({ kind: 'create' })} disabled={isBusy || !onCreateTeam}>
            <Icon name="plus" />Criar equipe
          </button>
        </div>
      </header>

      <aside className="ptw-privacy" aria-label="Privacidade e consentimento">
        <span className="ptw-privacy-mark"><Icon name="shield" /></span>
        <div>
          <strong>Equipe não significa carteira compartilhada</strong>
          <p>Cada profissional mantém sua própria carteira. O convite, sozinho, não compartilha pacientes. Para liberar qualquer dado, o paciente precisa aceitar o consentimento no app; um novo paciente exige concessão e consentimento próprios e não entra automaticamente. A assinatura não é transferida.</p>
        </div>
      </aside>

      {isBusy ? <p className="ptw-state ptw-state-loading" role="status" aria-live="polite" aria-busy="true"><span className="ptw-spinner" aria-hidden="true" />{isLoading ? 'Carregando equipes e permissões…' : 'Processando ação…'}</p> : null}
      {selectedError ? <p className="ptw-state ptw-state-error" role="alert">{selectedError}</p> : null}
      {selectedNotice ? <p className="ptw-state ptw-state-success" role="status" aria-live="polite">{selectedNotice}</p> : null}

      <div className="ptw-layout">
        <div className="ptw-primary-column">
          <section className="ptw-section" aria-labelledby="ptw-teams-title">
            <div className="ptw-section-head">
              <div><h3 id="ptw-teams-title">Suas equipes</h3><p>Papéis e vínculos são independentes em cada equipe.</p></div>
              <span className="ptw-count">{teams.length} {teams.length === 1 ? 'equipe' : 'equipes'}</span>
            </div>
            {teams.length ? (
              <ul className="ptw-team-list">
                {teams.map((team, index) => {
                  const id = teamIdOf(team)
                  const responsible = isResponsible(team, currentUser)
                  const name = asText(valueOf(team, 'name', 'title')) || 'Equipe sem nome informado'
                  const memberCount = teamMembers(team).length
                  const outgoingCount = pendingInvites.filter((invite) => sameId(teamIdOfInvite(invite), id)
                    && inviteDirection(invite, teams, currentUser) === 'outgoing').length
                  return (
                    <li key={asText(id) || `team-${index}`}>
                      <button type="button" className="ptw-team-choice" aria-pressed={sameId(id, teamIdOf(selectedTeam))} onClick={() => { setSelectedTeamId(asText(id)); closeDelegationEditor() }}>
                        <span className="ptw-team-icon"><Icon name="team" /></span>
                        <span className="ptw-team-choice-copy"><strong>{name}</strong><small>{responsible ? 'Você é responsável' : 'Você participa'}{memberCount ? ` · ${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}` : ''}{outgoingCount ? ` · ${outgoingCount} convite${outgoingCount === 1 ? '' : 's'} pendente${outgoingCount === 1 ? '' : 's'}` : ''}</small></span>
                        <span className={`ptw-role-pill${responsible ? ' is-owner' : ''}`}>{responsible ? 'Responsável' : 'Membro'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : isLoading ? (
              <div className="ptw-empty"><strong>Carregando equipes…</strong><span>As participações aparecerão aqui quando os dados estiverem disponíveis.</span></div>
            ) : (
              <div className="ptw-empty"><strong>Nenhuma equipe encontrada</strong><span>Você ainda não tem equipes nesta conta. Crie uma ou aceite um convite recebido.</span><button type="button" className="ptw-button ptw-button-primary" onClick={() => setDialog({ kind: 'create' })} disabled={!onCreateTeam}>Criar equipe</button></div>
            )}
          </section>

          {selectedTeam ? (
            <section className="ptw-team-detail" aria-labelledby="ptw-selected-team-title">
              <header className="ptw-detail-head">
                <div className="ptw-detail-title">
                  <p className="ptw-kicker">{selectedIsResponsible ? 'Equipe sob sua responsabilidade' : 'Equipe da qual você participa'}</p>
                  <h3 id="ptw-selected-team-title">{selectedTeamName}</h3>
                  <p>{selectedIsResponsible ? 'Você administra membros e convites desta equipe.' : 'A administração de membros e convites pertence à pessoa responsável por esta equipe.'}</p>
                </div>
                <div className="ptw-detail-actions">
                  <span className={`ptw-role-pill${selectedIsResponsible ? ' is-owner' : ''}`}>{selectedIsResponsible ? 'Responsável' : 'Membro'}</span>
                  {selectedIsResponsible ? <button type="button" className="ptw-button ptw-button-primary" onClick={() => setDialog({ kind: 'invite', teamId: selectedTeamIdValue })} disabled={isBusy || !onInviteMember}><Icon name="plus" />Convidar membro</button> : null}
                </div>
              </header>

              <div className="ptw-member-section">
                <div className="ptw-section-head ptw-member-heading"><div><h4>Participantes</h4><p>O papel de cada pessoa é independente em cada equipe.</p></div></div>
                {selectedMembers.length || currentUser ? (
                  <ul className="ptw-member-list">
                    {currentUser ? (
                      <li className="ptw-member-row ptw-viewer-row">
                        <span className="ptw-avatar"><Icon name="person" /></span>
                        <span className="ptw-member-copy"><strong>{userName === userEmail && userEmail ? 'Você' : userName}</strong><small>{roleText(valueOf(currentUser, 'professionalRole', 'professional_role', 'professionalType', 'professional_type', 'role'))} · {selectedIsResponsible ? 'responsável da equipe' : 'sua participação'}</small></span>
                        <span className="ptw-status-pill"><Icon name="check" />{selectedIsResponsible ? 'Responsável' : 'Você'}</span>
                      </li>
                    ) : null}
                    {selectedMembers.filter((member) => !(userId && sameId(memberIdOf(member), userId))).map((member, index) => {
                      const memberId = memberIdOf(member)
                      const memberRole = memberProfessionalRole(member)
                      const area = areaForRole(memberRole)
                      const canManageDelegation = selectedIsResponsible && Boolean(area) && Boolean(memberId)
                      const rows = selectedTeam ? delegations.filter((item) => sameId(delegationTeamId(item), selectedTeamIdValue)
                        && sameId(delegationMemberId(item), memberId)) : []
                      return (
                        <li className="ptw-member-row" key={asText(memberId) || `member-${index}`}>
                          <span className="ptw-avatar">{(personName(member).trim().split(/\s+/).map((word) => word[0]).join('').slice(0, 2) || '·').toLocaleUpperCase('pt-BR')}</span>
                          <span className="ptw-member-copy"><strong>{personName(member) || 'Profissional sem nome informado'}</strong><small>{roleText(memberRole)} · {selectedIsResponsible ? 'membro desta equipe' : 'integrante'}</small>
                            {rows.length ? <span className="ptw-member-delegation-summary">{rows.map((item) => {
                              const count = delegationStudentIds(item).length
                              return `${areaLabel(delegationArea(item))}: ${count} ${count === 1 ? 'paciente' : 'pacientes'}`
                            }).join(' · ')}</span> : null}
                          </span>
                          <div className="ptw-member-actions">
                            {canManageDelegation ? <button type="button" className="ptw-button ptw-button-secondary ptw-button-small" aria-expanded={sameId(delegationMemberId, memberId) ? 'true' : 'false'} onClick={() => sameId(delegationMemberId, memberId) ? closeDelegationEditor() : startDelegation(member)} disabled={isBusy}>{sameId(delegationMemberId, memberId) ? 'Fechar concessão' : 'Gerenciar pacientes'}</button> : null}
                            {selectedIsResponsible && memberId && onRemoveMember ? <button type="button" className="ptw-text-danger" onClick={() => askRemoveMember(member)} disabled={isBusy}>Remover</button> : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : <div className="ptw-empty ptw-empty-compact"><strong>Nenhum outro participante informado</strong><span>Os participantes associados a esta equipe aparecerão aqui.</span></div>}

                {activeDelegationMember && selectedIsResponsible ? (
                  <section className="ptw-delegation-editor" aria-labelledby="ptw-delegation-title">
                    <div className="ptw-section-head"><div><h4 id="ptw-delegation-title">Pacientes para {personName(activeDelegationMember) || 'este profissional'}</h4><p>Área correspondente ao perfil: <strong>{areaLabel(activeDelegationArea)}</strong>.</p></div></div>
                    <p className="ptw-consent-note"><Icon name="shield" /> Esta seleção registra a concessão, mas não libera dados por si só. Cada paciente precisa aceitar o consentimento no app antes de qualquer dado ser disponibilizado. Novos pacientes exigem concessão e consentimento próprios; não são incluídos automaticamente.</p>
                    {candidates.length ? (
                      <fieldset className="ptw-candidate-fieldset" disabled={isBusy}>
                        <legend>Pacientes atuais elegíveis</legend>
                        <label className="ptw-select-all"><input type="checkbox" checked={selectionAll} onChange={(event) => toggleAllCandidates(event.target.checked)} /><span>Selecionar todos os pacientes elegíveis</span></label>
                        <ul className="ptw-candidate-list">
                          {candidates.map((candidate, index) => {
                            const id = candidateId(candidate)
                            const key = asText(id)
                            const name = personName(candidate) || 'Paciente sem nome informado'
                            return <li key={key || `candidate-${index}`}><label><input type="checkbox" value={key} checked={Boolean(key && selectedStudentIds.includes(key))} disabled={!key} onChange={() => toggleStudent(id)} /><span>{name}</span></label></li>
                          })}
                        </ul>
                      </fieldset>
                    ) : <div className="ptw-empty ptw-empty-compact"><strong>Nenhum paciente elegível disponível</strong><span>A concessão pode incluir somente pacientes atuais fornecidos como elegíveis.</span></div>}
                    {matchingDelegations.length ? (
                      <section className="ptw-existing-grants" aria-label="Concessões atuais">
                        <h5>Concessões atuais</h5>
                        <ul>{matchingDelegations.map((item, index) => {
                          const id = valueOf(item, 'id', 'delegationId', 'delegation_id', 'uuid')
                          const ids = delegationStudentIds(item).map(asText)
                          const names = ids.map((studentId) => personName(candidateIndex.get(studentId))).filter(Boolean)
                          const unavailable = Math.max(0, ids.length - names.length)
                          const description = [...names, ...(unavailable ? [`${unavailable} fora da lista elegível atual`] : [])].join(' · ')
                          const count = ids.length
                          return <li key={asText(id) || `grant-${index}`}><span><strong>{areaLabel(delegationArea(item))} · {count} {count === 1 ? 'paciente' : 'pacientes'}</strong><small>{description || 'Detalhes de pacientes não informados nesta concessão.'}</small></span>{id && onRevokeDelegation ? <button type="button" className="ptw-text-danger" onClick={() => askRevokeDelegation(item)} disabled={isBusy}>Revogar concessão</button> : null}</li>
                        })}</ul>
                      </section>
                    ) : null}
                    {storedStudentIds.some((id) => !candidateIndex.has(id)) ? <p className="ptw-inline-note"><Icon name="info" /> Concessões existentes fora da lista elegível atual são mantidas no envio deste rascunho. Para revogá-las, use a ação da concessão correspondente abaixo.</p> : null}
                    <div className="ptw-editor-actions"><button type="button" className="ptw-button ptw-button-secondary" onClick={closeDelegationEditor}>Fechar</button><button type="button" className="ptw-button ptw-button-primary" onClick={saveDelegation} disabled={isBusy || !onSetDelegations}>Salvar concessão</button></div>
                  </section>
                ) : null}

                {selectedIsResponsible && selectedOutgoingInvites.length ? (
                  <section className="ptw-outgoing-invites" aria-labelledby="ptw-outgoing-title">
                    <div className="ptw-section-head"><div><h4 id="ptw-outgoing-title">Convites enviados</h4><p>Pendências somente desta equipe.</p></div><span className="ptw-count">{selectedOutgoingInvites.length}</span></div>
                    <ul className="ptw-invite-list">
                      {selectedOutgoingInvites.map((invite, index) => {
                        const id = valueOf(invite, 'id', 'inviteId', 'invite_id', 'uuid')
                        const email = valueOf(invite, 'recipientEmail', 'recipient_email', 'email', 'inviteeEmail', 'invitee_email')
                        return <li className="ptw-invite-row" key={asText(id) || `outgoing-${index}`}><span><strong>{email || 'E-mail do convidado não informado'}</strong><small>{roleText(valueOf(invite, 'professionalRole', 'professional_role', 'role'))} · {statusLabel(statusOf(invite))}</small></span>{id && onCancelInvite ? <button type="button" className="ptw-text-danger" onClick={() => askCancelInvite(invite)} disabled={isBusy}>Cancelar convite</button> : null}</li>
                      })}
                    </ul>
                  </section>
                ) : null}

                {selectedIsResponsible ? <footer className="ptw-detail-footer"><span>Convidar, remover ou sair afeta somente esta equipe.</span></footer> : (
                  <footer className="ptw-detail-footer"><span>Sair daqui não altera suas outras participações.</span><button type="button" className="ptw-button ptw-button-danger-soft" onClick={askLeaveTeam} disabled={isBusy || !onLeaveTeam}>Sair da equipe</button></footer>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="ptw-side-column" aria-label="Convites e regras da equipe">
          <section className="ptw-panel" aria-labelledby="ptw-invites-title">
            <div className="ptw-section-head"><div><h3 id="ptw-invites-title">Convites recebidos</h3><p>Entrar exige o aceite da pessoa convidada.</p></div><span className="ptw-count">{receivedInvites.length} pendentes</span></div>
            {receivedInvites.length ? (
              <ul className="ptw-invite-list">
                {receivedInvites.map((invite, index) => {
                  const id = valueOf(invite, 'id', 'inviteId', 'invite_id', 'uuid')
                  const teamId = teamIdOfInvite(invite)
                  const team = teams.find((item) => sameId(teamIdOf(item), teamId))
                  const teamName = valueOf(invite, 'teamName', 'team_name') || valueOf(invite?.team, 'name', 'title') || valueOf(team, 'name', 'title')
                  const sender = valueOf(invite, 'senderName', 'sender_name', 'inviterName', 'inviter_name', 'createdByName', 'created_by_name') || personName(invite?.sender || invite?.inviter)
                  const role = valueOf(invite, 'professionalRole', 'professional_role', 'role')
                  return (
                    <li className="ptw-invite-card" key={asText(id) || `received-${index}`}>
                      <div className="ptw-invite-heading"><span className="ptw-invite-mark"><Icon name="team" /></span><div><strong>{asText(teamName) || 'Nome da equipe não informado'}</strong><small>{sender ? `Convidado por ${sender}.` : 'Convite para participar de uma equipe.'}</small></div></div>
                      <div className="ptw-invite-meta"><span>{roleText(role)}</span><span>{statusLabel(statusOf(invite))}</span></div>
                      {id ? <div className="ptw-invite-actions"><button type="button" className="ptw-button ptw-button-primary" onClick={() => onAcceptInvite?.(id)} disabled={isBusy || !onAcceptInvite}>Aceitar convite</button><button type="button" className="ptw-button ptw-button-secondary" onClick={() => askDeclineInvite(invite)} disabled={isBusy || !onDeclineInvite}>Recusar</button></div> : <p className="ptw-inline-note"><Icon name="info" /> Este convite não contém um identificador para ação.</p>}
                      <p className="ptw-invite-safety">Aceitar o convite não compartilha pacientes. Qualquer concessão e consentimento são tratados separadamente.</p>
                    </li>
                  )
                })}
              </ul>
            ) : isBusy && !invites.length ? (
              <div className="ptw-empty ptw-empty-compact"><strong>Carregando convites…</strong><span>As pendências aparecerão quando os dados estiverem disponíveis.</span></div>
            ) : (
              <div className="ptw-empty ptw-empty-compact"><strong>Nenhum convite recebido pendente</strong><span>Quando alguém convidar você para uma equipe, o convite aparecerá aqui para aceite ou recusa.</span></div>
            )}
            {historicalInvites.length ? (
              <details className="ptw-history">
                <summary>Histórico de convites ({historicalInvites.length})</summary>
                <ul>{historicalInvites.map((invite, index) => {
                  const team = teams.find((item) => sameId(teamIdOf(item), teamIdOfInvite(invite)))
                  const label = valueOf(invite, 'teamName', 'team_name') || valueOf(invite?.team, 'name', 'title') || valueOf(team, 'name', 'title') || valueOf(invite, 'email') || 'Convite'
                  return <li key={asText(valueOf(invite, 'id', 'inviteId', 'invite_id')) || `history-${index}`}><span>{label}</span><span className={`ptw-history-state is-${statusOf(invite)}`}>{statusLabel(statusOf(invite))}</span></li>
                })}</ul>
              </details>
            ) : null}
          </section>

          <section className="ptw-policy" aria-labelledby="ptw-policy-title">
            <span className="ptw-policy-icon"><Icon name="shield" /></span>
            <div><h3 id="ptw-policy-title">Vínculos independentes</h3><p>Cada equipe tem seu próprio responsável e membros. Remover alguém, sair ou cancelar um convite afeta somente aquela equipe ou convite. A carteira permanece própria de cada profissional e a assinatura não é transferida.</p></div>
          </section>
          <p className="ptw-current-user"><Icon name="person" /><span>Conta profissional: <strong>{userName}</strong></span></p>
        </aside>
      </div>

      {dialog ? <CreateOrInviteDialog key={`${dialog.kind}-${asText(dialog.teamId)}`} dialog={dialog} teams={teams} busy={isBusy} onCreateTeam={onCreateTeam} onInviteMember={onInviteMember} onClose={() => setDialog(null)} /> : null}
      {confirmation ? <ConfirmationDialog confirmation={confirmation} busy={isBusy} onConfirm={executeConfirmation} onClose={() => setConfirmation(null)} /> : null}
    </section>
  )
}
