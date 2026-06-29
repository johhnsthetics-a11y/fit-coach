import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('FIT COACH interface error', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
          <section className="w-full max-w-lg rounded-md border border-white/10 bg-zinc-950/90 p-6 text-center shadow-2xl">
            <p className="text-xs font-black uppercase text-emerald-300">FIT COACH</p>
            <h1 className="mt-3 text-2xl font-black">Não foi possível exibir esta tela</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Seus dados salvos não foram apagados. Atualize o aplicativo para tentar novamente.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950">
              Atualizar aplicativo
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}
