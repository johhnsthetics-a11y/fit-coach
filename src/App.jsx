import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import fitCoachLogo from './fit-coach-logo.png'
import {
  acceptRemoteStudentConsent,
  archiveRemoteNutritionPlan,
  archiveRemoteWorkout,
  createRemoteStudentInvite,
  deleteRemoteStudent,
  loadRemoteData,
  loadRemoteAdminOverview,
  loadRemoteAppAdminSettings,
  loadRemoteMessages,
  loadRemoteStudentMessagesByInvite,
  loadRemoteStudentByInvite,
  markRemoteStudentMessagesRead,
  markRemoteNotificationsRead,
  requestCoachPasswordReset,
  refreshCoachSession,
  saveRemoteAppointment,
  saveRemoteAssessment,
  saveRemoteCheckin,
  saveRemoteCoachSettings,
  saveRemoteAppAdminSettings,
  updateRemoteAdminCoachSubscription,
  saveRemoteInvoice,
  saveRemoteNutritionPlan,
  saveRemoteStudent,
  saveRemoteMessage,
  saveRemoteWorkout,
  saveRemoteWorkoutLog,
  setSupabaseSession,
  signInCoach,
  signOutCoach,
  signUpCoach,
  submitRemoteStudentAnamnesis,
  supabaseEnabled,
  updateRemoteAppointmentStatus,
  updateRemoteInvoiceStatus,
  updateRemotePayment,
  updateRecoveredPassword,
  upsertRemoteUser,
} from './supabaseApi'

const AssessmentChart = lazy(() => import('./CoachCharts').then((module) => ({ default: module.AssessmentChart })))
const RevenueChart = lazy(() => import('./CoachCharts').then((module) => ({ default: module.RevenueChart })))

const STORAGE_KEY = 'fitcoach-ai-pro-v2'
const STUDENT_ACCESS_KEY = 'fitcoach-student-access-code'
const SELECTED_CHECKOUT_PLAN_KEY = 'fitcoach-selected-checkout-plan'
const productionWithoutSupabase = import.meta.env.PROD && !supabaseEnabled
const cartpandaCheckoutPlans = [
  {
    id: 'mensal',
    name: 'Mensal',
    cycle: 'cobrança mensal',
    badge: 'Mais flexível',
    price: 'R$ 49,90',
    suffix: '/mês',
    oldPrice: '',
    total: 'Total em 12 meses: R$ 598,80',
    economy: 'Pague mês a mês',
    equivalent: 'sem compromisso de ciclo longo',
    checkoutUrl: 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
    description: 'Ideal para começar agora, validar o Coach Fit Pro na rotina e manter liberdade mês a mês.',
    highlights: ['Acesso completo ao painel', 'Portal do aluno liberado', 'Sem taxa por aluno', 'Liberação automática após pagamento'],
    bestFor: 'Coach que quer iniciar sem compromisso longo e validar a experiência com os primeiros alunos.',
    operatingPromise: 'Implante em etapas, cadastre alunos ativos e acompanhe o ganho de organização desde a primeira semana.',
    activationPlan: ['Criar conta e ativar o ciclo mensal', 'Cadastrar planos próprios e alunos atuais', 'Enviar convites e acompanhar a rotina pelo painel'],
    decisionPoints: ['mais flexibilidade', 'melhor para teste operacional', 'renovação mês a mês'],
  },
  {
    id: 'semestral',
    name: 'Semestral',
    cycle: 'ciclo de 6 meses',
    badge: 'Mais escolhido',
    price: 'R$ 239,40',
    suffix: '/semestre',
    oldPrice: 'R$ 299,40',
    total: 'Equivale a R$ 39,90/mês',
    economy: 'Economize R$ 60,00',
    equivalent: 'melhor equilíbrio entre economia e flexibilidade',
    checkoutUrl: 'https://pagamento.coachfitpro.com.br/checkout/211373219:1?subscription=4479',
    description: 'Para coaches que querem estabilidade, previsibilidade e tempo suficiente para profissionalizar a carteira.',
    highlights: ['Acesso completo ao painel', 'Menos renovações no ano', 'Rotina financeira previsível', 'Boa opção para equipes em crescimento'],
    bestFor: 'Coach que já tem carteira ativa e quer estruturar a operação sem ficar repensando assinatura todo mês.',
    operatingPromise: 'Seis meses dão tempo para padronizar atendimento, reduzir retrabalho e aumentar percepção de valor.',
    activationPlan: ['Ativar o semestre com economia', 'Organizar alunos por planos e vencimentos', 'Criar rotina de treinos, dieta, check-ins e cobrança'],
    decisionPoints: ['equilíbrio ideal', 'economia sem travar por um ano', 'mais previsibilidade'],
  },
  {
    id: 'anual',
    name: 'Anual',
    cycle: 'ciclo de 12 meses',
    badge: 'Maior economia',
    price: 'R$ 358,80',
    suffix: '/ano',
    oldPrice: 'R$ 598,00',
    total: 'Equivale a R$ 29,90/mês',
    economy: 'Economize R$ 239,20',
    equivalent: 'menor custo para operar o ano inteiro',
    checkoutUrl: 'https://pagamento.coachfitpro.com.br/checkout/211363657:1?subscription=4476',
    description: 'Para quem decidiu colocar o Coach Fit Pro como estrutura principal da operação.',
    highlights: ['Acesso completo por 12 meses', 'Planejamento de longo prazo', 'Foco em escala e retenção', 'Melhor para operações maduras'],
    bestFor: 'Coach que quer operar o ano inteiro com menor custo mensal e foco em escala, retenção e rotina de equipe.',
    operatingPromise: 'O ciclo anual transforma o app em infraestrutura fixa da operação, com menor custo equivalente por mês.',
    activationPlan: ['Ativar o ano com maior economia', 'Migrar a carteira em ondas semanais', 'Usar financeiro, ranking e indicadores para gestão contínua'],
    decisionPoints: ['maior economia', 'menor custo mensal', 'estrutura para longo prazo'],
  },
]
const primaryCartpandaCheckoutUrl = cartpandaCheckoutPlans[0].checkoutUrl

const defaultSalesContent = {
  navItems: [
    { label: 'Solução', target: 'recursos' },
    { label: 'Mecanismo', target: 'mecanismo' },
    { label: 'App', target: 'app-aluno' },
    { label: 'Resultados', target: 'simulador' },
    { label: 'Preços', target: 'precos' },
    { label: 'Dúvidas', target: 'duvidas' },
  ],
  heroBadge: 'Plataforma de operação para coaches fitness',
  secondaryCta: 'Ver como funciona',
  plansButton: 'Ver planos',
  loginButton: 'Entrar',
  heroStats: [
    { value: '1 painel', label: 'toda a operação' },
    { value: 'App aluno', label: 'experiência premium' },
    { value: '3 planos', label: 'mensal, semestral e anual' },
  ],
  heroProofs: [
    { title: 'Treino enviado', text: 'execução guiada e histórico' },
    { title: 'Dieta ajustada', text: 'macros e substituições' },
    { title: 'Cobrança clara', text: 'status por aluno' },
  ],
  valueBullets: [
    { title: 'Operação centralizada', text: 'Treino, dieta, financeiro, agenda e chat no mesmo lugar.' },
    { title: 'Aluno mais engajado', text: 'Portal simples para seguir rotina, registrar treino e enviar feedback.' },
    { title: 'Marca mais premium', text: 'Você entrega seu método com mais clareza, organização e autoridade.' },
  ],
  appVisual: {
    eyebrow: 'Visual de aplicativo',
    title: 'Mostre para o aluno que ele está dentro de um acompanhamento premium.',
    description: 'As telas foram pensadas para celular, com ações simples, feedback visual e informação separada por contexto. O aluno abre, entende o que precisa fazer e registra a rotina sem se perder.',
    cards: [
      { title: 'Treino guiado', text: 'Iniciar treino, pausar, registrar carga e concluir.' },
      { title: 'Dieta clara', text: 'Refeições, macros e substituições equivalentes.' },
      { title: 'Chat direto', text: 'Conversa em tempo real com envio de fotos.' },
      { title: 'Engajamento', text: 'Meta de água, calendário e desafios semanais.' },
    ],
    phoneScreens: [
      { kicker: 'Hoje', title: 'Olá, Élinton', subtitle: 'Calendário semanal · meta do dia', action: 'Desafio semanal 3/5', rows: ['Água 1,8L / 2,5L', 'Treino de pernas', 'Feedback semanal'], floatingIcon: 'wallet', floatingTitle: 'R$ 297,00', floatingText: 'plano mensal' },
      { kicker: 'Treino', title: 'Treino C', subtitle: 'Legs · 7 exercícios', action: 'Treino iniciado · 23:14', rows: ['Agachamento 4x10', 'Leg press 4x12', 'Cadeira flexora 3x12'], floatingIcon: 'dumbbell', floatingTitle: 'Treino', floatingText: 'enviado' },
      { kicker: 'Fatura e chat', title: 'Pagamento em dia', subtitle: 'Próxima cobrança em 6 dias', action: 'Chat com o coach', rows: ['Pix validado', 'Foto enviada', 'Plano alimentar ativo'], floatingIcon: 'message', floatingTitle: 'Anamnese', floatingText: 'recebida' },
    ],
    phoneNav: [
      { icon: 'dashboard', label: 'Início' },
      { icon: 'wallet', label: 'Fatura' },
      { icon: 'message', label: 'Chat' },
      { icon: 'menu', label: 'Menu' },
    ],
  },
  features: {
    eyebrow: 'Solução completa',
    title: 'A estrutura que transforma atendimento em operação.',
    description: 'O Coach Fit Pro organiza a entrega, reduz tarefas repetitivas e dá ao aluno a sensação de estar dentro de uma consultoria realmente profissional.',
    items: [
      { number: '01', title: 'Aluno 360º', description: 'Cadastro, anamnese, histórico, fotos, pagamentos, treino e dieta conectados em uma ficha única.' },
      { number: '02', title: 'Treinos profissionais', description: 'Prescrição por exercício, séries, cargas, notas do coach e vídeo de execução quando necessário.' },
      { number: '03', title: 'Nutrição com macros', description: 'Planos alimentares, alimentos da biblioteca, itens manuais e substituições equivalentes.' },
      { number: '04', title: 'Evolução comparável', description: 'Fotos, medidas, avaliações e gráficos para o coach mostrar progresso com clareza.' },
      { number: '05', title: 'Engajamento do aluno', description: 'Desafios, meta de água, check-ins, feedbacks e lembretes para manter constância.' },
      { number: '06', title: 'Financeiro sem bagunça', description: 'Planos próprios do coach, cobranças, status de pagamento e comprovantes organizados.' },
    ],
  },
  mechanism: {
    eyebrow: 'O custo invisível do improviso',
    title: 'Seu método pode ser excelente e ainda parecer menor do que realmente é.',
    description: 'Quando cada informação fica em um lugar, o coach trabalha mais, responde as mesmas dúvidas e perde força na hora de justificar preço, renovar e escalar.',
    items: [
      { title: 'Planilhas e mensagens espalhadas', problem: 'Dados importantes se perdem entre conversas, arquivos e aplicativos diferentes.', solution: 'Uma ficha central por aluno' },
      { title: 'Cobrança manual e atrasos', problem: 'Sem uma visão financeira, acompanhar vencimentos depende da memória do coach.', solution: 'Planos e pagamentos organizados' },
      { title: 'Aluno sem clareza do processo', problem: 'Treino, dieta e orientações se misturam, reduzindo a percepção de acompanhamento.', solution: 'Portal próprio e rotina guiada' },
      { title: 'Decisões sem histórico completo', problem: 'Sem fotos, medidas, constância e relatos lado a lado, ajustar o plano fica mais difícil.', solution: 'Evolução registrada e comparável' },
    ],
  },
  commandCenter: {
    eyebrow: 'Motor de recorrência',
    title: 'Organização, cobrança e retenção trabalhando no mesmo fluxo.',
    description: 'O Coach Fit Pro não é apenas um lugar para guardar treino e dieta. Ele conecta rotina do aluno, status financeiro, feedbacks e renovações para o treinador enxergar onde está ganhando, onde está perdendo e onde precisa agir.',
    cards: [
      { title: 'Centraliza', text: 'Fim do PDF, Excel e mensagem perdida.' },
      { title: 'Cobra', text: 'Vencimentos, Pix e validação em um só lugar.' },
      { title: 'Retém', text: 'Desafios, feedbacks e evolução mantêm o aluno ativo.' },
    ],
    dashboardEyebrow: 'Dashboard financeiro',
    dashboardTitle: 'Receita, renovações e inadimplência sob controle',
    dashboardBadge: 'ao vivo',
    metrics: [
      { label: 'Recebido no mês', value: 'R$ 8.940', detail: '+18%' },
      { label: 'Renovações próximas', value: '32', detail: '7 dias' },
      { label: 'A receber', value: 'R$ 2.310', detail: 'pendente' },
      { label: 'Alunos liberados', value: '94%', detail: 'pagos' },
    ],
    automationItems: [
      { title: 'Cobranças automáticas', text: 'Pix, WhatsApp e status por aluno' },
      { title: 'Confirmação manual', text: 'coach valida e libera o acesso' },
      { title: 'Planos próprios', text: 'mensal, semanal, semestral ou anual' },
    ],
    dashboardFootnote: 'Exemplo visual do painel. Dentro do app, os números vêm dos recebimentos cadastrados pelo treinador.',
  },
  comparison: {
    eyebrow: 'Antes e depois',
    title: 'A diferença não está apenas na ferramenta. Está na forma como o aluno percebe seu serviço.',
    beforeLabel: 'Antes:',
    afterLabel: 'Com Coach Fit Pro:',
    items: [
      { item: 'Cadastro', before: 'Formulários e mensagens soltas', after: 'Código, consentimento e continuidade' },
      { item: 'Prescrição', before: 'Arquivos separados', after: 'Treino e dieta no portal' },
      { item: 'Acompanhamento', before: 'Perguntas no WhatsApp', after: 'Check-ins e histórico' },
      { item: 'Evolução', before: 'Fotos na galeria', after: 'Avaliações e gráficos' },
      { item: 'Financeiro', before: 'Agenda ou memória', after: 'Cobranças e vencimentos' },
      { item: 'Comunicação', before: 'Conversa sem contexto', after: 'Mensagens ligadas ao aluno' },
    ],
  },
  studentApp: {
    eyebrow: 'Experiência do aluno',
    title: 'O aluno não entra em “mais uma planilha”. Ele entra no seu ecossistema.',
    description: 'Cada aluno recebe um acesso próprio para consultar treino, dieta, compromissos, cobranças, desafios, meta de água e falar com o coach.',
    cta: 'Profissionalizar meu acompanhamento',
    items: [
      { title: 'Primeiro acesso', text: 'Código individual, consentimento e anamnese guiada.' },
      { title: 'Rotina diária', text: 'Treino, alimentação, água e desafios sempre disponíveis no celular.' },
      { title: 'Prestação de contas', text: 'Check-ins, fotos, feedbacks e conclusão de treinos registrados.' },
      { title: 'Proximidade', text: 'Chat em tempo real, agenda e orientações em um só ambiente.' },
    ],
  },
  results: {
    eyebrow: 'Potencial de faturamento',
    title: 'Quando a operação fica mais profissional, o crescimento deixa de depender apenas de trabalhar mais horas.',
    description: 'O Coach Fit Pro reúne tudo que sustenta um acompanhamento de maior valor: entrega organizada, experiência do aluno, histórico, comunicação, financeiro e capacidade para atender uma carteira maior.',
    simulatorEyebrow: 'Simulador de cenário',
    simulatorTitle: 'Quanto sua operação pode movimentar?',
    simulatorDisclaimer: 'Estimativa, não garantia de resultado',
    items: [
      { title: 'Mais capacidade', text: 'Processos centralizados reduzem tarefas repetitivas e facilitam acompanhar mais alunos.' },
      { title: 'Maior valor percebido', text: 'Um portal completo torna visível tudo que existe dentro do acompanhamento.' },
      { title: 'Mais retenção', text: 'Rotina, check-ins e evolução ajudam o aluno a permanecer conectado ao processo.' },
      { title: 'Receita previsível', text: 'Planos, vencimentos e pagamentos ficam claros para o coach agir no momento certo.' },
    ],
  },
  objections: {
    eyebrow: 'Feito para a rotina real do coach',
    title: 'Uma boa plataforma precisa se adaptar ao seu método, não substituir sua identidade.',
    description: 'Você mantém sua metodologia e ganha uma estrutura para entregar, acompanhar e mostrar o valor dela.',
    positiveTitle: 'O Coach Fit Pro faz sentido para você que',
    negativeTitle: 'O sistema não promete atalhos',
    positiveItems: [
      'Atende alunos online, presencialmente ou de forma híbrida.',
      'Quer reduzir tarefas repetitivas sem perder proximidade.',
      'Precisa organizar treino, dieta, evolução e financeiro.',
      'Deseja aumentar o valor percebido do acompanhamento.',
    ],
    negativeItems: [
      'Não substitui sua análise e sua responsabilidade profissional.',
      'Não garante faturamento sem posicionamento e execução.',
      'Não obriga você a migrar todos os alunos de uma vez.',
      'Não limita exercícios ou alimentos apenas aos itens da biblioteca.',
    ],
  },
  faq: {
    eyebrow: 'Dúvidas antes de começar',
    title: 'O que você precisa saber sobre o Coach Fit Pro',
    items: [
      { question: 'Meus alunos precisam instalar alguma coisa?', answer: 'Não. O acesso funciona pelo navegador no celular ou computador, usando o código individual enviado pelo coach.' },
      { question: 'Já uso WhatsApp. Por que preciso de uma plataforma?', answer: 'O WhatsApp continua útil para contato rápido. O Coach Fit Pro organiza o que precisa permanecer acessível e consultável: prescrição, histórico, check-ins, medidas, agenda e financeiro.' },
      { question: 'Vou precisar cadastrar tudo novamente?', answer: 'Você pode começar com os alunos ativos e preencher as informações conforme usa. Não é necessário interromper seu atendimento para organizar toda a carteira.' },
      { question: 'Consigo usar no celular e no desktop?', answer: 'Sim. O painel e o portal do aluno foram adaptados para os dois formatos, permitindo acompanhar a operação onde você estiver.' },
      { question: 'Preciso abandonar minhas ferramentas atuais no primeiro dia?', answer: 'Não. Você pode implantar o Coach Fit Pro por etapas, validar o fluxo com alguns alunos e ampliar conforme sua equipe ganha segurança.' },
      { question: 'Quais planos estão disponíveis?', answer: 'Você pode escolher entre plano mensal, semestral ou anual. Todos liberam o painel completo, portal do aluno, treinos, nutrição, cobranças, chat e acompanhamento em um só lugar. O valor e a condição de cada plano aparecem na etapa de pagamento da Cartpanda.' },
    ],
  },
  pricing: {
    eyebrow: 'Planos Coach Fit Pro',
    title: 'Comece hoje. Escale no seu ritmo.',
    description: 'Escolha o ciclo ideal, veja a oferta na hora e libere uma estrutura completa para vender, acompanhar e reter alunos.',
    decisionTitle: 'Decisão inteligente',
    decisionByPlan: {
      mensal: 'Perfeito para testar a operação sem travar caixa e já sentir a diferença na entrega.',
      semestral: 'Dá tempo para implantar, ajustar o processo e medir retenção com mais tranquilidade.',
      anual: 'Melhor para quem quer transformar o app em estrutura fixa e reduzir custo mensal.',
    },
    bestForTitle: 'Melhor para',
    unlockTitle: 'O que você destrava',
    unlockText: 'Painel do coach, app do aluno, treino, nutrição, financeiro, chat, agenda, desafios, água, check-ins e evolução.',
    afterSignupTitle: 'Depois de assinar',
    activationBadge: 'liberação automática',
    deliveryCards: [
      { title: 'Entrega premium', text: 'treino, dieta, check-ins e chat em um só fluxo' },
      { title: 'Mais percepção', text: 'o aluno sente que está dentro de uma operação profissional' },
      { title: 'Menos retrabalho', text: 'processos organizados para vender e acompanhar melhor' },
    ],
    cta: 'Assinar agora',
    includedTitle: 'Incluso no plano',
    noStudentFeeTitle: 'Sem taxa por aluno',
    noStudentFeeText: 'O treinador cresce a carteira sem pagar adicional por aluno cadastrado.',
    nextStepTitle: 'Próximo passo simples',
    nextStepText: 'Crie sua conta, confirme o plano escolhido e o painel é liberado assim que a Cartpanda aprovar o pagamento.',
    implementationTitle: 'Implantação prática',
    implementationSteps: ['Cadastre seus planos e alunos ativos', 'Envie convites com acesso individual', 'Acompanhe treino, dieta, chat e financeiro no mesmo painel'],
    metricCards: [
      { value: '100%', label: 'das ferramentas liberadas' },
      { value: '0%', label: 'taxa extra por aluno' },
    ],
  },
  footerText: 'Coach Fit Pro · Gestão profissional de acompanhamento',
}

function mergeList(current, fallback) {
  return Array.isArray(current) && current.length ? current : fallback
}

function mergeObject(current, fallback) {
  if (!current || typeof current !== 'object' || Array.isArray(current)) return fallback
  const merged = { ...fallback, ...current }
  Object.entries(fallback).forEach(([key, value]) => {
    if (Array.isArray(value)) merged[key] = mergeList(current[key], value)
    else if (value && typeof value === 'object') merged[key] = mergeObject(current[key], value)
  })
  return merged
}

function normalizeSalesContent(content = {}) {
  return mergeObject(content, defaultSalesContent)
}

const defaultAppAdminSettings = {
  salesHeadline: 'A forma mais profissional de entregar consultoria fitness online.',
  salesSubheadline: 'Centralize alunos, treinos, dieta, evolução, cobranças e chat em um painel moderno. Menos WhatsApp perdido, menos planilha solta e mais percepção de valor para vender acompanhamento recorrente.',
  salesCta: 'Escolher meu plano',
  announcement: 'Planos mensal, semestral e anual com pagamento integrado pela Cartpanda. Sem taxa por aluno.',
  primaryColor: '#00c7a8',
  accentColor: '#3b82f6',
  defaultCheckoutPlanId: 'semestral',
  signupEnabled: true,
  salesPageEnabled: true,
  maintenanceNotice: '',
  supportEmail: 'sac@coachfitpro.com.br',
  supportWhatsapp: '',
  salesContent: defaultSalesContent,
  checkoutPlans: cartpandaCheckoutPlans,
  featureFlags: {
    studentXp: true,
    financialDashboard: true,
    salesSimulator: true,
    waterGoal: true,
    salesAppVisual: true,
    salesCommandCenter: true,
    salesComparison: true,
    salesFaq: true,
  },
}
const ADMIN_SETTINGS_STORAGE_KEY = 'coachfitpro-admin-settings-preview'
const MASTER_ADMIN_EMAIL = 'sac@coachfitpro.com.br'
const ADMIN_EMAILS = [MASTER_ADMIN_EMAIL]
const ADMIN_ROUTE_PATH = '/admin'

function isAdminRoutePath() {
  if (typeof window === 'undefined') return false

  const forcedAdminEntry = Boolean(window.__FITCOACH_ADMIN_ROUTE__)
  const url = new URL(window.location.href)
  const path = url.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const firstSegment = path.split('/').filter(Boolean)[0] || ''
  const routeParam = (url.searchParams.get('route') || url.searchParams.get('page') || '').toLowerCase()
  const hashRoute = url.hash.toLowerCase().replace(/^#/, '').replace(/^\//, '')
  const adminSubdomain = url.hostname.toLowerCase().startsWith('admin.')

  return (
    forcedAdminEntry
    || adminSubdomain
    || path === ADMIN_ROUTE_PATH
    || path === `${ADMIN_ROUTE_PATH}/index.html`
    || firstSegment === 'admin'
    || routeParam === 'admin'
    || hashRoute === 'admin'
    || hashRoute.startsWith('admin/')
  )
}

function normalizeAdminSettings(settings = {}) {
  const checkoutPlans = Array.isArray(settings.checkoutPlans) && settings.checkoutPlans.length
    ? settings.checkoutPlans.map((plan, index) => ({
      ...cartpandaCheckoutPlans[index],
      ...plan,
      highlights: Array.isArray(plan.highlights) ? plan.highlights : (typeof plan.highlights === 'string' ? plan.highlights.split('\n').filter(Boolean) : cartpandaCheckoutPlans[index]?.highlights || []),
      activationPlan: Array.isArray(plan.activationPlan) ? plan.activationPlan : (typeof plan.activationPlan === 'string' ? plan.activationPlan.split('\n').filter(Boolean) : cartpandaCheckoutPlans[index]?.activationPlan || []),
      decisionPoints: Array.isArray(plan.decisionPoints) ? plan.decisionPoints : (typeof plan.decisionPoints === 'string' ? plan.decisionPoints.split(',').map((item) => item.trim()).filter(Boolean) : cartpandaCheckoutPlans[index]?.decisionPoints || []),
    }))
    : defaultAppAdminSettings.checkoutPlans

  return {
    ...defaultAppAdminSettings,
    ...settings,
    salesPageEnabled: settings.salesPageEnabled !== false,
    signupEnabled: settings.signupEnabled !== false,
    salesContent: normalizeSalesContent(settings.salesContent),
    checkoutPlans,
    featureFlags: {
      ...defaultAppAdminSettings.featureFlags,
      ...(settings.featureFlags || {}),
    },
  }
}

function loadLocalAdminSettings() {
  try {
    return normalizeAdminSettings(JSON.parse(window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY) || '{}'))
  } catch {
    return defaultAppAdminSettings
  }
}

function saveLocalAdminSettings(settings) {
  try {
    window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Mantem a edição local no estado mesmo se o navegador bloquear storage.
  }
}

function isMasterAdmin(user, sessionUser = null) {
  const emails = [user?.email, sessionUser?.email]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
  return emails.some((email) => ADMIN_EMAILS.includes(email))
}

const plans = [
  { name: 'Acompanhamento mensal', price: 'R$ 197', cycle: 'mensal', duration: '1 mês', features: 'Plano padrão configurável pelo treinador' },
]

const navItems = [
  { id: 'visao', label: 'Visão geral', icon: 'dashboard', tone: 'emerald' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', tone: 'sky' },
  { id: 'alunos', label: 'Alunos', icon: 'users', tone: 'cyan' },
  { id: 'avaliacoes', label: 'Avaliações', icon: 'chart', tone: 'amber' },
  { id: 'treinos', label: 'Treinos', icon: 'dumbbell', tone: 'lime' },
  { id: 'nutricao', label: 'Nutrição', icon: 'nutrition', tone: 'orange' },
  { id: 'checkins', label: 'Check-ins', icon: 'camera', tone: 'rose' },
  { id: 'pagamentos', label: 'Recebimentos', icon: 'wallet', tone: 'green' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', tone: 'yellow' },
  { id: 'mensagens', label: 'Mensagens', icon: 'message', tone: 'blue' },
  { id: 'aluno-app', label: 'Área do aluno', icon: 'phone', tone: 'teal' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings', tone: 'slate' },
  { id: 'assinatura', label: 'Minha assinatura', icon: 'credit', tone: 'indigo' },
]

const workoutPlan = [
  { day: 'Segunda', focus: 'Upper A', items: 'Supino, remada, desenvolvimento', status: 'Publicado' },
  { day: 'Terça', focus: 'Cardio Z2', items: '35 min de esteira + mobilidade', status: 'Publicado' },
  { day: 'Quarta', focus: 'Lower A', items: 'Agachamento, stiff, panturrilha', status: 'Revisar carga' },
  { day: 'Quinta', focus: 'Descanso ativo', items: 'Passos, alongamento, sono', status: 'Publicado' },
]

const exerciseLibrary = [
  { name: 'Supino reto com barra', group: 'Peitoral', equipment: 'Barra e banco', cues: 'Pés firmes, escápulas apoiadas e barra descendo com controle até a linha média do peito.', aliases: ['supino reto', 'bench press'] },
  { name: 'Supino inclinado com halteres', group: 'Peitoral', equipment: 'Halteres e banco', cues: 'Mantenha o peito aberto, antebraços alinhados e evite perder a posição dos ombros.', aliases: ['supino inclinado'] },
  { name: 'Crucifixo com halteres', group: 'Peitoral', equipment: 'Halteres e banco', cues: 'Cotovelos levemente flexionados e amplitude controlada sem forçar a articulação do ombro.', aliases: ['crucifixo'] },
  { name: 'Flexão de braços', group: 'Peitoral', equipment: 'Peso corporal', cues: 'Corpo alinhado, abdômen ativo e cotovelos acompanhando a linha natural dos ombros.', aliases: ['flexao', 'flexão'] },
  { name: 'Puxada frontal', group: 'Costas', equipment: 'Polia alta', cues: 'Inicie deprimindo as escápulas e puxe a barra em direção à parte superior do peito.', aliases: ['puxada alta', 'pulley frente'] },
  { name: 'Remada baixa', group: 'Costas', equipment: 'Polia baixa', cues: 'Tronco estável, peito aberto e cotovelos conduzindo o movimento para trás.', aliases: ['remada sentada'] },
  { name: 'Remada curvada com barra', group: 'Costas', equipment: 'Barra', cues: 'Quadril para trás, coluna neutra e barra aproximando-se do abdômen sem balanço.', aliases: ['remada curvada'] },
  { name: 'Barra fixa', group: 'Costas', equipment: 'Barra fixa', cues: 'Evite impulso, mantenha o tronco firme e conduza o peito em direção à barra.', aliases: ['pull up', 'barra'] },
  { name: 'Desenvolvimento com halteres', group: 'Ombros', equipment: 'Halteres', cues: 'Abdômen ativo, punhos alinhados e subida sem compensar com a lombar.', aliases: ['desenvolvimento', 'shoulder press'] },
  { name: 'Elevação lateral', group: 'Ombros', equipment: 'Halteres', cues: 'Eleve pelos cotovelos até a linha dos ombros, sem embalo e com carga controlada.', aliases: ['elevacao lateral'] },
  { name: 'Rosca direta', group: 'Bíceps', equipment: 'Barra', cues: 'Cotovelos próximos ao tronco e movimento sem inclinar o corpo para gerar impulso.', aliases: ['rosca barra'] },
  { name: 'Rosca alternada', group: 'Bíceps', equipment: 'Halteres', cues: 'Mantenha o braço estável e controle completamente a fase de descida.', aliases: ['rosca com halteres'] },
  { name: 'Tríceps na polia', group: 'Tríceps', equipment: 'Polia', cues: 'Cotovelos fixos, ombros baixos e extensão completa sem movimentar o tronco.', aliases: ['triceps pulley', 'tríceps pulley'] },
  { name: 'Tríceps francês', group: 'Tríceps', equipment: 'Halter', cues: 'Mantenha os cotovelos apontados à frente e evite compensação lombar.', aliases: ['triceps frances'] },
  { name: 'Agachamento livre', group: 'Quadríceps e glúteos', equipment: 'Barra', cues: 'Pés firmes, joelhos acompanhando a direção dos pés e coluna neutra durante toda a amplitude.', aliases: ['agachamento', 'back squat'] },
  { name: 'Leg press 45°', group: 'Quadríceps e glúteos', equipment: 'Leg press', cues: 'Lombar apoiada, joelhos alinhados e descida apenas até manter a pelve estável.', aliases: ['leg press'] },
  { name: 'Cadeira extensora', group: 'Quadríceps', equipment: 'Máquina', cues: 'Ajuste o eixo ao joelho, estabilize o quadril e controle a descida.', aliases: ['extensora'] },
  { name: 'Mesa flexora', group: 'Posteriores de coxa', equipment: 'Máquina', cues: 'Quadril apoiado, abdômen ativo e flexão sem tirar o tronco do banco.', aliases: ['flexora deitada'] },
  { name: 'Stiff com barra', group: 'Posteriores e glúteos', equipment: 'Barra', cues: 'Empurre o quadril para trás, mantenha a barra próxima às pernas e preserve a coluna neutra.', aliases: ['stiff', 'romeno'] },
  { name: 'Levantamento terra', group: 'Posteriores e costas', equipment: 'Barra', cues: 'Barra próxima ao corpo, tronco firme e força aplicada pelo chão sem arredondar a coluna.', aliases: ['terra', 'deadlift'] },
  { name: 'Afundo com halteres', group: 'Quadríceps e glúteos', equipment: 'Halteres', cues: 'Passo estável, tronco organizado e joelho dianteiro acompanhando a ponta do pé.', aliases: ['afundo', 'passada'] },
  { name: 'Elevação pélvica', group: 'Glúteos', equipment: 'Banco e barra', cues: 'Queixo levemente recolhido, costelas baixas e extensão do quadril sem hiperestender a lombar.', aliases: ['hip thrust'] },
  { name: 'Panturrilha em pé', group: 'Panturrilhas', equipment: 'Máquina ou peso corporal', cues: 'Use amplitude completa, pause no topo e controle a descida sem quicar.', aliases: ['panturrilha'] },
  { name: 'Prancha abdominal', group: 'Core', equipment: 'Peso corporal', cues: 'Contraia glúteos e abdômen, mantendo cabeça, tronco e quadril alinhados.', aliases: ['prancha'] },
  { name: 'Abdominal crunch', group: 'Core', equipment: 'Peso corporal', cues: 'Aproxime costelas e pelve sem puxar a cabeça e retorne de forma controlada.', aliases: ['abdominal'] },
]

const mealPlan = [
  { meal: 'Café da manhã', foods: 'Ovos, aveia, banana, café', macros: '42P / 74C / 18G' },
  { meal: 'Almoço', foods: 'Arroz, frango, feijão, salada', macros: '58P / 96C / 16G' },
  { meal: 'Pré-treino', foods: 'Iogurte, mel, granola', macros: '26P / 61C / 8G' },
  { meal: 'Jantar', foods: 'Patinho, batata, legumes', macros: '52P / 68C / 14G' },
]

const foodDatabase = [
  { name: 'Ovo Inteiro', category: 'Ovos', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sodium: 124 },
  { name: 'Clara de Ovo', category: 'Ovos', calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, sodium: 166 },
  { name: 'Gema de Ovo', category: 'Ovos', calories: 322, protein: 16, carbs: 3.6, fat: 27, fiber: 0, sodium: 48 },
  { name: 'Leite Integral', category: 'Laticínios', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sodium: 43 },
  { name: 'Leite Desnatado', category: 'Laticínios', calories: 34, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0, sodium: 44 },
  { name: 'Iogurte Natural', category: 'Laticínios', calories: 59, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sodium: 36 },
  { name: 'Queijo Cottage', category: 'Laticínios', calories: 98, protein: 11.1, carbs: 3.4, fat: 4.3, fiber: 0, sodium: 364 },
  { name: 'Queijo Mussarela', category: 'Laticínios', calories: 280, protein: 28, carbs: 3, fat: 17, fiber: 0, sodium: 627 },
  { name: 'Peito de Frango', category: 'Carnes', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74 },
  { name: 'Peito de Peru', category: 'Carnes', calories: 135, protein: 29, carbs: 0, fat: 1, fiber: 0, sodium: 55 },
  { name: 'Filé Mignon', category: 'Carnes', calories: 220, protein: 26, carbs: 0, fat: 12, fiber: 0, sodium: 62 },
  { name: 'Coxão Mole', category: 'Carnes', calories: 219, protein: 29, carbs: 0, fat: 8, fiber: 0, sodium: 58 },
  { name: 'Atum', category: 'Peixes', calories: 132, protein: 28, carbs: 0, fat: 1, fiber: 0, sodium: 37 },
  { name: 'Sardinha', category: 'Peixes', calories: 208, protein: 25, carbs: 0, fat: 11, fiber: 0, sodium: 307 },
  { name: 'Camarão', category: 'Frutos do Mar', calories: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, sodium: 111 },
  { name: 'Arroz Branco', category: 'Carboidratos', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sodium: 1 },
  { name: 'Batata Doce', category: 'Carboidratos', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sodium: 55 },
  { name: 'Macarrão Cozido', category: 'Carboidratos', calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8, sodium: 1 },
  { name: 'Pão Francês', category: 'Carboidratos', calories: 300, protein: 8, carbs: 58, fat: 3, fiber: 2, sodium: 648 },
  { name: 'Tapioca', category: 'Carboidratos', calories: 358, protein: 0.2, carbs: 88, fat: 0, fiber: 0.9, sodium: 1 },
  { name: 'Cuscuz', category: 'Carboidratos', calories: 112, protein: 3.8, carbs: 23, fat: 0.2, fiber: 1.7, sodium: 2 },
  { name: 'Feijão Preto', category: 'Leguminosas', calories: 132, protein: 8.9, carbs: 24, fat: 0.5, fiber: 8.7, sodium: 1 },
  { name: 'Feijão Carioca', category: 'Leguminosas', calories: 127, protein: 8.7, carbs: 22.8, fat: 0.5, fiber: 8.5, sodium: 2 },
  { name: 'Lentilha', category: 'Leguminosas', calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 8, sodium: 2 },
  { name: 'Grão de Bico', category: 'Leguminosas', calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, sodium: 7 },
  { name: 'Banana', category: 'Frutas', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sodium: 1 },
  { name: 'Maçã', category: 'Frutas', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sodium: 1 },
  { name: 'Morango', category: 'Frutas', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sodium: 1 },
  { name: 'Mamão', category: 'Frutas', calories: 43, protein: 0.5, carbs: 11, fat: 0.3, fiber: 1.7, sodium: 8 },
  { name: 'Abacate', category: 'Frutas', calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sodium: 7 },
  { name: 'Cenoura', category: 'Vegetais', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sodium: 69 },
  { name: 'Beterraba', category: 'Vegetais', calories: 43, protein: 1.6, carbs: 10, fat: 0.2, fiber: 2.8, sodium: 78 },
  { name: 'Pepino', category: 'Vegetais', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sodium: 2 },
  { name: 'Abobrinha', category: 'Vegetais', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, sodium: 8 },
  { name: 'Azeite de Oliva', category: 'Gorduras', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 2 },
  { name: 'Manteiga', category: 'Gorduras', calories: 717, protein: 0.8, carbs: 0.1, fat: 81, fiber: 0, sodium: 11 },
  { name: 'Castanha de Caju', category: 'Oleaginosas', calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, sodium: 12 },
  { name: 'Nozes', category: 'Oleaginosas', calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, sodium: 2 },
  { name: 'Creatina', category: 'Suplementos', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
  { name: 'Maltodextrina', category: 'Suplementos', calories: 380, protein: 0, carbs: 95, fat: 0, fiber: 0, sodium: 10 },
  { name: 'Dextrose', category: 'Suplementos', calories: 400, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 0 },
  { name: 'Hipercalórico', category: 'Suplementos', calories: 390, protein: 25, carbs: 60, fat: 5, fiber: 2, sodium: 120 },
]

const expandedFoodDatabase = [
  ['Whey Protein Concentrado', 'Suplementos', 402, 80, 8, 6, 0, 180, ['whey', 'whey concentrado']],
  ['Whey Protein Isolado', 'Suplementos', 370, 90, 2, 1, 0, 160, ['whey isolado']],
  ['Caseína', 'Suplementos', 365, 82, 8, 2, 0, 180, ['caseina']],
  ['Aveia em Flocos', 'Carboidratos', 394, 13.9, 66.6, 8.5, 9.1, 5, ['aveia', 'flocos de aveia']],
  ['Granola Tradicional', 'Carboidratos', 471, 10, 64, 20, 7, 80, ['granola']],
  ['Arroz Integral Cozido', 'Carboidratos', 124, 2.6, 25.8, 1, 2.7, 1, ['arroz integral']],
  ['Arroz Parboilizado Cozido', 'Carboidratos', 123, 2.6, 26, 0.4, 0.9, 1, ['arroz parboilizado']],
  ['Batata Inglesa Cozida', 'Carboidratos', 87, 1.9, 20.1, 0.1, 1.8, 4, ['batata inglesa', 'batata cozida']],
  ['Mandioca Cozida', 'Carboidratos', 125, 0.6, 30.1, 0.3, 1.6, 1, ['mandioca', 'aipim', 'macaxeira']],
  ['Inhame Cozido', 'Carboidratos', 118, 1.5, 27.9, 0.2, 4.1, 9, ['inhame']],
  ['Quinoa Cozida', 'Carboidratos', 120, 4.4, 21.3, 1.9, 2.8, 7, ['quinoa']],
  ['Pão Integral', 'Carboidratos', 247, 13, 41, 4.2, 7, 490, ['pao integral']],
  ['Pão de Forma', 'Carboidratos', 265, 9, 49, 3.2, 2.7, 491, ['pao de forma']],
  ['Pão de Queijo', 'Carboidratos', 363, 5.1, 34.2, 22.7, 0.6, 773, ['pao de queijo']],
  ['Cereal de Milho', 'Carboidratos', 357, 7.5, 84, 0.4, 3, 729, ['sucrilhos', 'cereal matinal']],
  ['Patinho Grelhado', 'Carnes', 219, 35.9, 0, 7.3, 0, 60, ['patinho', 'carne patinho']],
  ['Acém Cozido', 'Carnes', 215, 26.7, 0, 11.9, 0, 58, ['acem']],
  ['Músculo Cozido', 'Carnes', 194, 31.2, 0, 6.7, 0, 66, ['musculo bovino', 'musculo']],
  ['Carne Moída Magra', 'Carnes', 212, 26, 0, 12, 0, 66, ['carne moida']],
  ['Lombo Suíno Assado', 'Carnes', 210, 29, 0, 9, 0, 62, ['lombo suino', 'lombo de porco']],
  ['Peito de Frango Desfiado', 'Carnes', 163, 31, 0, 3.5, 0, 73, ['frango desfiado', 'frango cozido']],
  ['Coxa de Frango sem Pele', 'Carnes', 209, 26, 0, 10.9, 0, 90, ['coxa de frango']],
  ['Tilápia Grelhada', 'Peixes', 128, 26.2, 0, 2.7, 0, 56, ['tilapia', 'file de tilapia']],
  ['Salmão Grelhado', 'Peixes', 206, 22.1, 0, 12.4, 0, 61, ['salmao']],
  ['Merluza Cozida', 'Peixes', 121, 26, 0, 1.6, 0, 70, ['merluza']],
  ['Omelete Simples', 'Ovos', 154, 10.6, 0.7, 11.7, 0, 155, ['omelete']],
  ['Iogurte Grego Natural', 'Laticínios', 97, 9, 3.9, 5, 0, 36, ['iogurte grego']],
  ['Iogurte Proteico', 'Laticínios', 68, 10, 5, 0.8, 0, 55, ['iogurte protein']],
  ['Queijo Minas Frescal', 'Laticínios', 264, 17.4, 3.2, 20.2, 0, 450, ['queijo minas']],
  ['Ricota', 'Laticínios', 174, 11.3, 3, 13, 0, 84, []],
  ['Requeijão Light', 'Laticínios', 180, 10, 6, 13, 0, 560, ['requeijao light']],
  ['Feijão Branco Cozido', 'Leguminosas', 139, 9.7, 25.1, 0.4, 6.3, 5, ['feijao branco']],
  ['Ervilha Cozida', 'Leguminosas', 84, 5.4, 15, 0.4, 5.5, 3, ['ervilha']],
  ['Soja Cozida', 'Leguminosas', 173, 16.6, 9.9, 9, 6, 1, ['soja']],
  ['Laranja', 'Frutas', 47, 0.9, 11.8, 0.1, 2.4, 0, []],
  ['Pera', 'Frutas', 57, 0.4, 15.2, 0.1, 3.1, 1, []],
  ['Uva', 'Frutas', 69, 0.7, 18.1, 0.2, 0.9, 2, []],
  ['Manga', 'Frutas', 60, 0.8, 15, 0.4, 1.6, 1, []],
  ['Abacaxi', 'Frutas', 50, 0.5, 13.1, 0.1, 1.4, 1, []],
  ['Melancia', 'Frutas', 30, 0.6, 7.6, 0.2, 0.4, 1, []],
  ['Kiwi', 'Frutas', 61, 1.1, 14.7, 0.5, 3, 3, []],
  ['Açaí sem Açúcar', 'Frutas', 70, 1, 6, 5, 2.6, 7, ['acai', 'polpa de acai']],
  ['Brócolis Cozido', 'Vegetais', 35, 2.4, 7.2, 0.4, 3.3, 41, ['brocolis']],
  ['Couve Cozida', 'Vegetais', 36, 2.5, 7.3, 0.5, 2.6, 30, ['couve']],
  ['Espinafre Cozido', 'Vegetais', 23, 3, 3.8, 0.3, 2.4, 70, ['espinafre']],
  ['Alface', 'Vegetais', 15, 1.4, 2.9, 0.2, 1.3, 28, []],
  ['Tomate', 'Vegetais', 18, 0.9, 3.9, 0.2, 1.2, 5, []],
  ['Couve-flor Cozida', 'Vegetais', 25, 1.9, 5, 0.3, 2, 30, ['couve flor']],
  ['Pasta de Amendoim Integral', 'Oleaginosas', 588, 25, 20, 50, 6, 17, ['pasta de amendoim']],
  ['Amendoim Torrado', 'Oleaginosas', 606, 22.5, 18.7, 54, 7.8, 6, ['amendoim']],
  ['Amêndoas', 'Oleaginosas', 579, 21.2, 21.6, 49.9, 12.5, 1, ['amendoas']],
  ['Castanha-do-Pará', 'Oleaginosas', 659, 14.3, 11.7, 67.1, 7.5, 3, ['castanha do para']],
  ['Chia', 'Sementes', 486, 16.5, 42.1, 30.7, 34.4, 16, []],
  ['Linhaça', 'Sementes', 534, 18.3, 28.9, 42.2, 27.3, 30, ['linhaca']],
  ['Mel', 'Açúcares', 304, 0.3, 82.4, 0, 0.2, 4, []],
  ['Chocolate 70% Cacau', 'Doces', 598, 7.8, 45.9, 42.6, 10.9, 20, ['chocolate 70', 'chocolate amargo']],
  ['Café sem Açúcar', 'Bebidas', 2, 0.1, 0, 0, 0, 2, ['cafe preto', 'cafe sem acucar', 'cafe']],
  ['Água de Coco', 'Bebidas', 19, 0.7, 3.7, 0.2, 1.1, 105, ['agua de coco']],
  ['Suco de Laranja Natural', 'Bebidas', 45, 0.7, 10.4, 0.2, 0.2, 1, ['suco de laranja']],
].map(([name, category, calories, protein, carbs, fat, fiber, sodium, aliases]) => ({
  name, category, calories, protein, carbs, fat, fiber, sodium, aliases,
}))

foodDatabase.push(...expandedFoodDatabase)

const foodCategories = [...new Set([...foodDatabase.map((food) => food.category), 'Preparações'])]

const foodEstimateRules = [
  { keywords: ['whey', 'proteina em po', 'protein'], category: 'Suplementos', macros: { calories: 400, protein: 78, carbs: 8, fat: 6, fiber: 0, sodium: 180 } },
  { keywords: ['aveia'], category: 'Carboidratos', macros: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sodium: 2 } },
  { keywords: ['patinho'], category: 'Carnes', macros: { calories: 219, protein: 35.9, carbs: 0, fat: 7.3, fiber: 0, sodium: 60 } },
  { keywords: ['tilapia', 'tilápia'], category: 'Peixes', macros: { calories: 96, protein: 20.1, carbs: 0, fat: 1.7, fiber: 0, sodium: 52 } },
  { keywords: ['salmao', 'salmão'], category: 'Peixes', macros: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sodium: 59 } },
  { keywords: ['mandioca', 'aipim', 'macaxeira'], category: 'Carboidratos', macros: { calories: 125, protein: 0.6, carbs: 30, fat: 0.3, fiber: 1.6, sodium: 1 } },
  { keywords: ['inhame'], category: 'Carboidratos', macros: { calories: 118, protein: 1.5, carbs: 28, fat: 0.2, fiber: 4.1, sodium: 9 } },
  { keywords: ['banana prata', 'banana nanica'], category: 'Frutas', macros: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sodium: 1 } },
  { keywords: ['pasta de amendoim', 'amendoim'], category: 'Oleaginosas', macros: { calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sodium: 17 } },
  { keywords: ['granola'], category: 'Carboidratos', macros: { calories: 471, protein: 10, carbs: 64, fat: 20, fiber: 7, sodium: 80 } },
  { keywords: ['omelete'], category: 'Ovos', macros: { calories: 154, protein: 10.6, carbs: 0.7, fat: 11.7, fiber: 0, sodium: 155 } },
  { keywords: ['hamburguer caseiro'], category: 'Carnes', macros: { calories: 250, protein: 26, carbs: 2, fat: 15, fiber: 0, sodium: 280 } },
  { keywords: ['frango empanado'], category: 'Carnes', macros: { calories: 260, protein: 25, carbs: 12, fat: 12, fiber: 0.8, sodium: 420 } },
  { keywords: ['arroz com frango', 'galinhada'], category: 'Preparações', macros: { calories: 170, protein: 10, carbs: 22, fat: 4.5, fiber: 1.2, sodium: 210 } },
  { keywords: ['feijoada'], category: 'Preparações', macros: { calories: 146, protein: 8.7, carbs: 11.6, fat: 7.1, fiber: 5.1, sodium: 340 } },
  { keywords: ['lasanha'], category: 'Preparações', macros: { calories: 170, protein: 9, carbs: 16, fat: 8, fiber: 1.2, sodium: 400 } },
  { keywords: ['pizza'], category: 'Preparações', macros: { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3, sodium: 600 } },
  { keywords: ['sanduiche natural'], category: 'Preparações', macros: { calories: 210, protein: 14, carbs: 25, fat: 6, fiber: 2.5, sodium: 390 } },
  { keywords: ['vitamina de banana'], category: 'Bebidas', macros: { calories: 105, protein: 3.2, carbs: 19, fat: 2.2, fiber: 1.2, sodium: 35 } },
]

function createInitialData() {
  return {
    user: null,
    session: null,
    students: [],
    checkins: [],
    notifications: [],
    workouts: [],
    nutritionPlans: [],
    workoutLogs: [],
    messages: [],
    appointments: [],
    invoices: [],
    assessments: [],
    invites: [],
    anamneses: [],
    coachSettings: null,
    coachSubscription: null,
    appAdminSettings: loadLocalAdminSettings(),
  }
}

function normalizeStoredData(value) {
  const initial = createInitialData()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return initial

  return Object.fromEntries(
    Object.entries({ ...initial, ...value }).map(([key, item]) => [
      key,
      Array.isArray(initial[key]) ? (Array.isArray(item) ? item : []) : item,
    ]),
  )
}

function mergeRecords(current = [], loaded = []) {
  const records = new Map()
  const combined = [...loaded, ...current]
  combined.forEach((item, index) => {
    const key = item?.id ? String(item.id) : `item-${index}-${item?.createdAt || item?.completedAt || ''}`
    records.set(key, item)
  })
  return [...records.values()]
}

function prepareDataForStorage(data) {
  if (supabaseEnabled) {
    return {
      ...createInitialData(),
      user: data.user ?? null,
      session: data.session ?? null,
      coachSettings: data.coachSettings ?? null,
      appAdminSettings: data.appAdminSettings ?? loadLocalAdminSettings(),
    }
  }

  return {
    ...data,
    checkins: (data.checkins ?? []).map(({ photoFile, ...checkin }) => ({
      ...checkin,
      photo: typeof checkin.photo === 'string' && checkin.photo.startsWith('data:') ? '' : checkin.photo,
    })),
    workouts: (data.workouts ?? []).map((workout) => ({
      ...workout,
      exercises: (workout.exercises ?? []).map(({ videoFile, ...exercise }) => exercise),
    })),
    messages: (data.messages ?? []).map(({ attachmentFile, attachmentPreview, ...message }) => message),
  }
}

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? normalizeStoredData(prepareDataForStorage(JSON.parse(saved))) : createInitialData()
    } catch {
      return createInitialData()
    }
  })
  const [remoteStatus, setRemoteStatus] = useState(
    supabaseEnabled ? 'Conectando Supabase' : productionWithoutSupabase ? 'Configuração pendente' : 'Banco local',
  )
  const [remoteError, setRemoteError] = useState(
    productionWithoutSupabase ? 'As variáveis do Supabase ainda não foram configuradas nesta publicação.' : '',
  )

  useEffect(() => {
    if (!supabaseEnabled) return undefined
    let active = true
    loadRemoteAppAdminSettings()
      .then((settings) => {
        if (!active || !settings) return
        const normalized = normalizeAdminSettings(settings)
        saveLocalAdminSettings(normalized)
        setData((current) => ({ ...current, appAdminSettings: normalized }))
      })
      .catch(() => {
        // O app continua usando as configurações padrão até o SQL do Admin Master ser aplicado.
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.access_token) return

    setSupabaseSession(data.session.access_token)

    let active = true
    loadRemoteData()
      .then((remoteData) => {
        if (!active) return
        setData((current) => ({
          ...current,
          ...remoteData,
          user: remoteData.user ?? current.user,
          students: remoteData.students ?? [],
          checkins: remoteData.checkins ?? [],
          notifications: remoteData.notifications ?? [],
          workouts: remoteData.workouts ?? [],
          nutritionPlans: remoteData.nutritionPlans ?? [],
          workoutLogs: remoteData.workoutLogs ?? [],
          messages: remoteData.messages ?? [],
          appointments: remoteData.appointments ?? [],
          invoices: remoteData.invoices ?? [],
          assessments: remoteData.assessments ?? [],
          invites: remoteData.invites ?? [],
          anamneses: remoteData.anamneses ?? [],
          coachSettings: remoteData.coachSettings ?? current.coachSettings,
          coachSubscription: remoteData.coachSubscription ?? current.coachSubscription,
          appAdminSettings: remoteData.appAdminSettings ?? current.appAdminSettings,
        }))
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      })
      .catch((error) => {
        if (!active) return
        const message = error?.message ?? String(error)
        if (message.includes('JWT expired') || message.includes('PGRST303')) {
          if (data.session?.refresh_token) {
            refreshCoachSession(data.session.refresh_token)
              .then((nextSession) => {
                if (!active) return
                setData((current) => ({
                  ...current,
                  session: nextSession,
                  user: current.user ?? nextSession.user,
                }))
                setRemoteStatus('Sessão renovada')
                setRemoteError('')
              })
              .catch(() => {
                if (!active) return
                setSupabaseSession('')
                setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], invites: [], anamneses: [], coachSettings: null, coachSubscription: null }))
                setRemoteStatus('Sessão expirada')
                setRemoteError('Sua sessão expirou. Entre novamente para continuar.')
              })
            return
          }

          setSupabaseSession('')
          setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], invites: [], anamneses: [], coachSettings: null, coachSubscription: null }))
          setRemoteStatus('Sessão expirada')
          setRemoteError('Sua sessão expirou. Entre novamente para continuar.')
          return
        }
        setRemoteStatus('Supabase indisponível')
        setRemoteError(message)
      })

    return () => {
      active = false
    }
  }, [data.session?.access_token, data.session?.refresh_token])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepareDataForStorage(data)))
    } catch {
      setRemoteStatus('Armazenamento do navegador cheio')
      setRemoteError('Alguns dados temporários não puderam ser mantidos neste navegador. Seus registros salvos no Supabase continuam seguros.')
    }
  }, [data])

  return [data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError]
}

export default function App() {
  const [data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError] = useStoredData()
  const [activeView, setActiveView] = useState('visao')
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id ?? 1)
  const [studentAccess, setStudentAccess] = useState(null)
  const [recoveryAccessToken, setRecoveryAccessToken] = useState(() => getRecoveryAccessToken())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [billingClock, setBillingClock] = useState(Date.now())
  const subscriptionCheckRef = useRef(0)
  const salesPreview = new URLSearchParams(window.location.search).get('preview') === 'vendas'
  const [adminRoute, setAdminRoute] = useState(() => isAdminRoutePath())

  const selectedStudent = useMemo(
    () => data.students.find((student) => student.id === selectedStudentId) ?? data.students[0],
    [data.students, selectedStudentId],
  )

  const unreadCount = data.notifications.filter((item) => !item.read).length
  const paidStudents = data.students.filter((student) => student.payment === 'Pago').length
  const averageAdherence = Math.round(
    data.students.reduce((sum, student) => sum + Number(student.adherence || 0), 0) / Math.max(data.students.length, 1),
  )
  const openCheckins = data.checkins.filter((item) => item.state !== 'Recebido').length
  const upcomingAppointments = (data.appointments ?? []).filter((appointment) => (
    new Date(appointment.startsAt) >= new Date()
    && !['Concluido', 'Cancelado'].includes(appointment.status)
  ))
  const smartAlerts = useMemo(
    () => buildSmartAlerts(
      data.students,
      data.checkins,
      data.workouts ?? [],
      data.nutritionPlans ?? [],
      data.appointments ?? [],
      data.invoices ?? [],
      data.assessments ?? [],
    ),
    [data.students, data.checkins, data.workouts, data.nutritionPlans, data.appointments, data.invoices, data.assessments],
  )
  const totalAlertCount = unreadCount + smartAlerts.length
  const coachBillingCycle = getCoachBillingCycle(data.coachSubscription, data.user?.createdAt, billingClock)
  const coachSubscriptionActive = isCoachSubscriptionActive(data.coachSubscription)
  const shouldLockCoachTools = Boolean(data.user && supabaseEnabled && !coachSubscriptionActive)
  const coachPlans = useMemo(() => getCoachPlans(data.coachSettings), [data.coachSettings])
  const appAdminSettings = useMemo(() => normalizeAdminSettings(data.appAdminSettings), [data.appAdminSettings])
  const masterAdmin = isMasterAdmin(data.user, data.session?.user)
  const visibleNavItems = useMemo(() => (
    masterAdmin
      ? [...navItems, { id: 'admin-master', label: 'Admin Master', icon: 'settings', tone: 'emerald' }]
      : navItems
  ), [masterAdmin])

  useEffect(() => {
    function handleRouteChange() {
      setAdminRoute(isAdminRoutePath())
    }

    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener('hashchange', handleRouteChange)
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('hashchange', handleRouteChange)
    }
  }, [])

  useEffect(() => {
    if (adminRoute && masterAdmin) {
      setActiveView('admin-master')
    }
  }, [adminRoute, masterAdmin])

  useEffect(() => {
    if (data.session?.access_token) {
      setSupabaseSession(data.session.access_token)
    }
  }, [data.session?.access_token])

  useEffect(() => {
    const timer = window.setInterval(() => setBillingClock(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeView])

  useEffect(() => {
    if (shouldLockCoachTools && activeView !== 'assinatura' && activeView !== 'admin-master') {
      setActiveView('assinatura')
    }
  }, [shouldLockCoachTools, activeView])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const desktopMedia = window.matchMedia('(min-width: 1024px)')
    const handleDesktopChange = (event) => {
      if (event.matches) setMobileMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    desktopMedia.addEventListener('change', handleDesktopChange)
    return () => {
      document.body.style.overflow = previousOverflow
      desktopMedia.removeEventListener('change', handleDesktopChange)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.refresh_token) return undefined

    const expiresAt = data.session.expires_at
      ? Number(data.session.expires_at) * 1000
      : Date.now() + 45 * 60 * 1000
    const refreshDelay = Math.max(expiresAt - Date.now() - 60 * 1000, 30 * 1000)
    const timer = window.setTimeout(() => {
      refreshStoredSession('Sessão renovada automaticamente')
    }, refreshDelay)

    return () => window.clearTimeout(timer)
  }, [data.session?.refresh_token, data.session?.expires_at])

  const syncCoachWorkspace = useCallback(async ({ status = 'Atualizando painel', silent = false, goToOverviewOnActive = false } = {}) => {
    if (!supabaseEnabled || !data.session?.access_token) {
      return { active: false, refreshed: false }
    }

    if (!silent) setRemoteStatus(status)

    let remoteData
    try {
      remoteData = await loadRemoteData()
    } catch (error) {
      const message = error?.message || ''
      if (/jwt expired|PGRST303/i.test(message) && data.session?.refresh_token) {
        await refreshStoredSession('Sessão renovada')
        remoteData = await loadRemoteData()
      } else {
        if (!silent) handleRemoteError(error, 'Erro ao atualizar painel')
        return { active: false, refreshed: false, error }
      }
    }

    const activeSubscription = isCoachSubscriptionActive(remoteData.coachSubscription)
    setData((current) => {
      const wasActive = isCoachSubscriptionActive(current.coachSubscription)
      const unlockedNow = !wasActive && activeSubscription
      return {
        ...current,
        user: remoteData.user ?? current.user,
        students: remoteData.students,
        checkins: remoteData.checkins,
        notifications: unlockedNow
          ? [
            {
              id: `subscription-${Date.now()}`,
              title: 'Assinatura liberada',
              body: 'Pagamento confirmado. Suas ferramentas profissionais foram desbloqueadas.',
              read: false,
            },
            ...remoteData.notifications,
          ]
          : remoteData.notifications,
        workouts: remoteData.workouts ?? [],
        nutritionPlans: remoteData.nutritionPlans ?? [],
        workoutLogs: remoteData.workoutLogs ?? [],
        messages: remoteData.messages ?? [],
        appointments: remoteData.appointments ?? [],
        invoices: remoteData.invoices ?? [],
        assessments: remoteData.assessments ?? [],
        invites: remoteData.invites ?? [],
        anamneses: remoteData.anamneses ?? [],
        coachSettings: remoteData.coachSettings,
        coachSubscription: remoteData.coachSubscription,
      }
    })

    if (activeSubscription) {
      setRemoteStatus('Assinatura liberada')
      setRemoteError('')
      if (goToOverviewOnActive) setActiveView('visao')
    } else if (!silent) {
      setRemoteStatus('Aguardando confirmação do pagamento')
      setRemoteError('')
    }

    return { active: activeSubscription, refreshed: true, remoteData }
  }, [data.session?.access_token, data.session?.refresh_token])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.access_token || studentAccess || coachSubscriptionActive) return undefined

    async function checkSubscriptionOnReturn() {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - subscriptionCheckRef.current < 7000) return
      subscriptionCheckRef.current = now
      await syncCoachWorkspace({ status: 'Verificando assinatura', silent: true, goToOverviewOnActive: true })
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkSubscriptionOnReturn()
    }

    window.addEventListener('focus', checkSubscriptionOnReturn)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', checkSubscriptionOnReturn)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [data.session?.access_token, studentAccess, coachSubscriptionActive, syncCoachWorkspace])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.access_token || studentAccess || coachSubscriptionActive) return undefined

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('pagamento') || params.get('payment') || params.get('checkout')
    const returnedFromCheckout = ['confirmado', 'aprovado', 'sucesso', 'success', 'paid', 'ok'].includes(normalizeText(paymentStatus || ''))

    if (!returnedFromCheckout) return undefined

    let stopped = false
    let attempts = 0
    setActiveView('assinatura')
    setRemoteStatus('Verificando pagamento')
    setRemoteError('Recebemos seu retorno do checkout. Estamos conferindo a confirmação da compra automaticamente.')

    async function verifyPaymentReturn() {
      if (stopped) return
      attempts += 1
      const result = await syncCoachWorkspace({ status: 'Verificando pagamento', silent: true, goToOverviewOnActive: true })
      if (stopped) return

      if (result?.active) {
        stopped = true
        window.history.replaceState({}, '', window.location.pathname)
        setRemoteStatus('Assinatura liberada')
        setRemoteError('')
      } else if (attempts >= 24) {
        stopped = true
        setRemoteStatus('Aguardando confirmação do pagamento')
        setRemoteError('O checkout foi concluído, mas a confirmação ainda não chegou. Assim que a Cartpanda enviar o postback aprovado, o painel será liberado.')
      }
    }

    verifyPaymentReturn()
    const timer = window.setInterval(verifyPaymentReturn, 5000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [data.session?.access_token, studentAccess, coachSubscriptionActive, syncCoachWorkspace])

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('invite')
    if (!inviteCode || studentAccess) return

    enterStudentByInvite(inviteCode)
    window.history.replaceState({}, '', window.location.pathname)
  }, [studentAccess])

  useEffect(() => {
    if (studentAccess || !supabaseEnabled) return

    const savedCode = window.localStorage.getItem(STUDENT_ACCESS_KEY)
    if (!savedCode) return

    enterStudentByInvite(savedCode, { silent: true })
  }, [studentAccess])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.access_token || studentAccess) return undefined

    let active = true

    async function syncCoachMessages() {
      try {
        const latestMessages = await loadRemoteMessages()
        if (!active) return

        setData((current) => {
          const knownIds = new Set((current.messages ?? []).map((message) => String(message.id)))
          const newStudentMessages = latestMessages.filter((message) => (
            message.sender === 'student' && !knownIds.has(String(message.id))
          ))
          const messages = mergeRecords(current.messages, latestMessages)
          const students = current.students.map((student) => {
            const latestForStudent = messages.find((message) => String(message.studentId) === String(student.id))
            return latestForStudent ? { ...student, lastMessage: latestForStudent.body } : student
          })
          const notifications = newStudentMessages.length
            ? [
              ...newStudentMessages.map((message) => ({
                id: `message-${message.id}`,
                title: 'Nova mensagem do aluno',
                body: message.body,
                read: false,
              })),
              ...current.notifications,
            ]
            : current.notifications

          return { ...current, messages, students, notifications }
        })
      } catch (error) {
        if (!active) return
        if (/jwt expired|PGRST303/i.test(error?.message || '')) {
          handleRemoteError(error, 'Sessão expirada')
        }
      }
    }

    syncCoachMessages()
    const timer = window.setInterval(syncCoachMessages, 4000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [data.session?.access_token, studentAccess])

  useEffect(() => {
    if (!supabaseEnabled || !studentAccess?.student?.id || !studentAccess?.invite?.code) return undefined

    let active = true

    async function syncStudentMessages() {
      try {
        const latestMessages = await loadRemoteStudentMessagesByInvite(studentAccess.invite.code)
        if (!active) return

        setStudentAccess((current) => {
          if (!current?.student?.id) return current
          return {
            ...current,
            messages: mergeRecords(current.messages, latestMessages),
          }
        })
        setData((current) => ({
          ...current,
          messages: mergeRecords(current.messages, latestMessages),
        }))
      } catch {
        // Mantem a conversa aberta mesmo se a conexao oscilar por alguns segundos.
      }
    }

    syncStudentMessages()
    const timer = window.setInterval(syncStudentMessages, 3500)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [studentAccess?.student?.id, studentAccess?.invite?.code])

  useEffect(() => {
    if (!supabaseEnabled || !studentAccess?.invite?.code) return undefined

    let active = true

    async function syncStudentPortalAccess() {
      try {
        const latestAccess = await loadRemoteStudentByInvite(studentAccess.invite.code)
        if (!active) return

        setStudentAccess((current) => {
          if (!current?.invite?.code || current.invite.code !== latestAccess.invite?.code) return current
          return {
            ...latestAccess,
            messages: mergeRecords(latestAccess.messages, current.messages),
          }
        })
      } catch {
        // Mantem o aluno no portal mesmo se a leitura do acesso oscilar.
      }
    }

    const timer = window.setInterval(syncStudentPortalAccess, 10000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [studentAccess?.invite?.code])

  async function login(formData) {
    const name = formData.get('name')?.toString().trim() || 'Coach'
    const email = formData.get('email')?.toString().trim() || ''
    const password = formData.get('password')?.toString() || ''
    const mode = formData.get('mode')?.toString() || 'signin'
    const adminLogin = mode === 'admin'
    const user = { name, email, role: adminLogin ? 'Admin Master' : 'Coach principal' }

    if (productionWithoutSupabase) {
      setRemoteStatus('Configuração pendente')
      setRemoteError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Cloudflare antes de liberar o acesso.')
      return false
    }

    if (mode === 'forgot') {
      try {
        await requestCoachPasswordReset(email)
        setRemoteStatus('E-mail de recuperação enviado')
        setRemoteError('Abra o link recebido no e-mail para cadastrar uma nova senha.')
      } catch (error) {
        setRemoteStatus('Erro na recuperação de senha')
        setRemoteError(error.message)
      }
      return false
    }

    let savedUser = user
    let session = null
    if (supabaseEnabled) {
      try {
        session = mode === 'signup'
          ? await signUpCoach({ name, email, password })
          : await signInCoach({ email, password })
        savedUser = await upsertRemoteUser({ ...session.user, name: session.user.name || name })
        if (adminLogin && !isMasterAdmin(savedUser, session.user)) {
          await signOutCoach(session.access_token).catch(() => {})
          setSupabaseSession('')
          setRemoteStatus('Acesso negado')
          setRemoteError('Este login não tem permissão para acessar o Admin Master. Use sac@coachfitpro.com.br.')
          return false
        }
        const remoteData = await loadRemoteData()
        setData((current) => ({
          ...current,
          session,
          user: savedUser,
          students: remoteData.students,
          checkins: remoteData.checkins,
          notifications: remoteData.notifications.length
            ? remoteData.notifications
            : [{ id: Date.now(), title: 'Login realizado', body: `Bem-vindo, ${savedUser.name}.`, read: false }],
          workouts: remoteData.workouts ?? [],
          nutritionPlans: remoteData.nutritionPlans ?? [],
          workoutLogs: remoteData.workoutLogs ?? [],
          messages: remoteData.messages ?? [],
          appointments: remoteData.appointments ?? [],
          invoices: remoteData.invoices ?? [],
          assessments: remoteData.assessments ?? [],
          invites: remoteData.invites ?? [],
          anamneses: remoteData.anamneses ?? [],
          coachSettings: remoteData.coachSettings,
          coachSubscription: remoteData.coachSubscription,
        }))
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
        if (adminLogin) {
          setActiveView('admin-master')
        } else if (mode === 'signup' || !isCoachSubscriptionActive(remoteData.coachSubscription)) {
          setActiveView('assinatura')
        }
        return true
      } catch (error) {
        setSupabaseSession('')
        setRemoteStatus('Erro no login')
        setRemoteError(error.message)
        return false
      }
    }

    setData((current) => ({
      ...current,
      user: savedUser,
      notifications: [
        { id: Date.now(), title: 'Login realizado', body: `Bem-vindo, ${name}.`, read: false },
        ...current.notifications,
      ],
    }))
    return true
  }

  function logout() {
    const accessToken = data.session?.access_token
    if (accessToken) {
      signOutCoach(accessToken).catch(() => {})
    }
    setSupabaseSession('')
    setStudentAccess(null)
    setSelectedStudentId(null)
    setData((current) => ({
      ...current,
      user: null,
      session: null,
      students: [],
      checkins: [],
      notifications: [],
      workouts: [],
      nutritionPlans: [],
      workoutLogs: [],
      messages: [],
      appointments: [],
      invoices: [],
      assessments: [],
      invites: [],
      anamneses: [],
      coachSettings: null,
      coachSubscription: null,
    }))
  }

  async function refreshStoredSession(successStatus = 'Sessão renovada') {
    if (!data.session?.refresh_token) {
      throw new Error('Sessão expirada')
    }

    const nextSession = await refreshCoachSession(data.session.refresh_token)
    setSupabaseSession(nextSession.access_token)
    setData((current) => ({
      ...current,
      session: nextSession,
      user: current.user ?? nextSession.user,
    }))
    setRemoteStatus(successStatus)
    setRemoteError('')
    return nextSession
  }

  function handleRemoteError(error, fallbackStatus) {
    const message = error?.message ?? String(error)

    if (message.includes('JWT expired') || message.includes('PGRST303')) {
      if (data.session?.refresh_token) {
        refreshStoredSession('Sessão renovada')
          .then(() => {
            setRemoteError('Sessão renovada. Tente a ação novamente.')
          })
          .catch(() => {
            setSupabaseSession('')
            setRemoteStatus('Sessão expirada')
            setRemoteError('Sua sessão expirou. Entre novamente para continuar.')
            setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], invites: [], anamneses: [], coachSettings: null, coachSubscription: null }))
          })
        return
      }

      setSupabaseSession('')
      setRemoteStatus('Sessão expirada')
      setRemoteError('Sua sessão expirou. Entre novamente para continuar.')
      setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], invites: [], anamneses: [], coachSettings: null, coachSubscription: null }))
      return
    }

    setRemoteStatus(fallbackStatus)
    setRemoteError(message)
  }

  async function saveStudent(student) {
    const studentId = student.id || Date.now()
    const isNewStudent = !student.id
    let savedStudent = { ...student, id: studentId }
    let createdInvite = null

    if (supabaseEnabled) {
      try {
        savedStudent = await saveRemoteStudent(student, data.user?.id)
        if (isNewStudent) {
          try {
            createdInvite = await createRemoteStudentInvite(savedStudent.id, data.user?.id)
          } catch (inviteError) {
            setRemoteStatus('Aluno salvo, mas o código não foi gerado')
            setRemoteError(inviteError.message)
          }
        }
        if (createdInvite || !isNewStudent) {
          setRemoteStatus('Supabase conectado')
          setRemoteError('')
        }
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar aluno')
        throw error
      }
    }

    setData((current) => {
      const exists = current.students.some((item) => item.id === student.id)
      const students = exists
        ? current.students.map((item) => (item.id === student.id ? savedStudent : item))
        : [savedStudent, ...current.students]

      return {
        ...current,
        students,
        invites: createdInvite ? [createdInvite, ...(current.invites ?? [])] : current.invites ?? [],
        notifications: [
          {
            id: Date.now() + 1,
            title: exists ? 'Aluno atualizado' : 'Aluno cadastrado',
            body: createdInvite ? `${student.name} - código ${createdInvite.code}` : student.name,
            read: false,
          },
          ...current.notifications,
        ],
      }
    })
    setSelectedStudentId(savedStudent.id)
    return { student: savedStudent, invite: createdInvite }
  }

  async function generateStudentInvite(studentId) {
    try {
      const createdInvite = await createRemoteStudentInvite(studentId, data.user?.id)
      setData((current) => ({
        ...current,
        invites: [
          createdInvite,
          ...(current.invites ?? []).filter((invite) => String(invite.studentId) !== String(studentId)),
        ],
      }))
      setRemoteStatus('Código do aluno gerado')
      setRemoteError('')
      return createdInvite
    } catch (error) {
      handleRemoteError(error, 'Erro ao gerar código do aluno')
      throw error
    }
  }

  async function deleteStudent(studentId) {
    if (supabaseEnabled) {
      try {
        await deleteRemoteStudent(studentId)
        setRemoteStatus('Aluno excluído')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao excluir aluno')
        throw error
      }
    }

    const belongsToStudent = (item) => String(item.studentId) === String(studentId)
    setData((current) => ({
      ...current,
      students: current.students.filter((student) => String(student.id) !== String(studentId)),
      checkins: current.checkins.filter((item) => !belongsToStudent(item)),
      workouts: current.workouts.filter((item) => !belongsToStudent(item)),
      nutritionPlans: current.nutritionPlans.filter((item) => !belongsToStudent(item)),
      workoutLogs: current.workoutLogs.filter((item) => !belongsToStudent(item)),
      messages: current.messages.filter((item) => !belongsToStudent(item)),
      appointments: current.appointments.filter((item) => !belongsToStudent(item)),
      invoices: current.invoices.filter((item) => !belongsToStudent(item)),
      assessments: current.assessments.filter((item) => !belongsToStudent(item)),
      invites: current.invites.filter((item) => !belongsToStudent(item)),
      anamneses: current.anamneses.filter((item) => !belongsToStudent(item)),
      notifications: [
        { id: Date.now(), title: 'Aluno excluído', body: 'O perfil e os registros vinculados foram removidos.', read: false },
        ...current.notifications,
      ],
    }))
    const remainingStudents = data.students.filter((student) => String(student.id) !== String(studentId))
    setSelectedStudentId(remainingStudents[0]?.id ?? null)
  }

  async function addCheckin(checkin) {
    const { photoFile, ...localCheckin } = checkin
    let savedCheckin = { ...localCheckin, id: Date.now() }

    if (supabaseEnabled) {
      try {
        savedCheckin = await saveRemoteCheckin(checkin)
        if (savedCheckin.uploadWarning) {
          setRemoteStatus('Check-in salvo sem a foto')
          setRemoteError(savedCheckin.uploadWarning)
        } else {
          setRemoteStatus('Supabase conectado')
          setRemoteError('')
        }
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar check-in')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      checkins: [savedCheckin, ...current.checkins],
      notifications: [
        { id: Date.now() + 1, title: 'Novo check-in', body: localCheckin.note || localCheckin.type, read: false },
        ...current.notifications,
      ],
    }))
    return savedCheckin
  }

  async function updatePayment(studentId, payment) {
    if (supabaseEnabled) {
      try {
        await updateRemotePayment(studentId, payment)
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar pagamento')
        return false
      }
    }

    setData((current) => ({
      ...current,
      students: current.students.map((student) => (student.id === studentId ? { ...student, payment } : student)),
      notifications: [
        { id: Date.now(), title: 'Pagamento atualizado', body: payment === 'Pago' ? 'Mensalidade marcada como paga.' : 'Pagamento pendente registrado.', read: false },
        ...current.notifications,
      ],
    }))
    return true
  }

  async function markNotificationsRead() {
    if (supabaseEnabled) {
      try {
        await markRemoteNotificationsRead()
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar notificações')
        return false
      }
    }

    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }))
    return true
  }

  async function saveWorkout(workout) {
    let savedWorkout = { ...workout, id: Date.now(), active: true }

    if (supabaseEnabled) {
      try {
        savedWorkout = await saveRemoteWorkout(workout, data.user?.id)
        setRemoteStatus('Treino salvo')
        setRemoteError(savedWorkout.uploadWarning || '')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar treino')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      workouts: [savedWorkout, ...(current.workouts ?? [])],
    }))

    return savedWorkout
  }

  async function archiveWorkout(workoutId) {
    if (supabaseEnabled) {
      try {
        await archiveRemoteWorkout(workoutId)
        setRemoteStatus('Treino arquivado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao arquivar treino')
        return false
      }
    }
    setData((current) => ({
      ...current,
      workouts: current.workouts.map((workout) => (
        String(workout.id) === String(workoutId) ? { ...workout, active: false } : workout
      )),
    }))
    return true
  }

  async function saveNutritionPlan(plan) {
    let savedPlan = { ...plan, id: Date.now(), active: true }

    if (supabaseEnabled) {
      try {
        savedPlan = await saveRemoteNutritionPlan(plan, data.user?.id)
        setRemoteStatus('Dieta salva')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar dieta')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      nutritionPlans: [savedPlan, ...(current.nutritionPlans ?? [])],
    }))

    return savedPlan
  }

  async function archiveNutritionPlan(planId) {
    if (supabaseEnabled) {
      try {
        await archiveRemoteNutritionPlan(planId)
        setRemoteStatus('Dieta arquivada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao arquivar dieta')
        return false
      }
    }
    setData((current) => ({
      ...current,
      nutritionPlans: current.nutritionPlans.map((plan) => (
        String(plan.id) === String(planId) ? { ...plan, active: false } : plan
      )),
    }))
    return true
  }

  async function completeWorkout(log) {
    let savedLog = { ...log, id: Date.now(), completedAt: new Date().toISOString() }

    if (supabaseEnabled) {
      try {
        savedLog = await saveRemoteWorkoutLog(log)
        setRemoteStatus('Treino concluído')
        setRemoteError('')
      } catch (error) {
        const offlineLike = !navigator.onLine || /network|fetch|internet|failed to fetch|conectar/i.test(error?.message || '')
        if (!offlineLike) {
          handleRemoteError(error, 'Erro ao concluir treino')
          throw error
        }
        savedLog = {
          ...savedLog,
          offline: true,
          syncStatus: 'pending',
        }
        setRemoteStatus('Treino salvo offline')
        setRemoteError('Quando a internet voltar, confira a conexão antes de registrar o próximo treino.')
      }
    }

    setData((current) => ({
      ...current,
      workoutLogs: [savedLog, ...(current.workoutLogs ?? [])],
    }))

    return savedLog
  }

  async function saveAppointment(appointment) {
    const localAppointment = {
      ...appointment,
      id: Date.now(),
      coachId: data.user?.id,
    }
    let savedAppointment = localAppointment

    if (supabaseEnabled) {
      try {
        savedAppointment = await saveRemoteAppointment(appointment, data.user?.id)
        setRemoteStatus('Compromisso agendado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar compromisso')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      appointments: [...(current.appointments ?? []), savedAppointment]
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
      notifications: [
        { id: Date.now() + 1, title: 'Novo compromisso', body: savedAppointment.title, read: false },
        ...current.notifications,
      ],
    }))

    return savedAppointment
  }

  async function updateAppointmentStatus(appointmentId, status) {
    if (supabaseEnabled) {
      try {
        await updateRemoteAppointmentStatus(appointmentId, status)
        setRemoteStatus('Agenda atualizada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar agenda')
        return false
      }
    }

    setData((current) => ({
      ...current,
      appointments: (current.appointments ?? []).map((appointment) => (
        String(appointment.id) === String(appointmentId)
          ? { ...appointment, status }
          : appointment
      )),
    }))
    return true
  }

  async function saveInvoice(invoice) {
    const localInvoice = {
      ...invoice,
      id: Date.now(),
      coachId: data.user?.id,
      createdAt: new Date().toISOString(),
      paidAt: invoice.status === 'Pago' ? new Date().toISOString() : null,
    }
    let savedInvoice = localInvoice

    if (supabaseEnabled) {
      try {
        savedInvoice = await saveRemoteInvoice(invoice, data.user?.id)
        setRemoteStatus('Cobrança criada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao criar cobrança')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      invoices: [savedInvoice, ...(current.invoices ?? [])],
      notifications: [
        { id: Date.now() + 1, title: 'Nova cobrança', body: `${savedInvoice.planName} - ${formatCurrency(savedInvoice.amount)}`, read: false },
        ...current.notifications,
      ],
    }))

    return savedInvoice
  }

  async function saveAssessment(assessment) {
    const localAssessment = {
      ...assessment,
      id: Date.now(),
      coachId: data.user?.id,
    }
    let savedAssessment = localAssessment

    if (supabaseEnabled) {
      try {
        savedAssessment = await saveRemoteAssessment(assessment, data.user?.id)
        setRemoteStatus('Avaliação salva')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar avaliação')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      assessments: [savedAssessment, ...(current.assessments ?? [])],
      students: current.students.map((student) => (
        String(student.id) === String(savedAssessment.studentId)
          ? {
            ...student,
            weight: savedAssessment.weightKg ? `${formatNumber(savedAssessment.weightKg)} kg` : student.weight,
            bodyFat: savedAssessment.bodyFatPercent ? `${formatNumber(savedAssessment.bodyFatPercent)}%` : student.bodyFat,
          }
          : student
      )),
      notifications: [
        { id: Date.now() + 1, title: 'Avaliação registrada', body: `Peso ${formatNumber(savedAssessment.weightKg)} kg`, read: false },
        ...current.notifications,
      ],
    }))

    return savedAssessment
  }

  async function saveCoachSettings(settings) {
    let savedSettings = { ...settings, coachId: data.user?.id }

    if (supabaseEnabled) {
      try {
        savedSettings = await saveRemoteCoachSettings(settings, data.user?.id)
        setRemoteStatus('Configurações salvas')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar configurações')
        throw error
      }
    }

    setData((current) => ({ ...current, coachSettings: savedSettings }))
    return savedSettings
  }

  async function saveAppAdminSettings(settings) {
    const normalized = normalizeAdminSettings(settings)
    saveLocalAdminSettings(normalized)
    setData((current) => ({ ...current, appAdminSettings: normalized }))

    if (supabaseEnabled) {
      try {
        const savedSettings = normalizeAdminSettings(await saveRemoteAppAdminSettings(normalized))
        saveLocalAdminSettings(savedSettings)
        setData((current) => ({ ...current, appAdminSettings: savedSettings }))
        setRemoteStatus('Admin Master salvo')
        setRemoteError('')
        return savedSettings
      } catch (error) {
        setRemoteStatus('Admin salvo localmente')
        setRemoteError('Para salvar no banco e alterar sem GitHub, aplique o SQL do Admin Master no Supabase.')
        return normalized
      }
    }

    setRemoteStatus('Admin salvo localmente')
    return normalized
  }

  function exportAccountData() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      coach: data.user,
      settings: data.coachSettings,
      students: data.students,
      checkins: data.checkins.map(({ photo, photoFile, ...checkin }) => checkin),
      workouts: data.workouts,
      workoutLogs: data.workoutLogs,
      nutritionPlans: data.nutritionPlans,
      appointments: data.appointments,
      invoices: data.invoices,
      assessments: data.assessments,
      messages: data.messages,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fitcoach-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function updateInvoiceStatus(invoiceId, status, paymentMethod = '') {
    let savedInvoice = null
    let paymentSyncError = null

    if (supabaseEnabled) {
      try {
        savedInvoice = await updateRemoteInvoiceStatus(invoiceId, status, paymentMethod)
        if (status === 'Pago' && savedInvoice?.studentId) {
          try {
            await updateRemotePayment(savedInvoice.studentId, 'Pago')
          } catch (error) {
            paymentSyncError = error
          }
        }
        setRemoteStatus('Cobrança atualizada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar cobrança')
        return false
      }
    }

    setData((current) => {
      const currentInvoice = current.invoices?.find((invoice) => String(invoice.id) === String(invoiceId))
      const nextInvoice = savedInvoice ?? {
        ...currentInvoice,
        status,
        paymentMethod,
        paidAt: status === 'Pago' ? new Date().toISOString() : null,
      }

      return {
        ...current,
        invoices: (current.invoices ?? []).map((invoice) => (
          String(invoice.id) === String(invoiceId) ? nextInvoice : invoice
        )),
        students: current.students.map((student) => (
          String(student.id) === String(nextInvoice?.studentId)
            ? { ...student, payment: status === 'Pago' ? 'Pago' : status === 'Cancelado' ? student.payment : 'Pendente' }
            : student
        )),
      }
    })
    if (paymentSyncError) {
      handleRemoteError(paymentSyncError, 'Cobrança paga, mas o status do aluno não foi sincronizado')
      return 'partial'
    }
    return true
  }

  async function sendMessage(message) {
    const localAttachmentUrl = message.attachmentPreview || message.attachmentUrl || ''
    const localMessage = {
      ...message,
      id: Date.now(),
      coachId: message.coachId ?? data.user?.id,
      body: message.body?.trim() || (localAttachmentUrl ? (message.attachmentFile?.type?.startsWith('audio/') || message.attachmentType?.startsWith('audio/') ? 'Áudio enviado' : 'Foto enviada') : ''),
      read: message.sender === 'coach',
      attachmentUrl: localAttachmentUrl,
      attachmentType: message.attachmentFile?.type || message.attachmentType || '',
      attachmentName: message.attachmentFile?.name || message.attachmentName || '',
      createdAt: new Date().toISOString(),
    }
    let savedMessage = localMessage

    if (supabaseEnabled) {
      try {
        savedMessage = await saveRemoteMessage(localMessage)
        setRemoteStatus('Mensagem enviada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar mensagem')
        throw error
      }
    }

    setData((current) => ({
      ...current,
      messages: [savedMessage, ...(current.messages ?? [])],
      students: current.students.map((student) => (
        String(student.id) === String(savedMessage.studentId)
          ? { ...student, lastMessage: savedMessage.body }
          : student
      )),
      notifications: savedMessage.sender === 'student'
        ? [
          { id: Date.now() + 1, title: 'Nova mensagem do aluno', body: savedMessage.body, read: false },
          ...current.notifications,
        ]
        : current.notifications,
    }))

    return savedMessage
  }

  async function markStudentMessagesRead(studentId) {
    if (supabaseEnabled) {
      try {
        await markRemoteStudentMessagesRead(studentId)
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar mensagens')
        return false
      }
    }

    setData((current) => ({
      ...current,
      messages: (current.messages ?? []).map((message) => (
        String(message.studentId) === String(studentId) && message.sender === 'student'
          ? { ...message, read: true }
          : message
      )),
    }))
    return true
  }

  async function refreshCoachConversation(studentId) {
    if (!supabaseEnabled || !studentId) return []
    try {
      const latestMessages = await loadRemoteMessages(studentId)
      setData((current) => ({
        ...current,
        messages: mergeRecords(current.messages, latestMessages),
        students: current.students.map((student) => {
          const latestForStudent = latestMessages.find((message) => String(message.studentId) === String(student.id))
          return latestForStudent ? { ...student, lastMessage: latestForStudent.body } : student
        }),
      }))
      return latestMessages
    } catch (error) {
      if (/jwt expired|PGRST303/i.test(error?.message || '')) {
        handleRemoteError(error, 'Sessão expirada')
      }
      return []
    }
  }

  async function refreshStudentConversation() {
    if (!supabaseEnabled || !studentAccess?.invite?.code) return []
    try {
      const latestMessages = await loadRemoteStudentMessagesByInvite(studentAccess.invite.code)
      setStudentAccess((current) => (
        current ? { ...current, messages: mergeRecords(current.messages, latestMessages) } : current
      ))
      setData((current) => ({
        ...current,
        messages: mergeRecords(current.messages, latestMessages),
      }))
      return latestMessages
    } catch {
      return []
    }
  }

  async function enterStudentByInvite(code, options = {}) {
    const cleanCode = code.trim()
    if (!cleanCode) return false

    try {
      const access = await loadRemoteStudentByInvite(cleanCode)
      setStudentAccess(access)
      window.localStorage.setItem(STUDENT_ACCESS_KEY, access.invite?.code || cleanCode)
      setRemoteStatus('Convite carregado')
      setRemoteError('')
      return true
    } catch (error) {
      window.localStorage.removeItem(STUDENT_ACCESS_KEY)
      if (options.silent) return false
      handleRemoteError(error, 'Erro no convite')
      return false
    }
  }

  async function acceptStudentConsent() {
    if (!studentAccess?.invite?.code) return

    try {
      const access = await acceptRemoteStudentConsent(studentAccess.invite.code)
      setStudentAccess(access)
      window.localStorage.setItem(STUDENT_ACCESS_KEY, access.invite?.code || studentAccess.invite.code)
      setRemoteStatus('Consentimento registrado')
      setRemoteError('')
    } catch (error) {
      handleRemoteError(error, 'Erro ao registrar consentimento')
    }
  }

  async function submitStudentAnamnesis(answers) {
    if (!studentAccess?.invite?.code) return

    try {
      const access = await submitRemoteStudentAnamnesis(studentAccess.invite.code, answers)
      setStudentAccess(access)
      window.localStorage.setItem(STUDENT_ACCESS_KEY, access.invite?.code || studentAccess.invite.code)
      setRemoteStatus('Anamnese enviada ao coach')
      setRemoteError('')
    } catch (error) {
      handleRemoteError(error, 'Erro ao enviar anamnese')
      throw error
    }
  }

  function exitStudentAccess() {
    setStudentAccess(null)
    window.localStorage.removeItem(STUDENT_ACCESS_KEY)
  }

  async function finishPasswordRecovery(password) {
    await updateRecoveredPassword(recoveryAccessToken, password)
    setRecoveryAccessToken('')
    const url = new URL(window.location.href)
    const recoveryParams = ['type', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type']
    recoveryParams.forEach((key) => url.searchParams.delete(key))
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    setRemoteStatus('Senha atualizada')
    setRemoteError('Entre com seu e-mail e a nova senha.')
  }

  if (recoveryAccessToken) {
    return <PasswordRecovery onSave={finishPasswordRecovery} />
  }

  if (adminRoute) {
    if (!data.user || (supabaseEnabled && !data.session?.access_token)) {
      return (
        <AdminLoginScreen
          onLogin={login}
          remoteStatus={remoteStatus}
          remoteError={remoteError}
        />
      )
    }

    if (supabaseEnabled && remoteStatus === 'Conectando Supabase') {
      return <AppLoading />
    }

    if (!masterAdmin) {
      return <AdminUnauthorized user={data.user} onLogout={logout} remoteError={remoteError} />
    }

    return (
      <AdminRouteShell
        user={data.user}
        settings={appAdminSettings}
        onSave={saveAppAdminSettings}
        onLogout={logout}
        remoteStatus={remoteStatus}
        remoteError={remoteError}
      />
    )
  }

  if (salesPreview) {
    return (
      <LoginScreen
        onLogin={login}
        onStudentAccess={enterStudentByInvite}
        remoteStatus={remoteStatus}
        remoteError={remoteError}
        appAdminSettings={appAdminSettings}
      />
    )
  }

  if (studentAccess) {
    if (!studentAccess.consentAccepted) {
      return (
        <StudentConsent
          access={studentAccess}
          onAccept={acceptStudentConsent}
          onExit={exitStudentAccess}
          error={remoteError}
        />
      )
    }

    if (studentAccess.anamnesisRequired !== false && !studentAccess.anamnesisCompleted) {
      return (
        <StudentAnamnesis
          access={studentAccess}
          onSubmit={submitStudentAnamnesis}
          onExit={exitStudentAccess}
          error={remoteError}
        />
      )
    }

    return (
      <StudentAccessApp
        access={studentAccess}
        checkins={data.checkins}
        workouts={studentAccess.workouts ?? []}
        nutritionPlans={studentAccess.nutritionPlans ?? []}
        workoutLogs={mergeRecords(data.workoutLogs, studentAccess.workoutLogs)}
        messages={mergeRecords(data.messages, studentAccess.messages)}
        appointments={studentAccess.appointments ?? []}
        invoices={studentAccess.invoices ?? []}
        assessments={studentAccess.assessments ?? []}
        coachSettings={studentAccess.coachSettings}
        onCompleteWorkout={completeWorkout}
        onAddCheckin={addCheckin}
        onSendMessage={sendMessage}
        onRefreshMessages={refreshStudentConversation}
        onExit={exitStudentAccess}
      />
    )
  }

  if (!data.user || (supabaseEnabled && !data.session?.access_token)) {
    return (
      <LoginScreen
        onLogin={login}
        onStudentAccess={enterStudentByInvite}
        remoteStatus={remoteStatus}
        remoteError={remoteError}
        appAdminSettings={appAdminSettings}
      />
    )
  }

  if (supabaseEnabled && remoteStatus === 'Conectando Supabase') {
    return <AppLoading />
  }

  const activeNavItem = visibleNavItems.find((item) => item.id === activeView) ?? visibleNavItems[0]
  const activeNavTone = getNavToneClasses(activeNavItem?.tone)
  const viewTitle = activeNavItem?.label ?? 'Visão geral'

  return (
    <div className="app-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-3 py-2 backdrop-blur-xl lg:hidden">
        <BrandLockup compact subtitle="Coach Fit Pro" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu"
          className="grid h-11 w-11 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-[0px] text-white"
        >
          <NavIcon name="menu" className="h-5 w-5" />
          â˜°
        </button>
      </div>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[286px] max-w-[86vw] min-w-0 flex-col overflow-hidden border-r border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform duration-200 lg:w-[320px] lg:max-w-none lg:translate-x-0 lg:p-4 xl:w-[340px] ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
          <div className="flex items-center justify-between gap-3 lg:block">
            <BrandLockup
              subtitle={`por ${data.coachSettings?.brandName || data.coachSettings?.publicName || data.user.name}`}
            />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
              className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-[0px] text-zinc-300 lg:hidden"
            >
              <NavIcon name="close" className="h-5 w-5" />
              ×
            </button>
          </div>

          <div className="mb-2 mt-3 flex items-center justify-between px-1">
            <p className="text-[11px] font-black uppercase text-zinc-500">Navegação</p>
          </div>
          <nav className="grid min-h-0 min-w-0 flex-1 content-start gap-2 overflow-hidden">
            {visibleNavItems.map((item) => {
              const tone = getNavToneClasses(item.tone)
              const isActive = activeView === item.id
              const isLocked = shouldLockCoachTools && item.id !== 'assinatura' && item.id !== 'admin-master'

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return
                    setActiveView(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`group flex min-h-[43px] min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition active:scale-[0.99] ${
                    isActive
                      ? `${tone.active} shadow-lg shadow-black/20`
                      : isLocked
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.015] text-zinc-600'
                        : `${tone.idle} hover:-translate-y-0.5 hover:bg-white/[0.065]`
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${
                    isActive ? tone.iconActive : isLocked ? 'border-white/5 bg-zinc-900 text-zinc-700' : tone.iconIdle
                  }`}>
                    <NavIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">{item.label}</span>
                  {isLocked ? (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-black uppercase text-zinc-500">Bloq.</span>
                  ) : null}
                  {item.id === 'notificacoes' && totalAlertCount > 0 ? (
                    <span className="rounded bg-amber-300 px-2 py-0.5 text-xs text-zinc-950">{totalAlertCount}</span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <button type="button" onClick={logout} className="mt-3 w-full rounded-md border border-white/10 px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.04] lg:mt-2 lg:py-2">
            Sair
          </button>
      </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:ml-[320px] lg:w-[calc(100%-320px)] lg:px-5 xl:ml-[340px] xl:w-[calc(100%-340px)] xl:px-7">
          <div className="mx-auto min-w-0 max-w-[1440px]">
          <header className="mb-5 rounded-md border border-white/10 bg-zinc-950/72 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5 xl:mb-6 xl:flex xl:items-end xl:justify-between xl:gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${activeNavTone.iconActive}`}>
                  <NavIcon name={activeNavItem?.icon} className="h-5 w-5" />
                </span>
                <p className="text-xs font-black uppercase text-zinc-400">Coach Fit Pro / Central do coach</p>
              </div>
              <h2 className="mt-1 text-3xl font-black sm:text-4xl">{viewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Gerencie alunos, prescrições, evolução, agenda, comunicação e financeiro em um único lugar.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 xl:mt-0">
              {masterAdmin ? (
                <button
                  type="button"
                  onClick={() => setActiveView('admin-master')}
                  className="rounded-md border border-blue-300/30 bg-blue-400/10 px-4 py-2 text-left text-sm font-bold text-blue-100"
                >
                  <span className="block text-[10px] font-black uppercase text-blue-300">Admin</span>
                  <span className="mt-0.5 block">Admin Master</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setActiveView('assinatura')}
                className="rounded-md border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-left text-sm font-bold text-emerald-100"
              >
                <span className="block text-[10px] font-black uppercase text-emerald-300">Próxima cobrança</span>
                <span className="mt-0.5 block">{coachBillingCycle.daysRemaining} {coachBillingCycle.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}</span>
              </button>
            </div>
          </header>

          {shouldLockCoachTools ? (
            <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50">
              <p className="text-xs font-black uppercase text-amber-200">Assinatura pendente</p>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                Conclua o pagamento usando o mesmo e-mail da conta. Ao voltar do checkout, o Coach Fit Pro verifica automaticamente a confirmação e libera o painel assim que o pagamento for aprovado.
              </p>
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Alunos ativos" value={data.students.length} detail={`${paidStudents} com plano pago`} />
            <Metric label="Constância média" value={`${averageAdherence}%`} detail="treino + dieta" />
            <Metric label="Agenda" value={upcomingAppointments.length} detail={`${openCheckins} check-ins abertos`} />
            <Metric label="Notificações" value={totalAlertCount} detail={`${smartAlerts.length} alertas ativos`} />
          </section>

          <div className="mt-5 xl:mt-6">
            {activeView === 'visao' && (
              <Overview
                selectedStudent={selectedStudent}
                smartAlerts={smartAlerts}
                assessments={data.assessments ?? []}
                invoices={data.invoices ?? []}
                setActiveView={setActiveView}
              />
            )}
            {activeView === 'agenda' && (
              <Agenda
                students={data.students}
                appointments={data.appointments ?? []}
                onSaveAppointment={saveAppointment}
                onUpdateStatus={updateAppointmentStatus}
              />
            )}
            {activeView === 'alunos' && (
              <Students
                students={data.students}
                invites={data.invites ?? []}
                anamneses={data.anamneses ?? []}
                selectedStudent={selectedStudent}
                setSelectedStudentId={setSelectedStudentId}
                onSave={saveStudent}
                onGenerateInvite={generateStudentInvite}
                onDelete={deleteStudent}
                coachPlans={coachPlans}
              />
            )}
            {activeView === 'avaliacoes' && (
              <Assessments
                students={data.students}
                selectedStudent={selectedStudent}
                assessments={data.assessments ?? []}
                onSaveAssessment={saveAssessment}
              />
            )}
            {activeView === 'treinos' && (
              <Workouts
                selectedStudent={selectedStudent}
                students={data.students}
                workouts={data.workouts ?? []}
                workoutLogs={data.workoutLogs ?? []}
                onSaveWorkout={saveWorkout}
                onArchiveWorkout={archiveWorkout}
                onSaveStudent={saveStudent}
              />
            )}
            {activeView === 'nutricao' && (
              <Nutrition
                selectedStudent={selectedStudent}
                students={data.students}
                nutritionPlans={data.nutritionPlans ?? []}
                onSaveNutritionPlan={saveNutritionPlan}
                onArchiveNutritionPlan={archiveNutritionPlan}
              />
            )}
            {activeView === 'checkins' && (
              <Checkins checkins={data.checkins} students={data.students} onAddCheckin={addCheckin} />
            )}
            {activeView === 'pagamentos' && (
              <Payments
                students={data.students}
                invoices={data.invoices ?? []}
                coachSettings={data.coachSettings}
                coachPlans={coachPlans}
                onSaveInvoice={saveInvoice}
                onUpdateInvoiceStatus={updateInvoiceStatus}
                onUpdatePayment={updatePayment}
              />
            )}
            {activeView === 'assinatura' && (
              <CoachSubscription
                students={data.students}
                invoices={data.invoices ?? []}
                subscription={data.coachSubscription}
                userCreatedAt={data.user?.createdAt}
                coachPlans={coachPlans}
                appAdminSettings={appAdminSettings}
                onRefreshSubscription={syncCoachWorkspace}
              />
            )}
            {activeView === 'admin-master' && masterAdmin && (
              <AdminMaster
                settings={appAdminSettings}
                onSave={saveAppAdminSettings}
                remoteStatus={remoteStatus}
                remoteError={remoteError}
              />
            )}
            {activeView === 'notificacoes' && (
              <SmartNotifications
                notifications={data.notifications}
                smartAlerts={smartAlerts}
                onReadAll={markNotificationsRead}
                onOpenView={setActiveView}
              />
            )}
            {activeView === 'mensagens' && (
              <Messages
                students={data.students}
                messages={data.messages ?? []}
                onSendMessage={sendMessage}
                onMarkRead={markStudentMessagesRead}
                onRefreshMessages={refreshCoachConversation}
              />
            )}
            {activeView === 'aluno-app' && (
              <StudentPortalPreview
                student={selectedStudent}
                students={data.students}
                checkins={data.checkins}
                workouts={data.workouts ?? []}
                nutritionPlans={data.nutritionPlans ?? []}
                workoutLogs={data.workoutLogs ?? []}
                messages={data.messages ?? []}
                appointments={data.appointments ?? []}
                invoices={data.invoices ?? []}
                assessments={data.assessments ?? []}
                coachSettings={data.coachSettings}
                onCompleteWorkout={completeWorkout}
                onAddCheckin={addCheckin}
                onSendMessage={sendMessage}
                coachId={data.user?.id}
                onRemoteStatus={setRemoteStatus}
                onRemoteError={setRemoteError}
              />
            )}
            {activeView === 'configuracoes' && (
              <CoachSettings
                user={data.user}
                settings={data.coachSettings}
                onSave={saveCoachSettings}
                onExport={exportAccountData}
              />
            )}
          </div>
          </div>
        </main>
    </div>
  )
}

function AppLoading() {
  return (
    <main className="app-shell fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
      <section className="w-full max-w-sm rounded-md border border-white/10 bg-zinc-950/85 p-6 text-center shadow-2xl shadow-black/30">
        <div className="flex justify-center">
          <BrandLockup large subtitle="Coach Fit Pro" />
        </div>
        <div className="mx-auto mt-6 h-1.5 w-32 overflow-hidden rounded bg-white/10">
          <span className="block h-full w-1/2 animate-pulse rounded bg-emerald-400" />
        </div>
        <p className="mt-4 text-sm font-bold text-emerald-100">Carregando sua operação...</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">Sincronizando alunos, prescrições e agenda.</p>
      </section>
    </main>
  )
}

function getRecoveryAccessToken() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') || query.get('type')
  if (type !== 'recovery') return ''
  return hash.get('access_token') || query.get('access_token') || ''
}

function PasswordRecovery({ onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = form.get('password')?.toString() || ''
    const confirmation = form.get('confirmation')?.toString() || ''

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas informadas não são iguais.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(password)
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app-shell fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-md border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/40 sm:p-7">
        <div className="flex justify-center">
          <BrandLockup subtitle="Coach Fit Pro" />
        </div>
        <p className="mt-6 text-xs font-black uppercase text-emerald-300">Recuperação de acesso</p>
        <h1 className="mt-2 text-2xl font-black">Cadastre sua nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Use pelo menos 6 caracteres e evite senhas utilizadas em outros serviços.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Nova senha" name="password" type="password" defaultValue="" />
          <Field label="Confirmar nova senha" name="confirmation" type="password" defaultValue="" />
        </div>
        {error ? <p className="mt-4 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
        <button disabled={saving} className="mt-5 w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
          {saving ? 'Atualizando...' : 'Salvar nova senha'}
        </button>
      </form>
    </main>
  )
}

function AdminLoginScreen({ onLogin, remoteStatus, remoteError }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      await onLogin(new FormData(event.currentTarget))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fit-gradient-bg min-h-screen text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
        <div className="rounded-3xl border border-emerald-300/20 bg-zinc-950/92 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <BrandLockup subtitle="Admin Master" />
          <p className="mt-6 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">
            Acesso administrativo separado
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Entrar no Admin Master</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Essa área é exclusiva para editar página de vendas, planos, links, módulos, usuários e assinaturas. O acesso permitido é somente para {MASTER_ADMIN_EMAIL}.
          </p>

          {remoteError ? (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase text-amber-200">Atenção</p>
              <p className="mt-2 break-words text-sm leading-6 text-amber-50">{remoteError}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="mode" value="admin" />
            <Field label="E-mail admin" name="email" type="email" defaultValue={MASTER_ADMIN_EMAIL} />
            <Field label="Senha" name="password" type="password" defaultValue="" />
            <button disabled={loading} className="w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Validando...' : 'Entrar no Admin Master'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
            <a href="/" className="rounded-xl border border-white/10 px-3 py-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white">Voltar para o site</a>
            <span className="rounded-xl border border-white/10 px-3 py-2">Rota: /admin</span>
          </div>
          {remoteStatus ? <p className="mt-4 text-xs font-bold text-zinc-500">Status: {remoteStatus}</p> : null}
        </div>
      </div>
    </div>
  )
}

function AdminUnauthorized({ user, onLogout, remoteError }) {
  return (
    <div className="fit-gradient-bg min-h-screen text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
        <div className="rounded-3xl border border-rose-300/20 bg-zinc-950/92 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <BrandLockup subtitle="Admin Master" />
          <p className="mt-6 inline-flex rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1 text-xs font-black uppercase text-rose-200">
            Acesso negado
          </p>
          <h1 className="mt-4 text-3xl font-black text-white">Este usuário não é admin.</h1>
          <p className="mt-3 break-words text-sm leading-6 text-zinc-400">
            Login atual: {user?.email || 'e-mail não identificado'}. O Admin Master aceita somente {MASTER_ADMIN_EMAIL}.
          </p>
          {remoteError ? <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">{remoteError}</p> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onLogout} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950">Sair e entrar com admin</button>
            <a href="/" className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-black text-zinc-100">Voltar para o site</a>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminRouteShell({ user, settings, onSave, onLogout, remoteStatus, remoteError }) {
  return (
    <div className="app-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/92 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLockup compact subtitle="Admin Master" />
            <p className="mt-2 text-xs font-bold text-zinc-500">Logado como {user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/" className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-100 transition hover:bg-white/[0.06]">Ver site</a>
            <a href="/?preview=vendas" className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-100 transition hover:bg-white/[0.06]">Prévia vendas</a>
            <button type="button" onClick={onLogout} className="rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-zinc-950">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-3 py-5 sm:px-6 lg:px-8">
        <AdminMaster
          settings={settings}
          onSave={onSave}
          remoteStatus={remoteStatus}
          remoteError={remoteError}
        />
      </main>
    </div>
  )
}

function LoginScreen({ onLogin, onStudentAccess, remoteStatus, remoteError, appAdminSettings = defaultAppAdminSettings }) {
  const [mode, setMode] = useState('signin')
  const [loading, setLoading] = useState(false)
  const [selectedOfferPlanId, setSelectedOfferPlanId] = useState('semestral')
  const [revenueScenario, setRevenueScenario] = useState({
    students: 20,
    monthlyPrice: 250,
    additionalStudents: 6,
    priceIncrease: 30,
  })
  const salesSettings = normalizeAdminSettings(appAdminSettings)
  const salesContent = salesSettings.salesContent
  const salesPlans = salesSettings.checkoutPlans
  const selectedOfferPlan = salesPlans.find((plan) => plan.id === selectedOfferPlanId) || salesPlans.find((plan) => plan.id === salesSettings.defaultCheckoutPlanId) || salesPlans[1] || salesPlans[0]
  const currentRevenue = revenueScenario.students * revenueScenario.monthlyPrice
  const projectedStudents = revenueScenario.students + revenueScenario.additionalStudents
  const projectedPrice = revenueScenario.monthlyPrice + revenueScenario.priceIncrease
  const projectedRevenue = projectedStudents * projectedPrice
  const projectedIncrease = projectedRevenue - currentRevenue
  const projectedPercent = currentRevenue ? Math.round((projectedIncrease / currentRevenue) * 100) : 0

  useEffect(() => {
    const page = document.getElementById('sales-page')
    if (!page) return undefined

    page.classList.add('sales-motion-ready')
    const revealItems = [...page.querySelectorAll('[data-reveal]')]
    const interactiveItems = [...page.querySelectorAll('.sales-feature-card, .sales-interactive, .sales-faq')]
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' })

    revealItems.forEach((item) => observer.observe(item))

    function moveSurface(event) {
      if (window.matchMedia('(pointer: coarse)').matches) return
      const surface = event.currentTarget
      const rect = surface.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      surface.style.setProperty('--pointer-x', `${x * 100}%`)
      surface.style.setProperty('--pointer-y', `${y * 100}%`)
      surface.style.setProperty('--tilt-x', `${(0.5 - y) * 3}deg`)
      surface.style.setProperty('--tilt-y', `${(x - 0.5) * 3}deg`)
    }

    function resetSurface(event) {
      const surface = event.currentTarget
      surface.style.setProperty('--tilt-x', '0deg')
      surface.style.setProperty('--tilt-y', '0deg')
      surface.classList.remove('is-pressed')
    }

    function pressSurface(event) {
      const surface = event.currentTarget
      surface.classList.add('is-pressed')
      window.setTimeout(() => surface.classList.remove('is-pressed'), 220)
    }

    interactiveItems.forEach((item) => {
      item.classList.add('interactive-surface')
      item.addEventListener('pointermove', moveSurface)
      item.addEventListener('pointerleave', resetSurface)
      item.addEventListener('pointerdown', pressSurface)
      item.addEventListener('pointerup', resetSurface)
    })

    let frame = 0
    function updateScrollEffects() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
        const progress = Math.min(window.scrollY / scrollable, 1)
        page.style.setProperty('--sales-progress', progress)
        page.style.setProperty('--sales-scroll', `${Math.min(window.scrollY, 900)}px`)
      })
    }

    updateScrollEffects()
    window.addEventListener('scroll', updateScrollEffects, { passive: true })
    window.addEventListener('resize', updateScrollEffects)

    return () => {
      observer.disconnect()
      interactiveItems.forEach((item) => {
        item.removeEventListener('pointermove', moveSurface)
        item.removeEventListener('pointerleave', resetSurface)
        item.removeEventListener('pointerdown', pressSurface)
        item.removeEventListener('pointerup', resetSurface)
      })
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateScrollEffects)
      window.removeEventListener('resize', updateScrollEffects)
    }
  }, [])

  function openAccess(nextMode) {
    setMode(nextMode)
    window.setTimeout(() => document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  function startFirstMonthOffer() {
    openAccess(salesSettings.signupEnabled ? 'signup' : 'signin')
  }

  function startPlanSignup(planId) {
    try {
      window.localStorage.setItem(SELECTED_CHECKOUT_PLAN_KEY, planId)
    } catch {
      // Mantem o fluxo normal mesmo se o navegador bloquear armazenamento local.
    }
    openAccess(salesSettings.signupEnabled ? 'signup' : 'signin')
  }

  function leaveSalesPreview() {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('preview')) return
    url.searchParams.delete('preview')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signup' && !salesSettings.signupEnabled) {
        throw new Error('A criação de conta está temporariamente desativada. Use Entrar ou fale com o suporte.')
      }
      const formData = new FormData(event.currentTarget)
      const success = mode === 'student'
        ? await onStudentAccess(formData.get('inviteCode')?.toString() || '')
        : await onLogin(formData)
      if (success) leaveSalesPreview()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="sales-page" className="sales-page fit-gradient-bg min-h-screen text-zinc-100">
      <div className="sales-progress" aria-hidden="true" />
      <header className="sales-header sticky top-0 z-40 border-b border-white/10 bg-[#020816]/94 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:py-4">
          <BrandLockup compact subtitle="Coach Fit Pro" />
          <nav className="hidden items-center gap-1 text-sm font-black text-zinc-300 lg:flex">
            {salesContent.navItems.map(({ label, target }) => (
              <button
                key={target}
                type="button"
                onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="rounded-xl px-4 py-3 transition hover:bg-white/[0.08] hover:text-white"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openAccess('signin')} className="hidden rounded-xl px-4 py-3 text-sm font-black text-zinc-200 transition hover:bg-white/[0.07] hover:text-white sm:inline-flex">
              {salesContent.loginButton}
            </button>
            <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-xl bg-blue-500 px-4 py-3 text-xs font-black text-zinc-950 shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 sm:px-6 sm:text-sm">
              {salesContent.plansButton}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-68px)] lg:grid-cols-[minmax(0,1.04fr)_minmax(390px,0.78fr)] lg:px-10 lg:py-14">
          <div className="min-w-0" data-reveal>
            <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase text-blue-200">{salesContent.heroBadge}</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.7rem]">
              {salesSettings.salesHeadline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              {salesSettings.salesSubheadline}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="w-full rounded-md bg-blue-500 px-5 py-3 text-sm font-black text-zinc-950 sm:w-auto">
                {salesSettings.salesCta}
              </button>
              <button type="button" onClick={() => document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' })} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black text-zinc-100 sm:w-auto">
                {salesContent.secondaryCta}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">{salesSettings.announcement}</p>
            {salesSettings.maintenanceNotice ? <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs font-bold leading-5 text-amber-100">{salesSettings.maintenanceNotice}</p> : null}
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/15 pt-5">
              {salesContent.heroStats.map((item) => <SalesStat key={`${item.value}-${item.label}`} value={item.value} label={item.label} />)}
            </div>
            <div className="sales-hero-proof mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              {salesContent.heroProofs.map(({ title, text }, index) => (
                <div key={title} className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                  <span className="text-xs font-black text-emerald-200">0{index + 1}</span>
                  <p className="mt-2 text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form id="acesso" data-reveal onSubmit={handleSubmit} className="sales-interactive w-full rounded-md border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7 lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase text-blue-300">Acesso seguro</p>
            <h2 className="mt-2 text-3xl font-black">{mode === 'signup' ? 'Começar agora' : mode === 'student' ? 'Área do aluno' : mode === 'forgot' ? 'Recuperar senha' : 'Entrar no painel'}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {mode === 'forgot'
                ? 'Enviaremos um link seguro para o e-mail cadastrado.'
                : 'Coach acessa com e-mail e senha. Aluno utiliza o código enviado pelo treinador.'}
            </p>
            {remoteError ? (
              <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-3">
                <p className="text-xs font-black uppercase text-amber-200">Atenção</p>
                <p className="mt-2 break-words text-sm leading-6 text-amber-50">{remoteError}</p>
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['signin', 'Coach'],
                ...(salesSettings.signupEnabled ? [['signup', 'Criar conta']] : []),
                ['student', 'Aluno'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-md border px-2 py-2 text-xs font-black sm:px-3 sm:text-sm ${mode === id ? 'border-blue-500 bg-blue-500 text-zinc-950' : 'border-white/10 text-zinc-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              <input type="hidden" name="mode" value={mode} />
              {mode === 'student' ? (
                <Field label="Código de acesso" name="inviteCode" defaultValue="" />
              ) : mode === 'forgot' ? (
                <Field label="E-mail cadastrado" name="email" type="email" defaultValue="" />
              ) : (
                <>
                  {mode === 'signup' ? <Field label="Nome profissional" name="name" defaultValue="" /> : null}
                  <Field label="E-mail" name="email" type="email" defaultValue="" />
                  <Field label="Senha" name="password" type="password" defaultValue="" />
                </>
              )}
            </div>
            <button disabled={loading} className="mt-6 w-full rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Processando...' : mode === 'student' ? 'Acessar meu acompanhamento' : mode === 'signup' ? 'Criar conta profissional' : mode === 'forgot' ? 'Enviar link de recuperação' : 'Entrar'}
            </button>
            {mode === 'signin' ? (
              <button type="button" onClick={() => setMode('forgot')} className="mt-3 w-full px-3 py-2 text-xs font-bold text-emerald-200">
                Esqueci minha senha
              </button>
            ) : null}
            {mode === 'forgot' ? (
              <button type="button" onClick={() => setMode('signin')} className="mt-3 w-full px-3 py-2 text-xs font-bold text-zinc-400">
                Voltar para o login
              </button>
            ) : null}
            {mode === 'signup' ? (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Se a confirmação por e-mail estiver ativa, confirme sua conta antes do primeiro acesso.
              </p>
            ) : null}
          </form>
        </section>

        <section className="border-y border-white/10 bg-zinc-950/80">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:grid-cols-3 sm:px-6">
            {salesContent.valueBullets.map(({ title, text }) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-black text-emerald-100">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.appVisual.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.appVisual.title}</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                {salesContent.appVisual.description}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {salesContent.appVisual.cards.map(({ title, text }) => (
                  <div key={title} className="sales-mini-card rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm font-black text-emerald-100">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal className="sales-phone-stage grid gap-2 sm:grid-cols-3">
              {salesContent.appVisual.phoneScreens.map(({ kicker, title, subtitle, action, rows, floatingIcon, floatingTitle, floatingText }, index) => (
                <div key={title} className={`sales-phone-mockup ${index === 1 ? 'sm:mt-8' : ''}`}>
                  <div className={`sales-floating-badge ${index === 0 ? 'left' : index === 1 ? 'top' : 'right'}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-blue-300/25 bg-blue-500/10 text-blue-200">
                      <NavIcon name={floatingIcon} className="h-4 w-4" />
                    </span>
                    <span>
                      <strong>{floatingTitle}</strong>
                      <small>{floatingText}</small>
                    </span>
                  </div>
                  <div className="sales-phone-screen">
                    <div className="sales-phone-notch" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-200">{kicker}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-blue-100">09:30</span>
                    </div>
                    <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                    <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
                    <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-blue-500/25 to-emerald-300/10 p-3">
                      <p className="text-xs font-black text-emerald-100">{action}</p>
                      <div className="mt-3 h-2 rounded-full bg-zinc-800">
                        <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${62 + index * 11}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {rows.map((row) => (
                        <div key={row} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
                          <span className="text-[10px] font-bold text-zinc-200">{row}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        </div>
                      ))}
                    </div>
                    <div className="sales-phone-bottom-nav">
                      {salesContent.appVisual.phoneNav.map(({ icon, label }) => (
                        <span key={label} className="grid justify-items-center gap-1 text-[9px] font-bold text-zinc-400">
                          <NavIcon name={icon} className="h-3.5 w-3.5 text-emerald-200" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="sales-section sales-section-blue border-y border-white/10 bg-[#05070d]/75 py-10 backdrop-blur-xl sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl" data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.features.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.features.title}</h2>
              <p className="mt-4 leading-7 text-zinc-400">{salesContent.features.description}</p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {salesContent.features.items.map(({ number, title, description }, index) => (
                <div key={number} data-reveal style={{ '--reveal-delay': `${index * 70}ms` }} className="sales-feature-card min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-5">
                  <span className="text-xs font-black text-blue-300">{number}</span>
                  <h3 className="mt-3 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="mecanismo" className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div data-reveal className="lg:sticky lg:top-28">
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.mechanism.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.mechanism.title}</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                {salesContent.mechanism.description}
              </p>
            </div>
            <div className="grid gap-3">
              {salesContent.mechanism.items.map(({ title, problem, solution }, index) => (
                <div key={title} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="sales-feature-card grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{problem}</p>
                  </div>
                  <span className="w-fit rounded border border-blue-300/30 bg-blue-300/10 px-3 py-2 text-xs font-black text-blue-100">{solution}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-section sales-section-blue border-y border-white/10 bg-[#05070d]/80 py-10 sm:py-14">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.commandCenter.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.commandCenter.title}</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                {salesContent.commandCenter.description}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {salesContent.commandCenter.cards.map(({ title, text }) => (
                  <div key={title} className="sales-mini-card rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm font-black text-emerald-100">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal className="rounded-2xl border border-emerald-300/20 bg-zinc-950/88 p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-200">{salesContent.commandCenter.dashboardEyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black">{salesContent.commandCenter.dashboardTitle}</h3>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">{salesContent.commandCenter.dashboardBadge}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {salesContent.commandCenter.metrics.map(({ label, value, detail }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-200">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex h-32 items-end gap-2">
                    {[34, 52, 46, 68, 59, 74, 88, 82, 96].map((height, index) => (
                      <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-emerald-700 to-emerald-300" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] font-bold uppercase text-zinc-600">
                    <span>Semana 1</span>
                    <span>Semana 4</span>
                  </div>
                </div>
                <div className="grid gap-3">
                  {salesContent.commandCenter.automationItems.map(({ title, text }) => (
                    <div key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-sm font-black text-white">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{salesContent.commandCenter.dashboardFootnote}</p>
            </div>
          </div>
        </section>

        <section className="sales-section sales-section-red border-y border-white/10 bg-zinc-950/75 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl" data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.comparison.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.comparison.title}</h2>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {salesContent.comparison.items.map(({ item, before, after }) => (
                <div key={item} data-reveal className="sales-feature-card min-w-0 rounded-md border border-white/10 bg-[#05070d]/85 p-4">
                  <p className="text-xs font-black uppercase text-cyan-300">{item}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-500"><strong className="text-zinc-400">{salesContent.comparison.beforeLabel}</strong> {before}</p>
                  <div className="my-3 h-px bg-white/10" />
                  <p className="text-sm font-bold leading-6 text-zinc-200"><strong className="text-emerald-200">{salesContent.comparison.afterLabel}</strong> {after}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="app-aluno" className="sales-section sales-section-red mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">{salesContent.studentApp.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.studentApp.title}</h2>
              <p className="mt-4 leading-7 text-zinc-300">{salesContent.studentApp.description}</p>
              <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-6 w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 sm:w-auto">
                {salesContent.studentApp.cta}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {salesContent.studentApp.items.map(({ title, text }, index) => (
                <div key={title} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="sales-feature-card rounded-md border border-white/10 bg-zinc-950/70 p-5">
                  <h3 className="font-black text-emerald-200">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="simulador" className="sales-section sales-section-blue mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">{salesContent.results.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.results.title}</h2>
              <p className="mt-4 leading-7 text-zinc-300">
                {salesContent.results.description}
              </p>
              <div className="mt-6 grid gap-3">
                {salesContent.results.items.map(({ title, text }, index) => (
                  <div key={title} data-reveal style={{ '--reveal-delay': `${index * 70}ms` }} className="flex gap-3 rounded-md border border-white/10 bg-white/[0.035] p-4">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded ${index % 2 ? 'bg-emerald-700' : 'bg-emerald-400'}`} />
                    <div>
                      <h3 className="font-black">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal className="sales-interactive rounded-md border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-200">{salesContent.results.simulatorEyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black">{salesContent.results.simulatorTitle}</h3>
                </div>
                <span className="text-xs text-zinc-500">{salesContent.results.simulatorDisclaimer}</span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <RevenueControl
                  label="Alunos atuais"
                  value={revenueScenario.students}
                  min={1}
                  max={150}
                  suffix=""
                  onChange={(value) => setRevenueScenario((current) => ({ ...current, students: value }))}
                />
                <RevenueControl
                  label="Mensalidade atual"
                  value={revenueScenario.monthlyPrice}
                  min={50}
                  max={1500}
                  step={10}
                  prefix="R$ "
                  onChange={(value) => setRevenueScenario((current) => ({ ...current, monthlyPrice: value }))}
                />
                <RevenueControl
                  label="Novos alunos possíveis"
                  value={revenueScenario.additionalStudents}
                  min={0}
                  max={50}
                  suffix=""
                  onChange={(value) => setRevenueScenario((current) => ({ ...current, additionalStudents: value }))}
                />
                <RevenueControl
                  label="Valorização por aluno"
                  value={revenueScenario.priceIncrease}
                  min={0}
                  max={500}
                  step={10}
                  prefix="R$ "
                  onChange={(value) => setRevenueScenario((current) => ({ ...current, priceIncrease: value }))}
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <RevenueResult label="Faturamento atual" value={formatCurrency(currentRevenue)} />
                <RevenueResult label="Cenário projetado" value={formatCurrency(projectedRevenue)} highlight />
                <RevenueResult label="Potencial adicional" value={`+${formatCurrency(projectedIncrease)}`} accent />
              </div>

              <div className="mt-4 rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
                <p className="text-sm font-black text-blue-100">
                  Neste cenário: {projectedStudents} alunos a {formatCurrency(projectedPrice)} por mês.
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Isso representa um potencial de {projectedPercent}% sobre o faturamento atual. O resultado real depende da sua oferta, mercado, aquisição, retenção e execução.
                </p>
              </div>

              <button type="button" onClick={() => openAccess('signup')} className="mt-5 w-full rounded-md bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-800 px-5 py-3 text-sm font-black text-white">
                Estruturar minha operação para crescer
              </button>
            </div>
          </div>
        </section>

        <section className="sales-section border-y border-white/10 bg-zinc-950/70 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl" data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">{salesContent.objections.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.objections.title}</h2>
              <p className="mt-4 leading-7 text-zinc-400">{salesContent.objections.description}</p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div data-reveal className="rounded-md border border-emerald-300/25 bg-emerald-400/[0.07] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-emerald-300">{salesContent.objections.positiveTitle}</p>
                <div className="mt-4 grid gap-3">
                  {salesContent.objections.positiveItems.map((item) => <ObjectionPoint key={item} text={item} positive />)}
                </div>
              </div>
              <div data-reveal className="rounded-md border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-zinc-400">{salesContent.objections.negativeTitle}</p>
                <div className="mt-4 grid gap-3">
                  {salesContent.objections.negativeItems.map((item) => <ObjectionPoint key={item} text={item} />)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="duvidas" className="sales-section mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="text-center" data-reveal>
            <p className="text-sm font-semibold uppercase text-emerald-200">{salesContent.faq.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{salesContent.faq.title}</h2>
          </div>
          <div className="mt-9 grid gap-3">
            {salesContent.faq.items.map(({ question, answer }, index) => (
              <details key={question} data-reveal style={{ '--reveal-delay': `${index * 50}ms` }} className="sales-faq rounded-md border border-white/10 bg-zinc-950/75">
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 font-black sm:p-5">
                  <span>{question}</span>
                  <span className="sales-faq-icon text-xl text-blue-300">+</span>
                </summary>
                <p className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-zinc-400 sm:px-5">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="precos" className="sales-section sales-section-final border-t border-white/10 bg-[#04070d] py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6" data-reveal>
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-black uppercase text-emerald-300">{salesContent.pricing.eyebrow}</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                {salesContent.pricing.title}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                {salesContent.pricing.description}
              </p>

              <div className="mx-auto mt-7 grid max-w-3xl gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-2xl shadow-black/30 sm:grid-cols-3">
                {salesPlans.map((plan) => {
                  const selected = selectedOfferPlan.id === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedOfferPlanId(plan.id)}
                      className={`min-h-20 rounded-xl px-3 py-3 text-left transition ${
                        selected
                          ? 'bg-blue-500 text-zinc-950 shadow-lg shadow-blue-950/30'
                          : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="block text-sm font-black">{plan.name}</span>
                      <span className={`mt-1 block text-[11px] font-bold uppercase ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>{plan.cycle}</span>
                      <span className="mt-2 block text-xs font-black">{plan.price}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.7fr)] lg:items-stretch">
              <div className="sales-interactive relative overflow-hidden rounded-2xl border border-blue-400/35 bg-gradient-to-br from-blue-500/18 via-zinc-950 to-zinc-950 p-5 shadow-2xl shadow-blue-950/30 sm:p-8">
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
                <div className="relative">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-blue-300">{selectedOfferPlan.cycle}</p>
                      <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">{selectedOfferPlan.name}</h3>
                    </div>
                    <span className="w-fit rounded-full bg-blue-500 px-4 py-2 text-xs font-black uppercase text-white shadow-lg shadow-blue-950/30">
                      {selectedOfferPlan.badge}
                    </span>
                  </div>

                  <div className="mt-7">
                    {selectedOfferPlan.oldPrice ? <p className="text-base font-bold text-zinc-500 line-through">De {selectedOfferPlan.oldPrice}</p> : null}
                    <div className="mt-1 flex flex-wrap items-end gap-3">
                      <span className="text-5xl font-black leading-none text-white sm:text-6xl">{selectedOfferPlan.price}</span>
                      <span className="pb-2 text-base font-bold text-zinc-400">{selectedOfferPlan.suffix}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-black uppercase text-zinc-500">Comparativo</p>
                        <p className="mt-1 text-sm font-black text-blue-200">{selectedOfferPlan.total}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                        <p className="text-xs font-black uppercase text-emerald-200">Vantagem</p>
                        <p className="mt-1 text-sm font-black text-emerald-50">{selectedOfferPlan.economy}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-300">{selectedOfferPlan.description}</p>

                  <div className="mt-6 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-blue-300/20 bg-blue-400/10 p-4">
                      <p className="text-xs font-black uppercase text-blue-200">{salesContent.pricing.decisionTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {salesContent.pricing.decisionByPlan?.[selectedOfferPlan.id] || selectedOfferPlan.equivalent || selectedOfferPlan.description}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-black uppercase text-zinc-500">{salesContent.pricing.bestForTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{selectedOfferPlan.bestFor}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                      <p className="text-xs font-black uppercase text-emerald-200">{salesContent.pricing.unlockTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {salesContent.pricing.unlockText}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-zinc-500">{salesContent.pricing.afterSignupTitle}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{selectedOfferPlan.operatingPromise}</p>
                      </div>
                      <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">{salesContent.pricing.activationBadge}</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {selectedOfferPlan.activationPlan.map((item, index) => (
                        <div key={item} className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-xs font-black text-zinc-950">{index + 1}</span>
                          <p className="mt-3 text-xs font-bold leading-5 text-zinc-300">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {salesContent.pricing.deliveryCards.map(({ title, text }) => (
                      <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-black text-white">{title}</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">{text}</p>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={() => startPlanSignup(selectedOfferPlan.id)} className="mt-7 w-full rounded-xl bg-blue-500 px-5 py-4 text-base font-black text-zinc-950 shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 sm:w-auto sm:min-w-52">
                    {salesContent.pricing.cta}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/92 p-5 shadow-2xl shadow-black/30 sm:p-6">
                <p className="text-sm font-black uppercase text-zinc-400">{salesContent.pricing.includedTitle}</p>
                <div className="mt-5 grid gap-3">
                  {selectedOfferPlan.highlights.map((item) => (
                    <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-200">
                      <span className="text-blue-300">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="text-xs font-black uppercase text-emerald-200">{salesContent.pricing.noStudentFeeTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {salesContent.pricing.noStudentFeeText}
                  </p>
                </div>
                <div className="mt-4 rounded-xl border border-blue-300/20 bg-blue-400/10 p-4">
                  <p className="text-xs font-black uppercase text-blue-200">{salesContent.pricing.nextStepTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {salesContent.pricing.nextStepText}
                  </p>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-black uppercase text-zinc-400">{salesContent.pricing.implementationTitle}</p>
                  <div className="mt-3 grid gap-2">
                    {salesContent.pricing.implementationSteps.map((item, index) => (
                      <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-black text-zinc-950">{index + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {salesContent.pricing.metricCards.map((item) => (
                    <div key={`${item.value}-${item.label}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-lg font-black text-white">{item.value}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05070d] px-4 py-6 text-center text-xs text-zinc-500">
        {salesContent.footerText}
      </footer>
    </div>
  )
}

function SalesStat({ value, label }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-black text-white sm:text-xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{label}</p>
    </div>
  )
}

function ObjectionPoint({ text, positive = false }) {
  return (
    <div className="flex gap-3 text-sm leading-6 text-zinc-300">
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${positive ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
      <p>{text}</p>
    </div>
  )
}

function RevenueControl({ label, value, min, max, step = 1, prefix = '', suffix = '', onChange }) {
  return (
    <label className="grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-zinc-300">{label}</span>
        <span className="text-sm font-black text-white">{prefix}{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="revenue-range"
      />
    </label>
  )
}

function RevenueResult({ label, value, highlight = false, accent = false }) {
  const tone = highlight
    ? 'border-blue-300/35 bg-blue-300/10'
    : accent
      ? 'border-emerald-300/35 bg-emerald-300/10'
      : 'border-white/10 bg-white/[0.035]'

  return (
    <div className={`rounded-md border p-4 ${tone}`}>
      <p className="text-xs font-bold text-zinc-400">{label}</p>
      <p className="mt-2 break-words text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">por mês</p>
    </div>
  )
}

function Overview({ selectedStudent, smartAlerts, assessments, invoices, setActiveView }) {
  if (!selectedStudent) {
    return (
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Comece sua operação" action="Primeiros passos">
          <div className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <p className="text-xs font-black uppercase text-emerald-200">Validação manual</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">
              Quando o aluno solicitar validação, confira o Pix/comprovante e clique em confirmar. O sistema marca como pago e libera o acesso do aluno.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              ['1', 'Configure sua identidade', 'Preencha marca, nome profissional, CREF e WhatsApp.', 'configuracoes'],
              ['2', 'Cadastre o primeiro aluno', 'Registre objetivo, plano, contato e dados iniciais.', 'alunos'],
              ['3', 'Monte o acompanhamento', 'Crie treino, dieta, avaliação, agenda e cobrança.', 'treinos'],
              ['4', 'Envie o convite', 'Teste o portal do aluno e o consentimento de dados.', 'aluno-app'],
            ].map(([number, title, description, view]) => (
              <button
                key={number}
                onClick={() => setActiveView(view)}
                className="flex w-full items-start gap-4 rounded-md border border-white/10 bg-white/[0.03] p-4 text-left hover:border-blue-300/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-blue-500 font-black text-zinc-950">{number}</span>
                <span>
                  <span className="block font-black">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Conta pronta para iniciar" action="Ambiente limpo">
          <div className="rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
            <p className="font-black text-blue-200">Nenhum dado demonstrativo</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Sua conta está vazia e preparada para receber somente alunos reais da sua operação.
            </p>
          </div>
          <button onClick={() => setActiveView('alunos')} className="mt-4 w-full rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
            Cadastrar primeiro aluno
          </button>
        </Panel>
      </div>
    )
  }

  const assessmentData = buildAssessmentChartData(assessments, selectedStudent?.id)
  const revenueChartData = buildRevenueChartData(invoices)
  const actionPlan = buildCoachActionPlan(smartAlerts)

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Evolução corporal" action={`${assessmentData.length} avaliações`}>
        {assessmentData.length ? (
          <Suspense fallback={<ChartLoading />}>
            <AssessmentChart data={assessmentData} weightLabel="Peso (kg)" bodyFatLabel="Gordura (%)" />
          </Suspense>
        ) : (
          <Empty text="Registre avaliações para visualizar a evolução real do aluno." />
        )}
      </Panel>

      <Panel title="Aluno em foco" action={selectedStudent?.status ?? 'Sem aluno'}>
        {selectedStudent ? <StudentSnapshot student={selectedStudent} /> : <Empty text="Cadastre seu primeiro aluno." />}
        <button onClick={() => setActiveView('alunos')} className="mt-5 w-full rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
          Abrir alunos
        </button>
      </Panel>

      <Panel title="Receita recebida" action="Dados financeiros">
        {revenueChartData.length ? (
          <Suspense fallback={<ChartLoading />}>
            <RevenueChart data={revenueChartData} />
          </Suspense>
        ) : (
          <Empty text="Marque cobranças como pagas para formar o gráfico de receita." />
        )}
      </Panel>

      <Panel title="Prioridades" action={`${smartAlerts.length} alertas`}>
        <div className="space-y-3">
          {smartAlerts.length ? (
            smartAlerts.slice(0, 5).map((alert) => (
              <SmartAlertCard key={alert.id} alert={alert} compact onOpen={() => setActiveView(alert.view)} />
            ))
          ) : (
            <Empty text="Nenhuma prioridade crítica agora." />
          )}
        </div>
      </Panel>

      <Panel title="Radar de retenção" action="Diferencial">
        <CoachRetentionRadar
          selectedStudent={selectedStudent}
          action={actionPlan[0]}
          alertCount={smartAlerts.length}
          onOpen={() => setActiveView(actionPlan[0]?.view || 'mensagens')}
        />
      </Panel>

      <Panel title="Próximas ações inteligentes" action="Coach OS">
        <div className="grid gap-3">
          {actionPlan.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveView(item.view)}
              className="group flex min-w-0 items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-400/[0.06]"
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone}`} />
              <span className="min-w-0">
                <span className="block break-words text-sm font-black text-zinc-100">{item.title}</span>
                <span className="mt-1 block break-words text-sm leading-6 text-zinc-400">{item.body}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function CoachRetentionRadar({ selectedStudent, action, alertCount, onOpen }) {
  const retentionStatus = alertCount > 2 ? 'Atenção alta' : alertCount > 0 ? 'Acompanhar hoje' : 'Carteira estável'
  const retentionCopy = alertCount > 2
    ? 'Existem sinais que podem virar abandono se o coach não agir hoje.'
    : alertCount > 0
      ? 'Uma ação rápida agora aumenta percepção de cuidado.'
      : 'Use o momento para mandar feedback proativo e reforçar resultado.'

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-[#00c7a8]/25 bg-[#00c7a8]/10 p-4">
        <p className="text-xs font-black uppercase text-[#9fffe8]">Próxima melhor ação</p>
        <h4 className="mt-2 text-xl font-black text-white">{action?.title || 'Enviar feedback proativo'}</h4>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{action?.body || retentionCopy}</p>
        <button type="button" onClick={onOpen} className="mt-4 rounded-lg bg-[#00c7a8] px-4 py-3 text-sm font-black text-black transition active:scale-[0.98]">
          Agir agora
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase text-zinc-500">Aluno em foco</p>
          <p className="mt-2 text-lg font-black text-white">{selectedStudent?.name || 'Selecione um aluno'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase text-zinc-500">Risco da carteira</p>
          <p className="mt-2 text-lg font-black text-white">{retentionStatus}</p>
        </div>
      </div>
    </div>
  )
}

function Agenda({ students, appointments, onSaveAppointment, onUpdateStatus }) {
  const [filter, setFilter] = useState('Proximos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const now = new Date()
  const visibleAppointments = appointments
    .filter((appointment) => {
      if (filter === 'Todos') return true
      if (filter === 'Concluidos') return appointment.status === 'Concluido'
      if (filter === 'Cancelados') return appointment.status === 'Cancelado'
      return new Date(appointment.startsAt) >= now && !['Concluido', 'Cancelado'].includes(appointment.status)
    })
    .slice()
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const todayKey = toLocalDateKey(now)
  const todayAppointments = appointments.filter((appointment) => toLocalDateKey(appointment.startsAt) === todayKey && !['Concluido', 'Cancelado'].includes(appointment.status))
  const nextAppointments = appointments.filter((appointment) => new Date(appointment.startsAt) >= now && !['Concluido', 'Cancelado'].includes(appointment.status))

  async function handleSubmit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const startsAtValue = form.get('startsAt')?.toString()
    if (!startsAtValue) return

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onSaveAppointment({
        studentId: form.get('studentId')?.toString() || '',
        title: form.get('title')?.toString() || 'Acompanhamento',
        type: form.get('type')?.toString() || 'Consulta',
        startsAt: new Date(startsAtValue).toISOString(),
        durationMinutes: Number(form.get('durationMinutes')),
        status: 'Agendado',
        location: form.get('location')?.toString() || '',
        notes: [
          form.get('setsLog')?.toString() ? `Séries/cargas: ${form.get('setsLog')?.toString()}` : '',
          form.get('notes')?.toString() || '',
        ].filter(Boolean).join('\n'),
      })
      formElement.reset()
      setMessage('Compromisso adicionado na agenda.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar o compromisso.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(appointmentId, status) {
    setUpdatingId(String(appointmentId))
    setError('')
    try {
      const updated = await onUpdateStatus(appointmentId, status)
      if (!updated) setError('Não foi possível atualizar este compromisso.')
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="xl:col-span-2 rounded-2xl border border-blue-300/20 bg-gradient-to-br from-blue-500/10 via-zinc-950/90 to-emerald-300/8 p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-blue-200">Agenda do coach</p>
            <h2 className="mt-2 text-2xl font-black text-white">Organize check-ins, avaliações, chamadas e revisões sem misturar com o chat.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use esta área para marcar compromissos que precisam de data, horário e acompanhamento. O aluno visualiza a agenda no portal dele.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Hoje</p>
              <p className="mt-1 text-2xl font-black text-white">{todayAppointments.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Próximos</p>
              <p className="mt-1 text-2xl font-black text-blue-200">{nextAppointments.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Alunos</p>
              <p className="mt-1 text-2xl font-black text-emerald-200">{students.length}</p>
            </div>
          </div>
        </div>
      </section>

      <Panel title="Novo compromisso" action="Agenda">
        {students.length ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Select
              label="Aluno"
              name="studentId"
              options={students.map((student) => ({ label: student.name, value: student.id }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" name="title" defaultValue="Acompanhamento" />
              <Select label="Tipo" name="type" defaultValue="Consulta" options={['Consulta', 'Avaliação', 'Check-in', 'Chamada', 'Revisão de treino', 'Revisão de dieta', 'Outro']} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e horário" name="startsAt" type="datetime-local" defaultValue={getDefaultAppointmentDate()} />
              <Select
                label="Duração"
                name="durationMinutes"
                defaultValue="30"
                options={[
                  { label: '15 minutos', value: 15 },
                  { label: '30 minutos', value: 30 },
                  { label: '45 minutos', value: 45 },
                  { label: '60 minutos', value: 60 },
                ]}
              />
            </div>
            <Field label="Local ou link" name="location" defaultValue="Online" />
            <TextArea label="Observações" name="notes" defaultValue="Revisar progresso, constância e próximos ajustes." />
            <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Salvando...' : 'Agendar compromisso'}
            </button>
            {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
            {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
          </form>
        ) : (
          <Empty text="Cadastre um aluno antes de criar compromissos." />
        )}
      </Panel>

      <Panel title="Compromissos" action={`${visibleAppointments.length} exibidos`}>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {['Proximos', 'Todos', 'Concluidos', 'Cancelados'].map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`shrink-0 rounded-md border px-3 py-2 text-xs font-black ${
                filter === option
                  ? 'border-blue-500 bg-blue-500 text-zinc-950'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300'
              }`}
            >
              {formatUiText(option)}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {visibleAppointments.length ? (
            visibleAppointments.map((appointment) => {
              const student = students.find((item) => String(item.id) === String(appointment.studentId))
              return (
                <div key={appointment.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={appointment.status === 'Cancelado' ? 'Alto' : appointment.status === 'Agendado' ? 'Medio' : 'Baixo'}>
                          {appointment.status}
                        </Badge>
                        <span className="text-xs font-bold text-zinc-500">{formatUiText(appointment.type)}</span>
                      </div>
                      <h4 className="mt-3 text-lg font-black">{appointment.title}</h4>
                      <p className="mt-1 text-sm text-zinc-300">{student?.name ?? 'Aluno'}</p>
                      <p className="mt-2 text-sm font-bold text-blue-200">{formatFullDateTime(appointment.startsAt)}</p>
                      <p className="mt-1 text-sm text-zinc-400">{appointment.durationMinutes} min - {appointment.location || 'Sem local'}</p>
                      {appointment.notes ? <p className="mt-3 text-sm leading-6 text-zinc-400">{appointment.notes}</p> : null}
                    </div>

                    {!['Concluido', 'Cancelado'].includes(appointment.status) ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-1">
                        {appointment.status !== 'Confirmado' ? (
                          <button disabled={updatingId === String(appointment.id)} onClick={() => handleStatus(appointment.id, 'Confirmado')} className="rounded-md border border-blue-300/30 px-3 py-2 text-xs font-black text-blue-200 disabled:opacity-50">
                            Confirmar
                          </button>
                        ) : null}
                        <button disabled={updatingId === String(appointment.id)} onClick={() => handleStatus(appointment.id, 'Concluido')} className="rounded-md bg-blue-500 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">
                          Concluir
                        </button>
                        <button disabled={updatingId === String(appointment.id)} onClick={() => handleStatus(appointment.id, 'Cancelado')} className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-50">
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })
          ) : (
            <Empty text="Nenhum compromisso encontrado neste filtro." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function Students({ students, invites, anamneses, selectedStudent, setSelectedStudentId, onSave, onGenerateInvite, onDelete, coachPlans = plans }) {
  const [editing, setEditing] = useState(null)
  const [savedInvite, setSavedInvite] = useState(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [releaseDays, setReleaseDays] = useState('3')
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessMessage, setAccessMessage] = useState('')
  const [accessError, setAccessError] = useState('')
  const selectedInvite = savedInvite?.studentId === selectedStudent?.id
    ? savedInvite
    : invites.find((invite) => String(invite.studentId) === String(selectedStudent?.id) && invite.status === 'active')
  const selectedAnamnesis = anamneses.find((item) => String(item.studentId) === String(selectedStudent?.id))

  useEffect(() => {
    setAccessMessage('')
    setAccessError('')
  }, [selectedStudent?.id])

  async function releaseTemporaryAccess(days = 3) {
    if (!selectedStudent) return
    const safeDays = Math.max(1, Math.min(90, Number(days) || 1))
    const until = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString()
    setAccessSaving(true)
    setAccessMessage('')
    setAccessError('')
    try {
      await onSave({ ...selectedStudent, accessOverrideUntil: until })
      setAccessMessage(`Acesso liberado até ${formatFullDateTime(until)}.`)
    } catch (error) {
      setAccessError(error?.message || 'Não foi possível liberar o acesso do aluno.')
    } finally {
      setAccessSaving(false)
    }
  }

  async function removeTemporaryAccess() {
    if (!selectedStudent) return
    setAccessSaving(true)
    setAccessMessage('')
    setAccessError('')
    try {
      await onSave({ ...selectedStudent, accessOverrideUntil: '' })
      setAccessMessage('Liberação temporária removida.')
    } catch (error) {
      setAccessError(error?.message || 'Não foi possível remover a liberação.')
    } finally {
      setAccessSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1fr_1.15fr]">
      <Panel title="Carteira de alunos" action={`${students.length} perfis`}>
        <button onClick={() => setEditing(createBlankStudent())} className="mb-4 w-full rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
          Novo aluno
        </button>
        <div className="space-y-3">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className={`w-full rounded-md border p-4 text-left transition ${
                selectedStudent?.id === student.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{student.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{student.goal || student.plan || 'Acompanhamento'}</p>
                </div>
                <Badge tone={student.risk}>{student.risk}</Badge>
              </div>
              <div className="mt-4 h-2 rounded bg-zinc-800">
                <div className="h-2 rounded bg-blue-500" style={{ width: `${clampPercent(student.adherence)}%` }} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ficha e edição" action={selectedStudent?.phase ?? 'Novo'}>
        {editing ? (
          <StudentForm
            student={editing}
            coachPlans={coachPlans}
            onCancel={() => setEditing(null)}
            onSave={async (student) => {
              const result = await onSave(student)
              if (result?.invite) setSavedInvite(result.invite)
              setEditing(null)
            }}
          />
        ) : selectedStudent ? (
          <>
            <StudentSnapshot student={selectedStudent} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="E-mail" value={selectedStudent.email} />
              <Info label="Telefone" value={selectedStudent.phone} />
              <Info label="CPF" value={formatCpf(selectedStudent.cpf) || 'Não informado'} />
              <Info label="Plano" value={selectedStudent.plan} />
              <Info label="Pagamento" value={selectedStudent.payment} />
              <Info label="Meta de água" value={selectedStudent.waterGoalMl ? `${selectedStudent.waterGoalMl} ml/dia` : '2500 ml/dia'} />
              <Info label="Liberação temporária" value={selectedStudent.accessOverrideUntil ? `Até ${formatFullDateTime(selectedStudent.accessOverrideUntil)}` : 'Sem liberação ativa'} />
              <Info label="Próximo check-in" value={selectedStudent.nextCheckin} />
            </div>
            <div className="mt-5 rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase text-amber-200">Acesso do aluno</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">
                Se o aluno estiver pendente, o portal bloqueia treino, dieta e progresso. Você pode liberar temporariamente em casos de exceção.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
                  Dias de liberação
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={releaseDays}
                    onChange={(event) => setReleaseDays(event.target.value)}
                    className="min-h-10 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case text-zinc-100 outline-none focus:border-amber-300"
                  />
                </label>
                <button type="button" disabled={accessSaving} onClick={() => releaseTemporaryAccess(releaseDays)} className="rounded-md bg-amber-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
                  {accessSaving ? 'Salvando...' : 'Liberar acesso'}
                </button>
                <button type="button" disabled={accessSaving} onClick={removeTemporaryAccess} className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-100 disabled:cursor-wait disabled:opacity-60">Remover liberação</button>
              </div>
              {accessMessage ? <p className="mt-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{accessMessage}</p> : null}
              {accessError ? <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{accessError}</p> : null}
            </div>
            <div className="mt-5 rounded-md border border-blue-300/30 bg-blue-300/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-200">Código de acesso do aluno</p>
              {selectedInvite ? (
                <>
                  <p className="mt-2 select-all text-2xl font-black text-white">{selectedInvite.code}</p>
                  <p className="mt-2 text-sm text-zinc-300">O aluno usa este código na opção “Aluno” da tela de entrada.</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-amber-200">Código ainda não disponível.</p>
                  <button
                    type="button"
                    disabled={generatingCode}
                    onClick={async () => {
                      setGeneratingCode(true)
                      setInviteError('')
                      try {
                        const invite = await onGenerateInvite(selectedStudent.id)
                        setSavedInvite(invite)
                      } catch (error) {
                        setInviteError(error.message)
                      } finally {
                        setGeneratingCode(false)
                      }
                    }}
                    className="mt-3 rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-60"
                  >
                    {generatingCode ? 'Gerando código...' : 'Gerar código agora'}
                  </button>
                  {inviteError ? <p className="mt-2 text-sm text-red-200">{inviteError}</p> : null}
                </>
              )}
            </div>
            <div className="mt-5">
              <ProfessionalAnamnesisSummary anamnesis={selectedAnamnesis} student={selectedStudent} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setEditing(selectedStudent)} className="w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
                Editar aluno
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  const confirmed = window.confirm(`Excluir ${selectedStudent.name} e todos os registros vinculados? Esta ação não pode ser desfeita.`)
                  if (!confirmed) return
                  setDeleting(true)
                  setInviteError('')
                  try {
                    await onDelete(selectedStudent.id)
                    setSavedInvite(null)
                  } catch (error) {
                    setInviteError(error?.message || 'Não foi possível excluir o aluno.')
                  } finally {
                    setDeleting(false)
                  }
                }}
                className="w-full rounded-md border border-rose-300/30 px-4 py-3 text-sm font-black text-rose-200 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir aluno'}
              </button>
            </div>
          </>
        ) : (
          <Empty text="Nenhum aluno selecionado." />
        )}
      </Panel>
    </div>
  )
}

function StudentForm({ student, coachPlans = plans, onSave, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [continuingStudent, setContinuingStudent] = useState(student.requireAnamnesis === false)
  const selectedPlanName = coachPlans.some((plan) => plan.name === student.plan) ? student.plan : coachPlans[0]?.name

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const cpf = form.get('cpf')?.toString().trim() || ''
    if (cpf && cpf.replace(/\D/g, '').length !== 11) {
      setError('Confira o CPF: ele deve ter 11 números.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...student,
        name: form.get('name').toString(),
        email: form.get('email').toString(),
        phone: form.get('phone').toString(),
        cpf: cpf.replace(/\D/g, ''),
        plan: form.get('plan').toString(),
        payment: form.get('payment').toString(),
        waterGoalMl: form.get('waterGoalMl')?.toString() || '2500',
        requireAnamnesis: !continuingStudent,
      })
    } catch (saveError) {
      setError(saveError.message || 'Não foi possível salvar o aluno.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition ${
        continuingStudent
          ? 'border-emerald-300/40 bg-emerald-300/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
      }`}>
        <input
          type="checkbox"
          checked={continuingStudent}
          onChange={(event) => setContinuingStudent(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
        />
        <span className="min-w-0">
          <span className="block font-black text-zinc-100">Aluno já acompanhado</span>
          <span className="mt-1 block text-sm leading-6 text-zinc-400">
            Use para transferir um aluno atual para o Coach Fit Pro. Ele aceitará o consentimento e entrará direto no portal, sem preencher uma nova anamnese.
          </span>
        </span>
      </label>
      {continuingStudent ? (
        <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
          Depois do cadastro, registre treino, alimentação, avaliações e próximos acompanhamentos nas áreas correspondentes.
        </div>
      ) : (
        <div className="rounded-md border border-blue-300/25 bg-blue-300/10 p-4 text-sm leading-6 text-blue-50">
          Como este é um aluno novo, a anamnese será solicitada no primeiro acesso após o consentimento.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="name" defaultValue={student.name} autoComplete="name" />
        <Field label="E-mail" name="email" type="email" defaultValue={student.email} autoComplete="email" />
        <Field label="Celular" name="phone" defaultValue={student.phone} inputMode="tel" autoComplete="tel" />
        <Field label="CPF (opcional)" name="cpf" defaultValue={student.cpf} inputMode="numeric" autoComplete="off" maxLength={14} required={false} />
        <Field label="Meta de água por dia (ml)" name="waterGoalMl" type="number" defaultValue={student.waterGoalMl || '2500'} inputMode="numeric" required={false} />
        <Select label="Plano" name="plan" defaultValue={selectedPlanName} options={coachPlans.map((plan) => plan.name)} />
        <Select label="Pagamento" name="payment" defaultValue={student.payment} options={['Pago', 'Pendente']} />
      </div>
      {error ? <p className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm font-bold text-red-100">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar aluno'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Assessments({ students, selectedStudent, assessments, onSaveAssessment }) {
  const [studentId, setStudentId] = useState(selectedStudent?.id ?? students[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const student = students.find((item) => String(item.id) === String(studentId)) ?? selectedStudent
  const studentAssessments = assessments
    .filter((assessment) => String(assessment.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onSaveAssessment({
        studentId: form.get('studentId')?.toString() || '',
        assessedAt: form.get('assessedAt')?.toString() || new Date().toISOString().slice(0, 10),
        weightKg: form.get('weightKg')?.toString() || '',
        heightCm: form.get('heightCm')?.toString() || '',
        bodyFatPercent: form.get('bodyFatPercent')?.toString() || '',
        waistCm: form.get('waistCm')?.toString() || '',
        abdomenCm: form.get('abdomenCm')?.toString() || '',
        hipCm: form.get('hipCm')?.toString() || '',
        chestCm: form.get('chestCm')?.toString() || '',
        armCm: form.get('armCm')?.toString() || '',
        thighCm: form.get('thighCm')?.toString() || '',
        calfCm: form.get('calfCm')?.toString() || '',
        restingHeartRate: form.get('restingHeartRate')?.toString() || '',
        notes: form.get('notes')?.toString() || '',
      })
      setMessage('Avaliação registrada com sucesso.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar a avaliação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6">
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Nova avaliação" action="Medidas corporais">
          {students.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Aluno
                <select
                  name="studentId"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
                >
                  {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data da avaliação" name="assessedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Field label="Peso (kg)" name="weightKg" type="number" defaultValue={parseMetric(student?.weight)} />
                <Field label="Altura (cm)" name="heightCm" type="number" defaultValue="175" />
                <Field label="Gordura corporal (%)" name="bodyFatPercent" type="number" defaultValue={parseMetric(student?.bodyFat)} required={false} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Cintura (cm)" name="waistCm" type="number" required={false} />
                <Field label="Abdomen (cm)" name="abdomenCm" type="number" required={false} />
                <Field label="Quadril (cm)" name="hipCm" type="number" required={false} />
                <Field label="Peitoral (cm)" name="chestCm" type="number" required={false} />
                <Field label="Braço (cm)" name="armCm" type="number" required={false} />
                <Field label="Coxa (cm)" name="thighCm" type="number" required={false} />
                <Field label="Panturrilha (cm)" name="calfCm" type="number" required={false} />
                <Field label="FC repouso" name="restingHeartRate" type="number" required={false} />
              </div>
              <TextArea label="Parecer do coach" name="notes" defaultValue="Registrar evolução, pontos de atenção e próximo objetivo." />
              <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar avaliação'}
              </button>
              {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
              {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
            </form>
          ) : (
            <Empty text="Cadastre um aluno antes de registrar avaliações." />
          )}
        </Panel>

        <Panel title={`Evolução - ${student?.name ?? 'Aluno'}`} action={`${studentAssessments.length} registros`}>
          <AssessmentProgress assessments={studentAssessments} student={student} detailed />
        </Panel>
      </div>

      <Panel title="Histórico de avaliações" action="Comparativo">
        <div className="grid gap-3 lg:grid-cols-2">
          {studentAssessments.length ? (
            studentAssessments.map((assessment, index) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                previous={studentAssessments[index + 1]}
              />
            ))
          ) : (
            <Empty text="Nenhuma avaliação registrada para este aluno." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function AssessmentProgress({ assessments, student, detailed = false, checkins = [] }) {
  const ordered = assessments.slice().sort((a, b) => new Date(a.assessedAt) - new Date(b.assessedAt))
  const latest = ordered.at(-1)
  const first = ordered[0]
  const photoCheckins = checkins
    .filter((item) => item.photo)
    .slice()
    .sort((a, b) => getCheckinTime(a) - getCheckinTime(b))
  const firstPhoto = photoCheckins[0]
  const latestPhoto = photoCheckins.at(-1)
  const chartData = ordered.map((assessment) => ({
    label: formatShortDate(assessment.assessedAt),
    peso: assessment.weightKg,
    gordura: assessment.bodyFatPercent,
    cintura: assessment.waistCm,
  }))

  if (!latest) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Peso atual" value={student?.weight ?? '-'} />
          <Info label="Gordura corporal" value={student?.bodyFat ?? '-'} />
        </div>
        {firstPhoto && latestPhoto && firstPhoto.id !== latestPhoto.id ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <PhotoCompareCard label="Primeiro registro" item={firstPhoto} />
            <PhotoCompareCard label="Registro atual" item={latestPhoto} />
          </div>
        ) : (
          <Empty text="A evolução detalhada aparecerá depois da primeira avaliação ou de dois check-ins com foto." />
        )}
      </div>
    )
  }

  const bmi = calculateBmi(latest.weightKg, latest.heightCm)
  const insight = buildAssessmentInsight(first, latest)

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Info label="Peso" value={`${formatNumber(latest.weightKg)} kg`} />
        <Info label="Gordura" value={`${formatNumber(latest.bodyFatPercent)}%`} />
        <Info label="Cintura" value={latest.waistCm ? `${formatNumber(latest.waistCm)} cm` : '-'} />
        <Info label="IMC" value={bmi ? formatNumber(bmi) : '-'} />
      </div>
      {firstPhoto && latestPhoto && firstPhoto.id !== latestPhoto.id ? (
        <div className="rounded-md border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-200">Comparativo visual</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">Compare a primeira foto registrada com o check-in mais recente.</p>
            </div>
            <span className="text-xs font-bold text-zinc-400">{photoCheckins.length} foto(s)</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PhotoCompareCard label="Primeiro registro" item={firstPhoto} />
            <PhotoCompareCard label="Registro atual" item={latestPhoto} />
          </div>
        </div>
      ) : null}
      {detailed && chartData.length > 1 ? (
        <Suspense fallback={<ChartLoading />}>
          <AssessmentChart data={chartData} />
        </Suspense>
      ) : null}
      <div className="rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-normal text-blue-200">Leitura da evolução</p>
        <p className="mt-2 text-sm leading-6 text-zinc-200">{insight}</p>
      </div>
    </div>
  )
}

function PhotoCompareCard({ label, item }) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-zinc-950/60">
      <img src={item.photo} alt={label} className="h-72 w-full object-cover" loading="lazy" />
      <div className="p-3">
        <p className="text-sm font-black">{label}</p>
        <p className="mt-1 text-xs text-zinc-400">{item.type || 'Check-in'} | {item.due || formatDateTime(item.createdAt)}</p>
        {item.weight ? <p className="mt-1 text-xs text-zinc-500">Peso informado: {item.weight}</p> : null}
      </div>
    </div>
  )
}

function getCheckinTime(item) {
  const parsed = Date.parse(item.createdAt || item.due || '')
  if (Number.isFinite(parsed)) return parsed
  const numericId = Number(item.id)
  return Number.isFinite(numericId) ? numericId : 0
}

function AssessmentCard({ assessment, previous }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-black">{formatDate(assessment.assessedAt)}</h4>
          <p className="mt-1 text-sm text-zinc-400">{assessment.notes || 'Sem parecer registrado.'}</p>
        </div>
        <Badge tone="Baixo">{assessment.weightKg ? `${formatNumber(assessment.weightKg)} kg` : 'Registro'}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AssessmentValue label="Gordura" value={assessment.bodyFatPercent} suffix="%" previous={previous?.bodyFatPercent} />
        <AssessmentValue label="Cintura" value={assessment.waistCm} suffix=" cm" previous={previous?.waistCm} />
        <AssessmentValue label="Braço" value={assessment.armCm} suffix=" cm" previous={previous?.armCm} />
        <AssessmentValue label="Coxa" value={assessment.thighCm} suffix=" cm" previous={previous?.thighCm} />
      </div>
    </div>
  )
}

function AssessmentValue({ label, value, suffix, previous }) {
  const difference = value !== null && previous !== null && previous !== undefined
    ? Number(value) - Number(previous)
    : null

  return (
    <div className="rounded-md bg-zinc-950/60 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-black">{value !== null && value !== undefined ? `${formatNumber(value)}${suffix}` : '-'}</p>
      {difference !== null ? <p className="mt-1 text-xs text-zinc-400">{difference > 0 ? '+' : ''}{formatNumber(difference)}</p> : null}
    </div>
  )
}

function Workouts({ selectedStudent, students, workouts, workoutLogs, onSaveWorkout, onArchiveWorkout, onSaveStudent }) {
  const studentWorkouts = workouts.filter((workout) => (
    String(workout.studentId) === String(selectedStudent?.id) && workout.active !== false
  ))
  const studentLogs = workoutLogs.filter((log) => String(log.studentId) === String(selectedStudent?.id))

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Panel title={`Prescrever treino - ${selectedStudent?.name ?? 'Aluno'}`} action="Novo plano">
        {students.length ? (
          <WorkoutForm students={students} selectedStudent={selectedStudent} onSaveWorkout={onSaveWorkout} />
        ) : (
          <Empty text="Cadastre um aluno antes de prescrever o primeiro treino." />
        )}
      </Panel>

      <Panel title="Treinos prescritos" action={`${studentWorkouts.length} ativos`}>
        <WorkoutList workouts={studentWorkouts} fallbackTitle={selectedStudent?.workout} onArchive={onArchiveWorkout} />
      </Panel>

      <Panel title="Notas de carga" action="Progressão">
        <LoadNotesPanel student={selectedStudent} logs={studentLogs} onSaveStudent={onSaveStudent} />
      </Panel>

      <Panel title="Histórico de execução" action={`${studentLogs.length} registros`}>
        <WorkoutLogList logs={studentLogs} />
      </Panel>
    </div>
  )
}

function LoadNotesPanel({ student, logs, onSaveStudent }) {
  const [notes, setNotes] = useState(student?.loadNotes || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const latestLogs = logs.slice(0, 4)
  const latestEffort = latestLogs[0]?.effort || ''
  const suggestion = latestEffort.includes('Leve')
    ? 'Próximo treino: considere subir 2% a 5% na carga principal.'
    : latestEffort.includes('Forte')
      ? 'Próximo treino: mantenha a carga e busque execução mais limpa antes de subir.'
      : 'Próximo treino: se as repetições baterem com boa técnica, progrida aos poucos.'

  useEffect(() => {
    setNotes(student?.loadNotes || '')
    setMessage('')
  }, [student?.id, student?.loadNotes])

  async function handleSave() {
    if (!student || !onSaveStudent) return
    setSaving(true)
    setMessage('')
    try {
      await onSaveStudent({ ...student, loadNotes: notes })
      setMessage('Notas salvas para este aluno.')
    } finally {
      setSaving(false)
    }
  }

  if (!student) return <Empty text="Selecione um aluno para controlar cargas." />

  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-4">
        <p className="text-xs font-black uppercase text-emerald-200">Sugestão automática</p>
        <p className="mt-2 text-sm leading-6 text-zinc-200">{suggestion}</p>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={5}
        placeholder="Ex.: supino 30 kg por lado com RPE 8; manter carga até completar 10 reps limpas."
        className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none focus:border-blue-500"
      />
      <button type="button" disabled={saving} onClick={handleSave} className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar notas de carga'}
      </button>
      {message ? <p className="text-sm font-bold text-emerald-200">{message}</p> : null}
      {latestLogs.length ? (
        <div className="grid gap-2">
          {latestLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-black">{log.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{formatDateTime(log.completedAt)} | Esforço: {log.effort || '-'}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WorkoutForm({ students, selectedStudent, onSaveWorkout }) {
  const [exercises, setExercises] = useState([
    createExerciseDraft('Supino reto com barra', { sets: '4', reps: '8-10', load: 'RPE 8', rest: '90s' }),
    createExerciseDraft('Remada baixa', { sets: '4', reps: '10-12', load: 'RPE 8', rest: '90s' }),
    createExerciseDraft('Desenvolvimento com halteres', { sets: '3', reps: '8-10', load: 'RPE 7', rest: '75s' }),
  ])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function updateExercise(index, field, value) {
    setExercises((current) => current.map((exercise, itemIndex) => (
      itemIndex === index ? { ...exercise, [field]: value } : exercise
    )))
  }

  function updateExerciseName(index, value) {
    const profile = findExerciseProfile(value)
    setExercises((current) => current.map((exercise, itemIndex) => {
      if (itemIndex !== index) return exercise
      return {
        ...exercise,
        name: value,
        muscleGroup: profile?.group ?? exercise.muscleGroup,
        equipment: profile?.equipment ?? exercise.equipment,
        instructions: profile?.cues ?? exercise.instructions,
      }
    }))
  }

  function addExercise(name = '') {
    setExercises((current) => [...current, createExerciseDraft(name)])
  }

  function updateExerciseVideoFile(index, file) {
    setExercises((current) => current.map((exercise, itemIndex) => (
      itemIndex === index ? { ...exercise, videoFile: file || null, videoFileName: file?.name || '' } : exercise
    )))
  }

  function removeExercise(index) {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const filledExercises = exercises.filter((exercise) => exercise.name.trim())
    const studentId = form.get('studentId')?.toString() || ''

    if (!studentId) {
      setError('Selecione um aluno antes de salvar o treino.')
      return
    }
    if (!filledExercises.length) {
      setError('Adicione pelo menos um exercício ao treino.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onSaveWorkout({
        studentId,
        title: form.get('title')?.toString() || 'Treino',
        focus: form.get('focus')?.toString() || '',
        notes: form.get('notes')?.toString() || '',
        exercises: filledExercises.map(enrichExercise),
      })
      setMessage('Treino salvo e liberado para o aluno.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar o treino.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Select
        label="Aluno"
        name="studentId"
        defaultValue={selectedStudent?.id}
        options={students.map((student) => ({ label: student.name, value: student.id }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do treino" name="title" defaultValue="Upper A" />
        <Field label="Foco" name="focus" defaultValue="Peito, costas e ombros" />
      </div>
      <TextArea label="Observações" name="notes" defaultValue="Aquecimento antes das séries principais. Registrar cargas no fim do treino." />

      <div className="rounded-md border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-100">Biblioteca rápida</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Escolha um movimento comum ou digite livremente no campo de exercício.</p>
          </div>
          <span className="w-fit rounded border border-emerald-300/20 px-2 py-1 text-xs font-bold text-emerald-200">{exerciseLibrary.length} exercícios</span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-soft">
          {exerciseLibrary.slice(0, 10).map((exercise) => (
            <button
              key={exercise.name}
              type="button"
              onClick={() => addExercise(exercise.name)}
              className="shrink-0 rounded-md border border-white/10 bg-zinc-950/70 px-3 py-2 text-xs font-bold text-zinc-200"
            >
              + {exercise.name}
            </button>
          ))}
        </div>
      </div>

      <datalist id="exercise-library-options">
        {exerciseLibrary.map((exercise) => <option key={exercise.name} value={exercise.name}>{exercise.group}</option>)}
      </datalist>

      <div className="space-y-3">
        {exercises.map((exercise, index) => (
          <div key={index} className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-emerald-300">Exercício {String(index + 1).padStart(2, '0')}</p>
                <p className="mt-1 text-xs text-zinc-500">{exercise.muscleGroup || 'Grupo muscular identificado pelo nome'}</p>
              </div>
              <button type="button" onClick={() => removeExercise(index)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-300">
                Remover
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.35fr_0.85fr]">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                Nome do exercício
                <input
                  list="exercise-library-options"
                  value={exercise.name}
                  onChange={(event) => updateExerciseName(index, event.target.value)}
                  placeholder="Digite ou escolha um exercício"
                  className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm"
                />
              </label>
              <InlineInput label="Grupo muscular" value={exercise.muscleGroup ?? ''} onChange={(value) => updateExercise(index, 'muscleGroup', value)} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <InlineInput label="Séries" value={exercise.sets} onChange={(value) => updateExercise(index, 'sets', value)} />
              <InlineInput label="Repetições" value={exercise.reps} onChange={(value) => updateExercise(index, 'reps', value)} />
              <InlineInput label="Carga / esforço" value={exercise.load} onChange={(value) => updateExercise(index, 'load', value)} />
              <InlineInput label="Descanso" value={exercise.rest} onChange={(value) => updateExercise(index, 'rest', value)} />
              <InlineInput label="Equipamento" value={exercise.equipment ?? ''} onChange={(value) => updateExercise(index, 'equipment', value)} />
            </div>

            <details className="mt-4 rounded-md border border-white/10 bg-zinc-950/55">
              <summary className="cursor-pointer p-3 text-sm font-black text-emerald-200">Orientação e vídeo de execução</summary>
              <div className="grid gap-3 border-t border-white/10 p-3">
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Orientações técnicas
                  <textarea
                    value={exercise.instructions ?? ''}
                    onChange={(event) => updateExercise(index, 'instructions', event.target.value)}
                    rows={3}
                    className="min-w-0 resize-y rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case leading-6 tracking-normal text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm"
                  />
                </label>
                <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                  <InlineInput label="Link de vídeo personalizado (opcional)" value={exercise.videoUrl ?? ''} onChange={(value) => updateExercise(index, 'videoUrl', value)} />
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Upload do vídeo do coach
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={(event) => updateExerciseVideoFile(index, event.target.files?.[0] || null)}
                      className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-zinc-950"
                    />
                    <span className="text-[11px] normal-case leading-4 tracking-normal text-zinc-500">
                      {exercise.videoFileName || 'Opcional. Se não enviar, o app mostra a imagem técnica do movimento.'}
                    </span>
                  </label>
                </div>
                <ExerciseMedia exercise={exercise} compact />
              </div>
            </details>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={() => addExercise()} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
          Adicionar exercício personalizado
        </button>
        <button disabled={saving} className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar treino'}
        </button>
      </div>
      {message ? (
        <p className="rounded-md border border-blue-300/30 bg-blue-300/10 p-3 text-sm font-bold text-blue-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm font-bold text-red-100">
          {error}
        </p>
      ) : null}
    </form>
  )
}

function WorkoutList({ workouts, fallbackTitle, onArchive }) {
  const [archivingId, setArchivingId] = useState('')

  async function handleArchive(workout) {
    if (!window.confirm(`Arquivar o treino “${workout.title}”? Ele deixará de aparecer para o aluno.`)) return
    setArchivingId(String(workout.id))
    try {
      await onArchive(workout.id)
    } finally {
      setArchivingId('')
    }
  }

  if (!workouts.length) {
    return (
      <div className="space-y-3">
        <Empty text="Nenhum treino prescrito ainda. Salve o primeiro treino para este aluno." />
        {fallbackTitle ? <Row title={fallbackTitle} meta="Treino antigo cadastrado na ficha do aluno" badge="Ficha" /> : null}
      </div>
    )
  }

  if (subscriptionActive) {
    return (
      <div className="grid min-w-0 gap-5 lg:gap-6">
        <section className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-zinc-950/88 shadow-2xl shadow-black/35">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-emerald-300">Minha assinatura</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">Assinatura ativa.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Seu acesso ao Coach Fit Pro está liberado. Esta área mostra apenas o status da sua assinatura para você não confundir pagamento da plataforma com financeiro dos alunos.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Plano escolhido</p>
                  <p className="mt-2 text-lg font-black text-white">{selectedCheckoutPlan.name}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Status</p>
                  <p className="mt-2 text-lg font-black text-emerald-200">{subscriptionStatusLabel}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Provedor</p>
                  <p className="mt-2 text-lg font-black text-blue-200">Cartpanda</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-5">
              <p className="text-xs font-black uppercase text-emerald-200">{billingCycle.isPromotional ? 'Primeiro ciclo' : 'Próximo ciclo'}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <p className="text-3xl font-black text-white">{selectedCheckoutPlan.price}</p>
                <p className="pb-1 text-sm font-bold text-zinc-400">{selectedCheckoutPlan.suffix}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Próxima referência em {billingCycle.daysRemaining} {billingCycle.daysRemaining === 1 ? 'dia' : 'dias'}.
              </p>
              <p className="mt-1 text-xs text-zinc-500">{formatFullDateTime(billingCycle.nextBillingAt)}</p>
              <button type="button" onClick={() => checkPaymentStatus(false)} disabled={checkingPayment} className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
                {checkingPayment ? 'Atualizando...' : 'Atualizar status'}
              </button>
              {paymentMessage ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-zinc-200">{paymentMessage}</p> : null}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {workouts.map((workout) => (
        <div key={workout.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-black">{workout.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">{workout.focus}</p>
              {workout.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{workout.notes}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded border border-blue-300/40 bg-blue-300/10 px-2 py-1 text-xs font-black text-blue-200">
                Ativo
              </span>
              {onArchive ? (
                <button disabled={archivingId === String(workout.id)} type="button" onClick={() => handleArchive(workout)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 disabled:opacity-50">
                  {archivingId === String(workout.id) ? 'Arquivando...' : 'Arquivar'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {workout.exercises.map((exercise, index) => {
              const enriched = enrichExercise(exercise)
              return (
                <div key={exercise.id ?? `${exercise.name}-${index}`} className="rounded-md border border-white/10 bg-zinc-950/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-emerald-300">Exercício {String(index + 1).padStart(2, '0')}</p>
                      <h5 className="mt-1 text-base font-black text-white">{enriched.name}</h5>
                      <p className="mt-1 text-sm text-zinc-400">{enriched.muscleGroup || 'Movimento personalizado'}{enriched.equipment ? ` · ${enriched.equipment}` : ''}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <ExerciseMetric label="Séries" value={enriched.sets || '-'} />
                      <ExerciseMetric label="Reps" value={enriched.reps || '-'} />
                      <ExerciseMetric label="Carga" value={enriched.load || '-'} />
                      <ExerciseMetric label="Pausa" value={enriched.rest || '-'} />
                    </div>
                  </div>
                  {enriched.instructions ? <p className="mt-3 rounded bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">{enriched.instructions}</p> : null}
                  <div className="mt-3">
                    <ExerciseMedia exercise={enriched} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function findExerciseProfile(value) {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const exact = exerciseLibrary.find((exercise) => (
    [exercise.name, ...(exercise.aliases ?? [])].some((candidate) => normalizeText(candidate) === normalized)
  ))
  if (exact) return exact

  if (normalized.length < 4) return null
  return exerciseLibrary.find((exercise) => (
    [exercise.name, ...(exercise.aliases ?? [])].some((candidate) => {
      const normalizedCandidate = normalizeText(candidate)
      return normalizedCandidate.includes(normalized) || normalized.includes(normalizedCandidate)
    })
  )) ?? null
}

function createExerciseDraft(name = '', overrides = {}) {
  const profile = findExerciseProfile(name)
  return {
    name,
    sets: '3',
    reps: '10',
    load: '',
    rest: '60s',
    muscleGroup: profile?.group ?? '',
    equipment: profile?.equipment ?? '',
    instructions: profile?.cues ?? '',
    videoUrl: '',
    videoFile: null,
    videoFileName: '',
    ...overrides,
  }
}

function enrichExercise(exercise) {
  const profile = findExerciseProfile(exercise.name)
  return {
    ...exercise,
    muscleGroup: exercise.muscleGroup || profile?.group || '',
    equipment: exercise.equipment || profile?.equipment || '',
    instructions: exercise.instructions || profile?.cues || '',
    videoUrl: exercise.videoUrl || '',
    videoFile: exercise.videoFile || null,
    videoFileName: exercise.videoFileName || '',
  }
}

function safeExternalUrl(value) {
  if (!value?.trim()) return ''
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function getExerciseVideoUrl(exercise) {
  const customUrl = safeExternalUrl(exercise.videoUrl)
  if (customUrl) return customUrl
  const query = `${exercise.name || 'exercício de musculação'} execução correta técnica`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

function getVideoEmbedUrl(value) {
  const safeValue = safeExternalUrl(value)
  if (!safeValue) return ''
  try {
    const url = new URL(safeValue)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : ''
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
      return id && id !== 'results' ? `https://www.youtube-nocookie.com/embed/${id}` : ''
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : ''
    }
  } catch {
    return ''
  }
  return ''
}

function isDirectVideoUrl(value) {
  const safeValue = safeExternalUrl(value)
  if (!safeValue) return false
  try {
    const url = new URL(safeValue)
    return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname) || url.pathname.includes('/storage/v1/object/public/workout-videos/')
  } catch {
    return false
  }
}

function ExerciseMetric({ label, value }) {
  return (
    <div className="min-w-[68px] rounded border border-white/10 bg-white/[0.035] p-2">
      <p className="text-[10px] font-bold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-black text-zinc-200">{value}</p>
    </div>
  )
}

function ExerciseMedia({ exercise, compact = false }) {
  const videoUrl = safeExternalUrl(exercise.videoUrl)
  const embedUrl = getVideoEmbedUrl(exercise.videoUrl)
  const hasCustomVideo = Boolean(videoUrl)

  if (videoUrl && isDirectVideoUrl(videoUrl) && !compact) {
    return (
      <div className="overflow-hidden rounded-md border border-emerald-300/20 bg-black">
        <video
          src={videoUrl}
          controls
          preload="metadata"
          playsInline
          className="aspect-video h-full w-full bg-black object-contain"
        />
      </div>
    )
  }

  if (embedUrl && !compact) {
    return (
      <details className="overflow-hidden rounded-md border border-emerald-300/20 bg-emerald-400/[0.06]">
        <summary className="cursor-pointer px-3 py-2 text-sm font-black text-emerald-200">Assistir vídeo de execução</summary>
        <div className="aspect-video border-t border-white/10 bg-black">
          <iframe
            src={embedUrl}
            title={`Execução de ${exercise.name}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </details>
    )
  }

  if (hasCustomVideo) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-center text-xs font-black text-emerald-100 ${compact ? 'w-full sm:w-fit' : 'w-full sm:w-auto'}`}
      >
        Abrir vídeo indicado pelo coach
      </a>
    )
  }

  return (
    <a
      href={getExerciseVideoUrl(exercise)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-center text-xs font-black text-emerald-100 ${compact ? 'w-full sm:w-fit' : 'w-full sm:w-auto'}`}
    >
      Buscar vídeo de execução no YouTube
    </a>
  )
}

function WorkoutLogList({ logs }) {
  if (!logs.length) {
    return <Empty text="Nenhum treino concluído ainda." />
  }

  return (
    <div className="space-y-3">
      {logs.slice(0, 6).map((log) => (
        <div key={log.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-black">{log.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">
                {formatDateTime(log.completedAt)} {log.effort ? `| Esforço: ${log.effort}` : ''}
              </p>
              {log.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{log.notes}</p> : null}
            </div>
            <span className="rounded border border-blue-300/40 bg-blue-300/10 px-2 py-1 text-xs font-black text-blue-200">
              {log.offline ? 'Offline' : 'Feito'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompleteWorkoutForm({ student, workout, onCompleteWorkout }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onCompleteWorkout({
        coachId: workout.coachId,
        studentId: student.id,
        workoutId: workout.id,
        title: workout.title,
        effort: form.get('effort')?.toString() || 'Moderado',
        notes: form.get('notes')?.toString() || '',
      })
      setMessage('Treino concluído. +80 XP adicionados ao ranking de evolução.')
      formElement.reset()
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível concluir o treino.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-md border border-blue-300/20 bg-blue-300/5 p-4">
      <Select label="Esforço percebido" name="effort" defaultValue="Moderado" options={['Leve', 'Moderado', 'Forte', 'Muito forte']} />
      <TextArea label="Séries e cargas realizadas" name="setsLog" defaultValue="Ex.: supino 4x10 com 30 kg; remada 4x12 com 45 kg." />
      <TextArea label="Observação do treino" name="notes" defaultValue="Carga usada, dificuldade, dor, energia ou algo importante." />
      <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
        {saving ? 'Salvando...' : 'Marcar treino como concluído'}
      </button>
      {message ? <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p> : null}
      {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
    </form>
  )
}

function Nutrition({ selectedStudent, students, nutritionPlans, onSaveNutritionPlan, onArchiveNutritionPlan }) {
  const studentPlans = nutritionPlans.filter((plan) => (
    String(plan.studentId) === String(selectedStudent?.id) && plan.active !== false
  ))

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel title={`Prescrever dieta - ${selectedStudent?.name ?? 'Aluno'}`} action={`${foodDatabase.length}+ alimentos`}>
        {students.length ? (
          <NutritionForm students={students} selectedStudent={selectedStudent} onSaveNutritionPlan={onSaveNutritionPlan} />
        ) : (
          <Empty text="Cadastre um aluno antes de montar o primeiro plano alimentar." />
        )}
      </Panel>

      <Panel title="Dietas prescritas" action={`${studentPlans.length} ativas`}>
        <NutritionPlanList plans={studentPlans} selectedStudent={selectedStudent} onArchive={onArchiveNutritionPlan} />
      </Panel>
    </div>
  )
}

function NutritionForm({ students, selectedStudent, onSaveNutritionPlan }) {
  const [meals, setMeals] = useState([
    { name: 'Café da manhã', time: '07:00', items: [{ category: 'Ovos', foodName: 'Ovo Inteiro', grams: 100 }] },
    { name: 'Almoço', time: '12:30', items: [{ category: 'Carboidratos', foodName: 'Arroz Branco', grams: 200 }, { category: 'Carnes', foodName: 'Peito de Frango', grams: 180 }] },
    { name: 'Jantar', time: '20:00', items: [{ category: 'Carboidratos', foodName: 'Batata Doce', grams: 250 }, { category: 'Carnes', foodName: 'Peito de Frango', grams: 160 }] },
  ])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const planTotals = sumMacros(meals.map(calculateMealMacros))

  function updateMeal(index, field, value) {
    setMeals((current) => current.map((meal, itemIndex) => (
      itemIndex === index ? { ...meal, [field]: value } : meal
    )))
  }

  function updateMealItem(mealIndex, itemIndex, field, value) {
    setMeals((current) => current.map((meal, currentMealIndex) => {
      if (currentMealIndex !== mealIndex) return meal

      const items = meal.items.map((item, currentItemIndex) => {
        if (currentItemIndex !== itemIndex) return item
        return normalizeNutritionItem({ ...item, [field]: field === 'grams' ? Number(value) : value }, field)
      })

      return { ...meal, items }
    }))
  }

  function replaceMealItem(mealIndex, itemIndex, nextItem) {
    setMeals((current) => current.map((meal, currentMealIndex) => {
      if (currentMealIndex !== mealIndex) return meal

      return {
        ...meal,
        items: meal.items.map((item, currentItemIndex) => (
          currentItemIndex === itemIndex ? nextItem : item
        )),
      }
    }))
  }

  function addMeal() {
    setMeals((current) => [...current, { name: 'Nova refeição', time: '', items: [{ category: 'Carboidratos', foodName: 'Arroz Branco', grams: 100 }] }])
  }

  function removeMeal(index) {
    setMeals((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function addMealItem(mealIndex) {
    setMeals((current) => current.map((meal, index) => (
      index === mealIndex
        ? { ...meal, items: [...meal.items, { category: 'Carboidratos', foodName: 'Arroz Branco', grams: 100 }] }
        : meal
    )))
  }

  function removeMealItem(mealIndex, itemIndex) {
    setMeals((current) => current.map((meal, index) => (
      index === mealIndex ? { ...meal, items: meal.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex) } : meal
    )))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const filledMeals = meals
      .filter((meal) => meal.name.trim())
      .map((meal) => {
        const totals = calculateMealMacros(meal)
        return {
          name: meal.name,
          time: meal.time,
          foods: meal.items
            .filter((item) => item.foodName && Number(item.grams) > 0)
            .map((item) => {
              const alternatives = getEquivalentSubstitutions(item)
              const suffix = alternatives.length
                ? ` | Substituições: ${alternatives.map((option) => `${option.name} (${option.grams}g)`).join(' ou ')}`
                : ''
              return `${item.foodName} (${item.grams}g)${suffix}`
            })
            .join(', '),
          macros: formatMacroSummary(totals),
        }
      })

    setSaving(true)
    setMessage('')
    setError('')
    try {
      if (!filledMeals.length) throw new Error('Adicione pelo menos uma refeição com alimentos e quantidades válidas.')
      await onSaveNutritionPlan({
        studentId: form.get('studentId')?.toString() || '',
        title: form.get('title')?.toString() || 'Plano alimentar',
        calories: `${Math.round(planTotals.calories)} kcal`,
        protein: `${roundMacro(planTotals.protein)} g`,
        notes: form.get('notes')?.toString() || '',
        meals: filledMeals,
      })
      setMessage('Dieta salva com macros calculados automaticamente.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar a dieta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
        <p className="font-black text-blue-100">Assistente inteligente de alimentos</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">
          Digite o alimento e a quantidade. O Coach Fit Pro procura na biblioteca, reconhece nomes semelhantes e preenche kcal, proteína, carboidratos, gordura, fibra e sódio automaticamente.
        </p>
      </div>
      <Select
        label="Aluno"
        name="studentId"
        defaultValue={selectedStudent?.id}
        options={students.map((student) => ({ label: student.name, value: student.id }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nome da dieta" name="title" defaultValue="Plano base" />
        <Info label="Calorias calculadas" value={`${Math.round(planTotals.calories)} kcal`} />
        <Info label="Proteína calculada" value={`${roundMacro(planTotals.protein)} g`} />
      </div>
      <MacroSummaryGrid totals={planTotals} />
      <TextArea label="Observações" name="notes" defaultValue="Manter água e fibras. Reportar fome, sono e digestão no check-in." />

      <div className="space-y-4">
        {meals.map((meal, mealIndex) => {
          const mealTotals = calculateMealMacros(meal)

          return (
            <div key={mealIndex} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <InlineInput label="Refeição" value={meal.name} onChange={(value) => updateMeal(mealIndex, 'name', value)} />
                <InlineInput label="Horário" value={meal.time} onChange={(value) => updateMeal(mealIndex, 'time', value)} />
                <button type="button" onClick={() => removeMeal(mealIndex)} className="self-end rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-100">
                  Remover refeição
                </button>
              </div>

              <div className="mt-4">
                <MacroSummaryGrid totals={mealTotals} compact />
              </div>

              <div className="mt-4 space-y-3">
                {meal.items.map((item, itemIndex) => {
                  const itemTotals = calculateFoodItemMacros(item)

                  return (
                    <NutritionFoodItem
                      key={itemIndex}
                      item={item}
                      totals={itemTotals}
                      onChange={(nextItem) => replaceMealItem(mealIndex, itemIndex, nextItem)}
                      onRemove={() => removeMealItem(mealIndex, itemIndex)}
                    />
                  )
                })}
              </div>

              <button type="button" onClick={() => addMealItem(mealIndex)} className="mt-4 rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
                Adicionar alimento
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addMeal} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
          Adicionar refeição
        </button>
        <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar dieta'}
        </button>
      </div>
      {message ? (
        <p className="rounded-md border border-blue-300/30 bg-blue-300/10 p-3 text-sm font-bold text-blue-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">
          {error}
        </p>
      ) : null}
    </form>
  )
}

function NutritionPlanList({ plans, selectedStudent, onArchive }) {
  const [archivingId, setArchivingId] = useState('')

  async function handleArchive(plan) {
    if (!window.confirm(`Arquivar a dieta “${plan.title}”? Ela deixará de aparecer para o aluno.`)) return
    setArchivingId(String(plan.id))
    try {
      await onArchive(plan.id)
    } finally {
      setArchivingId('')
    }
  }

  if (!plans.length) {
    return (
      <div className="space-y-3">
        <Empty text="Nenhuma dieta prescrita ainda. Salve o primeiro plano alimentar para este aluno." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Calorias da ficha" value={selectedStudent?.calories ?? '-'} />
          <Info label="Proteína da ficha" value={selectedStudent?.protein ?? '-'} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-black">{plan.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">{plan.calories} | {plan.protein}</p>
              {plan.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{plan.notes}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded border border-blue-300/40 bg-blue-300/10 px-2 py-1 text-xs font-black text-blue-200">
                Ativa
              </span>
              {onArchive ? (
                <button disabled={archivingId === String(plan.id)} type="button" onClick={() => handleArchive(plan)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 disabled:opacity-50">
                  {archivingId === String(plan.id) ? 'Arquivando...' : 'Arquivar'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {plan.meals.map((meal) => (
              <div key={meal.id ?? meal.name} className="rounded-md border border-white/10 bg-zinc-950/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h5 className="font-black">{meal.time ? `${meal.time} - ` : ''}{meal.name}</h5>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{meal.foods}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded border border-blue-300/30 bg-blue-300/10 px-2 py-1 text-xs font-black text-blue-200">
                    {meal.macros || 'Macros'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function NutritionFoodItem({ item, totals, onChange, onRemove }) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [searchEdited, setSearchEdited] = useState(false)
  const recognition = recognizeFood(item.foodName)
  const recognizedFood = item.mode === 'database' ? recognition.food : findExactFood(item.foodName)
  const manualMode = item.mode === 'manual'
  const estimatedFood = !recognizedFood ? estimateFoodMacros(item.foodName, item.category) : null
  const foodSuggestions = getFoodSuggestions(searchEdited ? item.foodName : '', item.category)
  const substitutions = getEquivalentSubstitutions(item)
  const intelligence = recognizedFood
    ? { label: recognition.matchType === 'exact' ? 'Encontrado na base' : 'Reconhecido por nome semelhante', confidence: recognition.confidence }
    : { label: estimatedFood?._source === 'rule' ? 'Estimativa inteligente' : 'Estimativa pela categoria', confidence: estimatedFood?._confidence ?? 0.45 }

  function setFoodName(value) {
    const recognized = findExactFood(value)
    const estimate = recognized ? null : estimateFoodMacros(value, item.category)
    setSearchEdited(true)
    setSuggestionsOpen(true)
    onChange({
      ...item,
      foodName: value,
      category: recognized?.category ?? estimate?.category ?? item.category,
      mode: recognized ? 'database' : 'estimated',
      customMacros: recognized ? undefined : estimate ?? item.customMacros ?? emptyMacros(),
    })
  }

  function selectFood(food) {
    onChange({
      ...item,
      foodName: food.name,
      category: food.category,
      mode: 'database',
      customMacros: undefined,
    })
    setSearchEdited(false)
    setSuggestionsOpen(false)
  }

  function applyEstimate() {
    const estimate = estimateFoodMacros(item.foodName, item.category)
    onChange({
      ...item,
      mode: 'estimated',
      category: estimate.category ?? item.category,
      customMacros: estimate,
    })
  }

  function setManualMacro(field, value) {
    onChange({
      ...item,
      mode: 'manual',
      customMacros: {
        ...(item.customMacros ?? emptyMacros()),
        [field]: Number(value) || 0,
      },
    })
  }

  return (
    <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_1.1fr_0.45fr_auto]">
        <InlineSelect
          label="Tipo"
          value={item.category}
          options={foodCategories}
          onChange={(value) => {
            const firstFood = getFoodSuggestions('', value)[0]
            onChange({ ...item, category: value, foodName: firstFood?.name ?? '', mode: firstFood ? 'database' : 'estimated', customMacros: undefined })
            setSearchEdited(false)
            setSuggestionsOpen(true)
          }}
        />
        <label className="relative grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
          Alimento
          <input
            value={item.foodName}
            onChange={(event) => setFoodName(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.select()
              setSearchEdited(false)
              setSuggestionsOpen(true)
            }}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            placeholder="Ex.: tilápia grelhada, aveia ou feijoada"
            autoComplete="off"
            className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
          />
          {suggestionsOpen ? (
            <div className="scrollbar-soft max-h-72 overflow-y-auto rounded-md border border-white/10 bg-zinc-900 p-1 normal-case tracking-normal shadow-2xl">
              <p className="px-3 py-2 text-xs font-bold text-blue-300">
                {searchEdited && item.foodName.trim() ? 'Resultados da busca' : `Mais usados em ${item.category}`}
              </p>
              {foodSuggestions.length ? foodSuggestions.map((food) => (
                <button
                  key={`${food.category}-${food.name}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectFood(food)}
                  className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-white/[0.06]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zinc-100">{food.name}</span>
                    <span className="block text-xs text-zinc-500">{food.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-black text-blue-200">{Math.round(food.calories)} kcal</span>
                </button>
              )) : (
                <div className="px-3 py-3">
                  <p className="text-sm font-bold text-amber-200">Alimento novo</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">Continue digitando livremente. Os macros serão estimados e poderão ser ajustados abaixo.</p>
                </div>
              )}
            </div>
          ) : null}
        </label>
        <InlineInput label="Gramas" value={item.grams} onChange={(value) => onChange({ ...item, grams: Number(value) || 0 })} />
        <button type="button" onClick={onRemove} className="self-end rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-100">
          Remover
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-md border border-blue-300/20 bg-blue-300/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
            {manualMode ? 'Ajustado manualmente' : intelligence.label}
          </p>
          <p className="mt-1 text-sm font-black text-blue-50">
            {Math.round(totals.calories)} kcal | P {roundMacro(totals.protein)}g | C {roundMacro(totals.carbs)}g | G {roundMacro(totals.fat)}g
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Valores para {Number(item.grams) || 0}g · confiança {Math.round(intelligence.confidence * 100)}%
            {recognizedFood && normalizeText(recognizedFood.name) !== normalizeText(item.foodName) ? ` · referência: ${recognizedFood.name}` : ''}
          </p>
        </div>
        {estimatedFood && !recognizedFood ? (
          <button type="button" onClick={applyEstimate} className="rounded-md border border-amber-300/40 px-3 py-2 text-xs font-black text-amber-100">
            Atualizar estimativa
          </button>
        ) : null}
        {!recognizedFood ? (
          <span className="text-xs leading-5 text-amber-200">
            Alimento novo: revise a estimativa ou ajuste os valores por 100g.
          </span>
        ) : null}
      </div>

      {manualMode || !recognizedFood ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <InlineInput label="Kcal/100g" value={item.customMacros?.calories ?? 0} onChange={(value) => setManualMacro('calories', value)} />
          <InlineInput label="Prot/100g" value={item.customMacros?.protein ?? 0} onChange={(value) => setManualMacro('protein', value)} />
          <InlineInput label="Carbo/100g" value={item.customMacros?.carbs ?? 0} onChange={(value) => setManualMacro('carbs', value)} />
          <InlineInput label="Gord/100g" value={item.customMacros?.fat ?? 0} onChange={(value) => setManualMacro('fat', value)} />
          <InlineInput label="Fibra/100g" value={item.customMacros?.fiber ?? 0} onChange={(value) => setManualMacro('fiber', value)} />
          <InlineInput label="Sódio/100g" value={item.customMacros?.sodium ?? 0} onChange={(value) => setManualMacro('sodium', value)} />
        </div>
      ) : null}
      {recognizedFood && !manualMode ? (
        <button
          type="button"
          onClick={() => onChange({ ...item, mode: 'manual', customMacros: { ...recognizedFood } })}
          className="mt-3 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-300"
        >
          Ajustar macros manualmente
        </button>
      ) : null}
      <div className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-400/[0.06] p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">Substituições equivalentes</p>
          <span className="text-[11px] font-bold text-zinc-500">mantendo o plano próximo dos mesmos macros</span>
        </div>
        {substitutions.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {substitutions.map((option) => (
              <button
                key={`${option.name}-${option.grams}`}
                type="button"
                onClick={() => onChange({
                  ...item,
                  foodName: option.name,
                  category: option.category,
                  grams: option.grams,
                  mode: 'database',
                  customMacros: undefined,
                })}
                className="rounded-md border border-white/10 bg-zinc-950/60 p-3 text-left transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
              >
                <span className="block text-sm font-black text-zinc-100">{option.name}</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-400">
                  {option.grams}g | {Math.round(option.macros.calories)} kcal | P {roundMacro(option.macros.protein)}g | C {roundMacro(option.macros.carbs)}g | G {roundMacro(option.macros.fat)}g
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-zinc-500">Digite um alimento e quantidade para o app sugerir substituições.</p>
        )}
      </div>
    </div>
  )
}

function Checkins({ checkins, students, onAddCheckin }) {
  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Novo check-in" action="Upload local">
        {students.length ? (
          <CheckinForm students={students} onAddCheckin={onAddCheckin} />
        ) : (
          <Empty text="Cadastre um aluno antes de registrar check-ins." />
        )}
      </Panel>

      <Panel title="Histórico de check-ins" action={`${checkins.length} registros`}>
        {checkins.length ? (
          <div className="grid gap-3">
            {checkins.map((item) => {
              const student = students.find((studentItem) => studentItem.id === item.studentId)
              return (
                <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold">{student?.name ?? 'Aluno'}</h4>
                      <p className="mt-1 text-sm text-zinc-400">{item.type} - {item.due} - {item.weight}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{item.note}</p>
                    </div>
                    <Badge tone={item.state === 'Critico' ? 'Alto' : 'Baixo'}>{item.state}</Badge>
                  </div>
                  {item.photo ? <img src={item.photo} alt="Check-in" className="mt-4 h-44 w-full rounded-md object-cover" /> : null}
                </div>
              )
            })}
          </div>
        ) : (
          <Empty text="Nenhum check-in registrado ainda." />
        )}
      </Panel>
    </div>
  )
}
function StudentPortalPreview({
  student,
  students,
  checkins,
  workouts = [],
  nutritionPlans = [],
  workoutLogs = [],
  messages = [],
  appointments = [],
  invoices = [],
  assessments = [],
  coachSettings = null,
  onCompleteWorkout,
  onAddCheckin,
  onSendMessage,
  coachId,
  onRemoteStatus,
  onRemoteError,
  canGenerateInvite = true,
}) {
  const studentCheckins = checkins.filter((item) => String(item.studentId) === String(student?.id))
  const studentWorkouts = workouts.filter((workout) => (
    String(workout.studentId) === String(student?.id) && workout.active !== false
  ))
  const studentNutritionPlans = nutritionPlans.filter((plan) => (
    String(plan.studentId) === String(student?.id) && plan.active !== false
  ))
  const studentWorkoutLogs = workoutLogs.filter((log) => String(log.studentId) === String(student?.id))
  const studentMessages = messages.filter((message) => String(message.studentId) === String(student?.id))
  const studentAppointments = appointments
    .filter((appointment) => String(appointment.studentId) === String(student?.id))
    .filter((appointment) => !['Concluido', 'Cancelado'].includes(appointment.status))
    .slice()
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const studentInvoices = invoices
    .filter((invoice) => String(invoice.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
  const studentAssessments = assessments
    .filter((assessment) => String(assessment.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))
  const [invite, setInvite] = useState(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const inviteUrl = invite ? `${window.location.origin}${window.location.pathname}?invite=${invite.code}` : ''

  if (!student) {
    return <Empty text="Cadastre ou selecione um aluno para visualizar a área do aluno." />
  }

  async function generateInvite() {
    setCreatingInvite(true)
    try {
      const created = await createRemoteStudentInvite(student.id, coachId)
      setInvite(created)
      onRemoteStatus('Convite criado')
      onRemoteError('')
    } catch (error) {
      onRemoteStatus('Erro ao criar convite')
      onRemoteError(error.message)
    } finally {
      setCreatingInvite(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title={`Portal do aluno - ${student.name}`} action="Prévia do app">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="Objetivo" value={student.goal} />
          <Info label="Treino atual" value={student.workout} />
          <Info label="Próximo check-in" value={student.nextCheckin} />
        </div>

        <div className="mt-5 rounded-md border border-blue-300/30 bg-blue-300/10 p-4">
          <p className="text-sm font-black text-blue-200">{coachSettings?.publicName || 'Mensagem do coach'}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {coachSettings?.welcomeMessage || 'Mantenha o plano de hoje, registre seu treino e envie o check-in se notar mudanca relevante em peso, fome ou sono.'}
          </p>
        </div>

        {canGenerateInvite ? (
          <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-black">Convite do aluno</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Gere um código para o aluno acessar a área dele pela tela inicial.
                </p>
              </div>
              <button onClick={generateInvite} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
                {creatingInvite ? 'Gerando...' : 'Gerar convite'}
              </button>
            </div>
            {invite ? (
              <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Código de acesso</p>
                <p className="mt-2 select-all text-2xl font-black text-amber-100">{invite.code}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Link direto</p>
                <p className="mt-2 select-all break-all rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-100">
                  {inviteUrl}
                </p>
                <p className="mt-2 text-sm text-zinc-300">Envie o link ou o código para o aluno.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Enviar check-in" action="Aluno">
        <CheckinForm students={[student]} onAddCheckin={onAddCheckin} />
      </Panel>

      <Panel title="Mensagens" action={`${studentMessages.length} registros`}>
        <StudentMessagePanel
          student={student}
          coachId={coachId}
          messages={studentMessages}
          onSendMessage={onSendMessage}
        />
      </Panel>

      <Panel title="Próximos compromissos" action={`${studentAppointments.length} agendados`}>
        <div className="grid gap-3">
          {studentAppointments.length ? (
            studentAppointments.slice(0, 4).map((appointment) => (
              <div key={appointment.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black">{appointment.title}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{appointment.type} - {appointment.durationMinutes} min</p>
                    <p className="mt-2 text-sm font-bold text-blue-200">{formatFullDateTime(appointment.startsAt)}</p>
                    <p className="mt-1 text-sm text-zinc-400">{appointment.location || 'Local a confirmar'}</p>
                  </div>
                  <Badge tone={appointment.status === 'Agendado' ? 'Medio' : 'Baixo'}>{appointment.status}</Badge>
                </div>
              </div>
            ))
          ) : (
            <Empty text="Nenhum compromisso futuro agendado." />
          )}
        </div>
      </Panel>

      <Panel title="Financeiro" action={`${studentInvoices.length} cobranças`}>
        <div className="grid gap-3">
          {studentInvoices.length ? (
            studentInvoices.slice(0, 4).map((invoice) => (
              <div key={invoice.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black">{invoice.planName}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{invoice.description || 'Mensalidade do acompanhamento'}</p>
                    <p className="mt-2 text-lg font-black text-blue-200">{formatCurrency(invoice.amount)}</p>
                    <p className="mt-1 text-sm text-zinc-400">Vencimento: {formatDate(invoice.dueDate)}</p>
                  </div>
                  <InvoiceStatus status={invoice.status} />
                </div>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma cobrança registrada." />
          )}
        </div>
      </Panel>

      <Panel title="Treino de hoje" action={studentWorkouts[0]?.title ?? student.workout}>
        {studentWorkouts.length ? (
          <>
            <WorkoutList workouts={studentWorkouts.slice(0, 2)} fallbackTitle={student.workout} />
            {onCompleteWorkout ? (
              <CompleteWorkoutForm student={student} workout={studentWorkouts[0]} onCompleteWorkout={onCompleteWorkout} />
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            {workoutPlan.slice(0, 3).map((item) => (
              <div key={item.day} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black">{item.focus}</h4>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{item.items}</p>
                  </div>
                  <button className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-100">
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Dieta de hoje" action={student.calories}>
        {studentNutritionPlans.length ? (
          <NutritionPlanList plans={studentNutritionPlans.slice(0, 1)} selectedStudent={student} />
        ) : (
          <div className="space-y-3">
            {mealPlan.slice(0, 4).map((item) => (
              <Row key={item.meal} title={item.meal} meta={item.foods} badge={item.macros} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Progresso" action={`${studentCheckins.length} check-ins`}>
        <AssessmentProgress assessments={studentAssessments} student={student} checkins={studentCheckins} />
      </Panel>

      <Panel title="Treinos concluídos" action={`${studentWorkoutLogs.length} registros`}>
        <WorkoutLogList logs={studentWorkoutLogs} />
      </Panel>

      <Panel title="Histórico enviado" action="Últimos registros">
        <div className="space-y-3">
          {studentCheckins.length ? (
            studentCheckins.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <h4 className="font-bold">{item.type}</h4>
                <p className="mt-1 text-sm text-zinc-400">{item.due} - {item.weight}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{item.note}</p>
                {item.photo ? <img src={item.photo} alt="Check-in" className="mt-4 h-36 w-full rounded-md object-cover" /> : null}
              </div>
            ))
          ) : (
            <Empty text="Este aluno ainda não enviou check-ins." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function StudentMessagePanel({ student, coachId, messages, onSendMessage, fullScreen = false }) {
  const [draft, setDraft] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const orderedMessages = messages
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))
  const latestMessageId = orderedMessages.at(-1)?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [latestMessageId])

  useEffect(() => () => {
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
  }, [attachmentPreview])

  function handleAttachment(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isAudio = file.type.startsWith('audio/')
    if (!isImage && !isAudio) {
      setError('Selecione uma imagem ou áudio válido.')
      event.target.value = ''
      return
    }
    const maxSize = isAudio ? 20 * 1024 * 1024 : 8 * 1024 * 1024
    if (file.size > maxSize) {
      setError(isAudio ? 'O áudio deve ter no máximo 20 MB.' : 'A foto deve ter no máximo 8 MB.')
      event.target.value = ''
      return
    }
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
    setError('')
    setAttachmentFile(file)
    setAttachmentPreview(URL.createObjectURL(file))
  }

  function clearAttachment() {
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
    setAttachmentFile(null)
    setAttachmentPreview('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const body = draft.trim()
    if ((!body && !attachmentFile) || !onSendMessage) return

    setSending(true)
    setError('')
    try {
      await onSendMessage({
        coachId,
        studentId: student.id,
        sender: 'student',
        body,
        attachmentFile,
        attachmentPreview,
      })
      setDraft('')
      clearAttachment()
    } catch (sendError) {
      setError(sendError?.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={fullScreen ? 'flex h-full min-h-[calc(100vh-250px)] flex-col' : ''}>
      <div className={`${fullScreen ? 'min-h-0 flex-1' : 'max-h-72'} space-y-3 overflow-y-auto pr-1`}>
        {orderedMessages.length ? (
          orderedMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md border p-4 ${
                message.sender === 'student'
                  ? 'ml-auto max-w-[92%] border-blue-300/30 bg-blue-300/10'
                  : 'mr-auto max-w-[92%] border-white/10 bg-white/[0.04]'
              }`}
            >
              <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{message.sender === 'student' ? 'Você' : 'Coach'}</p>
              {message.body ? <p className="mt-2 text-sm leading-6 text-zinc-200">{message.body}</p> : null}
              <MessageAttachment message={message} />
              <p className="mt-2 text-xs text-zinc-500">{formatDateTime(message.createdAt)}</p>
            </div>
          ))
        ) : (
          <Empty text="Nenhuma mensagem ainda." />
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className={`${fullScreen ? 'sticky bottom-0 mt-3 border-t border-white/10 bg-zinc-950/95 pt-3' : 'mt-4'} grid gap-3`}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={fullScreen ? 2 : 3}
          placeholder="Responder ao coach..."
          className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
        />
        {attachmentPreview ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start gap-3">
              {attachmentFile?.type?.startsWith('audio/') ? (
                <audio controls src={attachmentPreview} className="w-full max-w-xs" />
              ) : (
                <img src={attachmentPreview} alt="Prévia da foto" className="h-20 w-20 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-zinc-200">{attachmentFile?.name || 'Anexo selecionado'}</p>
                <button type="button" onClick={clearAttachment} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200">
                  Remover anexo
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
            Foto/áudio
            <input type="file" accept="image/*,audio/*" onChange={handleAttachment} className="hidden" />
          </label>
          <AudioRecorderButton
            onAudio={(file) => {
              if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
              setAttachmentFile(file)
              setAttachmentPreview(URL.createObjectURL(file))
              setError('')
            }}
            onError={setError}
          />
          <button disabled={sending || (!draft.trim() && !attachmentFile)} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Enviando...' : 'Enviar resposta'}
          </button>
        </div>
        {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
      </form>
    </div>
  )
}

function MessageAttachment({ message }) {
  if (!message?.attachmentUrl) return null

  const isImage = (message.attachmentType || '').startsWith('image/')
    || /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(message.attachmentUrl)
  const isAudio = (message.attachmentType || '').startsWith('audio/')
    || /\.(mp3|m4a|aac|ogg|wav|webm)(\?.*)?$/i.test(message.attachmentUrl)

  if (isAudio) {
    return (
      <div className="mt-3 rounded-md border border-white/10 bg-zinc-950/60 p-3">
        <audio controls src={message.attachmentUrl} className="w-full" />
        {message.attachmentName ? <p className="mt-2 break-words text-xs text-zinc-500">{message.attachmentName}</p> : null}
      </div>
    )
  }

  if (!isImage) {
    return (
      <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all rounded-md border border-white/10 bg-zinc-950/60 p-3 text-sm font-bold text-blue-200">
        {message.attachmentName || 'Abrir anexo'}
      </a>
    )
  }

  return (
    <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-md border border-white/10 bg-zinc-950/60">
      <img src={message.attachmentUrl} alt={message.attachmentName || 'Foto enviada na conversa'} className="max-h-80 w-full object-cover" loading="lazy" />
    </a>
  )
}

function AudioRecorderButton({ onAudio, onError }) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => () => {
    recorderRef.current?.stop?.()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError?.('Seu navegador não liberou gravação de áudio. Anexe um arquivo de áudio pelo botão Foto/áudio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const file = new File([blob], `audio-fitcoach-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
        onAudio?.(file)
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      recorderRef.current = recorder
      streamRef.current = stream
      recorder.start()
      setRecording(true)
      onError?.('')
    } catch {
      onError?.('Não foi possível acessar o microfone. Confira a permissão do navegador.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return (
    <button type="button" onClick={recording ? stopRecording : startRecording} className={`min-h-11 rounded-md border px-4 py-3 text-sm font-black ${recording ? 'border-rose-300/40 bg-rose-300/10 text-rose-100' : 'border-white/10 text-zinc-200'}`}>
      {recording ? 'Parar áudio' : 'Gravar áudio'}
    </button>
  )
}

function StudentConsent({ access, onAccept, onExit, error }) {
  const [accepting, setAccepting] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    try {
      await onAccept()
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
      <div className="w-full max-w-2xl rounded-md border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
        <BrandLockup subtitle={`por ${access.coachSettings?.brandName || access.coachSettings?.publicName || 'seu treinador'}`} />
        <div className="mt-7 h-px bg-white/10" />
        <h1 className="mt-2 text-3xl font-black">Consentimento de dados</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Olá, {access.student.name}. Antes de acessar seu acompanhamento, precisamos registrar sua autorização.
        </p>

        <div className="mt-6 grid gap-3">
          {[
            'Dados de cadastro, treinos, dieta e comunicação.',
            'Peso, medidas corporais, fotos e informações de saúde fornecidas por você.',
            'Uso dos dados exclusivamente para acompanhamento pelo seu treinador.',
            'Possibilidade de solicitar correção ou exclusão dos seus dados ao treinador.',
          ].map((text) => (
            <div key={text} className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-300">
              {text}
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Ao continuar, você confirma que leu e aceita o tratamento dessas informações para a prestação do acompanhamento contratado.
        </p>
        {error ? <p className="mt-4 text-sm font-bold text-amber-200">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button disabled={accepting} onClick={handleAccept} className="flex-1 rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
            {accepting ? 'Registrando...' : 'Aceitar e continuar'}
          </button>
          <button onClick={onExit} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}

function StudentAnamnesis({ access, onSubmit, onExit, error }) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    const form = new FormData(event.currentTarget)

    try {
      await onSubmit({
        birthDate: form.get('birthDate')?.toString() || '',
        occupation: form.get('occupation')?.toString() || '',
        trainingExperience: form.get('trainingExperience')?.toString() || '',
        trainingFrequency: form.get('trainingFrequency')?.toString() || '',
        primaryGoal: form.get('primaryGoal')?.toString() || '',
        injuries: form.get('injuries')?.toString() || '',
        healthConditions: form.get('healthConditions')?.toString() || '',
        medications: form.get('medications')?.toString() || '',
        surgeries: form.get('surgeries')?.toString() || '',
        pain: form.get('pain')?.toString() || '',
        sleepHours: form.get('sleepHours')?.toString() || '',
        sleepQuality: form.get('sleepQuality')?.toString() || '',
        stressLevel: form.get('stressLevel')?.toString() || '',
        waterIntake: form.get('waterIntake')?.toString() || '',
        foodRestrictions: form.get('foodRestrictions')?.toString() || '',
        routine: form.get('routine')?.toString() || '',
        observations: form.get('observations')?.toString() || '',
        emergencyContact: form.get('emergencyContact')?.toString() || '',
      })
    } catch {
      // The parent displays the Supabase error without leaving an unhandled promise.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell fit-gradient-bg min-h-screen p-3 text-zinc-100 sm:p-6">
      <form onSubmit={handleSubmit} className="mx-auto grid max-w-4xl gap-5 rounded-md border border-white/10 bg-zinc-950/85 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-300">Primeiro acesso</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Anamnese de {access.student.name}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Estas informações serão enviadas com segurança ao seu coach para personalizar treino e alimentação.</p>
          </div>
          <BrandLockup subtitle="Coach Fit Pro" />
        </div>

        <section className="grid gap-4">
          <h2 className="font-black text-blue-200">Perfil e objetivo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de nascimento" name="birthDate" type="date" />
            <Field label="Profissão" name="occupation" />
            <Select label="Experiência com treino" name="trainingExperience" defaultValue="Iniciante" options={['Nunca treinei', 'Iniciante', 'Intermediário', 'Avançado']} />
            <Select label="Frequência disponível" name="trainingFrequency" defaultValue="3 vezes por semana" options={['1 vez por semana', '2 vezes por semana', '3 vezes por semana', '4 vezes por semana', '5 vezes por semana', '6 ou mais vezes']} />
          </div>
          <TextArea label="Objetivo principal e resultado esperado" name="primaryGoal" defaultValue="" />
        </section>

        <section className="grid gap-4 border-t border-white/10 pt-5">
          <h2 className="font-black text-red-200">Saúde e segurança</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea label="Lesões atuais ou anteriores" name="injuries" defaultValue="Nenhuma" />
            <TextArea label="Doenças ou condições de saúde" name="healthConditions" defaultValue="Nenhuma" />
            <TextArea label="Medicamentos em uso" name="medications" defaultValue="Nenhum" />
            <TextArea label="Cirurgias realizadas" name="surgeries" defaultValue="Nenhuma" />
          </div>
          <TextArea label="Dores, limitações ou exercícios que causam desconforto" name="pain" defaultValue="Nenhuma" />
          <Field label="Contato de emergência" name="emergencyContact" />
        </section>

        <section className="grid gap-4 border-t border-white/10 pt-5">
          <h2 className="font-black text-emerald-200">Rotina e hábitos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Horas de sono" name="sleepHours" />
            <Select label="Qualidade do sono" name="sleepQuality" defaultValue="Regular" options={['Ruim', 'Regular', 'Boa', 'Excelente']} />
            <Select label="Nível de estresse" name="stressLevel" defaultValue="Moderado" options={['Baixo', 'Moderado', 'Alto', 'Muito alto']} />
            <Field label="Água por dia" name="waterIntake" defaultValue="2 litros" />
          </div>
          <TextArea label="Restrições, alergias ou preferências alimentares" name="foodRestrictions" defaultValue="Nenhuma" />
          <TextArea label="Como é sua rotina diária?" name="routine" defaultValue="" />
          <TextArea label="Outras informações importantes" name="observations" defaultValue="" />
        </section>

        {error ? <p className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm font-bold text-red-100">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button disabled={saving} className="flex-1 rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
            {saving ? 'Enviando anamnese...' : 'Enviar anamnese ao coach'}
          </button>
          <button type="button" onClick={onExit} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">Sair</button>
        </div>
      </form>
    </div>
  )
}

function ProfessionalAnamnesisSummary({ anamnesis, student }) {
  if (!anamnesis) {
    if (student?.requireAnamnesis === false) {
      return (
        <div className="rounded-lg border border-blue-300/30 bg-blue-300/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-blue-100">Aluno transferido</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">Anamnese dispensada pelo coach. Use avaliações, histórico de treino e evolução atual para continuar o acompanhamento.</p>
            </div>
            <Badge tone="Baixo">Liberado</Badge>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
        <p className="font-black text-amber-100">Anamnese pendente</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">O aluno preencherá a anamnese no primeiro acesso. Até lá, mantenha treino, carga e dieta em uma abordagem conservadora.</p>
      </div>
    )
  }

  const riskFlags = [
    hasUsefulAnamnesisValue(anamnesis.injuries) ? 'Lesões relatadas' : '',
    hasUsefulAnamnesisValue(anamnesis.pain) ? 'Dor ou limitação' : '',
    hasUsefulAnamnesisValue(anamnesis.healthConditions) ? 'Condição de saúde' : '',
    hasUsefulAnamnesisValue(anamnesis.medications) ? 'Medicamento em uso' : '',
    ['Alto', 'Muito alto'].includes(anamnesis.stressLevel) ? 'Estresse elevado' : '',
    ['Ruim', 'Regular'].includes(anamnesis.sleepQuality) ? 'Sono exige atenção' : '',
  ].filter(Boolean)
  const readinessScore = Math.max(0, 100 - riskFlags.length * 12)
  const sections = [
    {
      title: 'Perfil e objetivo',
      tone: 'blue',
      items: [
        ['Objetivo principal', anamnesis.primaryGoal],
        ['Profissão / rotina de trabalho', anamnesis.occupation],
        ['Experiência com treino', anamnesis.trainingExperience],
        ['Frequência disponível', anamnesis.trainingFrequency],
      ],
    },
    {
      title: 'Saúde e segurança',
      tone: riskFlags.length ? 'rose' : 'emerald',
      items: [
        ['Lesões atuais ou anteriores', anamnesis.injuries || 'Nenhuma relatada'],
        ['Dores ou limitações', anamnesis.pain || 'Nenhuma relatada'],
        ['Condições de saúde', anamnesis.healthConditions || 'Nenhuma relatada'],
        ['Medicamentos', anamnesis.medications || 'Nenhum relatado'],
        ['Cirurgias', anamnesis.surgeries || 'Nenhuma relatada'],
        ['Contato de emergência', anamnesis.emergencyContact || 'Não informado'],
      ],
    },
    {
      title: 'Sono, estresse e hidratação',
      tone: 'sky',
      items: [
        ['Horas de sono', anamnesis.sleepHours],
        ['Qualidade do sono', anamnesis.sleepQuality],
        ['Nível de estresse', anamnesis.stressLevel],
        ['Água por dia', anamnesis.waterIntake],
      ],
    },
    {
      title: 'Nutrição e rotina',
      tone: 'orange',
      items: [
        ['Restrições, alergias ou preferências', anamnesis.foodRestrictions || 'Nenhuma relatada'],
        ['Rotina diária', anamnesis.routine],
        ['Observações importantes', anamnesis.observations || 'Sem observações adicionais'],
      ],
    },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-300/30 bg-zinc-950/74 shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 bg-emerald-300/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">Anamnese profissional</p>
            <h4 className="mt-1 text-xl font-black text-white">Mapa inicial de {student?.name || 'aluno'}</h4>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Recebida em {formatDateTime(anamnesis.submittedAt)}.</p>
          </div>
          <Badge tone="Baixo">Completa</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <AnamnesisStat label="Prontidão" value={`${readinessScore}%`} tone={readinessScore >= 80 ? 'emerald' : readinessScore >= 55 ? 'amber' : 'rose'} />
          <AnamnesisStat label="Pontos de atenção" value={riskFlags.length || '0'} tone={riskFlags.length ? 'amber' : 'emerald'} />
          <AnamnesisStat label="Frequência" value={anamnesis.trainingFrequency || '-'} tone="blue" />
        </div>
      </div>

      <div className="grid gap-4 p-4">
        {riskFlags.length ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="text-xs font-black uppercase text-amber-200">Revisar antes de prescrever</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {riskFlags.map((flag) => (
                <span key={flag} className="rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-100">{flag}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">Sem alerta crítico informado</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">Ainda assim, confirme execução, dor e tolerância de carga nos primeiros treinos.</p>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {sections.map((section) => <AnamnesisSection key={section.title} {...section} />)}
        </div>
      </div>
    </div>
  )
}

function hasUsefulAnamnesisValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return Boolean(normalized && !['-', 'nao', 'não', 'nenhum', 'nenhuma', 'n/a'].includes(normalized))
}

function AnamnesisStat({ label, value, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-100',
    blue: 'border-blue-300/25 bg-blue-300/10 text-blue-100',
  }

  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.emerald}`}>
      <p className="text-[10px] font-black uppercase opacity-80">{label}</p>
      <p className="mt-1 break-words text-lg font-black">{value}</p>
    </div>
  )
}

function AnamnesisSection({ title, tone = 'emerald', items = [] }) {
  const tones = {
    emerald: 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200',
    blue: 'border-blue-300/20 bg-blue-300/5 text-blue-200',
    sky: 'border-sky-300/20 bg-sky-300/5 text-sky-200',
    orange: 'border-orange-300/20 bg-orange-300/5 text-orange-200',
    rose: 'border-rose-300/20 bg-rose-300/5 text-rose-200',
  }

  return (
    <div className={`rounded-lg border p-4 ${tones[tone] || tones.emerald}`}>
      <h5 className="text-sm font-black">{title}</h5>
      <div className="mt-3 grid gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-zinc-950/55 p-3">
            <p className="text-[10px] font-black uppercase text-zinc-500">{label}</p>
            <p className="mt-1 text-sm leading-6 text-zinc-100">{value || 'Não informado'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentAnamnesisSummary({ anamnesis, student }) {
  if (!anamnesis) {
    if (student?.requireAnamnesis === false) {
      return (
        <div className="rounded-md border border-blue-300/30 bg-blue-300/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-blue-100">Aluno transferido</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">Anamnese dispensada pelo coach. O acompanhamento continua a partir dos dados atuais cadastrados.</p>
            </div>
            <Badge tone="Baixo">Liberado</Badge>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-4">
        <p className="font-black text-amber-100">Anamnese pendente</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">O aluno preencherá a anamnese no primeiro acesso após aceitar o consentimento.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-black text-emerald-100">Anamnese recebida</p>
          <p className="mt-1 text-xs text-zinc-400">{formatDateTime(anamnesis.submittedAt)}</p>
        </div>
        <Badge tone="Baixo">Completa</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label="Objetivo" value={anamnesis.primaryGoal || '-'} />
        <Info label="Experiência" value={`${anamnesis.trainingExperience || '-'} · ${anamnesis.trainingFrequency || '-'}`} />
        <Info label="Lesões e dores" value={[anamnesis.injuries, anamnesis.pain].filter(Boolean).join(' | ') || 'Nenhuma'} />
        <Info label="Condições e medicamentos" value={[anamnesis.healthConditions, anamnesis.medications].filter(Boolean).join(' | ') || 'Nenhum'} />
        <Info label="Sono e estresse" value={`${anamnesis.sleepHours || '-'} · sono ${anamnesis.sleepQuality || '-'} · estresse ${anamnesis.stressLevel || '-'}`} />
        <Info label="Alimentação" value={anamnesis.foodRestrictions || 'Nenhuma restrição'} />
      </div>
      <div className="mt-3 grid gap-3">
        <Row title="Rotina" meta={anamnesis.routine || 'Não informada'} badge={anamnesis.occupation || 'Aluno'} />
        <Row title="Observações" meta={anamnesis.observations || 'Sem observações adicionais'} badge="Relato" />
        <Row title="Contato de emergência" meta={anamnesis.emergencyContact || 'Não informado'} badge="Segurança" />
      </div>
    </div>
  )
}

function hasStudentAccess(student) {
  if (!student) return false
  if (student.payment === 'Pago') return true
  if (!student.accessOverrideUntil) return false
  const overrideUntil = new Date(student.accessOverrideUntil).getTime()
  return Number.isFinite(overrideUntil) && overrideUntil > Date.now()
}

function sendLocalNotification(title, body) {
  if (!('Notification' in window)) return
  const show = () => new Notification(title, { body, icon: '/fit-coach-icon.svg' })
  if (Notification.permission === 'granted') {
    show()
    return
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') show()
    })
  }
}

function StudentAccessApp({ access, checkins, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings, onCompleteWorkout, onAddCheckin, onSendMessage, onRefreshMessages, onExit }) {
  const student = access.student
  const freshCheckins = checkins.filter((item) => String(item.studentId) === String(student.id))
  const studentCheckins = mergeRecords(freshCheckins, access.checkins)
  const inviteCode = access.invite.code

  function addStudentCheckin(checkin) {
    return onAddCheckin({ ...checkin, inviteCode })
  }

  function completeStudentWorkout(log) {
    return onCompleteWorkout({ ...log, inviteCode })
  }

  function sendStudentMessage(message) {
    return onSendMessage({ ...message, inviteCode })
  }

  return (
    <StudentMobileApp
      student={student}
      checkins={studentCheckins}
      workouts={workouts}
      nutritionPlans={nutritionPlans}
      workoutLogs={workoutLogs}
      messages={messages}
      appointments={appointments}
      invoices={invoices}
      assessments={assessments}
      coachSettings={coachSettings}
      coachId={access.invite.coachId}
      onCompleteWorkout={completeStudentWorkout}
      onAddCheckin={addStudentCheckin}
      onSendMessage={sendStudentMessage}
      onRefreshMessages={onRefreshMessages}
      onExit={onExit}
    />
  )
}
function StudentMobileApp({ student, checkins, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings, coachId, onCompleteWorkout, onAddCheckin, onSendMessage, onRefreshMessages, onExit }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('inicio')
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null)
  const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState(0)
  const [workoutClock, setWorkoutClock] = useState(Date.now())
  const [installPrompt, setInstallPrompt] = useState(null)
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const [workoutStartNotified, setWorkoutStartNotified] = useState(false)
  const [feedbackPrompt, setFeedbackPrompt] = useState(null)
  const studentWorkouts = workouts.filter((workout) => String(workout.studentId) === String(student?.id) && workout.active !== false)
  const studentNutritionPlans = nutritionPlans.filter((plan) => String(plan.studentId) === String(student?.id) && plan.active !== false)
  const studentWorkoutLogs = workoutLogs.filter((log) => String(log.studentId) === String(student?.id))
  const studentMessages = messages.filter((message) => String(message.studentId) === String(student?.id))
  const studentAppointments = appointments
    .filter((appointment) => String(appointment.studentId) === String(student?.id))
    .filter((appointment) => !['Concluido', 'Cancelado'].includes(appointment.status))
    .slice()
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const studentAssessments = assessments
    .filter((assessment) => String(assessment.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))
  const studentInvoices = invoices
    .filter((invoice) => String(invoice.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
  const nextWorkout = studentWorkouts[0]
  const nextAppointment = studentAppointments[0]
  const temporaryAccessOpen = Boolean(student?.accessOverrideUntil && new Date(student.accessOverrideUntil).getTime() > Date.now())
  const financialAccessOpen = temporaryAccessOpen || hasStudentAccess(student)
  const restrictedTabs = ['treino', 'dieta', 'checkin', 'agenda', 'progresso', 'historico']
  const workoutSeconds = workoutElapsedSeconds + (workoutStartedAt ? Math.floor((workoutClock - workoutStartedAt) / 1000) : 0)
  const waterGoalMl = Math.max(500, Number(student?.waterGoalMl || 2500))
  const waterStorageDate = new Date().toLocaleDateString('sv-SE')
  const waterStorageKey = `fitcoach-water-${student?.id || 'aluno'}-${waterStorageDate}`
  const [waterMl, setWaterMl] = useState(0)
  const navItems = [
    { id: 'inicio', label: 'Início', icon: 'dashboard', tone: 'emerald' },
    { id: 'treino', label: 'Treino', icon: 'dumbbell', tone: 'lime' },
    { id: 'dieta', label: 'Dieta', icon: 'nutrition', tone: 'orange' },
    { id: 'checkin', label: 'Check-in', icon: 'camera', tone: 'rose' },
    { id: 'mensagens', label: 'Chat', icon: 'message', tone: 'blue' },
    { id: 'pagamentos', label: 'Fatura', icon: 'wallet', tone: 'green' },
    { id: 'agenda', label: 'Agenda', icon: 'calendar', tone: 'sky' },
    { id: 'progresso', label: 'Progresso', icon: 'chart', tone: 'amber' },
    { id: 'historico', label: 'Histórico', icon: 'dashboard', tone: 'slate' },
  ]
  const bottomNavItems = [
    navItems.find((item) => item.id === 'inicio'),
    navItems.find((item) => item.id === 'agenda'),
    navItems.find((item) => item.id === 'pagamentos'),
    navItems.find((item) => item.id === 'mensagens'),
  ].filter(Boolean)
  const activeTitle = navItems.find((item) => item.id === activeTab)?.label || 'Treino'
  const weekProgress = useMemo(() => buildStudentWeekProgress(studentWorkoutLogs), [studentWorkoutLogs])
  const completedThisWeek = weekProgress.filter((day) => day.completed).length
  const completedThisMonth = useMemo(() => countWorkoutLogsThisMonth(studentWorkoutLogs), [studentWorkoutLogs])
  const weeklyChallengeTarget = Math.max(3, Math.min(5, studentWorkouts.length || 4))
  const monthlyChallengeTarget = Math.max(12, weeklyChallengeTarget * 4)

  useEffect(() => {
    if (!workoutStartedAt) return undefined
    const timer = window.setInterval(() => setWorkoutClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [workoutStartedAt])

  useEffect(() => {
    const savedWater = Number(window.localStorage?.getItem(waterStorageKey) || 0)
    setWaterMl(Number.isFinite(savedWater) ? Math.min(savedWater, waterGoalMl) : 0)
  }, [waterStorageKey, waterGoalMl])

  useEffect(() => {
    window.localStorage?.setItem(waterStorageKey, String(Math.min(waterMl, waterGoalMl)))
  }, [waterMl, waterGoalMl, waterStorageKey])

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function handleInstalled() {
      setAppInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  function openTab(id) {
    setActiveTab(id)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addWater(amountMl) {
    setWaterMl((current) => Math.min(waterGoalMl, current + amountMl))
  }

  function resetWater() {
    setWaterMl(0)
  }

  function toggleWorkoutTimer() {
    if (workoutStartedAt) {
      setWorkoutElapsedSeconds((current) => current + Math.floor((Date.now() - workoutStartedAt) / 1000))
      setWorkoutStartedAt(null)
      return
    }
    setWorkoutStartedAt(Date.now())
    setWorkoutClock(Date.now())
    if (!workoutStartNotified) {
      setWorkoutStartNotified(true)
      sendLocalNotification('Treino iniciado', `${student.name} começou o treino.`)
      onSendMessage?.({
        studentId: student.id,
        sender: 'student',
        body: `${student.name} iniciou o treino${nextWorkout?.title ? `: ${nextWorkout.title}` : '.'}`,
      }).catch(() => {})
    }
  }

  async function completeWorkoutFromStudent(log) {
    const savedLog = await onCompleteWorkout(log)
    const completedCount = studentWorkoutLogs.length + 1
    sendLocalNotification('Treino finalizado', `${student.name} concluiu o treino.`)
    await onSendMessage?.({
      studentId: student.id,
      sender: 'student',
      body: `${student.name} concluiu o treino ${log.title}. Esforço: ${log.effort}.${log.notes ? ` Observação: ${log.notes}` : ''}`,
    }).catch(() => {})
    setWorkoutStartedAt(null)
    setWorkoutElapsedSeconds(0)
    setWorkoutStartNotified(false)
    if (completedCount > 0 && (completedCount % 20 === 0 || completedCount % 5 === 0)) {
      setFeedbackPrompt({
        type: completedCount % 20 === 0 ? 'mensal' : 'semanal',
        count: completedCount,
      })
    }
    return savedLog
  }

  async function installStudentApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice.catch(() => null)
    setInstallPrompt(null)
  }

  function renderActiveContent() {
    if (!financialAccessOpen && restrictedTabs.includes(activeTab)) {
      return (
        <StudentPaymentLock
          coachSettings={coachSettings}
          onOpenPayments={() => openTab('pagamentos')}
          onOpenChat={() => openTab('mensagens')}
        />
      )
    }

    if (activeTab === 'inicio') {
      return (
        <StudentHomeDashboard
          student={student}
          weekProgress={weekProgress}
          completedThisWeek={completedThisWeek}
          weeklyTarget={weeklyChallengeTarget}
          completedThisMonth={completedThisMonth}
          monthlyTarget={monthlyChallengeTarget}
          nextWorkout={nextWorkout}
          nextAppointment={nextAppointment}
          waterMl={waterMl}
          waterGoalMl={waterGoalMl}
          onAddWater={addWater}
          onResetWater={resetWater}
          onOpenTab={openTab}
        />
      )
    }

    if (activeTab === 'treino') {
      return (
        <StudentAppSection title="Treino de hoje" action={nextWorkout?.title || student.workout || 'Plano'}>
          <StudentReminderCard
            title="Lembrete de treino"
            body={`Hora de treinar, ${student.name}. Abra o Coach Fit Pro e siga o plano de hoje.`}
            action="Ativar lembrete"
          />
          <div className="mb-4 overflow-hidden rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">Tempo de treino</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="font-mono text-4xl font-black text-white">{formatWorkoutTimer(workoutSeconds)}</p>
              <button type="button" onClick={toggleWorkoutTimer} className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
                {workoutStartedAt ? 'Pausar treino' : 'Iniciar treino'}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">Ao iniciar, o contador ajuda você a acompanhar o tempo total da sessão.</p>
          </div>
          {studentWorkouts.length ? (
            <>
              <WorkoutList workouts={studentWorkouts.slice(0, 1)} fallbackTitle={student.workout} />
              {feedbackPrompt ? (
                <WorkoutFeedbackPrompt
                  prompt={feedbackPrompt}
                  student={student}
                  onClose={() => setFeedbackPrompt(null)}
                  onSend={async (body) => {
                    await onSendMessage?.({ studentId: student.id, sender: 'student', body }).catch(() => {})
                    setFeedbackPrompt(null)
                    openTab('mensagens')
                  }}
                />
              ) : null}
              {onCompleteWorkout ? <CompleteWorkoutForm student={student} workout={studentWorkouts[0]} onCompleteWorkout={completeWorkoutFromStudent} /> : null}
            </>
          ) : (
            <Empty text="Seu treino ainda não foi liberado pelo coach." />
          )}
        </StudentAppSection>
      )
    }

    if (activeTab === 'dieta') {
      return (
        <StudentAppSection title="Dieta de hoje" action={studentNutritionPlans[0]?.calories || student.calories || 'Macros'}>
          <StudentReminderCard
            title="Lembrete de refeição"
            body={`${student.name}, confira sua refeição no Coach Fit Pro para manter os macros do dia.`}
            action="Ativar lembrete"
          />
          {studentNutritionPlans.length ? <NutritionPlanList plans={studentNutritionPlans.slice(0, 1)} selectedStudent={student} /> : <Empty text="Sua dieta ainda não foi liberada pelo coach." />}
        </StudentAppSection>
      )
    }

    if (activeTab === 'checkin') {
      return <StudentAppSection title="Enviar check-in" action="Retorno"><CheckinForm students={[student]} onAddCheckin={onAddCheckin} /></StudentAppSection>
    }

    if (activeTab === 'mensagens') {
      return <StudentChatScreen student={student} coachId={coachId} messages={studentMessages} onSendMessage={onSendMessage} onRefreshMessages={onRefreshMessages} />
    }

    if (activeTab === 'pagamentos') {
      return (
        <StudentPaymentStatement
          student={student}
          invoices={studentInvoices}
          coachSettings={coachSettings}
          onSendMessage={onSendMessage}
        />
      )
    }

    if (activeTab === 'agenda') {
      return (
        <StudentAppSection title="Agenda" action={`${studentAppointments.length} próximos`}>
          {nextAppointment ? <div className="rounded-md border border-white/10 bg-white/[0.035] p-4"><h4 className="font-black">{nextAppointment.title}</h4><p className="mt-1 text-sm text-zinc-400">{nextAppointment.type} - {nextAppointment.durationMinutes} min</p><p className="mt-2 text-sm font-bold text-blue-200">{formatFullDateTime(nextAppointment.startsAt)}</p><p className="mt-1 text-sm text-zinc-400">{nextAppointment.location || 'Local a confirmar'}</p></div> : <Empty text="Nenhum compromisso futuro agendado." />}
        </StudentAppSection>
      )
    }

    if (activeTab === 'progresso') {
      return <StudentAppSection title="Progresso" action={`${checkins.length} check-ins`}><AssessmentProgress assessments={studentAssessments} student={student} checkins={checkins.filter((item) => String(item.studentId) === String(student?.id))} /></StudentAppSection>
    }

    return (
      <StudentAppSection title="Histórico" action={`${studentWorkoutLogs.length} treinos`}>
        <WorkoutLogList logs={studentWorkoutLogs} />
        {checkins.length ? <div className="mt-4 space-y-3">{checkins.slice(0, 3).map((item) => <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4"><h4 className="font-bold">{item.type}</h4><p className="mt-1 text-sm text-zinc-400">{item.due} - {item.weight}</p><p className="mt-2 text-sm leading-6 text-zinc-300">{item.note}</p></div>)}</div> : null}
      </StudentAppSection>
    )
  }

  return (
    <div className="app-shell student-mobile-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/94 px-3 py-3 shadow-2xl shadow-black/25 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup compact subtitle="Coach Fit Pro" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black uppercase text-emerald-300">{activeTitle}</p>
            <p className="truncate text-sm font-black">{student.name}</p>
          </div>
          {!appInstalled && installPrompt ? (
            <button type="button" onClick={installStudentApp} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950">Instalar</button>
          ) : null}
          <button type="button" onClick={onExit} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200">Sair</button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <nav className="relative h-full w-[82vw] max-w-80 overflow-y-auto border-r border-white/10 bg-zinc-950 p-4 shadow-2xl shadow-black">
            <div className="mb-5 flex items-center justify-between gap-3">
              <BrandLockup compact subtitle="Coach Fit Pro" />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-zinc-200">
                <NavIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3">
              <p className="text-xs font-black uppercase text-emerald-200">Área do aluno</p>
              <p className="mt-1 text-lg font-black">{student.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{student.goal || 'Acompanhamento em andamento'}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {navItems.map((item) => {
                const tone = getNavToneClasses(item.tone)
                const active = activeTab === item.id

                return (
                  <button key={item.id} type="button" onClick={() => openTab(item.id)} className={`flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-black ${active ? tone.active : tone.idle}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${active ? tone.iconActive : tone.iconIdle}`}>
                      <NavIcon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="text-zinc-500">›</span>
                  </button>
                )
              })}
            </div>
            {!appInstalled ? (
              <div className="mt-4 rounded-md border border-blue-300/20 bg-blue-400/10 p-3">
                <p className="text-xs font-black uppercase text-blue-200">Acesso rápido</p>
                <p className="mt-1 text-xs leading-5 text-zinc-300">Adicione o Coach Fit Pro na tela inicial para abrir sem digitar o código toda hora.</p>
                {installPrompt ? (
                  <button type="button" onClick={installStudentApp} className="mt-3 w-full rounded-md bg-emerald-400 px-3 py-2.5 text-xs font-black text-zinc-950">Adicionar no celular</button>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-zinc-400">No iPhone: toque em compartilhar e depois em Adicionar à Tela de Início.</p>
                )}
              </div>
            ) : null}

          </nav>
        </div>
      ) : null}

      <div className="mx-auto grid min-w-0 max-w-6xl gap-4 px-3 pb-24 pt-4 sm:px-5 sm:pt-6 lg:grid-cols-[260px_1fr] lg:gap-6 lg:pb-10">
        <aside className="hidden lg:sticky lg:top-5 lg:block lg:self-start">
          <div className="rounded-md border border-white/10 bg-zinc-950/82 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <BrandLockup subtitle={`por ${coachSettings?.brandName || coachSettings?.publicName || 'seu treinador'}`} />
            <div className="mt-5 rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3">
              <p className="text-xs font-black uppercase text-emerald-200">Área do aluno</p>
              <p className="mt-1 text-lg font-black">{student.name}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {navItems.map((item) => {
                const tone = getNavToneClasses(item.tone)
                const active = activeTab === item.id

                return (
                  <button key={item.id} type="button" onClick={() => openTab(item.id)} className={`flex min-h-10 items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm font-bold transition ${active ? tone.active : `${tone.idle} hover:-translate-y-0.5`}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${active ? tone.iconActive : tone.iconIdle}`}>
                      <NavIcon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={onExit} className="mt-4 w-full rounded-md border border-white/10 px-3 py-2.5 text-sm font-black text-zinc-200">Sair</button>
            {!appInstalled ? (
              <div className="mt-4 rounded-md border border-blue-300/20 bg-blue-400/10 p-3">
                <p className="text-xs font-black uppercase text-blue-200">Instalar no celular</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">O aluno abre pelo ícone e continua com o acesso salvo.</p>
                {installPrompt ? (
                  <button type="button" onClick={installStudentApp} className="mt-3 w-full rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950">Adicionar app</button>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-zinc-500">No iPhone, use compartilhar e Adicionar à Tela de Início.</p>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0">
          <section className="mb-4 overflow-hidden rounded-md border border-emerald-300/20 bg-zinc-950/80 shadow-2xl shadow-black/25">
            <div className="p-4 sm:p-5">
              <p className="text-xs font-black uppercase text-emerald-300">Coach Fit Pro</p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-4xl">{activeTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{student.goal || 'Siga o plano do dia e registre seus retornos.'}</p>
              {!appInstalled ? (
                <div className="mt-4 rounded-md border border-blue-300/20 bg-blue-400/10 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-blue-200">Acesso salvo no celular</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-300">Entre uma vez, adicione na tela inicial e abra como aplicativo.</p>
                    </div>
                    {installPrompt ? (
                      <button type="button" onClick={installStudentApp} className="rounded-md bg-emerald-400 px-4 py-2.5 text-xs font-black text-zinc-950">Adicionar</button>
                    ) : (
                      <p className="max-w-xs text-xs leading-5 text-zinc-400">No iPhone: compartilhar &gt; Adicionar à Tela de Início.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
          {renderActiveContent()}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-emerald-300/15 bg-black/95 px-2 py-2 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {bottomNavItems.map((item) => {
            const active = activeTab === item.id

            return (
              <button key={item.id} type="button" onClick={() => openTab(item.id)} className={`grid min-h-14 place-items-center gap-0.5 rounded-lg border px-1 py-1 text-center text-[10px] font-black transition ${
                active
                  ? 'border-[#00c7a8]/45 bg-[#00c7a8]/15 text-[#9fffe8]'
                  : 'border-transparent text-zinc-400'
              }`}>
                <NavIcon name={item.icon} className={`h-4 w-4 ${active ? 'text-[#9fffe8]' : 'text-[#00c7a8]'}`} />
                <span className="leading-tight">{item.label}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setMenuOpen(true)} className="grid min-h-14 place-items-center gap-0.5 rounded-lg border border-transparent px-1 py-1 text-center text-[10px] font-black text-zinc-400 transition">
            <NavIcon name="menu" className="h-4 w-4 text-[#00c7a8]" />
            <span className="leading-tight">MENU</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

function StudentHomeDashboard({ student, weekProgress, completedThisWeek, weeklyTarget, completedThisMonth, monthlyTarget, nextWorkout, nextAppointment, waterMl, waterGoalMl, onAddWater, onResetWater, onOpenTab }) {
  const firstName = String(student?.name || 'aluno').split(' ')[0]
  const waterPercent = Math.min(100, Math.round((Number(waterMl || 0) / Math.max(1, Number(waterGoalMl || 2500))) * 100))
  const weeklyPercent = Math.min(100, Math.round((completedThisWeek / Math.max(1, weeklyTarget)) * 100))
  const monthlyPercent = Math.min(100, Math.round((completedThisMonth / Math.max(1, monthlyTarget)) * 100))
  const reward = buildStudentRewardStats({ completedThisWeek, completedThisMonth, waterPercent })
  const nextAction = nextWorkout
    ? { title: 'Iniciar treino de hoje', body: nextWorkout.title || student.workout || 'Seu plano está pronto.', tab: 'treino', icon: 'dumbbell' }
    : nextAppointment
      ? { title: 'Ver próximo compromisso', body: formatFullDateTime(nextAppointment.startsAt), tab: 'agenda', icon: 'calendar' }
      : { title: 'Abrir chat com o coach', body: 'Envie uma dúvida ou retorno rápido.', tab: 'mensagens', icon: 'message' }

  return (
    <StudentAppSection title={`Olá, ${firstName}`} action="Seu plano">
      <div className="grid gap-4">
        <button type="button" onClick={() => onOpenTab(nextAction.tab)} className="flex items-center gap-3 rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-left transition hover:border-emerald-200/45">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
            <NavIcon name={nextAction.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">{nextAction.title}</span>
            <span className="mt-1 block text-xs leading-5 text-zinc-400">{nextAction.body}</span>
          </span>
          <NavIcon name="chevronRight" className="h-5 w-5 text-emerald-200" />
        </button>

        <div className="overflow-hidden rounded-xl border border-emerald-300/25 bg-gradient-to-br from-emerald-300/12 via-zinc-950 to-blue-500/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-200">Ranking de evolução</p>
              <h3 className="mt-2 text-2xl font-black text-white">{reward.levelName}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{reward.xp} XP acumulados. Cada treino concluído soma pontos e aproxima você do próximo selo.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left sm:min-w-44">
              <p className="text-xs font-black uppercase text-zinc-500">Próximo selo</p>
              <p className="mt-1 text-lg font-black text-emerald-100">{reward.nextLevelName}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{reward.remainingXp > 0 ? `faltam ${reward.remainingXp} XP` : 'ranking máximo'}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-blue-400 transition-all duration-700" style={{ width: `${reward.progress}%` }} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {reward.badges.map((badge) => (
              <div key={badge.label} className={`rounded-lg border p-3 ${badge.done ? 'border-emerald-300/35 bg-emerald-300/12' : 'border-white/10 bg-white/[0.03]'}`}>
                <p className={`text-xs font-black uppercase ${badge.done ? 'text-emerald-100' : 'text-zinc-500'}`}>{badge.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{badge.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {reward.sources.map((source) => (
              <div key={source.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs font-black uppercase text-zinc-500">{source.label}</p>
                <p className="mt-1 text-lg font-black text-white">{source.value}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{source.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <StudentWaterTracker
          goalMl={waterGoalMl}
          currentMl={waterMl}
          onAddWater={onAddWater}
          onReset={onResetWater}
        />

        <div className="rounded-lg border border-white/10 bg-zinc-950/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-emerald-300">Calendário semanal</p>
              <p className="mt-1 text-sm text-zinc-400">{completedThisWeek} de {weeklyTarget} treinos do desafio da semana</p>
            </div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">{weeklyPercent}%</span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {weekProgress.map((day) => (
              <div key={day.key} className={`grid min-h-16 place-items-center rounded-lg border p-2 text-center ${
                day.completed
                  ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-50'
                  : day.isToday
                    ? 'border-sky-300/35 bg-sky-300/10 text-sky-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400'
              }`}>
                <span className="text-[10px] font-black uppercase">{day.label}</span>
                <span className="mt-1 text-base font-black">{day.dayNumber}</span>
                <span className="mt-1 text-[10px] font-bold">{day.completed ? 'feito' : day.isToday ? 'hoje' : '-'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StudentChallengeCard title="Desafio semanal" value={`${completedThisWeek}/${weeklyTarget}`} percent={weeklyPercent} detail={weeklyPercent >= 100 ? '+120 XP de bônus liberado.' : 'Complete a meta e ganhe bônus de XP.'} tone="emerald" />
          <StudentChallengeCard title="Desafio mensal" value={`${completedThisMonth}/${monthlyTarget}`} percent={monthlyPercent} detail={monthlyPercent >= 100 ? '+300 XP de bônus liberado.' : 'Consistência acumulada no mês gera selo especial.'} tone="sky" />
          <StudentChallengeCard title="Hidratação" value={`${waterPercent}%`} percent={waterPercent} detail={waterPercent >= 100 ? '+40 XP de rotina liberado hoje.' : 'Meta de água definida pelo coach.'} tone="cyan" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onOpenTab('treino')} className="rounded-lg border border-lime-300/25 bg-lime-300/10 p-4 text-left">
            <NavIcon name="dumbbell" className="h-5 w-5 text-lime-200" />
            <span className="mt-3 block text-sm font-black text-white">Treinar agora</span>
          </button>
          <button type="button" onClick={() => onOpenTab('mensagens')} className="rounded-lg border border-blue-300/25 bg-blue-300/10 p-4 text-left">
            <NavIcon name="message" className="h-5 w-5 text-blue-200" />
            <span className="mt-3 block text-sm font-black text-white">Falar com coach</span>
          </button>
        </div>
      </div>
    </StudentAppSection>
  )
}

function buildStudentRewardStats({ completedThisWeek = 0, completedThisMonth = 0, waterPercent = 0 }) {
  const workoutXp = completedThisMonth * 80
  const weeklyBonusXp = completedThisWeek >= 3 ? 120 : 0
  const monthlyBonusXp = completedThisMonth >= 12 ? 300 : 0
  const hydrationXp = waterPercent >= 100 ? 40 : waterPercent >= 80 ? 25 : 0
  const xp = Math.max(0, workoutXp + weeklyBonusXp + monthlyBonusXp + hydrationXp)
  const levels = [
    { name: 'Selo Bronze', min: 0 },
    { name: 'Selo Prata', min: 450 },
    { name: 'Selo Ouro', min: 900 },
    { name: 'Selo Diamante', min: 1600 },
    { name: 'Elite Coach Fit', min: 2600 },
  ]
  const currentIndex = levels.reduce((index, level, levelIndex) => (xp >= level.min ? levelIndex : index), 0)
  const current = levels[currentIndex]
  const next = levels[currentIndex + 1]
  const progress = next ? Math.round(((xp - current.min) / Math.max(1, next.min - current.min)) * 100) : 100
  const remainingXp = next ? Math.max(0, next.min - xp) : 0

  return {
    xp,
    levelName: current.name,
    nextLevelName: next?.name || 'Ranking máximo',
    remainingXp,
    progress: Math.min(100, Math.max(0, progress)),
    badges: [
      { label: 'Treino', done: completedThisWeek >= 3, detail: completedThisWeek >= 3 ? '+120 XP de bônus semanal' : 'complete 3 treinos na semana' },
      { label: 'Rotina', done: waterPercent >= 80, detail: waterPercent >= 80 ? '+25 XP de hidratação' : 'bata 80% da meta de água' },
      { label: 'Consistência', done: completedThisMonth >= 8, detail: completedThisMonth >= 8 ? 'ritmo forte no mês' : 'alcance 8 treinos no mês' },
      { label: 'Evolução', done: completedThisMonth >= 12, detail: completedThisMonth >= 12 ? '+300 XP de bônus mensal' : 'busque 12 treinos no mês' },
    ],
    sources: [
      { label: 'Treinos concluídos', value: `+${workoutXp} XP`, detail: '80 XP por treino finalizado' },
      { label: 'Bônus semanal', value: `+${weeklyBonusXp} XP`, detail: 'meta mínima de treinos da semana' },
      { label: 'Bônus mensal', value: `+${monthlyBonusXp} XP`, detail: '12 treinos ou mais no mês' },
    ],
  }
}

function StudentChallengeCard({ title, value, percent, detail, tone = 'emerald' }) {
  const toneClasses = {
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    sky: 'border-sky-300/25 bg-sky-300/10 text-sky-100',
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
  }[tone] || 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'

  return (
    <div className={`rounded-lg border p-4 ${toneClasses}`}>
      <p className="text-xs font-black uppercase opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-current transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p>
    </div>
  )
}

function buildStudentWeekProgress(logs = []) {
  const today = new Date()
  const monday = getWeekStart(today)
  const completedKeys = new Set(logs.map((log) => toLocalDateKey(log.completedAt)).filter(Boolean))
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return labels.map((label, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = toLocalDateKey(date)
    return {
      key,
      label,
      dayNumber: date.getDate(),
      completed: completedKeys.has(key),
      isToday: key === toLocalDateKey(today),
    }
  })
}

function countWorkoutLogsThisMonth(logs = []) {
  const now = new Date()
  return logs.filter((log) => {
    const date = new Date(log.completedAt)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
}

function getWeekStart(date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + diff)
  return start
}

function toLocalDateKey(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

function StudentAppSection({ id, title, action, children }) {
  return (
    <section id={`student-${id}`} className="scroll-mt-24 rounded-md border border-white/10 bg-zinc-900/72 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-right text-xs font-bold text-zinc-300">{formatUiText(action)}</span>
      </div>
      {children}
    </section>
  )
}

function StudentWaterTracker({ goalMl, currentMl, onAddWater, onReset }) {
  const safeGoal = Math.max(500, Number(goalMl || 2500))
  const safeCurrent = Math.max(0, Math.min(Number(currentMl || 0), safeGoal))
  const percent = Math.round((safeCurrent / safeGoal) * 100)
  const fillHeight = `${Math.min(100, Math.max(4, percent))}%`
  const remainingMl = Math.max(0, safeGoal - safeCurrent)
  const currentLiters = (safeCurrent / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const goalLiters = (safeGoal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-sky-300/25 bg-sky-400/10 p-4">
      <div className="grid gap-4 sm:grid-cols-[112px_1fr] sm:items-center">
        <div className="mx-auto grid justify-items-center gap-2">
          <div className="h-5 w-14 rounded-t-md border border-sky-200/40 bg-zinc-950/80" />
          <div className="relative h-44 w-24 overflow-hidden rounded-[2rem] border-2 border-sky-100/35 bg-zinc-950/70 shadow-inner shadow-sky-950/50">
            <div
              className="absolute inset-x-0 bottom-0 rounded-b-[1.8rem] bg-gradient-to-t from-sky-500 via-cyan-300 to-sky-200 transition-all duration-500 ease-out"
              style={{ height: fillHeight }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_0%,transparent_22%,transparent_72%,rgba(255,255,255,0.14)_100%)]" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="rounded-full border border-white/20 bg-zinc-950/70 px-3 py-1 text-sm font-black text-sky-100 backdrop-blur">
                {percent}%
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-sky-200">Meta de água</p>
              <h3 className="mt-1 text-2xl font-black text-white">{currentLiters} L / {goalLiters} L</h3>
            </div>
            <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1 text-xs font-black text-sky-100">
              Hoje
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {remainingMl > 0 ? `Faltam ${remainingMl} ml para bater a meta definida pelo coach.` : 'Meta concluída hoje. Excelente consistência.'}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onAddWater(250)} className="rounded-md bg-sky-300 px-3 py-3 text-xs font-black text-zinc-950">+250 ml</button>
            <button type="button" onClick={() => onAddWater(500)} className="rounded-md bg-cyan-300 px-3 py-3 text-xs font-black text-zinc-950">+500 ml</button>
            <button type="button" onClick={onReset} className="rounded-md border border-white/10 px-3 py-3 text-xs font-black text-zinc-200">
              Zerar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentPaymentLock({ coachSettings, onOpenPayments, onOpenChat }) {
  const billingBrand = getBillingBrand(coachSettings)

  return (
    <StudentAppSection title="Acesso pausado" action="Fatura">
      <div className="rounded-md border p-4" style={{ borderColor: `${billingBrand.primaryColor}55`, background: `linear-gradient(135deg, ${billingBrand.primaryColor}18, ${billingBrand.accentColor}12)` }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-black uppercase" style={{ color: billingBrand.primaryColor }}>Área temporariamente pausada</p>
          {billingBrand.logoUrl ? (
            <img src={billingBrand.logoUrl} alt={coachSettings?.brandName || 'Logo do coach'} className="h-16 max-w-48 rounded-md border border-white/10 bg-white object-contain p-2" />
          ) : null}
        </div>
        <h3 className="mt-2 text-2xl font-black text-white">Resolva sua fatura para liberar esta área.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Os detalhes de assinatura, Pix, extrato e comprovante ficam concentrados na aba Fatura para não misturar cobrança com treino, dieta ou progresso.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onOpenPayments} className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          Ir para Fatura
        </button>
        <button type="button" onClick={onOpenChat} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
          Falar com coach
        </button>
      </div>
    </StudentAppSection>
  )
}

function StudentPaymentStatement({ student, invoices, coachSettings, onSendMessage }) {
  const [noticeSending, setNoticeSending] = useState(false)
  const [noticeSent, setNoticeSent] = useState(false)
  const visibleInvoices = invoices.map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) }))
  const paidTotal = visibleInvoices.filter((invoice) => invoice.status === 'Pago').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const pendingInvoices = visibleInvoices.filter((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status))
  const pendingTotal = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const nextPendingInvoice = pendingInvoices[0]

  async function notifyPayment() {
    setNoticeSending(true)
    setNoticeSent(false)
    const invoiceSummary = nextPendingInvoice
      ? `${nextPendingInvoice.description || nextPendingInvoice.planName || 'Mensalidade'} - ${formatCurrency(nextPendingInvoice.amount)} - vencimento ${formatDate(nextPendingInvoice.dueDate)}`
      : `Total informado no app: ${formatCurrency(pendingTotal)}`
    await onSendMessage?.({
      studentId: student.id,
      sender: 'student',
      body: `Solicitação de validação de pagamento: ${student.name} informou que pagou. Cobrança: ${invoiceSummary}. Coach, confirme em Recebimentos para liberar o acesso.`,
    }).catch(() => {})
    setNoticeSending(false)
    setNoticeSent(true)
  }

  return (
    <StudentAppSection title="Fatura" action={`${visibleInvoices.length} registros`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <StudentStatusCard label="Já pago" value={formatCurrency(paidTotal)} detail="Histórico confirmado" />
        <StudentStatusCard label="Em aberto" value={formatCurrency(pendingTotal)} detail="Pendentes e atrasados" />
        <StudentStatusCard label="Pix" value={coachSettings?.pixKey || '-'} detail={coachSettings?.publicName || 'Coach'} />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => printStudentPaymentStatement(student, visibleInvoices, coachSettings)} className="rounded-lg bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 transition active:scale-[0.98]">
          Gerar extrato em PDF
        </button>
        {pendingInvoices.length ? (
          <button type="button" disabled={noticeSending} onClick={notifyPayment} className="rounded-lg border border-emerald-300/30 px-4 py-3 text-sm font-black text-emerald-100 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {noticeSending ? 'Enviando...' : 'Avisei que paguei'}
          </button>
        ) : null}
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <p className="text-xs font-black uppercase text-zinc-400">{pendingInvoices.length ? 'Como a liberação funciona' : 'Assinatura em dia'}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">
          {pendingInvoices.length
            ? 'Pague pelo Pix do coach, envie o comprovante no chat e toque em “Avisei que paguei”. O treinador confirma em Recebimentos e o acesso é liberado.'
            : 'Nenhuma cobrança em aberto no momento. Quando houver uma nova fatura, ela aparecerá somente nesta área.'}
        </p>
        {noticeSent ? <p className="mt-2 text-sm font-bold text-emerald-200">Solicitação enviada ao treinador.</p> : null}
      </div>

      <div className="mt-5 grid gap-3">
        {visibleInvoices.length ? (
          visibleInvoices.map((invoice) => (
            <div key={invoice.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <InvoiceStatus status={invoice.status} />
                  <h4 className="mt-3 break-words font-black">{invoice.description || invoice.planName}</h4>
                  <p className="mt-1 text-sm text-zinc-400">Vencimento: {formatDate(invoice.dueDate)}</p>
                  {invoice.paidAt ? <p className="mt-1 text-xs text-zinc-500">Pago em {formatDateTime(invoice.paidAt)}</p> : null}
                </div>
                <p className="text-xl font-black text-blue-200">{formatCurrency(invoice.amount)}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty text="Nenhum pagamento registrado ainda." />
        )}
      </div>
    </StudentAppSection>
  )
}

function WorkoutFeedbackPrompt({ prompt, student, onSend, onClose }) {
  const [feedback, setFeedback] = useState('')
  const label = prompt.type === 'mensal' ? 'Feedback mensal' : 'Feedback semanal'

  return (
    <div className="mb-4 rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
      <p className="text-xs font-black uppercase text-blue-200">{label}</p>
      <h3 className="mt-2 text-lg font-black">Como foi sua evolução até aqui?</h3>
      <p className="mt-1 text-sm leading-6 text-zinc-300">
        Você completou {prompt.count} treinos. Envie um retorno rápido para o coach ajustar carga, dieta e próximos passos.
      </p>
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        rows={3}
        placeholder="Energia, dificuldade, dores, fome, sono ou algo que o coach precisa saber."
        className="mt-3 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => onSend(`${label} de ${student.name}: ${feedback || 'Aluno solicitou revisão do plano.'}`)} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
          Enviar feedback
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
          Depois
        </button>
      </div>
    </div>
  )
}

function StudentReminderCard({ title, body, action }) {
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  async function handleReminder() {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') return
    }
    sendLocalNotification(title, body)
  }

  return (
    <div className="mb-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-blue-300">{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Receba um aviso no celular antes do compromisso.</p>
        </div>
        <button type="button" onClick={handleReminder} className="rounded-md border border-blue-300/30 px-3 py-2 text-xs font-black text-blue-100">
          {permission === 'granted' ? 'Testar aviso' : action}
        </button>
      </div>
    </div>
  )
}

function printStudentPaymentStatement(student, invoices, coachSettings) {
  const rows = invoices.map((invoice) => `
    <tr>
      <td>${escapeStatementHtml(invoice.description || invoice.planName || 'Mensalidade')}</td>
      <td>${escapeStatementHtml(formatDate(invoice.dueDate))}</td>
      <td>${escapeStatementHtml(invoice.status)}</td>
      <td>${escapeStatementHtml(formatCurrency(invoice.amount))}</td>
    </tr>
  `).join('')
  const paidTotal = invoices.filter((invoice) => invoice.status === 'Pago').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const pendingTotal = invoices.filter((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const popup = window.open('', '_blank', 'width=920,height=720')
  if (!popup) return
  popup.document.write(`
    <html>
      <head>
        <title>Extrato Coach Fit Pro</title>
        <style>
          body{font-family:Arial,sans-serif;color:#111827;margin:32px}
          h1{margin:0 0 8px;font-size:28px}
          p{color:#4b5563}
          table{width:100%;border-collapse:collapse;margin-top:24px}
          th,td{border-bottom:1px solid #e5e7eb;padding:12px;text-align:left;font-size:13px}
          th{background:#f3f4f6}
          .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}
          .card{border:1px solid #e5e7eb;border-radius:8px;padding:14px}
          .value{font-size:20px;font-weight:800;color:#047857}
        </style>
      </head>
      <body>
        <h1>Extrato de pagamentos</h1>
        <p>Aluno: ${escapeStatementHtml(student.name)} | Coach: ${escapeStatementHtml(coachSettings?.publicName || coachSettings?.brandName || 'Coach Fit Pro')}</p>
        <div class="cards">
          <div class="card"><strong>Pago</strong><div class="value">${escapeStatementHtml(formatCurrency(paidTotal))}</div></div>
          <div class="card"><strong>Em aberto</strong><div class="value">${escapeStatementHtml(formatCurrency(pendingTotal))}</div></div>
          <div class="card"><strong>Pix</strong><div>${escapeStatementHtml(coachSettings?.pixKey || '-')}</div></div>
        </div>
        <table>
          <thead><tr><th>Descrição</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Nenhum registro.</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `)
  popup.document.close()
  popup.focus()
  setTimeout(() => popup.print(), 300)
}

function escapeStatementHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function StudentChatScreen({ student, coachId, messages, onSendMessage, onRefreshMessages }) {
  useEffect(() => {
    if (!onRefreshMessages) return undefined
    let active = true
    const sync = () => {
      if (active) onRefreshMessages()
    }
    sync()
    const timer = window.setInterval(sync, 2500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [onRefreshMessages])

  return (
    <section className="min-h-[calc(100vh-168px)] overflow-hidden rounded-md border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/25">
      <div className="flex min-h-[calc(100vh-168px)] flex-col">
        <div className="border-b border-white/10 bg-emerald-400/10 p-4">
          <p className="text-xs font-black uppercase text-emerald-200">Conversa com o coach</p>
          <h2 className="mt-1 text-lg font-black">{student.name}</h2>
          <p className="mt-1 text-xs text-zinc-400">Envie dúvidas, retornos rápidos e observações do dia.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <StudentMessagePanel student={student} coachId={coachId} messages={messages} onSendMessage={onSendMessage} fullScreen />
        </div>
      </div>
    </section>
  )
}

function StudentStatusCard({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-black uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-base font-black text-white">{value || '-'}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{detail || '-'}</p>
    </div>
  )
}
function CheckinForm({ students, onAddCheckin }) {
  const [photo, setPhoto] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')

  function handlePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.')
      event.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A foto deve ter no máximo 8 MB.')
      event.target.value = ''
      return
    }
    setError('')
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result.toString())
    reader.onerror = () => setError('Não foi possível ler esta imagem.')
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setSaving(true)
    setMessage('')
    setWarning('')
    setError('')
    try {
      const savedCheckin = await onAddCheckin({
        studentId: form.get('studentId')?.toString() || '',
        type: form.get('type')?.toString() || 'Check-in',
        due: form.get('due')?.toString() || 'Hoje',
        state: form.get('state')?.toString() || 'Recebido',
        weight: form.get('weight')?.toString() || '',
        note: form.get('note')?.toString() || '',
        photo,
        photoFile,
      })
      formElement.reset()
      setPhoto('')
      setPhotoFile(null)
      setMessage('Check-in salvo com sucesso.')
      if (savedCheckin?.uploadWarning) setWarning(savedCheckin.uploadWarning)
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar o check-in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {students.length === 1 ? (
        <>
          <input type="hidden" name="studentId" value={students[0].id} />
          <Info label="Aluno" value={students[0].name} />
        </>
      ) : (
        <Select label="Aluno" name="studentId" options={students.map((student) => ({ label: student.name, value: student.id }))} />
      )}
      <Field label="Tipo" name="type" defaultValue="Check-in do dia" />
      <Field label="Prazo" name="due" defaultValue="Hoje" />
      <Select label="Status" name="state" defaultValue="Recebido" options={['Recebido', 'Pendente', 'Critico']} />
      <Field label="Peso informado" name="weight" defaultValue="84,0 kg" />
      <TextArea label="Observações" name="note" defaultValue="Registrar avaliação do coach." />
      <label className="grid gap-2 text-sm font-bold text-zinc-300">
        Foto do check-in
        <input type="file" accept="image/*" onChange={handlePhoto} className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-300" />
      </label>
      {photo ? <img src={photo} alt="Prévia" className="h-44 rounded-md object-cover" /> : null}
      <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar check-in'}
      </button>
      {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
      {warning ? <p className="text-sm font-bold text-amber-200">{warning}</p> : null}
      {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
    </form>
  )
}

function CoachSubscription({ students, invoices, subscription, userCreatedAt, coachPlans = plans, appAdminSettings = defaultAppAdminSettings, onRefreshSubscription }) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [checkoutStarted, setCheckoutStarted] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState(() => {
    try {
      return window.localStorage.getItem(SELECTED_CHECKOUT_PLAN_KEY) || 'mensal'
    } catch {
      return 'mensal'
    }
  })
  const firstMonthCheckoutUrl = resolveCheckoutUrl(import.meta.env.VITE_FITCOACH_FIRST_MONTH_CHECKOUT_URL || subscription?.checkoutFirstMonthUrl || import.meta.env.VITE_FITCOACH_BILLING_URL || '', primaryCartpandaCheckoutUrl)
  const regularCheckoutUrl = resolveCheckoutUrl(import.meta.env.VITE_FITCOACH_REGULAR_CHECKOUT_URL || subscription?.checkoutRegularUrl || '', firstMonthCheckoutUrl)
  const officialCheckoutPlans = normalizeAdminSettings(appAdminSettings).checkoutPlans
  const checkoutPlans = officialCheckoutPlans.map((plan) => {
    const envUrl = plan.id === 'mensal'
      ? firstMonthCheckoutUrl
      : plan.id === 'semestral'
        ? import.meta.env.VITE_FITCOACH_SEMESTER_CHECKOUT_URL
        : import.meta.env.VITE_FITCOACH_ANNUAL_CHECKOUT_URL

    return {
      ...plan,
      checkoutUrl: resolveCheckoutUrl(envUrl, plan.checkoutUrl),
    }
  })
  const subscriptionActive = isCoachSubscriptionActive(subscription)
  const subscriptionStatusLabel = getSubscriptionStatusLabel(subscription)
  const activeStudents = students.filter((student) => student.status !== 'Inativo')
  const estimatedRevenue = activeStudents.reduce((total, student) => total + getPlanMonthlyPrice(student.plan, coachPlans), 0)
  const now = new Date()
  const receivedThisMonth = invoices
    .filter((invoice) => {
      if (invoice.status !== 'Pago') return false
      const paidDate = new Date(invoice.paidAt || invoice.dueDate)
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()
    })
    .reduce((total, invoice) => total + Number(invoice.amount || 0), 0)
  const billingCycle = getCoachBillingCycle(subscription, userCreatedAt, currentTime)
  const firstMonthPrice = subscription?.firstMonthPrice ?? 9.9
  const regularPrice = subscription?.regularPrice ?? 49.9
  const firstMonthTotal = firstMonthPrice
  const regularTotal = regularPrice
  const currentBillingTotal = billingCycle.isPromotional ? firstMonthTotal : regularTotal
  const currentCheckoutUrl = checkoutPlans.find((plan) => plan.id === selectedCheckoutPlanId)?.checkoutUrl || regularCheckoutUrl
  const selectedCheckoutPlan = checkoutPlans.find((plan) => plan.id === selectedCheckoutPlanId) || checkoutPlans[0]
  const retainedRevenue = Math.max(estimatedRevenue - regularTotal, 0)
  const costShare = estimatedRevenue > 0 ? (regularTotal / estimatedRevenue) * 100 : 0
  const returnMultiple = regularTotal > 0 ? estimatedRevenue / regularTotal : 0
  const closingDate = new Date(billingCycle.nextBillingAt)
  const studentBreakdown = activeStudents.map((student) => {
    const monthlyValue = getPlanMonthlyPrice(student.plan, coachPlans)
    return {
      ...student,
      monthlyValue,
    }
  })

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!checkoutStarted || subscriptionActive || !onRefreshSubscription) return undefined

    let stopped = false
    let attempts = 0
    let busy = false

    async function verify() {
      if (stopped || busy) return
      busy = true
      attempts += 1
      const result = await onRefreshSubscription({ status: 'Verificando pagamento', silent: true, goToOverviewOnActive: true })
      if (stopped) return
      if (result?.active) {
        setPaymentMessage('Pagamento confirmado. O painel foi liberado automaticamente.')
        stopped = true
      } else if (attempts >= 24) {
        setPaymentMessage('Ainda aguardando a confirmação do checkout. Assim que o provedor enviar o pagamento aprovado, o painel será liberado.')
        stopped = true
      } else {
        setPaymentMessage('Aguardando confirmação do pagamento. Pode levar alguns instantes após o checkout.')
      }
      busy = false
    }

    const timer = window.setInterval(verify, 5000)
    verify()

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [checkoutStarted, subscriptionActive, onRefreshSubscription])

  useEffect(() => {
    if (!checkoutStarted || subscriptionActive || !onRefreshSubscription) return undefined

    const verifyOnReturn = () => {
      if (document.visibilityState === 'hidden') return
      checkPaymentStatus(true)
    }

    window.addEventListener('focus', verifyOnReturn)
    document.addEventListener('visibilitychange', verifyOnReturn)
    return () => {
      window.removeEventListener('focus', verifyOnReturn)
      document.removeEventListener('visibilitychange', verifyOnReturn)
    }
  }, [checkoutStarted, subscriptionActive, onRefreshSubscription])

  async function copyBillingSummary() {
    const summary = [
      'Resumo da assinatura Coach Fit Pro',
      `Alunos ativos: ${activeStudents.length}`,
      `Receita estimada da carteira: ${formatCurrency(estimatedRevenue)}`,
      `Mensalidade regular: ${formatCurrency(regularPrice)}`,
      `Total regular estimado: ${formatCurrency(regularTotal)}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function checkPaymentStatus(silent = false) {
    if (!onRefreshSubscription) return
    setCheckingPayment(true)
    if (!silent) setPaymentMessage('Verificando pagamento...')
    const result = await onRefreshSubscription({ status: 'Verificando pagamento', silent: true, goToOverviewOnActive: true })
    if (result?.active) {
      setPaymentMessage('Pagamento confirmado. O painel foi liberado automaticamente.')
    } else if (!silent) {
      setPaymentMessage('Pagamento ainda não confirmado. Use o mesmo e-mail da conta no checkout e aguarde alguns instantes.')
    }
    setCheckingPayment(false)
  }

  function chooseCheckoutPlan(planId) {
    setSelectedCheckoutPlanId(planId)
    setPaymentMessage('')
    try {
      window.localStorage.setItem(SELECTED_CHECKOUT_PLAN_KEY, planId)
    } catch {
      // Mantem a troca de plano funcionando mesmo se o armazenamento local falhar.
    }
  }

  function handleCheckoutClick(planId = selectedCheckoutPlanId) {
    chooseCheckoutPlan(planId)
    setCheckoutStarted(true)
    setPaymentMessage('Checkout aberto em uma nova aba. Ao voltar para o app, a liberação será verificada automaticamente.')
  }

  if (!subscriptionActive) {
    return (
      <div className="grid min-w-0 gap-5 lg:gap-6">
        <section className="overflow-hidden rounded-2xl border border-blue-400/25 bg-zinc-950/90 shadow-2xl shadow-black/35">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.75fr)] lg:items-stretch">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-blue-300">Ativação da conta</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
                Falta só escolher o ciclo e ativar seu Coach Fit Pro.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                Você já criou sua conta. Agora confirme o plano, faça o pagamento com o mesmo e-mail cadastrado e o painel será liberado automaticamente assim que a Cartpanda aprovar.
              </p>

              <div className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 sm:grid-cols-3">
                {checkoutPlans.map((plan) => {
                  const selected = selectedCheckoutPlan.id === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => chooseCheckoutPlan(plan.id)}
                      className={`min-h-20 rounded-xl px-3 py-3 text-left transition ${
                        selected
                          ? 'bg-blue-500 text-zinc-950 shadow-lg shadow-blue-950/30'
                          : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="block text-sm font-black">{plan.name}</span>
                      <span className={`mt-1 block text-[11px] font-bold uppercase ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>{plan.cycle}</span>
                      <span className="mt-2 block text-xs font-black">{plan.price}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase text-zinc-500">Por que este plano faz sentido</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{selectedCheckoutPlan.bestFor}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCheckoutPlan.decisionPoints.map((item) => (
                    <span key={item} className="rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black text-blue-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ['1', 'Conta criada', 'seus dados já estão salvos'],
                  ['2', 'Plano escolhido', selectedCheckoutPlan.name],
                  ['3', 'Liberação automática', 'após aprovação do pagamento'],
                ].map(([step, title, text]) => (
                  <div key={step} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-xs font-black text-zinc-950">{step}</span>
                    <p className="mt-3 text-sm font-black text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-blue-400/35 bg-gradient-to-br from-blue-500/16 via-zinc-950 to-zinc-950 p-5 shadow-xl shadow-blue-950/25 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-300">{selectedCheckoutPlan.cycle}</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{selectedCheckoutPlan.name}</h3>
                </div>
                <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase text-white">
                  {selectedCheckoutPlan.badge}
                </span>
              </div>

              <div className="mt-6">
                {selectedCheckoutPlan.oldPrice ? <p className="text-sm font-bold text-zinc-500 line-through">De {selectedCheckoutPlan.oldPrice}</p> : null}
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="text-4xl font-black leading-none text-white">{selectedCheckoutPlan.price}</span>
                  <span className="pb-1 text-sm font-bold text-zinc-400">{selectedCheckoutPlan.suffix}</span>
                </div>
                <p className="mt-2 text-sm font-black text-blue-200">{selectedCheckoutPlan.total}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-200">{selectedCheckoutPlan.economy}</p>
              </div>

              <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs font-black uppercase text-emerald-200">O que acontece depois</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{selectedCheckoutPlan.operatingPromise}</p>
              </div>

              <div className="mt-5 grid gap-2">
                {selectedCheckoutPlan.highlights.slice(0, 4).map((item) => (
                  <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-200">
                    <span className="text-blue-300">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <a
                href={selectedCheckoutPlan.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleCheckoutClick(selectedCheckoutPlan.id)}
                className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-5 py-4 text-center text-base font-black text-zinc-950 shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5"
              >
                Ativar {selectedCheckoutPlan.name} agora
              </a>

              <button type="button" onClick={() => checkPaymentStatus(false)} disabled={checkingPayment} className="mt-3 w-full rounded-xl border border-blue-300/25 bg-blue-300/10 px-4 py-3 text-sm font-black text-blue-100 disabled:cursor-wait disabled:opacity-60">
                {checkingPayment ? 'Verificando...' : 'Já paguei, verificar liberação'}
              </button>

              {paymentMessage ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">{paymentMessage}</p> : null}

              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Use o mesmo e-mail da conta no pagamento para a liberação automática funcionar.
              </p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-4 lg:gap-6">
      <section className="overflow-hidden rounded-md border border-emerald-300/25 bg-zinc-950/75 shadow-2xl shadow-black/25">
        <div className="grid gap-5 border-b border-white/10 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-emerald-300">Sua assinatura Coach Fit Pro</p>
            <h3 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
              {subscriptionActive ? 'Painel liberado e pronto para operar.' : 'Ative sua assinatura para liberar o painel profissional.'}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              {subscriptionActive
                ? 'Sua conta está ativa. Continue cadastrando alunos, planos, treinos, dietas, cobranças e acompanhamentos sem sair do Coach Fit Pro.'
                : <>Você começa por apenas <strong className="text-emerald-200">{formatCurrency(firstMonthPrice)} no primeiro mês</strong>. Depois, a mensalidade fica em {formatCurrency(regularPrice)} por mês, mantendo todas as ferramentas liberadas para operar com previsibilidade.</>}
            </p>
            <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${
              subscriptionActive
                ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                : 'border-amber-300/30 bg-amber-300/10 text-amber-100'
            }`}>
              {subscriptionStatusLabel}
            </div>
          </div>
          <div className="min-w-0 rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">{billingCycle.isPromotional ? 'Primeiro fechamento' : 'Próximo fechamento'}</p>
            <p className="mt-2 break-words text-4xl font-black text-white">{formatCurrency(currentBillingTotal)}</p>
            <p className="mt-2 text-xs leading-5 text-emerald-100">
              {billingCycle.isPromotional
                ? 'Condição especial de entrada ativa neste ciclo.'
                : `${formatCurrency(regularPrice)} de mensalidade fixa.`}
            </p>
            <div className="mt-4 border-t border-emerald-300/20 pt-4">
              <p className="text-xs font-black uppercase text-emerald-200">Próxima cobrança em</p>
              <p className="mt-1 text-2xl font-black text-white">{billingCycle.daysRemaining} {billingCycle.daysRemaining === 1 ? 'dia' : 'dias'}</p>
              <p className="mt-1 text-xs text-zinc-400">{formatFullDateTime(billingCycle.nextBillingAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          <SubscriptionMetric label="Alunos ativos" value={activeStudents.length} detail="incluídos no cálculo" tone="cyan" />
          <SubscriptionMetric label="Receita estimada" value={formatCurrency(estimatedRevenue)} detail="valor mensal da carteira" tone="emerald" />
          <SubscriptionMetric label="Recebido no mês" value={formatCurrency(receivedThisMonth)} detail="cobranças marcadas como pagas" tone="amber" />
          <SubscriptionMetric label="Você mantém" value={formatCurrency(retainedRevenue)} detail="após a cobrança regular estimada" tone="emerald" />
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Composição da cobrança" action={`Fecha em ${formatDate(closingDate.toISOString())}`}>
          <div className="grid gap-3">
            <BillingLine label="Mensalidade do primeiro mês" value={formatCurrency(firstMonthPrice)} note="Condição especial de entrada" />
            <BillingLine label="Mensalidade após o primeiro mês" value={formatCurrency(regularPrice)} note="Valor fixo mensal" />
            <div className="mt-1 rounded-md border border-emerald-300/30 bg-emerald-400/10 p-4">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-emerald-200">Próximos fechamentos</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">Mensalidade fixa para manter sua operação previsível.</p>
                </div>
                <p className="break-words text-3xl font-black text-white">{formatCurrency(regularTotal)}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setShowDetails((current) => !current)} className="mt-4 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
            {showDetails ? 'Ocultar carteira ativa' : 'Ver carteira ativa'}
          </button>
          {showDetails ? (
            <div className="mt-3 grid gap-2">
              {studentBreakdown.length ? studentBreakdown.map((student) => (
                <div key={student.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-zinc-200">{student.name}</p>
                    <p className="mt-1 break-words text-xs text-zinc-500">{student.plan} · mensalidade de {formatCurrency(student.monthlyValue)}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-xs text-zinc-500">Plano mensal</p>
                    <p className="mt-1 text-sm font-black text-cyan-200">{formatCurrency(student.monthlyValue)}</p>
                  </div>
                </div>
              )) : <Empty text="Cadastre alunos e selecione os planos para acompanhar sua carteira." />}
            </div>
          ) : null}
        </Panel>

        <div className="grid min-w-0 gap-4">
          <Panel title="O investimento em perspectiva" action="Valor percebido">
            <div className="rounded-md border border-cyan-300/20 bg-cyan-400/[0.05] p-4">
              <p className="text-xs font-black uppercase text-cyan-200">Custo sobre a receita</p>
              <p className="mt-2 text-4xl font-black text-white">{costShare.toFixed(1).replace('.', ',')}%</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                No cenário atual, o custo regular estimado representa apenas essa parcela da receita mensal da carteira.
              </p>
            </div>
            <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4">
              <p className="text-xs font-black uppercase text-emerald-200">Receita comparada à assinatura</p>
              <p className="mt-2 text-3xl font-black text-white">{returnMultiple.toFixed(1).replace('.', ',')}x</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Sua carteira estimada é maior que o custo da plataforma. Organização, retenção e percepção de valor ajudam a proteger esse resultado.
              </p>
            </div>
          </Panel>

          <Panel title="Pagamento da assinatura" action={subscriptionActive ? 'Conta ativa' : 'Oferta ativa'}>
            <p className="text-sm leading-6 text-zinc-400">
              {subscriptionActive
                ? 'Sua assinatura está confirmada. Se você acabou de pagar e ainda vê alguma área bloqueada, toque em atualizar status.'
                : 'Escolha o ciclo ideal para sua operação. Todos os planos liberam o painel completo, e a confirmação da Cartpanda desbloqueia suas ferramentas automaticamente.'}
            </p>
            {!subscriptionActive ? <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase text-amber-200">Importante para liberar automaticamente</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">
                No checkout, use o mesmo e-mail cadastrado aqui no Coach Fit Pro. E-mail diferente pode impedir a liberação automática das ferramentas.
              </p>
            </div> : null}
            {!subscriptionActive && checkoutPlans.length ? (
              <div className="mt-4 grid gap-3">
                {checkoutPlans.map((plan) => {
                  const selected = selectedCheckoutPlanId === plan.id
                  return (
                    <a
                      key={plan.id}
                      href={plan.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleCheckoutClick(plan.id)}
                      className={`rounded-md border p-4 transition hover:-translate-y-0.5 ${
                        selected
                          ? 'border-emerald-300/45 bg-emerald-300/12 shadow-lg shadow-emerald-950/20'
                          : 'border-white/10 bg-white/[0.035]'
                      }`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-white">{plan.name}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">{plan.cycle}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          selected ? 'bg-emerald-400 text-zinc-950' : 'bg-white/10 text-zinc-300'
                        }`}>
                          {selected ? 'Escolhido' : plan.badge}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400">{plan.description}</p>
                      <div className="mt-3 rounded-md border border-white/10 bg-zinc-950/50 p-3">
                        {plan.oldPrice ? <p className="text-xs font-bold text-zinc-500 line-through">De {plan.oldPrice}</p> : null}
                        <div className="mt-1 flex flex-wrap items-end gap-2">
                          <span className="text-2xl font-black text-white">{plan.price}</span>
                          <span className="pb-1 text-xs font-bold text-zinc-500">{plan.suffix}</span>
                        </div>
                        <p className="mt-1 text-xs font-black text-emerald-200">{plan.total}</p>
                      </div>
                      <p className="mt-3 text-sm font-black text-emerald-200">Ativar este plano</p>
                    </a>
                  )
                })}
              </div>
            ) : !subscriptionActive ? (
              <button type="button" disabled className="mt-4 w-full rounded-md bg-zinc-800 px-4 py-3 text-sm font-black text-zinc-500">
                Pagamento em configuração
              </button>
            ) : null}
            <button type="button" onClick={() => checkPaymentStatus(false)} disabled={checkingPayment} className="mt-3 w-full rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:cursor-wait disabled:opacity-60">
              {checkingPayment ? 'Verificando...' : subscriptionActive ? 'Atualizar status da assinatura' : 'Verificar pagamento agora'}
            </button>
            {paymentMessage ? <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-300">{paymentMessage}</p> : null}
            <button type="button" onClick={copyBillingSummary} className="mt-3 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              {copied ? 'Resumo copiado' : 'Copiar resumo da cobrança'}
            </button>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Depois do checkout, o app verifica a assinatura automaticamente quando você voltar para esta aba e também pelo botão de atualização.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function SubscriptionMetric({ label, value, detail, tone }) {
  const toneClass = {
    cyan: 'border-cyan-300/20 bg-cyan-400/[0.05] text-cyan-200',
    emerald: 'border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-200',
    amber: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200',
  }[tone] || 'border-white/10 bg-white/[0.03] text-zinc-200'

  return (
    <div className={`min-w-0 rounded-md border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  )
}

function BillingLine({ label, value, note }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="break-words text-sm font-black text-zinc-200">{label}</p>
        <p className="mt-1 break-words text-xs text-zinc-500">{note}</p>
      </div>
      <p className="shrink-0 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function Payments({ students, invoices, coachSettings, coachPlans = plans, onSaveInvoice, onUpdateInvoiceStatus, onUpdatePayment }) {
  const [filter, setFilter] = useState('Todos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const paidTotal = invoices
    .filter((invoice) => invoice.status === 'Pago')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const now = new Date()
  const paidThisMonth = invoices
    .filter((invoice) => {
      if (invoice.status !== 'Pago') return false
      const paidAt = new Date(invoice.paidAt || invoice.dueDate)
      return paidAt.getMonth() === now.getMonth() && paidAt.getFullYear() === now.getFullYear()
    })
  const salesThisMonth = paidThisMonth.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const renewalsNext7Days = invoices.filter((invoice) => {
    const status = getInvoiceStatus(invoice)
    if (['Pago', 'Cancelado'].includes(status)) return false
    const due = new Date(`${invoice.dueDate}T12:00:00`)
    const diffDays = Math.ceil((due - now) / 86400000)
    return diffDays >= 0 && diffDays <= 7
  })
  const paidCount = invoices.filter((invoice) => invoice.status === 'Pago').length
  const averageTicket = paidCount ? paidTotal / paidCount : 0
  const forecast30Days = invoices
    .filter((invoice) => {
      const status = getInvoiceStatus(invoice)
      if (['Pago', 'Cancelado'].includes(status)) return false
      const due = new Date(`${invoice.dueDate}T12:00:00`)
      const diffDays = Math.ceil((due - now) / 86400000)
      return diffDays >= 0 && diffDays <= 30
    })
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const activePlanRevenue = students
    .filter((student) => student.status !== 'Inativo')
    .reduce((sum, student) => sum + getPlanMonthlyPrice(student.plan, coachPlans), 0)
  const planSummary = coachPlans.map((plan) => ({
    ...plan,
    students: students.filter((student) => student.plan === plan.name && student.status !== 'Inativo').length,
    billingValue: getPlanBillingAmount(plan.name, coachPlans),
    monthlyValue: getPlanMonthlyPrice(plan.name, coachPlans),
  }))
  const pendingTotal = invoices
    .filter((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const pendingCount = invoices.filter((invoice) => getInvoiceStatus(invoice) === 'Pendente').length
  const overdueCount = invoices.filter((invoice) => getInvoiceStatus(invoice) === 'Atrasado').length
  const overdueTotal = invoices
    .filter((invoice) => getInvoiceStatus(invoice) === 'Atrasado')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const renewalValue7Days = renewalsNext7Days.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const paidStudents = students.filter((student) => student.payment === 'Pago').length
  const activeStudents = students.filter((student) => student.status !== 'Inativo').length
  const paymentRate = activeStudents ? Math.round((paidStudents / activeStudents) * 100) : 0
  const visibleInvoices = invoices
    .map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) }))
    .filter((invoice) => filter === 'Todos' || invoice.status === filter)
    .slice()
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

  async function handleSubmit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const student = students.find((item) => String(item.id) === String(form.get('studentId')))
    const amount = Number(form.get('amount'))

    setSaving(true)
    setMessage('')
    setError('')
    try {
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor de cobrança maior que zero.')
      await onSaveInvoice({
        studentId: form.get('studentId')?.toString() || '',
        planName: form.get('planName')?.toString() || coachPlans[0]?.name || 'Acompanhamento',
        description: form.get('description')?.toString() || 'Mensalidade do acompanhamento',
        amount,
        dueDate: form.get('dueDate')?.toString() || '',
        status: 'Pendente',
        paymentMethod: '',
      })
      if (student?.payment === 'Pago') {
        const paymentUpdated = await onUpdatePayment(student.id, 'Pendente')
        if (!paymentUpdated) {
          setError('A cobrança foi criada, mas o status financeiro do aluno não pôde ser atualizado.')
        }
      }
      formElement.reset()
      setMessage('Cobrança criada com sucesso.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível criar a cobrança.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInvoiceStatus(invoiceId, status, paymentMethod = '') {
    setUpdatingId(String(invoiceId))
    setError('')
    try {
      const updated = await onUpdateInvoiceStatus(invoiceId, status, paymentMethod)
      if (updated === 'partial') {
        setError('A cobrança foi atualizada, mas o status financeiro do aluno não pôde ser sincronizado.')
      } else if (!updated) {
        setError('Não foi possível atualizar esta cobrança.')
      }
    } finally {
      setUpdatingId('')
    }
  }

  async function handleCreateAutoCharges() {
    const openStudentIds = new Set(
      invoices
        .filter((invoice) => ['Pendente', 'Atrasado'].includes(getInvoiceStatus(invoice)))
        .map((invoice) => String(invoice.studentId)),
    )
    const chargeableStudents = students.filter((student) => (
      student.status !== 'Inativo'
      && student.payment !== 'Pago'
      && !openStudentIds.has(String(student.id))
    ))

    if (!chargeableStudents.length) {
      setMessage('Nenhum aluno pendente sem cobrança em aberto.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')
    try {
      for (const student of chargeableStudents) {
        const amount = getPlanBillingAmount(student.plan, coachPlans) || 197
        const dueDate = getDefaultDueDate()
        await onSaveInvoice({
          studentId: student.id,
          planName: student.plan || 'Acompanhamento',
          description: buildBillingMessage(coachSettings?.billingMessage, { student, amount, dueDate, coachSettings }),
          amount,
          dueDate,
          status: 'Pendente',
          paymentMethod: 'Pix',
        })
      }
      setMessage(`${chargeableStudents.length} cobrança(s) criada(s) automaticamente.`)
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível gerar as cobranças automáticas.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6">
      <section className="rounded-md border border-emerald-300/20 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-emerald-300">Dashboard financeiro</p>
            <h3 className="mt-2 text-2xl font-black text-white">Vendas, renovações e previsibilidade</h3>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">Atualizado em tempo real</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Receita ativa" value={formatCurrency(activePlanRevenue)} detail={`${activeStudents} aluno(s) ativos`} />
          <Metric label="Vendas no mês" value={formatCurrency(salesThisMonth)} detail={`${paidThisMonth.length} pagamentos confirmados`} />
          <Metric label="Recebido total" value={formatCurrency(paidTotal)} detail={`${paidCount} pagamentos`} />
          <Metric label="A receber" value={formatCurrency(pendingTotal)} detail="pendentes e atrasados" />
          <Metric label="Renovações 7 dias" value={renewalsNext7Days.length} detail={formatCurrency(renewalValue7Days)} />
          <Metric label="Taxa paga" value={`${paymentRate}%`} detail={`${paidStudents} aluno(s) liberados`} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-blue-200">Previsão dos próximos 30 dias</p>
                <p className="mt-2 text-3xl font-black text-white">{formatCurrency(forecast30Days)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Carteira ativa/mês</p>
                <p className="mt-1 text-lg font-black text-emerald-200">{formatCurrency(activePlanRevenue)}</p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-gradient-to-r from-emerald-300 to-blue-500" style={{ width: `${Math.min(100, Math.round((salesThisMonth / Math.max(1, activePlanRevenue)) * 100))}%` }} />
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase text-zinc-400">Status financeiro</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div><p className="text-lg font-black text-amber-200">{pendingCount}</p><p className="text-xs text-zinc-500">pendentes</p></div>
              <div><p className="text-lg font-black text-rose-200">{overdueCount}</p><p className="text-xs text-zinc-500">atrasadas</p></div>
              <div><p className="text-lg font-black text-emerald-200">{paidStudents}</p><p className="text-xs text-zinc-500">liberados</p></div>
            </div>
            <div className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/8 p-3">
              <p className="text-xs font-black uppercase text-rose-200">Valor em atraso</p>
              <p className="mt-1 text-xl font-black text-white">{formatCurrency(overdueTotal)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-amber-200">Cobrança automática dos alunos</p>
            <p className="mt-2 text-sm leading-6 text-zinc-200">
              Gere cobranças para alunos pendentes, bloqueie o acesso até a validação e envie os dados de Pix do coach no próprio app.
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Pix: {coachSettings?.pixKey || 'cadastre em Configurações'} | WhatsApp: {coachSettings?.whatsapp || 'não informado'}
            </p>
          </div>
          <button type="button" disabled={saving} onClick={handleCreateAutoCharges} className="rounded-md bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-60">
            Gerar cobranças pendentes
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Gerar cobrança" action="Financeiro">
          {students.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Select label="Aluno" name="studentId" options={students.map((student) => ({ label: student.name, value: student.id }))} />
              <Field label="Nome do plano" name="planName" defaultValue={coachPlans[0]?.name || 'Acompanhamento mensal'} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor (R$)" name="amount" type="number" defaultValue={String(getPlanBillingAmount(coachPlans[0]?.name, coachPlans) || 197)} />
                <Field label="Vencimento" name="dueDate" type="date" defaultValue={getDefaultDueDate()} />
              </div>
              <Field label="Descrição" name="description" defaultValue="Mensalidade do acompanhamento" />
              <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
                {saving ? 'Gerando...' : 'Gerar cobrança'}
              </button>
              {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
              {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
            </form>
          ) : (
            <Empty text="Cadastre um aluno antes de gerar cobranças." />
          )}

          <div className="mt-5 grid gap-3">
            {planSummary.map((plan) => (
              <div key={plan.name} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black">{plan.name}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{plan.features}</p>
                    <p className="mt-2 text-xs font-bold text-zinc-500">{getPlanCycleLabel(plan)} · {plan.students} aluno(s) ativo(s)</p>
                  </div>
                  <span className="text-right text-lg font-black text-blue-300">{formatCurrency(plan.billingValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Histórico de cobranças" action={`${visibleInvoices.length} registros`}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {['Todos', 'Pendente', 'Pago', 'Atrasado', 'Cancelado'].map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-black ${
                  filter === option
                    ? 'border-blue-500 bg-blue-500 text-zinc-950'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {visibleInvoices.length ? (
              visibleInvoices.map((invoice) => {
                const student = students.find((item) => String(item.id) === String(invoice.studentId))
                return (
                  <div key={invoice.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <InvoiceStatus status={invoice.status} />
                          <span className="text-xs text-zinc-500">{invoice.planName}</span>
                        </div>
                        <h4 className="mt-3 font-black">{student?.name ?? 'Aluno'}</h4>
                        <p className="mt-1 text-sm text-zinc-400">{invoice.description}</p>
                        <p className="mt-3 text-xl font-black text-blue-200">{formatCurrency(invoice.amount)}</p>
                        <p className="mt-1 text-sm text-zinc-400">Vence em {formatDate(invoice.dueDate)}</p>
                        {invoice.paidAt ? <p className="mt-1 text-xs text-zinc-500">Pago em {formatDateTime(invoice.paidAt)} via {invoice.paymentMethod || 'não informado'}</p> : null}
                      </div>

                      {!['Pago', 'Cancelado'].includes(invoice.status) ? (
                        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-1">
                          <button disabled={updatingId === String(invoice.id)} onClick={() => handleInvoiceStatus(invoice.id, 'Pago')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950 transition active:scale-[0.98] disabled:opacity-50">
                            Confirmar e liberar
                          </button>
                          <button disabled={updatingId === String(invoice.id)} onClick={() => handleInvoiceStatus(invoice.id, 'Cancelado')} className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200 transition active:scale-[0.98] disabled:opacity-50">
                            Cancelar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <Empty text="Nenhuma cobrança encontrada neste filtro." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function InvoiceStatus({ status }) {
  const className = status === 'Pago'
    ? 'border-blue-300/40 bg-blue-300/10 text-blue-200'
    : status === 'Atrasado'
      ? 'border-rose-300/40 bg-rose-300/10 text-rose-200'
      : status === 'Cancelado'
        ? 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300'
        : 'border-amber-300/40 bg-amber-300/10 text-amber-200'

  return (
    <span className={`w-fit rounded border px-2 py-1 text-xs font-black ${className}`}>
      {status}
    </span>
  )
}

function getInvoiceStatus(invoice) {
  if (invoice.status !== 'Pendente') return invoice.status
  const dueDate = new Date(`${invoice.dueDate}T23:59:59`)
  return dueDate < new Date() ? 'Atrasado' : 'Pendente'
}

function PaymentStatus({ status }) {
  const paid = status === 'Pago'

  return (
    <span className={`rounded border px-2 py-1 text-xs font-black ${
      paid
        ? 'border-blue-300/40 bg-blue-300/10 text-blue-200'
        : 'border-amber-300/40 bg-amber-300/10 text-amber-200'
    }`}>
      {paid ? 'Pago' : 'Pendente'}
    </span>
  )
}

function Notifications({ notifications, onReadAll }) {
  return (
    <Panel title="Central de notificações" action={`${notifications.filter((item) => !item.read).length} não lidas`}>
      <button onClick={onReadAll} className="mb-4 rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950">
        Marcar tudo como lido
      </button>
      <div className="grid gap-3 md:grid-cols-2">
        {notifications.map((item) => (
          <div key={item.id} className={`rounded-md border p-4 ${item.read ? 'border-white/10 bg-white/[0.03]' : 'border-amber-300/40 bg-amber-300/10'}`}>
            <h4 className="font-black">{item.title}</h4>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function SmartNotifications({ notifications, smartAlerts, onReadAll, onOpenView }) {
  const unread = notifications.filter((item) => !item.read).length

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Alertas inteligentes" action={`${smartAlerts.length} ativos`}>
        <div className="grid gap-3">
          {smartAlerts.length ? (
            smartAlerts.map((alert) => (
              <SmartAlertCard key={alert.id} alert={alert} onOpen={() => onOpenView(alert.view)} />
            ))
          ) : (
            <Empty text="Tudo em ordem com pagamentos, check-ins e prescrições." />
          )}
        </div>
      </Panel>

      <Panel title="Central de notificações" action={`${unread} não lidas`}>
        <button onClick={onReadAll} className="mb-4 w-full rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 sm:w-auto">
          Marcar tudo como lido
        </button>
        <div className="grid gap-3">
          {notifications.length ? (
            notifications.map((item) => (
              <div key={item.id} className={`rounded-md border p-4 ${item.read ? 'border-white/10 bg-white/[0.03]' : 'border-amber-300/40 bg-amber-300/10'}`}>
                <h4 className="font-black">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma notificação registrada ainda." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function SmartAlertCard({ alert, compact = false, onOpen }) {
  const toneClass = {
    Alto: 'border-rose-300/40 bg-rose-300/10 text-rose-100',
    Medio: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
    Baixo: 'border-blue-300/30 bg-blue-300/10 text-blue-100',
  }[alert.priority] ?? 'border-white/10 bg-white/[0.03] text-zinc-100'

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-950/30 px-2 py-1 text-[11px] font-black uppercase tracking-normal">{formatUiText(alert.type)}</span>
            <span className="text-xs font-black">{formatUiText(alert.priority)}</span>
          </div>
          <h4 className="mt-3 font-black text-zinc-50">{alert.title}</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{alert.body}</p>
        </div>
        <button onClick={onOpen} className="shrink-0 rounded-md bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-950">
          {compact ? 'Abrir' : alert.action}
        </button>
      </div>
    </div>
  )
}

function AdminMaster({ settings, onSave, remoteStatus, remoteError }) {
  const [draft, setDraft] = useState(() => normalizeAdminSettings(settings))
  const [salesContentJson, setSalesContentJson] = useState(() => JSON.stringify(normalizeAdminSettings(settings).salesContent, null, 2))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [overview, setOverview] = useState({ users: [], subscriptions: [] })
  const [overviewError, setOverviewError] = useState('')
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [updatingCoachId, setUpdatingCoachId] = useState('')

  useEffect(() => {
    const normalized = normalizeAdminSettings(settings)
    setDraft(normalized)
    setSalesContentJson(JSON.stringify(normalized.salesContent, null, 2))
  }, [settings])

  const refreshOverview = useCallback(async () => {
    if (!supabaseEnabled) return
    setLoadingOverview(true)
    setOverviewError('')
    try {
      const loaded = await loadRemoteAdminOverview()
      setOverview(loaded)
    } catch (error) {
      setOverviewError(error?.message || 'Não foi possível carregar usuários e assinaturas.')
    } finally {
      setLoadingOverview(false)
    }
  }, [])

  useEffect(() => {
    refreshOverview()
  }, [refreshOverview])

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateFlag(field, value) {
    setDraft((current) => ({
      ...current,
      featureFlags: { ...current.featureFlags, [field]: value },
    }))
  }

  function updatePlan(planIndex, field, value) {
    setDraft((current) => ({
      ...current,
      checkoutPlans: current.checkoutPlans.map((plan, index) => (
        index === planIndex ? { ...plan, [field]: value } : plan
      )),
    }))
  }

  function updatePlanList(planIndex, field, value, separator = '\n') {
    const items = value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean)
    updatePlan(planIndex, field, items)
  }

  function parseSalesContentJson() {
    try {
      const parsed = JSON.parse(salesContentJson)
      const normalized = normalizeSalesContent(parsed)
      setJsonError('')
      return normalized
    } catch (error) {
      setJsonError('JSON inválido. Revise vírgulas, aspas e chaves antes de salvar.')
      return null
    }
  }

  function applySalesContentJson() {
    const parsed = parseSalesContentJson()
    if (!parsed) return
    setDraft((current) => ({ ...current, salesContent: parsed }))
    setSalesContentJson(JSON.stringify(parsed, null, 2))
    setMessage('Conteúdo avançado aplicado no rascunho. Clique em salvar para publicar.')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const parsedContent = parseSalesContentJson()
    if (!parsedContent) return
    setSaving(true)
    setMessage('')
    try {
      const normalizedDraft = normalizeAdminSettings({ ...draft, salesContent: parsedContent })
      await onSave(normalizedDraft)
      setDraft(normalizedDraft)
      setSalesContentJson(JSON.stringify(normalizedDraft.salesContent, null, 2))
      setMessage('Configurações salvas. As próximas visitas já usam esta versão.')
    } finally {
      setSaving(false)
    }
  }

  function resetDefaults() {
    const normalized = normalizeAdminSettings(defaultAppAdminSettings)
    setDraft(normalized)
    setSalesContentJson(JSON.stringify(normalized.salesContent, null, 2))
    setMessage('Padrão carregado. Clique em salvar para publicar.')
  }

  async function updateCoachSubscription(coachId, status) {
    if (!coachId) return
    setUpdatingCoachId(coachId)
    setOverviewError('')
    try {
      const next = new Date()
      next.setMonth(next.getMonth() + 1)
      await updateRemoteAdminCoachSubscription({
        coachId,
        status,
        provider: 'manual_admin',
        paidAt: status === 'active' ? new Date().toISOString() : null,
        currentPeriodEndsAt: status === 'active' ? next.toISOString() : null,
        nextBillingAt: status === 'active' ? next.toISOString() : null,
      })
      await refreshOverview()
    } catch (error) {
      setOverviewError(error?.message || 'Não foi possível atualizar a assinatura.')
    } finally {
      setUpdatingCoachId('')
    }
  }

  const subscriptionByCoach = new Map((overview.subscriptions || []).map((item) => [String(item.coachId), item]))

  return (
    <div className="grid gap-5 lg:gap-6">
      <section className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-zinc-950/88 p-5 shadow-2xl shadow-black/25 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-emerald-300">Admin Master</p>
            <h2 className="mt-2 text-3xl font-black text-white">Controle central do Coach Fit Pro.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Acesso liberado somente para {MASTER_ADMIN_EMAIL}. Edite página de vendas, planos, checkout, módulos, suporte e assinaturas sem depender do GitHub para alterações comerciais.
            </p>
          </div>
          <div className="rounded-xl border border-blue-300/20 bg-blue-400/10 p-4">
            <p className="text-xs font-black uppercase text-blue-200">Status</p>
            <p className="mt-2 text-sm font-bold text-zinc-200">{remoteStatus || 'Pronto'}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {remoteError ? remoteError : 'Quando o SQL atualizado estiver aplicado, salvar aqui publica no Supabase.'}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:gap-6">
        <Panel title="Página de vendas" action="Textos e operação">
          <div className="grid gap-4">
            <AdminTextInput label="Título principal" value={draft.salesHeadline} onChange={(value) => updateField('salesHeadline', value)} />
            <AdminTextArea label="Descrição principal" value={draft.salesSubheadline} onChange={(value) => updateField('salesSubheadline', value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextInput label="Texto do botão principal" value={draft.salesCta} onChange={(value) => updateField('salesCta', value)} />
              <AdminTextInput label="Aviso abaixo do botão" value={draft.announcement} onChange={(value) => updateField('announcement', value)} />
              <AdminTextInput label="Plano selecionado por padrão" value={draft.defaultCheckoutPlanId} onChange={(value) => updateField('defaultCheckoutPlanId', value)} />
              <AdminTextInput label="E-mail de suporte" value={draft.supportEmail} onChange={(value) => updateField('supportEmail', value)} />
              <AdminTextInput label="WhatsApp de suporte" value={draft.supportWhatsapp} onChange={(value) => updateField('supportWhatsapp', value)} />
              <AdminTextInput label="Aviso de manutenção" value={draft.maintenanceNotice} onChange={(value) => updateField('maintenanceNotice', value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminCheckbox label="Página de vendas ativa" checked={draft.salesPageEnabled !== false} onChange={(checked) => updateField('salesPageEnabled', checked)} />
              <AdminCheckbox label="Permitir criação de conta pela página" checked={draft.signupEnabled !== false} onChange={(checked) => updateField('signupEnabled', checked)} />
            </div>
          </div>
        </Panel>

        <Panel title="Página principal de vendas" action="Editor avançado">
          <p className="mb-3 text-sm leading-6 text-zinc-400">
            Este JSON controla menu, cards, seções, dúvidas, textos dos blocos, rodapé e microcopy da página de vendas. Edite com cuidado e clique em “Aplicar JSON” antes de salvar.
          </p>
          <textarea
            value={salesContentJson}
            onChange={(event) => setSalesContentJson(event.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 font-mono text-xs leading-5 text-zinc-100 outline-none transition focus:border-emerald-300/50"
          />
          {jsonError ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{jsonError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={applySalesContentJson} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100">
              Aplicar JSON no rascunho
            </button>
            <button type="button" onClick={() => setSalesContentJson(JSON.stringify(defaultSalesContent, null, 2))} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              Carregar conteúdo padrão da página
            </button>
          </div>
        </Panel>

        <Panel title="Planos e checkout" action={`${draft.checkoutPlans.length} planos`}>
          <div className="grid gap-4">
            {draft.checkoutPlans.map((plan, index) => (
              <div key={plan.id || index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-zinc-500">Plano {index + 1}</p>
                    <h3 className="mt-1 text-xl font-black text-white">{plan.name}</h3>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">{plan.badge}</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <AdminTextInput label="ID interno do plano" value={plan.id} onChange={(value) => updatePlan(index, 'id', value)} />
                  <AdminTextInput label="Nome" value={plan.name} onChange={(value) => updatePlan(index, 'name', value)} />
                  <AdminTextInput label="Ciclo" value={plan.cycle} onChange={(value) => updatePlan(index, 'cycle', value)} />
                  <AdminTextInput label="Selo do card" value={plan.badge} onChange={(value) => updatePlan(index, 'badge', value)} />
                  <AdminTextInput label="Preço" value={plan.price} onChange={(value) => updatePlan(index, 'price', value)} />
                  <AdminTextInput label="Complemento do preço" value={plan.suffix} onChange={(value) => updatePlan(index, 'suffix', value)} />
                  <AdminTextInput label="Preço antigo" value={plan.oldPrice || ''} onChange={(value) => updatePlan(index, 'oldPrice', value)} />
                  <AdminTextInput label="Comparativo" value={plan.total} onChange={(value) => updatePlan(index, 'total', value)} />
                  <AdminTextInput label="Vantagem" value={plan.economy} onChange={(value) => updatePlan(index, 'economy', value)} />
                  <AdminTextInput label="Link Cartpanda" value={plan.checkoutUrl} onChange={(value) => updatePlan(index, 'checkoutUrl', value)} />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <AdminTextArea label="Descrição" value={plan.description} onChange={(value) => updatePlan(index, 'description', value)} />
                  <AdminTextArea label="Melhor para" value={plan.bestFor} onChange={(value) => updatePlan(index, 'bestFor', value)} />
                  <AdminTextArea label="Promessa operacional" value={plan.operatingPromise} onChange={(value) => updatePlan(index, 'operatingPromise', value)} />
                  <AdminTextArea label="Itens inclusos, um por linha" value={(plan.highlights || []).join('\n')} onChange={(value) => updatePlanList(index, 'highlights', value)} />
                  <AdminTextArea label="Passos de implantação, um por linha" value={(plan.activationPlan || []).join('\n')} onChange={(value) => updatePlanList(index, 'activationPlan', value)} />
                  <AdminTextArea label="Gatilhos do plano, separados por vírgula" value={(plan.decisionPoints || []).join(', ')} onChange={(value) => updatePlanList(index, 'decisionPoints', value, ',')} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Branding global" action="Visual">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextInput label="Cor principal" value={draft.primaryColor} onChange={(value) => updateField('primaryColor', value)} />
              <AdminTextInput label="Cor de apoio" value={draft.accentColor} onChange={(value) => updateField('accentColor', value)} />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${draft.primaryColor}22, ${draft.accentColor}22)` }}>
              <p className="text-sm font-black text-white">Prévia das cores</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">Essas cores ficam disponíveis para a página de vendas e próximas evoluções visuais do app.</p>
            </div>
          </Panel>

          <Panel title="Módulos ativos" action="Funcionalidades">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['studentXp', 'XP e selos do aluno'],
                ['financialDashboard', 'Dashboard financeiro'],
                ['salesSimulator', 'Simulador da página inicial'],
                ['waterGoal', 'Meta de água interativa'],
                ['salesAppVisual', 'Seção visual do app'],
                ['salesCommandCenter', 'Seção comando financeiro'],
                ['salesComparison', 'Seção antes e depois'],
                ['salesFaq', 'Dúvidas frequentes'],
              ].map(([key, label]) => (
                <AdminCheckbox key={key} label={label} checked={Boolean(draft.featureFlags?.[key])} onChange={(checked) => updateFlag(key, checked)} />
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Coaches e assinaturas" action={loadingOverview ? 'Carregando' : `${overview.users.length} usuários`}>
          {overviewError ? <p className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">{overviewError}</p> : null}
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={refreshOverview} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              Atualizar lista
            </button>
          </div>
          <div className="grid gap-3">
            {overview.users.length ? overview.users.map((user) => {
              const subscription = subscriptionByCoach.get(String(user.id))
              const status = subscription?.status || 'sem assinatura'
              return (
                <div key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-zinc-500">{user.role || 'Coach'}</p>
                      <h3 className="mt-1 break-words text-lg font-black text-white">{user.name || user.email}</h3>
                      <p className="mt-1 break-words text-sm text-zinc-400">{user.email}</p>
                      <p className="mt-2 text-xs text-zinc-500">Criado em {formatDate(user.createdAt)}</p>
                    </div>
                    <div className="grid gap-2 sm:min-w-64">
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${isCoachSubscriptionActive(subscription) ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>
                        {status}
                      </span>
                      <p className="text-xs leading-5 text-zinc-500">Próxima cobrança: {subscription?.nextBillingAt ? formatDate(subscription.nextBillingAt) : 'não definida'}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={updatingCoachId === user.id} onClick={() => updateCoachSubscription(user.id, 'active')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">Ativar</button>
                        <button type="button" disabled={updatingCoachId === user.id} onClick={() => updateCoachSubscription(user.id, 'past_due')} className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-100 disabled:opacity-50">Pendente</button>
                        <button type="button" disabled={updatingCoachId === user.id} onClick={() => updateCoachSubscription(user.id, 'canceled')} className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-50">Bloquear</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }) : <Empty text="Nenhum usuário encontrado ou RLS ainda não liberou a visão admin." />}
          </div>
        </Panel>

        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/92 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-zinc-400">
            Depois de salvar no Supabase, textos, planos, links, módulos e conteúdo da página mudam sem novo deploy.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={resetDefaults} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              Restaurar padrão
            </button>
            <button disabled={saving} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar Admin Master'}
            </button>
          </div>
        </div>

        {message ? <p className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p> : null}
      </form>
    </div>
  )
}

function AdminTextInput({ label, value, onChange }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/50" />
    </label>
  )
}

function AdminTextArea({ label, value, onChange, rows = 4 }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={rows} className="min-h-28 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none transition focus:border-emerald-300/50" />
    </label>
  )
}

function AdminCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <span className="text-sm font-black text-zinc-100">{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-emerald-400" />
    </label>
  )
}

function CoachSettings({ user, settings, onSave, onExport }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const current = {
    brandName: settings?.brandName || 'FitCoach',
    publicName: settings?.publicName || user?.name || '',
    cref: settings?.cref || '',
    whatsapp: settings?.whatsapp || '',
    supportEmail: settings?.supportEmail || user?.email || '',
    pixKey: settings?.pixKey || '',
    billingLogoUrl: settings?.billingLogoUrl || '',
    billingPrimaryColor: settings?.billingPrimaryColor || '#10b981',
    billingAccentColor: settings?.billingAccentColor || '#0f172a',
    billingMessage: settings?.billingMessage || 'Olá, {aluno}. Seu acesso está aguardando pagamento. Valor: {valor}. Vencimento: {vencimento}. Pix: {pix}. Após pagar, envie o comprovante no chat para validação.',
    customPlans: getCoachPlans(settings),
    welcomeMessage: settings?.welcomeMessage || 'Mantenha o plano, registre seu treino e use o check-in para me contar como você está evoluindo.',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  }
  const [billingLogoUrl, setBillingLogoUrl] = useState(current.billingLogoUrl)
  const [plansDraft, setPlansDraft] = useState(formatPlansDraft(current.customPlans))

  useEffect(() => {
    setBillingLogoUrl(current.billingLogoUrl)
    setPlansDraft(formatPlansDraft(current.customPlans))
  }, [settings?.billingLogoUrl, settings?.customPlans])

  function handleBillingLogoFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida para a logo.')
      event.target.value = ''
      return
    }
    if (file.size > 900 * 1024) {
      setError('Use uma logo com até 900 KB para manter o app rápido.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setBillingLogoUrl(reader.result.toString())
      setError('')
    }
    reader.onerror = () => setError('Não foi possível carregar esta logo.')
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onSave({
        brandName: form.get('brandName')?.toString().trim() || 'Coach Fit Pro',
        publicName: form.get('publicName')?.toString().trim() || '',
        cref: form.get('cref')?.toString().trim() || '',
        whatsapp: form.get('whatsapp')?.toString().trim() || '',
        supportEmail: form.get('supportEmail')?.toString().trim() || '',
        pixKey: form.get('pixKey')?.toString().trim() || '',
        billingLogoUrl: form.get('billingLogoUrlDisplay')?.toString().trim() || billingLogoUrl || '',
        billingPrimaryColor: form.get('billingPrimaryColor')?.toString().trim() || '#10b981',
        billingAccentColor: form.get('billingAccentColor')?.toString().trim() || '#0f172a',
        billingMessage: form.get('billingMessage')?.toString().trim() || current.billingMessage,
        customPlans: parseCustomPlans(plansDraft),
        welcomeMessage: form.get('welcomeMessage')?.toString().trim() || '',
        timezone: current.timezone,
      })
      setMessage('Configurações profissionais atualizadas.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar as configurações.')
    } finally {
      setSaving(false)
    }
  }

  const readiness = [
    { label: 'Nome profissional', ready: Boolean(settings?.publicName) },
    { label: 'Marca do treinador', ready: Boolean(settings?.brandName) },
    { label: 'WhatsApp de suporte', ready: Boolean(settings?.whatsapp) },
    { label: 'Chave Pix para cobranças', ready: Boolean(settings?.pixKey) },
    { label: 'Planos próprios', ready: getCoachPlans(settings).length > 0 },
    { label: 'Marca da cobrança', ready: Boolean(settings?.billingMessage || settings?.billingLogoUrl) },
    { label: 'Registro profissional', ready: Boolean(settings?.cref) },
    { label: 'Mensagem para alunos', ready: Boolean(settings?.welcomeMessage) },
  ]

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Panel title="Identidade profissional" action="Conta do treinador">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da marca" name="brandName" defaultValue={current.brandName} />
            <Field label="Nome público" name="publicName" defaultValue={current.publicName} />
            <Field label="CREF ou registro" name="cref" defaultValue={current.cref} required={false} />
            <Field label="WhatsApp" name="whatsapp" defaultValue={current.whatsapp} required={false} />
            <Field label="E-mail de suporte" name="supportEmail" type="email" defaultValue={current.supportEmail} />
            <Field label="Chave Pix para cobranças" name="pixKey" defaultValue={current.pixKey} required={false} />
          </div>
          <TextArea label="Mensagem de boas-vindas para alunos" name="welcomeMessage" defaultValue={current.welcomeMessage} />
          <div className="rounded-md border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-emerald-100">Marca da cobrança do aluno</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Personalize a tela que o aluno inadimplente vê: logo, cor e mensagem com a linguagem do seu atendimento.
                </p>
              </div>
              {billingLogoUrl ? (
                <img src={billingLogoUrl} alt="Logo da cobrança" className="h-16 max-w-48 rounded-md border border-white/10 bg-white object-contain p-2" />
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Logo da cobrança
                <input type="file" accept="image/*" onChange={handleBillingLogoFile} className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-zinc-950" />
              </label>
              <Field label="Link da logo (opcional)" name="billingLogoUrlDisplay" defaultValue={billingLogoUrl} required={false} placeholder="Cole uma URL ou envie arquivo ao lado" />
              <Field label="Cor principal da cobrança" name="billingPrimaryColor" type="color" defaultValue={current.billingPrimaryColor} />
              <Field label="Cor de apoio" name="billingAccentColor" type="color" defaultValue={current.billingAccentColor} />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Variáveis disponíveis: {'{aluno}'}, {'{valor}'}, {'{vencimento}'}, {'{pix}'}, {'{whatsapp}'}, {'{email}'}.
            </p>
            <TextArea label="Mensagem de cobrança para o aluno" name="billingMessage" defaultValue={current.billingMessage} />
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-black text-zinc-100">Planos e valores do treinador</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Cadastre um plano por linha no formato: Nome do plano | Valor | Ciclo | Descrição. Ciclos aceitos: semanal, mensal, semestral ou anual.
            </p>
            <textarea
              value={plansDraft}
              onChange={(event) => setPlansDraft(event.target.value)}
              rows={6}
              className="mt-3 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none focus:border-emerald-500"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {getCoachPlans({ customPlans: parseCustomPlans(plansDraft) }).slice(0, 4).map((plan) => (
                <div key={plan.name} className="rounded-md border border-white/10 bg-zinc-950/70 p-3">
                  <p className="text-sm font-black text-white">{plan.name}</p>
                  <p className="mt-1 text-xs font-bold text-emerald-200">{formatCurrency(getPlanBillingAmount(plan.name, [plan]))} · {getPlanCycleLabel(plan)}</p>
                </div>
              ))}
            </div>
          </div>
          <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
          {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
          {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
        </form>
      </Panel>

      <div className="grid gap-4 lg:gap-6">
        <Panel title="Como o aluno vê" action="Prévia">
          <p className="text-xs font-bold uppercase tracking-normal text-blue-300">Acompanhamento online</p>
          <h3 className="mt-2 text-3xl font-black">{current.brandName}</h3>
          <p className="mt-2 text-sm text-zinc-400">{current.publicName}{current.cref ? ` - ${current.cref}` : ''}</p>
          <div className="mt-5 rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
            <p className="text-sm font-black text-blue-200">Mensagem do treinador</p>
            <p className="mt-2 text-sm leading-6 text-zinc-200">{current.welcomeMessage}</p>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-zinc-400">
            <p>{current.whatsapp || 'WhatsApp ainda não informado'}</p>
            <p>{current.supportEmail}</p>
            <p>{current.pixKey ? `Pix: ${current.pixKey}` : 'Chave Pix ainda não informada'}</p>
          </div>
        </Panel>

        <Panel title="Prévia da cobrança" action="Branding">
          <div className="rounded-md border p-4" style={{ borderColor: `${current.billingPrimaryColor}55`, background: `linear-gradient(135deg, ${current.billingPrimaryColor}20, ${current.billingAccentColor}18)` }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase" style={{ color: current.billingPrimaryColor }}>Pagamento pendente</p>
                <h3 className="mt-1 text-xl font-black text-white">{current.brandName}</h3>
              </div>
              {billingLogoUrl ? <img src={billingLogoUrl} alt="Logo da cobrança" className="h-14 max-w-36 rounded-md bg-white object-contain p-2" /> : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-200">
              {buildBillingMessage(current.billingMessage, {
                student: { name: 'Aluno exemplo' },
                amount: getPlanMonthlyPrice(getCoachPlans(settings)[0]?.name, getCoachPlans(settings)),
                dueDate: getDefaultDueDate(),
                coachSettings: current,
              })}
            </p>
          </div>
        </Panel>

        <Panel title="Prontidão da conta" action={`${readiness.filter((item) => item.ready).length}/${readiness.length}`}>
          <div className="grid gap-2">
            {readiness.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] p-3">
                <span className="text-sm font-bold">{item.label}</span>
                <span className={`text-xs font-black ${item.ready ? 'text-blue-300' : 'text-amber-300'}`}>
                  {item.ready ? 'Pronto' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={onExport} className="mt-4 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
            Baixar backup dos dados
          </button>
        </Panel>
      </div>
    </div>
  )
}

function Messages({ students, messages, onSendMessage, onMarkRead, onRefreshMessages }) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const selectedStudent = students.find((student) => String(student.id) === String(selectedStudentId)) ?? students[0]
  const studentMessages = messages
    .filter((message) => String(message.studentId) === String(selectedStudent?.id))
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))
  const latestMessageId = studentMessages.at(-1)?.id
  const suggestion = buildMessageSuggestion(selectedStudent)
  const unreadForSelected = studentMessages.filter((message) => message.sender === 'student' && !message.read).length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [latestMessageId, selectedStudent?.id])

  useEffect(() => {
    if (!selectedStudent?.id || !onRefreshMessages) return undefined
    let active = true
    const sync = () => {
      if (active) onRefreshMessages(selectedStudent.id)
    }
    sync()
    const timer = window.setInterval(sync, 2500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [selectedStudent?.id, onRefreshMessages])

  useEffect(() => () => {
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
  }, [attachmentPreview])

  useEffect(() => {
    if (selectedStudent?.id && unreadForSelected > 0) {
      onMarkRead(selectedStudent.id)
    }
  }, [selectedStudent?.id, unreadForSelected])

  function handleAttachment(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isAudio = file.type.startsWith('audio/')
    if (!isImage && !isAudio) {
      setError('Selecione uma imagem ou áudio válido.')
      event.target.value = ''
      return
    }
    const maxSize = isAudio ? 20 * 1024 * 1024 : 8 * 1024 * 1024
    if (file.size > maxSize) {
      setError(isAudio ? 'O áudio deve ter no máximo 20 MB.' : 'A foto deve ter no máximo 8 MB.')
      event.target.value = ''
      return
    }
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
    setError('')
    setAttachmentFile(file)
    setAttachmentPreview(URL.createObjectURL(file))
  }

  function clearAttachment() {
    if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
    setAttachmentFile(null)
    setAttachmentPreview('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const body = draft.trim()
    if ((!body && !attachmentFile) || !selectedStudent) return

    setSending(true)
    setError('')
    try {
      await onSendMessage({
        studentId: selectedStudent.id,
        sender: 'coach',
        body,
        attachmentFile,
        attachmentPreview,
      })
      setDraft('')
      clearAttachment()
    } catch (sendError) {
      setError(sendError?.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Panel title="Conversas" action={`${students.length} alunos`}>
        <div className="space-y-3">
          {students.map((student) => {
            const latestMessage = messages.find((message) => String(message.studentId) === String(student.id))
            const unread = messages.filter((message) => String(message.studentId) === String(student.id) && message.sender === 'student' && !message.read).length
            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`w-full rounded-md border p-4 text-left transition ${
                  String(selectedStudent?.id) === String(student.id)
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-black">{student.name}</h4>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-400">{latestMessage?.body ?? student.lastMessage}</p>
                  </div>
                  {unread ? <span className="rounded bg-amber-300 px-2 py-1 text-xs font-black text-zinc-950">{unread}</span> : null}
                </div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title={selectedStudent ? `Mensagem para ${selectedStudent.name}` : 'Mensagem'} action="Chat">
        <div className="mb-4 rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-normal text-blue-200">Resposta sugerida</p>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{suggestion}</p>
          <button onClick={() => setDraft(suggestion)} className="mt-3 rounded-md border border-blue-300/30 px-3 py-2 text-xs font-black text-blue-100">
            Usar sugestão
          </button>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {studentMessages.length ? (
            studentMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border p-4 ${
                  message.sender === 'coach'
                    ? 'ml-auto max-w-[92%] border-blue-300/30 bg-blue-300/10'
                    : 'mr-auto max-w-[92%] border-white/10 bg-white/[0.04]'
                }`}
              >
                <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{message.sender === 'coach' ? 'Coach' : 'Aluno'}</p>
                {message.body ? <p className="mt-2 text-sm leading-6 text-zinc-200">{message.body}</p> : null}
                <MessageAttachment message={message} />
                <p className="mt-2 text-xs text-zinc-500">{formatDateTime(message.createdAt)}</p>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma mensagem nesta conversa ainda." />
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Escreva a mensagem para o aluno..."
            className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
          />
          {attachmentPreview ? (
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start gap-3">
                {attachmentFile?.type?.startsWith('audio/') ? (
                  <audio controls src={attachmentPreview} className="w-full max-w-xs" />
                ) : (
                  <img src={attachmentPreview} alt="Prévia da foto" className="h-20 w-20 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold text-zinc-200">{attachmentFile?.name || 'Anexo selecionado'}</p>
                  <button type="button" onClick={clearAttachment} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200">
                    Remover anexo
                  </button>
                </div>
              </div>
            </div>
          ) : null}
            <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
              Foto/áudio
              <input type="file" accept="image/*,audio/*" onChange={handleAttachment} className="hidden" />
            </label>
            <AudioRecorderButton
              onAudio={(file) => {
                if (attachmentPreview?.startsWith('blob:')) URL.revokeObjectURL(attachmentPreview)
                setAttachmentFile(file)
                setAttachmentPreview(URL.createObjectURL(file))
                setError('')
              }}
              onError={setError}
            />
            <button disabled={sending || (!draft.trim() && !attachmentFile) || !selectedStudent} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60">
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </div>
          {error ? <p className="text-sm font-bold text-rose-200">{error}</p> : null}
        </form>
      </Panel>
    </div>
  )
}

function createBlankStudent() {
  return {
    id: 0,
    name: '',
    email: '',
    phone: '',
    cpf: '',
    goal: '',
    phase: 'Cadastro',
    status: 'Em dia',
    plan: 'Acompanhamento mensal',
    payment: 'Pendente',
    adherence: 0,
    risk: 'Baixo',
    nextCheckin: '',
    weight: '',
    bodyFat: '',
    calories: '',
    protein: '',
    workout: '',
    lastMessage: 'Cadastro concluído. Acompanhamento aguardando configuração.',
    requireAnamnesis: true,
    accessOverrideUntil: '',
    loadNotes: '',
    waterGoalMl: '2500',
  }
}

function ChartLoading() {
  return (
    <div className="grid h-64 min-w-0 place-items-center rounded-md border border-white/10 bg-white/[0.025] sm:h-72">
      <p className="text-sm font-bold text-zinc-500">Carregando gráfico...</p>
    </div>
  )
}

function BrandLockup({ subtitle = '', large = false, compact = false }) {
  return (
    <div
      className={`fit-brand-lockup grid aspect-[400/71] shrink-0 place-items-center ${
        large
          ? 'w-[min(88vw,34rem)]'
          : compact
            ? 'w-32 sm:w-36'
            : 'w-48 max-w-[72vw] sm:w-56 lg:w-48 xl:w-56'
      }`}
      title={subtitle}
    >
      <img
        src={fitCoachLogo}
        alt="Coach Fit Pro"
        className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.48)]"
        decoding="async"
        draggable="false"
      />
    </div>
  )
}

const navToneClasses = {
  emerald: {
    active: 'border-emerald-300/50 bg-emerald-400/10 text-emerald-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-emerald-300/35',
    iconActive: 'border-emerald-300/45 bg-emerald-300/20 text-emerald-100',
    iconIdle: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  },
  sky: {
    active: 'border-sky-300/50 bg-sky-400/10 text-sky-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-sky-300/35',
    iconActive: 'border-sky-300/45 bg-sky-300/20 text-sky-100',
    iconIdle: 'border-sky-300/20 bg-sky-300/10 text-sky-200',
  },
  cyan: {
    active: 'border-cyan-300/50 bg-cyan-400/10 text-cyan-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-cyan-300/35',
    iconActive: 'border-cyan-300/45 bg-cyan-300/20 text-cyan-100',
    iconIdle: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
  },
  amber: {
    active: 'border-amber-300/50 bg-amber-300/10 text-amber-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-amber-300/35',
    iconActive: 'border-amber-300/45 bg-amber-300/20 text-amber-100',
    iconIdle: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  },
  lime: {
    active: 'border-lime-300/50 bg-lime-300/10 text-lime-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-lime-300/35',
    iconActive: 'border-lime-300/45 bg-lime-300/20 text-lime-100',
    iconIdle: 'border-lime-300/20 bg-lime-300/10 text-lime-200',
  },
  orange: {
    active: 'border-orange-300/50 bg-orange-300/10 text-orange-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-orange-300/35',
    iconActive: 'border-orange-300/45 bg-orange-300/20 text-orange-100',
    iconIdle: 'border-orange-300/20 bg-orange-300/10 text-orange-200',
  },
  rose: {
    active: 'border-rose-300/50 bg-rose-300/10 text-rose-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-rose-300/35',
    iconActive: 'border-rose-300/45 bg-rose-300/20 text-rose-100',
    iconIdle: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
  },
  green: {
    active: 'border-green-300/50 bg-green-300/10 text-green-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-green-300/35',
    iconActive: 'border-green-300/45 bg-green-300/20 text-green-100',
    iconIdle: 'border-green-300/20 bg-green-300/10 text-green-200',
  },
  yellow: {
    active: 'border-yellow-300/50 bg-yellow-300/10 text-yellow-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-yellow-300/35',
    iconActive: 'border-yellow-300/45 bg-yellow-300/20 text-yellow-100',
    iconIdle: 'border-yellow-300/20 bg-yellow-300/10 text-yellow-200',
  },
  blue: {
    active: 'border-blue-300/50 bg-blue-400/10 text-blue-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-blue-300/35',
    iconActive: 'border-blue-300/45 bg-blue-300/20 text-blue-100',
    iconIdle: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
  },
  teal: {
    active: 'border-teal-300/50 bg-teal-300/10 text-teal-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-teal-300/35',
    iconActive: 'border-teal-300/45 bg-teal-300/20 text-teal-100',
    iconIdle: 'border-teal-300/20 bg-teal-300/10 text-teal-200',
  },
  slate: {
    active: 'border-slate-300/40 bg-slate-300/10 text-slate-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-slate-300/30',
    iconActive: 'border-slate-300/40 bg-slate-300/20 text-slate-100',
    iconIdle: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
  },
  indigo: {
    active: 'border-indigo-300/50 bg-indigo-300/10 text-indigo-50',
    idle: 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-indigo-300/35',
    iconActive: 'border-indigo-300/45 bg-indigo-300/20 text-indigo-100',
    iconIdle: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-200',
  },
}

function getNavToneClasses(tone) {
  return navToneClasses[tone] || navToneClasses.emerald
}

function NavIcon({ name, className = '' }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="M8 15l3-4 3 2 5-7" /><path d="M18 6h1v1" /></>,
    dumbbell: <><path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" /></>,
    nutrition: <><path d="M12 3c2.5 2.2 4 4.7 4 7.5A5.5 5.5 0 0 1 10.5 16 5.5 5.5 0 0 1 5 10.5C5 7.7 7.5 5 12 3Z" /><path d="M12 3c.5 3.3-.2 6-2 8" /><path d="M14 6c2.2-.4 4.1.1 5.5 1.5" /></>,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></>,
    wallet: <><path d="M3 7a2 2 0 0 1 2-2h14v4H5a2 2 0 0 1 0-4" /><path d="M3 7v12a2 2 0 0 0 2 2h16V9H5" /><path d="M17 14h.01" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    settings: <><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22h-3.34v-.18A1.65 1.65 0 0 0 9.4 20a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2v-3.34h.18A1.65 1.65 0 0 0 4 9.4a1.65 1.65 0 0 0 .33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2h3.34v.18A1.65 1.65 0 0 0 14.6 4a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.36.4.71.6 1h2v3.34h-.18A1.65 1.65 0 0 0 20 14.6c-.2.14-.4.27-.6.4Z" /></>,
    credit: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    water: <><path d="M12 2s6 6.5 6 12a6 6 0 0 1-12 0C6 8.5 12 2 12 2Z" /><path d="M9.5 15.5A3.1 3.1 0 0 0 12 17" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    chevronRight: <><path d="m9 18 6-6-6-6" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {icons[name] || icons.dashboard}
    </svg>
  )
}

function Metric({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <h3 className="mt-2 break-words text-2xl font-black sm:mt-3 sm:text-3xl">{value}</h3>
      <p className="mt-2 text-xs font-semibold text-blue-300">{detail}</p>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h3 className="text-base font-black sm:text-lg">{title}</h3>
        <span className="max-w-full break-words rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-right text-xs font-bold leading-5 text-zinc-300">{formatUiText(action)}</span>
      </div>
      {children}
    </section>
  )
}

function StudentSnapshot({ student }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">{student.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{student.goal || student.plan || 'Acompanhamento'}</p>
        </div>
        <Badge tone={student.risk}>{student.risk}</Badge>
      </div>
      <div className="mt-5 h-2 rounded bg-zinc-800">
        <div className="h-2 rounded bg-blue-500" style={{ width: `${clampPercent(student.adherence)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span>Constância</span>
        <span>{clampPercent(student.adherence)}%</span>
      </div>
      <p className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-300">{student.lastMessage}</p>
    </div>
  )
}

function Row({ title, meta, badge }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-bold">{title}</h4>
          <p className="mt-1 text-sm leading-5 text-zinc-400">{meta}</p>
        </div>
        <span className="max-w-full break-words rounded border border-white/10 px-2 py-1 text-right text-xs font-bold leading-5 text-zinc-300 sm:shrink-0">{formatUiText(badge)}</span>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue = '',
  required = true,
  inputMode,
  autoComplete,
  maxLength,
  placeholder,
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <input
        name={name}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        defaultValue={defaultValue}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
      />
    </label>
  )
}

function InlineInput({ label, value, onChange }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
      />
    </label>
  )
}

function InlineSelect({ label, value, options, onChange }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
      >
        {options.map((option) => <option key={option} value={option}>{formatUiText(option)}</option>)}
      </select>
    </label>
  )
}

function Select({ label, name, defaultValue, options }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
      >
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const labelText = typeof option === 'string' ? option : option.label
          return <option key={value} value={value}>{formatUiText(labelText)}</option>
        })}
      </select>
    </label>
  )
}

function TextArea({ label, name, defaultValue = '' }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-blue-500 sm:text-sm"
      />
    </label>
  )
}

function buildCoachActionPlan(smartAlerts = []) {
  const hasHighRisk = smartAlerts.some((alert) => alert.priority === 'Alto' && ['Risco', 'Check-in', 'Avaliacao'].includes(alert.type))
  const hasPrescriptionGap = smartAlerts.some((alert) => ['Treino', 'Nutrição'].includes(alert.type))
  const hasOverduePayment = smartAlerts.some((alert) => alert.type === 'Financeiro')
  const hasAgenda = smartAlerts.some((alert) => alert.type === 'Agenda')

  const actions = []

  if (hasHighRisk) {
    actions.push({
      title: 'Priorize alunos que podem perder ritmo',
      body: 'Comece pelos alertas de risco alto, check-ins críticos e avaliações atrasadas. Isso protege resultado e retenção.',
      view: 'notificacoes',
      tone: 'bg-rose-300',
    })
  }

  if (hasPrescriptionGap) {
    actions.push({
      title: 'Complete o plano antes do próximo acesso',
      body: 'Treino e dieta completos fazem o aluno perceber acompanhamento real logo que entra no aplicativo.',
      view: 'treinos',
      tone: 'bg-emerald-300',
    })
  }

  if (hasOverduePayment) {
    actions.push({
      title: 'Recupere receita pendente',
      body: 'Cobranças atrasadas aparecem antes de virarem perda. Abra recebimentos e resolva os casos críticos.',
      view: 'pagamentos',
      tone: 'bg-amber-300',
    })
  }

  if (hasAgenda) {
    actions.push({
      title: 'Confirme os próximos compromissos',
      body: 'Revisar agenda nas próximas 24 horas reduz faltas e melhora a experiência do aluno.',
      view: 'agenda',
      tone: 'bg-cyan-300',
    })
  }

  if (!actions.length) {
    actions.push({
      title: 'Carteira sob controle',
      body: 'Sem prioridade crítica agora. Use esse momento para revisar evolução, preparar próximos ajustes e mandar feedbacks.',
      view: 'mensagens',
      tone: 'bg-emerald-300',
    })
  }

  actions.push({
    title: 'Mantenha comunicação ativa',
    body: 'Uma mensagem curta no momento certo aumenta percepção de cuidado e reduz abandono silencioso.',
    view: 'mensagens',
    tone: 'bg-blue-300',
  })

  return actions.slice(0, 4)
}

function buildSmartAlerts(students, checkins, workouts, nutritionPlans, appointments = [], invoices = [], assessments = []) {
  const alerts = []
  const priorityScore = { Alto: 0, Medio: 1, Baixo: 2 }

  students.forEach((student) => {
    const studentId = String(student.id)
    const hasWorkout = workouts.some((workout) => String(workout.studentId) === studentId && workout.active !== false)
    const hasNutrition = nutritionPlans.some((plan) => String(plan.studentId) === studentId && plan.active !== false)
    const adherence = Number(student.adherence || 0)

    if (student.payment === 'Pendente') {
      alerts.push({
        id: `payment-${student.id}`,
        type: 'Financeiro',
        priority: 'Alto',
        title: `${student.name} está com pagamento pendente`,
        body: `${student.plan} precisa de acompanhamento para evitar atraso de renovação.`,
        action: 'Abrir pagamentos',
        view: 'pagamentos',
      })
    }

    if (student.status === 'Atrasado' || student.risk === 'Alto' || adherence < 75) {
      alerts.push({
        id: `risk-${student.id}`,
        type: 'Acompanhamento',
        priority: student.risk === 'Alto' || adherence < 70 ? 'Alto' : 'Medio',
        title: `${student.name} precisa de atenção`,
        body: `Status ${formatUiText(student.status)}, risco ${formatUiText(student.risk)} e constância de ${adherence || 0}%.`,
        action: 'Abrir alunos',
        view: 'alunos',
      })
    }

    if (!hasWorkout) {
      alerts.push({
        id: `workout-${student.id}`,
        type: 'Treino',
        priority: 'Medio',
        title: `${student.name} ainda não tem treino salvo`,
        body: 'Prescreva um treino para liberar o plano na área do aluno.',
        action: 'Abrir treinos',
        view: 'treinos',
      })
    }

    if (!hasNutrition) {
      alerts.push({
        id: `nutrition-${student.id}`,
        type: 'Nutrição',
        priority: 'Medio',
        title: `${student.name} ainda não tem dieta salva`,
        body: 'Crie uma dieta com macros calculados para acompanhar a meta do aluno.',
        action: 'Abrir nutrição',
        view: 'nutricao',
      })
    }

    const latestAssessment = assessments
      .filter((assessment) => String(assessment.studentId) === studentId)
      .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))[0]
    const assessmentAge = latestAssessment ? daysSinceDate(latestAssessment.assessedAt) : null

    if (!latestAssessment || assessmentAge === null || assessmentAge > 30) {
      alerts.push({
        id: `assessment-${student.id}`,
        type: 'Avaliacao',
        priority: latestAssessment ? 'Medio' : 'Alto',
        title: latestAssessment ? `${student.name} precisa ser reavaliado` : `${student.name} ainda não tem avaliação`,
        body: latestAssessment
          ? `Última avaliação em ${formatDate(latestAssessment.assessedAt)}.`
          : 'Registre as medidas iniciais para criar uma linha de evolução.',
        action: 'Abrir avaliações',
        view: 'avaliacoes',
      })
    }
  })

  checkins
    .filter((checkin) => checkin.state !== 'Recebido')
    .forEach((checkin) => {
      const student = students.find((item) => String(item.id) === String(checkin.studentId))
      alerts.push({
        id: `checkin-${checkin.id}`,
        type: 'Check-in',
        priority: checkin.state === 'Critico' ? 'Alto' : 'Medio',
        title: `${student?.name ?? 'Aluno'} tem check-in ${formatUiText(String(checkin.state)).toLowerCase()}`,
        body: `${checkin.type} - ${checkin.due}. ${checkin.note || 'Revise o retorno e registre o próximo ajuste.'}`,
        action: 'Abrir check-ins',
        view: 'checkins',
      })
    })

  const now = Date.now()
  const nextDay = now + 24 * 60 * 60 * 1000
  appointments
    .filter((appointment) => {
      const startsAt = new Date(appointment.startsAt).getTime()
      return startsAt >= now
        && startsAt <= nextDay
        && !['Concluido', 'Cancelado'].includes(appointment.status)
    })
    .forEach((appointment) => {
      const student = students.find((item) => String(item.id) === String(appointment.studentId))
      alerts.push({
        id: `appointment-${appointment.id}`,
        type: 'Agenda',
        priority: appointment.status === 'Confirmado' ? 'Baixo' : 'Medio',
        title: `${appointment.title} com ${student?.name ?? 'aluno'}`,
        body: `${formatDateTime(appointment.startsAt)} - ${appointment.location || 'Local não informado'}.`,
        action: 'Abrir agenda',
        view: 'agenda',
      })
    })

  invoices
    .map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) }))
    .filter((invoice) => invoice.status === 'Atrasado')
    .forEach((invoice) => {
      const student = students.find((item) => String(item.id) === String(invoice.studentId))
      alerts.push({
        id: `invoice-${invoice.id}`,
        type: 'Financeiro',
        priority: 'Alto',
        title: `${student?.name ?? 'Aluno'} tem cobrança atrasada`,
        body: `${formatCurrency(invoice.amount)} venceu em ${formatDate(invoice.dueDate)}.`,
        action: 'Abrir pagamentos',
        view: 'pagamentos',
      })
    })

  return alerts
    .sort((a, b) => priorityScore[a.priority] - priorityScore[b.priority] || a.type.localeCompare(b.type))
    .slice(0, 12)
}

function buildMessageSuggestion(student) {
  if (!student) return 'Me envie seu retorno de hoje com treino, dieta, sono e fome para eu ajustar seu plano.'

  return `Recebi, ${student.name}. Continue seguindo o plano combinado, registre treino e alimentação no app e me envie qualquer dificuldade no check-in para eu ajustar o acompanhamento com precisão.`
}

function Empty({ text }) {
  return <p className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">{text}</p>
}

function MacroSummaryGrid({ totals, compact = false }) {
  const items = [
    ['Kcal', Math.round(totals.calories)],
    ['Proteína', `${roundMacro(totals.protein)}g`],
    ['Carbo', `${roundMacro(totals.carbs)}g`],
    ['Gordura', `${roundMacro(totals.fat)}g`],
    ['Fibra', `${roundMacro(totals.fiber)}g`],
    ['Sódio', `${Math.round(totals.sodium)}mg`],
  ]

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-white/10 bg-zinc-950/50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
          <p className="mt-1 text-sm font-black text-zinc-100">{value}</p>
        </div>
      ))}
    </div>
  )
}

function calculateMealMacros(meal) {
  return sumMacros((meal.items ?? []).map(calculateFoodItemMacros))
}

function calculateFoodItemMacros(item) {
  const food = !item.mode || item.mode === 'database' ? findFoodByName(item.foodName) : null
  const source = food ?? item.customMacros
  const multiplier = Number(item.grams || 0) / 100

  if (!source || !Number.isFinite(multiplier)) return emptyMacros()

  return {
    calories: Number(source.calories || 0) * multiplier,
    protein: Number(source.protein || 0) * multiplier,
    carbs: Number(source.carbs || 0) * multiplier,
    fat: Number(source.fat || 0) * multiplier,
    fiber: Number(source.fiber || 0) * multiplier,
    sodium: Number(source.sodium || 0) * multiplier,
  }
}

function getEquivalentSubstitutions(item) {
  const grams = Number(item.grams || 0)
  const sourceFood = findFoodByName(item.foodName)
  const sourceMacros = calculateFoodItemMacros(item)
  if (!grams || !sourceMacros.calories) return []

  const sourceCategory = sourceFood?.category || item.category
  const currentName = normalizeText(item.foodName)
  const targetMacro = getDominantMacro(sourceMacros)

  return foodDatabase
    .filter((food) => food.category === sourceCategory)
    .filter((food) => normalizeText(food.name) !== currentName)
    .map((food) => {
      const baseValue = Number(food[targetMacro] || food.calories || 0)
      const targetValue = Number(sourceMacros[targetMacro] || sourceMacros.calories || 0)
      const calculatedGrams = baseValue > 0 ? Math.round((targetValue / baseValue) * 100) : grams
      const safeGrams = Math.max(20, Math.min(500, calculatedGrams || grams))
      const macros = calculateFoodItemMacros({ foodName: food.name, category: food.category, grams: safeGrams, mode: 'database' })
      const score = Math.abs(macros.calories - sourceMacros.calories)
        + Math.abs(macros.protein - sourceMacros.protein) * 9
        + Math.abs(macros.carbs - sourceMacros.carbs) * 4
        + Math.abs(macros.fat - sourceMacros.fat) * 4

      return {
        name: food.name,
        category: food.category,
        grams: safeGrams,
        macros,
        score,
      }
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 2)
}

function getDominantMacro(macros) {
  const protein = Number(macros.protein || 0) * 4
  const carbs = Number(macros.carbs || 0) * 4
  const fat = Number(macros.fat || 0) * 9
  if (protein >= carbs && protein >= fat) return 'protein'
  if (fat >= protein && fat >= carbs) return 'fat'
  return 'carbs'
}

function normalizeNutritionItem(item, changedField) {
  if (changedField === 'category') {
    const firstFood = foodDatabase.find((food) => food.category === item.category)
    return { ...item, foodName: firstFood?.name ?? item.foodName, mode: 'database', customMacros: undefined }
  }

  const recognized = findFoodByName(item.foodName)
  if (recognized && item.mode !== 'manual') {
    return { ...item, category: recognized.category, foodName: recognized.name, mode: 'database', customMacros: undefined }
  }

  const estimate = estimateFoodMacros(item.foodName, item.category)

  return {
    ...item,
    mode: item.mode ?? (recognized ? 'database' : 'manual'),
    category: recognized?.category ?? estimate.category ?? item.category,
    customMacros: recognized ? item.customMacros : item.customMacros ?? estimate ?? emptyMacros(),
  }
}

function findFoodByName(name) {
  return recognizeFood(name).food
}

function findExactFood(name) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return null

  return foodDatabase.find((food) => (
    [food.name, ...(food.aliases ?? [])].some((candidate) => normalizeText(candidate) === normalizedName)
  )) ?? null
}

function getFoodSuggestions(query, category) {
  const normalizedQuery = normalizeText(query)
  const commonFoods = [
    'Arroz Branco', 'Peito de Frango', 'Ovo Inteiro', 'Aveia em Flocos',
    'Banana', 'Batata Doce', 'Patinho Grelhado', 'Feijão Carioca',
    'Pão Integral', 'Iogurte Natural', 'Tilápia Grelhada', 'Whey Protein Concentrado',
  ]

  return foodDatabase
    .filter((food) => {
      if (!normalizedQuery) return food.category === category
      return [food.name, ...(food.aliases ?? [])]
        .some((candidate) => normalizeText(candidate).includes(normalizedQuery))
    })
    .sort((a, b) => {
      const aCommon = commonFoods.indexOf(a.name)
      const bCommon = commonFoods.indexOf(b.name)
      if (aCommon >= 0 || bCommon >= 0) {
        if (aCommon < 0) return 1
        if (bCommon < 0) return -1
        return aCommon - bCommon
      }
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    .slice(0, normalizedQuery ? 14 : 10)
}

function recognizeFood(name) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return { food: null, confidence: 0, matchType: 'none' }

  const candidates = foodDatabase.map((food) => ({
    food,
    names: [food.name, ...(food.aliases ?? [])].map(normalizeText),
  }))
  const exact = candidates.find((candidate) => candidate.names.includes(normalizedName))
  if (exact) return { food: exact.food, confidence: 1, matchType: 'exact' }

  const contained = candidates
    .map((candidate) => {
      const matchingName = candidate.names
        .filter((candidateName) => candidateName.length >= 4)
        .sort((a, b) => b.length - a.length)
        .find((candidateName) => normalizedName.includes(candidateName) || candidateName.includes(normalizedName))
      return { ...candidate, matchingName }
    })
    .filter((candidate) => candidate.matchingName)
    .sort((a, b) => b.matchingName.length - a.matchingName.length)[0]

  if (contained) return { food: contained.food, confidence: 0.9, matchType: 'similar' }

  const inputTokens = meaningfulFoodTokens(normalizedName)
  const ranked = candidates
    .map((candidate) => {
      const score = Math.max(...candidate.names.map((candidateName) => {
        const candidateTokens = meaningfulFoodTokens(candidateName)
        const overlap = candidateTokens.filter((token) => inputTokens.includes(token)).length
        return overlap / Math.max(inputTokens.length, candidateTokens.length, 1)
      }))
      return { food: candidate.food, score }
    })
    .sort((a, b) => b.score - a.score)[0]

  return ranked?.score >= 0.58
    ? { food: ranked.food, confidence: Math.min(0.85, ranked.score), matchType: 'similar' }
    : { food: null, confidence: ranked?.score ?? 0, matchType: 'none' }
}

function estimateFoodMacros(name, category) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return { ...emptyMacros(), category, _confidence: 0, _source: 'empty' }

  const keywordEstimate = foodEstimateRules.find((rule) => rule.keywords.some((keyword) => normalizedName.includes(normalizeText(keyword))))

  if (keywordEstimate) {
    return { ...keywordEstimate.macros, category: keywordEstimate.category ?? category, _confidence: 0.82, _source: 'rule' }
  }

  const categoryFoods = foodDatabase.filter((food) => food.category === category)
  if (!categoryFoods.length) return { ...emptyMacros(), category, _confidence: 0.25, _source: 'unknown' }

  const average = sumMacros(categoryFoods)
  const divisor = categoryFoods.length

  return {
    calories: roundMacro(average.calories / divisor),
    protein: roundMacro(average.protein / divisor),
    carbs: roundMacro(average.carbs / divisor),
    fat: roundMacro(average.fat / divisor),
    fiber: roundMacro(average.fiber / divisor),
    sodium: roundMacro(average.sodium / divisor),
    category,
    _confidence: 0.45,
    _source: 'category',
  }
}

function meaningfulFoodTokens(value) {
  const ignored = new Set(['de', 'da', 'do', 'com', 'sem', 'em', 'e', 'cozido', 'cozida', 'grelhado', 'grelhada', 'assado', 'assada'])
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !ignored.has(token))
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function sumMacros(macrosList) {
  return macrosList.reduce((total, item) => ({
    calories: total.calories + item.calories,
    protein: total.protein + item.protein,
    carbs: total.carbs + item.carbs,
    fat: total.fat + item.fat,
    fiber: total.fiber + item.fiber,
    sodium: total.sodium + item.sodium,
  }), emptyMacros())
}

function emptyMacros() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
}

function formatMacroSummary(totals) {
  return `${Math.round(totals.calories)} kcal | P ${roundMacro(totals.protein)}g | C ${roundMacro(totals.carbs)}g | G ${roundMacro(totals.fat)}g`
}

function roundMacro(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10
}

function formatDateTime(value) {
  if (!value) return 'Sem data'
  const date = parseDisplayDate(value)
  if (!date) return 'Data inválida'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatWorkoutTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return [hours, minutes, seconds]
    .map((item) => String(item).padStart(2, '0'))
    .join(':')
}

function formatFullDateTime(value) {
  if (!value) return 'Data não informada'
  const date = parseDisplayDate(value)
  if (!date) return 'Data inválida'

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDate(value) {
  if (!value) return 'Sem data'
  const date = parseDisplayDate(value, true)
  return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Data inválida'
}

function formatCurrency(value) {
  const amount = Number(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(amount) ? amount : 0)
}

function getPlanMonthlyPrice(planName, availablePlans = plans) {
  const plan = availablePlans.find((item) => item.name === planName) ?? plans.find((item) => item.name === planName)
  if (!plan) return 0
  const value = getPlanBillingAmount(planName, availablePlans)
  if (!Number.isFinite(value)) return 0
  const cycle = normalizePlanCycle(plan.cycle)
  if (cycle === 'semanal') return value * 4.33
  if (cycle === 'semestral') return value / 6
  if (cycle === 'anual') return value / 12
  return value
}

function getPlanBillingAmount(planName, availablePlans = plans) {
  const plan = availablePlans.find((item) => item.name === planName) ?? plans.find((item) => item.name === planName)
  if (!plan) return 0
  const normalized = String(plan.price || '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function getCoachPlans(settings) {
  const savedPlans = Array.isArray(settings?.customPlans) ? settings.customPlans : []
  const normalizedPlans = savedPlans
    .map((plan) => ({
      name: String(plan?.name || '').trim(),
      price: String(plan?.price || '').trim(),
      cycle: normalizePlanCycle(plan?.cycle || plan?.duration || 'mensal'),
      duration: String(plan?.duration || getPlanCycleLabel(plan)).trim(),
      features: String(plan?.features || '').trim(),
    }))
    .filter((plan) => plan.name)

  return normalizedPlans.length ? normalizedPlans : plans
}

function parseCustomPlans(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', price = '', cycleOrFeatures = '', featuresOrEmpty = ''] = line.split('|').map((part) => part.trim())
      const hasExplicitCycle = ['semanal', 'mensal', 'semestral', 'anual'].includes(normalizePlanCycle(cycleOrFeatures))
      const cycle = hasExplicitCycle ? normalizePlanCycle(cycleOrFeatures) : 'mensal'
      const features = hasExplicitCycle ? featuresOrEmpty : cycleOrFeatures
      return {
        name,
        price: normalizePlanPrice(price),
        cycle,
        duration: getPlanCycleLabel({ cycle }),
        features: features || 'Plano do treinador',
      }
    })
    .filter((plan) => plan.name)
}

function formatPlansDraft(customPlans) {
  const source = Array.isArray(customPlans) && customPlans.length ? customPlans : plans
  return source.map((plan) => `${plan.name} | ${plan.price} | ${normalizePlanCycle(plan.cycle)} | ${plan.features || ''}`).join('\n')
}

function normalizePlanPrice(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'R$ 0'
  if (/^r\$/i.test(raw)) return raw
  const number = Number(raw.replace(/[^\d,.-]/g, '').replace(',', '.'))
  return Number.isFinite(number) ? formatCurrency(number) : raw
}

function normalizePlanCycle(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized.includes('semana')) return 'semanal'
  if (normalized.includes('semestre') || normalized.includes('semes')) return 'semestral'
  if (normalized.includes('ano') || normalized.includes('anual')) return 'anual'
  return 'mensal'
}

function getPlanCycleLabel(plan) {
  const cycle = normalizePlanCycle(plan?.cycle || plan?.duration)
  if (cycle === 'semanal') return 'cobrança semanal'
  if (cycle === 'semestral') return 'cobrança semestral'
  if (cycle === 'anual') return 'cobrança anual'
  return 'cobrança mensal'
}

function getBillingBrand(settings) {
  return {
    logoUrl: settings?.billingLogoUrl || '',
    primaryColor: settings?.billingPrimaryColor || '#10b981',
    accentColor: settings?.billingAccentColor || '#0f172a',
    message: settings?.billingMessage || '',
  }
}

function buildBillingMessage(template, { student, amount, dueDate, coachSettings }) {
  const fallback = 'Olá, {aluno}. Seu acesso está aguardando pagamento. Valor: {valor}. Vencimento: {vencimento}. Pix: {pix}. Após pagar, envie o comprovante no chat para o coach validar.'
  return String(template || fallback)
    .replaceAll('{aluno}', student?.name || 'aluno')
    .replaceAll('{valor}', formatCurrency(amount || 0))
    .replaceAll('{vencimento}', dueDate ? formatDate(dueDate) : 'a combinar')
    .replaceAll('{pix}', coachSettings?.pixKey || 'Pix não informado')
    .replaceAll('{whatsapp}', coachSettings?.whatsapp || 'WhatsApp não informado')
    .replaceAll('{email}', coachSettings?.supportEmail || 'e-mail não informado')
}

function formatPercent(value) {
  const percentage = Number(value || 0) * 100
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(percentage)}%`
}

function getCoachBillingCycle(subscription, userCreatedAt, referenceTime = Date.now()) {
  const reference = new Date(referenceTime)
  const fallbackStart = parseValidDate(userCreatedAt) ?? reference
  const startedAt = parseValidDate(subscription?.startedAt) ?? fallbackStart
  const firstBillingAt = parseValidDate(subscription?.firstBillingAt) ?? addCalendarMonth(startedAt)
  const storedBillingAt = parseValidDate(subscription?.nextBillingAt)
  let nextBillingAt = storedBillingAt ?? firstBillingAt

  while (nextBillingAt.getTime() <= reference.getTime()) {
    nextBillingAt = addCalendarMonth(nextBillingAt)
  }

  const millisecondsRemaining = Math.max(nextBillingAt.getTime() - reference.getTime(), 0)
  return {
    startedAt: startedAt.toISOString(),
    nextBillingAt: nextBillingAt.toISOString(),
    daysRemaining: Math.max(1, Math.ceil(millisecondsRemaining / (24 * 60 * 60 * 1000))),
    isPromotional: reference.getTime() < firstBillingAt.getTime() && (subscription?.status ?? 'trial') === 'trial',
  }
}

function isCoachSubscriptionActive(subscription) {
  const status = normalizeText(subscription?.status || '')
  return ['active', 'paid', 'em dia', 'em_dia', 'trialing', 'approved', 'aprovado', 'authorized', 'autorizado', 'completed', 'complete', 'ativo'].includes(status)
}

function getSubscriptionStatusLabel(subscription) {
  const status = normalizeText(subscription?.status || '')
  if (isCoachSubscriptionActive(subscription)) return 'Assinatura ativa'
  if (['pending', 'pendente', 'waiting_payment', 'aguardando_pagamento', 'trial'].includes(status)) return 'Aguardando pagamento'
  if (['expired', 'cancelled', 'canceled', 'cancelado', 'vencido'].includes(status)) return 'Assinatura pausada'
  return subscription?.status ? `Status: ${subscription.status}` : 'Aguardando ativação'
}

function normalizeCheckoutUrl(value) {
  const raw = String(value || '').trim()
  const urlIndex = raw.indexOf('https://')
  if (urlIndex >= 0) return raw.slice(urlIndex).trim()
  const httpIndex = raw.indexOf('http://')
  if (httpIndex >= 0) return raw.slice(httpIndex).trim()
  return raw
}

function resolveCheckoutUrl(value, fallback = primaryCartpandaCheckoutUrl) {
  const normalized = normalizeCheckoutUrl(value)
  if (!normalized || /lastlink\.com/i.test(normalized)) return fallback
  return normalized
}

function parseValidDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function addCalendarMonth(value) {
  const source = new Date(value)
  const day = source.getDate()
  const result = new Date(source)
  result.setDate(1)
  result.setMonth(result.getMonth() + 1)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length !== 11) return value || ''
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number)
    : '-'
}

function formatShortDate(value) {
  if (!value) return ''
  const date = parseDisplayDate(value, true)
  return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date) : ''
}

function parseDisplayDate(value, dateOnlyAtNoon = false) {
  const normalized = dateOnlyAtNoon && String(value).length === 10 ? `${value}T12:00:00` : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseMetric(value) {
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : ''
}

function calculateBmi(weightKg, heightCm) {
  const weight = Number(weightKg)
  const height = Number(heightCm) / 100
  if (!weight || !height) return null
  return weight / (height * height)
}

function buildAssessmentInsight(first, latest) {
  if (!first || !latest) return 'Registre novas avaliações para formar uma leitura comparativa.'
  if (String(first.id) === String(latest.id)) {
    return 'Avaliação inicial registrada. Ela será a base para os próximos comparativos.'
  }

  const weightChange = Number(latest.weightKg || 0) - Number(first.weightKg || 0)
  const fatChange = Number(latest.bodyFatPercent || 0) - Number(first.bodyFatPercent || 0)
  const waistChange = Number(latest.waistCm || 0) - Number(first.waistCm || 0)
  const parts = []

  if (first.weightKg && latest.weightKg) parts.push(`peso ${describeChange(weightChange, 'kg')}`)
  if (first.bodyFatPercent && latest.bodyFatPercent) parts.push(`gordura corporal ${describeChange(fatChange, 'p.p.')}`)
  if (first.waistCm && latest.waistCm) parts.push(`cintura ${describeChange(waistChange, 'cm')}`)

  return parts.length
    ? `Desde a primeira avaliação: ${parts.join(', ')}. Use a tendência junto do desempenho e da constância para decidir o próximo ajuste.`
    : 'As avaliações existem, mas ainda faltam medidas equivalentes para gerar um comparativo.'
}

function describeChange(value, unit) {
  const absolute = formatNumber(Math.abs(value))
  if (Math.abs(value) < 0.05) return `manteve (${absolute} ${unit})`
  return value > 0 ? `subiu ${absolute} ${unit}` : `reduziu ${absolute} ${unit}`
}

function clampPercent(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return 0
  return Math.min(100, Math.max(0, Math.round(number)))
}

function daysSinceDate(value) {
  if (!value) return null
  const raw = String(value)
  const normalized = raw.includes('T') ? raw : `${raw}T12:00:00`
  const time = new Date(normalized).getTime()
  if (Number.isNaN(time)) return null
  return (Date.now() - time) / (24 * 60 * 60 * 1000)
}

function buildAssessmentChartData(assessments, studentId) {
  return assessments
    .filter((assessment) => String(assessment.studentId) === String(studentId))
    .slice()
    .sort((a, b) => new Date(a.assessedAt) - new Date(b.assessedAt))
    .slice(-8)
    .map((assessment) => ({
      label: formatShortDate(assessment.assessedAt),
      peso: assessment.weightKg,
      gordura: assessment.bodyFatPercent,
    }))
}

function buildRevenueChartData(invoices) {
  const months = new Map()

  invoices
    .filter((invoice) => invoice.status === 'Pago')
    .forEach((invoice) => {
      const date = new Date(invoice.paidAt || invoice.dueDate)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '')
      const current = months.get(key) ?? { month: label, receita: 0 }
      current.receita += Number(invoice.amount || 0)
      months.set(key, current)
    })

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, value]) => value)
}

function getDefaultAppointmentDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function getDefaultDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatUiText(value) {
  if (typeof value !== 'string') return value
  const labels = {
    Medio: 'Médio',
    Critico: 'Crítico',
    Atencao: 'Atenção',
    Concluido: 'Concluído',
    Proximos: 'Próximos',
    Concluidos: 'Concluídos',
    Avaliacao: 'Avaliação',
    Inicio: 'Início',
    Previa: 'Prévia',
    Configuracoes: 'Configurações',
  }
  return labels[value] ?? value
}

function Badge({ tone, children }) {
  const className =
    tone === 'Alto'
      ? 'border-red-300/40 bg-red-400/10 text-red-200'
      : tone === 'Medio'
        ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
        : 'border-blue-300/40 bg-blue-300/10 text-blue-200'

  return <span className={`rounded border px-2 py-1 text-xs font-black ${className}`}>{formatUiText(children)}</span>
}
