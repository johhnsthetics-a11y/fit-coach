import { useEffect, useRef, useState } from 'react'
import './student-professional-collaboration-build41.css'

function formatRequestedAt(value) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getAreaDetails(area) {
  if (area === 'nutrition') {
    return {
      label: 'Nutrição',
      action: 'criar e editar planos alimentares para você',
      data: 'acessar somente os dados dietéticos necessários ao workspace',
      icon: 'nutrition',
    }
  }

  if (area === 'workout') {
    return {
      label: 'Treino',
      action: 'criar e editar treinos para você',
      data: 'consultar os respectivos registros de treino',
      icon: 'workout',
    }
  }

  return {
    label: 'Colaboração profissional',
    action: 'colaborar com você nesta área',
    data: 'acessar somente os dados necessários ao workspace',
    icon: 'generic',
  }
}

function AreaIcon({ area }) {
  if (area === 'nutrition') {
    return (
      <svg className="spcr-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20c-4.3 0-7-3.3-7-7.2C5 8.5 8 5.8 12 4c4 1.8 7 4.5 7 8.8C19 16.7 16.3 20 12 20Z" />
        <path d="M12 19c-.2-4.8 1.2-8.2 4.3-11M12 13c-1.2-1.3-2.6-2.2-4.1-2.8" />
      </svg>
    )
  }

  if (area === 'workout') {
    return (
      <svg className="spcr-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" />
        <path d="M4 10v4M20 10v4" />
      </svg>
    )
  }

  return (
    <svg className="spcr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 19 7v5.2c0 4.4-2.9 7.3-7 8.8-4.1-1.5-7-4.4-7-8.8V7l7-3.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="spcr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a6.5 6.5 0 0 1 11-2L20 12M4 12l2.9 5a6.5 6.5 0 0 0 11-2" />
    </svg>
  )
}

function RequestCard({ request, busy, onRespond, onRequestRevoke }) {
  const isAccepted = request.consentStatus === 'accepted'
  const ownerAuthorized = request.authorizationSource === 'team_owner'
  const area = getAreaDetails(request.area)
  const professionalName = request.professionalName || 'Profissional'
  const professionalRole = request.professionalRole || 'Profissional de saúde'
  const teamName = request.teamName || 'Equipe não informada'

  function respond(action) {
    if (busy) return
    onRespond?.(request.delegationId, action)
  }

  return (
    <article
      className={`spcr-card${isAccepted ? ' spcr-card--accepted' : ' spcr-card--pending'}`}
      aria-label={`${isAccepted ? 'Acesso ativo' : 'Solicitação pendente'} de ${area.label} por ${professionalName}`}
    >
      <div className="spcr-card-head">
        <div className="spcr-card-identity">
          <span className={`spcr-area-icon spcr-area-icon--${area.icon}`}>
            <AreaIcon area={request.area} />
          </span>
          <div className="spcr-identity-copy">
          <p className="spcr-card-eyebrow">{isAccepted ? (ownerAuthorized ? 'Acesso habilitado pela equipe' : 'Colaboração autorizada') : 'Solicitação de colaboração'}</p>
            <h3>{professionalName}</h3>
            <p className="spcr-professional-meta">
              <span>{professionalRole}</span>
              <span className="spcr-meta-dot" aria-hidden="true">·</span>
              <span>{teamName}</span>
            </p>
          </div>
        </div>
        <span className={`spcr-status-pill${isAccepted ? ' spcr-status-pill--accepted' : ' spcr-status-pill--pending'}`}>
          <span className="spcr-status-dot" aria-hidden="true" />
          {isAccepted ? 'Acesso ativo' : 'Aguardando você'}
        </span>
      </div>

      <div className="spcr-card-facts" aria-label="Detalhes da colaboração">
        <span className="spcr-fact spcr-fact--area">Área: {area.label}</span>
        <span className="spcr-fact">Solicitada em {formatRequestedAt(request.requestedAt)}</span>
        {request.consentVersion && !ownerAuthorized ? <span className="spcr-fact">Registro v{request.consentVersion}</span> : null}
      </div>

      <div className="spcr-scope">
        <p className="spcr-scope-title">{isAccepted ? 'O que este acesso permite' : 'Escopo da solicitação'}</p>
        <p>
          {isAccepted ? (ownerAuthorized ? <>O responsável da equipe incluiu </> : <>Você autorizou </>) : <>A solicitação permite que </>}<strong>{professionalName}</strong>, da equipe <strong>{teamName}</strong>,
          {' '}na área de <strong>{area.label}</strong>, a {area.action} e {area.data}.
        </p>
        <p className="spcr-scope-boundary">
          Isso não concede acesso geral às suas mensagens, informações financeiras ou aos dados de outros pacientes.
        </p>
      </div>

      {isAccepted ? (
        <div className="spcr-card-footer spcr-card-footer--accepted">
          <p className="spcr-revoke-note">Você pode revogar este acesso quando quiser.</p>
          <button
            className="spcr-button spcr-button--revoke"
            type="button"
            disabled={busy}
            onClick={() => onRequestRevoke(request)}
          >
            Revogar acesso
          </button>
        </div>
      ) : (
        <div className="spcr-card-footer">
          <p className="spcr-decision-hint">Revise o escopo antes de decidir. Você pode recusar sem liberar este acesso.</p>
          <div className="spcr-actions">
            <button
              className="spcr-button spcr-button--quiet"
              type="button"
              disabled={busy}
              onClick={() => respond('decline')}
            >
              Recusar
            </button>
            <button
              className="spcr-button spcr-button--accept"
              type="button"
              disabled={busy}
              onClick={() => respond('accept')}
            >
              Aceitar consentimento
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function StudentProfessionalCollaborationRequests({
  requests = [],
  busy = false,
  error = '',
  notice = '',
  onRefresh,
  onRespond,
  uiTheme = 'dark',
}) {
  const [revokeTarget, setRevokeTarget] = useState(null)
  const revokeDialogRef = useRef(null)
  const safeRequests = Array.isArray(requests) ? requests : []
  const pendingCount = safeRequests.filter((request) => request?.consentStatus === 'pending').length
  const acceptedCount = safeRequests.filter((request) => request?.consentStatus === 'accepted').length
  const theme = uiTheme === 'light' ? 'light' : 'dark'

  useEffect(() => {
    const dialog = revokeDialogRef.current
    if (!dialog) return

    if (revokeTarget && !dialog.open) dialog.showModal()
    if (!revokeTarget && dialog.open) dialog.close()
  }, [revokeTarget])

  function confirmRevoke() {
    if (busy || !revokeTarget) return
    const target = revokeTarget
    setRevokeTarget(null)
    onRespond?.(target.delegationId, 'revoke')
  }

  return (
    <section className="spcr" data-theme={theme} aria-labelledby="spcr-title">
      <header className="spcr-header">
        <div className="spcr-heading-copy">
          <p className="spcr-kicker">Privacidade e acessos</p>
          <h2 id="spcr-title">Colaboração profissional</h2>
          <p className="spcr-intro">
            Consulte os profissionais com acesso ao seu plano. O responsável da equipe administra o acesso conforme o plano contratado; você pode pedir a remoção ao responsável.
          </p>
        </div>
        <button
          className="spcr-button spcr-button--refresh"
          type="button"
          disabled={busy || typeof onRefresh !== 'function'}
          onClick={() => onRefresh?.()}
          aria-label={busy ? 'Atualizando solicitações' : 'Atualizar solicitações'}
        >
          <RefreshIcon />
          <span>{busy ? 'Atualizando…' : 'Atualizar'}</span>
        </button>
      </header>

      <div className="spcr-summary" aria-label="Resumo das colaborações">
        <span><strong>{pendingCount}</strong> {pendingCount === 1 ? 'solicitação pendente' : 'solicitações pendentes'}</span>
        <span className="spcr-summary-divider" aria-hidden="true" />
        <span><strong>{acceptedCount}</strong> {acceptedCount === 1 ? 'acesso ativo' : 'acessos ativos'}</span>
      </div>

      {busy ? (
        <div className="spcr-feedback spcr-feedback--loading" role="status" aria-live="polite">
          <span className="spcr-loader" aria-hidden="true" />
          <span>{safeRequests.length ? 'Atualizando solicitações… As ações estão temporariamente bloqueadas.' : 'Carregando solicitações de colaboração…'}</span>
        </div>
      ) : null}

      {error ? <div className="spcr-feedback spcr-feedback--error" role="alert">{error}</div> : null}
      {notice ? <div className="spcr-feedback spcr-feedback--notice" role="status" aria-live="polite">{notice}</div> : null}

      {safeRequests.length === 0 ? (
        busy ? null : (
          <div className="spcr-empty" role="status">
            <span className="spcr-empty-mark" aria-hidden="true"><AreaIcon area="generic" /></span>
            <h3>Nenhuma colaboração por enquanto</h3>
            <p>Quando um profissional receber acesso ao seu acompanhamento, a área e o profissional responsável aparecerão aqui.</p>
          </div>
        )
      ) : (
        <div className="spcr-list" aria-label="Solicitações e acessos profissionais">
          {safeRequests.map((request, index) => (
            <RequestCard
              key={request?.delegationId || `${request?.professionalId || 'professional'}-${request?.area || 'area'}-${index}`}
              request={request || {}}
              busy={busy}
              onRespond={onRespond}
              onRequestRevoke={setRevokeTarget}
            />
          ))}
        </div>
      )}

      <dialog
        ref={revokeDialogRef}
        className="spcr-dialog"
        aria-labelledby="spcr-dialog-title"
        aria-describedby="spcr-dialog-description"
        onCancel={(event) => {
          event.preventDefault()
          setRevokeTarget(null)
        }}
      >
        {revokeTarget ? (() => {
          const area = getAreaDetails(revokeTarget.area)
          return (
            <div className="spcr-dialog-content">
              <p className="spcr-kicker">Confirmação necessária</p>
              <h2 id="spcr-dialog-title">Revogar acesso?</h2>
              <p id="spcr-dialog-description">
                Você está prestes a revogar o acesso de <strong>{revokeTarget.professionalName || 'Profissional'}</strong>,
                {' '}da equipe <strong>{revokeTarget.teamName || 'Equipe não informada'}</strong>, na área de <strong>{area.label}</strong>.
                {' '}Esta ação encerra o consentimento desta colaboração.
              </p>
              <div className="spcr-dialog-actions">
                <button className="spcr-button spcr-button--quiet" type="button" onClick={() => setRevokeTarget(null)}>
                  Manter acesso
                </button>
                <button className="spcr-button spcr-button--revoke-confirm" type="button" disabled={busy} onClick={confirmRevoke}>
                  Confirmar revogação
                </button>
              </div>
            </div>
          )
        })() : null}
      </dialog>
    </section>
  )
}
