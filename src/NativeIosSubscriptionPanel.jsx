import { useEffect, useState } from 'react'
import { loadIosProducts, restoreIosPurchases } from './iosStoreKit'
import { buildIosSubscriptionCards } from './iosProductPresentation'
import './nativeIosSubscription.css'

// Launch safety: an on-device StoreKit entitlement is not proof of ownership of
// the signed-in Coach Fit account. Purchases stay unavailable until a trusted
// server verifies Apple transactions and records account-linked entitlements.
export default function NativeIosSubscriptionPanel({ subscriptionActive = false, onRefreshSubscription }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError('')
    loadIosProducts().then((result) => {
      if (!alive) return
      setProducts(result)
      if (!result?.length) setLoadError('Nenhum plano foi retornado pela App Store. Verifique sua conexão e tente novamente.')
    }).catch((error) => {
      if (!alive) return
      setLoadError(error?.message || 'Não foi possível consultar os planos da App Store.')
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [reloadCount])

  const cards = buildIosSubscriptionCards(products)

  async function restore() {
    if (restoring) return
    setRestoring(true)
    setMessage('Consultando compras da App Store...')
    try {
      const entitlement = await restoreIosPurchases()
      const account = await onRefreshSubscription?.({ status: 'Verificando assinatura', silent: true, goToOverviewOnActive: true })
      if (account?.active) {
        setMessage('A assinatura vinculada à sua conta foi confirmada.')
      } else if (entitlement?.active) {
        setMessage('Compra encontrada no Apple ID, mas ainda não vinculada e validada nesta conta. Entre em contato com o suporte antes de realizar outra compra.')
      } else {
        setMessage('Nenhuma assinatura ativa foi encontrada neste Apple ID.')
      }
    } catch (error) {
      setMessage(error?.message || 'Não foi possível restaurar suas compras.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <section className="native-ios-subscription-panel" aria-label="Assinatura pela App Store">
      <header className="native-ios-subscription-heading">
        <span className="native-ios-eyebrow">Coach Fit Pro · App Store</span>
        <h2>{subscriptionActive ? 'Sua assinatura está ativa' : 'Escolha sua assinatura'}</h2>
        <p>{subscriptionActive
          ? 'Sua conta está liberada. O status da assinatura é controlado pela sua conta Coach Fit Pro.'
          : 'Os preços abaixo são informados pela Apple para a sua região. O pagamento não está habilitado até concluirmos a verificação segura das assinaturas.'}</p>
      </header>

      {loading ? <p className="native-ios-feedback" role="status">Consultando preços na App Store...</p> : null}
      {loadError ? (
        <div className="native-ios-feedback" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)}>Tentar novamente</button>
        </div>
      ) : null}

      {!loading ? (
        <div className="native-ios-plan-grid">
          {cards.map((plan) => (
            <article className="native-ios-plan-card" key={plan.planId}>
              <span className="native-ios-plan-cycle">{plan.cycleLabel}</span>
              <h3>{plan.title}</h3>
              <p className="native-ios-plan-price">{plan.displayPrice}</p>
              <p className="native-ios-plan-note">Valor apresentado pela App Store, sem promoções presumidas.</p>
            </article>
          ))}
        </div>
      ) : null}

      {!subscriptionActive ? (
        <div className="native-ios-availability" role="status">
          <strong>Assinaturas temporariamente indisponíveis</strong>
          <p>A integração de verificação com a Apple está em preparação. Para evitar cobranças sem liberação de acesso, novas compras permanecem desabilitadas.</p>
        </div>
      ) : null}

      <button className="native-ios-restore" type="button" onClick={restore} disabled={restoring}>
        {restoring ? 'Verificando compras...' : 'Restaurar compras'}
      </button>
      <p className="native-ios-help">Se você já pagou e o acesso não foi reconhecido, não assine novamente. Use Restaurar compras e procure o suporte do Coach Fit Pro.</p>
      {message ? <p className="native-ios-feedback" role="status" aria-live="polite">{message}</p> : null}
    </section>
  )
}
