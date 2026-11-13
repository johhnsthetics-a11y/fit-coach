import { useEffect, useRef, useState } from 'react'
import { IOS_PRODUCT_IDS, getIosEntitlements, loadIosProducts, purchaseIosPlan, restoreIosPurchases } from './iosStoreKit'
import { buildIosSubscriptionCards, resolveIosPricingLocale } from './iosProductPresentation'
import { formatSubscriptionDate, getVerifiedIosSubscription, getWebSubscriptionSummary, SUBSCRIPTION_CYCLES } from './subscriptionPresentation'
import './nativeIosSubscription.css'
import { canStartNativeSubscriptionPurchase } from './iosPurchaseVerification'

function readPendingPlan(accountId) {
  if (!accountId) return ''
  try {
    const planId = window.sessionStorage.getItem(`coachfit-ios-pending-${accountId}`) || ''
    return SUBSCRIPTION_CYCLES[planId] ? planId : ''
  } catch { return '' }
}

// Native iOS subscription screen. Access is granted only after a verified Apple transaction.
export default function NativeIosSubscriptionPanel({
  accountId,
  subscriptionActive = false,
  subscription,
  professionalAffiliate = false,
  professionalType = 'trainer',
  onNativeEntitlementChange,
}) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [processing, setProcessing] = useState('')
  const [message, setMessage] = useState('')
  const [priceReviewPlanId, setPriceReviewPlanId] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState(() => readPendingPlan(accountId) || 'mensal')
  const [pendingPlanId, setPendingPlanId] = useState(() => readPendingPlan(accountId))
  const [snapshot, setSnapshot] = useState({ accountId: '', status: 'loading', entitlements: [], error: '' })
  const [clock, setClock] = useState(Date.now())
  const accountRef = useRef(accountId)
  const operationRef = useRef(false)
  const verificationRef = useRef(0)
  accountRef.current = accountId
  const accountValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(accountId || ''))

  function rememberPendingPlan(planId) {
    setPendingPlanId(planId)
    try {
      const key = `coachfit-ios-pending-${accountId}`
      if (planId) window.sessionStorage.setItem(key, planId)
      else window.sessionStorage.removeItem(key)
    } catch { /* UI reminder only; never proof of payment. */ }
  }

  useEffect(() => {
    setMessage('')
    setPriceReviewPlanId('')
    setSelectedPlanId(readPendingPlan(accountId) || 'mensal')
    setPendingPlanId(readPendingPlan(accountId))
  }, [accountId])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let alive = true
    const version = ++verificationRef.current
    setLoading(true)
    setLoadError('')
    setSnapshot(previous => ({
      accountId, status: accountValid ? 'loading' : 'invalid', error: '',
      entitlements: previous.accountId === accountId ? previous.entitlements : [],
    }))
    loadIosProducts().then(result => {
      if (!alive || accountRef.current !== accountId) return
      setProducts(result)
      if (!result?.length) setLoadError('Os planos não estão disponíveis agora. Selecione o ciclo e confirme o preço diretamente na App Store.')
    }).catch(error => {
      if (!alive || accountRef.current !== accountId) return
      setLoadError(error?.message || 'Não foi possível consultar os preços da App Store.')
    }).finally(() => { if (alive && accountRef.current === accountId) setLoading(false) })

    if (accountValid) {
      getIosEntitlements(accountId).then(result => {
        if (!alive || version !== verificationRef.current || accountRef.current !== accountId) return
        setSnapshot({ accountId, status: 'ready', entitlements: result.entitlements || [], error: '' })
        setClock(Date.now())
        if (result.active) {
          rememberPendingPlan('')
          // Existing subscribers must be able to open Minha Assinatura
          // without being redirected away on every status refresh.
          if (!subscriptionActive) onNativeEntitlementChange?.(true)
        }
      }).catch(error => {
        if (!alive || version !== verificationRef.current || accountRef.current !== accountId) return
        setSnapshot(previous => ({
          ...previous, accountId, status: 'error',
          error: error?.message || 'Não foi possível verificar sua assinatura.',
        }))
        // A failed status refresh must not revoke a verified entitlement.
      })
    }
    return () => { alive = false }
  }, [accountId, accountValid, reloadCount])

  useEffect(() => {
    const refreshOnReturn = () => {
      if (!document.hidden && !operationRef.current) setReloadCount(count => count + 1)
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
  const selectedPlan = cards.find(plan => plan.planId === selectedPlanId) || cards[0]
  const accountSnapshot = snapshot.accountId === accountId ? snapshot : { status: 'loading', entitlements: [], error: '' }
  const currentPlan = getVerifiedIosSubscription(accountSnapshot.entitlements, accountId, IOS_PRODUCT_IDS, clock)
  const externalSummary = getWebSubscriptionSummary(subscription, { affiliate: professionalAffiliate, now: clock })
  const nativeConfirmed = Boolean(currentPlan || subscriptionActive)
  const hasAccess = nativeConfirmed || externalSummary.active
  const checking = accountSnapshot.status === 'loading'
  const displayedProduct = products.find(product => product.planId === selectedPlan?.planId)
  const canPurchase = canStartNativeSubscriptionPurchase({
    accountValid,
    entitlementStatus: accountSnapshot.status,
    purchaseAvailable: Boolean(selectedPlan?.purchaseAvailable),
    productAvailable: Boolean(displayedProduct),
    hasAccess,
    loadingProducts: loading,
    processing: Boolean(processing),
    pendingPlan: Boolean(pendingPlanId),
    operationInFlight: operationRef.current,
  })


  async function purchase(plan) {
    if (!accountValid || !plan || !canPurchase || operationRef.current) return
    operationRef.current = true
    const operationAccount = accountId
    setProcessing(plan.planId)
    setPriceReviewPlanId('')
    setMessage('Conectando à App Store...')
    try {
      const currentDisplayedProduct = products.find(product => product.planId === plan.planId)
      const result = await purchaseIosPlan(plan.planId, accountId, currentDisplayedProduct)
      if (accountRef.current !== operationAccount) return
      if (result.priceChanged) {
        const updatedProducts = Array.isArray(result.products) ? result.products : []
        if (updatedProducts.length) {
          const updatedIds = new Set(updatedProducts.map(product => product.id))
          setProducts(previous => [...previous.filter(product => !updatedIds.has(product.id)), ...updatedProducts])
          setPriceReviewPlanId(plan.planId)
          setMessage('A App Store atualizou o preço ou as condições. O resumo acima foi renovado; confira-o e toque em “Rever preço e continuar”. Nenhuma compra foi iniciada.')
        } else {
          setReloadCount(count => count + 1)
          setMessage('Os preços mudaram na App Store. Eles estão sendo atualizados; confira o resumo antes de tentar novamente.')
        }
      } else if (result.cancelled) {
        rememberPendingPlan('')
        setMessage('Compra cancelada. Nenhuma cobrança foi concluída.')
      } else if (result.pending) {
        rememberPendingPlan(plan.planId)
        setMessage('Compra pendente de aprovação pela Apple. O plano ainda não está ativo.')
      } else if (result.active) {
        ++verificationRef.current
        setSnapshot({ accountId: operationAccount, status: 'ready', entitlements: result.entitlements || [], error: '' })
        setClock(Date.now())
        rememberPendingPlan('')
        onNativeEntitlementChange?.(true)
        setMessage(result.alreadyActive
          ? 'A assinatura Apple já estava ativa para esta conta. O acesso foi sincronizado sem iniciar uma nova cobrança.'
          : 'Assinatura confirmada pela Apple. Seu painel profissional foi liberado.')
      } else {
        setMessage('Não foi possível confirmar a assinatura desta conta. Não compre novamente; use Restaurar compras ou contate o suporte.')
      }
    } catch (error) {
      if (accountRef.current === operationAccount) setMessage(error?.message || 'Não foi possível abrir a confirmação da App Store. Tente novamente.')
    } finally {
      operationRef.current = false
      setProcessing('')
    }
  }

  async function restore() {
    if (!accountValid || operationRef.current) return
    operationRef.current = true
    const operationAccount = accountId
    setProcessing('restore')
    setMessage('Verificando compras vinculadas a esta conta...')
    try {
      const result = await restoreIosPurchases(accountId)
      if (accountRef.current !== operationAccount) return
      ++verificationRef.current
      setSnapshot({ accountId: operationAccount, status: 'ready', entitlements: result.entitlements || [], error: '' })
      setClock(Date.now())
      if (result.active) {
        rememberPendingPlan('')
        onNativeEntitlementChange?.(true)
        setMessage('Assinatura restaurada. Seu painel está liberado.')
      } else {
        setMessage('Nenhuma assinatura ativa vinculada a esta conta foi encontrada. Se já pagou, entre em contato com o suporte.')
      }
    } catch (error) {
      if (accountRef.current === operationAccount) setMessage(error?.message || 'Não foi possível restaurar suas compras.')
    } finally {
      operationRef.current = false
      setProcessing('')
    }
  }

  const title = currentPlan ? `Plano ${currentPlan.title}` : nativeConfirmed ? 'Assinatura ativa'
    : externalSummary.active ? externalSummary.title : pendingPlanId ? 'Aguardando aprovação da Apple'
      : 'Seu próximo passo começa aqui'
  const validity = currentPlan?.expiresAt || (externalSummary.active ? externalSummary.expiresAt : '')

  function renderPlans(interactive = !hasAccess) {
    return (
      <div className={`subscription-cycle-picker${interactive ? ' is-interactive' : ' is-readonly'}`} role={interactive ? 'radiogroup' : 'group'} aria-label="Ciclos de assinatura">
        {cards.map(plan => {
          const selected = interactive ? selectedPlanId === plan.planId : currentPlan?.planId === plan.planId
          const isCurrent = currentPlan?.planId === plan.planId
          const cycle = SUBSCRIPTION_CYCLES[plan.planId]
          const className = `subscription-cycle-option${selected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}${plan.purchaseAvailable ? '' : ' is-unavailable'}`
          const price = plan.available ? plan.displayPrice : 'Indisponível'
          if (!interactive) return <article className={className} key={plan.planId}>
            <span className="subscription-cycle-title">{plan.title}</span><strong>{price}</strong>
            <small>{cycle.cycle}</small>{isCurrent && <span className="subscription-cycle-current">Seu plano atual</span>}
          </article>
          return <label className={className} key={plan.planId}>
            <input type="radio" name="ios-subscription-plan" value={plan.planId} checked={selected}
              onChange={() => { setSelectedPlanId(plan.planId); setMessage(''); setPriceReviewPlanId('') }}
              disabled={Boolean(processing) || Boolean(pendingPlanId) || !plan.purchaseAvailable} />
            <span className="subscription-cycle-title">{plan.title}</span><strong>{price}</strong>
            <small>{cycle.cycle}</small>{isCurrent && <span className="subscription-cycle-current">Seu plano atual</span>}
          </label>
        })}
      </div>
    )
  }

  return (
    <section className="native-ios-subscription-panel subscription-workspace native-ios-subscription-screen" aria-label="Minha assinatura pela App Store" data-subscription-ui="build-25">
      <header className="subscription-brand-row" aria-label="Marca Coach Fit Pro">
        <div className="subscription-brand-lockup"><img src="/assets/fit-coach-logo.png" alt="Coach Fit Pro" /></div>
        <span>Área profissional</span>
      </header>
      <header className="native-ios-subscription-heading subscription-page-heading">
        <div className="subscription-page-heading-copy">
          <span className="native-ios-eyebrow">Coach Fit Pro · sua conta</span>
          <h2>Minha assinatura</h2>
          <p>Veja seu plano, acompanhe seu acesso e gerencie sua assinatura em um só lugar.</p>
        </div>
      </header>
      <div className="subscription-main-grid">
      <section className={`subscription-current-card${hasAccess ? ' is-active' : ''}`} aria-label="Resumo da assinatura atual" aria-busy={checking}>
        <div className="subscription-current-topline">
          <span className="native-ios-eyebrow">{hasAccess ? 'Seu plano atual' : 'Status da conta'}</span>
          <span className={`subscription-status-badge${hasAccess ? ' is-active' : ''}`}><span aria-hidden="true" />{checking ? 'Verificando' : accountSnapshot.status === 'error' ? 'Atualização necessária' : hasAccess ? 'Acesso ativo' : pendingPlanId ? 'Compra pendente' : 'Sem assinatura ativa'}</span>
        </div>
        <h3>{checking && !hasAccess ? 'Consultando sua assinatura' : title}</h3>
        <p className="subscription-summary-note">
          {currentPlan ? 'Assinatura verificada pela Apple e vinculada a esta conta Coach Fit Pro.'
            : nativeConfirmed ? 'O acesso está ativo. Atualize o status para consultar os detalhes do plano.'
              : externalSummary.active ? externalSummary.note
                : checking ? 'Consultando a Apple para verificar assinaturas existentes.'
                  : accountSnapshot.status === 'error' ? 'Não foi possível verificar sua assinatura. Atualize o status ou restaure a compra.'
                    : pendingPlanId ? 'A compra ainda não foi aprovada. Não é necessário iniciar outra assinatura.'
                      : 'Escolha o ciclo abaixo. O acesso é liberado somente após a confirmação da Apple.'}
        </p>
        {hasAccess && (
          <dl className="subscription-current-facts">
            <div><dt>Ciclo contratado</dt><dd>{currentPlan?.cycle || (externalSummary.active ? externalSummary.cycle : 'A confirmar na App Store')}</dd></div>
            <div><dt>Acesso válido até</dt><dd>{currentPlan?.inAppleGracePeriod ? 'Em período de tolerância da Apple' : formatSubscriptionDate(validity)}</dd></div>
            <div><dt>Gerenciado por</dt><dd>{nativeConfirmed ? 'App Store' : externalSummary.provider}</dd></div>
            {currentPlan && <div><dt>Última transação Apple</dt><dd>{currentPlan.transactionAmount || 'Valor não informado pela Apple'}</dd></div>}
          </dl>
        )}
        {hasAccess && <p className="subscription-small-print">{nativeConfirmed
          ? 'Sua assinatura é gerenciada pela App Store. Consulte a área de Assinaturas do iPhone para ver as condições de renovação.'
          : 'Esta assinatura foi ativada por outro canal. Gerencie a cobrança pela plataforma onde foi contratada.'}</p>}
        <div className="subscription-summary-actions">
          {nativeConfirmed && <a className="subscription-manage-link" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noopener noreferrer">Gerenciar na Apple</a>}
          <button type="button" className="native-ios-restore" onClick={() => setReloadCount(count => count + 1)} disabled={checking || Boolean(processing)}>{checking ? 'Atualizando...' : 'Atualizar status'}</button>
        </div>
      </section>

      <div className="subscription-purchase-column">
      {accountSnapshot.error && <p className="native-ios-feedback" role="alert">{accountSnapshot.error}</p>}
      {pendingPlanId && !hasAccess && (
        <div className="native-ios-feedback" role="status">
          <strong>Plano {SUBSCRIPTION_CYCLES[pendingPlanId]?.title} aguardando aprovação</strong>
          <p>A Apple ainda não aprovou esta tentativa. Não inicie outra compra enquanto ela estiver pendente.</p>
          <button type="button" className="native-ios-restore" onClick={() => { rememberPendingPlan(''); setMessage('Nova tentativa liberada. Confira o resumo antes de abrir a Apple.') }} disabled={Boolean(processing)}>Confirmei que foi cancelada — tentar novamente</button>
          <p className="subscription-pending-help">Use esta opção somente depois de confirmar que a solicitação anterior foi encerrada pela Apple.</p>
        </div>
      )}
      {!accountValid && <div className="native-ios-availability" role="alert"><strong>Entre novamente na sua conta.</strong><p>Precisamos identificar sua conta profissional para verificar uma assinatura.</p></div>}
      {loading && <p className="native-ios-feedback" role="status">Consultando preços na App Store...</p>}
      {loadError && <div className="native-ios-feedback" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReloadCount(count => count + 1)}>Tentar novamente</button></div>}

      {!loading && (hasAccess ? (
        <details className="subscription-plan-comparison">
          <summary>Comparar os ciclos disponíveis</summary>
          <p className="native-ios-help">Os preços abaixo são de novas contratações. Para alterar uma assinatura Apple, use Gerenciar na Apple.</p>
          {renderPlans(false)}
        </details>
      ) : (
        <section className="subscription-plan-section" aria-label="Escolher plano">
          <div className="subscription-section-title"><div><h3>Escolha seu ciclo</h3><p>Um único plano profissional, com a duração que preferir.</p></div><span className="subscription-apple-mark">App Store</span></div>
          {renderPlans()}
          <div className="subscription-selection-summary" aria-label="Resumo do plano selecionado">
            <div className="subscription-selection-heading"><div><span className="native-ios-eyebrow">Resumo do plano</span><h4>{selectedPlan?.title || 'Plano mensal'}</h4></div><strong>{selectedPlan?.displayPrice || 'Preço indisponível'}</strong></div>
            <p className="subscription-selection-terms">{selectedPlan?.introAppliedToDisplay ? `${selectedPlan.introductoryTerms}. ${selectedPlan.renewalText}.` : `${selectedPlan?.displayPrice || 'Preço indisponível'} — ${selectedPlan?.priceDescription || SUBSCRIPTION_CYCLES[selectedPlan?.planId]?.charge || 'ciclo selecionado'}.`}</p>
            {selectedPlan?.introEligibilityNotice && <p className="subscription-small-print">{selectedPlan.introEligibilityNotice}</p>}
            {message && <p className="native-ios-feedback subscription-operation-message" role="status" aria-live="polite">{message}</p>}
            {!selectedPlan?.available && !loading && <p className="subscription-purchase-blocked" role="status">Este ciclo não foi carregado pela App Store. Atualize os planos antes de tentar assinar.</p>}
            {selectedPlan?.available && !selectedPlan.purchaseAvailable && !loading && <p className="subscription-purchase-blocked" role="status">{selectedPlan.purchaseBlockReason}</p>}
            <button type="button" className="native-ios-purchase-button" onClick={() => purchase(selectedPlan)}
              disabled={!canPurchase}
              aria-label={`Assinar plano ${selectedPlan?.title} pela App Store`}>
              {checking ? 'Verificando assinatura…' : accountSnapshot.status === 'error' ? 'Atualize o status para continuar' : processing && processing !== 'restore' ? 'Conectando à App Store…' : !selectedPlan?.available ? 'Plano indisponível agora' : !selectedPlan?.purchaseAvailable ? 'Preço não confirmado' : priceReviewPlanId === selectedPlan?.planId ? 'Rever preço e continuar' : `Assinar ${selectedPlan?.title || 'plano'}`}
            </button>
          </div>
        </section>
      ))}
      </div>
      </div>
      <details className="subscription-secondary-details">
        <summary>O que está incluído</summary>
        <section className="subscription-included" aria-label="Recursos do acesso profissional">
          <header className="subscription-included-heading">
            <span className="native-ios-eyebrow">Acesso profissional</span>
            <h3>Ferramentas para atender com mais organização</h3>
            <p>Reúna acompanhamento e rotina de atendimento em um só painel Coach Fit Pro.</p>
          </header>
          <ul className="subscription-benefit-grid">
            <li><div><strong>{professionalType === 'nutritionist' ? 'Pacientes acompanhados' : 'Alunos acompanhados'}</strong><span>Organize vínculos e acompanhe a evolução de cada pessoa.</span></div></li>
            <li><div><strong>{professionalType === 'nutritionist' ? 'Questionários e avaliações' : 'Treinos e prescrições'}</strong><span>{professionalType === 'nutritionist' ? 'Estruture avaliações e orientações com clareza.' : 'Monte e acompanhe rotinas de treino no mesmo espaço.'}</span></div></li>
            <li><div><strong>Dietas e planos alimentares</strong><span>Mantenha as orientações alimentares organizadas.</span></div></li>
            <li><div><strong>Agenda e comunicação</strong><span>Use mensagens, check-ins e agenda para acompanhar sua rotina.</span></div></li>
          </ul>
        </section>
      </details>
      <details className="subscription-secondary-details">
        <summary>Já assinou ou precisa de ajuda?</summary>
        <section className="subscription-support" aria-label="Ajuda com a assinatura">
          <div className="subscription-support-copy">
            <h3>Recupere seu acesso com segurança</h3>
            <p>Use a mesma conta Apple da compra e toque em Restaurar compras. Se já pagou, não assine novamente para resolver uma falha de atualização.</p>
            <p className="subscription-account-link-help"><strong>Compra vinculada a outra conta Coach Fit Pro?</strong> Entre no login usado originalmente. Se não reconhecer esse vínculo, fale com o suporte antes de tentar outra compra; pagamentos de outra conta não podem ser transferidos automaticamente.</p>
          </div>
          <div className="subscription-support-actions">
            <button className="native-ios-restore" type="button" onClick={restore} disabled={!accountValid || Boolean(processing)}>{processing === 'restore' ? 'Verificando compras...' : 'Restaurar compras'}</button>
            <p className="native-ios-help">Para gerenciar ou cancelar: Ajustes do iPhone → seu nome → Assinaturas.</p>
          </div>
        </section>
      </details>
      <nav className="native-ios-legal" aria-label="Informações legais das assinaturas">
        <a href="https://app.coachfitpro.com.br/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
        <a href="https://app.coachfitpro.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
      </nav>
    </section>
  )
}
