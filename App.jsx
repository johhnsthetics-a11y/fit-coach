import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import fitCoachLogo from './fit-coach-logo.png'
import {
  acceptRemoteStudentConsent,
  archiveRemoteNutritionPlan,
  archiveRemoteWorkout,
  createRemoteStudentInvite,
  deleteRemoteStudent,
  fetchRemoteExerciseMedia,
  loadRemoteData,
  loadRemoteAppAdminSettings,
  loadRemoteLeadEvents,
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
  saveRemoteLeadEvent,
  saveRemoteInvoice,
  saveRemoteNutritionPlan,
  saveRemoteStudent,
  saveRemoteMessage,
  saveRemoteWorkout,
  saveRemoteWorkoutProgressionDecision,
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
const LEAD_ATTRIBUTION_KEY = 'coachfitpro-lead-attribution'
const LEAD_EVENTS_KEY = 'coachfitpro-lead-events'
const productionWithoutSupabase = import.meta.env.PROD && !supabaseEnabled
const cartpandaCheckoutPlans = [
  {
    id: 'mensal',
    name: 'Mensal',
    cycle: 'cobrança mensal',
    badge: 'Primeiro mês R$ 9,90',
    price: 'R$ 9,90',
    suffix: 'no 1º mês',
    oldPrice: 'R$ 49,90',
    total: 'Depois R$ 49,90/mês',
    economy: 'Economize R$ 40,00 na ativação',
    equivalent: 'sem compromisso de ciclo longo',
    checkoutUrl: 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
    description: 'Comece pagando pouco no primeiro mês, valide a operação com alunos reais e mantenha liberdade para continuar mês a mês.',
    highlights: ['Primeiro mês por R$ 9,90', 'Depois R$ 49,90/mês', 'Acesso completo ao painel', 'Portal do aluno liberado', 'Sem taxa por aluno', 'Liberação automática após pagamento'],
    bestFor: 'Coach que quer entrar com baixo risco, testar a experiência premium com os primeiros alunos e validar o impacto antes de assumir um ciclo maior.',
    operatingPromise: 'A oferta de entrada reduz a barreira para começar agora. Você ativa a estrutura, organiza os alunos atuais e decide a continuidade com dados reais da operação.',
    activationPlan: ['Ativar o primeiro mês promocional', 'Cadastrar planos próprios e alunos atuais', 'Enviar convites e acompanhar a rotina pelo painel'],
    decisionPoints: ['R$ 9,90 para começar', 'baixo risco de entrada', 'renovação mensal depois'],
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
    operatingPromise: 'Seis meses dão tempo para padronizar atendimento, ganhar controle e aumentar percepção de valor.',
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
const defaultAppAdminSettings = {
  salesHeadline: 'A forma mais simples de organizar sua consultoria online.',
  salesSubheadline: 'Gerencie alunos, treino, dieta, cobrança recorrente e evolução em uma plataforma com experiência de app. Menos caos, mais previsibilidade e uma entrega que parece premium desde o primeiro acesso.',
  salesCta: 'Começar agora',
  announcement: 'Sem planilha solta. Sem cobrança perdida. Sem aluno perguntando onde está o treino.',
  logoUrl: '',
  salesTrustText: 'Pagamento pela Cartpanda, acesso liberado automaticamente e sem taxa por aluno cadastrado.',
  primaryColor: '#00c7a8',
  accentColor: '#3b82f6',
  appBackgroundColor: '#000000',
  salesBackgroundColor: '#00150f',
  salesSurfaceColor: '#07110f',
  salesTextColor: '#f8fafc',
  ctaColor: '#00d2b2',
  ctaTextColor: '#020617',
  headerBackgroundColor: 'rgba(0, 0, 0, 0.62)',
  publishedAt: '',
  checkoutPlans: cartpandaCheckoutPlans,
  featureFlags: {
    studentXp: true,
    financialDashboard: true,
    salesSimulator: true,
    waterGoal: true,
  },
}
const ADMIN_SETTINGS_STORAGE_KEY = 'coachfitpro-admin-settings-preview'
const MASTER_ADMIN_EMAIL = 'sac@coachfitpro.com.br'
const ADMIN_EMAILS = [MASTER_ADMIN_EMAIL]

const salesHeroHeadlines = [
  {
    id: 'consultoria',
    lead: 'A forma mais simples de organizar',
    focus: 'Consultorias e Aulas',
    proof: 'Do treino ao financeiro, tudo centralizado para entregar valor e escalar sem perder controle.',
  },
  {
    id: 'presencial',
    lead: 'Transforme seu atendimento em uma',
    focus: 'Experiência Premium',
    proof: 'O aluno treina com você, acompanha no app, registra cargas e percebe mais profissionalismo.',
  },
  {
    id: 'operacao',
    lead: 'Sua operação de treinador com',
    focus: 'Gestão de Alto Nível',
    proof: 'Alunos, agenda, treinos, dieta, chat e cobranças organizados em um painel moderno.',
  },
  {
    id: 'retencao',
    lead: 'Mais clareza para o aluno, mais',
    focus: 'Retenção para o Coach',
    proof: 'Rotina guiada, evolução visível e acompanhamento constante para aumentar permanência e renovação.',
  },
]

function normalizeAdminSettings(settings = {}) {
  const checkoutPlans = Array.isArray(settings.checkoutPlans) && settings.checkoutPlans.length
    ? settings.checkoutPlans.map((plan, index) => ({
      ...cartpandaCheckoutPlans[index],
      ...plan,
      highlights: Array.isArray(plan.highlights) ? plan.highlights : (typeof plan.highlights === 'string' ? plan.highlights.split('\n').filter(Boolean) : cartpandaCheckoutPlans[index]?.highlights || []),
      activationPlan: Array.isArray(plan.activationPlan) ? plan.activationPlan : (typeof plan.activationPlan === 'string' ? plan.activationPlan.split('\n').filter(Boolean) : cartpandaCheckoutPlans[index]?.activationPlan || []),
      decisionPoints: Array.isArray(plan.decisionPoints) ? plan.decisionPoints : (typeof plan.decisionPoints === 'string' ? plan.decisionPoints.split(',').map((item) => item.trim()).filter(Boolean) : cartpandaCheckoutPlans[index]?.decisionPoints || []),
    })).map((plan, index) => {
      const defaultPlan = cartpandaCheckoutPlans[index] || cartpandaCheckoutPlans.find((item) => item.id === plan.id)
      const isLegacyMonthly = plan.id === 'mensal'
        && (plan.price === 'R$ 49,90' || String(plan.total || '').includes('598,80'))
      return isLegacyMonthly && defaultPlan
        ? { ...plan, ...defaultPlan, checkoutUrl: plan.checkoutUrl || defaultPlan.checkoutUrl }
        : plan
    })
    : defaultAppAdminSettings.checkoutPlans

  return {
    ...defaultAppAdminSettings,
    ...settings,
    checkoutPlans,
    featureFlags: {
      ...defaultAppAdminSettings.featureFlags,
      ...(settings.featureFlags || {}),
    },
  }
}

function buildAdminThemeStyle(settings = {}) {
  const theme = normalizeAdminSettings(settings)
  return {
    '--admin-primary': theme.primaryColor || '#00c7a8',
    '--admin-accent': theme.accentColor || '#3b82f6',
    '--admin-app-bg': theme.appBackgroundColor || '#000000',
    '--admin-sales-bg': theme.salesBackgroundColor || '#00150f',
    '--admin-sales-surface': theme.salesSurfaceColor || '#07110f',
    '--admin-sales-text': theme.salesTextColor || '#f8fafc',
    '--admin-cta': theme.ctaColor || theme.primaryColor || '#00d2b2',
    '--admin-cta-text': theme.ctaTextColor || '#020617',
    '--admin-header-bg': theme.headerBackgroundColor || 'rgba(0, 0, 0, 0.62)',
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

function decodeJwtPayload(token = '') {
  try {
    const [, payload] = String(token).split('.')
    if (!payload) return {}
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(window.atob(padded))
  } catch {
    return {}
  }
}

function getPossibleAccountEmails(user, sessionUser = null, session = null) {
  const tokenPayload = decodeJwtPayload(session?.access_token || '')
  return [
    user?.email,
    user?.user_metadata?.email,
    sessionUser?.email,
    sessionUser?.user_metadata?.email,
    sessionUser?.identities?.[0]?.identity_data?.email,
    session?.user?.email,
    session?.user?.user_metadata?.email,
    tokenPayload.email,
    tokenPayload.user_metadata?.email,
  ]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
}

function isMasterAdmin(user, sessionUser = null, session = null) {
  const emails = getPossibleAccountEmails(user, sessionUser, session)
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
  { id: 'configuracoes', label: 'Gerenciamento', icon: 'settings', tone: 'slate' },
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
    workoutProgressionDecisions: [],
    exerciseLibrary: [],
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
    if (!supabaseEnabled) return undefined
    let active = true

    async function refreshAdminSettings() {
      try {
        const settings = await loadRemoteAppAdminSettings()
        if (!active || !settings) return
        const normalized = normalizeAdminSettings(settings)
        saveLocalAdminSettings(normalized)
        setData((current) => ({ ...current, appAdminSettings: normalized }))
      } catch {
        // Mantem a versao local se o celular estiver offline ou o Supabase ainda nao responder.
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState !== 'hidden') refreshAdminSettings()
    }

    const timer = window.setInterval(refreshAdminSettings, 45000)
    window.addEventListener('focus', refreshAdminSettings)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshAdminSettings)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
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
          workoutProgressionDecisions: remoteData.workoutProgressionDecisions ?? current.workoutProgressionDecisions ?? [],
          exerciseLibrary: remoteData.exerciseLibrary ?? current.exerciseLibrary ?? [],
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
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  )
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    try {
      window.localStorage.setItem('coachfitpro-last-error', JSON.stringify({
        message: error?.message || 'Erro inesperado',
        stack: error?.stack || '',
        componentStack: info?.componentStack || '',
        createdAt: new Date().toISOString(),
      }))
    } catch {
      // A tela de contingência continua funcionando mesmo se o navegador bloquear storage.
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-shell fit-gradient-bg grid min-h-screen place-items-center p-4 text-zinc-100">
        <section className="w-full max-w-xl rounded-2xl border border-emerald-300/25 bg-zinc-950/92 p-6 text-center shadow-2xl shadow-black/40">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-2xl font-black text-emerald-100">
            !
          </div>
          <h1 className="mt-5 text-2xl font-black text-white">Algo saiu do lugar, mas seus dados continuam seguros.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            O Coach Fit Pro registrou o erro localmente para diagnóstico. Atualize a página para tentar novamente.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 shadow-xl shadow-emerald-950/30"
          >
            Atualizar aplicativo
          </button>
        </section>
      </main>
    )
  }
}

function AppContent() {
  const [data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError] = useStoredData()
  const [activeView, setActiveView] = useState('visao')
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id ?? 1)
  const [studentAccess, setStudentAccess] = useState(null)
  const [recoveryAccessToken, setRecoveryAccessToken] = useState(() => getRecoveryAccessToken())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [billingClock, setBillingClock] = useState(Date.now())
  const subscriptionCheckRef = useRef(0)
  const salesPreview = new URLSearchParams(window.location.search).get('preview') === 'vendas'

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
  const priorityDashboard = useMemo(
    () => buildPriorityDashboard({
      students: data.students,
      checkins: data.checkins,
      workouts: data.workouts ?? [],
      workoutLogs: data.workoutLogs ?? [],
      messages: data.messages ?? [],
      invoices: data.invoices ?? [],
      assessments: data.assessments ?? [],
    }),
    [data.students, data.checkins, data.workouts, data.workoutLogs, data.messages, data.invoices, data.assessments],
  )
  const totalAlertCount = unreadCount + smartAlerts.length
  const coachBillingCycle = getCoachBillingCycle(data.coachSubscription, data.user?.createdAt, billingClock)
  const coachSubscriptionActive = isCoachSubscriptionActive(data.coachSubscription)
  const masterAdmin = isMasterAdmin(data.user, data.session?.user, data.session)
  const shouldLockCoachTools = Boolean(data.user && supabaseEnabled && !coachSubscriptionActive && !masterAdmin)
  const coachPlans = useMemo(() => getCoachPlans(data.coachSettings), [data.coachSettings])
  const appAdminSettings = useMemo(() => normalizeAdminSettings(data.appAdminSettings), [data.appAdminSettings])
  const visibleNavItems = useMemo(() => (
    masterAdmin
      ? [...navItems, { id: 'admin-master', label: 'Admin Master', icon: 'settings', tone: 'emerald' }]
      : navItems
  ), [masterAdmin])

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
        workoutProgressionDecisions: remoteData.workoutProgressionDecisions ?? current.workoutProgressionDecisions ?? [],
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
      } else if (attempts >= 120) {
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
    const user = { name, email, role: 'Coach principal' }

    if (productionWithoutSupabase) {
      setRemoteStatus('Configuração pendente')
      setRemoteError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Cloudflare antes de liberar o acesso.')
      return false
    }

    if (mode === 'forgot') {
      if (!email) {
        setRemoteStatus('Informe o e-mail')
        setRemoteError('Digite o e-mail cadastrado para receber o link de recuperação de senha.')
        return false
      }
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
          workoutProgressionDecisions: remoteData.workoutProgressionDecisions ?? current.workoutProgressionDecisions ?? [],
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
        if (mode === 'signup' || !isCoachSubscriptionActive(remoteData.coachSubscription)) {
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

  async function saveCoachPlan(planDraft) {
    const parsedPlan = normalizeCoachPlan(planDraft)
    if (!parsedPlan?.name) throw new Error('Informe o nome do plano do aluno.')
    if (getPlanBillingAmount(parsedPlan.name, [parsedPlan]) <= 0) throw new Error('Informe um valor valido para o plano.')

    const currentSettings = buildCoachSettingsPayload(data.coachSettings, data.user)
    const currentPlans = getCoachPlans(currentSettings)
    const planIndex = currentPlans.findIndex((plan) => normalizeText(plan.name) === normalizeText(parsedPlan.name))
    const nextPlans = planIndex >= 0
      ? currentPlans.map((plan, index) => (index === planIndex ? { ...plan, ...parsedPlan } : plan))
      : [parsedPlan, ...currentPlans]

    const savedSettings = await saveCoachSettings({
      ...currentSettings,
      customPlans: nextPlans,
    })

    return getCoachPlans(savedSettings).find((plan) => normalizeText(plan.name) === normalizeText(parsedPlan.name)) || parsedPlan
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
      const previousStudent = current.students.find((item) => item.id === student.id)
      const exists = current.students.some((item) => item.id === student.id)
      const students = exists
        ? current.students.map((item) => (item.id === student.id ? savedStudent : item))
        : [savedStudent, ...current.students]
      const planChanged = Boolean(previousStudent && previousStudent.plan !== savedStudent.plan)
      const nextBillingDate = planChanged
        ? getNextBillingDateForStudent(savedStudent, current.invoices ?? [], getCoachPlans(current.coachSettings))
        : ''

      return {
        ...current,
        students,
        invites: createdInvite ? [createdInvite, ...(current.invites ?? [])] : current.invites ?? [],
        notifications: [
          ...(planChanged ? [{
            id: Date.now() + 2,
            title: 'Plano do aluno atualizado',
            body: `${savedStudent.name} agora está no plano ${savedStudent.plan}. Próxima cobrança estimada: ${formatDate(nextBillingDate)}.`,
            read: false,
          }] : []),
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
    const isFirstWorkout = !(data.workouts ?? []).length

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

    recordLeadEvent(isFirstWorkout ? 'first_workout_created' : 'workout_created', {
      studentId: savedWorkout.studentId,
      exercises: savedWorkout.exercises?.length || 0,
      source: workout.source || 'coach_panel',
    })

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

  async function saveWorkoutProgressionDecision(decision) {
    let savedDecision = {
      ...decision,
      id: decision.id || Date.now(),
      coachId: data.user?.id,
      createdAt: new Date().toISOString(),
    }

    if (supabaseEnabled) {
      try {
        savedDecision = await saveRemoteWorkoutProgressionDecision(savedDecision, data.user?.id)
        setRemoteStatus('Progressão registrada')
        setRemoteError('')
      } catch (error) {
        setRemoteStatus('Progressão salva localmente')
        setRemoteError('Rode a migration de progressão para manter o histórico também no Supabase.')
      }
    }

    setData((current) => ({
      ...current,
      workoutProgressionDecisions: [savedDecision, ...(current.workoutProgressionDecisions ?? [])],
    }))

    return savedDecision
  }

  async function approveWorkoutProgression(recommendation, editedTarget = null) {
    const workout = data.workouts.find((item) => String(item.id) === String(recommendation.workoutId))
    if (!workout) throw new Error('Treino original não encontrado.')
    const nextTarget = editedTarget || recommendation.nextTarget
    const nextWorkout = buildWorkoutFromProgression(workout, recommendation, nextTarget)
    const savedWorkout = await saveWorkout(nextWorkout)
    await archiveWorkout(workout.id)
    return saveWorkoutProgressionDecision({
      studentId: recommendation.studentId,
      workoutId: workout.id,
      exerciseName: recommendation.exercise.name,
      action: recommendation.action,
      suggestion: recommendation.suggestion,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
      status: 'approved',
      previousTarget: recommendation.previousTarget,
      nextTarget: { ...nextTarget, generatedWorkoutId: savedWorkout.id },
    })
  }

  async function ignoreWorkoutProgression(recommendation) {
    return saveWorkoutProgressionDecision({
      studentId: recommendation.studentId,
      workoutId: recommendation.workoutId,
      exerciseName: recommendation.exercise.name,
      action: recommendation.action,
      suggestion: recommendation.suggestion,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
      status: 'ignored',
      previousTarget: recommendation.previousTarget,
      nextTarget: recommendation.nextTarget,
    })
  }

  async function undoWorkoutProgression(decision) {
    const activeWorkout = data.workouts.find((workout) => (
      String(workout.studentId) === String(decision.studentId)
      && workout.active !== false
      && (workout.exercises || []).some((exercise) => normalizeText(exercise.name) === normalizeText(decision.exerciseName))
    ))
    if (!activeWorkout) throw new Error('Treino ativo para desfazer não encontrado.')
    const recommendation = {
      workoutId: activeWorkout.id,
      studentId: decision.studentId,
      exercise: { name: decision.exerciseName },
      previousTarget: decision.nextTarget,
      nextTarget: decision.previousTarget,
      action: 'undo',
      suggestion: 'desfazer progressão',
      reason: 'Reversão manual solicitada pelo treinador.',
      confidence: 'manual',
    }
    const revertedWorkout = buildWorkoutFromProgression(activeWorkout, recommendation, decision.previousTarget)
    const savedWorkout = await saveWorkout(revertedWorkout)
    await archiveWorkout(activeWorkout.id)
    return saveWorkoutProgressionDecision({
      studentId: decision.studentId,
      workoutId: activeWorkout.id,
      exerciseName: decision.exerciseName,
      action: 'undo',
      suggestion: 'desfazer alteração',
      reason: 'Treinador desfez a decisão anterior.',
      confidence: 'manual',
      status: 'undone',
      previousTarget: decision.nextTarget,
      nextTarget: { ...decision.previousTarget, generatedWorkoutId: savedWorkout.id },
    })
  }

  async function saveNutritionPlan(plan) {
    let savedPlan = { ...plan, id: Date.now(), active: true }
    const isFirstPlan = !(data.nutritionPlans ?? []).length

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

    recordLeadEvent(isFirstPlan ? 'first_plan_published' : 'nutrition_plan_published', {
      studentId: savedPlan.studentId,
      meals: savedPlan.meals?.length || 0,
      source: plan.source || 'coach_panel',
    })

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
        setRemoteStatus('Gerenciamento salvo')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar gerenciamento')
        throw error
      }
    }

    setData((current) => ({ ...current, coachSettings: savedSettings }))
    return savedSettings
  }

  async function saveAppAdminSettings(settings) {
    const normalized = normalizeAdminSettings({ ...settings, publishedAt: new Date().toISOString() })
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
      workoutProgressionDecisions: data.workoutProgressionDecisions,
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
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    setRemoteStatus('Senha atualizada')
    setRemoteError('Entre com seu e-mail e a nova senha.')
  }

  if (recoveryAccessToken) {
    return <PasswordRecovery onSave={finishPasswordRecovery} />
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
        exerciseLibraryItems={studentAccess.exerciseLibrary ?? data.exerciseLibrary ?? []}
        messages={mergeRecords(data.messages, studentAccess.messages)}
        appointments={studentAccess.appointments ?? []}
        invoices={studentAccess.invoices ?? []}
        assessments={studentAccess.assessments ?? []}
        coachSettings={studentAccess.coachSettings}
        onCompleteWorkout={completeWorkout}
        onAddCheckin={addCheckin}
        onSendMessage={sendMessage}
        onRefreshMessages={refreshStudentConversation}
        appAdminSettings={appAdminSettings}
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
    <div className="app-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100" style={buildAdminThemeStyle(appAdminSettings)}>
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

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[286px] max-w-[86vw] min-w-0 flex-col overflow-hidden border-r border-white/10 bg-zinc-950/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform duration-200 lg:w-[292px] lg:max-w-none lg:translate-x-0 lg:p-3 xl:w-[304px] ${
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

          <div className="mb-2 mt-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-black uppercase text-zinc-500">Navegação</p>
            <span className="hidden text-[10px] font-bold text-zinc-600 lg:inline">role para ver tudo</span>
          </div>
          <nav className="scrollbar-soft grid min-h-0 min-w-0 flex-1 content-start gap-1.5 overflow-y-auto pr-1">
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
                  className={`group flex min-h-[38px] min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-sm font-semibold transition active:scale-[0.99] ${
                    isActive
                      ? `${tone.active} shadow-lg shadow-black/20`
                      : isLocked
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.015] text-zinc-600'
                        : `${tone.idle} hover:-translate-y-0.5 hover:bg-white/[0.065]`
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${
                    isActive ? tone.iconActive : isLocked ? 'border-white/5 bg-zinc-900 text-zinc-700' : tone.iconIdle
                  }`}>
                    <NavIcon name={item.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] leading-tight">{item.label}</span>
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

          <button type="button" onClick={logout} className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.04]">
            Sair
          </button>
      </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:ml-[292px] lg:w-[calc(100%-292px)] lg:px-5 xl:ml-[304px] xl:w-[calc(100%-304px)] xl:px-7">
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
                priorityDashboard={priorityDashboard}
                assessments={data.assessments ?? []}
                invoices={data.invoices ?? []}
                setSelectedStudentId={setSelectedStudentId}
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
                workoutLogs={data.workoutLogs ?? []}
                invites={data.invites ?? []}
                anamneses={data.anamneses ?? []}
                selectedStudent={selectedStudent}
                setSelectedStudentId={setSelectedStudentId}
                onSave={saveStudent}
                onSaveCoachPlan={saveCoachPlan}
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
                nutritionPlans={data.nutritionPlans ?? []}
                workoutLogs={data.workoutLogs ?? []}
                progressionDecisions={data.workoutProgressionDecisions ?? []}
                exerciseLibraryItems={data.exerciseLibrary ?? []}
                onSaveWorkout={saveWorkout}
                onSaveNutritionPlan={saveNutritionPlan}
                onArchiveWorkout={archiveWorkout}
                onApproveProgression={approveWorkoutProgression}
                onIgnoreProgression={ignoreWorkoutProgression}
                onUndoProgression={undoWorkoutProgression}
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
                selectedStudent={selectedStudent}
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
                exerciseLibraryItems={data.exerciseLibrary ?? []}
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
                masterAdmin={masterAdmin}
                onOpenAdminMaster={() => setActiveView('admin-master')}
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

function LoginScreen({ onLogin, onStudentAccess, remoteStatus, remoteError, appAdminSettings = defaultAppAdminSettings }) {
  const [mode, setMode] = useState('signin')
  const [loading, setLoading] = useState(false)
  const [selectedOfferPlanId, setSelectedOfferPlanId] = useState('semestral')
  const [heroHeadlineIndex, setHeroHeadlineIndex] = useState(0)
  const [legalModal, setLegalModal] = useState('')
  const [revenueScenario, setRevenueScenario] = useState({
    students: 20,
    monthlyPrice: 250,
    additionalStudents: 6,
    priceIncrease: 30,
  })
  const salesSettings = normalizeAdminSettings(appAdminSettings)
  const salesPlans = salesSettings.checkoutPlans
  const selectedOfferPlan = salesPlans.find((plan) => plan.id === selectedOfferPlanId) || salesPlans[1] || salesPlans[0]
  const currentRevenue = revenueScenario.students * revenueScenario.monthlyPrice
  const projectedStudents = revenueScenario.students + revenueScenario.additionalStudents
  const projectedPrice = revenueScenario.monthlyPrice + revenueScenario.priceIncrease
  const projectedRevenue = projectedStudents * projectedPrice
  const projectedIncrease = projectedRevenue - currentRevenue
  const projectedPercent = currentRevenue ? Math.round((projectedIncrease / currentRevenue) * 100) : 0
  const activeHeroHeadline = salesHeroHeadlines[heroHeadlineIndex % salesHeroHeadlines.length]

  useEffect(() => {
    captureLeadAttribution()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroHeadlineIndex((current) => (current + 1) % salesHeroHeadlines.length)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [])

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
    openAccess('signup')
  }

  function startPlanSignup(planId) {
    captureLeadAttribution()
    recordLeadEvent('plan_selected', { planId })
    try {
      window.localStorage.setItem(SELECTED_CHECKOUT_PLAN_KEY, planId)
    } catch {
      // Mantem o fluxo normal mesmo se o navegador bloquear armazenamento local.
    }
    openAccess('signup')
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
      const formData = new FormData(event.currentTarget)
      if (mode === 'signup') {
        recordLeadEvent('signup_submitted', {
          email: formData.get('email')?.toString() || '',
          planId: selectedOfferPlanId,
        })
      }
      const success = mode === 'student'
        ? await onStudentAccess(formData.get('inviteCode')?.toString() || '')
        : await onLogin(formData)
      if (success) leaveSalesPreview()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="sales-page" className="sales-page sales-page-condensed fit-gradient-bg min-h-screen text-zinc-100" style={buildAdminThemeStyle(salesSettings)}>
      <div className="sales-progress" aria-hidden="true" />
      <header className="sales-header sticky top-0 z-40 border-b border-white/5 bg-transparent backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:py-4">
          <BrandLockup compact subtitle="Coach Fit Pro" />
          <nav className="hidden items-center gap-1 text-sm font-black text-zinc-300 lg:flex">
            {[
              ['Solução', 'recursos'],
              ['App', 'app-aluno'],
              ['Resultados', 'simulador'],
              ['Preços', 'precos'],
              ['Dúvidas', 'duvidas'],
            ].map(([label, target]) => (
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
              Entrar
            </button>
            <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-xl bg-blue-500 px-4 py-3 text-xs font-black text-zinc-950 shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 sm:px-6 sm:text-sm">
              Começar agora
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="sales-hero mx-auto grid max-w-[1500px] items-center gap-8 px-4 pb-10 pt-8 sm:px-6 lg:min-h-[calc(100vh-76px)] lg:grid-cols-[minmax(0,0.84fr)_minmax(520px,1.16fr)] lg:px-10 lg:pb-14 lg:pt-10 xl:gap-12">
          <div className="min-w-0" data-reveal>
            <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase text-emerald-100">Para personal, coach, consultoria online e aulas presenciais</p>
            <h1 className="sales-rotating-headline mt-5 max-w-5xl text-4xl font-black leading-[0.96] sm:text-6xl lg:text-[5.25rem]" aria-live="polite">
              <span key={`lead-${activeHeroHeadline.id}`} className="sales-rotating-line">{activeHeroHeadline.lead}</span>
              <span key={`focus-${activeHeroHeadline.id}`} className="sales-rotating-focus mt-2 block bg-gradient-to-r from-emerald-100 via-emerald-300 to-cyan-100 bg-clip-text text-transparent">{activeHeroHeadline.focus}</span>
            </h1>
            <p key={`proof-${activeHeroHeadline.id}`} className="sales-rotating-proof mt-5 max-w-2xl text-base font-medium leading-7 text-zinc-300 sm:text-xl">
              <span>{activeHeroHeadline.proof}</span>
              <span className="hidden">
              Gerencie alunos, treinos, dieta e cobrança recorrente em uma plataforma com cara de app. Menos caos. Mais retenção. Mais valor percebido.
                </span>
            </p>
            <div data-reveal className="sales-hero-device-mobile mt-5 lg:hidden">
              <SalesPhoneShowcase />
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="w-full rounded-xl bg-blue-500 px-6 py-4 text-sm font-black text-zinc-950 shadow-2xl shadow-blue-950/30 transition hover:-translate-y-0.5 sm:w-auto">
                {salesSettings.salesCta || 'Começar agora'}
              </button>
              <button type="button" onClick={() => document.getElementById('app-aluno')?.scrollIntoView({ behavior: 'smooth' })} className="w-full rounded-xl border border-blue-300/25 bg-white/[0.035] px-6 py-4 text-sm font-black text-zinc-100 transition hover:border-blue-300/45 sm:w-auto">
                Ver o app
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-400">
              <span className="text-blue-300">✓</span>
              <span>Sem planilha solta</span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-600 sm:block" />
              <span>Cancele quando quiser</span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-600 sm:block" />
              <span>Cobrança recorrente organizada</span>
            </div>
            <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.8)]" />
              + organização, + percepção de valor, + rotina profissional
            </div>
            <div className="sales-hero-proof mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                ['Treino', 'execução guiada e histórico'],
                ['Nutrição', 'macros e substituições'],
                ['Financeiro', 'cobranças e status'],
              ].map(([title, text], index) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <span className="text-xs font-black text-emerald-200">0{index + 1}</span>
                  <p className="mt-2 text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal className="sales-hero-device hidden lg:block">
            <SalesPhoneShowcase />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/25 backdrop-blur sm:grid-cols-4 sm:p-5">
            {[
              ['★★★★★', 'Avaliação visual premium', 'experiência que aumenta percepção de valor'],
              ['1 painel', 'operação centralizada', 'menos WhatsApp, menos planilha, menos improviso'],
              ['App aluno', 'rotina no celular', 'treino, dieta, fatura e chat em um só lugar'],
              ['Sem taxa', 'por aluno cadastrado', 'cresça a carteira com previsibilidade'],
            ].map(([value, title, text]) => (
              <div key={title} data-reveal className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4">
                <p className="text-xl font-black text-blue-100">{value}</p>
                <p className="mt-2 text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="acesso" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <form data-reveal onSubmit={handleSubmit} className="sales-interactive w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
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
            {mode === 'forgot' ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm font-black text-emerald-100">Recuperação automática</p>
                <p className="mt-1 text-xs leading-5 text-zinc-300">
                  Enviaremos um link seguro para o e-mail cadastrado. Ao abrir o link, o treinador cria uma nova senha e volta ao painel normalmente.
                </p>
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['signin', 'Coach'],
                ['signup', 'Criar conta'],
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
            {mode === 'forgot' && remoteStatus?.toLowerCase().includes('recuper') ? (
              <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs font-bold leading-5 text-emerald-100">
                Link enviado. Verifique a caixa de entrada e a pasta de spam do e-mail informado.
              </p>
            ) : null}
            {mode === 'signup' ? (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Se a confirmação por e-mail estiver ativa, confirme sua conta antes do primeiro acesso.
              </p>
            ) : null}
          </form>
        </section>

        <section className="sales-section border-y border-white/10 bg-[#030712]/82 py-10 backdrop-blur-xl sm:py-14">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-black uppercase text-blue-200">O problema não é falta de método</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                É vender consultoria premium usando uma operação improvisada.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
                O aluno esquece carga, perde mensagem, não vê evolução e o treinador fica preso em cobrança manual, prints e processos espalhados.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Sem histórico de carga', 'o aluno treina, mas não enxerga progressão real'],
                ['Cobrança espalhada', 'vencimentos e comprovantes ficam soltos no WhatsApp'],
                ['Evolução invisível', 'foto, medida e feedback não viram argumento de retenção'],
                ['Rotina sem clareza', 'o aluno não sabe exatamente o que fazer no dia'],
              ].map(([title, text]) => (
                <div key={title} data-reveal className="sales-feature-card rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-sm font-black text-violet-100">!</span>
                  <h3 className="mt-4 text-base font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="app-aluno" className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">Visual de aplicativo</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Mostre para o aluno que ele está dentro de um acompanhamento premium.</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                As telas foram pensadas para celular, com ações simples, feedback visual e informação separada por contexto. O aluno abre, entende o que precisa fazer e registra a rotina sem se perder.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ['Treino guiado', 'Iniciar treino, pausar, registrar carga e concluir.'],
                  ['Dieta clara', 'Refeições, macros e substituições equivalentes.'],
                  ['Chat direto', 'Conversa em tempo real com envio de fotos.'],
                  ['Engajamento', 'Meta de água, calendário e desafios semanais.'],
                ].map(([title, text]) => (
                  <div key={title} className="sales-mini-card rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm font-black text-emerald-100">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal className="sales-phone-stage grid gap-2 sm:grid-cols-3">
              {[
                ['Hoje', 'Olá, Élinton', 'Calendário semanal · meta do dia', 'Desafio semanal 3/5', ['Água 1,8L / 2,5L', 'Treino de pernas', 'Feedback semanal'], 'trophy', '+80 XP', 'ranking atualizado'],
                ['Treino', 'Treino C', 'Legs · 7 exercícios', 'Treino iniciado · 23:14', ['Agachamento 4x10', 'Leg press 4x12', 'Cadeira flexora 3x12'], 'dumbbell', 'Treino', 'enviado'],
                ['Chat e check-in', 'Feedback enviado', 'Conversa direta com o coach', 'Foto e evolução recebidas', ['Foto enviada', 'Dúvida respondida', 'Plano alimentar ativo'], 'message', 'Check-in', 'recebido'],
              ].map(([kicker, title, subtitle, action, rows, floatingIcon, floatingTitle, floatingText], index) => (
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
                    <div className="sales-phone-statusbar" aria-hidden="true">
                      <span>09:30</span>
                      <span className="sales-phone-status-icons">
                        <span className="sales-signal" />
                        <span className="sales-wifi" />
                        <span className="sales-battery" />
                      </span>
                    </div>
                    <div className="sales-phone-notch" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-200">{kicker}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-blue-100">app aluno</span>
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
                      {[
                        ['dashboard', 'Início'],
                        ['wallet', 'Fatura'],
                        ['message', 'Chat'],
                        ['menu', 'Menu'],
                      ].map(([icon, label]) => (
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
              <p className="text-sm font-semibold uppercase text-emerald-300">Solução completa</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">A estrutura que transforma atendimento em operação.</h2>
              <p className="mt-4 leading-7 text-zinc-400">O Coach Fit Pro organiza a entrega, reduz tarefas repetitivas e dá ao aluno a sensação de estar dentro de uma consultoria realmente profissional.</p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['01', 'Treinos personalizados', 'Prescrição por aluno, com exercícios, séries, carga, vídeo e notas para cada fase do acompanhamento.'],
                ['02', 'Registro de cargas', 'O aluno registra execução e o treinador acompanha progressão sem depender de memória ou papel.'],
                ['03', 'Evolução visual', 'Fotos, medidas, check-ins e gráficos ajudam a provar resultado e aumentar retenção.'],
                ['04', 'Planejamento inteligente', 'Agenda, desafios, lembretes, meta de água e rotina semanal para manter consistência.'],
                ['05', 'Histórico de performance', 'Cada treino, feedback e avaliação fica registrado para decisões melhores no próximo ciclo.'],
                ['06', 'Financeiro profissional', 'Planos próprios, cobrança, status de pagamento e comprovantes organizados para reduzir atrasos.'],
              ].map(([number, title, description], index) => (
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
              <p className="text-sm font-semibold uppercase text-emerald-300">O custo invisível do improviso</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Seu método pode ser excelente e ainda parecer menor do que realmente é.</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                Quando cada informação fica em um lugar, o coach trabalha mais, responde as mesmas dúvidas e perde força na hora de justificar preço, renovar e escalar.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                ['Planilhas e mensagens espalhadas', 'Dados importantes se perdem entre conversas, arquivos e aplicativos diferentes.', 'Uma ficha central por aluno'],
                ['Cobrança manual e atrasos', 'Sem uma visão financeira, acompanhar vencimentos depende da memória do coach.', 'Planos e pagamentos organizados'],
                ['Aluno sem clareza do processo', 'Treino, dieta e orientações se misturam, reduzindo a percepção de acompanhamento.', 'Portal próprio e rotina guiada'],
                ['Decisões sem histórico completo', 'Sem fotos, medidas, constância e relatos lado a lado, ajustar o plano fica mais difícil.', 'Evolução registrada e comparável'],
              ].map(([title, problem, solution], index) => (
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
              <p className="text-sm font-semibold uppercase text-emerald-300">Motor de recorrência</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Organização, cobrança e retenção trabalhando no mesmo fluxo.</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                O Coach Fit Pro não é apenas um lugar para guardar treino e dieta. Ele conecta rotina do aluno, status financeiro, feedbacks e renovações para o treinador enxergar onde está ganhando, onde está perdendo e onde precisa agir.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ['Centraliza', 'Fim do PDF, Excel e mensagem perdida.'],
                  ['Cobra', 'Vencimentos, Pix e validação em um só lugar.'],
                  ['Retém', 'Desafios, feedbacks e evolução mantêm o aluno ativo.'],
                ].map(([title, text]) => (
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
                  <p className="text-xs font-black uppercase text-blue-200">Dashboard financeiro</p>
                  <h3 className="mt-2 text-2xl font-black">Receita, renovações e inadimplência sob controle</h3>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">ao vivo</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  ['Recebido no mês', 'R$ 8.940', '+18%'],
                  ['Renovações próximas', '32', '7 dias'],
                  ['A receber', 'R$ 2.310', 'pendente'],
                  ['Alunos liberados', '94%', 'pagos'],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
                    <p className="sales-dashboard-money mt-2 font-black text-white">{value}</p>
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
                  {[
                    ['Cobranças automáticas', 'Pix, WhatsApp e status por aluno'],
                    ['Confirmação manual', 'coach valida e libera o acesso'],
                    ['Planos próprios', 'mensal, semanal, semestral ou anual'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-sm font-black text-white">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Exemplo visual do painel. Dentro do app, os números vêm dos recebimentos cadastrados pelo treinador.</p>
            </div>
          </div>
        </section>

        <section className="sales-section sales-section-red border-y border-white/10 bg-zinc-950/75 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl" data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">Antes e depois</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">A diferença não está apenas na ferramenta. Está na forma como o aluno percebe seu serviço.</h2>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Cadastro', 'Formulários e mensagens soltas', 'Código, consentimento e continuidade'],
                ['Prescrição', 'Arquivos separados', 'Treino e dieta no portal'],
                ['Acompanhamento', 'Perguntas no WhatsApp', 'Check-ins e histórico'],
                ['Evolução', 'Fotos na galeria', 'Avaliações e gráficos'],
                ['Financeiro', 'Agenda ou memória', 'Cobranças e vencimentos'],
                ['Comunicação', 'Conversa sem contexto', 'Mensagens ligadas ao aluno'],
              ].map(([item, before, after]) => (
                <div key={item} data-reveal className="sales-feature-card min-w-0 rounded-md border border-white/10 bg-[#05070d]/85 p-4">
                  <p className="text-xs font-black uppercase text-cyan-300">{item}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-500"><strong className="text-zinc-400">Antes:</strong> {before}</p>
                  <div className="my-3 h-px bg-white/10" />
                  <p className="text-sm font-bold leading-6 text-zinc-200"><strong className="text-emerald-200">Com Coach Fit Pro:</strong> {after}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="app-aluno" className="sales-section sales-section-red mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">Experiência do aluno</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">O aluno não entra em “mais uma planilha”. Ele entra no seu ecossistema.</h2>
              <p className="mt-4 leading-7 text-zinc-300">Cada aluno recebe um acesso próprio para consultar treino, dieta, compromissos, cobranças, desafios, meta de água e falar com o coach.</p>
              <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-6 w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 sm:w-auto">
                Profissionalizar meu acompanhamento
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Primeiro acesso', 'Código individual, consentimento e anamnese guiada.'],
                ['Rotina diária', 'Treino, alimentação, água e desafios sempre disponíveis no celular.'],
                ['Prestação de contas', 'Check-ins, fotos, feedbacks e conclusão de treinos registrados.'],
                ['Proximidade', 'Chat em tempo real, agenda e orientações em um só ambiente.'],
              ].map(([title, text], index) => (
                <div key={title} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="sales-feature-card rounded-md border border-white/10 bg-zinc-950/70 p-5">
                  <h3 className="font-black text-emerald-200">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-section border-y border-white/10 bg-[#020816]/82 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center" data-reveal>
              <p className="text-sm font-black uppercase text-blue-200">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                Você profissionaliza sua operação em 3 passos.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Sem precisar parar sua rotina. Comece com os alunos ativos e evolua o processo aos poucos.
              </p>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                ['01', 'Crie seu painel', 'Configure sua conta, identidade profissional, planos e forma de cobrança.'],
                ['02', 'Cadastre alunos e objetivos', 'Envie convites, organize histórico, prescreva treino, dieta e rotina semanal.'],
                ['03', 'Acompanhe evolução e vendas', 'Veja cargas, check-ins, pagamentos, mensagens e progresso em uma operação única.'],
              ].map(([number, title, text]) => (
                <div key={number} data-reveal className="sales-feature-card rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500 text-sm font-black text-zinc-950">{number}</span>
                  <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ExpressCreationSalesSection openAccess={openAccess} />

        <section id="simulador" className="sales-section sales-section-blue mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">Potencial de faturamento</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Quando a operação fica mais profissional, o crescimento deixa de depender apenas de trabalhar mais horas.</h2>
              <p className="mt-4 leading-7 text-zinc-300">
                O Coach Fit Pro reúne tudo que sustenta um acompanhamento de maior valor: entrega organizada, experiência do aluno, histórico, comunicação, financeiro e capacidade para atender uma carteira maior.
              </p>
              <div className="mt-6 grid gap-3">
                {[
                  ['Mais capacidade', 'Processos centralizados reduzem tarefas repetitivas e facilitam acompanhar mais alunos.'],
                  ['Maior valor percebido', 'Um portal completo torna visível tudo que existe dentro do acompanhamento.'],
                  ['Mais retenção', 'Rotina, check-ins e evolução ajudam o aluno a permanecer conectado ao processo.'],
                  ['Receita previsível', 'Planos, vencimentos e pagamentos ficam claros para o coach agir no momento certo.'],
                ].map(([title, text], index) => (
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
                  <p className="text-xs font-black uppercase text-emerald-200">Simulador de cenário</p>
                  <h3 className="mt-2 text-2xl font-black">Quanto sua operação pode movimentar?</h3>
                </div>
                <span className="text-xs text-zinc-500">Estimativa, não garantia de resultado</span>
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
              <p className="text-sm font-semibold uppercase text-emerald-300">Feito para a rotina real do coach</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Uma boa plataforma precisa se adaptar ao seu método, não substituir sua identidade.</h2>
              <p className="mt-4 leading-7 text-zinc-400">Você mantém sua metodologia e ganha uma estrutura para entregar, acompanhar e mostrar o valor dela.</p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div data-reveal className="sales-objection-positive rounded-md border border-emerald-300/25 bg-emerald-400/[0.07] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-emerald-300">O Coach Fit Pro faz sentido para você que</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Atende alunos online, presencialmente ou de forma híbrida.',
                    'Quer reduzir tarefas repetitivas sem perder proximidade.',
                    'Precisa organizar treino, dieta, evolução e financeiro.',
                    'Deseja aumentar o valor percebido do acompanhamento.',
                  ].map((item) => <ObjectionPoint key={item} text={item} positive />)}
                </div>
              </div>
              <div data-reveal className="sales-objection-warning rounded-md border border-rose-400/25 bg-rose-500/[0.06] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-rose-200">Pontos importantes antes de começar</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Não substitui sua análise e sua responsabilidade profissional.',
                    'Não garante faturamento sem posicionamento e execução.',
                    'Não obriga você a migrar todos os alunos de uma vez.',
                    'Não limita exercícios ou alimentos apenas aos itens da biblioteca.',
                  ].map((item) => <ObjectionPoint key={item} text={item} />)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {false && (
        <section className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div data-reveal>
              <p className="text-sm font-black uppercase text-emerald-200">Depoimentos de uso</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                A sensação para o coach é parar de apagar incêndio.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Exemplos realistas do tipo de transformação operacional que buscamos entregar para treinadores.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['★★★★★', '“Antes eu perdia cobrança no WhatsApp. Agora sei quem pagou, quem está pendente e consigo agir rápido.”', 'Marina C.', 'Personal trainer'],
                ['★★★★★', '“O aluno sente que recebeu um app meu. A percepção de valor mudou muito na renovação.”', 'Rafael M.', 'Coach online'],
                ['★★★★★', '“Registrar carga e feedback deixou minha prescrição mais inteligente. Não dependo mais de lembrar tudo.”', 'Lucas A.', 'Treinador presencial'],
              ].map(([stars, quote, name, role]) => (
                <div key={name} data-reveal className="sales-feature-card rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm font-black text-blue-100">{stars}</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-200">{quote}</p>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-sm font-black text-white">{name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        <section className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div data-reveal>
              <p className="text-sm font-black uppercase text-emerald-200">Depoimentos reais</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                Pronto para exibir prova social quando seus relatos chegarem.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                A pagina fica preparada para mostrar avaliacoes verdadeiras, sem nomes inventados, numeros falsos ou promessas irreais.
              </p>
            </div>
            <div data-reveal className="sales-feature-card rounded-3xl border border-emerald-300/18 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">Adicione depoimentos reais pelo painel.</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                    Use foto, nome, profissao, contexto de uso e resultado percebido somente quando o cliente autorizar.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">Estado administrativo vazio</span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {['Foto e nome', 'Profissao e contexto', 'Relato autorizado'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300/10 text-emerald-100">
                      <NavIcon name="check" className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-sm font-black text-white">{item}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Pronto para preencher quando houver prova real.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="duvidas" className="sales-section mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="text-center" data-reveal>
            <p className="text-sm font-semibold uppercase text-emerald-200">Dúvidas antes de começar</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">O que você precisa saber sobre o Coach Fit Pro</h2>
          </div>
          <div className="mt-9 grid gap-3">
            {[
              ['Meus alunos precisam instalar alguma coisa?', 'Não. O acesso funciona pelo navegador no celular ou computador, usando o código individual enviado pelo coach.'],
              ['Já uso WhatsApp. Por que preciso de uma plataforma?', 'O WhatsApp continua útil para contato rápido. O Coach Fit Pro organiza o que precisa permanecer acessível e consultável: prescrição, histórico, check-ins, medidas, agenda e financeiro.'],
              ['Vou precisar cadastrar tudo novamente?', 'Você pode começar com os alunos ativos e preencher as informações conforme usa. Não é necessário interromper seu atendimento para organizar toda a carteira.'],
              ['Consigo usar no celular e no desktop?', 'Sim. O painel e o portal do aluno foram adaptados para os dois formatos, permitindo acompanhar a operação onde você estiver.'],
              ['Preciso abandonar minhas ferramentas atuais no primeiro dia?', 'Não. Você pode implantar o Coach Fit Pro por etapas, validar o fluxo com alguns alunos e ampliar conforme sua equipe ganha segurança.'],
              ['Quais planos estão disponíveis?', 'Você pode escolher entre plano mensal, semestral ou anual. Todos liberam o painel completo, portal do aluno, treinos, nutrição, cobranças, chat e acompanhamento em um só lugar. O valor e a condição de cada plano aparecem na etapa de pagamento da Cartpanda.'],
            ].map(([question, answer], index) => (
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
              <p className="text-sm font-black uppercase text-emerald-300">Planos Coach Fit Pro</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                Comece hoje. Escale no seu ritmo.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Escolha o ciclo ideal, veja a oferta na hora e libere uma estrutura completa para vender, acompanhar e reter alunos.
              </p>

              <div className="mx-auto mt-7 grid max-w-3xl gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-2xl shadow-black/30 sm:grid-cols-3">
                {salesPlans.map((plan) => {
                  const selected = selectedOfferPlan.id === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedOfferPlanId(plan.id)}
                      className={`min-h-16 rounded-xl px-3 py-3 text-left transition ${
                        selected
                          ? 'bg-emerald-400 text-zinc-950 shadow-xl shadow-emerald-950/35 ring-2 ring-emerald-200/40'
                          : 'border border-white/5 text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="block text-base font-black">{plan.name}</span>
                      <span className={`mt-1 block text-[11px] font-bold uppercase ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>{plan.cycle}</span>
                      <span className="mt-1 block text-sm font-black">{plan.price}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mx-auto mt-7 grid max-w-5xl gap-5 lg:mt-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.7fr)] lg:items-stretch">
              <div className="sales-plan-card sales-interactive relative overflow-hidden rounded-2xl border border-emerald-400/45 bg-gradient-to-br from-emerald-500/16 via-zinc-950 to-zinc-950 p-4 shadow-2xl shadow-emerald-950/25 sm:p-6">
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-500/18 blur-3xl" aria-hidden="true" />
                <div className="relative">
                  <div className="sales-plan-strategy mb-4 grid gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <p className="text-xs font-black uppercase text-emerald-100">
                        {selectedOfferPlan.id === 'mensal' ? 'Oferta de entrada' : 'Condição estratégica'}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6 text-emerald-50">
                        {selectedOfferPlan.id === 'mensal'
                          ? 'Ative o primeiro mês por R$ 9,90. Depois, a continuidade fica em R$ 49,90/mês.'
                          : `${selectedOfferPlan.economy}. Acesso completo, sem taxa extra por aluno cadastrado.`}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-200/25 bg-zinc-950/70 px-4 py-2 text-xs font-black uppercase text-emerald-100">
                      Sem taxa por aluno
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-blue-300">{selectedOfferPlan.cycle}</p>
                      <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">{selectedOfferPlan.name}</h3>
                    </div>
                    <span className="w-fit rounded-full bg-blue-500 px-4 py-2 text-xs font-black uppercase text-white shadow-lg shadow-blue-950/30">
                      {selectedOfferPlan.badge}
                    </span>
                  </div>

                  <div className="mt-5">
                    {selectedOfferPlan.oldPrice ? <p className="text-base font-bold text-zinc-500 line-through">De {selectedOfferPlan.oldPrice}</p> : null}
                    <div className="mt-1 flex flex-wrap items-end gap-3">
                      <span className="text-5xl font-black leading-none text-white sm:text-6xl">{selectedOfferPlan.price}</span>
                      <span className="pb-2 text-base font-bold text-zinc-400">{selectedOfferPlan.suffix}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-black uppercase text-emerald-100">Comparativo</p>
                        <p className="mt-1 text-sm font-black text-white">{selectedOfferPlan.total}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                        <p className="text-xs font-black uppercase text-emerald-200">Vantagem</p>
                        <p className="mt-1 text-sm font-black text-emerald-50">{selectedOfferPlan.economy}</p>
                      </div>
                    </div>
                  </div>

                  <p className="sales-plan-description mt-4 max-w-2xl text-sm leading-6 text-zinc-200">{selectedOfferPlan.description}</p>

                  <div className="sales-plan-proof mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/[0.11] p-4">
                      <p className="text-xs font-black uppercase text-blue-200">Decisão inteligente</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-100">
                        {selectedOfferPlan.id === 'mensal'
                          ? 'Perfeito para testar a operação sem travar caixa e já sentir a diferença na entrega.'
                          : selectedOfferPlan.id === 'semestral'
                            ? 'Dá tempo para implantar, ajustar o processo e medir retenção com mais tranquilidade.'
                            : 'Melhor para quem quer transformar o app em estrutura fixa e reduzir custo mensal.'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-300/35 bg-emerald-300/[0.12] p-4 shadow-lg shadow-emerald-950/20">
                      <p className="text-xs font-black uppercase text-emerald-100">Melhor para</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white">{selectedOfferPlan.bestFor}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.12] p-4">
                      <p className="text-xs font-black uppercase text-emerald-200">O que você destrava</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-100">
                        Painel do coach, app do aluno, treino, nutrição, financeiro, chat, agenda, desafios, água, check-ins e evolução.
                      </p>
                    </div>
                  </div>

                  <div className="sales-plan-after mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-zinc-500">Depois de assinar</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-100">{selectedOfferPlan.operatingPromise}</p>
                      </div>
                      <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">liberação automática</span>
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

                  <div className="sales-plan-mini-benefits mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Entrega premium', 'treino, dieta, check-ins e chat em um só fluxo'],
                      ['Mais percepção', 'o aluno sente que está dentro de uma operação profissional'],
                      ['Mais controle', 'processos organizados para vender e acompanhar melhor'],
                    ].map(([title, text]) => (
                      <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-black text-white">{title}</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">{text}</p>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={() => startPlanSignup(selectedOfferPlan.id)} className="mt-7 w-full rounded-xl bg-blue-500 px-5 py-4 text-base font-black text-zinc-950 shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 sm:w-auto sm:min-w-52">
                    Assinar agora
                  </button>
                </div>
              </div>

              <div className="sales-plan-side rounded-2xl border border-white/10 bg-zinc-950/92 p-5 shadow-2xl shadow-black/30 sm:p-6">
                <p className="text-sm font-black uppercase text-zinc-400">Incluso no plano</p>
                <div className="mt-5 grid gap-3">
                  {selectedOfferPlan.highlights.map((item) => (
                    <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-200">
                      <span className="text-blue-300">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="text-xs font-black uppercase text-emerald-200">Sem taxa por aluno</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    O treinador cresce a carteira sem pagar adicional por aluno cadastrado.
                  </p>
                </div>
                <div className="mt-4 rounded-xl border border-blue-300/20 bg-blue-400/10 p-4">
                  <p className="text-xs font-black uppercase text-blue-200">Próximo passo simples</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Crie sua conta, confirme o plano escolhido e o painel é liberado assim que a Cartpanda aprovar o pagamento.
                  </p>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-black uppercase text-zinc-400">Implantação prática</p>
                  <div className="mt-3 grid gap-2">
                    {['Cadastre seus planos e alunos ativos', 'Envie convites com acesso individual', 'Acompanhe treino, dieta, chat e financeiro no mesmo painel'].map((item, index) => (
                      <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-black text-zinc-950">{index + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-lg font-black text-white">100%</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">das ferramentas liberadas</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-lg font-black text-white">0%</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">taxa extra por aluno</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div data-reveal className="overflow-hidden rounded-3xl border border-blue-300/25 bg-gradient-to-br from-blue-500/18 via-zinc-950 to-emerald-500/10 p-6 shadow-2xl shadow-blue-950/30 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase text-blue-100">Pronto para vender uma entrega mais premium?</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                Organize sua operação antes que sua agenda cresça mais do que seu controle.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-300">
                Treino, consultoria, aulas presenciais, evolução, cargas, cobrança e comunicação com o aluno em uma experiência moderna.
              </p>
            </div>
            <button type="button" onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-6 w-full rounded-2xl bg-blue-500 px-6 py-4 text-base font-black text-zinc-950 shadow-xl shadow-blue-950/35 transition hover:-translate-y-0.5 lg:mt-0 lg:w-auto lg:min-w-56">
              Assinar agora
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05070d] px-4 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span>Coach Fit Pro · Gestão profissional de acompanhamento</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => setLegalModal('terms')} className="rounded-full border border-white/10 px-3 py-1.5 font-bold text-zinc-300 transition hover:border-emerald-300/40 hover:text-white">
              Termos de uso
            </button>
            <button type="button" onClick={() => setLegalModal('privacy')} className="rounded-full border border-white/10 px-3 py-1.5 font-bold text-zinc-300 transition hover:border-emerald-300/40 hover:text-white">
              Privacidade
            </button>
            <a href="mailto:sac@coachfitpro.com.br" className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 font-bold text-emerald-100 transition hover:border-emerald-300/50">
              Suporte
            </a>
          </div>
        </div>
        <span className="sr-only">
        Coach Fit Pro · Gestão profissional de acompanhamento
        </span>
      </footer>
      <LegalModal type={legalModal} onClose={() => setLegalModal('')} />
    </div>
  )
}

function LegalModal({ type, onClose }) {
  if (!type) return null

  const isPrivacy = type === 'privacy'
  const title = isPrivacy ? 'Privacidade e dados' : 'Termos de uso'
  const intro = isPrivacy
    ? 'O Coach Fit Pro utiliza dados de cadastro, acompanhamento, fotos, mensagens, treinos, dieta e pagamentos para operar o painel do treinador e o acesso do aluno.'
    : 'O Coach Fit Pro é uma plataforma de organização para treinadores. A prescrição, orientação profissional e relação com o aluno continuam sob responsabilidade do treinador.'
  const items = isPrivacy
    ? [
        'Dados sensíveis devem ser usados apenas com consentimento do aluno e finalidade de acompanhamento.',
        'Fotos, check-ins e mensagens ficam vinculados ao treinador responsável e ao aluno cadastrado.',
        'Chaves de API e integrações ficam protegidas no ambiente seguro da Supabase, não no navegador do usuário.',
        'Solicitações sobre dados podem ser enviadas para sac@coachfitpro.com.br.',
      ]
    : [
        'O treinador deve usar o sistema de forma ética, profissional e conforme as regras da sua área de atuação.',
        'A plataforma não substitui avaliação médica, nutricional ou física quando ela for necessária.',
        'Pagamentos, planos e liberações podem depender da confirmação do provedor de checkout.',
        'O acesso pode ser limitado em caso de uso indevido, inadimplência ou violação de segurança.',
      ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5 text-zinc-100 shadow-2xl shadow-black/50 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-emerald-300">Coach Fit Pro</p>
            <h2 className="mt-2 text-2xl font-black">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-xl font-black text-zinc-300 transition hover:border-emerald-300/40 hover:text-white" aria-label="Fechar">
            ×
          </button>
        </div>
        <p className="mt-5 text-sm leading-7 text-zinc-300">{intro}</p>
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExpressCreationSalesSection({ openAccess }) {
  return (
    <section className="sales-section border-y border-emerald-300/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,rgba(2,8,8,0.96),rgba(5,8,14,0.98))] py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div data-reveal>
            <p className="text-sm font-black uppercase text-emerald-300">Criação expressa</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
              Crie treinos e planos em minutos, sem começar do zero.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              Use modelos, duplique estruturas, personalize rapidamente e mantenha cada aluno organizado em um só lugar.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                'Monte uma vez. Personalize quando precisar. Reutilize sempre.',
                'Ganhe tempo sem perder a individualização.',
                'Centralize treino, alimentação e acompanhamento no mesmo fluxo.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300 text-zinc-950">
                    <NavIcon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-bold leading-6 text-zinc-200">{item}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => openAccess('signup')} className="mt-6 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-300 active:scale-[0.98]">
              Criar meu primeiro treino
            </button>
          </div>

          <div data-reveal className="grid gap-4">
            <div className="sales-feature-card rounded-3xl border border-emerald-300/25 bg-zinc-950/78 p-4 shadow-2xl shadow-emerald-950/20 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-5">
                {[
                  ['01', 'Aluno'],
                  ['02', 'Objetivo'],
                  ['03', 'Modelo'],
                  ['04', 'Personalização'],
                  ['05', 'Publicação'],
                ].map(([number, title], index) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <span className={`mx-auto grid h-9 w-9 place-items-center rounded-xl text-xs font-black ${index === 4 ? 'bg-emerald-300 text-zinc-950' : 'bg-white/[0.06] text-emerald-100'}`}>{number}</span>
                    <p className="mt-2 text-xs font-black text-zinc-200">{title}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <ComparisonCard
                  tone="bad"
                  title="Antes"
                  items={['Planilhas espalhadas', 'Copiar informações manualmente', 'Procurar treinos antigos', 'Repetir o mesmo trabalho']}
                />
                <ComparisonCard
                  tone="good"
                  title="Com Coach Fit Pro"
                  items={['Modelos reutilizáveis', 'Edição rápida', 'Histórico centralizado', 'Publicação em poucos cliques']}
                />
              </div>
            </div>
            <TimeRecoveryCalculator />
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonCard({ title, items, tone = 'good' }) {
  const good = tone === 'good'
  return (
    <div className={`rounded-2xl border p-4 ${good ? 'border-emerald-300/25 bg-emerald-300/10' : 'border-rose-300/20 bg-rose-300/10'}`}>
      <p className={`text-xs font-black uppercase ${good ? 'text-emerald-200' : 'text-rose-200'}`}>{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm leading-6 text-zinc-300">
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${good ? 'bg-emerald-300' : 'bg-rose-300'}`} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimeRecoveryCalculator() {
  const [students, setStudents] = useState(20)
  const [minutes, setMinutes] = useState(35)
  const [updates, setUpdates] = useState(2)
  const monthlyMinutes = students * minutes * updates
  const hours = Math.floor(monthlyMinutes / 60)
  const remainingMinutes = monthlyMinutes % 60

  return (
    <div className="sales-interactive rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-emerald-200">Calculadora de tempo</p>
          <h3 className="mt-1 text-xl font-black text-white">Quanto tempo você pode recuperar por mês?</h3>
        </div>
        <span className="text-xs font-bold text-zinc-500">Estimativa operacional</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TimeCalcControl label="Alunos" value={students} min={1} max={120} onChange={setStudents} />
        <TimeCalcControl label="Minutos por plano" value={minutes} min={5} max={180} onChange={setMinutes} />
        <TimeCalcControl label="Atualizações/mês" value={updates} min={1} max={8} onChange={setUpdates} />
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4">
        <p className="text-sm font-black text-emerald-100">Hoje isso pode representar cerca de {hours}h{remainingMinutes ? ` ${remainingMinutes}min` : ''} em tarefas de montagem e ajustes.</p>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Organizar e reutilizar estruturas pode reduzir tarefas repetitivas. Cada hora economizada pode ser usada para acompanhar alunos, vender consultorias ou melhorar seu serviço.
        </p>
      </div>
    </div>
  )
}

function TimeCalcControl({ label, value, min, max, onChange }) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-zinc-950/55 p-3 text-xs font-black uppercase text-zinc-500">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-emerald-300" />
      <span className="text-lg font-black text-white">{value}</span>
    </label>
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

function SalesPhoneShowcase() {
  const [activeIndex, setActiveIndex] = useState(1)
  const screens = [
    ['Início do aluno', 'Olá, aluno', 'Semana, água e desafios', 'Meta do dia em progresso', ['Treino concluído: +80 XP', 'Água 1,8L / 2,5L', 'Desafio semanal 3/5'], 'trophy', '+80 XP', 'ranking atualizado'],
    ['Treino de hoje', 'LEGS', 'Carga por exercício', 'Registrar série realizada', ['Agachamento: 80 kg', 'Leg press: 160 kg', 'Cadeira extensora: 45 kg'], 'dumbbell', 'Treino', 'em execução'],
    ['Dashboard financeiro', 'Recebimentos', 'Vendas e renovações', 'Cobrança automática', ['R$ 8.940 recebidos', '32 renovações próximas', '94% pagos'], 'wallet', 'R$ 8.940', 'recebido no mês'],
  ]

  const metrics = [
    ['wallet', 'R$ 12.450', 'carteira organizada'],
    ['trophy', '+34%', 'retencao estimada'],
    ['dashboard', '1 painel', 'treino, dieta e cobranca'],
  ]

  return (
    <div className="sales-hero-phone-wrap" aria-label="Prévia do aplicativo Coach Fit Pro">
      <div className="sales-hero-phone-glow" aria-hidden="true" />
      {metrics.map(([icon, value, label], index) => (
        <div key={label} className={`sales-showcase-metric metric-${index + 1}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
            <NavIcon name={icon} className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <strong>{value}</strong>
            <small>{label}</small>
          </span>
        </div>
      ))}
      {screens.map(([kicker, title, subtitle, action, rows, floatingIcon, floatingTitle, floatingText], index) => {
        const active = activeIndex === index
        return (
        <button
          key={title}
          type="button"
          aria-label={`Ver mockup: ${title}`}
          aria-pressed={active}
          onClick={() => setActiveIndex(index)}
          className={`sales-phone-mockup sales-hero-phone-${index + 1} ${active ? 'is-active' : ''}`}
        >
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
            <div className="sales-phone-statusbar" aria-hidden="true">
              <span>09:30</span>
              <span className="sales-phone-status-icons">
                <span className="sales-signal" />
                <span className="sales-wifi" />
                <span className="sales-battery" />
              </span>
            </div>
            <div className="sales-phone-notch" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-200">{kicker}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-blue-100">{active ? 'ao vivo' : 'prévia'}</span>
            </div>
            <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
            <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
            <div className="mt-4 rounded-2xl border border-blue-300/20 bg-gradient-to-br from-blue-500/35 to-emerald-300/10 p-3">
              <p className="text-xs font-black text-emerald-100">{action}</p>
              <div className="mt-3 h-2 rounded-full bg-zinc-800">
                <div className="h-2 rounded-full bg-blue-300" style={{ width: `${68 + index * 9}%` }} />
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
              {[
                ['dashboard', 'Início'],
                ['wallet', 'Fatura'],
                ['dumbbell', 'Treino'],
                ['message', 'Chat'],
              ].map(([icon, label]) => (
                <span key={label} className="grid justify-items-center gap-1 text-[9px] font-bold text-zinc-400">
                  <NavIcon name={icon} className="h-3.5 w-3.5 text-emerald-200" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </button>
        )
      })}
      <div className="sales-showcase-tabs" aria-label="Selecionar prévia">
        {screens.map((screen, index) => (
          <button
            key={screen[1]}
            type="button"
            aria-label={`Mostrar ${screen[1]}`}
            onClick={() => setActiveIndex(index)}
            className={`sales-showcase-tab ${activeIndex === index ? 'is-active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

function ObjectionPoint({ text, positive = false }) {
  return (
    <div className={`flex gap-3 text-sm leading-6 ${positive ? 'text-emerald-50' : 'text-rose-50'}`}>
      <span className={`mt-2 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${positive ? 'bg-emerald-400 text-zinc-950' : 'bg-rose-500 text-white'}`}>
        {positive ? '✓' : '!'}
      </span>
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

function Overview({ selectedStudent, smartAlerts, priorityDashboard, assessments, invoices, setSelectedStudentId, setActiveView }) {
  if (!selectedStudent) {
    return (
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Comece sua operação" action="Primeiros passos">
          <div className="mb-4 overflow-hidden rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-emerald-200">Ativação guiada</p>
                <p className="mt-1 text-sm leading-6 text-zinc-200">
                  Comece pelo essencial: marca, primeiro aluno, entrega inicial e convite. Em poucos minutos o painel já fica pronto para operar.
                </p>
              </div>
              <span className="w-fit rounded-full border border-emerald-300/25 bg-zinc-950/60 px-3 py-1 text-xs font-black text-emerald-100">4 etapas</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-600" />
            </div>
          </div>

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
                className="group flex w-full items-start gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-400/[0.06]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400 font-black text-zinc-950 shadow-lg shadow-emerald-950/30">{number}</span>
                <span className="min-w-0">
                  <span className="block font-black text-white">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-400">{description}</span>
                  <span className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-black text-emerald-100 transition group-hover:border-emerald-300/40">
                    Abrir etapa
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Conta pronta para iniciar" action="Ambiente limpo">
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4">
            <p className="font-black text-blue-200">Nenhum dado demonstrativo</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Sua conta está vazia e preparada para receber somente alunos reais da sua operação.
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ['Treino', 'publique o primeiro treino antes de convidar'],
              ['Dieta', 'cadastre pelo menos uma rotina alimentar'],
              ['Cobrança', 'configure Pix e mensagem padrão'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setActiveView('alunos')} className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
            Cadastrar primeiro aluno
          </button>
        </Panel>
      </div>
    )
  }

  const assessmentData = buildAssessmentChartData(assessments, selectedStudent?.id)
  const revenueChartData = buildRevenueChartData(invoices)
  const actionPlan = buildCoachActionPlan(smartAlerts)
  const openStudentFromPriority = (studentId, view = 'alunos') => {
    setSelectedStudentId?.(studentId)
    setActiveView(view)
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="xl:col-span-2">
        <DailyIntelligenceSummary dashboard={priorityDashboard} onOpenView={setActiveView} />
      </div>

      <div className="xl:col-span-2">
        <StudentPriorityPanel
          dashboard={priorityDashboard}
          onOpenStudent={(studentId) => openStudentFromPriority(studentId, 'alunos')}
          onMessageStudent={(studentId) => openStudentFromPriority(studentId, 'mensagens')}
        />
      </div>
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

function Students({ students, workoutLogs = [], invites, anamneses, selectedStudent, setSelectedStudentId, onSave, onSaveCoachPlan, onGenerateInvite, onDelete, coachPlans = plans }) {
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
  const ranking = buildCoachStudentRanking(students, workoutLogs)
  const selectedStudentPlan = coachPlans.find((plan) => plan.name === selectedStudent?.plan) || null

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
    <div className="grid gap-4 lg:gap-6">
      <StudentRankingPanel ranking={ranking} onSelectStudent={setSelectedStudentId} selectedStudentId={selectedStudent?.id} />

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.25fr)]">
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
            onSaveCoachPlan={onSaveCoachPlan}
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
            <StudentPlanPreview plan={selectedStudentPlan || { name: selectedStudent.plan || 'Plano nao definido', price: '0', cycle: 'mensal', features: 'Selecione um plano cadastrado para ativar a cobranca automatica.' }} availablePlans={selectedStudentPlan ? coachPlans : [selectedStudentPlan || { name: selectedStudent.plan || 'Plano nao definido', price: '0', cycle: 'mensal' }]} />
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
    </div>
  )
}

function StudentRankingPanel({ ranking, onSelectStudent, selectedStudentId }) {
  return (
    <Panel title="Ranking dos alunos" action={`${ranking.length} no placar`}>
      {ranking.length ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
          <div className="rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/12 via-white/[0.035] to-blue-400/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">Pódio de evolução</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ranking.slice(0, 3).map((item, index) => (
                <button
                  key={item.student.id}
                  type="button"
                  onClick={() => onSelectStudent(item.student.id)}
                  className={`min-w-0 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    String(selectedStudentId) === String(item.student.id)
                      ? 'border-emerald-300/60 bg-emerald-300/15'
                      : 'border-white/10 bg-black/25 hover:border-emerald-300/35'
                  } ${index === 0 ? 'sm:order-2 sm:-mt-2' : index === 1 ? 'sm:order-1 sm:mt-5' : 'sm:order-3 sm:mt-8'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <RankMedal icon={item.levelIcon} label={item.levelName} size="sm" />
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-black text-zinc-300">#{item.position}</span>
                  </div>
                  <h4 className="mt-4 truncate text-base font-black text-white">{item.student.name}</h4>
                  <p className="mt-1 text-xs font-bold text-zinc-400">{item.levelName}</p>
                  <p className="mt-3 text-2xl font-black text-emerald-100">{item.xp} XP</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/45">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-blue-400" style={{ width: `${item.progress}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {ranking.slice(0, 6).map((item) => (
              <button
                key={item.student.id}
                type="button"
                onClick={() => onSelectStudent(item.student.id)}
                className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  String(selectedStudentId) === String(item.student.id)
                    ? 'border-blue-300/60 bg-blue-400/12'
                    : 'border-white/10 bg-white/[0.035] hover:border-blue-300/35'
                }`}
              >
                <RankMedal icon={item.levelIcon} label={item.levelName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-sm font-black text-white">{item.student.name}</p>
                    <p className="shrink-0 text-sm font-black text-emerald-100">{item.xp} XP</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">{item.levelName} · {item.completedCount} treinos concluídos</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Empty text="Cadastre alunos e registre treinos concluídos para montar o ranking." />
      )}
    </Panel>
  )
}

function buildCoachStudentRanking(students = [], workoutLogs = []) {
  const safeStudents = Array.isArray(students) ? students.filter(Boolean) : []
  const safeLogs = Array.isArray(workoutLogs) ? workoutLogs.filter(Boolean) : []

  return safeStudents
    .map((student) => {
      const logs = safeLogs.filter((log) => String(log.studentId ?? log.student_id ?? '') === String(student.id))
      const completedCount = logs.length
      const reward = buildStudentRewardStats({
        completedThisWeek: countWorkoutLogsThisWeek(logs),
        completedThisMonth: countWorkoutLogsThisMonth(logs),
        waterPercent: clampPercent(student.waterProgress || student.hydration || 0),
      })
      const adherenceBonus = Math.round(clampPercent(student.adherence) * 2)
      const xp = reward.xp + adherenceBonus
      return {
        student,
        completedCount,
        xp,
        levelName: reward.levelName,
        progress: reward.progress,
        levelIcon: reward.levelIcon,
      }
    })
    .sort((a, b) => b.xp - a.xp || clampPercent(b.student.adherence) - clampPercent(a.student.adherence))
    .map((item, index) => ({ ...item, position: index + 1 }))
}

function StudentForm({ student, coachPlans = plans, onSave, onSaveCoachPlan, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [continuingStudent, setContinuingStudent] = useState(student.requireAnamnesis === false)
  const selectedPlanName = coachPlans.some((plan) => plan.name === student.plan) ? student.plan : coachPlans[0]?.name
  const [planMode, setPlanMode] = useState('existing')
  const [selectedPlan, setSelectedPlan] = useState(selectedPlanName || coachPlans[0]?.name || '')
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanPrice, setNewPlanPrice] = useState('')
  const [newPlanCycle, setNewPlanCycle] = useState('mensal')
  const [newPlanFeatures, setNewPlanFeatures] = useState('Acompanhamento personalizado')
  const existingPlanPreview = coachPlans.find((plan) => plan.name === selectedPlan) || coachPlans[0]
  const newPlanPreview = normalizeCoachPlan({
    name: newPlanName || 'Novo plano do treinador',
    price: newPlanPrice || '0',
    cycle: newPlanCycle,
    features: newPlanFeatures,
  })
  const activePlanPreview = planMode === 'new' ? newPlanPreview : existingPlanPreview

  useEffect(() => {
    setSelectedPlan(selectedPlanName || coachPlans[0]?.name || '')
    setPlanMode('existing')
  }, [student.id, selectedPlanName, coachPlans])

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
      let planName = selectedPlan || coachPlans[0]?.name || 'Acompanhamento'

      if (planMode === 'new') {
        const planDraft = normalizeCoachPlan({
          name: newPlanName,
          price: newPlanPrice,
          cycle: newPlanCycle,
          features: newPlanFeatures,
        })

        if (!planDraft.name) throw new Error('Informe o nome do plano.')
        if (getPlanBillingAmount(planDraft.name, [planDraft]) <= 0) throw new Error('Informe o valor cobrado neste plano.')

        if (onSaveCoachPlan) await onSaveCoachPlan(planDraft)
        planName = planDraft.name
      }

      await onSave({
        ...student,
        name: form.get('name').toString(),
        email: form.get('email').toString(),
        phone: form.get('phone').toString(),
        cpf: cpf.replace(/\D/g, ''),
        plan: planName,
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
        <Select label="Pagamento" name="payment" defaultValue={student.payment} options={['Pago', 'Pendente']} />
      </div>
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-emerald-200">Plano comercial do aluno</p>
            <h4 className="mt-1 text-lg font-black text-white">Escolha o plano que este aluno fechou com o treinador.</h4>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              O valor e o ciclo selecionados puxam automaticamente a cobranca, o dashboard financeiro e os recebimentos.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-emerald-100">
            sincronizado
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ['existing', 'Usar plano cadastrado'],
            ['new', 'Criar novo plano'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPlanMode(mode)}
              className={`rounded-xl border px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
                planMode === mode
                  ? 'border-emerald-300/60 bg-emerald-300/18 text-emerald-50'
                  : 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-emerald-300/35'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {planMode === 'existing' ? (
          <div className="mt-4">
            <Select
              label="Plano cadastrado"
              name="existingPlan"
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value)}
              options={coachPlans.map((plan) => ({
                label: `${plan.name} - ${formatCurrency(getPlanBillingAmount(plan.name, coachPlans))} - ${getPlanCycleLabel(plan)}`,
                value: plan.name,
              }))}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-zinc-300">
              Nome do plano
              <input value={newPlanName} onChange={(event) => setNewPlanName(event.target.value)} placeholder="Ex: Consultoria premium" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-300">
              Valor cobrado
              <input value={newPlanPrice} onChange={(event) => setNewPlanPrice(event.target.value)} placeholder="Ex: 250,00" inputMode="decimal" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
            </label>
            <Select
              label="Ciclo de cobranca"
              name="newPlanCycle"
              value={newPlanCycle}
              onChange={(event) => setNewPlanCycle(event.target.value)}
              options={[
                { label: 'Semanal', value: 'semanal' },
                { label: 'Mensal', value: 'mensal' },
                { label: 'Semestral', value: 'semestral' },
                { label: 'Anual', value: 'anual' },
              ]}
            />
            <label className="grid gap-2 text-sm font-bold text-zinc-300">
              Descricao curta
              <input value={newPlanFeatures} onChange={(event) => setNewPlanFeatures(event.target.value)} placeholder="Ex: Treino, dieta e suporte semanal" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
            </label>
          </div>
        )}

        <StudentPlanPreview plan={activePlanPreview} availablePlans={planMode === 'new' ? [activePlanPreview] : coachPlans} />
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

function StudentPlanPreview({ plan, availablePlans = plans }) {
  if (!plan) {
    return (
      <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
        Cadastre pelo menos um plano em Gerenciamento ou crie um novo plano para este aluno.
      </div>
    )
  }

  const billingAmount = getPlanBillingAmount(plan.name, availablePlans)
  const monthlyEquivalent = getPlanMonthlyPrice(plan.name, availablePlans)

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <p className="text-xs font-black uppercase text-zinc-500">Plano aplicado</p>
        <h5 className="mt-2 break-words text-lg font-black text-white">{plan.name}</h5>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{plan.features || 'Plano personalizado do treinador'}</p>
      </div>
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <p className="text-xs font-black uppercase text-emerald-200">Valor da cobranca</p>
        <p className="mt-2 text-2xl font-black text-white">{formatCurrency(billingAmount)}</p>
        <p className="mt-1 text-sm font-bold text-emerald-100">{getPlanCycleLabel(plan)}</p>
      </div>
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="text-xs font-black uppercase text-cyan-100">Leitura mensal</p>
        <p className="mt-2 text-2xl font-black text-white">{formatCurrency(monthlyEquivalent)}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">Usado para previsao, carteira ativa e dashboard financeiro.</p>
      </div>
    </div>
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

const expressWorkoutBlueprints = {
  hipertrofia: {
    title: 'Hipertrofia estruturada',
    focus: 'Volume progressivo, técnica e grupos principais',
    exercises: ['Supino reto com barra', 'Remada baixa', 'Agachamento livre', 'Desenvolvimento com halteres', 'Rosca direta', 'Tríceps na polia'],
    sets: '3-4',
    reps: '8-12',
    rest: '75-90s',
  },
  emagrecimento: {
    title: 'Emagrecimento e condicionamento',
    focus: 'Gasto energético, força básica e ritmo',
    exercises: ['Agachamento livre', 'Remada baixa', 'Flexão de braços', 'Afundo com halteres', 'Prancha abdominal'],
    sets: '3',
    reps: '12-15',
    rest: '45-60s',
  },
  forca: {
    title: 'Força técnica',
    focus: 'Movimentos base, carga controlada e descanso maior',
    exercises: ['Supino reto com barra', 'Agachamento livre', 'Levantamento terra', 'Remada curvada com barra'],
    sets: '4-5',
    reps: '4-6',
    rest: '120s',
  },
  condicionamento: {
    title: 'Condicionamento funcional',
    focus: 'Consistência, circuito e controle de esforço',
    exercises: ['Leg press 45°', 'Puxada frontal', 'Desenvolvimento com halteres', 'Abdominal crunch', 'Panturrilha em pé'],
    sets: '3',
    reps: '12-20',
    rest: '45s',
  },
  manutencao: {
    title: 'Manutenção inteligente',
    focus: 'Rotina sustentável, técnica e frequência',
    exercises: ['Supino inclinado com halteres', 'Remada baixa', 'Cadeira extensora', 'Mesa flexora', 'Prancha abdominal'],
    sets: '3',
    reps: '10-12',
    rest: '60-75s',
  },
}

const expressMealBlueprints = {
  hipertrofia: [
    { name: 'Café da manhã', time: '07:00', items: [{ foodName: 'Ovo Inteiro', grams: 120 }, { foodName: 'Banana', grams: 100 }, { foodName: 'Aveia', grams: 40 }] },
    { name: 'Almoço', time: '12:30', items: [{ foodName: 'Arroz Branco', grams: 220 }, { foodName: 'Peito de Frango', grams: 180 }, { foodName: 'Azeite de Oliva', grams: 8 }] },
    { name: 'Jantar', time: '20:00', items: [{ foodName: 'Batata Doce', grams: 250 }, { foodName: 'Peito de Frango', grams: 170 }] },
  ],
  emagrecimento: [
    { name: 'Café da manhã', time: '07:00', items: [{ foodName: 'Ovo Inteiro', grams: 100 }, { foodName: 'Mamão', grams: 150 }] },
    { name: 'Almoço', time: '12:30', items: [{ foodName: 'Arroz Branco', grams: 140 }, { foodName: 'Peito de Frango', grams: 180 }, { foodName: 'Cenoura', grams: 100 }] },
    { name: 'Jantar', time: '20:00', items: [{ foodName: 'Batata Doce', grams: 150 }, { foodName: 'Peito de Frango', grams: 150 }, { foodName: 'Pepino', grams: 100 }] },
  ],
  forca: [
    { name: 'Café da manhã', time: '07:00', items: [{ foodName: 'Ovo Inteiro', grams: 120 }, { foodName: 'Pão Francês', grams: 50 }] },
    { name: 'Almoço', time: '12:30', items: [{ foodName: 'Arroz Branco', grams: 220 }, { foodName: 'Filé Mignon', grams: 160 }] },
    { name: 'Jantar', time: '20:00', items: [{ foodName: 'Batata Doce', grams: 220 }, { foodName: 'Peito de Frango', grams: 170 }] },
  ],
  condicionamento: [
    { name: 'Café da manhã', time: '07:00', items: [{ foodName: 'Iogurte Natural', grams: 170 }, { foodName: 'Banana', grams: 100 }] },
    { name: 'Almoço', time: '12:30', items: [{ foodName: 'Arroz Branco', grams: 170 }, { foodName: 'Peito de Frango', grams: 160 }, { foodName: 'Beterraba', grams: 90 }] },
    { name: 'Jantar', time: '20:00', items: [{ foodName: 'Cuscuz', grams: 150 }, { foodName: 'Ovo Inteiro', grams: 120 }] },
  ],
  manutencao: [
    { name: 'Café da manhã', time: '07:00', items: [{ foodName: 'Ovo Inteiro', grams: 100 }, { foodName: 'Banana', grams: 100 }] },
    { name: 'Almoço', time: '12:30', items: [{ foodName: 'Arroz Branco', grams: 180 }, { foodName: 'Peito de Frango', grams: 160 }] },
    { name: 'Jantar', time: '20:00', items: [{ foodName: 'Batata Doce', grams: 180 }, { foodName: 'Ovo Inteiro', grams: 100 }] },
  ],
}

function ExpressCreationModule({ selectedStudent, students, workouts = [], nutritionPlans = [], exerciseLibraryItems = [], onSaveWorkout, onSaveNutritionPlan }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
  const [step, setStep] = useState(1)
  const [studentId, setStudentId] = useState(selectedStudent?.id || students[0]?.id || '')
  const [objective, setObjective] = useState('hipertrofia')
  const [level, setLevel] = useState('intermediario')
  const [frequency, setFrequency] = useState('4')
  const [location, setLocation] = useState('academia completa')
  const [mode, setMode] = useState('modelo')
  const [mealCount, setMealCount] = useState('3')
  const [bulkSets, setBulkSets] = useState('')
  const [bulkReps, setBulkReps] = useState('')
  const [bulkRest, setBulkRest] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const student = students.find((item) => String(item.id) === String(studentId)) || selectedStudent || students[0]
  const realWorkoutModels = useMemo(() => buildExpressWorkoutModels(workouts, availableExerciseLibrary), [workouts, availableExerciseLibrary])
  const draftWorkout = useMemo(() => buildExpressWorkoutDraft({ student, objective, level, frequency, location, mode, workouts, availableExerciseLibrary, bulkSets, bulkReps, bulkRest }), [student, objective, level, frequency, location, mode, workouts, availableExerciseLibrary, bulkSets, bulkReps, bulkRest])
  const draftNutrition = useMemo(() => buildExpressNutritionDraft({ student, objective, mealCount }), [student, objective, mealCount])
  const workoutSummary = summarizeExpressWorkout(draftWorkout)
  const nutritionSummary = summarizeExpressNutrition(draftNutrition)
  const progress = Math.round((step / 5) * 100)

  useEffect(() => {
    if (selectedStudent?.id) setStudentId(selectedStudent.id)
  }, [selectedStudent?.id])

  async function publishExpressPlan() {
    if (!student?.id) {
      setError('Selecione um aluno antes de publicar.')
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const workout = await onSaveWorkout?.({ ...draftWorkout, source: 'express_creation' })
      const nutrition = await onSaveNutritionPlan?.({ ...draftNutrition, source: 'express_creation' })
      recordLeadEvent('express_plan_published', {
        studentId: student.id,
        workoutExercises: workout?.exercises?.length || draftWorkout.exercises.length,
        meals: nutrition?.meals?.length || draftNutrition.meals.length,
        objective,
      })
      setMessage('Plano publicado com sucesso. Seu aluno já pode visualizar treino e alimentação.')
      setStep(5)
    } catch (publishError) {
      setError(publishError?.message || 'Não foi possível publicar agora.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),linear-gradient(135deg,rgba(6,18,17,0.96),rgba(4,7,10,0.98))] p-4 shadow-2xl shadow-emerald-950/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase text-emerald-100">
            <NavIcon name="plus" className="h-4 w-4" />
            Criação expressa
          </span>
          <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">Crie, personalize e publique treinos e planos alimentares em poucos minutos.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            Menos tempo montando planilhas. Mais tempo acompanhando seus alunos. Monte uma vez, personalize quando precisar e reutilize sempre.
          </p>
        </div>
        <div className="min-w-52 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-black uppercase text-zinc-500">Etapa {step} de 5</p>
          <p className="mt-1 text-sm font-black text-emerald-100">{getExpressStepLabel(step)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-emerald-300 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/58 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              Aluno
              <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400">
                {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              Objetivo
              <select value={objective} onChange={(event) => setObjective(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400">
                {['hipertrofia', 'emagrecimento', 'forca', 'condicionamento', 'manutencao'].map((item) => <option key={item} value={item}>{formatUiText(item)}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              Nível
              <select value={level} onChange={(event) => setLevel(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400">
                {['iniciante', 'intermediario', 'avancado'].map((item) => <option key={item} value={item}>{formatUiText(item)}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              Frequência semanal
              <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400">
                {['2', '3', '4', '5', '6'].map((item) => <option key={item} value={item}>{item} dias</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            Local e equipamentos
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Academia completa, casa, halteres, elásticos..." className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400" />
          </label>
          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Base de criação</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['modelo', 'Usar modelo'],
                ['zero', 'Criar do zero'],
                ['duplicar', 'Duplicar treino'],
                ['adaptar', 'Adaptar existente'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-xl border px-3 py-3 text-left text-sm font-black transition ${mode === id ? 'border-emerald-300/45 bg-emerald-300/12 text-emerald-50' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-emerald-300/25'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineInput label="Séries em lote" value={bulkSets} onChange={setBulkSets} />
            <InlineInput label="Reps em lote" value={bulkReps} onChange={setBulkReps} />
            <InlineInput label="Descanso em lote" value={bulkRest} onChange={setBulkRest} />
          </div>
          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            Refeições
            <select value={mealCount} onChange={(event) => setMealCount(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400">
              {['3', '4', '5', '6'].map((item) => <option key={item} value={item}>{item} refeições</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <button key={item} type="button" onClick={() => setStep(item)} className={`h-9 min-w-9 rounded-full border text-xs font-black ${step === item ? 'border-emerald-300 bg-emerald-300 text-zinc-950' : 'border-white/10 text-zinc-400'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <ExpressSummaryMetric icon="dumbbell" label="Treino" value={`${workoutSummary.totalExercises} exercícios`} detail={`${frequency} dias/semana`} />
            <ExpressSummaryMetric icon="muscle" label="Músculos" value={workoutSummary.topMuscles.slice(0, 2).join(', ') || '-'} detail="volume visual" />
            <ExpressSummaryMetric icon="nutrition" label="Dieta" value={`${nutritionSummary.meals} refeições`} detail={`${nutritionSummary.calories} kcal`} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-emerald-200">Resumo antes de publicar</p>
                <h4 className="mt-1 text-xl font-black text-white">Tudo pronto para revisar e enviar ao aluno.</h4>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">Autosave visual</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-zinc-950/55 p-3">
                <p className="text-xs font-black uppercase text-zinc-500">Treino gerado</p>
                <h5 className="mt-1 font-black text-white">{draftWorkout.title}</h5>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{draftWorkout.focus}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draftWorkout.exercises.slice(0, 5).map((exercise) => (
                    <span key={exercise.name} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-300">{exercise.name}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-950/55 p-3">
                <p className="text-xs font-black uppercase text-zinc-500">Plano alimentar rápido</p>
                <h5 className="mt-1 font-black text-white">{draftNutrition.title}</h5>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{draftNutrition.notes}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <ExerciseMetric label="Kcal" value={nutritionSummary.calories} />
                  <ExerciseMetric label="Proteína" value={`${nutritionSummary.protein}g`} />
                  <ExerciseMetric label="Refeições" value={nutritionSummary.meals} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-sm font-black text-emerald-100">Modelos e estruturas reais</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(realWorkoutModels.length ? realWorkoutModels : [{ id: 'empty', title: 'Nenhum modelo salvo ainda', meta: 'Os treinos criados passam a servir de base para reaproveitar estruturas.' }]).slice(0, 4).map((model) => (
                <div key={model.id} className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
                  <p className="text-sm font-black text-white">{model.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{model.meta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={publishExpressPlan} disabled={saving || !students.length} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Publicando...' : 'Revisar e publicar'}
            </button>
            <button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-zinc-100">
              Próxima etapa
            </button>
          </div>
          {message ? <p className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p> : null}
          {error ? <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}

function ExpressSummaryMetric({ icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <NavIcon name={icon} className="h-5 w-5 text-emerald-200" />
      <p className="mt-3 text-xs font-black uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-emerald-200">{detail}</p>
    </div>
  )
}

function getExpressStepLabel(step) {
  return {
    1: 'Selecionando aluno',
    2: 'Definindo objetivo e rotina',
    3: 'Escolhendo base e modelos',
    4: 'Revisando treino e dieta',
    5: 'Publicação pronta',
  }[step] || 'Criação expressa'
}

function buildExpressWorkoutModels(workouts = [], exerciseLibraryItems = []) {
  return workouts
    .filter((workout) => workout?.exercises?.length)
    .slice(0, 12)
    .map((workout) => {
      const enriched = workout.exercises.map((exercise) => enrichExercise(exercise, exerciseLibraryItems))
      const muscles = summarizeExpressWorkout({ exercises: enriched }).topMuscles
      return {
        id: workout.id,
        title: workout.title || 'Treino salvo',
        workout,
        meta: `${enriched.length} exercícios · ${muscles.slice(0, 2).join(', ') || 'músculos variados'}`,
      }
    })
}

function buildExpressWorkoutDraft({ student, objective, level, frequency, location, mode, workouts = [], availableExerciseLibrary = [], bulkSets = '', bulkReps = '', bulkRest = '' }) {
  const blueprint = expressWorkoutBlueprints[objective] || expressWorkoutBlueprints.hipertrofia
  const reusableWorkout = ['duplicar', 'adaptar'].includes(mode)
    ? workouts.find((workout) => workout?.exercises?.length && String(workout.studentId) === String(student?.id))
      || workouts.find((workout) => workout?.exercises?.length)
    : null
  const sourceExercises = reusableWorkout?.exercises?.length
    ? reusableWorkout.exercises
    : blueprint.exercises.map((name) => createExerciseDraft(name, {}, availableExerciseLibrary))
  const levelAdjust = {
    iniciante: { sets: '2-3', reps: objective === 'forca' ? '5-6' : '10-12', load: 'RPE 6-7' },
    intermediario: { sets: blueprint.sets, reps: blueprint.reps, load: 'RPE 7-8' },
    avancado: { sets: objective === 'forca' ? '5' : '4', reps: blueprint.reps, load: 'RPE 8' },
  }[level] || { sets: blueprint.sets, reps: blueprint.reps, load: 'RPE 7-8' }
  const exerciseLimit = Math.max(3, Math.min(8, Number(frequency || 4) + 2))
  const exercises = sourceExercises.slice(0, exerciseLimit).map((exercise, index) => {
    const enriched = enrichExercise(exercise, availableExerciseLibrary)
    return {
      ...enriched,
      sets: bulkSets || enriched.sets || levelAdjust.sets,
      reps: bulkReps || enriched.reps || levelAdjust.reps,
      load: enriched.load || levelAdjust.load,
      rest: bulkRest || enriched.rest || blueprint.rest,
      instructions: [
        enriched.instructions,
        index === 0 ? `Criado pela Criação Expressa para ${formatUiText(objective)}. Revise técnica, limitações e resposta do aluno antes de evoluir cargas.` : '',
      ].filter(Boolean).join('\n'),
    }
  })

  return {
    studentId: student?.id || '',
    title: reusableWorkout && mode === 'duplicar' ? `${reusableWorkout.title || blueprint.title} - cópia` : blueprint.title,
    focus: `${blueprint.focus}. Frequência: ${frequency}x/semana. Local: ${location}. Nível: ${formatUiText(level)}.`,
    notes: [
      'Gerado pela Criação Expressa. Revisar limitações, lesões, preferências e histórico antes de publicar ajustes finos.',
      student?.injuries ? `Atenção a limitações: ${student.injuries}` : '',
      student?.notes ? `Histórico do aluno: ${student.notes}` : '',
    ].filter(Boolean).join('\n'),
    exercises,
  }
}

function buildExpressNutritionDraft({ student, objective, mealCount }) {
  const blueprint = expressMealBlueprints[objective] || expressMealBlueprints.hipertrofia
  const count = Math.max(3, Math.min(6, Number(mealCount || 3)))
  const meals = Array.from({ length: count }).map((_, index) => {
    const base = blueprint[index] || {
      name: `Refeição ${index + 1}`,
      time: '',
      items: [{ foodName: index % 2 ? 'Peito de Frango' : 'Ovo Inteiro', grams: index % 2 ? 150 : 100 }],
    }
    const items = base.items.map((item) => {
      const food = findExpressFoodByName(item.foodName)
      return {
        category: food?.category || 'Preparações',
        foodName: food?.name || item.foodName,
        grams: item.grams,
      }
    })
    const totals = calculateMealMacros({ ...base, items })
    return {
      name: base.name,
      time: base.time,
      foods: items
        .map((item) => `${item.foodName} (${item.grams}g)`)
        .join(', '),
      macros: formatMacroSummary(totals),
    }
  })
  const totals = estimateMacrosFromPlanMeals(meals)

  return {
    studentId: student?.id || '',
    title: `Plano alimentar rápido - ${formatUiText(objective)}`,
    calories: `${Math.round(totals.calories)} kcal`,
    protein: `${roundMacro(totals.protein)} g`,
    notes: 'Estrutura criada para revisão profissional. Não substitui avaliação nutricional individual e pode ser ajustada conforme preferências, restrições e rotina do aluno.',
    meals,
  }
}

function summarizeExpressWorkout(workout = {}) {
  const exercises = workout.exercises || []
  const muscleCounts = exercises.reduce((acc, exercise) => {
    const profile = getExerciseMuscleProfile(exercise)
    const label = profile.primaryLabel && profile.primaryLabel !== 'Músculo alvo não identificado' ? profile.primaryLabel : (exercise.muscleGroup || 'Outros')
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
  return {
    totalExercises: exercises.length,
    topMuscles: Object.entries(muscleCounts).sort((a, b) => b[1] - a[1]).map(([name]) => name),
    estimatedDuration: `${Math.max(25, exercises.length * 7)} min`,
  }
}

function summarizeExpressNutrition(plan = {}) {
  const totals = estimateMacrosFromPlanMeals(plan.meals || [])
  return {
    meals: plan.meals?.length || 0,
    calories: Math.round(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
  }
}

function findExpressFoodByName(name) {
  const normalized = normalizeText(name)
  return foodDatabase.find((food) => normalizeText(food.name) === normalized)
    || foodDatabase.find((food) => normalizeText(food.name).includes(normalized) || normalized.includes(normalizeText(food.name)))
    || null
}

function estimateMacrosFromPlanMeals(meals = []) {
  return meals.reduce((totals, meal) => {
    const parsed = parseMacroSummary(meal.macros)
    return {
      calories: totals.calories + parsed.calories,
      protein: totals.protein + parsed.protein,
      carbs: totals.carbs + parsed.carbs,
      fat: totals.fat + parsed.fat,
    }
  }, emptyMacros())
}

function parseMacroSummary(value = '') {
  const text = String(value || '')
  const numbers = text.match(/[\d,.]+/g)?.map((item) => Number(item.replace(',', '.'))) || []
  return {
    calories: numbers[0] || 0,
    protein: numbers[1] || 0,
    carbs: numbers[2] || 0,
    fat: numbers[3] || 0,
  }
}

function Workouts({ selectedStudent, students, workouts, nutritionPlans = [], workoutLogs, progressionDecisions = [], exerciseLibraryItems = [], onSaveWorkout, onSaveNutritionPlan, onArchiveWorkout, onApproveProgression, onIgnoreProgression, onUndoProgression, onSaveStudent }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
  const studentWorkouts = workouts.filter((workout) => (
    String(workout.studentId) === String(selectedStudent?.id) && workout.active !== false
  ))
  const studentLogs = workoutLogs.filter((log) => String(log.studentId) === String(selectedStudent?.id))

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div className="xl:col-span-2">
        <ExpressCreationModule
          selectedStudent={selectedStudent}
          students={students}
          workouts={workouts}
          nutritionPlans={nutritionPlans}
          exerciseLibraryItems={availableExerciseLibrary}
          onSaveWorkout={onSaveWorkout}
          onSaveNutritionPlan={onSaveNutritionPlan}
        />
      </div>

      <Panel title={`Prescrever treino - ${selectedStudent?.name ?? 'Aluno'}`} action="Novo plano">
        {students.length ? (
          <WorkoutForm students={students} selectedStudent={selectedStudent} exerciseLibraryItems={availableExerciseLibrary} onSaveWorkout={onSaveWorkout} />
        ) : (
          <Empty text="Cadastre um aluno antes de prescrever o primeiro treino." />
        )}
      </Panel>

      <Panel title="Treinos prescritos" action={`${studentWorkouts.length} ativos`}>
        <WorkoutList workouts={studentWorkouts} fallbackTitle={selectedStudent?.workout} exerciseLibraryItems={availableExerciseLibrary} onArchive={onArchiveWorkout} />
      </Panel>

      <div className="xl:col-span-2">
        <WorkoutProgressionRecommendations
          student={selectedStudent}
          workouts={studentWorkouts}
          logs={studentLogs}
          decisions={progressionDecisions.filter((decision) => String(decision.studentId) === String(selectedStudent?.id))}
          exerciseLibraryItems={availableExerciseLibrary}
          onApprove={onApproveProgression}
          onIgnore={onIgnoreProgression}
          onUndo={onUndoProgression}
        />
      </div>

      <Panel title="Notas de carga" action="Progressão">
        <LoadNotesPanel student={selectedStudent} logs={studentLogs} onSaveStudent={onSaveStudent} />
      </Panel>

      <Panel title="Histórico de execução" action={`${studentLogs.length} registros`}>
        <WorkoutLogList logs={studentLogs} />
      </Panel>
    </div>
  )
}

function WorkoutProgressionRecommendations({ student, workouts, logs, decisions = [], exerciseLibraryItems = [], onApprove, onIgnore, onUndo }) {
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const recommendations = useMemo(
    () => buildWorkoutProgressionRecommendations({ student, workouts, logs, decisions, exerciseLibraryItems }),
    [student, workouts, logs, decisions, exerciseLibraryItems],
  )
  const recentDecisions = decisions.slice(0, 4)

  useEffect(() => {
    setLoading(true)
    const timer = window.setTimeout(() => setLoading(false), 180)
    return () => window.clearTimeout(timer)
  }, [student?.id, workouts.length, logs.length, decisions.length])

  async function handleApprove(recommendation, editedTarget = null) {
    setBusyKey(recommendation.key)
    setMessage('')
    setError('')
    try {
      await onApprove?.(recommendation, editedTarget)
      setMessage('Progressão aprovada. Uma nova versão do treino foi criada e a anterior foi arquivada.')
    } catch (approveError) {
      setError(approveError?.message || 'Não foi possível aprovar a progressão.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleEdit(recommendation) {
    const sets = window.prompt('Séries alvo', recommendation.nextTarget.sets || recommendation.exercise.sets || '')
    if (sets === null) return
    const reps = window.prompt('Repetições alvo', recommendation.nextTarget.reps || recommendation.exercise.reps || '')
    if (reps === null) return
    const load = window.prompt('Carga / esforço alvo', recommendation.nextTarget.load || recommendation.exercise.load || '')
    if (load === null) return
    await handleApprove(recommendation, { ...recommendation.nextTarget, sets, reps, load })
  }

  async function handleIgnore(recommendation) {
    setBusyKey(recommendation.key)
    setMessage('')
    setError('')
    try {
      await onIgnore?.(recommendation)
      setMessage('Sugestão ignorada e registrada no histórico.')
    } catch (ignoreError) {
      setError(ignoreError?.message || 'Não foi possível ignorar a sugestão.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleUndo(decision) {
    setBusyKey(`undo-${decision.id}`)
    setMessage('')
    setError('')
    try {
      await onUndo?.(decision)
      setMessage('Alteração desfeita. Uma nova versão com a meta anterior foi criada.')
    } catch (undoError) {
      setError(undoError?.message || 'Não foi possível desfazer esta alteração.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <Panel title="Recomendações de progressão" action={`${recommendations.length} sugestões`}>
      {!student ? (
        <Empty text="Selecione um aluno para analisar progressão de treino." />
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}
        </div>
      ) : recommendations.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {recommendations.map((recommendation) => (
            <div key={recommendation.key} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-emerald-200">{student.name}</p>
                  <h4 className="mt-1 text-lg font-black text-white">{recommendation.exercise.name}</h4>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{recommendation.recentPerformance}</p>
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs font-black text-zinc-100">
                  {recommendation.confidence}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ExerciseMetric label="Carga atual" value={recommendation.previousTarget.load || '-'} />
                <ExerciseMetric label="Reps alvo" value={recommendation.previousTarget.reps || '-'} />
                <ExerciseMetric label="Séries" value={recommendation.previousTarget.sets || '-'} />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs font-black uppercase text-zinc-500">Sugestão</p>
                <p className="mt-1 text-sm font-black text-emerald-100">{recommendation.suggestion}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{recommendation.reason}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={busyKey === recommendation.key || recommendation.action === 'insufficient'} type="button" onClick={() => handleApprove(recommendation)} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
                  {busyKey === recommendation.key ? 'Aplicando...' : 'Aprovar'}
                </button>
                <button disabled={busyKey === recommendation.key || recommendation.action === 'insufficient'} type="button" onClick={() => handleEdit(recommendation)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100 disabled:cursor-not-allowed disabled:opacity-45">
                  Editar
                </button>
                <button disabled={busyKey === recommendation.key} type="button" onClick={() => handleIgnore(recommendation)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-400 disabled:opacity-45">
                  Ignorar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Dados insuficientes para sugerir progressão. Peça ao aluno para registrar cargas, repetições, RPE/RIR e concluir mais treinos." />
      )}

      {recentDecisions.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-black uppercase text-zinc-500">Histórico recente de decisões</p>
          <div className="mt-3 grid gap-2">
            {recentDecisions.map((decision) => (
              <div key={decision.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{decision.exerciseName} · {formatUiText(decision.status)}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{decision.suggestion || decision.reason}</p>
                </div>
                {decision.status === 'approved' ? (
                  <button disabled={busyKey === `undo-${decision.id}`} type="button" onClick={() => handleUndo(decision)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 disabled:opacity-50">
                    {busyKey === `undo-${decision.id}` ? 'Desfazendo...' : 'Desfazer'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
    </Panel>
  )
}

function buildWorkoutProgressionRecommendations({ student, workouts = [], logs = [], decisions = [], exerciseLibraryItems = [] }) {
  if (!student || !workouts.length) return []
  const latestWorkout = workouts.slice().sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
  if (!latestWorkout?.exercises?.length) return []
  const recentLogs = logs
    .slice()
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
    .slice(0, 6)
  const recentDecisions = new Set(decisions.slice(0, 12).filter((decision) => ['approved', 'ignored'].includes(decision.status)).map((decision) => `${normalizeText(decision.exerciseName)}-${decision.status}`))
  const frequency14 = countSince(logs, 14, (log) => log.completedAt)

  return latestWorkout.exercises
    .map((rawExercise, index) => {
      const exercise = enrichExercise(rawExercise, exerciseLibraryItems)
      const key = `${latestWorkout.id}-${normalizeText(exercise.name)}-${index}`
      const recommendation = buildExerciseProgressionRecommendation({
        student,
        workout: latestWorkout,
        exercise,
        index,
        recentLogs,
        frequency14,
      })
      return { ...recommendation, key }
    })
    .filter((recommendation) => !recentDecisions.has(`${normalizeText(recommendation.exercise.name)}-ignored`))
}

function buildExerciseProgressionRecommendation({ student, workout, exercise, index, recentLogs, frequency14 }) {
  const sessions = recentLogs
    .map((log) => parseExercisePerformanceFromLog(log, exercise.name))
    .filter(Boolean)
    .slice(0, 4)
  const previousTarget = {
    sets: exercise.sets || '',
    reps: exercise.reps || '',
    load: exercise.load || '',
    rest: exercise.rest || '',
  }
  const base = {
    studentId: student.id,
    workoutId: workout.id,
    workoutTitle: workout.title,
    exercise,
    previousTarget,
    nextTarget: previousTarget,
    action: 'insufficient',
    suggestion: 'dados insuficientes',
    reason: 'Ainda não há registros suficientes de carga, repetições, RPE/RIR ou histórico recente para sugerir mudança com segurança.',
    confidence: 'baixa confiança',
    recentPerformance: sessions.length ? summarizeExerciseSessions(sessions) : 'Sem histórico específico deste exercício.',
  }

  if (sessions.length < 2) return base

  const latest = sessions[0]
  const previous = sessions[1]
  const avgRpe = averageDefined(sessions.map((item) => item.rpe))
  const avgRir = averageDefined(sessions.map((item) => item.rir))
  const avgReps = averageDefined(sessions.map((item) => item.reps))
  const loadTrend = getNumberTrend(sessions.map((item) => item.loadKg))
  const repsTrend = getNumberTrend(sessions.map((item) => item.reps))
  const highRir = avgRir !== null && avgRir >= 3
  const highRpe = avgRpe !== null && avgRpe >= 9
  const lowRir = avgRir !== null && avgRir <= 1
  const performanceDrop = (loadTrend < -1 || repsTrend < -1) && sessions.length >= 3
  const lowFrequency = frequency14 < 2
  const hitTarget = targetWasHit(latest, exercise)
  const nextTarget = { ...previousTarget }
  let action = 'maintain'
  let suggestion = 'manter treino atual'
  let reason = 'Desempenho recente está estável. Mantenha o alvo e observe a próxima sessão.'
  let confidence = sessions.length >= 3 ? 'média confiança' : 'baixa confiança'

  if (performanceDrop && (highRpe || lowRir || lowFrequency)) {
    action = 'deload'
    suggestion = 'sugerir deload'
    nextTarget.load = reduceLoadTarget(exercise.load || latest.loadText || '', 7)
    reason = 'Houve queda de desempenho em sessões recentes combinada com esforço alto ou baixa frequência. Recomendo reduzir carga por uma sessão e priorizar recuperação.'
    confidence = 'alta confiança'
  } else if (highRpe || lowRir) {
    action = 'maintain_or_reduce'
    suggestion = latest.failed ? 'reduzir carga' : 'manter carga'
    nextTarget.load = latest.failed ? reduceLoadTarget(exercise.load || latest.loadText || '', 5) : previousTarget.load
    reason = 'O aluno registrou RPE alto ou RIR baixo. Subir carga agora pode piorar técnica ou recuperação.'
    confidence = sessions.length >= 3 ? 'alta confiança' : 'média confiança'
  } else if (hitTarget && highRir) {
    action = 'increase_load'
    suggestion = 'aumentar carga'
    nextTarget.load = increaseLoadTarget(exercise.load || latest.loadText || '', 3)
    reason = 'O aluno atingiu a meta de repetições com RIR alto. Há margem para um aumento leve e controlado de carga.'
    confidence = 'alta confiança'
  } else if (hitTarget && avgRpe !== null && avgRpe <= 8) {
    action = 'increase_reps'
    suggestion = 'aumentar repetições'
    nextTarget.reps = increaseRepTarget(exercise.reps)
    reason = 'Meta atingida com esforço controlado. Aumentar repetições é uma progressão segura antes de subir carga.'
    confidence = sessions.length >= 3 ? 'alta confiança' : 'média confiança'
  } else if (avgReps !== null && getTargetTopReps(exercise.reps) && avgReps < getTargetTopReps(exercise.reps) - 2) {
    action = 'reduce_reps'
    suggestion = 'reduzir repetições'
    nextTarget.reps = reduceRepTarget(exercise.reps)
    reason = 'As repetições realizadas ficaram abaixo da meta. Reduzir a faixa ajuda a preservar execução e aderência.'
    confidence = 'média confiança'
  } else if (sessions.length >= 3 && !performanceDrop && !highRpe && !lowRir && frequency14 >= 3) {
    action = 'add_set'
    suggestion = 'adicionar série'
    nextTarget.sets = increaseSetTarget(exercise.sets)
    reason = 'Frequência recente está boa e não há sinal de esforço excessivo. Uma série extra pode aumentar estímulo sem trocar o exercício.'
    confidence = 'média confiança'
  }

  return {
    ...base,
    action,
    suggestion,
    reason,
    confidence,
    nextTarget,
    recentPerformance: summarizeExerciseSessions(sessions),
  }
}

function parseExercisePerformanceFromLog(log, exerciseName) {
  const notes = String(log?.notes || '')
  const normalizedName = normalizeText(exerciseName)
  const lines = notes.split(/\n|;/).map((line) => line.trim()).filter(Boolean)
  const exerciseLine = lines.find((line) => {
    const normalizedLine = normalizeText(line)
    return normalizedLine.includes(normalizedName) || normalizedName.split(' ').some((part) => part.length > 4 && normalizedLine.includes(part))
  })
  const source = exerciseLine || notes
  if (!source) return null
  const repsMatch = source.match(/(\d{1,2})\s*(?:rep|reps|x)/i)
  const setsMatch = source.match(/(\d{1,2})\s*x\s*\d{1,2}/i) || source.match(/(\d{1,2})\s*(?:serie|series|s[eé]ries)/i)
  const loadMatch = source.match(/(\d{1,3}(?:[,.]\d{1,2})?)\s*(?:kg|kgs|quilos?)/i)
  const rpeMatch = source.match(/rpe\s*([0-9]{1,2}(?:[,.]\d)?)/i)
  const rirMatch = source.match(/rir\s*([0-9]{1,2}(?:[,.]\d)?)/i)
  const failed = /falh|nao consegui|não consegui|travou|dor|muito pesado/i.test(source) || log.effort === 'Muito forte'

  return {
    date: log.completedAt,
    sets: setsMatch ? Number(setsMatch[1]) : null,
    reps: repsMatch ? Number(repsMatch[1]) : null,
    loadKg: loadMatch ? Number(loadMatch[1].replace(',', '.')) : null,
    loadText: loadMatch ? `${loadMatch[1]} kg` : '',
    rpe: rpeMatch ? Number(rpeMatch[1].replace(',', '.')) : effortToRpe(log.effort),
    rir: rirMatch ? Number(rirMatch[1].replace(',', '.')) : null,
    failed,
    raw: source,
  }
}

function summarizeExerciseSessions(sessions = []) {
  const latest = sessions[0]
  const parts = [
    latest?.loadKg ? `${formatNumber(latest.loadKg)} kg` : null,
    latest?.reps ? `${latest.reps} reps` : null,
    latest?.rpe ? `RPE ${formatNumber(latest.rpe)}` : null,
    latest?.rir !== null && latest?.rir !== undefined ? `RIR ${formatNumber(latest.rir)}` : null,
  ].filter(Boolean)
  return parts.length
    ? `Última sessão: ${parts.join(' · ')}. Histórico analisado: ${sessions.length} sessão(ões).`
    : `Histórico analisado: ${sessions.length} sessão(ões), mas com poucos dados objetivos.`
}

function buildWorkoutFromProgression(workout, recommendation, nextTarget) {
  const targetName = normalizeText(recommendation.exercise.name)
  const exercises = (workout.exercises || []).map((exercise) => {
    if (normalizeText(exercise.name) !== targetName) return exercise
    const progressionNote = `Nova meta definida pelo seu treinador: ${nextTarget.sets || exercise.sets || '-'} séries, ${nextTarget.reps || exercise.reps || '-'} reps, ${nextTarget.load || exercise.load || 'carga conforme técnica'}.`
    return {
      ...exercise,
      sets: nextTarget.sets || exercise.sets,
      reps: nextTarget.reps || exercise.reps,
      load: nextTarget.load || exercise.load,
      instructions: [exercise.instructions, progressionNote].filter(Boolean).join('\n'),
    }
  })

  return {
    studentId: workout.studentId,
    title: `${workout.title} · progressão`,
    focus: workout.focus,
    notes: [workout.notes, `Nova meta definida pelo treinador em ${formatDate(new Date().toISOString())}. ${recommendation.exercise.name}: ${recommendation.suggestion}.`].filter(Boolean).join('\n'),
    exercises,
  }
}

function targetWasHit(session, exercise) {
  const topReps = getTargetTopReps(exercise.reps)
  if (!topReps || !session.reps) return !session.failed
  return session.reps >= topReps && !session.failed
}

function getTargetTopReps(value) {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || []
  return numbers.length ? Math.max(...numbers) : null
}

function averageDefined(values = []) {
  const valid = values.filter((value) => Number.isFinite(Number(value)))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length
}

function getNumberTrend(values = []) {
  const valid = values.filter((value) => Number.isFinite(Number(value)))
  if (valid.length < 2) return 0
  return Number(valid[0]) - Number(valid[valid.length - 1])
}

function effortToRpe(effort) {
  if (effort === 'Muito forte') return 9.5
  if (effort === 'Forte') return 8.5
  if (effort === 'Moderado') return 7
  if (effort === 'Leve') return 5.5
  return null
}

function increaseLoadTarget(value, percent = 3) {
  const match = String(value || '').match(/(\d{1,3}(?:[,.]\d{1,2})?)\s*(kg|kgs|quilos?)?/i)
  if (!match) return value ? `${value} + ${percent}%` : `aumentar ${percent}%`
  const current = Number(match[1].replace(',', '.'))
  return `${formatNumber(current * (1 + percent / 100))} kg`
}

function reduceLoadTarget(value, percent = 5) {
  const match = String(value || '').match(/(\d{1,3}(?:[,.]\d{1,2})?)\s*(kg|kgs|quilos?)?/i)
  if (!match) return value ? `${value} - ${percent}%` : `reduzir ${percent}%`
  const current = Number(match[1].replace(',', '.'))
  return `${formatNumber(current * (1 - percent / 100))} kg`
}

function increaseRepTarget(value) {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || []
  if (!numbers.length) return value ? `${value} +1 rep` : 'aumentar 1 repetição'
  const updated = numbers.map((item) => item + 1)
  return updated.length >= 2 ? `${updated[0]}-${updated[1]}` : String(updated[0])
}

function reduceRepTarget(value) {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || []
  if (!numbers.length) return value ? `${value} -1 rep` : 'reduzir 1 repetição'
  const updated = numbers.map((item) => Math.max(1, item - 1))
  return updated.length >= 2 ? `${updated[0]}-${updated[1]}` : String(updated[0])
}

function increaseSetTarget(value) {
  const match = String(value || '').match(/\d+/)
  if (!match) return value ? `${value} +1 série` : '4'
  return String(Number(match[0]) + 1)
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

function WorkoutForm({ students, selectedStudent, exerciseLibraryItems = exerciseLibrary, onSaveWorkout }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
  const [exercises, setExercises] = useState([
    createExerciseDraft('Supino reto com barra', { sets: '4', reps: '8-10', load: 'RPE 8', rest: '90s' }),
    createExerciseDraft('Remada baixa', { sets: '4', reps: '10-12', load: 'RPE 8', rest: '90s' }),
    createExerciseDraft('Desenvolvimento com halteres', { sets: '3', reps: '8-10', load: 'RPE 7', rest: '75s' }),
  ])
  const [resolvingExerciseIndex, setResolvingExerciseIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setExercises((current) => current.map((exercise) => enrichExercise(exercise, availableExerciseLibrary)))
  }, [availableExerciseLibrary])

  function updateExercise(index, field, value) {
    setExercises((current) => current.map((exercise, itemIndex) => (
      itemIndex === index ? { ...exercise, [field]: value } : exercise
    )))
  }

  function updateExerciseName(index, value) {
    const profile = findExerciseProfile(value, availableExerciseLibrary)
    setExercises((current) => current.map((exercise, itemIndex) => {
      if (itemIndex !== index) return exercise
      return {
        ...exercise,
        name: value,
        muscleGroup: profile?.group ?? exercise.muscleGroup,
        primaryMuscle: profile?.primaryMuscle ?? exercise.primaryMuscle,
        secondaryMuscles: profile?.secondaryMuscles ?? exercise.secondaryMuscles,
        equipment: profile?.equipment ?? exercise.equipment,
        instructions: profile?.cues ?? exercise.instructions,
        videoUrl: profile?.videoUrl || exercise.videoUrl || '',
        thumbnailUrl: profile?.thumbnailUrl || exercise.thumbnailUrl || '',
      }
    }))
  }

  function addExercise(name = '') {
    setExercises((current) => [...current, createExerciseDraft(name, {}, availableExerciseLibrary)])
  }

  function updateExerciseVideoFile(index, file) {
    setExercises((current) => current.map((exercise, itemIndex) => (
      itemIndex === index ? { ...exercise, videoFile: file || null, videoFileName: file?.name || '' } : exercise
    )))
  }

  async function resolveExerciseFromApi(index) {
    const exercise = exercises[index]
    if (!exercise?.name?.trim()) {
      setError('Digite o nome do exercício antes de buscar na AscendAPI.')
      return
    }
    if (!supabaseEnabled) {
      setError('Conecte o Supabase para buscar exercícios pela AscendAPI.')
      return
    }

    setResolvingExerciseIndex(index)
    setError('')
    setMessage('')
    try {
      const apiExercise = await fetchRemoteExerciseMedia(exercise.name)
      setExercises((current) => current.map((item, itemIndex) => (
        itemIndex === index
          ? {
            ...item,
            name: apiExercise.name || item.name,
            muscleGroup: apiExercise.group || item.muscleGroup,
            primaryMuscle: apiExercise.primaryMuscle || item.primaryMuscle,
            secondaryMuscles: apiExercise.secondaryMuscles || item.secondaryMuscles,
            equipment: apiExercise.equipment || item.equipment,
            instructions: apiExercise.cues || item.instructions,
            videoUrl: apiExercise.videoUrl || item.videoUrl,
            thumbnailUrl: apiExercise.thumbnailUrl || item.thumbnailUrl,
            imageUrl: apiExercise.imageUrl || apiExercise.thumbnailUrl || item.imageUrl,
            ascendapiId: apiExercise.externalId || apiExercise.exerciseId || item.ascendapiId,
          }
          : item
      )))
      setMessage(apiExercise.videoUrl ? 'Exercício encontrado com mídia da AscendAPI.' : 'Exercício encontrado. A API não enviou vídeo para este item, então o app usará a ficha técnica.')
    } catch (apiError) {
      setError(apiError?.message || 'Não foi possível buscar este exercício na AscendAPI.')
    } finally {
      setResolvingExerciseIndex(null)
    }
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
        exercises: filledExercises.map((exercise) => enrichExercise(exercise, availableExerciseLibrary)),
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
          <span className="w-fit rounded border border-emerald-300/20 px-2 py-1 text-xs font-bold text-emerald-200">{availableExerciseLibrary.length} exercícios</span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-soft">
          {availableExerciseLibrary.slice(0, 10).map((exercise) => (
            <button
              key={exercise.name}
              type="button"
              onClick={() => addExercise(exercise.name)}
              className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-left text-xs font-bold text-zinc-200 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-300/10 active:scale-[0.98]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                <MuscleMapMini exercise={exercise} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-40 truncate">+ {exercise.name}</span>
                <span className="mt-0.5 block max-w-40 truncate text-[10px] font-bold text-zinc-500">{exercise.group || exercise.muscleGroup || 'Músculo alvo'}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <datalist id="exercise-library-options">
        {availableExerciseLibrary.map((exercise) => <option key={exercise.name} value={exercise.name}>{exercise.group}</option>)}
      </datalist>

      <div className="space-y-3">
        {exercises.map((exercise, index) => (
          <div key={index} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-200 hover:border-emerald-300/25 hover:bg-white/[0.045] hover:shadow-lg hover:shadow-emerald-950/10">
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

            <div className="mt-4">
              <ExerciseMuscleSummary exercise={exercise} compact />
            </div>

            <details className="mt-4 rounded-md border border-white/10 bg-zinc-950/55">
              <summary className="cursor-pointer p-3 text-sm font-black text-emerald-200">Orientação e vídeo de execução</summary>
              <div className="grid gap-3 border-t border-white/10 p-3">
                <div className="flex flex-col gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-emerald-100">Buscar mídia profissional</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      Puxa vídeo, imagem, músculo-alvo e instruções pela AscendAPI. Use quando quiser completar o exercício automaticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resolvingExerciseIndex === index}
                    onClick={() => resolveExerciseFromApi(index)}
                    className="rounded-md bg-emerald-400 px-4 py-3 text-xs font-black text-zinc-950 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                  >
                    {resolvingExerciseIndex === index ? 'Buscando...' : 'Buscar na AscendAPI'}
                  </button>
                </div>
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
                      {exercise.videoFileName || 'Opcional. Se não enviar, o app usa o vídeo da biblioteca ou uma ficha técnica do movimento.'}
                    </span>
                  </label>
                </div>
                <ExerciseMedia exercise={exercise} compact />
                <div className="mt-2">
                  <ExerciseYouTubeLink exercise={exercise} compact />
                </div>
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

function WorkoutList({ workouts, fallbackTitle, exerciseLibraryItems = exerciseLibrary, onArchive }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
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
              const enriched = enrichExercise(exercise, availableExerciseLibrary)
              return (
                <div key={exercise.id ?? `${exercise.name}-${index}`} className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4 transition duration-200 hover:border-emerald-300/25 hover:bg-white/[0.045] hover:shadow-lg hover:shadow-emerald-950/10">
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
                  <div className="mt-4">
                    <ExerciseMuscleSummary exercise={enriched} />
                  </div>
                  {enriched.instructions ? <p className="mt-3 rounded bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">{enriched.instructions}</p> : null}
                  <div className="mt-3">
                    <ExerciseMedia exercise={enriched} />
                    <div className="mt-2">
                      <ExerciseYouTubeLink exercise={enriched} />
                    </div>
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

function getExerciseLibrary(remoteItems = []) {
  const records = new Map()
  const localByName = new Map(exerciseLibrary.map((exercise) => [normalizeText(exercise.name), exercise]))

  ;(remoteItems || []).forEach((exercise) => {
    if (!exercise?.name) return
    const key = normalizeText(exercise.name)
    const local = localByName.get(key) || {}
    records.set(key, {
      ...local,
      ...exercise,
      name: local.name || exercise.name,
      group: exercise.group || exercise.muscleGroup || exercise.muscle_group || local.group || '',
      primaryMuscle: exercise.primaryMuscle || exercise.primary_muscle || local.primaryMuscle || '',
      secondaryMuscles: exercise.secondaryMuscles || exercise.secondary_muscles || local.secondaryMuscles || [],
      equipment: exercise.equipment || local.equipment || '',
      cues: exercise.cues || exercise.instructions || local.cues || '',
      videoUrl: exercise.videoUrl || exercise.video_url || local.videoUrl || '',
      thumbnailUrl: exercise.thumbnailUrl || exercise.thumbnail_url || local.thumbnailUrl || '',
      imageUrl: exercise.imageUrl || exercise.image_url || exercise.thumbnailUrl || local.imageUrl || local.thumbnailUrl || '',
      aliases: [...new Set([...(local.aliases || []), ...(Array.isArray(exercise.aliases) ? exercise.aliases : [])])],
    })
  })

  exerciseLibrary.forEach((exercise) => {
    const key = normalizeText(exercise.name)
    if (!records.has(key)) records.set(key, exercise)
  })

  return [...records.values()]
}

function findExerciseProfile(value, library = exerciseLibrary) {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const exact = library.find((exercise) => (
    [exercise.name, ...(exercise.aliases ?? [])].some((candidate) => normalizeText(candidate) === normalized)
  ))
  if (exact) return exact

  if (normalized.length < 4) return null
  return library.find((exercise) => (
    [exercise.name, ...(exercise.aliases ?? [])].some((candidate) => {
      const normalizedCandidate = normalizeText(candidate)
      return normalizedCandidate.includes(normalized) || normalized.includes(normalizedCandidate)
    })
  )) ?? null
}

function createExerciseDraft(name = '', overrides = {}, library = exerciseLibrary) {
  const profile = findExerciseProfile(name, library)
  return {
    name,
    sets: '3',
    reps: '10',
    load: '',
    rest: '60s',
    muscleGroup: profile?.group ?? '',
    primaryMuscle: profile?.primaryMuscle ?? '',
    secondaryMuscles: profile?.secondaryMuscles ?? [],
    equipment: profile?.equipment ?? '',
    instructions: profile?.cues ?? '',
    videoUrl: profile?.videoUrl ?? '',
    thumbnailUrl: profile?.thumbnailUrl ?? '',
    imageUrl: profile?.imageUrl ?? profile?.thumbnailUrl ?? '',
    videoFile: null,
    videoFileName: '',
    ...overrides,
  }
}

function enrichExercise(exercise, library = exerciseLibrary) {
  const profile = findExerciseProfile(exercise.name, library)
  const muscleProfile = getExerciseMuscleProfile({
    ...profile,
    ...exercise,
    muscleGroup: exercise.muscleGroup || profile?.group || '',
  })
  return {
    ...exercise,
    muscleGroup: exercise.muscleGroup || profile?.group || '',
    primaryMuscle: exercise.primaryMuscle || exercise.primary_muscle || profile?.primaryMuscle || muscleProfile.primaryMuscle || '',
    secondaryMuscles: exercise.secondaryMuscles || exercise.secondary_muscles || profile?.secondaryMuscles || muscleProfile.secondaryMuscles || [],
    equipment: exercise.equipment || profile?.equipment || '',
    instructions: exercise.instructions || profile?.cues || '',
    videoUrl: exercise.videoUrl || profile?.videoUrl || '',
    thumbnailUrl: exercise.thumbnailUrl || profile?.thumbnailUrl || '',
    imageUrl: exercise.imageUrl || profile?.imageUrl || profile?.thumbnailUrl || '',
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

function getExerciseVideoUrl(exercise) {
  const query = `${exercise.name || 'exercício de musculação'} execução correta técnica`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

function ExerciseYouTubeLink({ exercise, compact = false }) {
  return (
    <a
      href={getExerciseVideoUrl(exercise)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-10 items-center justify-center rounded-md border border-red-300/25 bg-red-400/10 px-3 py-2 text-center text-xs font-black text-red-100 ${compact ? 'w-full sm:w-fit' : 'w-full sm:w-auto'}`}
    >
      Ver execução no YouTube
    </a>
  )
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

const muscleConfig = {
  peitoral: { label: 'Peitoral', view: 'front', aliases: ['peito', 'chest', 'pectoral', 'pectorals', 'peitoral maior'], description: 'Região principal dos movimentos de empurrar.' },
  'peitoral-superior': { label: 'Peitoral superior', view: 'front', aliases: ['peito superior', 'upper chest', 'incline chest', 'upper pectoral'], description: 'Foco na porção clavicular do peitoral.' },
  costas: { label: 'Costas', view: 'back', aliases: ['back', 'upper back', 'costas altas', 'meio das costas'], description: 'Região ampla de puxadas e remadas.' },
  dorsal: { label: 'Dorsal', view: 'back', aliases: ['lats', 'latissimus', 'latissimo', 'latíssimo', 'grande dorsal'], description: 'Responsável por puxadas e controle escapular.' },
  trapezio: { label: 'Trapézio', view: 'back', aliases: ['trapézio', 'traps', 'trap', 'trapezius'], description: 'Estabiliza escápulas e parte superior das costas.' },
  lombar: { label: 'Lombar', view: 'back', aliases: ['lower back', 'erectors', 'eretores', 'lombares'], description: 'Estabilização da coluna e extensão de quadril.' },
  'deltoide-anterior': { label: 'Deltoide anterior', view: 'front', aliases: ['ombro anterior', 'front delt', 'anterior deltoid'], description: 'Atua em empurradas e elevação frontal.' },
  'deltoide-lateral': { label: 'Deltoide lateral', view: 'front', aliases: ['ombro lateral', 'side delt', 'lateral deltoid', 'ombros'], description: 'Dá suporte às elevações laterais e abdução do ombro.' },
  'deltoide-posterior': { label: 'Deltoide posterior', view: 'back', aliases: ['ombro posterior', 'rear delt', 'posterior deltoid'], description: 'Ajuda em remadas, puxadas e postura escapular.' },
  biceps: { label: 'Bíceps', view: 'front', aliases: ['bíceps', 'biceps', 'bicep'], description: 'Flexão de cotovelo e apoio nas puxadas.' },
  triceps: { label: 'Tríceps', view: 'back', aliases: ['tríceps', 'triceps', 'tricep'], description: 'Extensão de cotovelo e finalização das empurradas.' },
  antebraco: { label: 'Antebraço', view: 'front', aliases: ['antebraço', 'forearm', 'forearms', 'grip'], description: 'Pegada, punho e estabilidade de carga.' },
  abdomen: { label: 'Abdômen', view: 'front', aliases: ['abdomen', 'abdômen', 'abs', 'core', 'abdominal'], description: 'Controle do tronco e estabilidade.' },
  obliquos: { label: 'Oblíquos', view: 'front', aliases: ['oblíquos', 'obliques', 'lateral abdomen'], description: 'Rotação, anti-rotação e estabilidade lateral.' },
  gluteos: { label: 'Glúteos', view: 'back', aliases: ['glúteos', 'gluteos', 'glutes', 'glute', 'gluteus'], description: 'Extensão de quadril e potência de membros inferiores.' },
  quadriceps: { label: 'Quadríceps', view: 'front', aliases: ['quadríceps', 'quadriceps', 'quads', 'coxa anterior'], description: 'Extensão de joelho e base de agachamentos.' },
  'posterior-coxa': { label: 'Posterior de coxa', view: 'back', aliases: ['posterior de coxa', 'posteriores', 'hamstrings', 'isquiotibiais', 'coxa posterior'], description: 'Flexão de joelho e extensão de quadril.' },
  adutores: { label: 'Adutores', view: 'front', aliases: ['adutor', 'adutores', 'adductors', 'inner thigh'], description: 'Controle interno da coxa e estabilidade do quadril.' },
  abdutores: { label: 'Abdutores', view: 'front', aliases: ['abdutor', 'abdutores', 'abductors', 'outer thigh'], description: 'Estabilidade lateral do quadril.' },
  panturrilhas: { label: 'Panturrilhas', view: 'back', aliases: ['panturrilha', 'calves', 'calf', 'gastrocnemius', 'soleus'], description: 'Elevação do calcanhar e estabilidade do tornozelo.' },
}

const muscleAliasMap = Object.entries(muscleConfig).reduce((map, [key, config]) => {
  map.set(normalizeText(key), key)
  map.set(normalizeText(config.label), key)
  ;(config.aliases || []).forEach((alias) => map.set(normalizeText(alias), key))
  return map
}, new Map())

const exerciseNameMuscleRules = [
  { match: ['supino inclinado'], primary: 'peitoral-superior', secondary: ['peitoral', 'deltoide-anterior', 'triceps'] },
  { match: ['supino', 'crucifixo', 'flexao', 'flexão'], primary: 'peitoral', secondary: ['deltoide-anterior', 'triceps'] },
  { match: ['puxada', 'barra fixa', 'pulley'], primary: 'dorsal', secondary: ['costas', 'biceps'] },
  { match: ['remada'], primary: 'costas', secondary: ['dorsal', 'biceps', 'deltoide-posterior'] },
  { match: ['desenvolvimento'], primary: 'deltoide-anterior', secondary: ['deltoide-lateral', 'triceps'] },
  { match: ['elevacao lateral', 'elevação lateral'], primary: 'deltoide-lateral', secondary: ['deltoide-anterior'] },
  { match: ['rosca'], primary: 'biceps', secondary: ['antebraco'] },
  { match: ['triceps', 'tríceps'], primary: 'triceps', secondary: ['antebraco'] },
  { match: ['agachamento', 'leg press', 'extensora', 'afundo', 'passada'], primary: 'quadriceps', secondary: ['gluteos', 'adutores'] },
  { match: ['flexora', 'stiff', 'terra', 'romeno'], primary: 'posterior-coxa', secondary: ['gluteos', 'lombar'] },
  { match: ['elevacao pelvica', 'elevação pélvica', 'hip thrust'], primary: 'gluteos', secondary: ['posterior-coxa'] },
  { match: ['panturrilha'], primary: 'panturrilhas', secondary: [] },
  { match: ['prancha', 'abdominal', 'crunch'], primary: 'abdomen', secondary: ['obliquos'] },
]

function normalizeMuscleName(value) {
  const normalized = normalizeText(String(value || '').replace(/_/g, ' ').replace(/-/g, ' '))
  if (!normalized) return ''
  if (muscleAliasMap.has(normalized)) return muscleAliasMap.get(normalized)
  const partial = [...muscleAliasMap.entries()].find(([alias]) => alias.length > 3 && (normalized.includes(alias) || alias.includes(normalized)))
  return partial?.[1] || ''
}

function splitMuscleValues(value) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .split(/,|;|\/|\+| e | and |&/i)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueMuscles(values) {
  return [...new Set(values.map(normalizeMuscleName).filter(Boolean))]
}

function getExerciseMuscleProfile(exercise = {}) {
  const primaryCandidates = [
    exercise.primaryMuscle,
    exercise.primary_muscle,
    exercise.muscleGroup,
    exercise.muscle_group,
    exercise.group,
    exercise.category,
  ]
  let primaryMuscle = ''
  let secondaryMuscles = uniqueMuscles([
    ...splitMuscleValues(exercise.secondaryMuscles),
    ...splitMuscleValues(exercise.secondary_muscles),
  ])

  for (const candidate of primaryCandidates) {
    const muscles = uniqueMuscles(splitMuscleValues(candidate))
    if (muscles.length) {
      primaryMuscle = primaryMuscle || muscles[0]
      secondaryMuscles = [...secondaryMuscles, ...muscles.slice(1)]
      break
    }
  }

  if (!primaryMuscle) {
    const normalizedName = normalizeText(exercise.name || '')
    const inferred = exerciseNameMuscleRules.find((rule) => rule.match.some((term) => normalizedName.includes(normalizeText(term))))
    if (inferred) {
      primaryMuscle = inferred.primary
      secondaryMuscles = [...secondaryMuscles, ...inferred.secondary]
    }
  }

  secondaryMuscles = [...new Set(secondaryMuscles.filter((muscle) => muscle !== primaryMuscle))]
  return {
    primaryMuscle,
    secondaryMuscles,
    primaryLabel: muscleConfig[primaryMuscle]?.label || 'Músculo alvo não identificado',
    secondaryLabels: secondaryMuscles.map((muscle) => muscleConfig[muscle]?.label).filter(Boolean),
    view: muscleConfig[primaryMuscle]?.view || secondaryMuscles.map((muscle) => muscleConfig[muscle]?.view).find(Boolean) || 'front',
  }
}

function MuscleMapMini({ exercise }) {
  const profile = getExerciseMuscleProfile(exercise)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M12 2.5a2.6 2.6 0 0 1 2.6 2.6 2.5 2.5 0 0 1-1.1 2.1l1.7 1.4 1.5 5.6-1.8.5-1.1-3.8-.9 3.5.7 6.7h-2l-.6-5.2-.6 5.2h-2l.7-6.7-.9-3.5-1.1 3.8-1.8-.5 1.5-5.6 1.7-1.4a2.5 2.5 0 0 1-1.1-2.1A2.6 2.6 0 0 1 12 2.5Z" fill="currentColor" opacity="0.32" />
      <circle cx="12" cy="5.1" r="2.1" fill="currentColor" opacity="0.44" />
      <path
        d={profile.view === 'back' ? 'M8.7 8.6h6.6l1.2 4.6-2.7 3.2H10l-2.5-3.2Z' : 'M8.5 8.6h7l-1.1 4.8H9.6Z'}
        fill="#34f5a5"
      />
    </svg>
  )
}

function MuscleMap({ exercise, compact = false, className = '' }) {
  const [hovered, setHovered] = useState('')
  const profile = useMemo(() => getExerciseMuscleProfile(exercise), [exercise])
  const activeMuscles = useMemo(() => {
    const map = new Map()
    if (profile.primaryMuscle) map.set(profile.primaryMuscle, 'primary')
    profile.secondaryMuscles.forEach((muscle) => map.set(muscle, 'secondary'))
    return map
  }, [profile.primaryMuscle, profile.secondaryMuscles])
  const view = profile.view === 'back' ? 'back' : 'front'
  const hoveredConfig = hovered ? muscleConfig[hovered] : null

  return (
    <div className={`muscle-map-card rounded-2xl border border-emerald-300/18 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%),rgba(4,8,10,0.78)] ${compact ? 'p-3' : 'p-4'} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">Músculo alvo</p>
          <p className="mt-1 text-sm font-black text-white">{profile.primaryLabel}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-black uppercase text-zinc-300">{view === 'back' ? 'traseira' : 'frontal'}</span>
      </div>
      <svg viewBox="0 0 100 132" role="img" aria-label={`Mapa muscular: ${profile.primaryLabel}`} className={`mx-auto mt-2 block ${compact ? 'h-36' : 'h-56'} w-full max-w-56`}>
        <defs>
          <filter id="muscleGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <BodySilhouette view={view} />
        <MuscleRegions view={view} activeMuscles={activeMuscles} hovered={hovered} onHover={setHovered} />
      </svg>
      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/12 px-2.5 py-1 text-[11px] font-black text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300" /> Principal
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/20 bg-teal-300/10 px-2.5 py-1 text-[11px] font-black text-teal-100">
            <span className="h-2 w-2 rounded-full bg-teal-300/70" /> Auxiliar
          </span>
        </div>
        {profile.secondaryLabels.length ? (
          <p className="text-xs leading-5 text-zinc-400">Auxiliares: {profile.secondaryLabels.join(', ')}</p>
        ) : (
          <p className="text-xs leading-5 text-zinc-500">Sem músculos auxiliares definidos para este exercício.</p>
        )}
        <p className="min-h-5 text-xs leading-5 text-emerald-100">
          {hoveredConfig ? `${hoveredConfig.label}: ${hoveredConfig.description}` : 'Toque ou passe o mouse no mapa para ver detalhes.'}
        </p>
      </div>
    </div>
  )
}

function BodySilhouette({ view }) {
  const neutral = '#273033'
  const neutralSoft = '#1b2225'
  return (
    <g opacity="0.98">
      <circle cx="50" cy="12" r="8" fill={neutral} />
      <path d="M39 22h22l7 31-6 31H38l-6-31 7-31Z" fill={neutralSoft} />
      <path d="M34 25 19 42l-6 34 9 2 8-29 8-12Z" fill={neutral} />
      <path d="M66 25 81 42l6 34-9 2-8-29-8-12Z" fill={neutral} />
      <path d="M38 83h11l-3 39H34l-3-23Z" fill={neutral} />
      <path d="M51 83h11l7 16-3 23H54Z" fill={neutral} />
      <path d="M43 122h-12l-1 6h15Z" fill={neutralSoft} />
      <path d="M57 122h12l1 6H55Z" fill={neutralSoft} />
      {view === 'back' ? <path d="M41 25h18l-9 10Z" fill="#111719" opacity="0.7" /> : <path d="M43 25h14l-7 7Z" fill="#101618" opacity="0.55" />}
    </g>
  )
}

function MuscleRegions({ view, activeMuscles, hovered, onHover }) {
  const primary = '#34f5a5'
  const secondary = 'rgba(45, 212, 191, 0.58)'
  const idle = 'rgba(255,255,255,0.08)'

  function regionProps(key) {
    const state = activeMuscles.get(key)
    const active = Boolean(state)
    return {
      role: 'img',
      tabIndex: 0,
      'aria-label': `${muscleConfig[key]?.label || key}${state === 'primary' ? ', músculo principal' : state === 'secondary' ? ', músculo auxiliar' : ''}`,
      onMouseEnter: () => onHover(key),
      onMouseLeave: () => onHover(''),
      onFocus: () => onHover(key),
      onBlur: () => onHover(''),
      fill: state === 'primary' ? primary : state === 'secondary' ? secondary : idle,
      stroke: state === 'primary' || hovered === key ? '#a7f3d0' : 'rgba(255,255,255,0.16)',
      strokeWidth: state === 'primary' ? 1.35 : 0.75,
      opacity: active ? 1 : 0.42,
      filter: state === 'primary' ? 'url(#muscleGlow)' : undefined,
      style: { cursor: 'pointer', transition: 'fill 180ms ease, opacity 180ms ease, stroke 180ms ease, transform 180ms ease', transformOrigin: 'center' },
    }
  }

  const front = (
    <>
      <ellipse cx="43" cy="34" rx="8" ry="7" {...regionProps('peitoral')}><title>Peitoral</title></ellipse>
      <ellipse cx="57" cy="34" rx="8" ry="7" {...regionProps('peitoral')}><title>Peitoral</title></ellipse>
      <path d="M39 27h22l-4 5H43Z" {...regionProps('peitoral-superior')}><title>Peitoral superior</title></path>
      <path d="M43 44h14l3 25H40Z" {...regionProps('abdomen')}><title>Abdômen</title></path>
      <path d="M36 44h7l-3 24h-6Z" {...regionProps('obliquos')}><title>Oblíquos</title></path>
      <path d="M57 44h7l2 24h-6Z" {...regionProps('obliquos')}><title>Oblíquos</title></path>
      <ellipse cx="32" cy="30" rx="6" ry="8" {...regionProps('deltoide-anterior')}><title>Deltoide anterior</title></ellipse>
      <ellipse cx="68" cy="30" rx="6" ry="8" {...regionProps('deltoide-anterior')}><title>Deltoide anterior</title></ellipse>
      <ellipse cx="29" cy="36" rx="5" ry="9" {...regionProps('deltoide-lateral')}><title>Deltoide lateral</title></ellipse>
      <ellipse cx="71" cy="36" rx="5" ry="9" {...regionProps('deltoide-lateral')}><title>Deltoide lateral</title></ellipse>
      <path d="M24 44h9l-5 21h-8Z" {...regionProps('biceps')}><title>Bíceps</title></path>
      <path d="M67 44h9l4 21h-8Z" {...regionProps('biceps')}><title>Bíceps</title></path>
      <path d="M18 66h10l-3 19h-9Z" {...regionProps('antebraco')}><title>Antebraço</title></path>
      <path d="M72 66h10l2 19h-9Z" {...regionProps('antebraco')}><title>Antebraço</title></path>
      <path d="M35 84h14l-4 35H33l-4-20Z" {...regionProps('quadriceps')}><title>Quadríceps</title></path>
      <path d="M51 84h14l6 15-4 20H55Z" {...regionProps('quadriceps')}><title>Quadríceps</title></path>
      <path d="M47 86h6l-1 31h-4Z" {...regionProps('adutores')}><title>Adutores</title></path>
      <path d="M31 88h6l-6 25-4-12Z" {...regionProps('abdutores')}><title>Abdutores</title></path>
      <path d="M63 88h6l4 13-4 12Z" {...regionProps('abdutores')}><title>Abdutores</title></path>
      <path d="M34 119h12l-2 10H32Z" {...regionProps('panturrilhas')}><title>Panturrilhas</title></path>
      <path d="M54 119h12l2 10H56Z" {...regionProps('panturrilhas')}><title>Panturrilhas</title></path>
    </>
  )

  const back = (
    <>
      <path d="M39 24h22l7 31-8 17H40l-8-17Z" {...regionProps('costas')}><title>Costas</title></path>
      <path d="M34 35h13l-8 32-9-16Z" {...regionProps('dorsal')}><title>Dorsal</title></path>
      <path d="M53 35h13l4 16-9 16Z" {...regionProps('dorsal')}><title>Dorsal</title></path>
      <path d="M41 23h18l-5 12h-8Z" {...regionProps('trapezio')}><title>Trapézio</title></path>
      <path d="M42 63h16l3 15H39Z" {...regionProps('lombar')}><title>Lombar</title></path>
      <ellipse cx="31" cy="32" rx="6" ry="9" {...regionProps('deltoide-posterior')}><title>Deltoide posterior</title></ellipse>
      <ellipse cx="69" cy="32" rx="6" ry="9" {...regionProps('deltoide-posterior')}><title>Deltoide posterior</title></ellipse>
      <path d="M23 44h9l-5 24h-9Z" {...regionProps('triceps')}><title>Tríceps</title></path>
      <path d="M68 44h9l5 24h-9Z" {...regionProps('triceps')}><title>Tríceps</title></path>
      <path d="M18 68h10l-3 18h-9Z" {...regionProps('antebraco')}><title>Antebraço</title></path>
      <path d="M72 68h10l2 18h-9Z" {...regionProps('antebraco')}><title>Antebraço</title></path>
      <path d="M36 78h28l4 17-18 8-18-8Z" {...regionProps('gluteos')}><title>Glúteos</title></path>
      <path d="M34 95h14l-3 24H33l-4-19Z" {...regionProps('posterior-coxa')}><title>Posterior de coxa</title></path>
      <path d="M52 95h14l5 5-4 19H55Z" {...regionProps('posterior-coxa')}><title>Posterior de coxa</title></path>
      <path d="M34 119h12l-2 10H32Z" {...regionProps('panturrilhas')}><title>Panturrilhas</title></path>
      <path d="M54 119h12l2 10H56Z" {...regionProps('panturrilhas')}><title>Panturrilhas</title></path>
    </>
  )

  return view === 'back' ? back : front
}

function ExerciseMuscleSummary({ exercise, compact = false }) {
  const profile = getExerciseMuscleProfile(exercise)
  return (
    <div className={`grid gap-3 ${compact ? '' : 'lg:grid-cols-[0.82fr_1fr] lg:items-stretch'}`}>
      <MuscleMap exercise={exercise} compact={compact} />
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
            <NavIcon name="muscle" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-zinc-500">Principal</p>
            <p className="mt-1 text-base font-black text-white">{profile.primaryLabel}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-100">
            <NavIcon name="layers" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-zinc-500">Auxiliares</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{profile.secondaryLabels.length ? profile.secondaryLabels.join(', ') : 'Não definidos'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-100">
            <NavIcon name="bulb" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-zinc-500">Dica técnica</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{getExerciseTechniqueTip(exercise)}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-100">
            <NavIcon name="alert" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-zinc-500">Erro comum</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{getExerciseCommonMistake(exercise)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function getExerciseTechniqueTip(exercise = {}) {
  const profile = getExerciseMuscleProfile(exercise)
  const tips = {
    peitoral: 'Mantenha escápulas firmes e controle a descida antes de empurrar.',
    'peitoral-superior': 'Use banco inclinado sem perder a linha do punho com o cotovelo.',
    costas: 'Puxe com os cotovelos e mantenha o tronco estável.',
    dorsal: 'Comece deprimindo as escápulas antes de puxar.',
    quadriceps: 'Joelhos acompanham a direção dos pés durante toda a repetição.',
    gluteos: 'Finalize contraindo glúteos sem hiperestender a lombar.',
    'posterior-coxa': 'Empurre o quadril para trás e preserve a coluna neutra.',
    biceps: 'Cotovelos próximos ao tronco e descida controlada.',
    triceps: 'Cotovelos estáveis e extensão completa com controle.',
    abdomen: 'Contraia o abdômen e evite compensar com pescoço ou lombar.',
  }
  return tips[profile.primaryMuscle] || exercise.instructions || 'Execute com amplitude controlada, respiração organizada e técnica acima da carga.'
}

function getExerciseCommonMistake(exercise = {}) {
  const profile = getExerciseMuscleProfile(exercise)
  const mistakes = {
    peitoral: 'Perder a posição dos ombros ou quicar a carga no peito.',
    'peitoral-superior': 'Inclinar demais o banco e transformar em movimento de ombro.',
    costas: 'Puxar com impulso e deixar os ombros subirem.',
    dorsal: 'Dobrar o tronco para terminar a repetição.',
    quadriceps: 'Fechar os joelhos para dentro ou perder controle na descida.',
    gluteos: 'Compensar com lombar no final do movimento.',
    'posterior-coxa': 'Arredondar a coluna para buscar mais amplitude.',
    biceps: 'Balançar o tronco para subir a carga.',
    triceps: 'Abrir os cotovelos e perder tensão no alvo.',
    abdomen: 'Prender a respiração e perder alinhamento do tronco.',
  }
  return mistakes[profile.primaryMuscle] || 'Aumentar carga antes de dominar a execução prescrita.'
}

function ExerciseMedia({ exercise, compact = false }) {
  const videoUrl = safeExternalUrl(exercise.videoUrl)
  const embedUrl = getVideoEmbedUrl(exercise.videoUrl)
  const hasCustomVideo = Boolean(videoUrl)

  if (videoUrl && isDirectVideoUrl(videoUrl)) {
    return (
      <details className="overflow-hidden rounded-md border border-emerald-300/20 bg-emerald-400/[0.06]">
        <summary className="cursor-pointer px-3 py-2 text-sm font-black text-emerald-200">Ver execução dentro do app</summary>
        <div className="aspect-video border-t border-white/10 bg-black">
          <video
            src={videoUrl}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        </div>
      </details>
    )
  }

  if (embedUrl) {
    return (
      <details className="overflow-hidden rounded-md border border-emerald-300/20 bg-emerald-400/[0.06]">
        <summary className="cursor-pointer px-3 py-2 text-sm font-black text-emerald-200">Ver execução dentro do app</summary>
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

  return <ExerciseTechniqueCard exercise={exercise} compact={compact} />
}

function ExerciseTechniqueCard({ exercise, compact = false }) {
  const target = exercise.muscleGroup || 'Músculo alvo'
  const imageUrl = safeExternalUrl(exercise.thumbnailUrl || exercise.imageUrl)
  return (
    <div className={`rounded-md border border-emerald-300/20 bg-zinc-950/70 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative h-28 w-full overflow-hidden rounded-md border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.24),transparent_34%),linear-gradient(145deg,rgba(6,78,59,0.45),rgba(9,9,11,0.92))] sm:w-36">
          {imageUrl ? (
            <img src={imageUrl} alt={`Execução de ${exercise.name}`} className="h-full w-full object-cover" />
          ) : (
            <>
              <div className="absolute left-1/2 top-4 h-5 w-5 -translate-x-1/2 rounded-full border border-emerald-200/60 bg-emerald-300/20" />
              <div className="absolute left-1/2 top-10 h-12 w-10 -translate-x-1/2 rounded-2xl border border-emerald-200/40 bg-emerald-300/10" />
              <div className="absolute left-[26%] top-12 h-11 w-3 rotate-[22deg] rounded-full bg-emerald-300/35" />
              <div className="absolute right-[26%] top-12 h-11 w-3 rotate-[-22deg] rounded-full bg-emerald-300/35" />
              <div className="absolute left-[39%] bottom-2 h-12 w-3 rotate-[8deg] rounded-full bg-emerald-300/25" />
              <div className="absolute right-[39%] bottom-2 h-12 w-3 rotate-[-8deg] rounded-full bg-emerald-300/25" />
            </>
          )}
          <span className="absolute bottom-2 left-2 rounded-full border border-emerald-300/25 bg-zinc-950/80 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
            {target}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase text-emerald-200">Vídeo ainda não cadastrado na biblioteca</p>
          <p className="mt-1 text-sm leading-6 text-zinc-300">
            {exercise.instructions || 'Siga a execução prescrita pelo treinador e registre a carga usada no final da série.'}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            O treinador pode vincular um vídeo próprio ou um vídeo da biblioteca para este exercício aparecer aqui.
          </p>
          <a
            href={getExerciseVideoUrl(exercise)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-center text-xs font-black text-emerald-100"
          >
            Buscar execução no YouTube
          </a>
        </div>
      </div>
    </div>
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
        notes: [form.get('setsLog')?.toString(), form.get('notes')?.toString()].filter(Boolean).join('\n\n') || '',
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

function StudentWorkoutExecution({ student, workout, exerciseLibraryItems = exerciseLibrary, onCompleteWorkout, preview = false }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
  const exercises = (workout?.exercises || []).map((exercise) => enrichExercise(exercise, availableExerciseLibrary))
  const [loads, setLoads] = useState({})
  const [effort, setEffort] = useState('Moderado')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!workout) return <Empty text="Nenhum treino ativo para este aluno." />

  function updateLoad(index, value) {
    setLoads((current) => ({ ...current, [index]: value }))
  }

  async function finishWorkout() {
    if (preview || !onCompleteWorkout) return

    const loadNotes = exercises
      .map((exercise, index) => ({ exercise, value: String(loads[index] || '').trim() }))
      .filter((item) => item.value)
      .map((item) => `${item.exercise.name}: ${item.value}`)

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onCompleteWorkout({
        coachId: workout.coachId,
        studentId: student.id,
        workoutId: workout.id,
        title: workout.title,
        effort,
        notes: loadNotes.length
          ? `Cargas registradas pelo aluno:\n${loadNotes.join('\n')}`
          : 'Treino concluído pelo aluno no app.',
      })
      setMessage('Treino concluído. +80 XP adicionados ao ranking e ao histórico de evolução.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível concluir o treino.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-emerald-200">{preview ? 'Prévia do aluno' : 'Execução do treino'}</p>
            <h4 className="mt-1 text-xl font-black text-white">{workout.title}</h4>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{workout.focus || student.goal || 'Plano do dia'}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-zinc-950/55 px-3 py-2 text-sm font-black text-emerald-100">
            +80 XP ao concluir
          </div>
        </div>
        {workout.notes ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-zinc-300">{workout.notes}</p> : null}
      </div>

      {exercises.length ? (
        <div className="grid gap-3">
          {exercises.map((exercise, index) => (
            <div key={exercise.id ?? `${exercise.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition duration-200 hover:border-emerald-300/25 active:scale-[0.995]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-emerald-300">Exercício {String(index + 1).padStart(2, '0')}</p>
                  <h5 className="mt-1 text-lg font-black text-white">{exercise.name}</h5>
                  <p className="mt-1 text-sm text-zinc-400">
                    {exercise.muscleGroup || 'Movimento personalizado'}{exercise.equipment ? ` · ${exercise.equipment}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <ExerciseMetric label="Séries" value={exercise.sets || '-'} />
                  <ExerciseMetric label="Reps" value={exercise.reps || '-'} />
                  <ExerciseMetric label="Carga alvo" value={exercise.load || '-'} />
                  <ExerciseMetric label="Pausa" value={exercise.rest || '-'} />
                </div>
              </div>

              {exercise.instructions ? (
                <p className="mt-3 rounded-xl border border-white/10 bg-zinc-950/55 p-3 text-sm leading-6 text-zinc-300">
                  {exercise.instructions}
                </p>
              ) : null}

              <div className="mt-4">
                <ExerciseMuscleSummary exercise={exercise} compact />
              </div>

              <label className="mt-4 grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                Carga realizada pelo aluno
                <input
                  value={loads[index] || ''}
                  disabled={preview}
                  onChange={(event) => updateLoad(index, event.target.value)}
                  placeholder={preview ? 'O aluno registra aqui a carga usada' : 'Ex.: 80 kg, 12 reps, RPE 8'}
                  className="min-h-11 min-w-0 rounded-xl border border-emerald-300/20 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none transition focus:border-emerald-400 disabled:opacity-70 sm:text-sm"
                />
              </label>

              <div className="mt-3">
                <ExerciseMedia exercise={exercise} compact />
                <div className="mt-2">
                  <ExerciseYouTubeLink exercise={exercise} compact />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Este treino ainda não possui exercícios cadastrados." />
      )}

      {!preview ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <label className="grid gap-2 text-sm font-bold text-zinc-300">
            Como foi o esforço?
            <select
              value={effort}
              onChange={(event) => setEffort(event.target.value)}
              className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
            >
              {['Leve', 'Moderado', 'Forte', 'Muito forte'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={finishWorkout}
            className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-emerald-950/25 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Concluir treino e ganhar XP'}
          </button>
          {message ? <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-3 text-sm font-bold text-rose-200">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function Nutrition({ selectedStudent, students, nutritionPlans, onSaveNutritionPlan, onArchiveNutritionPlan }) {
  const studentPlans = nutritionPlans.filter((plan) => (
    String(plan.studentId) === String(selectedStudent?.id) && plan.active !== false
  ))
  const activePlan = studentPlans[0]
  const activeMeals = activePlan?.meals?.length || 0

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="xl:col-span-2 overflow-hidden rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,rgba(9,20,18,0.96),rgba(5,8,10,0.96))] p-4 shadow-2xl shadow-emerald-950/20 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">
              <NavIcon name="nutrition" className="h-4 w-4" />
              Central nutricional
            </span>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              Monte dietas claras, com macros automáticos e opções de substituição.
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
              O treinador escolhe alimentos, ajusta gramas e entrega um plano fácil de seguir. O aluno vê refeições organizadas, horários, macros e alternativas sem se perder no celular.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <NutritionQuickStat icon="nutrition" label="Biblioteca" value={`${foodDatabase.length}+`} detail="alimentos" />
            <NutritionQuickStat icon="calendar" label="Refeições" value={activeMeals || '-'} detail="ativas" />
            <NutritionQuickStat icon="chart" label="Plano atual" value={activePlan?.calories || selectedStudent?.calories || '-'} detail={activePlan?.protein || 'macros'} />
          </div>
        </div>
      </section>

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

function NutritionQuickStat({ icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-200">
        <NavIcon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-xs font-black uppercase text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-emerald-200">{detail}</p>
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
  const totalMeals = meals.length
  const totalItems = meals.reduce((sum, meal) => sum + meal.items.length, 0)

  function updateMeal(index, field, value) {
    setMeals((current) => current.map((meal, itemIndex) => (
      itemIndex === index ? { ...meal, [field]: value } : meal
    )))
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
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-200">
                <NavIcon name="nutrition" className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-emerald-100">Assistente inteligente de alimentos</p>
                <p className="text-xs font-bold uppercase text-zinc-500">macros, porções e substituições em um só fluxo</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Digite o alimento e a quantidade. O Coach Fit Pro procura na biblioteca, reconhece nomes semelhantes e preenche kcal, proteína, carboidratos, gordura, fibra e sódio automaticamente.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
            {['Escolha o alimento', 'Ajuste as gramas', 'Confira os macros'].map((step, index) => (
              <div key={step} className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-300 text-xs font-black text-zinc-950">{index + 1}</span>
                <p className="mt-2 text-xs font-black text-zinc-100">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Select
        label="Aluno"
        name="studentId"
        defaultValue={selectedStudent?.id}
        options={students.map((student) => ({ label: student.name, value: student.id }))}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Field label="Nome da dieta" name="title" defaultValue="Plano base" />
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-2">
          <NutritionQuickStat icon="calendar" label="Refeições" value={totalMeals} detail="no dia" />
          <NutritionQuickStat icon="nutrition" label="Alimentos" value={totalItems} detail="itens" />
          <NutritionQuickStat icon="chart" label="Calorias" value={`${Math.round(planTotals.calories)}`} detail="kcal" />
          <NutritionQuickStat icon="dumbbell" label="Proteína" value={`${roundMacro(planTotals.protein)} g`} detail="calculada" />
        </div>
      </div>

      <MacroSummaryGrid totals={planTotals} />
      <TextArea label="Observações para o aluno" name="notes" defaultValue="Manter água e fibras. Reportar fome, sono e digestão no check-in." />

      <div className="space-y-4">
        {meals.map((meal, mealIndex) => {
          const mealTotals = calculateMealMacros(meal)

          return (
            <div key={mealIndex} className="rounded-2xl border border-emerald-300/15 bg-white/[0.035] p-4 shadow-xl shadow-black/10">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-sm font-black text-emerald-100">
                    {mealIndex + 1}
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">Refeição {mealIndex + 1}</p>
                    <p className="text-xs font-bold text-zinc-500">{meal.items.length} alimento(s) neste horário</p>
                  </div>
                </div>
                <button type="button" onClick={() => removeMeal(mealIndex)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-100 transition hover:border-rose-300/40 hover:bg-rose-300/10 hover:text-rose-100">
                  Remover refeição
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <InlineInput label="Refeição" value={meal.name} onChange={(value) => updateMeal(mealIndex, 'name', value)} />
                <InlineInput label="Horário" value={meal.time} onChange={(value) => updateMeal(mealIndex, 'time', value)} />
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

              <button type="button" onClick={() => addMealItem(mealIndex)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/15">
                <NavIcon name="plus" className="h-4 w-4" />
                Adicionar alimento
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addMeal} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-emerald-300/35 hover:bg-emerald-300/10">
          <NavIcon name="plus" className="h-4 w-4" />
          Adicionar refeição
        </button>
        <button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60">
          {saving ? 'Salvando...' : 'Salvar dieta'}
        </button>
      </div>
      {message ? (
        <p className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">
          {error}
        </p>
      ) : null}
    </form>
  )
}

function NutritionFormLegacy({ students, selectedStudent, onSaveNutritionPlan }) {
  const [meals, setMeals] = useState([
    { name: 'Café da manhã', time: '07:00', items: [{ category: 'Ovos', foodName: 'Ovo Inteiro', grams: 100 }] },
    { name: 'Almoço', time: '12:30', items: [{ category: 'Carboidratos', foodName: 'Arroz Branco', grams: 200 }, { category: 'Carnes', foodName: 'Peito de Frango', grams: 180 }] },
    { name: 'Jantar', time: '20:00', items: [{ category: 'Carboidratos', foodName: 'Batata Doce', grams: 250 }, { category: 'Carnes', foodName: 'Peito de Frango', grams: 160 }] },
  ])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const planTotals = sumMacros(meals.map(calculateMealMacros))
  const totalMeals = meals.length
  const totalItems = meals.reduce((sum, meal) => sum + meal.items.length, 0)

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
    if (!onArchive) return
    if (!window.confirm(`Arquivar a dieta "${plan.title}"? Ela deixará de aparecer para o aluno.`)) return
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
      {plans.map((plan) => {
        const meals = Array.isArray(plan.meals) ? plan.meals : []

        return (
          <article key={plan.id} className="overflow-hidden rounded-2xl border border-emerald-300/15 bg-[linear-gradient(145deg,rgba(11,18,20,0.98),rgba(4,7,9,0.98))] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 bg-emerald-300/[0.055] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-200">
                    <NavIcon name="nutrition" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="break-words text-lg font-black text-white">{plan.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-zinc-300">
                      Plano alimentar organizado por horário, macros e substituições.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-100">
                    Ativa
                  </span>
                  {onArchive ? (
                    <button disabled={archivingId === String(plan.id)} type="button" onClick={() => handleArchive(plan)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-rose-300/40 hover:bg-rose-300/10 hover:text-rose-100 disabled:opacity-50">
                      {archivingId === String(plan.id) ? 'Arquivando...' : 'Arquivar'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <NutritionQuickStat icon="chart" label="Calorias" value={plan.calories || '-'} detail="meta diária" />
                <NutritionQuickStat icon="dumbbell" label="Proteína" value={plan.protein || '-'} detail="por dia" />
                <NutritionQuickStat icon="calendar" label="Refeições" value={meals.length || '-'} detail="organizadas" />
              </div>
            </div>

            <div className="space-y-3 p-4">
              {plan.notes ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-emerald-200">Orientação do coach</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{plan.notes}</p>
                </div>
              ) : null}

              {meals.map((meal, index) => (
                <div key={meal.id ?? `${meal.name}-${index}`} className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-sm font-black text-emerald-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h5 className="break-words font-black text-white">{meal.time ? `${meal.time} - ` : ''}{meal.name}</h5>
                        <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{meal.foods}</p>
                      </div>
                    </div>
                    <span className="w-fit shrink-0 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black leading-5 text-emerald-100">
                      {meal.macros || 'Macros calculados'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function NutritionPlanListLegacy({ plans, selectedStudent, onArchive }) {
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
  exerciseLibraryItems = [],
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
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
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
          <div className="grid gap-4">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <p className="text-xs font-black uppercase text-emerald-200">O que o aluno enxerga</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Esta prévia mostra a tela de execução do treino com vídeo, orientação e campo de carga que o aluno registra no celular.
              </p>
            </div>
        <StudentWorkoutExecution
          student={student}
          workout={studentWorkouts[0]}
          exerciseLibraryItems={availableExerciseLibrary}
          onCompleteWorkout={onCompleteWorkout}
          preview
        />
          </div>
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

function StudentAccessApp({ access, checkins, workouts, nutritionPlans, workoutLogs, exerciseLibraryItems = [], messages, appointments, invoices, assessments, coachSettings, appAdminSettings = defaultAppAdminSettings, onCompleteWorkout, onAddCheckin, onSendMessage, onRefreshMessages, onExit }) {
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
      exerciseLibraryItems={exerciseLibraryItems}
      messages={messages}
      appointments={appointments}
      invoices={invoices}
      assessments={assessments}
      coachSettings={coachSettings}
      coachId={access.invite.coachId}
      appAdminSettings={appAdminSettings}
      onCompleteWorkout={completeStudentWorkout}
      onAddCheckin={addStudentCheckin}
      onSendMessage={sendStudentMessage}
      onRefreshMessages={onRefreshMessages}
      onExit={onExit}
    />
  )
}
function StudentMobileApp({ student, checkins, workouts, nutritionPlans, workoutLogs, exerciseLibraryItems = [], messages, appointments, invoices, assessments, coachSettings, coachId, appAdminSettings = defaultAppAdminSettings, onCompleteWorkout, onAddCheckin, onSendMessage, onRefreshMessages, onExit }) {
  const availableExerciseLibrary = useMemo(() => getExerciseLibrary(exerciseLibraryItems), [exerciseLibraryItems])
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
              <StudentWorkoutExecution
                student={student}
                workout={studentWorkouts[0]}
                exerciseLibraryItems={availableExerciseLibrary}
                onCompleteWorkout={completeWorkoutFromStudent}
              />
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
            </>
          ) : (
            <Empty text="Seu treino ainda não foi liberado pelo coach." />
          )}
        </StudentAppSection>
      )
    }

    if (activeTab === 'dieta') {
      const todayPlan = studentNutritionPlans[0]
      return (
        <StudentAppSection title="Dieta de hoje" action={todayPlan?.calories || student.calories || 'Macros'}>
          {todayPlan ? (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 shadow-xl shadow-emerald-950/10">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-100">
                  <NavIcon name="nutrition" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-emerald-200">Plano alimentar liberado</p>
                  <h3 className="mt-1 break-words text-xl font-black text-white">{todayPlan.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-300">
                    Siga uma refeição por vez. As substituições ficam dentro de cada alimento para manter os macros alinhados.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
                  <p className="text-xs font-bold text-zinc-500">Kcal</p>
                  <p className="mt-1 break-words text-sm font-black text-white">{todayPlan.calories || '-'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
                  <p className="text-xs font-bold text-zinc-500">Proteína</p>
                  <p className="mt-1 break-words text-sm font-black text-white">{todayPlan.protein || '-'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
                  <p className="text-xs font-bold text-zinc-500">Refeições</p>
                  <p className="mt-1 text-sm font-black text-white">{todayPlan.meals?.length || 0}</p>
                </div>
              </div>
            </div>
          ) : null}
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
    <div className="app-shell student-mobile-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100" style={buildAdminThemeStyle(appAdminSettings)}>
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
              <div className="mb-3">
                <RankMedal icon={reward.levelIcon} label={reward.levelName} />
              </div>
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
                <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full text-[10px] font-bold">
                  {day.completed ? <NavIcon name="check" className="h-4 w-4" /> : day.isToday ? 'hoje' : '-'}
                </span>
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
    { name: 'Selo Bronze', min: 0, icon: 'bronze', tone: 'from-amber-700 to-orange-300' },
    { name: 'Selo Prata', min: 450, icon: 'prata', tone: 'from-slate-500 to-zinc-100' },
    { name: 'Selo Ouro', min: 900, icon: 'ouro', tone: 'from-yellow-600 to-amber-200' },
    { name: 'Selo Diamante', min: 1600, icon: 'diamante', tone: 'from-cyan-400 to-emerald-200' },
    { name: 'Elite Coach Fit', min: 2600, icon: 'elite', tone: 'from-emerald-300 to-lime-200' },
  ]
  const currentIndex = levels.reduce((index, level, levelIndex) => (xp >= level.min ? levelIndex : index), 0)
  const current = levels[currentIndex]
  const next = levels[currentIndex + 1]
  const progress = next ? Math.round(((xp - current.min) / Math.max(1, next.min - current.min)) * 100) : 100
  const remainingXp = next ? Math.max(0, next.min - xp) : 0

  return {
    xp,
    levelName: current.name,
    levelIcon: current.icon,
    levelTone: current.tone,
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

function RankMedal({ icon = 'bronze', label = 'Selo Bronze', size = 'md' }) {
  const tone = {
    bronze: 'from-amber-800 via-orange-500 to-amber-200 text-amber-950',
    prata: 'from-slate-500 via-zinc-200 to-white text-zinc-950',
    ouro: 'from-yellow-700 via-amber-300 to-yellow-100 text-yellow-950',
    diamante: 'from-cyan-500 via-emerald-200 to-white text-cyan-950',
    elite: 'from-emerald-500 via-lime-200 to-white text-emerald-950',
  }[icon] || 'from-amber-800 via-orange-500 to-amber-200 text-amber-950'
  const dimensions = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14'

  return (
    <span className={`relative grid ${dimensions} shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg shadow-black/25`} title={label} aria-label={label}>
      <span className="absolute inset-1 rounded-xl border border-black/20" />
      <NavIcon name={icon === 'diamante' ? 'star' : 'trophy'} className={size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'} />
    </span>
  )
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

function countWorkoutLogsThisWeek(logs = []) {
  const start = getWeekStart(new Date())
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return (Array.isArray(logs) ? logs : []).filter((log) => {
    const date = new Date(log?.completedAt || log?.createdAt || log?.date)
    return Number.isFinite(date.getTime()) && date >= start && date < end
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
      checkoutUrl: appendAttributionToCheckoutUrl(resolveCheckoutUrl(envUrl, plan.checkoutUrl), plan.id),
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
  const currentCheckoutUrl = checkoutPlans.find((plan) => plan.id === selectedCheckoutPlanId)?.checkoutUrl || appendAttributionToCheckoutUrl(regularCheckoutUrl, selectedCheckoutPlanId)
  const selectedCheckoutPlan = checkoutPlans.find((plan) => plan.id === selectedCheckoutPlanId) || checkoutPlans[0]
  const selectedCyclePrice = selectedCheckoutPlan.id === 'mensal'
    ? formatCurrency(billingCycle.isPromotional ? firstMonthPrice : regularPrice)
    : selectedCheckoutPlan.price
  const selectedCycleSuffix = selectedCheckoutPlan.id === 'mensal'
    ? (billingCycle.isPromotional ? 'no 1º mês' : '/mês')
    : selectedCheckoutPlan.suffix
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
        recordLeadEvent('payment_confirmed', { planId: selectedCheckoutPlanId })
        stopped = true
      } else if (attempts >= 120) {
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
      recordLeadEvent('payment_confirmed', { planId: selectedCheckoutPlanId })
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
    recordLeadEvent('checkout_clicked', { planId, checkoutUrl: currentCheckoutUrl })
    setPaymentMessage('Checkout aberto em uma nova aba. Ao voltar para o app, a liberação será verificada automaticamente.')
  }

  if (!subscriptionActive) {
    return (
      <div className="grid min-w-0 gap-5 lg:gap-6">
        <section className="overflow-hidden rounded-2xl border border-emerald-400/25 bg-zinc-950/90 shadow-2xl shadow-black/35">
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.72fr)] lg:items-start">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-blue-300">Ativação da conta</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
                Falta só escolher o ciclo e ativar seu Coach Fit Pro.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Você já criou sua conta. Agora confirme o plano, faça o pagamento com o mesmo e-mail cadastrado e o painel será liberado automaticamente assim que a Cartpanda aprovar.
              </p>

              <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 sm:grid-cols-3">
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

              <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/12 via-white/[0.035] to-zinc-950 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-emerald-200">Escolha estratégica</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-100">{selectedCheckoutPlan.bestFor}</p>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">sem taxa por aluno</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedCheckoutPlan.decisionPoints.map((item) => (
                    <span key={item} className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
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

            <div className="min-w-0 rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-500/14 via-zinc-950 to-zinc-950 p-4 shadow-xl shadow-emerald-950/20 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-300">{selectedCheckoutPlan.cycle}</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{selectedCheckoutPlan.name}</h3>
                </div>
                <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase text-white">
                  {selectedCheckoutPlan.badge}
                </span>
              </div>

              <div className="mt-5">
                {selectedCheckoutPlan.oldPrice ? <p className="text-sm font-bold text-zinc-500 line-through">De {selectedCheckoutPlan.oldPrice}</p> : null}
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="text-4xl font-black leading-none text-white">{selectedCheckoutPlan.price}</span>
                  <span className="pb-1 text-sm font-bold text-zinc-400">{selectedCheckoutPlan.suffix}</span>
                </div>
                <p className="mt-2 text-sm font-black text-blue-200">{selectedCheckoutPlan.total}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-200">{selectedCheckoutPlan.economy}</p>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs font-black uppercase text-emerald-200">O que acontece depois</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{selectedCheckoutPlan.operatingPromise}</p>
              </div>

              <div className="mt-4 grid gap-2">
                {selectedCheckoutPlan.highlights.slice(0, 3).map((item) => (
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
                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-400 px-5 py-4 text-center text-base font-black text-zinc-950 shadow-xl shadow-emerald-950/35 transition hover:-translate-y-0.5"
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
          <Panel title="Central de previsibilidade" action="Recebimentos">
            <div className="grid gap-3">
              <div className="rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4">
                <p className="text-xs font-black uppercase text-emerald-200">Carteira ativa estimada</p>
                <p className="mt-2 text-3xl font-black text-white">{formatCurrency(estimatedRevenue)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Soma mensal prevista a partir dos alunos ativos e dos planos cadastrados pelo treinador.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
                  <p className="text-xs font-black uppercase text-amber-200">Atenção de cobrança</p>
                  <p className="mt-2 text-2xl font-black text-white">{students.filter((student) => student.payment !== 'Pago' && student.status !== 'Inativo').length}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">Alunos ativos que ainda precisam de confirmação de pagamento.</p>
                </div>
                <div className="rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
                  <p className="text-xs font-black uppercase text-blue-200">Planos configurados</p>
                  <p className="mt-2 text-2xl font-black text-white">{coachPlans.length}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">Mantenha nomes, valores e ciclos atualizados para não perder previsibilidade.</p>
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Próxima ação recomendada</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Revise alunos pendentes, envie cobrança pelo sistema e confirme como pago quando receber. Isso mantém o portal do aluno alinhado com a realidade financeira da carteira.
                </p>
              </div>
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
  const autoBillingRunRef = useRef(false)
  const [billingStudentId, setBillingStudentId] = useState(students[0]?.id ? String(students[0].id) : '')
  const selectedBillingStudent = students.find((student) => String(student.id) === String(billingStudentId)) || students[0]
  const selectedBillingPlan = coachPlans.find((plan) => plan.name === selectedBillingStudent?.plan) || coachPlans[0]
  const selectedBillingAmount = getPlanBillingAmount(selectedBillingPlan?.name, coachPlans) || 0
  const selectedBillingDueDate = getNextBillingDateForStudent(selectedBillingStudent, invoices, coachPlans)

  useEffect(() => {
    if (!billingStudentId && students[0]?.id) {
      setBillingStudentId(String(students[0].id))
    }
  }, [billingStudentId, students])

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

  async function handleCreateAutoCharges(options = {}) {
    const silent = Boolean(options.silent)
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
      if (!silent) setMessage('Nenhum aluno pendente sem cobrança em aberto.')
      return
    }

    setSaving(true)
    if (!silent) setMessage('')
    setError('')
    try {
      for (const student of chargeableStudents) {
        const plan = coachPlans.find((item) => item.name === student.plan) || coachPlans[0]
        const amount = getPlanBillingAmount(plan?.name, coachPlans) || 197
        const dueDate = getNextBillingDateForStudent(student, invoices, coachPlans)
        await onSaveInvoice({
          studentId: student.id,
          planName: plan?.name || student.plan || 'Acompanhamento',
          description: buildBillingMessage(getBillingMessageTemplateForPlan(plan, coachSettings), { student, amount, dueDate, coachSettings, plan }),
          amount,
          dueDate,
          status: 'Pendente',
          paymentMethod: 'Pix',
        })
      }
      setMessage(`${chargeableStudents.length} cobrança(s) criada(s) automaticamente conforme o ciclo do plano.`)
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível gerar as cobranças automáticas.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (autoBillingRunRef.current || saving || !students.length || coachSettings?.autoBillingEnabled === false) return
    const hasChargeableStudent = students.some((student) => (
      student.status !== 'Inativo'
      && student.payment !== 'Pago'
      && !invoices.some((invoice) => String(invoice.studentId) === String(student.id) && ['Pendente', 'Atrasado'].includes(getInvoiceStatus(invoice)))
    ))
    if (!hasChargeableStudent) return
    autoBillingRunRef.current = true
    handleCreateAutoCharges({ silent: true })
  }, [students, invoices, saving, coachSettings?.autoBillingEnabled])

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
              O sistema identifica alunos pendentes sem cobrança aberta, cria a cobrança pelo ciclo do plano e bloqueia o acesso até a validação.
            </p>
            <p className="hidden">
              Pix: {coachSettings?.pixKey || 'cadastre em Gerenciamento'} | WhatsApp: {coachSettings?.whatsapp || 'não informado'}
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
              <Select
                label="Aluno"
                name="studentId"
                value={String(selectedBillingStudent?.id || '')}
                onChange={(event) => setBillingStudentId(event.target.value)}
                options={students.map((student) => ({
                  label: `${student.name} - ${student.plan || 'sem plano'}`,
                  value: student.id,
                }))}
              />
              <Field
                key={`plan-${selectedBillingStudent?.id || 'none'}-${selectedBillingPlan?.name || 'plan'}`}
                label="Plano aplicado"
                name="planName"
                defaultValue={selectedBillingPlan?.name || selectedBillingStudent?.plan || 'Acompanhamento'}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  key={`amount-${selectedBillingStudent?.id || 'none'}-${selectedBillingAmount}`}
                  label="Valor (R$)"
                  name="amount"
                  type="number"
                  defaultValue={String(selectedBillingAmount || 197)}
                />
                <Field
                  key={`due-${selectedBillingStudent?.id || 'none'}-${selectedBillingDueDate}`}
                  label="Vencimento"
                  name="dueDate"
                  type="date"
                  defaultValue={selectedBillingDueDate}
                />
              </div>
              <Field
                key={`desc-${selectedBillingStudent?.id || 'none'}-${selectedBillingPlan?.name || 'plan'}`}
                label="Descrição"
                name="description"
                defaultValue={buildBillingMessage(getBillingMessageTemplateForPlan(selectedBillingPlan, coachSettings), {
                  student: selectedBillingStudent,
                  amount: selectedBillingAmount || 197,
                  dueDate: selectedBillingDueDate,
                  coachSettings,
                  plan: selectedBillingPlan,
                })}
              />
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs font-black uppercase text-emerald-200">Próxima cobrança estimada</p>
                <p className="mt-1 text-lg font-black text-white">{formatDate(selectedBillingDueDate)}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Calculada pelo plano do aluno, ciclo cadastrado e histórico de cobranças já registradas.
                </p>
              </div>
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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [logoFileError, setLogoFileError] = useState('')
  const [openSections, setOpenSections] = useState({
    health: true,
    traffic: true,
    launch: false,
    sales: true,
    plans: false,
    branding: false,
    modules: false,
  })

  useEffect(() => {
    setDraft(normalizeAdminSettings(settings))
  }, [settings])

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoFileError('')
    if (!file.type.startsWith('image/')) {
      setLogoFileError('Envie uma imagem em PNG, JPG ou WebP.')
      return
    }
    if (file.size > 700 * 1024) {
      setLogoFileError('A imagem ficou pesada. Use uma logo com ate 700 KB para carregar rapido.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateField('logoUrl', reader.result?.toString() || '')
    reader.onerror = () => setLogoFileError('Nao consegui ler a imagem. Tente outro arquivo.')
    reader.readAsDataURL(file)
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

  function applyVisualPreset(preset) {
    setDraft((current) => ({ ...current, ...preset }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await onSave(draft)
      setMessage('Gerenciamento salvo. As próximas visitas já usam esta versão.')
    } finally {
      setSaving(false)
    }
  }

  function resetDefaults() {
    setDraft(defaultAppAdminSettings)
    setMessage('Padrão carregado. Clique em salvar para publicar.')
  }

  function toggleSection(section) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  return (
    <div className="grid gap-5 lg:gap-6">
      <section className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-zinc-950/88 p-5 shadow-2xl shadow-black/25 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-emerald-300">Admin Master</p>
            <h2 className="mt-2 text-3xl font-black text-white">Controle central do Coach Fit Pro.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Edite página de vendas, planos oficiais, links de checkout, cores e módulos sem precisar subir código no GitHub.
            </p>
          </div>
          <div className="rounded-xl border border-blue-300/20 bg-blue-400/10 p-4">
            <p className="text-xs font-black uppercase text-blue-200">Status</p>
            <p className="mt-2 text-sm font-bold text-zinc-200">{remoteStatus || 'Pronto'}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              {draft.publishedAt ? `Versao publicada em ${formatDateTime(draft.publishedAt)}.` : 'Nenhuma versao visual publicada ainda.'} Celulares buscam a versao nova ao abrir, voltar para a aba ou a cada 45 segundos.
            </p>
            <p className="hidden">
              {remoteError ? remoteError : 'Quando o SQL do Admin Master estiver aplicado, salvar aqui publica no banco.'}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:gap-6">
        <AdminAccordionSection title="Saúde do sistema" action="Diagnóstico rápido" open={openSections.health} onToggle={() => toggleSection('health')}>
          <AdminSystemHealthPanel remoteStatus={remoteStatus} remoteError={remoteError} settings={draft} />
        </AdminAccordionSection>

        <AdminAccordionSection title="Tráfego e conversões" action="Funil de vendas" open={openSections.traffic} onToggle={() => toggleSection('traffic')}>
          <AdminTrafficPanel />
        </AdminAccordionSection>

        <AdminAccordionSection title="Checklist de lançamento" action="Operação pronta" open={openSections.launch} onToggle={() => toggleSection('launch')}>
          <AdminLaunchChecklist />
        </AdminAccordionSection>

        <AdminAccordionSection title="Página de vendas" action="Textos principais" open={openSections.sales} onToggle={() => toggleSection('sales')}>
          <div className="grid gap-4">
            <AdminTextInput label="Título principal" value={draft.salesHeadline} onChange={(value) => updateField('salesHeadline', value)} hint="Use uma frase direta, com promessa clara. Evite prometer resultado financeiro garantido." />
            <AdminTextArea label="Descrição principal" value={draft.salesSubheadline} onChange={(value) => updateField('salesSubheadline', value)} hint="Explique o ganho operacional: mais controle, mais organização e melhor experiência para o aluno." />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextInput label="Texto do botão principal" value={draft.salesCta} onChange={(value) => updateField('salesCta', value)} hint="Prefira uma ação simples, como Escolher meu plano ou Começar agora." />
              <AdminTextInput label="Aviso abaixo do botão" value={draft.announcement} onChange={(value) => updateField('announcement', value)} hint="Use para reduzir medo antes do clique: sem taxa por aluno, planos flexíveis ou pagamento seguro." />
            </div>
            <AdminTextInput label="Texto de confiança" value={draft.salesTrustText} onChange={(value) => updateField('salesTrustText', value)} hint="Esse texto aparece como reforço de segurança perto da oferta. Mantenha curto." />
          </div>
        </AdminAccordionSection>

        <AdminAccordionSection title="Planos e checkout" action={`${draft.checkoutPlans.length} planos`} open={openSections.plans} onToggle={() => toggleSection('plans')}>
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
                  <AdminTextInput label="Nome" value={plan.name} onChange={(value) => updatePlan(index, 'name', value)} />
                  <AdminTextInput label="Ciclo" value={plan.cycle} onChange={(value) => updatePlan(index, 'cycle', value)} />
                  <AdminTextInput label="Selo do card" value={plan.badge} onChange={(value) => updatePlan(index, 'badge', value)} />
                  <AdminTextInput label="Preço" value={plan.price} onChange={(value) => updatePlan(index, 'price', value)} />
                  <AdminTextInput label="Complemento do preço" value={plan.suffix} onChange={(value) => updatePlan(index, 'suffix', value)} />
                  <AdminTextInput label="Preço antigo" value={plan.oldPrice || ''} onChange={(value) => updatePlan(index, 'oldPrice', value)} />
                  <AdminTextInput label="Comparativo" value={plan.total} onChange={(value) => updatePlan(index, 'total', value)} />
                  <AdminTextInput label="Vantagem" value={plan.economy} onChange={(value) => updatePlan(index, 'economy', value)} />
                  <AdminTextInput label="Link Cartpanda" value={plan.checkoutUrl} onChange={(value) => updatePlan(index, 'checkoutUrl', value)} hint="Cole o link completo do checkout. Recomendado: começar por https://pagamento.coachfitpro.com.br/checkout/." />
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
        </AdminAccordionSection>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <AdminAccordionSection title="Branding global" action="Visual" open={openSections.branding} onToggle={() => toggleSection('branding')}>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Esmeralda premium', { primaryColor: '#00d2b2', accentColor: '#3b82f6', appBackgroundColor: '#000000', salesBackgroundColor: '#00150f', salesSurfaceColor: '#07110f', salesTextColor: '#f8fafc', ctaColor: '#00d2b2', ctaTextColor: '#020617', headerBackgroundColor: 'rgba(0, 0, 0, 0.68)' }],
                  ['Fitness neon', { primaryColor: '#39ff88', accentColor: '#00d2b2', appBackgroundColor: '#020403', salesBackgroundColor: '#03140b', salesSurfaceColor: '#09120e', salesTextColor: '#f7fff9', ctaColor: '#39ff88', ctaTextColor: '#021006', headerBackgroundColor: 'rgba(2, 6, 4, 0.72)' }],
                  ['Grafite safira', { primaryColor: '#10b981', accentColor: '#0ea5e9', appBackgroundColor: '#050505', salesBackgroundColor: '#06100d', salesSurfaceColor: '#101418', salesTextColor: '#f8fafc', ctaColor: '#10b981', ctaTextColor: '#02130d', headerBackgroundColor: 'rgba(5, 5, 5, 0.72)' }],
                ].map(([label, preset]) => (
                  <button key={label} type="button" onClick={() => applyVisualPreset(preset)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-xs font-black text-zinc-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10">
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput type="color" label="Cor principal" value={draft.primaryColor} onChange={(value) => updateField('primaryColor', value)} hint="Destaques, ícones e detalhes de marca." />
                <AdminTextInput type="color" label="Cor de apoio" value={draft.accentColor} onChange={(value) => updateField('accentColor', value)} hint="Contraste para bordas, selos e efeitos." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AdminTextInput type="color" label="Fundo do app" value={draft.appBackgroundColor} onChange={(value) => updateField('appBackgroundColor', value)} hint="Fundo quando coach e aluno estão logados." />
                <AdminTextInput type="color" label="Fundo da página de vendas" value={draft.salesBackgroundColor} onChange={(value) => updateField('salesBackgroundColor', value)} hint="Base do site público." />
                <AdminTextInput type="color" label="Fundo dos cards" value={draft.salesSurfaceColor} onChange={(value) => updateField('salesSurfaceColor', value)} hint="Cards, boxes e áreas com vidro." />
                <AdminTextInput type="color" label="Texto principal" value={draft.salesTextColor} onChange={(value) => updateField('salesTextColor', value)} hint="Use cor clara para fundo escuro." />
                <AdminTextInput type="color" label="Cor dos botões CTA" value={draft.ctaColor} onChange={(value) => updateField('ctaColor', value)} hint="Botão de compra e cadastro." />
                <AdminTextInput type="color" label="Texto dos botões CTA" value={draft.ctaTextColor} onChange={(value) => updateField('ctaTextColor', value)} hint="Preto em botão claro costuma funcionar bem." />
                <AdminTextInput label="Fundo do cabeçalho" value={draft.headerBackgroundColor} onChange={(value) => updateField('headerBackgroundColor', value)} hint="Aceita rgba. Exemplo: rgba(0, 0, 0, 0.70)." />
              </div>
              <AdminTextInput label="URL da logotipo principal" value={draft.logoUrl} onChange={(value) => updateField('logoUrl', value)} hint="Opcional. Use PNG horizontal com fundo transparente. Se deixar vazio, o app usa a logo padrão." />
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Enviar logotipo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoFile} className="rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:text-sm file:font-black file:text-zinc-950" />
                <span className="text-xs font-medium leading-5 text-zinc-500">Recomendação: imagem horizontal, até 700 KB, preferencialmente PNG/WebP transparente para combinar com o fundo preto.</span>
                {logoFileError ? <span className="text-xs font-bold text-amber-200">{logoFileError}</span> : null}
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${draft.primaryColor}22, ${draft.accentColor}22)` }}>
              <p className="text-sm font-black text-white">Prévia do visual</p>
              <div className="mt-3 flex min-h-20 items-center justify-center rounded-xl border border-white/10 bg-black/35 p-4">
                <img src={draft.logoUrl || fitCoachLogo} alt="Prévia da logotipo" className="max-h-16 max-w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]" />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">Salve para publicar a logo e as cores nos acessos novos. Se a logo ficar apagada no preto, use uma versão clara ou com contorno.</p>
            </div>
          </AdminAccordionSection>

          <AdminAccordionSection title="Módulos ativos" action="Funcionalidades" open={openSections.modules} onToggle={() => toggleSection('modules')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['studentXp', 'XP e selos do aluno'],
                ['financialDashboard', 'Dashboard financeiro'],
                ['salesSimulator', 'Simulador da página inicial'],
                ['waterGoal', 'Meta de água interativa'],
              ].map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <span className="text-sm font-black text-zinc-100">{label}</span>
                  <input type="checkbox" checked={Boolean(draft.featureFlags?.[key])} onChange={(event) => updateFlag(key, event.target.checked)} className="h-5 w-5 accent-emerald-400" />
                </label>
              ))}
            </div>
          </AdminAccordionSection>
        </div>

        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/92 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-zinc-400">
            Depois de salvar no Supabase, textos, planos e links mudam sem precisar atualizar o GitHub.
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

function AdminSystemHealthPanel({ remoteStatus, remoteError, settings }) {
  const [lastError, setLastError] = useState(() => loadLastAppError())
  const checkoutPlans = normalizeAdminSettings(settings).checkoutPlans
  const checks = buildSystemHealthChecks({ remoteStatus, remoteError, checkoutPlans, lastError })

  function clearLastError() {
    try {
      window.localStorage.removeItem('coachfitpro-last-error')
    } catch {
      // Mantem a UI funcionando mesmo se o navegador bloquear storage.
    }
    setLastError(null)
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((item) => (
          <div key={item.title} className={`rounded-2xl border p-4 ${
            item.status === 'ok'
              ? 'border-emerald-300/25 bg-emerald-300/[0.075]'
              : item.status === 'warning'
                ? 'border-amber-300/25 bg-amber-300/[0.075]'
                : 'border-rose-300/25 bg-rose-300/[0.075]'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-white">{item.title}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                item.status === 'ok'
                  ? 'bg-emerald-300/15 text-emerald-100'
                  : item.status === 'warning'
                    ? 'bg-amber-300/15 text-amber-100'
                    : 'bg-rose-300/15 text-rose-100'
              }`}>{item.label}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-300">{item.detail}</p>
          </div>
        ))}
      </div>

      {lastError ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.075] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-amber-100">Último erro capturado</p>
              <p className="mt-2 break-words text-sm font-bold text-white">{lastError.message}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{formatDateTime(lastError.createdAt)}</p>
            </div>
            <button type="button" onClick={clearLastError} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-zinc-100">
              Limpar aviso
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4">
          <p className="text-sm font-black text-emerald-100">Nenhum erro crítico registrado neste navegador.</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Se alguma tela quebrar, o diagnóstico aparece aqui para facilitar a correção.</p>
        </div>
      )}
    </div>
  )
}

function AdminTrafficPanel() {
  const [events, setEvents] = useState(() => getStoredLeadEvents())
  const [status, setStatus] = useState('Eventos locais carregados')

  const snapshot = useMemo(() => buildLeadTrafficSnapshot(events), [events])

  useEffect(() => {
    let active = true

    async function refresh() {
      const localEvents = getStoredLeadEvents()
      if (!supabaseEnabled) {
        if (active) {
          setEvents(localEvents)
          setStatus('Eventos locais carregados')
        }
        return
      }

      try {
        const remoteEvents = await loadRemoteLeadEvents()
        if (!active) return
        const merged = mergeLeadEvents(remoteEvents, localEvents)
        setEvents(merged)
        setStatus(remoteEvents.length ? 'Sincronizado com Supabase' : 'Aguardando primeiros eventos no Supabase')
      } catch {
        if (!active) return
        setEvents(localEvents)
        setStatus('Mostrando eventos locais. Rode o SQL de tráfego para salvar tudo no Supabase.')
      }
    }

    refresh()
    const timer = window.setInterval(refresh, 8000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  function clearLocalEvents() {
    saveStoredLeadEvents([])
    setEvents([])
    setStatus('Histórico local limpo. Os eventos do Supabase permanecem salvos.')
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-emerald-200">Captação em tempo real</p>
          <p className="mt-1 text-sm leading-6 text-zinc-300">{status}</p>
        </div>
        <button type="button" onClick={clearLocalEvents} className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100 transition hover:bg-white/[0.04] sm:w-auto">
          Limpar local
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Visitas', snapshot.visits, 'Entradas na página'],
          ['Planos escolhidos', snapshot.planSelections, 'Cliques em oferta'],
          ['Cadastros', snapshot.signups, 'Conta iniciada'],
          ['Checkouts', snapshot.checkouts, 'Compra aberta'],
          ['Pagamentos', snapshot.payments, 'Liberação detectada'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
            <p className="mt-3 text-3xl font-black text-white">{value}</p>
            <p className="mt-1 text-xs font-bold text-emerald-200">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black uppercase text-zinc-500">Origem mais recente</p>
            <h4 className="mt-2 text-xl font-black text-white">{snapshot.lastSource}</h4>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{snapshot.lastCampaign}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black uppercase text-zinc-500">Plano com mais intenção</p>
            <h4 className="mt-2 text-xl font-black text-white">{snapshot.topPlan}</h4>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Use esse sinal para ajustar anúncios, criativos e destaque dos planos.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-zinc-500">Últimos eventos</p>
              <h4 className="mt-1 font-black text-white">Jornada do lead</h4>
            </div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">{events.length} registros</span>
          </div>
          <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
            {events.length ? events.slice(0, 18).map((event) => (
              <div key={event.id || `${event.type}-${event.createdAt}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-black text-white">{formatLeadEventType(event.type)}</p>
                  <p className="text-xs font-bold text-zinc-500">{formatDateTime(event.createdAt)}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {formatLeadEventDetail(event)}
                </p>
              </div>
            )) : (
              <Empty text="Assim que alguém entrar por campanha, escolher plano ou abrir checkout, os eventos aparecem aqui." />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminLaunchChecklist() {
  const attribution = getStoredLeadAttribution()
  const checks = [
    { title: 'Domínio principal', status: 'Ativo', detail: 'coachfitpro.com.br e app.coachfitpro.com.br configurados para o app.' },
    { title: 'Checkout Cartpanda', status: 'Ativo', detail: 'Planos mensal, semestral e anual vinculados aos botões da página.' },
    { title: 'Webhook de pagamento', status: 'Conferir', detail: 'Teste um pagamento real sempre que trocar checkout, produto ou postback.' },
    { title: 'UTM e campanhas', status: attribution.firstSeenAt ? 'Capturando' : 'Pronto', detail: 'Links com utm_source, utm_campaign ou cid são enviados para o checkout.' },
    { title: 'Suporte e termos', status: 'Ativo', detail: 'Rodapé com Termos, Privacidade e Suporte para reduzir dúvidas antes da compra.' },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {checks.map((item) => (
        <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-black text-white">{item.title}</h4>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${
              item.status === 'Ativo' || item.status === 'Capturando'
                ? 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                : 'border border-amber-300/25 bg-amber-300/10 text-amber-100'
            }`}>{item.status}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function AdminAccordionSection({ title, action, open, onToggle, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.035] sm:px-5"
      >
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-white sm:text-lg">{title}</h3>
          <p className="mt-1 truncate text-xs font-bold text-zinc-500">{formatUiText(action)}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-100 transition ${open ? 'rotate-180' : ''}`}>
          <NavIcon name="chevronDown" className="h-5 w-5" />
        </span>
      </button>
      {open ? (
        <div className="border-t border-white/10 p-4 sm:p-5">
          {children}
        </div>
      ) : null}
    </section>
  )
}

function AdminTextInput({ label, value, onChange, hint = '', type = 'text' }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/50" />
      {hint ? <span className="text-xs font-medium leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  )
}

function AdminTextArea({ label, value, onChange, hint = '' }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={4} className="min-h-28 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none transition focus:border-emerald-300/50" />
      {hint ? <span className="text-xs font-medium leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  )
}

function CoachSettings({ user, settings, onSave, onExport, masterAdmin = false, onOpenAdminMaster }) {
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
    autoBillingEnabled: settings?.autoBillingEnabled !== false,
    customPlans: getCoachPlans(settings),
    welcomeMessage: settings?.welcomeMessage || 'Mantenha o plano, registre seu treino e use o check-in para me contar como você está evoluindo.',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  }
  const [billingLogoUrl, setBillingLogoUrl] = useState(current.billingLogoUrl)
  const [planEditorPlans, setPlanEditorPlans] = useState(current.customPlans)
  const [editingPlanIndex, setEditingPlanIndex] = useState(-1)
  const [planDraft, setPlanDraft] = useState({
    name: '',
    price: '',
    cycle: 'mensal',
    features: '',
    billingMessage: '',
  })

  useEffect(() => {
    setBillingLogoUrl(current.billingLogoUrl)
    setPlanEditorPlans(current.customPlans)
    setEditingPlanIndex(-1)
    setPlanDraft({ name: '', price: '', cycle: 'mensal', features: '', billingMessage: '' })
  }, [settings?.billingLogoUrl, settings?.customPlans])

  function updatePlanDraft(field, value) {
    setPlanDraft((draft) => ({ ...draft, [field]: value }))
  }

  function resetPlanDraft() {
    setPlanDraft({ name: '', price: '', cycle: 'mensal', features: '', billingMessage: '' })
    setEditingPlanIndex(-1)
  }

  async function persistPlanEditorPlans(nextPlans, successMessage = 'Planos atualizados.') {
    const normalizedPlans = nextPlans.map(normalizeCoachPlan).filter((plan) => plan.name)
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const savedSettings = await onSave({
        ...current,
        billingLogoUrl,
        customPlans: normalizedPlans,
      })
      const savedPlans = getCoachPlans(savedSettings)
      setPlanEditorPlans(savedPlans)
      setMessage(successMessage)
      return savedPlans
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar os planos agora.')
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  async function savePlanDraft() {
    const normalizedPlan = normalizeCoachPlan(planDraft)
    if (!normalizedPlan.name) {
      setError('Informe o nome do plano.')
      return
    }
    if (getPlanBillingAmount(normalizedPlan.name, [normalizedPlan]) <= 0) {
      setError('Informe o valor que você cobra neste plano.')
      return
    }

    const existingIndex = editingPlanIndex >= 0
      ? editingPlanIndex
      : planEditorPlans.findIndex((plan) => normalizeText(plan.name) === normalizeText(normalizedPlan.name))

    const nextPlans = existingIndex >= 0
      ? planEditorPlans.map((plan, index) => (index === existingIndex ? normalizedPlan : plan))
      : [normalizedPlan, ...planEditorPlans]

    await persistPlanEditorPlans(nextPlans, existingIndex >= 0 ? 'Plano atualizado e salvo.' : 'Plano adicionado e salvo.')
    resetPlanDraft()
  }

  function editPlanDraft(plan, index) {
    setPlanDraft({
      name: plan.name || '',
      price: plan.price || '',
      cycle: normalizePlanCycle(plan.cycle),
      features: plan.features || '',
      billingMessage: plan.billingMessage || '',
    })
    setEditingPlanIndex(index)
  }

  async function removePlanDraft(index) {
    if (planEditorPlans.length <= 1) {
      setError('Mantenha pelo menos um plano cadastrado.')
      return
    }
    await persistPlanEditorPlans(planEditorPlans.filter((_, planIndex) => planIndex !== index), 'Plano removido e salvo.')
    if (editingPlanIndex === index) resetPlanDraft()
  }

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
        autoBillingEnabled: form.get('autoBillingEnabled') === 'on',
        customPlans: planEditorPlans.map(normalizeCoachPlan).filter((plan) => plan.name),
        welcomeMessage: form.get('welcomeMessage')?.toString().trim() || '',
        timezone: current.timezone,
      })
      setMessage('Gerenciamento profissional atualizado.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar o gerenciamento.')
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
      {masterAdmin ? (
        <section className="xl:col-span-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.08] p-4 shadow-2xl shadow-emerald-950/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-200">Conta master reconhecida</p>
              <h3 className="mt-1 text-xl font-black text-white">Acesso Admin Master liberado para esta conta.</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                Use essa área para editar página de vendas, planos oficiais, branding global e acompanhar tráfego.
              </p>
            </div>
            <button type="button" onClick={onOpenAdminMaster} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 shadow-xl shadow-emerald-950/30 transition hover:-translate-y-0.5">
              Abrir Admin Master
            </button>
          </div>
        </section>
      ) : null}
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
            <p className="hidden">
              Cadastre um plano por linha no formato: Nome do plano | Valor | Ciclo | Descrição. Ciclos aceitos: semanal, mensal, semestral ou anual.
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Cadastre seus planos uma vez. Depois, ao cadastrar um aluno, escolha o plano e o app puxa valor, ciclo e cobrança automaticamente.
            </p>
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_0.72fr_0.7fr]">
                <label className="grid gap-2 text-sm font-bold text-zinc-300">
                  Nome do plano
                  <input value={planDraft.name} onChange={(event) => updatePlanDraft('name', event.target.value)} placeholder="Ex: Consultoria premium" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-zinc-300">
                  Valor
                  <input value={planDraft.price} onChange={(event) => updatePlanDraft('price', event.target.value)} placeholder="Ex: 250,00" inputMode="decimal" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-zinc-300">
                  Ciclo
                  <select value={planDraft.cycle} onChange={(event) => updatePlanDraft('cycle', event.target.value)} className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm">
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 grid gap-2 text-sm font-bold text-zinc-300">
                O que inclui
                <input value={planDraft.features} onChange={(event) => updatePlanDraft('features', event.target.value)} placeholder="Ex: treino, dieta, check-in semanal e suporte" className="min-h-11 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm" />
              </label>
              <label className="mt-3 grid gap-2 text-sm font-bold text-zinc-300">
                Mensagem de cobrança deste plano
                <textarea
                  value={planDraft.billingMessage}
                  onChange={(event) => updatePlanDraft('billingMessage', event.target.value)}
                  rows={4}
                  placeholder="Ex: Ola, {aluno}. Sua mensalidade do plano {plano} vence em {vencimento}. Valor: {valor}. Pix: {pix}."
                  className="min-h-28 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base leading-6 text-zinc-100 outline-none focus:border-emerald-500 sm:text-sm"
                />
                <span className="text-xs leading-5 text-zinc-500">
                  Use variáveis como {'{aluno}'}, {'{plano}'}, {'{valor}'}, {'{vencimento}'}, {'{pix}'}, {'{whatsapp}'} e {'{email}'}.
                </span>
              </label>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={saving} onClick={savePlanDraft} className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
                  {saving ? 'Salvando...' : editingPlanIndex >= 0 ? 'Atualizar e salvar plano' : 'Adicionar e salvar plano'}
                </button>
                {editingPlanIndex >= 0 ? (
                  <button type="button" disabled={saving} onClick={resetPlanDraft} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100 disabled:opacity-60">
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-xs font-black uppercase text-zinc-500">Planos cadastrados</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {planEditorPlans.map((plan, index) => (
                <div key={plan.name} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <p className="text-sm font-black text-white">{plan.name}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{plan.features || 'Plano do treinador'}</p>
                  <p className="mt-2 text-xs font-bold text-cyan-100">
                    {plan.billingMessage ? 'Mensagem de cobrança personalizada' : 'Usa a mensagem padrão de cobrança'}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={saving} onClick={() => editPlanDraft(plan, index)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 disabled:opacity-60">
                      Editar
                    </button>
                    <button type="button" disabled={saving} onClick={() => removePlanDraft(index)} className="rounded-md border border-rose-300/25 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-60">
                      Remover
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-bold text-emerald-200">{formatCurrency(getPlanBillingAmount(plan.name, [plan]))} · {getPlanCycleLabel(plan)}</p>
                </div>
              ))}
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm leading-6 text-zinc-200">
              <input
                name="autoBillingEnabled"
                type="checkbox"
                defaultChecked={current.autoBillingEnabled}
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
              <span>
                <strong className="block text-emerald-100">Cobrança automática dos alunos</strong>
                <span className="block">Quando um aluno ficar pendente, o app cria a cobrança usando o valor do plano dele.</span>
                <span className="hidden">
                <strong className="block text-emerald-100">Gerar cobranças automaticamente</strong>
                O sistema cria cobranças para alunos pendentes sem cobrança em aberto, usando o valor e o ciclo do plano cadastrado.
                </span>
              </span>
            </label>
          </div>
          <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar gerenciamento'}
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
              {buildBillingMessage(getBillingMessageTemplateForPlan(planEditorPlans[0], current), {
                student: { name: 'Aluno exemplo' },
                amount: getPlanBillingAmount(planEditorPlans[0]?.name, planEditorPlans),
                dueDate: getDefaultDueDate(),
                coachSettings: current,
                plan: planEditorPlans[0],
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

function Messages({ students, messages, selectedStudent: selectedStudentFromDashboard, onSendMessage, onMarkRead, onRefreshMessages }) {
  const [selectedStudentId, setSelectedStudentId] = useState(selectedStudentFromDashboard?.id ?? students[0]?.id ?? '')
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

  useEffect(() => {
    if (selectedStudentFromDashboard?.id) {
      setSelectedStudentId(selectedStudentFromDashboard.id)
    }
  }, [selectedStudentFromDashboard?.id])
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
  const logoSrc = loadLocalAdminSettings().logoUrl || fitCoachLogo
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
        src={logoSrc}
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
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></>,
    muscle: <><path d="M12 3a3 3 0 0 1 3 3c0 1.1-.6 2-1.4 2.5l2.2 1.8 2 7.2-2.4.7-1.4-5-1.1 4.4.8 4.4h-3.4l.8-4.4-1.1-4.4-1.4 5-2.4-.7 2-7.2 2.2-1.8A2.9 2.9 0 0 1 9 6a3 3 0 0 1 3-3Z" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
    bulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.8-1.5 1.7-1.5 3h-4c0-1.2-.5-2-1.5-2.5Z" /></>,
    alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
    play: <><path d="M8 5v14l11-7Z" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" /></>,
    check: <><path d="m20 6-11 11-5-5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    chevronRight: <><path d="m9 18 6-6-6-6" /></>,
    chevronDown: <><path d="m6 9 6 6 6-6" /></>,
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
      <h3 className="metric-money-value mt-2 font-black sm:mt-3">{value}</h3>
      <p className="mt-2 text-xs font-semibold text-blue-300">{detail}</p>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/72 p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h3 className="min-w-0 break-words text-base font-black text-white sm:text-lg">{title}</h3>
        <span className="max-w-full break-words rounded-xl border border-white/10 bg-white/[0.045] px-3 py-1.5 text-left text-xs font-bold leading-5 text-zinc-300 sm:shrink-0 sm:text-right">{formatUiText(action)}</span>
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

function Select({ label, name, defaultValue, value, onChange, options }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <select
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
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

function DailyIntelligenceSummary({ dashboard, onOpenView }) {
  const summary = dashboard?.summary || {}
  const actions = dashboard?.recommendedActions || []

  return (
    <Panel title="Resumo inteligente do dia" action="Prioridades reais">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PrioritySummaryMetric label="Alunos em risco" value={summary.riskStudents || 0} detail="abandono médio, alto ou crítico" tone="rose" />
        <PrioritySummaryMetric label="Sem treino ativo" value={summary.withoutWorkout || 0} detail="precisam de prescrição" tone="amber" />
        <PrioritySummaryMetric label="Check-ins pendentes" value={summary.pendingCheckins || 0} detail="retornos a revisar" tone="cyan" />
        <PrioritySummaryMetric label="Cobranças próximas" value={summary.upcomingCharges || 0} detail="vencem em até 7 dias" tone="emerald" />
        <PrioritySummaryMetric label="Mensagens pendentes" value={summary.pendingMessages || 0} detail="alunos aguardando resposta" tone="blue" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {actions.length ? actions.map((action) => (
          <button
            key={`${action.studentId}-${action.title}`}
            type="button"
            onClick={() => onOpenView?.(action.view)}
            className="group rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.07]"
          >
            <p className="text-xs font-black uppercase text-emerald-200">{action.label}</p>
            <h4 className="mt-2 text-sm font-black text-white">{action.title}</h4>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{action.body}</p>
            <span className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-black text-emerald-100 group-hover:border-emerald-300/35">
              Abrir ação
            </span>
          </button>
        )) : (
          <div className="lg:col-span-3">
            <Empty text="Nenhuma ação urgente agora. Acompanhe check-ins, treinos e mensagens para manter a carteira aquecida." />
          </div>
        )}
      </div>
    </Panel>
  )
}

function PrioritySummaryMetric({ label, value, detail, tone = 'emerald' }) {
  const toneClass = {
    rose: 'border-rose-300/25 bg-rose-300/[0.07] text-rose-100',
    amber: 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100',
    cyan: 'border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-100',
    blue: 'border-blue-300/25 bg-blue-300/[0.07] text-blue-100',
    emerald: 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100',
  }[tone] || 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100'

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{detail}</p>
    </div>
  )
}

function StudentPriorityPanel({ dashboard, onOpenStudent, onMessageStudent }) {
  const [filter, setFilter] = useState('todos')
  const [loading, setLoading] = useState(true)
  const items = dashboard?.items || []
  const filters = [
    ['todos', 'Todos'],
    ['urgente', 'Urgente'],
    ['baixa-adesao', 'Baixa adesão'],
    ['risco-abandono', 'Risco de abandono'],
    ['sem-treino', 'Sem treino'],
    ['sem-checkin', 'Sem check-in'],
    ['financeiro', 'Financeiro'],
    ['sem-resposta', 'Sem resposta'],
  ]

  useEffect(() => {
    setLoading(true)
    const timer = window.setTimeout(() => setLoading(false), 180)
    return () => window.clearTimeout(timer)
  }, [dashboard?.generatedAt, filter])

  const filteredItems = items.filter((item) => filter === 'todos' || item.filterTags.includes(filter))

  return (
    <Panel title="Alunos que precisam de atenção" action={`${filteredItems.length} no filtro`}>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-soft">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${
              filter === id
                ? 'border-emerald-300/60 bg-emerald-300 text-zinc-950'
                : 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-emerald-300/35 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[1, 2].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : filteredItems.length ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredItems.map((item) => (
            <PriorityStudentCard
              key={item.student.id}
              item={item}
              onOpenStudent={() => onOpenStudent?.(item.student.id)}
              onMessageStudent={() => onMessageStudent?.(item.student.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <Empty text="Nenhum aluno encontrado neste filtro. Use Todos para enxergar a carteira completa." />
        </div>
      )}
    </Panel>
  )
}

function PriorityStudentCard({ item, onOpenStudent, onMessageStudent }) {
  const tone = getPriorityTone(item.priority)

  return (
    <article className={`rounded-2xl border p-4 ${tone.card}`}>
      <div className="flex items-start gap-3">
        <StudentPriorityAvatar student={item.student} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="truncate text-lg font-black text-white">{item.student.name}</h4>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{item.lastActivity}</p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${tone.badge}`}>{formatUiText(item.priority)}</span>
          </div>
          <p className="mt-3 text-sm font-black text-zinc-100">{item.reason}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{item.recommendedAction}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ScoreBox label="Adesão" value={item.adherence.score} detail={item.adherence.classification} tone={item.adherence.score < 55 ? 'rose' : item.adherence.score < 75 ? 'amber' : 'emerald'} />
        <ScoreBox label="Risco" value={item.risk.score} detail={item.risk.classification} tone={item.risk.classification === 'critico' || item.risk.classification === 'alto' ? 'rose' : item.risk.classification === 'medio' ? 'amber' : 'emerald'} />
      </div>

      <div className="mt-4 grid gap-2">
        <p className="text-xs font-black uppercase text-zinc-500">Fatores detectados</p>
        <div className="flex flex-wrap gap-2">
          {item.factors.slice(0, 5).map((factor) => (
            <span key={factor} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-zinc-300">{factor}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs font-black uppercase text-zinc-500">Por que este score?</p>
        <p className="mt-1 text-xs leading-5 text-zinc-300">{item.adherence.reason}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">{item.risk.reason}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onOpenStudent} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10">
          Abrir perfil
        </button>
        <button type="button" onClick={onMessageStudent} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-300">
          Enviar mensagem
        </button>
      </div>
    </article>
  )
}

function StudentPriorityAvatar({ student }) {
  const initials = String(student?.name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (student?.photo) {
    return <img src={student.photo} alt={student.name} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-sm font-black text-emerald-100">
      {initials || 'A'}
    </div>
  )
}

function ScoreBox({ label, value, detail, tone = 'emerald' }) {
  const toneClass = {
    rose: 'border-rose-300/25 bg-rose-300/[0.075] text-rose-100',
    amber: 'border-amber-300/25 bg-amber-300/[0.075] text-amber-100',
    emerald: 'border-emerald-300/25 bg-emerald-300/[0.075] text-emerald-100',
  }[tone] || 'border-emerald-300/25 bg-emerald-300/[0.075] text-emerald-100'

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase opacity-80">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full bg-current" style={{ width: `${clampPercent(value)}%` }} />
      </div>
      <p className="mt-2 text-xs font-bold">{detail}</p>
    </div>
  )
}

function getPriorityTone(priority) {
  if (priority === 'Urgente') {
    return {
      card: 'border-rose-300/30 bg-rose-300/[0.055]',
      badge: 'border-rose-300/40 bg-rose-300/10 text-rose-100',
    }
  }
  if (priority === 'Atencao') {
    return {
      card: 'border-orange-300/30 bg-orange-300/[0.055]',
      badge: 'border-orange-300/40 bg-orange-300/10 text-orange-100',
    }
  }
  if (priority === 'Acompanhar') {
    return {
      card: 'border-amber-300/30 bg-amber-300/[0.055]',
      badge: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
    }
  }
  return {
    card: 'border-emerald-300/25 bg-emerald-300/[0.045]',
    badge: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100',
  }
}

function buildPriorityDashboard({ students = [], checkins = [], workouts = [], workoutLogs = [], messages = [], invoices = [], assessments = [] } = {}) {
  const activeStudents = (students || []).filter((student) => student && student.status !== 'Inativo')
  const items = activeStudents
    .map((student) => buildStudentPriorityItem({ student, checkins, workouts, workoutLogs, messages, invoices, assessments }))
    .sort((a, b) => a.priorityRank - b.priorityRank || b.risk.score - a.risk.score || a.adherence.score - b.adherence.score)

  const summary = {
    riskStudents: items.filter((item) => ['medio', 'alto', 'critico'].includes(item.risk.classification)).length,
    withoutWorkout: items.filter((item) => item.filterTags.includes('sem-treino')).length,
    pendingCheckins: checkins.filter((checkin) => checkin.state !== 'Recebido').length,
    upcomingCharges: items.filter((item) => item.filterTags.includes('financeiro') && item.financialDueSoon).length,
    pendingMessages: items.reduce((total, item) => total + item.pendingMessages, 0),
  }

  const recommendedActions = items
    .filter((item) => item.priority !== 'Regular')
    .slice(0, 3)
    .map((item) => ({
      studentId: item.student.id,
      label: item.priority,
      title: item.student.name,
      body: item.recommendedAction,
      view: item.primaryView,
    }))

  return {
    generatedAt: new Date().toISOString(),
    summary,
    recommendedActions,
    items,
  }
}

function buildStudentPriorityItem({ student, checkins, workouts, workoutLogs, messages, invoices, assessments }) {
  const studentId = String(student.id)
  const studentWorkouts = workouts.filter((workout) => String(workout.studentId) === studentId && workout.active !== false)
  const studentLogs = workoutLogs.filter((log) => String(log.studentId) === studentId)
  const studentCheckins = checkins.filter((checkin) => String(checkin.studentId) === studentId)
  const studentMessages = messages.filter((message) => String(message.studentId) === studentId)
  const studentInvoices = invoices.map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) })).filter((invoice) => String(invoice.studentId) === studentId)
  const studentAssessments = assessments.filter((assessment) => String(assessment.studentId) === studentId)

  const latestWorkout = latestByDate(studentLogs, (item) => item.completedAt || item.createdAt || item.date)
  const latestCheckin = latestByDate(studentCheckins, (item) => item.createdAt || item.due)
  const latestMessage = latestByDate(studentMessages, (item) => item.createdAt)
  const latestAssessment = latestByDate(studentAssessments, (item) => item.assessedAt)
  const latestInvoice = latestByDate(studentInvoices, (item) => item.paidAt || item.dueDate || item.createdAt)
  const lastActivityDate = [latestWorkout?.completedAt, latestCheckin?.createdAt || latestCheckin?.due, latestMessage?.createdAt, latestAssessment?.assessedAt, latestInvoice?.paidAt || latestInvoice?.createdAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0]

  const lastWorkoutDays = safeDaysSince(latestWorkout?.completedAt || latestWorkout?.createdAt || latestWorkout?.date)
  const lastCheckinDays = safeDaysSince(latestCheckin?.createdAt || latestCheckin?.due)
  const lastAssessmentDays = safeDaysSince(latestAssessment?.assessedAt)
  const logs14 = countSince(studentLogs, 14, (item) => item.completedAt || item.createdAt || item.date)
  const previousLogs14 = countBetweenDays(studentLogs, 15, 28, (item) => item.completedAt || item.createdAt || item.date)
  const checkins30 = countSince(studentCheckins, 30, (item) => item.createdAt || item.due)
  const unreadStudentMessages = studentMessages.filter((message) => message.sender === 'student' && !message.read).length
  const latestMessageNeedsReply = latestMessage?.sender === 'student' && safeDaysSince(latestMessage.createdAt) >= 2
  const overdueInvoices = studentInvoices.filter((invoice) => invoice.status === 'Atrasado')
  const pendingInvoices = studentInvoices.filter((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status))
  const dueSoonInvoices = pendingInvoices.filter((invoice) => {
    const daysUntilDue = daysUntilDate(invoice.dueDate)
    return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7
  })
  const painOrFatigue = detectPainOrFatigue(latestCheckin)
  const hasActiveWorkout = studentWorkouts.length > 0
  const hasRecentAssessment = lastAssessmentDays !== null && lastAssessmentDays <= 45
  const studentAdherence = Number(student.adherence || 0)
  const adherence = calculateAdherenceScore({
    logs14,
    previousLogs14,
    lastWorkoutDays,
    lastCheckinDays,
    checkins30,
    unreadStudentMessages,
    studentAdherence,
  })
  const risk = calculateAbandonmentRisk({
    lastWorkoutDays,
    lastCheckinDays,
    unreadStudentMessages,
    overdueInvoices,
    logs14,
    previousLogs14,
    adherenceScore: adherence.score,
    latestMessageNeedsReply,
  })

  const factors = []
  const filterTags = ['todos']
  const reasons = []
  let primaryView = 'alunos'

  if (!hasActiveWorkout) {
    factors.push('Sem treino ativo')
    filterTags.push('sem-treino')
    reasons.push({ level: 'Atencao', text: 'sem treino ativo', action: 'Prescreva um treino para liberar a execucao no app.', view: 'treinos' })
  }
  if (lastWorkoutDays === null || lastWorkoutDays >= 10) {
    factors.push(lastWorkoutDays === null ? 'Sem treino concluido' : `${Math.floor(lastWorkoutDays)} dias sem treinar`)
    filterTags.push('risco-abandono')
    reasons.push({ level: lastWorkoutDays === null || lastWorkoutDays >= 14 ? 'Urgente' : 'Atencao', text: lastWorkoutDays === null ? 'sem treino concluido registrado' : 'muitos dias sem treinar', action: 'Envie uma mensagem e ajuste a proxima sessao.', view: 'mensagens' })
  }
  if (lastCheckinDays === null || lastCheckinDays >= 14) {
    factors.push(lastCheckinDays === null ? 'Sem check-in' : `${Math.floor(lastCheckinDays)} dias sem check-in`)
    filterTags.push('sem-checkin')
    reasons.push({ level: lastCheckinDays === null || lastCheckinDays >= 21 ? 'Atencao' : 'Acompanhar', text: 'check-in atrasado', action: 'Solicite um retorno rapido sobre treino, dieta, sono e fome.', view: 'checkins' })
  }
  if (adherence.score < 65 || studentAdherence < 65) {
    factors.push(`Adesao ${adherence.score}/100`)
    filterTags.push('baixa-adesao')
    reasons.push({ level: adherence.score < 45 ? 'Urgente' : 'Atencao', text: 'baixa adesao', action: 'Revise volume, rotina e barreiras do aluno antes que ele desengaje.', view: 'alunos' })
  }
  if (painOrFatigue) {
    factors.push('Dor ou fadiga alta')
    filterTags.push('risco-abandono')
    reasons.push({ level: 'Urgente', text: 'sinal de dor ou fadiga no check-in', action: 'Avalie ajuste de carga, descanso ou encaminhamento adequado.', view: 'checkins' })
  }
  if (unreadStudentMessages || latestMessageNeedsReply) {
    factors.push(unreadStudentMessages ? `${unreadStudentMessages} mensagem(ns) sem resposta` : 'Aluno aguardando resposta')
    filterTags.push('sem-resposta')
    reasons.push({ level: unreadStudentMessages > 1 || latestMessageNeedsReply ? 'Atencao' : 'Acompanhar', text: 'mensagem pendente', action: 'Responda o aluno para manter percepcao de acompanhamento.', view: 'mensagens' })
  }
  if (overdueInvoices.length || student.payment === 'Pendente') {
    factors.push('Financeiro pendente')
    filterTags.push('financeiro')
    reasons.push({ level: overdueInvoices.length ? 'Urgente' : 'Atencao', text: overdueInvoices.length ? 'inadimplencia' : 'pagamento pendente', action: 'Abra recebimentos, confirme pagamento ou envie cobranca personalizada.', view: 'pagamentos' })
  } else if (dueSoonInvoices.length) {
    factors.push('Vencimento proximo')
    filterTags.push('financeiro')
    reasons.push({ level: 'Acompanhar', text: 'cobranca proxima do vencimento', action: 'Prepare lembrete antes do vencimento para evitar atraso.', view: 'pagamentos' })
  }
  if (!hasRecentAssessment) {
    factors.push(lastAssessmentDays === null ? 'Sem avaliacao' : 'Avaliacao antiga')
    filterTags.push('risco-abandono')
    reasons.push({ level: lastAssessmentDays === null ? 'Atencao' : 'Acompanhar', text: 'sem avaliacao recente', action: 'Atualize medidas e fotos para reforcar percepcao de evolucao.', view: 'avaliacoes' })
  }
  if (logs14 < 2 && studentLogs.length > 0) {
    factors.push('Baixa frequencia')
    filterTags.push('baixa-adesao')
    reasons.push({ level: 'Atencao', text: 'baixa frequencia nas ultimas duas semanas', action: 'Reduza friccao da rotina e combine uma meta minima para a semana.', view: 'treinos' })
  }

  const mainReason = pickMainPriorityReason(reasons)
  if (mainReason?.view) primaryView = mainReason.view
  if (!factors.length) {
    factors.push('Rotina regular')
    filterTags.push('regular')
  }

  return {
    student,
    priority: mainReason?.level || 'Regular',
    priorityRank: { Urgente: 0, Atencao: 1, Acompanhar: 2, Regular: 3 }[mainReason?.level || 'Regular'],
    reason: mainReason ? `Motivo principal: ${mainReason.text}.` : 'Operacao em dia para este aluno.',
    recommendedAction: mainReason?.action || 'Mantenha contato proativo e acompanhe a proxima evolucao.',
    primaryView,
    factors: [...new Set(factors)],
    filterTags: [...new Set(filterTags.concat(mainReason ? [normalizePriorityFilter(mainReason.level)] : []))],
    adherence,
    risk,
    pendingMessages: unreadStudentMessages,
    financialDueSoon: dueSoonInvoices.length > 0,
    lastActivity: lastActivityDate ? `Ultima atividade: ${formatDateTime(lastActivityDate)}` : 'Ultima atividade: sem registro',
  }
}

function calculateAdherenceScore({ logs14, previousLogs14, lastWorkoutDays, lastCheckinDays, checkins30, unreadStudentMessages, studentAdherence }) {
  const workoutScore = Math.min(100, Math.round((logs14 / 4) * 100))
  const checkinScore = lastCheckinDays === null ? 35 : lastCheckinDays <= 7 ? 100 : lastCheckinDays <= 14 ? 70 : lastCheckinDays <= 21 ? 45 : 20
  const responseScore = unreadStudentMessages ? Math.max(35, 100 - unreadStudentMessages * 20) : 100
  const consistencyScore = studentAdherence > 0 ? clampPercent(studentAdherence) : Math.min(100, Math.round(((logs14 + checkins30) / 6) * 100))
  const recencyScore = lastWorkoutDays === null ? 20 : lastWorkoutDays <= 3 ? 100 : lastWorkoutDays <= 7 ? 75 : lastWorkoutDays <= 14 ? 45 : 20
  const score = clampPercent((workoutScore * 0.28) + (checkinScore * 0.2) + (responseScore * 0.16) + (consistencyScore * 0.2) + (recencyScore * 0.16))
  const trend = logs14 - previousLogs14
  const classification = score >= 85 ? 'excelente' : score >= 70 ? 'boa' : score >= 50 ? 'instavel' : 'baixa'
  const reason = `Frequencia ${logs14}/14 dias, check-ins ${checkins30}/30 dias, respostas ${responseScore}/100 e consistencia ${consistencyScore}/100. Evolucao: ${trend > 0 ? `subiu ${trend}` : trend < 0 ? `caiu ${Math.abs(trend)}` : 'estavel'}.`

  return { score, classification, trend, reason }
}

function calculateAbandonmentRisk({ lastWorkoutDays, lastCheckinDays, unreadStudentMessages, overdueInvoices, logs14, previousLogs14, adherenceScore, latestMessageNeedsReply }) {
  const factors = []
  let score = 0

  if (lastWorkoutDays === null || lastWorkoutDays >= 14) {
    score += 30
    factors.push('muitos dias sem treinar')
  } else if (lastWorkoutDays >= 8) {
    score += 18
    factors.push('queda de frequencia')
  }
  if (lastCheckinDays === null || lastCheckinDays >= 21) {
    score += 22
    factors.push('falta de check-in')
  } else if (lastCheckinDays >= 14) {
    score += 12
    factors.push('check-in atrasado')
  }
  if (unreadStudentMessages || latestMessageNeedsReply) {
    score += Math.min(18, 8 + unreadStudentMessages * 5)
    factors.push('ausencia de resposta')
  }
  if (overdueInvoices.length) {
    score += 24
    factors.push('atraso financeiro')
  }
  if (logs14 < previousLogs14 && previousLogs14 > 0) {
    score += 12
    factors.push('queda de frequencia')
  }
  if (adherenceScore < 55) {
    score += 14
    factors.push('baixa adesao')
  }

  const normalizedScore = clampPercent(score)
  const classification = normalizedScore >= 75 ? 'critico' : normalizedScore >= 55 ? 'alto' : normalizedScore >= 30 ? 'medio' : 'baixo'
  const reason = factors.length ? `Risco ${classification}: ${[...new Set(factors)].join(', ')}.` : 'Risco baixo: rotina recente sem sinal critico.'

  return { score: normalizedScore, classification, factors: [...new Set(factors)], reason }
}

function pickMainPriorityReason(reasons = []) {
  const rank = { Urgente: 0, Atencao: 1, Acompanhar: 2 }
  return reasons.slice().sort((a, b) => rank[a.level] - rank[b.level])[0] || null
}

function normalizePriorityFilter(priority) {
  if (priority === 'Urgente') return 'urgente'
  return priority === 'Atencao' ? 'atencao' : 'acompanhar'
}

function latestByDate(items = [], getDate) {
  return items
    .filter(Boolean)
    .slice()
    .sort((a, b) => new Date(getDate(b) || 0) - new Date(getDate(a) || 0))[0] || null
}

function countSince(items = [], days, getDate) {
  return items.filter((item) => {
    const age = safeDaysSince(getDate(item))
    return age !== null && age <= days
  }).length
}

function countBetweenDays(items = [], minDays, maxDays, getDate) {
  return items.filter((item) => {
    const age = safeDaysSince(getDate(item))
    return age !== null && age >= minDays && age <= maxDays
  }).length
}

function safeDaysSince(value) {
  const days = daysSinceDate(value)
  if (days === null || !Number.isFinite(days)) return null
  return Math.max(0, days)
}

function daysUntilDate(value) {
  if (!value) return null
  const raw = String(value)
  const normalized = raw.includes('T') ? raw : `${raw}T12:00:00`
  const time = new Date(normalized).getTime()
  if (Number.isNaN(time)) return null
  return Math.ceil((time - Date.now()) / (24 * 60 * 60 * 1000))
}

function detectPainOrFatigue(checkin) {
  if (!checkin) return false
  const text = normalizeText(`${checkin.state || ''} ${checkin.note || ''} ${checkin.type || ''}`)
  return checkin.state === 'Critico' || /dor|fadiga|cansad|exaust|lesao|lesion|sono ruim|muito dolor/.test(text)
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
  return parseCurrencyNumber(plan.price)
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
      billingMessage: String(plan?.billingMessage || plan?.billing_message || '').trim(),
    }))
    .filter((plan) => plan.name)

  return normalizedPlans.length ? normalizedPlans : plans
}

function buildCoachSettingsPayload(settings = {}, user = {}) {
  return {
    brandName: settings?.brandName || 'Coach Fit Pro',
    publicName: settings?.publicName || user?.name || '',
    cref: settings?.cref || '',
    whatsapp: settings?.whatsapp || '',
    supportEmail: settings?.supportEmail || user?.email || '',
    pixKey: settings?.pixKey || '',
    billingLogoUrl: settings?.billingLogoUrl || '',
    billingPrimaryColor: settings?.billingPrimaryColor || '#10b981',
    billingAccentColor: settings?.billingAccentColor || '#0f172a',
    billingMessage: settings?.billingMessage || 'Ola, {aluno}. Seu acesso esta aguardando pagamento. Valor: {valor}. Vencimento: {vencimento}. Pix: {pix}. Apos pagar, envie o comprovante no chat para validacao.',
    autoBillingEnabled: settings?.autoBillingEnabled !== false,
    customPlans: getCoachPlans(settings),
    welcomeMessage: settings?.welcomeMessage || 'Mantenha o plano, registre seu treino e use o check-in para me contar como voce esta evoluindo.',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  }
}

function normalizeCoachPlan(plan = {}) {
  const cycle = normalizePlanCycle(plan?.cycle || plan?.duration || 'mensal')
  return {
    name: String(plan?.name || '').trim(),
    price: normalizePlanPrice(plan?.price),
    cycle,
    duration: getPlanCycleLabel({ cycle }),
    features: String(plan?.features || plan?.description || 'Plano personalizado do treinador').trim(),
    billingMessage: String(plan?.billingMessage || plan?.billing_message || '').trim(),
  }
}

function parseCustomPlans(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', price = '', cycleOrFeatures = '', featuresOrEmpty = '', billingMessage = ''] = line.split('|').map((part) => part.trim())
      const hasExplicitCycle = ['semanal', 'mensal', 'semestral', 'anual'].includes(normalizePlanCycle(cycleOrFeatures))
      const cycle = hasExplicitCycle ? normalizePlanCycle(cycleOrFeatures) : 'mensal'
      const features = hasExplicitCycle ? featuresOrEmpty : cycleOrFeatures
      return {
        name,
        price: normalizePlanPrice(price),
        cycle,
        duration: getPlanCycleLabel({ cycle }),
        features: features || 'Plano do treinador',
        billingMessage,
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
  const number = parseCurrencyNumber(raw)
  return Number.isFinite(number) ? formatCurrency(number) : raw
}

function parseCurrencyNumber(value) {
  const raw = String(value || '').trim().replace(/[^\d,.-]/g, '')
  if (!raw) return 0
  const hasComma = raw.includes(',')
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.includes('.') && raw.split('.').at(-1)?.length === 3
      ? raw.replace(/\./g, '')
      : raw
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
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

function getBillingMessageTemplateForPlan(plan, coachSettings) {
  return plan?.billingMessage || coachSettings?.billingMessage || ''
}

function buildBillingMessage(template, { student, amount, dueDate, coachSettings, plan }) {
  const fallback = 'Olá, {aluno}. Seu acesso está aguardando pagamento. Valor: {valor}. Vencimento: {vencimento}. Pix: {pix}. Após pagar, envie o comprovante no chat para o coach validar.'
  return String(template || fallback)
    .replaceAll('{aluno}', student?.name || 'aluno')
    .replaceAll('{plano}', plan?.name || student?.plan || 'acompanhamento')
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

function captureLeadAttribution() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'cid', 'src', 'campaign', 'adset', 'ad']
  const values = {}
  keys.forEach((key) => {
    const value = params.get(key)
    if (value) values[key] = value
  })

  const hasCampaignData = Object.keys(values).length > 0
  let previous = {}
  try {
    previous = JSON.parse(window.localStorage.getItem(LEAD_ATTRIBUTION_KEY) || '{}')
  } catch {
    previous = {}
  }

  const attribution = {
    ...previous,
    ...values,
    landingPage: previous.landingPage || window.location.href,
    referrer: previous.referrer || document.referrer || '',
    firstSeenAt: previous.firstSeenAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  }

  if (hasCampaignData || !previous.firstSeenAt) {
    try {
      window.localStorage.setItem(LEAD_ATTRIBUTION_KEY, JSON.stringify(attribution))
    } catch {
      // O rastreamento segue opcional caso o navegador bloqueie armazenamento local.
    }
  }

  try {
    const sessionKey = `coachfitpro-visit-recorded-${attribution.firstSeenAt || 'default'}`
    if (!window.sessionStorage.getItem(sessionKey)) {
      window.sessionStorage.setItem(sessionKey, '1')
      recordLeadEvent('visit', { page: window.location.pathname, hasCampaignData })
    }
  } catch {
    recordLeadEvent('visit', { page: window.location.pathname, hasCampaignData })
  }

  return attribution
}

function getStoredLeadAttribution() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(LEAD_ATTRIBUTION_KEY) || '{}')
  } catch {
    return {}
  }
}

function getStoredLeadEvents() {
  if (typeof window === 'undefined') return []
  try {
    const events = JSON.parse(window.localStorage.getItem(LEAD_EVENTS_KEY) || '[]')
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

function saveStoredLeadEvents(events) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEAD_EVENTS_KEY, JSON.stringify(events.slice(0, 160)))
  } catch {
    // O app continua funcionando mesmo se o navegador bloquear storage.
  }
}

function recordLeadEvent(type, metadata = {}) {
  if (typeof window === 'undefined') return null
  const attribution = getStoredLeadAttribution()
  const event = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    planId: metadata.planId || '',
    email: metadata.email || '',
    attribution,
    metadata,
    createdAt: new Date().toISOString(),
  }
  const nextEvents = [event, ...getStoredLeadEvents()].slice(0, 160)
  saveStoredLeadEvents(nextEvents)
  if (supabaseEnabled) {
    saveRemoteLeadEvent(event).catch(() => {})
  }
  return event
}

function mergeLeadEvents(...eventGroups) {
  const records = new Map()
  eventGroups.flat().forEach((event) => {
    if (!event) return
    const key = event.id || `${event.type}-${event.createdAt}-${event.email || event.metadata?.email || ''}-${event.planId || event.metadata?.planId || ''}`
    records.set(key, event)
  })
  return [...records.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

function buildLeadTrafficSnapshot(events = []) {
  const counts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1
    return acc
  }, {})
  const planCounts = events.reduce((acc, event) => {
    const planId = event.planId || event.metadata?.planId || ''
    if (planId) acc[planId] = (acc[planId] || 0) + 1
    return acc
  }, {})
  const topPlanEntry = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]
  const latestAttribution = events.find((event) => event.attribution && Object.keys(event.attribution).length)?.attribution || getStoredLeadAttribution()
  const source = latestAttribution.utm_source || latestAttribution.src || latestAttribution.referrer || 'Direto / orgânico'
  const campaign = latestAttribution.utm_campaign || latestAttribution.campaign || latestAttribution.cid || 'Sem campanha identificada'

  return {
    visits: counts.visit || 0,
    planSelections: counts.plan_selected || 0,
    signups: counts.signup_submitted || 0,
    checkouts: counts.checkout_clicked || 0,
    payments: counts.payment_confirmed || 0,
    lastSource: source,
    lastCampaign: campaign,
    topPlan: topPlanEntry ? `${formatUiText(topPlanEntry[0])} (${topPlanEntry[1]})` : 'Sem dados ainda',
  }
}

function formatLeadEventType(type) {
  const labels = {
    visit: 'Visita na página',
    plan_selected: 'Plano escolhido',
    signup_submitted: 'Cadastro iniciado',
    checkout_clicked: 'Checkout aberto',
    payment_confirmed: 'Pagamento confirmado',
  }
  return labels[type] || formatUiText(type)
}

function formatLeadEventDetail(event = {}) {
  const planId = event.planId || event.metadata?.planId || ''
  const email = event.email || event.metadata?.email || ''
  const source = event.attribution?.utm_source || event.attribution?.src || ''
  const campaign = event.attribution?.utm_campaign || event.attribution?.campaign || event.attribution?.cid || ''
  const parts = []
  if (planId) parts.push(`Plano: ${formatUiText(planId)}`)
  if (email) parts.push(`E-mail: ${email}`)
  if (source) parts.push(`Origem: ${source}`)
  if (campaign) parts.push(`Campanha: ${campaign}`)
  return parts.length ? parts.join(' · ') : 'Evento registrado sem campanha identificada.'
}

function loadLastAppError() {
  if (typeof window === 'undefined') return null
  try {
    const error = JSON.parse(window.localStorage.getItem('coachfitpro-last-error') || 'null')
    return error?.message ? error : null
  } catch {
    return null
  }
}

function buildSystemHealthChecks({ remoteStatus = '', remoteError = '', checkoutPlans = [], lastError = null }) {
  const hasCartpandaPlans = checkoutPlans.length >= 3 && checkoutPlans.every((plan) => /cartpanda|coachfitpro\.com\.br\/checkout/i.test(plan.checkoutUrl || ''))
  const hasLogoIcon = true
  const statusText = `${remoteStatus} ${remoteError}`.toLowerCase()
  const supabaseOk = supabaseEnabled && !/erro|expirada|indispon/.test(statusText)
  const webhookLikelyOk = !/postback|webhook|pagamento ainda|aguardando confirma/i.test(statusText)

  return [
    {
      title: 'Supabase',
      status: supabaseOk ? 'ok' : supabaseEnabled ? 'warning' : 'danger',
      label: supabaseOk ? 'ok' : supabaseEnabled ? 'atenção' : 'pendente',
      detail: supabaseOk ? 'Banco conectado e sessão operacional.' : supabaseEnabled ? 'Existe conexão, mas há aviso recente no app.' : 'Variáveis do Supabase não encontradas nesta publicação.',
    },
    {
      title: 'Checkout Cartpanda',
      status: hasCartpandaPlans ? 'ok' : 'warning',
      label: hasCartpandaPlans ? 'ok' : 'revisar',
      detail: hasCartpandaPlans ? 'Planos oficiais apontam para checkouts Cartpanda.' : 'Revise os links dos planos oficiais no Admin Master.',
    },
    {
      title: 'Liberação automática',
      status: webhookLikelyOk ? 'ok' : 'warning',
      label: webhookLikelyOk ? 'ok' : 'testar',
      detail: webhookLikelyOk ? 'Nenhum erro recente de confirmação de pagamento.' : 'Faça um teste de compra para confirmar o postback.',
    },
    {
      title: 'Ícone e PWA',
      status: hasLogoIcon ? 'ok' : 'warning',
      label: hasLogoIcon ? 'ok' : 'revisar',
      detail: 'Favicon e ícone instalável usam a logo abreviada do Coach Fit Pro.',
    },
    {
      title: 'Erros críticos',
      status: lastError ? 'warning' : 'ok',
      label: lastError ? 'atenção' : 'limpo',
      detail: lastError ? 'Há um erro capturado neste navegador para revisar.' : 'Nenhuma falha crítica capturada localmente.',
    },
  ]
}

function appendAttributionToCheckoutUrl(value, planId = '') {
  const baseUrl = resolveCheckoutUrl(value)
  const attribution = getStoredLeadAttribution()
  const relevantKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'cid', 'src', 'campaign', 'adset', 'ad']
  const hasAttribution = relevantKeys.some((key) => attribution[key])
  if (!hasAttribution && !planId) return baseUrl

  try {
    const url = new URL(baseUrl)
    relevantKeys.forEach((key) => {
      if (attribution[key] && !url.searchParams.has(key)) url.searchParams.set(key, attribution[key])
    })
    if (planId && !url.searchParams.has('fitcoach_plan')) url.searchParams.set('fitcoach_plan', planId)
    if (attribution.firstSeenAt && !url.searchParams.has('fitcoach_first_seen')) {
      url.searchParams.set('fitcoach_first_seen', attribution.firstSeenAt)
    }
    return url.toString()
  } catch {
    return baseUrl
  }
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

function toDateInputValue(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const offset = safeDate.getTimezoneOffset() * 60 * 1000
  return new Date(safeDate.getTime() - offset).toISOString().slice(0, 10)
}

function addPlanCycleToDate(value, plan) {
  const date = parseValidDate(value) ?? new Date()
  date.setHours(12, 0, 0, 0)
  const cycle = normalizePlanCycle(plan?.cycle || plan?.duration)

  if (cycle === 'semanal') {
    date.setDate(date.getDate() + 7)
  } else if (cycle === 'semestral') {
    date.setMonth(date.getMonth() + 6)
  } else if (cycle === 'anual') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }

  return toDateInputValue(date)
}

function getNextBillingDateForStudent(student, invoices = [], availablePlans = plans) {
  if (!student) return getDefaultDueDate()
  const plan = availablePlans.find((item) => item.name === student.plan) || availablePlans[0]
  const studentInvoices = invoices
    .filter((invoice) => String(invoice.studentId) === String(student.id))
    .map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) }))
    .sort((a, b) => new Date(b.paidAt || b.dueDate || b.createdAt || 0) - new Date(a.paidAt || a.dueDate || a.createdAt || 0))

  const openInvoice = studentInvoices.find((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status))
  if (openInvoice?.dueDate) return openInvoice.dueDate

  const latestPaid = studentInvoices.find((invoice) => invoice.status === 'Pago')
  if (latestPaid) return addPlanCycleToDate(latestPaid.paidAt || latestPaid.dueDate || latestPaid.createdAt, plan)

  if (student.payment === 'Pendente') return toDateInputValue(new Date())

  return getDueDateForPlan(plan)
}

function getDueDateForPlan(plan) {
  const date = new Date()
  const cycle = normalizePlanCycle(plan?.cycle || plan?.duration)
  if (cycle === 'semanal') {
    date.setDate(date.getDate() + 7)
  } else if (cycle === 'semestral') {
    date.setMonth(date.getMonth() + 6)
  } else if (cycle === 'anual') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
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
    Configuracoes: 'Gerenciamento',
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
