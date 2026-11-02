import { formatSubscriptionDate, getWebSubscriptionSummary, SUBSCRIPTION_CYCLES } from './subscriptionPresentation'
import './nativeIosSubscription.css'

export default function WebSubscriptionPanel({
  subscription, professionalAffiliate, professionalType = 'trainer', plans = [], selectedPlanId,
  onSelectPlan, onCheckout, onRefresh, checking, paymentMessage, checkoutStarted,
  retryCheckoutConfirmed, onRetryCheckout, copied, onCopy, now,
}) {
  const current = getWebSubscriptionSummary(subscription, { affiliate: professionalAffiliate, now })
  const selected = plans.find(plan => plan.id === selectedPlanId) || plans[0]
  const providerPending = ['pending', 'pendente', 'waiting_payment', 'aguardando_pagamento']
    .includes(String(subscription?.status || '').toLowerCase())
  const checkoutWaiting = checkoutStarted || (providerPending && !retryCheckoutConfirmed)

  return (
    <section className="native-ios-subscription-panel subscription-workspace web-subscription-panel" aria-label="Minha assinatura Coach Fit Pro">
      <header className="native-ios-subscription-heading subscription-page-heading">
        <span className="native-ios-eyebrow">Coach Fit Pro · sua conta</span>
        <h2>Minha assinatura</h2>
        <p>Seu plano, seu período de acesso e o próximo passo — sem complicação.</p>
      </header>
      <section className={`subscription-current-card${current.active ? ' is-active' : ''}`} aria-label="Resumo da assinatura atual">
        <div className="subscription-current-topline">
          <span className="native-ios-eyebrow">{current.active ? 'Seu plano atual' : 'Status da conta'}</span>
          <span className={`subscription-status-badge${current.active ? ' is-active' : ''}`}><span aria-hidden="true" />{current.status}</span>
        </div>
        <h3>{current.title}</h3>
        <p className="subscription-summary-note">{current.note}</p>
        {(current.active || current.expiresAt) && (
          <dl className="subscription-current-facts">
            <div><dt>Ciclo de acesso</dt><dd>{current.cycle}</dd></div>
            <div><dt>{current.active ? 'Acesso válido até' : 'Último período até'}</dt><dd>{formatSubscriptionDate(current.expiresAt)}</dd></div>
            <div><dt>Gerenciado por</dt><dd>{current.provider}</dd></div>
          </dl>
        )}
        {current.active && <p className="subscription-small-print">Confira o valor pago no comprovante do checkout. O preço de uma nova oferta não representa o valor histórico contratado.</p>}
        <div className="subscription-summary-actions">
          <button type="button" className="native-ios-restore" onClick={() => onRefresh(false)} disabled={checking}>
            {checking ? 'Atualizando...' : 'Atualizar status da assinatura'}
          </button>
          {current.active && <button type="button" className="native-ios-restore" onClick={onCopy}>{copied ? 'Resumo copiado' : 'Copiar resumo'}</button>}
        </div>
      </section>
      {paymentMessage && <p className="native-ios-feedback subscription-operation-message" role="status" aria-live="polite">{paymentMessage}</p>}
      {!current.active && selected && (
        <section className="subscription-plan-section" aria-label="Escolher plano">
          <div className="subscription-section-title"><h3>Escolha seu ciclo</h3><p>O mesmo painel profissional, com o período que combina com você.</p></div>
          <div className="native-ios-plan-grid" role="group" aria-label="Ciclos de assinatura">
            {plans.map(plan => (
              <article key={plan.id} className={`native-ios-plan-card${selected.id === plan.id ? ' is-selected' : ''}`}>
                <label className="subscription-plan-option">
                  <input type="radio" name="web-subscription-plan" value={plan.id} checked={selected.id === plan.id} onChange={() => onSelectPlan(plan.id)} />
                  <span className="subscription-plan-option-title">{plan.name}<span>{SUBSCRIPTION_CYCLES[plan.id]?.cycle || plan.cycle} por ciclo</span></span>
                </label>
                <span className="subscription-plan-badge">{selected.id === plan.id ? 'Selecionado' : 'Mesmo acesso, outro ciclo'}</span>
                <p className="native-ios-plan-price">{plan.price}</p>
                <p className="native-ios-plan-note">{plan.suffix}</p>
                <p className="native-ios-plan-note">{plan.total}</p>
              </article>
            ))}
          </div>
          <div className="subscription-selection-summary" aria-label="Resumo do plano selecionado">
            <span className="native-ios-eyebrow">Plano selecionado · ainda não contratado</span>
            <div><h4>{selected.name}</h4><strong>{selected.price}</strong></div>
            <p className="native-ios-help">{selected.suffix}. {selected.total}. Confira as condições antes de confirmar o pagamento.</p>
            {checkoutWaiting || !selected.checkoutUrl
              ? <button type="button" className="native-ios-purchase-button" disabled>{checkoutWaiting ? 'Aguardando confirmação do pagamento' : 'Checkout indisponível'}</button>
              : <a className="native-ios-purchase-button" href={selected.checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={event => { if (onCheckout(selected.id) === false) event.preventDefault() }}>Continuar com o {selected.name}</a>}
            <p className="subscription-small-print">O checkout abre em outra aba. Use o mesmo e-mail cadastrado no Coach Fit Pro. Escolher um ciclo não ativa a assinatura.</p>
            <button type="button" className="native-ios-restore" onClick={() => onRefresh(false)} disabled={checking}>{checking ? 'Verificando...' : 'Já paguei, verificar liberação'}</button>
          </div>
          {checkoutWaiting && (
            <details className="subscription-plan-comparison"><summary>O pagamento foi recusado ou cancelado?</summary>
              <p className="native-ios-help">Verifique o resultado no checkout antes de iniciar outra tentativa. Se ainda estiver pendente, aguarde a confirmação para evitar pagamentos repetidos.</p>
              <button type="button" className="native-ios-restore" onClick={onRetryCheckout}>Já conferi: iniciar uma nova tentativa</button>
            </details>
          )}
          <ol className="subscription-steps" aria-label="Como ativar a assinatura">
            <li><span>1</span><div><strong>Escolha o ciclo</strong><p>Mensal, semestral ou anual.</p></div></li>
            <li><span>2</span><div><strong>Confirme no checkout</strong><p>Revise o valor e use o e-mail da conta.</p></div></li>
            <li><span>3</span><div><strong>Liberação automática</strong><p>{checkoutStarted ? 'Estamos aguardando a confirmação do pagamento.' : 'O plano atual aparece após o pagamento aprovado.'}</p></div></li>
          </ol>
        </section>
      )}
      <section className="subscription-included" aria-label="Recursos do acesso profissional">
        <h3>Seu painel profissional</h3><p>Ferramentas para organizar o atendimento em um único lugar.</p>
        <ul><li>{professionalType === 'nutritionist' ? 'Pacientes e acompanhamento' : 'Alunos e acompanhamento'}</li>
          <li>{professionalType === 'nutritionist' ? 'Questionários e avaliações' : 'Treinos e prescrições'}</li>
          <li>Dietas e planos alimentares</li><li>Agenda, mensagens e check-ins</li></ul>
      </section>
      <details className="subscription-plan-comparison"><summary>Pagamento, renovação e ajuda</summary>
        <p className="native-ios-help">A confirmação é enviada pelo provedor de pagamento. Se você já pagou e o status ainda não atualizou, use o botão de verificação e confira se o e-mail do checkout é o mesmo da sua conta.</p>
        <p className="native-ios-help">Para valores cobrados, renovação ou cancelamento, consulte o comprovante e as informações enviadas pelo checkout. Esta página não cancela sua assinatura.</p>
      </details>
      <nav className="native-ios-legal" aria-label="Informações legais das assinaturas">
        <a href="https://app.coachfitpro.com.br/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
        <a href="https://app.coachfitpro.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
      </nav>
    </section>
  )
}
