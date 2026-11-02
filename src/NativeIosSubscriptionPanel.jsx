import { useEffect, useState } from 'react'
import { loadIosProducts, purchaseIosPlan, restoreIosPurchases } from './iosStoreKit'
import { buildIosSubscriptionCards, resolveIosPricingLocale } from './iosProductPresentation'
import './nativeIosSubscription.css'

// StoreKit 2 verifies the Apple-signed transaction on-device. The plugin also
// requires the signed-in account's UUID to match transaction.appAccountToken.
// Prices are fetched from the App Store; Cartpanda pricing is web-only.
export default function NativeIosSubscriptionPanel({
  accountId,
  subscriptionActive = false,
  onNativeEntitlementChange,
}) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [processing, setProcessing] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError('')
    loadIosProducts().then((result) => {
      if (!alive) return
      setProducts(result)
      if (!result?.length) setLoadError('Nenhum plano foi retornado pela App Store. Confira sua conexão e tente novamente.')
    }).catch((error) => {
      if (!alive) return
      setLoadError(error?.message || 'Não foi possível consultar os planos da App Store.')
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [reloadCount])

  useEffect(() => {
    setMessage('')
  }, [accountId])

  // Refresh StoreKit prices after returning from a purchase sheet or changing
  // the Apple/Sandbox storefront. This also prevents stale USD product cards.
  useEffect(() => {
    const refreshOnReturn = () => {
      if (!document.hidden) setReloadCount((count) => count + 1)
    }
    document.addEventListener('visibilitychange', refreshOnReturn)
    window.addEventListener('focus', refreshOnReturn)
    return () => {
      document.removeEventListener('visibilitychange', refreshOnReturn)
      window.removeEventListener('focus', refreshOnReturn)
    }
  }, [])

  const pricingLocale = resolveIosPricingLocale(typeof document !== 'undefined' ? document.documentElement.lang : '')
  const cards = buildIosSubscriptionCards(products, { locale: pricingLocale })
  const currencyMismatch = cards.some((plan) => plan.currencyMismatch)
  const reportedStorefrontCountry = cards.find((plan) => plan.storefrontCountryCode)?.storefrontCountryCode || ''
  const accountValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(accountId || ''))

  async function purchase(plan) {
    if (!accountValid || !plan.available || processing) return
    setProcessing(plan.planId)
    setMessage('Abrindo a confirmação de pagamento da App Store...')
    try {
      // Price/region may have changed since this card loaded. Require another
      // deliberate tap if any currently displayed product data is stale.
      const freshProducts = await loadIosProducts()
      const current = freshProducts.find((item) => item.planId === plan.planId)
      const previous = products.find((item) => item.planId === plan.planId)
      if (!current?.displayPrice) {
        setMessage('Não foi possível confirmar o preço deste plano na App Store. Atualize os preços e tente novamente.')
        return
      }
      if (current.displayPrice !== previous?.displayPrice
        || current.currencyCode !== previous?.currencyCode
        || current.storefrontCountryCode !== previous?.storefrontCountryCode) {
        setProducts(freshProducts)
        setMessage('A App Store atualizou o preço ou a região da loja. Confira a informação exibida e toque novamente para continuar.')
        return
      }
      const result = await purchaseIosPlan(plan.planId, accountId)
      if (result.cancelled) {
        setMessage('Compra cancelada. Nenhuma cobrança foi concluída.')
      } else if (result.pending) {
        setMessage('Compra pendente de aprovação pela Apple. Verifique novamente quando for aprovada.')
      } else if (result.active) {
        onNativeEntitlementChange?.(true)
        setMessage('Assinatura verificada pela Apple e vinculada à sua conta. Acesso liberado neste iPhone.')
      } else {
        setMessage('Compra concluída, mas não foi possível confirmar a assinatura desta conta. Não compre novamente; use Restaurar compras ou contate o suporte.')
      }
    } catch (error) {
      setMessage(error?.message || 'Não foi possível concluir a assinatura pela App Store.')
    } finally {
      setProcessing('')
    }
  }

  async function restore() {
    if (!accountValid || processing) return
    setProcessing('restore')
    setMessage('Verificando compras vinculadas a esta conta...')
    try {
      const result = await restoreIosPurchases(accountId)
      onNativeEntitlementChange?.(Boolean(result.active))
      setMessage(result.active
        ? 'Assinatura verificada e restaurada para esta conta.'
        : 'Nenhuma assinatura ativa vinculada a esta conta foi encontrada. Se você já assinou anteriormente, entre em contato com o suporte.')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível restaurar suas compras.')
    } finally {
      setProcessing('')
    }
  }

  return (
    <section className="native-ios-subscription-panel" aria-label="Assinaturas pela App Store">
      <header className="native-ios-subscription-heading">
        <span className="native-ios-eyebrow">Coach Fit Pro · App Store</span>
        <h2>{subscriptionActive ? 'Sua assinatura está ativa' : 'Escolha sua assinatura'}</h2>
        <p>{subscriptionActive
          ? 'O acesso está ativo nesta conta. Você pode consultar ou restaurar suas compras abaixo.'
          : 'Preços e condições cobrados pela Apple de acordo com a região da sua conta App Store. Confira a confirmação da Apple antes de pagar.'}</p>
      </header>

      {loading ? <p className="native-ios-feedback" role="status">Consultando preços na App Store...</p> : null}
      {loadError ? (
        <div className="native-ios-feedback" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)}>Tentar novamente</button>
        </div>
      ) : null}

      {!loading && currencyMismatch && (
        <div className="native-ios-currency-warning" role="status" aria-live="polite">
          <strong>Preço disponível para confirmação na App Store</strong>
          <p>Encontramos uma diferença entre a moeda dos produtos e a interface brasileira. Para evitar valores incorretos, consulte o preço definitivo na janela de confirmação da Apple antes de autorizar a assinatura.</p>
          <p>Região informada pelo StoreKit: {reportedStorefrontCountry || 'não identificada'}.</p>
          <button type="button" className="native-ios-restore" onClick={() => setReloadCount((count) => count + 1)}>Atualizar preços</button>
        </div>
      )}

      {!loading && (
        <div className="native-ios-plan-grid">
          {cards.map((plan) => (
            <article className="native-ios-plan-card" key={plan.planId}>
              <span className="native-ios-plan-cycle">{plan.cycleLabel}</span>
              <h3>{plan.title}</h3>
              <p className={`native-ios-plan-price${plan.currencyMismatch ? ' native-ios-plan-price--verify' : ''}`}>{plan.displayPrice}</p>
              <p className="native-ios-plan-note">Cobrança recorrente. Confira o valor, a periodicidade e ofertas aplicáveis na confirmação da App Store.</p>
              {!subscriptionActive && (
                <button
                  type="button"
                  className="native-ios-purchase-button"
                  onClick={() => purchase(plan)}
                  disabled={!accountValid || !plan.available || Boolean(processing)}
                  aria-label={`Assinar plano ${plan.title} pela App Store`}
                >
                  {processing === plan.planId ? 'Aguarde...' : plan.currencyMismatch ? `Conferir preço e assinar ${plan.title}` : `Assinar ${plan.title}`}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {!accountValid ? (
        <div className="native-ios-availability" role="alert">
          <strong>Não foi possível identificar sua conta profissional.</strong>
          <p>Entre novamente no Coach Fit Pro para vincular a assinatura à sua conta antes de comprar.</p>
        </div>
      ) : null}

      <button className="native-ios-restore" type="button" onClick={restore} disabled={!accountValid || Boolean(processing)}>
        {processing === 'restore' ? 'Verificando compras...' : 'Restaurar compras'}
      </button>
      <p className="native-ios-help">Para gerenciar ou cancelar uma assinatura, abra Ajustes do iPhone → seu nome → Assinaturas. Se você já pagou, não compre novamente; use Restaurar compras.</p>
      <nav className="native-ios-legal" aria-label="Informações legais das assinaturas">
        <a href="https://app.coachfitpro.com.br/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
        <a href="https://app.coachfitpro.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
      </nav>
      {message ? <p className="native-ios-feedback" role="status" aria-live="polite">{message}</p> : null}
    </section>
  )
}
