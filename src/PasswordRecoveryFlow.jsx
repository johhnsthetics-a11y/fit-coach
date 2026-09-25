import React, { useEffect, useMemo, useState } from 'react'
import fitCoachLogo from './fit-coach-logo.png'
import { requestCoachPasswordReset, updateRecoveredPassword, verifyRecoveredPasswordChange } from './supabaseApi'

export function isPasswordRecoveryRoute() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const mode = url.searchParams.get('mode') || ''
  return (url.pathname === '/login' || url.pathname.endsWith('/login'))
    && (mode === 'forgot-password' || mode === 'recovery' || hash.get('type') === 'recovery')
}

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

function EyeIcon({ hidden }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.6 10.6 0 0112 4c5.1 0 8.8 4.4 9.7 6.1a3.9 3.9 0 010 3.8 14.1 14.1 0 01-2.5 3.1M6.6 6.7A14.6 14.6 0 002.3 10a3.9 3.9 0 000 3.8C3.2 15.6 6.9 20 12 20a10.5 10.5 0 004.1-.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.3 10.1C3.2 8.4 6.9 4 12 4s8.8 4.4 9.7 6.1a3.9 3.9 0 010 3.8C20.8 15.6 17.1 20 12 20S3.2 15.6 2.3 13.9a3.9 3.9 0 010-3.8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
  allowVisibilityToggle = false,
}) {
  const [visible, setVisible] = useState(false)
  const effectiveType = allowVisibilityToggle ? (visible ? 'text' : 'password') : type

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">{label}</span>
      <span className="relative block">
        <input
          type={effectiveType}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white ${allowVisibilityToggle ? 'pr-12' : ''}`}
        />
        {allowVisibilityToggle && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-zinc-500 transition hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:text-zinc-400 dark:hover:text-white"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
          >
            <EyeIcon hidden={!visible} />
          </button>
        )}
      </span>
    </label>
  )
}

function RecoveryShell({ title, description, eyebrow, children }) {
  return (
    <main className="min-h-screen bg-[#F8FAFA] px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-white sm:grid sm:place-items-center sm:py-12">
      <section className="mx-auto w-full max-w-[440px] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-6 pb-5 pt-7 dark:border-zinc-800 sm:px-8 sm:pt-8">
          <img
            src={fitCoachLogo}
            alt="Coach Fit Pro"
            className="mb-5 h-10 w-auto max-w-[180px] object-contain object-left"
          />
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          {children}
        </div>
      </section>
    </main>
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
      const updatedAccount = await updateRecoveredPassword(recoveryToken, newPassword)
      await verifyRecoveredPasswordChange(updatedAccount.email, newPassword)
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
        eyebrow="Acesso à conta"
        title="Recuperar senha"
        description="Informe o e-mail usado na sua conta. Enviaremos um link seguro para você criar uma nova senha."
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

          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-5 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>}

          {!done && (
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          )}

          <button
            type="button"
            onClick={goToSignIn}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Voltar para o login
          </button>
        </form>
      </RecoveryShell>
    )
  }

  if (route.mode === 'recovery') {
    return (
      <RecoveryShell
        eyebrow="Segurança da conta"
        title="Criar nova senha"
        description="Crie uma nova senha para acessar sua conta."
      >
        {done ? (
          <div className="space-y-4">
            <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-5 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>
            <button type="button" onClick={goToSignIn} className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20">
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={updatePassword} className="space-y-4">
            <Field
              label="Nova senha"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              allowVisibilityToggle
            />
            <Field
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              allowVisibilityToggle
            />

            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Use pelo menos 8 caracteres e confirme a mesma senha nos dois campos.</p>

            {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
