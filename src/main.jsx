import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function installSafeDomMutationGuards() {
  if (typeof Node === 'undefined') return
  if (Node.prototype.__coachFitProSafeDomGuards) return

  const nativeRemoveChild = Node.prototype.removeChild
  const nativeInsertBefore = Node.prototype.insertBefore
  const nativeReplaceChild = Node.prototype.replaceChild

  Object.defineProperty(Node.prototype, '__coachFitProSafeDomGuards', {
    configurable: false,
    enumerable: false,
    value: true,
  })

  Node.prototype.removeChild = function removeChildSafely(child) {
    if (child && child.parentNode !== this) return child
    return nativeRemoveChild.call(this, child)
  }

  Node.prototype.insertBefore = function insertBeforeSafely(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return nativeInsertBefore.call(this, newNode, referenceNode)
  }

  Node.prototype.replaceChild = function replaceChildSafely(newChild, oldChild) {
    if (oldChild && oldChild.parentNode !== this) {
      return this.appendChild(newChild)
    }
    return nativeReplaceChild.call(this, newChild, oldChild)
  }
}

installSafeDomMutationGuards()

function isRecoverableDomMutationError(error) {
  const message = `${error?.name || ''} ${error?.message || ''}`.toLowerCase()
  return message.includes('notfounderror')
    && (message.includes('removechild') || message.includes('insertbefore') || message.includes('replacechild') || message.includes('node'))
}

async function clearAppRuntimeCacheAndReload() {
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys()
      await Promise.all(keys.filter((key) => key.includes('coach-fit-pro')).map((key) => window.caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    window.localStorage.removeItem('coachfitpro-last-error')
    window.localStorage.removeItem('coachfitpro-last-view-error')
  } catch {
    // Recarrega mesmo se o navegador bloquear alguma API de cache.
  } finally {
    window.location.reload()
  }
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false, recoverableDomError: false }
  }

  static getDerivedStateFromError(error) {
    return { failed: true, recoverableDomError: isRecoverableDomMutationError(error) }
  }

  componentDidCatch(error) {
    console.error('Coach Fit Pro interface error', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
          <section className="w-full max-w-lg rounded-md border border-white/10 bg-zinc-950/90 p-6 text-center shadow-2xl">
            <p className="text-xs font-black uppercase text-emerald-300">Coach Fit Pro</p>
            <h1 className="mt-3 text-2xl font-black">Não foi possível exibir esta tela</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Seus dados salvos não foram apagados. Atualize o aplicativo para tentar novamente.</p>
            <button type="button" onClick={clearAppRuntimeCacheAndReload} className="mt-6 w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950">
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
