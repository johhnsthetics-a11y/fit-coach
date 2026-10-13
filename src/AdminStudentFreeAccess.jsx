import { useEffect, useMemo, useState } from 'react'
import {
  grantRemoteStudentFreeAccess,
  loadRemoteStudentFreeAccessGrants,
  revokeRemoteStudentFreeAccess,
} from './supabaseApi'

const beneficiaryLabels = {
  student: 'Aluno',
  patient: 'Paciente',
}

function formatAdminDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminStudentFreeAccess() {
  const [grants, setGrants] = useState([])
  const [email, setEmail] = useState('')
  const [beneficiaryType, setBeneficiaryType] = useState('student')
  const [reason, setReason] = useState('Validação integral do aplicativo')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revokingEmail, setRevokingEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function refreshGrants() {
    setLoading(true)
    setError('')
    try {
      setGrants(await loadRemoteStudentFreeAccessGrants())
    } catch (loadError) {
      setError(loadError?.message || 'Não foi possível carregar as liberações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshGrants()
  }, [])

  const filteredGrants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return grants.filter((grant) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? grant.active : !grant.active)
      const matchesSearch = !normalizedSearch
        || grant.email.toLowerCase().includes(normalizedSearch)
        || grant.reason.toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [grants, search, statusFilter])

  const activeCount = grants.filter((grant) => grant.active).length
  const matchedCount = grants
    .filter((grant) => grant.active)
    .reduce((total, grant) => total + grant.matchedProfiles, 0)

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const grant = await grantRemoteStudentFreeAccess({ email, beneficiaryType, reason })
      setEmail('')
      setMessage(`${beneficiaryLabels[grant.beneficiaryType]} liberado com sucesso. O acesso será reconhecido pelo e-mail ${grant.email}.`)
      await refreshGrants()
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível liberar este e-mail.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(grant) {
    if (revokingEmail || !grant.active) return
    const confirmed = window.confirm(`Revogar o acesso gratuito de ${grant.email}?`)
    if (!confirmed) return
    setRevokingEmail(grant.email)
    setMessage('')
    setError('')
    try {
      await revokeRemoteStudentFreeAccess(grant.email)
      setMessage(`Liberação de ${grant.email} revogada. As regras normais de cobrança voltam a valer.`)
      await refreshGrants()
    } catch (revokeError) {
      setError(revokeError?.message || 'Não foi possível revogar esta liberação.')
    } finally {
      setRevokingEmail('')
    }
  }

  return (
    <div className="grid gap-5 lg:gap-6">
      <section className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-zinc-950/85 shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 bg-gradient-to-r from-emerald-300/12 via-cyan-300/5 to-transparent p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-300">Controle de contas de teste</p>
          <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">Liberações gratuitas</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Autorize um aluno ou paciente pelo e-mail exato. Enquanto a liberação estiver ativa, o sistema ignora a cobrança do Coach Fit Pro e também a mensalidade do profissional, sem apagar o histórico financeiro.
          </p>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleSubmit} className="grid content-start gap-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <div>
              <p className="text-xs font-black uppercase text-emerald-300">Nova liberação</p>
              <h4 className="mt-1 text-xl font-black text-white">Acesso integral por e-mail</h4>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Pode ser cadastrado antes ou depois da criação da conta. O reconhecimento ocorre automaticamente no login.</p>
            </div>

            <label className="grid gap-2 text-sm font-bold text-zinc-200">
              E-mail do aluno ou paciente
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teste@exemplo.com"
                className="min-h-12 rounded-lg border border-white/10 bg-zinc-950 px-3 text-base text-white outline-none transition focus:border-emerald-300/60 sm:text-sm"
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-bold text-zinc-200">Perfil que será validado</legend>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(beneficiaryLabels).map(([value, label]) => (
                  <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition ${beneficiaryType === value ? 'border-emerald-300/55 bg-emerald-300/12 text-emerald-100' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'}`}>
                    <input
                      type="radio"
                      name="beneficiaryType"
                      value={value}
                      checked={beneficiaryType === value}
                      onChange={() => setBeneficiaryType(value)}
                      className="h-4 w-4 accent-emerald-400"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-bold text-zinc-200">
              Motivo interno
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ex.: validação do fluxo do paciente"
                className="resize-y rounded-lg border border-white/10 bg-zinc-950 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-emerald-300/60"
              />
              <span className="text-xs font-medium text-zinc-500">Visível somente no Admin Master.</span>
            </label>

            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-3 text-xs leading-5 text-cyan-50">
              <strong className="block font-black">Liberação completa</strong>
              Treinos, dieta, check-ins, mensagens, agenda, progresso e histórico ficam disponíveis. Nenhum checkout é gerado para esse e-mail.
            </div>

            <button disabled={saving} className="min-h-12 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Liberando acesso...' : 'Liberar acesso gratuito'}
            </button>
          </form>

          <div className="grid content-start gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminAccessMetric label="Ativos" value={activeCount} detail="e-mails liberados" tone="emerald" />
              <AdminAccessMetric label="Perfis encontrados" value={matchedCount} detail="contas já vinculadas" tone="cyan" />
              <AdminAccessMetric label="Histórico" value={grants.length} detail="registros preservados" tone="zinc" />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar e-mail ou motivo"
                className="min-h-11 min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/60"
              />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-zinc-200 outline-none focus:border-emerald-300/60">
                <option value="active">Ativos</option>
                <option value="inactive">Revogados</option>
                <option value="all">Todos</option>
              </select>
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm font-bold text-zinc-400">Carregando liberações...</div>
            ) : filteredGrants.length ? (
              <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
                {filteredGrants.map((grant) => (
                  <article key={grant.id || grant.email} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${grant.active ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-zinc-600/50 bg-zinc-800/60 text-zinc-400'}`}>
                            {grant.active ? 'Ativo' : 'Revogado'}
                          </span>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2.5 py-1 text-[11px] font-black text-cyan-100">
                            {beneficiaryLabels[grant.beneficiaryType] || 'Aluno'}
                          </span>
                          <span className="text-xs font-bold text-zinc-500">{grant.matchedProfiles ? `${grant.matchedProfiles} perfil vinculado` : 'Aguardando cadastro'}</span>
                        </div>
                        <h5 className="mt-3 break-all text-base font-black text-white">{grant.email}</h5>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">{grant.reason || 'Sem motivo informado.'}</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                          {grant.active ? `Atualizado em ${formatAdminDate(grant.updatedAt)}` : `Revogado em ${formatAdminDate(grant.revokedAt)}`}
                          {grant.createdByEmail ? ` por ${grant.createdByEmail}` : ''}
                        </p>
                      </div>
                      {grant.active ? (
                        <button
                          type="button"
                          disabled={revokingEmail === grant.email}
                          onClick={() => handleRevoke(grant)}
                          className="min-h-10 shrink-0 rounded-lg border border-rose-300/30 bg-rose-300/10 px-4 text-sm font-black text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-wait disabled:opacity-60"
                        >
                          {revokingEmail === grant.email ? 'Revogando...' : 'Revogar'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
                <p className="font-black text-zinc-200">Nenhuma liberação encontrada</p>
                <p className="mt-1 text-sm text-zinc-500">Cadastre um e-mail ou altere os filtros.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {message ? <p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">{error}</p> : null}
    </div>
  )
}

function AdminAccessMetric({ label, value, detail, tone }) {
  const tones = {
    emerald: 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100',
    cyan: 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100',
    zinc: 'border-white/10 bg-white/[0.035] text-zinc-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.zinc}`}>
      <p className="text-xs font-black uppercase opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-65">{detail}</p>
    </div>
  )
}

