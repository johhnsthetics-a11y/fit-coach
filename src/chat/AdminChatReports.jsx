import { useCallback, useEffect, useState } from 'react'
import { loadRemoteChatReportsForAdmin, updateRemoteChatReportForAdmin } from '../supabaseApi'

const STATUS = { open: 'Pendente', reviewing: 'Em análise', resolved: 'Resolvida' }
const REASON = {
  harassment: 'Assédio/ofensas', spam: 'Spam', sexual_content: 'Conteúdo inadequado',
  privacy: 'Privacidade', hate_or_abuse: 'Discriminação/ameaças', other: 'Outro',
}
function when(value) {
  const date = new Date(value || '')
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Data indisponível'
}

export default function AdminChatReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await loadRemoteChatReportsForAdmin()
      setReports(rows)
    } catch (failure) {
      setError(failure?.message || 'Não foi possível carregar as denúncias.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh().catch(() => undefined) }, [refresh])

  async function update(id, status) {
    if (!id || workingId) return
    setWorkingId(id)
    setError('')
    try {
      await updateRemoteChatReportForAdmin(id, status)
      setReports(current => current.map(row => row.id === id ? { ...row, status } : row))
    } catch (failure) {
      setError(failure?.message || 'Não foi possível salvar a análise.')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <section aria-label="Moderação do chat" className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-white">Denúncias de conversas</h3>
          <p className="mt-1 text-sm text-zinc-400">Acesso exclusivo do Admin Master. As denúncias não são exibidas ao contato denunciado.</p>
        </div>
        <button type="button" disabled={loading} onClick={refresh} className="min-h-11 rounded-xl border border-emerald-300/30 px-4 text-sm font-bold text-emerald-200">
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </header>
      {error ? <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {!loading && !reports.length ? (
        <p className="rounded-xl border border-white/10 p-5 text-sm text-zinc-400">Nenhuma denúncia registrada.</p>
      ) : (
        <div className="grid gap-3">
          {reports.map(row => (
            <article key={row.id} className="min-w-0 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong className="text-sm text-white">{REASON[row.reason] || 'Denúncia'}</strong>
                  <p className="mt-1 text-xs text-zinc-400">{when(row.created_at)} · {row.reporter_role === 'student' ? 'Aluno/paciente' : 'Profissional'}</p>
                </div>
                <span className="text-xs font-bold text-emerald-200">{STATUS[row.status] || row.status}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-200">Aluno/paciente: {row.student_name || 'Cadastro indisponível'}</p>
              {row.message_excerpt ? <p className="mt-2 break-words rounded-lg bg-white/[0.035] p-3 text-sm text-zinc-300">Mensagem denunciada: {row.message_excerpt}</p> : null}
              {row.details ? <p className="mt-2 break-words text-sm text-zinc-300">Descrição: {row.details}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Status da denúncia">
                {[['reviewing', 'Iniciar análise'], ['resolved', 'Marcar resolvida'], ['open', 'Reabrir']].map(([value,label]) => (
                  <button key={value} type="button" onClick={() => update(row.id,value)}
                    disabled={Boolean(workingId) || row.status === value}
                    className="min-h-10 rounded-lg border border-white/20 px-3 text-xs font-bold text-zinc-100 disabled:opacity-40">{label}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
