import React, { useEffect, useMemo, useState } from 'react'
import { requestCoachPasswordReset, updateRecoveredPassword } from './supabaseApi'

function getRouteState() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const hashType = hash.get('type') || ''
  const accessToken = hash.get('access_token') || ''
  const mode = url.searchParams.get('mode') || ''

  return {
    isLogin: url.pathname === '/login' || url.pathname.endsWith('/login'),
    mode,
    recoveryToken: hashType === 'recovery' ? accessToken : '',
  }
}

function replaceMode(mode) {
  const url = new URL(window.location.href)
  url.hash = ''
  if (mode) url.searchParams.set('mode', mode)
  else url.searchParams.delete('mode')
  window.history.replaceState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function goToSignIn() {
  const url = new URL(window.location.href)
  url.hash = ''
  url.search = ''
  url.searchParams.set('mode', 'signin')
  window.history.replaceState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Field({ label, type = 'text', value, onChange, autoComplete, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
    </label>
  )
}

function RecoveryShell({ title, description, children }) {
  return (
    <div className="fixed inset-0 z-[10000] grid min-h-screen place-items-center overflow-y-auto bg-zinc-50/98 p-4 dark:bg-zinc-950/98">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Coach Fit Pro</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        {children}
      </section>
    </div>
  )
}

export default function PasswordRecoveryFlow() {
  const initial = useMemo(getRouteState, [])
  const [route, setRoute] = useState(initial)
  const [recoveryToken, setRecoveryToken] = useState(initial.recoveryToken)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const syncRoute = () => setRoute(getRouteState())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    const current = getRouteState()
    if (!current.recoveryToken) return

    setRecoveryToken(current.recoveryToken)
    const cleanUrl = new URL(window.location.href)
    cleanUrl.hash = ''
    cleanUrl.searchParams.set('mode', 'recovery')
    window.history.replaceState({}, '', cleanUrl)
    setRoute(getRouteState())
  }, [])

  const openForgotPassword = () => {
    setError('')
    setMessage('')
    setDone(false)
    replaceMode('forgot-password')
  }

  const requestReset = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Informe um e-mail válido.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      await requestCoachPasswordReset(normalizedEmail)
      setDone(true)
      setMessage('Se existir uma conta vinculada a este e-mail, enviaremos as instruções para redefinir a senha.')
    } catch {
      setError('Não foi possível enviar o e-mail agora. Tente novamente em alguns instantes.')
    } finally {
      setBusy(false)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!recoveryToken) {
      setError('Este link de recuperação é inválido ou expirou. Solicite um novo e-mail.')
      return
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setBusy(true)
    try {
      await updateRecoveredPassword(recoveryToken, newPassword)
      setDone(true)
      setRecoveryToken('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Senha alterada com sucesso. Agora você pode entrar com a nova senha.')
    } catch {
      setError('Não foi possível alterar a senha. O link pode ter expirado; solicite uma nova recuperação.')
    } finally {
      setBusy(false)
    }
  }

  if (!route.isLogin) return null

  if (route.mode === 'forgot-password') {
    return (
      <RecoveryShell
        title="Recuperar senha"
        description="Informe o e-mail usado na sua conta. Você receberá um link seguro para criar uma nova senha."
      >
        <form onSubmit={requestReset} className="space-y-4">
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="seuemail@exemplo.com"
          />

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>}

          {!done && (
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          )}

          <button type="button" onClick={goToSignIn} className="w-full px-4 py-2 text-sm font-bold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Voltar para o login
          </button>
        </form>
      </RecoveryShell>
    )
  }

  if (route.mode === 'recovery') {
    return (
      <RecoveryShell
        title="Criar nova senha"
        description="Defina uma nova senha para sua conta. Por segurança, o link de recuperação é temporário."
      >
        {done ? (
          <div className="space-y-4">
            <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>
            <button type="button" onClick={goToSignIn} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={updatePassword} className="space-y-4">
            <Field
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
            />
            <Field
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
            />

            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </RecoveryShell>
    )
  }

  if (route.mode && route.mode !== 'signin') return null

  return (
    <button
      type="button"
      onClick={openForgotPassword}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[9999] rounded-full border border-zinc-200 bg-white/95 px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-lg backdrop-blur transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300 sm:right-6"
      aria-label="Recuperar senha"
    >
      Esqueci minha senha
    </button>
  )
}
