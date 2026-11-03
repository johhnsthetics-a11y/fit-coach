import { useEffect, useRef, useState } from 'react'
import { IOS_PRODUCT_IDS, getIosEntitlements, loadIosProducts, purchaseIosPlan, restoreIosPurchases } from './iosStoreKit'
import { buildIosSubscriptionCards, resolveIosPricingLocale } from './iosProductPresentation'
import { formatSubscriptionDate, getVerifiedIosSubscription, getWebSubscriptionSummary, SUBSCRIPTION_CYCLES } from './subscriptionPresentation'
import { getIosOfferDiagnostics } from './iosIntroOffer'
import './nativeIosSubscription.css'

function readPendingPlan(accountId) {
  if (!accountId) return ''
  try {
    const planId = window.sessionStorage.getItem(`coachfit-ios-pending-${accountId}`) || ''
    return SUBSCRIPTION_CYCLES[planId] ? planId : ''
  } catch { return '' }
}

// Visual overhaul from the uploaded Minha Assinatura package, combined with
// the verified purchase fix of build 9. No UI selection ever grants access.
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
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false)
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
    setSelectedPlanId(readPendingPlan(accountId) || 'mensal')
    setPendingPlanId(readPendingPlan(accountId))
  }, [accountId])

  useEffect(() => {
    setDiagnosticsCopied(false)
  }, [accountId, products])

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
  const monthlyProduct = products.find(product => product.planId === 'mensal')
  const monthlyPlan = cards.find(plan => plan.planId === 'mensal')
  const accountSnapshot = snapshot.accountId === accountId ? snapshot : { status: 'loading', entitlements: [], error: '' }
  const currentPlan = getVerifiedIosSubscription(accountSnapshot.entitlements, accountId, IOS_PRODUCT_IDS, clock)
  const externalSummary = getWebSubscriptionSummary(subscription, { affiliate: professionalAffiliate, now: clock })
  const nativeConfirmed = Boolean(currentPlan || subscriptionActive)
  const hasAccess = nativeConfirmed || externalSummary.active
  const checking = accountSnapshot.status === 'loading'
  const canPurchase = accountValid && !hasAccess && !loading && !processing && !pendingPlanId && !operationRef.current


  async function purchase(plan) {
    if (!accountValid || !plan || !canPurchase || operationRef.current) return
    operationRef.current = true
    const operationAccount = accountId
    setProcessing(plan.planId)
    setMessage('Conferindo as condições da oferta na Apple...')
    try {
      // Swift reuses its product lookup to compare the introductory terms.
      // No duplicate JS price/storefront fetch and no eligibility override.
      const displayedProduct = products.find(product => product.planId === plan.planId)
      const result = await purchaseIosPlan(plan.planId, accountId, displayedProduct)
      if (accountRef.current !== operationAccount) return
      if (result.offerChanged) {
        const updated = result.products || []
        setProducts(previous => [...previous.filter(product => !updated.some(item => item.planId === product.planId)), ...updated])
        setMessage('As condições da oferta mudaram na Apple. Nenhuma compra foi iniciada. Revise o preço e a elegibilidade atualizados antes de continuar.')
      } else if (result.cancelled) {
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
        setMessage('Assinatura confirmada pela Apple. Seu painel profissional foi liberado.')
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

  async function copyOfferDiagnostics() {
    try {
      await navigator.clipboard.writeText(getIosOfferDiagnostics(monthlyProduct))
      setDiagnosticsCopied(true)
    } catch { setMessage('Não foi possível copiar. Os dados técnicos estão visíveis abaixo.') }
  }

  const title = currentPlan ? `Plano ${currentPlan.title}` : nativeConfirmed ? 'Assinatura ativa'
    : externalSummary.active ? externalSummary.title : pendingPlanId ? 'Aguardando aprovação da Apple'
      : 'Seu próximo passo começa aqui'
  const validity = currentPlan?.expiresAt || (externalSummary.active ? externalSummary.expiresAt : '')

  function renderPlans() {
    return (
      <div className="native-ios-plan-grid" role="group" aria-label="Ciclos de assinatura">
        {cards.map(plan => {
          const selected = !hasAccess && selectedPlanId === plan.planId
          const isCurrent = currentPlan?.planId === plan.planId
          const cycle = SUBSCRIPTION_CYCLES[plan.planId]
          return (
            <article className={`native-ios-plan-card${selected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}`} key={plan.planId}>
              {!hasAccess ? (
                <label className="subscription-plan-option">
                  <input type="radio" name="ios-subscription-plan" value={plan.planId}
                    checked={selected} onChange={() => { setSelectedPlanId(plan.planId); setMessage('') }}
                    disabled={Boolean(processing) || Boolean(pendingPlanId)} />
                  <span className="subscription-plan-option-title">{plan.title}<span>{cycle.cycle} de acesso por ciclo</span></span>
                </label>
              ) : <div className="subscription-plan-option-title">{plan.title}<span>{cycle.cycle} por ciclo</span></div>}
              <span className="subscription-plan-badge">{isCurrent ? 'Seu plano atual' : selected ? 'Selecionado' : 'Mesmo acesso, outro ciclo'}</span>
              <p className="native-ios-plan-price">{plan.displayPrice}</p>
              <p className="native-ios-plan-note">{plan.priceDescription || cycle.charge}</p>
              {plan.referencePriceUsed ? <p className="native-ios-plan-note">Preço de referência para o Brasil — não é um valor confirmado pela Apple.</p> : null}
              {plan.renewalText ? <p className="native-ios-renewal-note">{plan.renewalText}</p> : null}
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <section className="native-ios-subscription-panel subscription-workspace" aria-label="Minha assinatura pela App Store" data-subscription-ui="build-12">
      <header className="native-ios-subscription-heading subscription-page-heading">
        <span className="native-ios-eyebrow">Coach Fit Pro · sua conta</span>
        <h2>Minha assinatura</h2>
        <p>Veja seu plano, acompanhe seu acesso e gerencie sua assinatura em um só lugar.</p>
      </header>
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
            <div><dt>Acesso válido até</dt><dd>{formatSubscriptionDate(validity)}</dd></div>
            <div><dt>Gerenciado por</dt><dd>{nativeConfirmed ? 'App Store' : externalSummary.provider}</dd></div>
            {currentPlan && <div><dt>Última transação Apple</dt><dd>{currentPlan.transactionAmount || 'Valor não informado pela Apple'}</dd></div>}
            {currentPlan && <div><dt>Oferta na última transação</dt><dd>{currentPlan.appliedOfferType === 'introductory' ? 'Introdutória aplicada' : currentPlan.appliedOfferType === 'none' ? 'Sem oferta aplicada' : currentPlan.appliedOfferType === 'other' ? 'Outra oferta Apple' : 'Não informado pela Apple'}</dd></div>}
          </dl>
        )}
        {hasAccess && <p className="subscription-small-print">{nativeConfirmed
          ? 'O valor acima vem da transação verificada, não do catálogo. Em ambiente de teste não representa cobrança real. Uma renovação pode já ter o preço normal. Consulte o recibo e gerencie a assinatura na Apple.'
          : 'O acesso está confirmado por outro canal; isso não comprova uma compra na App Store.'}</p>}
        <div className="subscription-summary-actions">
          {nativeConfirmed && <a className="subscription-manage-link" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noopener noreferrer">Gerenciar na Apple</a>}
          <button type="button" className="native-ios-restore" onClick={() => setReloadCount(count => count + 1)} disabled={checking || Boolean(processing)}>{checking ? 'Atualizando...' : 'Atualizar status'}</button>
        </div>
      </section>

      {accountSnapshot.error && <p className="native-ios-feedback" role="alert">{accountSnapshot.error}</p>}
      {message && <p className="native-ios-feedback subscription-operation-message" role="status" aria-live="polite">{message}</p>}
      {pendingPlanId && !hasAccess && (
        <div className="native-ios-feedback" role="status">
          <strong>Plano {SUBSCRIPTION_CYCLES[pendingPlanId]?.title} aguardando aprovação</strong>
          <p>A Apple ainda não aprovou a compra. Atualize o status antes de tentar outra contratação.</p>
          <details>
            <summary>A compra foi recusada ou cancelada na Apple?</summary>
            <p>Inicie outra tentativa somente depois de confirmar que a compra anterior foi encerrada na Apple.</p>
            <button type="button" className="native-ios-restore" onClick={() => { rememberPendingPlan(''); setMessage('Nova tentativa liberada. Revise os valores antes de contratar.') }} disabled={Boolean(processing)}>Já conferi na Apple: tentar novamente</button>
          </details>
        </div>
      )}
      {!accountValid && <div className="native-ios-availability" role="alert"><strong>Entre novamente na sua conta.</strong><p>Precisamos identificar sua conta profissional para verificar uma assinatura.</p></div>}
      {loading && <p className="native-ios-feedback" role="status">Consultando preços na App Store...</p>}
      {loadError && <div className="native-ios-feedback" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReloadCount(count => count + 1)}>Tentar novamente</button></div>}

      {!loading && (hasAccess ? (
        <details className="subscription-plan-comparison">
          <summary>Comparar os ciclos disponíveis</summary>
          <p className="native-ios-help">Os preços abaixo são de novas contratações. Para alterar uma assinatura Apple, use Gerenciar na Apple.</p>
          {renderPlans()}
        </details>
      ) : (
        <section className="subscription-plan-section" aria-label="Escolher plano">
          <div className="subscription-section-title"><h3>Escolha seu ciclo</h3><p>O mesmo acesso profissional. Você escolhe a duração.</p></div>
          {renderPlans()}
          {selectedPlanId === 'mensal' && <section className="subscription-offer-status" aria-label="Oferta introdutória mensal">
            <h3>{monthlyPlan.introAppliedToDisplay ? 'Oferta introdutória confirmada pela Apple' : 'Sobre a oferta do primeiro mês'}</h3>
            <p>{monthlyPlan.introAppliedToDisplay ? `${monthlyPlan.introductoryTerms}. ${monthlyPlan.renewalText}.`
              : monthlyPlan.introStatus === 'ineligible' ? 'A Apple informou que esta conta Apple não é elegível neste grupo de assinaturas. Criar outra conta Coach Fit Pro não reinicia o benefício.'
                : monthlyPlan.introStatus === 'unavailable' ? 'A Apple não retornou uma oferta introdutória para o produto mensal nesta loja. Confira a vigência, o país e o produto na App Store Connect.'
                  : 'Ainda não há confirmação completa do desconto pela Apple. Atualize a oferta antes de contratar se você está esperando o preço introdutório.'}</p>
            <button type="button" className="native-ios-restore" onClick={() => setReloadCount(count => count + 1)} disabled={Boolean(processing) || loading}>Atualizar oferta Apple</button>
            <details><summary>Ver detalhes da oferta</summary>
              <p>A elegibilidade pertence à conta Apple de compras, não ao login do aplicativo. Uma conta de teste pode ter consumido uma oferta neste grupo antes.</p>
              <pre>{getIosOfferDiagnostics(monthlyProduct)}</pre>
              <button type="button" className="native-ios-restore" onClick={copyOfferDiagnostics}>{diagnosticsCopied ? 'Detalhes copiados' : 'Copiar detalhes da oferta'}</button>
            </details>
          </section>}
          <div className="subscription-selection-summary" aria-label="Resumo do plano selecionado">
            <span className="native-ios-eyebrow">Plano selecionado · ainda não contratado</span>
            <div><h4>{selectedPlan?.title}</h4><strong>{selectedPlan?.displayPrice}</strong></div>
            <p className="native-ios-help">{selectedPlan?.introAppliedToDisplay ? `${selectedPlan.introductoryTerms}. ${selectedPlan.renewalText}.` : `${SUBSCRIPTION_CYCLES[selectedPlan?.planId]?.cycle || 'Ciclo'} por assinatura. Confira a renovação e o valor final na Apple.`}</p>
            <button type="button" className="native-ios-purchase-button" onClick={() => purchase(selectedPlan)}
              disabled={!canPurchase}
              aria-label={`Assinar plano ${selectedPlan?.title} pela App Store`}>
              {processing && processing !== 'restore' ? 'Aguarde...' : `Assinar ${selectedPlan?.title || 'plano'}`}
            </button>
            <p className="subscription-small-print">
              {selectedPlan?.planId === 'mensal' && selectedPlan?.introAppliedToDisplay
                ? 'A Apple indicou que esta conta é elegível à oferta introdutória. Confira o primeiro mês e a renovação na confirmação antes de autorizar.'
                : selectedPlan?.planId === 'mensal' && selectedPlan?.introEligibility === 'ineligible'
                  ? 'A Apple informou que esta conta não é elegível à oferta introdutória. Será apresentado o preço mensal normal.'
                  : 'O preço e eventuais ofertas dependem da conta Apple e serão confirmados antes da compra.'}
              {' '}Selecionar um plano não gera cobrança.
            </p>
          </div>
        </section>
      ))}
      <section className="subscription-included" aria-label="Recursos do acesso profissional">
        <h3>Seu painel profissional</h3>
        <p>Organize seu atendimento com as ferramentas do Coach Fit Pro.</p>
        <ul><li>{professionalType === 'nutritionist' ? 'Pacientes e acompanhamento' : 'Alunos e acompanhamento'}</li>
          <li>{professionalType === 'nutritionist' ? 'Questionários e avaliações' : 'Treinos e prescrições'}</li>
          <li>Dietas e planos alimentares</li><li>Agenda, mensagens e check-ins</li></ul>
      </section>
      <section className="subscription-support" aria-label="Ajuda com a assinatura">
        <div><h3>Já assinou antes?</h3><p>Use a mesma conta Coach Fit Pro da compra e restaure o acesso. Não compre novamente para resolver falhas de atualização.</p></div>
        <button className="native-ios-restore" type="button" onClick={restore} disabled={!accountValid || Boolean(processing)}>{processing === 'restore' ? 'Verificando compras...' : 'Restaurar compras'}</button>
      </section>
      <p className="native-ios-help">Para gerenciar ou cancelar: Ajustes do iPhone → seu nome → Assinaturas.</p>
      <nav className="native-ios-legal" aria-label="Informações legais das assinaturas">
        <a href="https://app.coachfitpro.com.br/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
        <a href="https://app.coachfitpro.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
      </nav>
    </section>
  )
}
