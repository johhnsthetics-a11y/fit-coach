import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildStudentImportTemplate, prepareStudentImportRows } from './studentImport'

const STATUS_LABELS = {
  ready: 'Pronto',
  duplicate: 'Duplicado',
  invalid: 'Corrigir',
}

const STATUS_CLASSES = {
  ready: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  duplicate: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  invalid: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
}

function downloadTemplate() {
  const blob = new Blob([buildStudentImportTemplate()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-importacao-coach-fit-pro.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function StudentImportDialog({
  open,
  onClose,
  onImport,
  students = [],
  plans = [],
  nutritionist = false,
}) {
  const [sourceText, setSourceText] = useState('')
  const [defaultPlanName, setDefaultPlanName] = useState(plans[0]?.name || 'Acompanhamento mensal')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const clientLabel = nutritionist ? 'pacientes' : 'alunos'
  const singularLabel = nutritionist ? 'paciente' : 'aluno'

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !importing) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, importing, onClose])

  useEffect(() => {
    if (plans.some((plan) => plan.name === defaultPlanName)) return
    setDefaultPlanName(plans[0]?.name || 'Acompanhamento mensal')
  }, [plans, defaultPlanName])

  const readyRows = useMemo(() => (
    preview?.rows.filter((row) => row.status === 'ready') ?? []
  ), [preview])

  if (!open) return null

  function analyzeText(text = sourceText) {
    if (!text.trim()) {
      setError('Selecione um CSV ou cole os dados da planilha para continuar.')
      setPreview(null)
      return
    }
    const nextPreview = prepareStudentImportRows({
      text,
      existingStudents: students,
      plans,
      defaultPlanName,
    })
    setPreview(nextPreview)
    setResult(null)
    setError(nextPreview.rows.length ? '' : 'Nenhuma linha de dados foi encontrada na planilha.')
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.csv$/i.test(file.name) && !['text/csv', 'text/plain', 'application/vnd.ms-excel'].includes(file.type)) {
      setError('Use um arquivo CSV. Para Excel, exporte como CSV ou cole as células abaixo.')
      return
    }
    try {
      const text = await file.text()
      setSourceText(text)
      setError('')
      analyzeText(text)
    } catch {
      setError('Não foi possível ler o arquivo selecionado.')
    } finally {
      event.target.value = ''
    }
  }

  async function confirmImport() {
    if (!readyRows.length || importing) return
    setImporting(true)
    setError('')
    try {
      const response = await onImport(readyRows.map((row) => ({
        ...row.student,
        importLine: row.lineNumber,
      })))
      setResult(response)
      if (response.failed.length) {
        setError(`${response.failed.length} registro(s) não foram importados. Revise o relatório abaixo.`)
      }
    } catch (importError) {
      setError(importError?.message || `Não foi possível importar os ${clientLabel}.`)
    } finally {
      setImporting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-import-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !importing) onClose()
      }}
    >
      <section className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-300">Migração segura</p>
            <h2 id="student-import-title" className="mt-1 text-xl font-black text-white sm:text-2xl">Importar {clientLabel}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
              Traga sua carteira por CSV ou cole dados do Excel e Google Sheets. Nenhum acesso ou cobrança será criado automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            aria-label="Fechar importação"
            title="Fechar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-2xl text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="grid content-start gap-4">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-white">1. Adicione os dados</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">Campos obrigatórios: nome e e-mail.</p>
                  </div>
                  <button type="button" onClick={downloadTemplate} className="min-h-11 rounded-md border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/10">
                    Baixar modelo CSV
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} className="sr-only" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 min-h-12 w-full rounded-md bg-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-cyan-200">
                  Selecionar arquivo CSV
                </button>
              </div>

              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Colar dados da planilha
                <textarea
                  value={sourceText}
                  onChange={(event) => {
                    setSourceText(event.target.value)
                    setPreview(null)
                    setResult(null)
                  }}
                  rows={9}
                  spellCheck="false"
                  placeholder={'nome,email,telefone,cpf,objetivo,plano\nMaria,maria@email.com,11999990000,12345678901,Emagrecimento,Mensal'}
                  className="min-h-48 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm leading-6 text-zinc-100 outline-none focus:border-cyan-300/50"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Plano padrão para linhas sem plano válido
                <select
                  value={defaultPlanName}
                  onChange={(event) => {
                    setDefaultPlanName(event.target.value)
                    setPreview(null)
                    setResult(null)
                  }}
                  className="min-h-12 rounded-md border border-white/10 bg-zinc-900 px-3 text-base text-zinc-100 outline-none focus:border-emerald-300/50"
                >
                  {(plans.length ? plans : [{ name: 'Acompanhamento mensal' }]).map((plan) => (
                    <option key={plan.name} value={plan.name}>{plan.name}</option>
                  ))}
                </select>
              </label>

              <button type="button" onClick={() => analyzeText()} className="min-h-12 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/20">
                Revisar importação
              </button>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-white">2. Confira antes de importar</p>
                  <p className="mt-1 text-sm text-zinc-400">Duplicados e linhas inválidas nunca serão enviados.</p>
                </div>
                {preview ? (
                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">{preview.counts.ready} prontos</span>
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-100">{preview.counts.duplicate} duplicados</span>
                    <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-rose-100">{preview.counts.invalid} para corrigir</span>
                  </div>
                ) : null}
              </div>

              {preview?.rows.length ? (
                <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                  {preview.rows.slice(0, 200).map((row, index) => (
                    <article key={`${row.lineNumber}-${index}`} className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">{row.student.name || `Linha ${row.lineNumber}`}</p>
                          <p className="mt-1 break-all text-xs text-zinc-400">{row.student.email || 'E-mail não informado'}</p>
                          <p className="mt-1 text-xs text-zinc-500">{row.student.plan || 'Plano não identificado'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_CLASSES[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </div>
                      {row.errors.map((message) => <p key={message} className="mt-2 text-xs font-bold text-rose-200">{message}</p>)}
                      {row.warnings.map((message) => <p key={message} className="mt-2 text-xs font-bold text-amber-100">{message}</p>)}
                    </article>
                  ))}
                  {preview.rows.length > 200 ? <p className="py-2 text-center text-xs text-zinc-500">Mostrando as primeiras 200 linhas.</p> : null}
                </div>
              ) : (
                <div className="mt-6 grid min-h-56 place-items-center rounded-xl border border-dashed border-white/10 p-6 text-center">
                  <div>
                    <p className="font-black text-zinc-300">A pré-visualização aparecerá aqui</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">Selecione um CSV ou cole os dados e clique em “Revisar importação”.</p>
                  </div>
                </div>
              )}

              {result ? (
                <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4">
                  <p className="font-black text-emerald-100">Importação concluída</p>
                  <p className="mt-1 text-sm text-zinc-300">{result.imported.length} {clientLabel} importados e {result.failed.length} não importados.</p>
                  {result.failed.length ? (
                    <ul className="mt-3 space-y-1 text-xs text-rose-100">
                      {result.failed.slice(0, 20).map((item, index) => (
                        <li key={`${item.lineNumber}-${index}`}>Linha {item.lineNumber || '?'}: {item.name || singularLabel} — {item.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 bg-zinc-950/95 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-zinc-500">Após importar, revise a ficha e gere o acesso somente quando estiver pronto.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onClose} disabled={importing} className="min-h-11 rounded-md border border-white/15 px-4 py-2 text-sm font-black text-zinc-200 disabled:opacity-50">{result ? 'Concluir' : 'Cancelar'}</button>
            {!result ? (
              <button
                type="button"
                onClick={confirmImport}
                disabled={!readyRows.length || importing}
                className="min-h-11 rounded-md bg-emerald-300 px-5 py-2 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? 'Importando...' : `Importar ${readyRows.length} válidos`}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
