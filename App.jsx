import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  acceptRemoteStudentConsent,
  createRemoteStudentInvite,
  loadRemoteData,
  loadRemoteStudentByInvite,
  markRemoteNotificationsRead,
  refreshCoachSession,
  saveRemoteAppointment,
  saveRemoteAssessment,
  saveRemoteCheckin,
  saveRemoteCoachSettings,
  saveRemoteInvoice,
  saveRemoteNutritionPlan,
  saveRemoteStudent,
  saveRemoteMessage,
  saveRemoteWorkout,
  saveRemoteWorkoutLog,
  setSupabaseSession,
  signInCoach,
  signUpCoach,
  supabaseEnabled,
  updateRemoteAppointmentStatus,
  updateRemoteInvoiceStatus,
  updateRemotePayment,
  upsertRemoteUser,
} from './supabaseApi'

const STORAGE_KEY = 'fitcoach-ai-pro-v2'

const plans = [
  { name: 'Essential', price: 'R$ 197', features: 'Treino, dieta e 1 check-in semanal' },
  { name: 'Performance', price: 'R$ 347', features: 'Ajustes semanais, suporte e analise de videos' },
  { name: 'Elite', price: 'R$ 597', features: 'Acompanhamento premium, chamadas e revisoes completas' },
]

const navItems = [
  { id: 'visao', label: 'Visão geral', icon: '01' },
  { id: 'agenda', label: 'Agenda', icon: '02' },
  { id: 'alunos', label: 'Alunos', icon: '03' },
  { id: 'avaliacoes', label: 'Avaliações', icon: '04' },
  { id: 'treinos', label: 'Treinos', icon: '05' },
  { id: 'nutricao', label: 'Nutrição', icon: '06' },
  { id: 'checkins', label: 'Check-ins', icon: '07' },
  { id: 'pagamentos', label: 'Planos e pagamentos', icon: '08' },
  { id: 'notificacoes', label: 'Notificações', icon: '09' },
  { id: 'mensagens', label: 'Mensagens', icon: '10' },
  { id: 'aluno-app', label: 'Área do aluno', icon: '11' },
  { id: 'configuracoes', label: 'Configurações', icon: '12' },
]

const workoutPlan = [
  { day: 'Segunda', focus: 'Upper A', items: 'Supino, remada, desenvolvimento', status: 'Publicado' },
  { day: 'Terca', focus: 'Cardio Z2', items: '35 min esteira + mobilidade', status: 'Publicado' },
  { day: 'Quarta', focus: 'Lower A', items: 'Agachamento, stiff, panturrilha', status: 'Revisar carga' },
  { day: 'Quinta', focus: 'Descanso ativo', items: 'Passos, alongamento, sono', status: 'Publicado' },
]

const mealPlan = [
  { meal: 'Cafe da manha', foods: 'Ovos, aveia, banana, cafe', macros: '42P / 74C / 18G' },
  { meal: 'Almoco', foods: 'Arroz, frango, feijao, salada', macros: '58P / 96C / 16G' },
  { meal: 'Pre treino', foods: 'Iogurte, mel, granola', macros: '26P / 61C / 8G' },
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
    coachSettings: null,
  }
}

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : createInitialData()
    } catch {
      return createInitialData()
    }
  })
  const [remoteStatus, setRemoteStatus] = useState(supabaseEnabled ? 'Conectando Supabase' : 'Banco local')
  const [remoteError, setRemoteError] = useState('')

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
          coachSettings: remoteData.coachSettings ?? current.coachSettings,
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
                setRemoteStatus('Sessao renovada')
                setRemoteError('')
              })
              .catch(() => {
                if (!active) return
                setSupabaseSession('')
                setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], coachSettings: null }))
                setRemoteStatus('Sessao expirada')
                setRemoteError('Sua sessao expirou. Entre novamente para continuar.')
              })
            return
          }

          setSupabaseSession('')
          setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], coachSettings: null }))
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  return [data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError]
}

export default function App() {
  const [data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError] = useStoredData()
  const [activeView, setActiveView] = useState('visao')
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id ?? 1)
  const [tone, setTone] = useState('Firme')
  const [studentAccess, setStudentAccess] = useState(null)

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

  useEffect(() => {
    if (data.session?.access_token) {
      setSupabaseSession(data.session.access_token)
    }
  }, [data.session?.access_token])

  useEffect(() => {
    if (!supabaseEnabled || !data.session?.refresh_token) return undefined

    const expiresAt = data.session.expires_at
      ? Number(data.session.expires_at) * 1000
      : Date.now() + 45 * 60 * 1000
    const refreshDelay = Math.max(expiresAt - Date.now() - 60 * 1000, 30 * 1000)
    const timer = window.setTimeout(() => {
      refreshStoredSession('Sessao renovada automaticamente')
    }, refreshDelay)

    return () => window.clearTimeout(timer)
  }, [data.session?.refresh_token, data.session?.expires_at])

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('invite')
    if (!inviteCode || studentAccess) return

    enterStudentByInvite(inviteCode)
    window.history.replaceState({}, '', window.location.pathname)
  }, [studentAccess])

  async function login(formData) {
    const name = formData.get('name')?.toString().trim() || 'Coach'
    const email = formData.get('email')?.toString().trim() || ''
    const password = formData.get('password')?.toString() || ''
    const mode = formData.get('mode')?.toString() || 'signin'
    const user = { name, email, role: 'Coach principal' }

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
          messages: remoteData.messages ?? [],
          appointments: remoteData.appointments ?? [],
          invoices: remoteData.invoices ?? [],
          assessments: remoteData.assessments ?? [],
          coachSettings: remoteData.coachSettings,
        }))
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
        return
      } catch (error) {
        setRemoteStatus('Erro no login')
        setRemoteError(error.message)
        return
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
  }

  function logout() {
    setSupabaseSession('')
    setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], coachSettings: null }))
  }

  async function refreshStoredSession(successStatus = 'Sessao renovada') {
    if (!data.session?.refresh_token) {
      throw new Error('Sessao expirada')
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
        refreshStoredSession('Sessao renovada')
          .then(() => {
            setRemoteError('Sessao renovada. Tente a acao novamente.')
          })
          .catch(() => {
            setSupabaseSession('')
            setRemoteStatus('Sessao expirada')
            setRemoteError('Sua sessao expirou. Entre novamente para continuar.')
            setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], coachSettings: null }))
          })
        return
      }

      setSupabaseSession('')
      setRemoteStatus('Sessão expirada')
      setRemoteError('Sua sessão expirou. Entre novamente para continuar.')
      setData((current) => ({ ...current, user: null, session: null, students: [], checkins: [], notifications: [], workouts: [], nutritionPlans: [], workoutLogs: [], messages: [], appointments: [], invoices: [], assessments: [], coachSettings: null }))
      return
    }

    setRemoteStatus(fallbackStatus)
    setRemoteError(message)
  }

  async function saveStudent(student) {
    const studentId = student.id || Date.now()
    let savedStudent = { ...student, id: studentId }

    if (supabaseEnabled) {
      try {
        savedStudent = await saveRemoteStudent(student, data.user?.id)
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar aluno')
        savedStudent = { ...student, id: studentId }
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
        notifications: [
          { id: Date.now() + 1, title: exists ? 'Aluno atualizado' : 'Aluno cadastrado', body: student.name, read: false },
          ...current.notifications,
        ],
      }
    })
    setSelectedStudentId(savedStudent.id)
  }

  async function addCheckin(checkin) {
    const { photoFile, ...localCheckin } = checkin
    let savedCheckin = { ...localCheckin, id: Date.now() }

    if (supabaseEnabled) {
      try {
        savedCheckin = await saveRemoteCheckin(checkin)
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar check-in')
        savedCheckin = { ...checkin, id: Date.now() }
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
  }

  async function updatePayment(studentId, payment) {
    if (supabaseEnabled) {
      try {
        await updateRemotePayment(studentId, payment)
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar pagamento')
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
  }

  async function markNotificationsRead() {
    if (supabaseEnabled) {
      try {
        await markRemoteNotificationsRead()
        setRemoteStatus('Supabase conectado')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar notificações')
      }
    }

    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }))
  }

  async function saveWorkout(workout) {
    let savedWorkout = { ...workout, id: Date.now() }

    if (supabaseEnabled) {
      try {
        savedWorkout = await saveRemoteWorkout(workout, data.user?.id)
        setRemoteStatus('Treino salvo')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar treino')
      }
    }

    setData((current) => ({
      ...current,
      workouts: [savedWorkout, ...(current.workouts ?? [])],
    }))

    return savedWorkout
  }

  async function saveNutritionPlan(plan) {
    let savedPlan = { ...plan, id: Date.now() }

    if (supabaseEnabled) {
      try {
        savedPlan = await saveRemoteNutritionPlan(plan, data.user?.id)
        setRemoteStatus('Dieta salva')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar dieta')
      }
    }

    setData((current) => ({
      ...current,
      nutritionPlans: [savedPlan, ...(current.nutritionPlans ?? [])],
    }))

    return savedPlan
  }

  async function completeWorkout(log) {
    let savedLog = { ...log, id: Date.now(), completedAt: new Date().toISOString() }

    if (supabaseEnabled) {
      try {
        savedLog = await saveRemoteWorkoutLog(log)
        setRemoteStatus('Treino concluído')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao concluir treino')
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
        setRemoteStatus('Cobranca criada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao criar cobranca')
      }
    }

    setData((current) => ({
      ...current,
      invoices: [savedInvoice, ...(current.invoices ?? [])],
      notifications: [
        { id: Date.now() + 1, title: 'Nova cobranca', body: `${savedInvoice.planName} - ${formatCurrency(savedInvoice.amount)}`, read: false },
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
        setRemoteStatus('Avaliacao salva')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar avaliacao')
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
        { id: Date.now() + 1, title: 'Avaliacao registrada', body: `Peso ${formatNumber(savedAssessment.weightKg)} kg`, read: false },
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
        setRemoteStatus('Configuracoes salvas')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao salvar configuracoes')
      }
    }

    setData((current) => ({ ...current, coachSettings: savedSettings }))
    return savedSettings
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

    if (supabaseEnabled) {
      try {
        savedInvoice = await updateRemoteInvoiceStatus(invoiceId, status, paymentMethod)
        setRemoteStatus('Cobranca atualizada')
        setRemoteError('')
      } catch (error) {
        handleRemoteError(error, 'Erro ao atualizar cobranca')
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
  }

  async function sendMessage(message) {
    const localMessage = {
      ...message,
      id: Date.now(),
      coachId: message.coachId ?? data.user?.id,
      read: message.sender === 'coach',
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

  async function enterStudentByInvite(code) {
    try {
      const access = await loadRemoteStudentByInvite(code.trim())
      setStudentAccess(access)
      setRemoteStatus('Convite carregado')
      setRemoteError('')
    } catch (error) {
      handleRemoteError(error, 'Erro no convite')
    }
  }

  async function acceptStudentConsent() {
    if (!studentAccess?.invite?.code) return

    try {
      const access = await acceptRemoteStudentConsent(studentAccess.invite.code)
      setStudentAccess(access)
      setRemoteStatus('Consentimento registrado')
      setRemoteError('')
    } catch (error) {
      handleRemoteError(error, 'Erro ao registrar consentimento')
    }
  }

  function exitStudentAccess() {
    setStudentAccess(null)
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

    return (
      <StudentAccessApp
        access={studentAccess}
        checkins={data.checkins}
        workouts={studentAccess.workouts ?? []}
        nutritionPlans={studentAccess.nutritionPlans ?? []}
        workoutLogs={data.workoutLogs?.length ? data.workoutLogs : studentAccess.workoutLogs ?? []}
        messages={data.messages?.length ? data.messages : studentAccess.messages ?? []}
        appointments={studentAccess.appointments ?? []}
        invoices={studentAccess.invoices ?? []}
        assessments={studentAccess.assessments ?? []}
        coachSettings={studentAccess.coachSettings}
        onCompleteWorkout={completeWorkout}
        onAddCheckin={addCheckin}
        onSendMessage={sendMessage}
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
      />
    )
  }

  const viewTitle = navItems.find((item) => item.id === activeView)?.label ?? 'Visão geral'

  return (
    <div className="app-shell min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="grid min-h-screen min-w-0 max-w-full lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 max-w-full border-b border-white/10 bg-zinc-950/95 p-3 sm:p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <BrandLockup
              subtitle={`por ${data.coachSettings?.brandName || data.coachSettings?.publicName || data.user.name}`}
            />
            <button onClick={logout} className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300">
              Sair
            </button>
          </div>

          <div className="mt-4 rounded-md border border-emerald-400/40 bg-emerald-400/10 p-3 lg:mt-5">
            <p className="text-xs text-zinc-400">Status da base</p>
            <p className="text-sm font-bold text-emerald-200">{remoteStatus}</p>
            {remoteError ? <p className="mt-2 break-words text-xs leading-5 text-amber-200">{remoteError}</p> : null}
          </div>

          <nav className="mt-4 grid min-w-0 grid-cols-3 gap-2 lg:mt-6 lg:grid-cols-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-center text-[11px] font-semibold transition sm:min-h-11 sm:flex-row sm:justify-start sm:gap-2 sm:px-3 sm:text-left sm:text-sm lg:gap-3 ${
                  activeView === item.id
                    ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-zinc-950/10 text-xs font-black">{item.icon}</span>
                <span className="min-w-0 max-w-full break-words leading-tight sm:flex-1">{item.label}</span>
                {item.id === 'notificacoes' && totalAlertCount > 0 ? (
                  <span className="rounded bg-amber-300 px-2 py-0.5 text-xs text-zinc-950">{totalAlertCount}</span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 xl:px-8">
          <div className="mx-auto min-w-0 max-w-[1440px]">
          <header className="mb-5 rounded-md border border-white/10 bg-zinc-900/60 p-4 sm:p-5 xl:mb-6 xl:flex xl:items-end xl:justify-between xl:gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-8 bg-emerald-400" />
                <p className="text-xs font-black uppercase text-emerald-300">FIT COACH / Central do coach</p>
              </div>
              <h2 className="mt-1 text-3xl font-black sm:text-4xl">{viewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Gerencie alunos, prescricoes, evolucao, agenda, comunicacao e financeiro em um unico lugar.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 xl:mt-0">
              {['Firme', 'Tecnico', 'Motivador'].map((item) => (
                <button
                  key={item}
                  onClick={() => setTone(item)}
                  className={`rounded-md border px-4 py-2 text-sm font-bold ${
                    tone === item ? 'border-amber-300 bg-amber-300 text-zinc-950' : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Alunos ativos" value={data.students.length} detail={`${paidStudents} com plano pago`} />
            <Metric label="Aderência média" value={`${averageAdherence}%`} detail="treino + dieta" />
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
                selectedStudent={selectedStudent}
                setSelectedStudentId={setSelectedStudentId}
                onSave={saveStudent}
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
              />
            )}
            {activeView === 'nutricao' && (
              <Nutrition
                selectedStudent={selectedStudent}
                students={data.students}
                nutritionPlans={data.nutritionPlans ?? []}
                onSaveNutritionPlan={saveNutritionPlan}
              />
            )}
            {activeView === 'checkins' && (
              <Checkins checkins={data.checkins} students={data.students} onAddCheckin={addCheckin} />
            )}
            {activeView === 'pagamentos' && (
              <Payments
                students={data.students}
                invoices={data.invoices ?? []}
                onSaveInvoice={saveInvoice}
                onUpdateInvoiceStatus={updateInvoiceStatus}
                onUpdatePayment={updatePayment}
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
                tone={tone}
                students={data.students}
                messages={data.messages ?? []}
                onSendMessage={sendMessage}
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
    </div>
  )
}

function LoginScreen({ onLogin, onStudentAccess, remoteStatus, remoteError }) {
  const [mode, setMode] = useState('signin')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    const formData = new FormData(event.currentTarget)
    if (mode === 'student') {
      await onStudentAccess(formData.get('inviteCode')?.toString() || '')
    } else {
      await onLogin(formData)
    }
    setLoading(false)
  }

  return (
    <div className="grid min-h-screen bg-zinc-950 text-zinc-100 lg:grid-cols-[minmax(300px,0.85fr)_minmax(420px,1.15fr)]">
      <section className="hidden border-r border-white/10 bg-emerald-400 p-10 text-zinc-950 lg:flex lg:flex-col lg:justify-between">
        <BrandLockup dark large subtitle="Gestao profissional de acompanhamento" />
        <div className="max-w-md">
          <p className="text-sm font-black uppercase">Treino. Nutrição. Evolução.</p>
          <h2 className="mt-4 text-4xl font-black leading-tight">
            Toda a operação do coach em um só lugar.
          </h2>
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-zinc-950/20 pt-5 text-sm font-black">
            <span>ALUNOS</span>
            <span>GESTÃO</span>
            <span>RESULTADOS</span>
          </div>
        </div>
      </section>

      <div className="grid place-items-center p-4 sm:p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-md border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
        <div className="mb-7 lg:hidden">
          <BrandLockup subtitle="Plataforma profissional" />
        </div>
        <p className="text-xs font-black uppercase text-emerald-300">Acesso seguro</p>
        <h1 className="mt-2 text-3xl font-black">{mode === 'signup' ? 'Criar conta' : 'Entrar no painel'}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Coach entra com email e senha. Aluno entra com codigo de convite.
        </p>
        <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold text-zinc-400">Status</p>
          <p className="mt-1 text-sm font-bold text-emerald-200">{remoteStatus}</p>
          {remoteError ? <p className="mt-2 break-words text-sm leading-6 text-amber-200">{remoteError}</p> : null}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-md border px-4 py-2 text-sm font-black ${mode === 'signin' ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-white/10 text-zinc-300'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-md border px-4 py-2 text-sm font-black ${mode === 'signup' ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-white/10 text-zinc-300'}`}
          >
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => setMode('student')}
            className={`rounded-md border px-4 py-2 text-sm font-black ${mode === 'student' ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-white/10 text-zinc-300'}`}
          >
            Aluno
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <input type="hidden" name="mode" value={mode} />
          {mode === 'student' ? (
            <Field label="Código de convite" name="inviteCode" defaultValue="" />
          ) : (
            <>
              {mode === 'signup' ? <Field label="Nome do coach" name="name" defaultValue="" /> : null}
              <Field label="Email" name="email" type="email" defaultValue="" />
              <Field label="Senha" name="password" type="password" defaultValue="" />
            </>
          )}
        </div>
        <button className="mt-6 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          {loading ? 'Processando...' : mode === 'student' ? 'Acessar área do aluno' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </button>
        {mode === 'signup' ? (
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Se a Supabase pedir confirmacao por email, confirme na caixa de entrada e depois use Entrar.
          </p>
        ) : null}
      </form>
      </div>
    </div>
  )
}

function Overview({ selectedStudent, smartAlerts, assessments, invoices, setActiveView }) {
  if (!selectedStudent) {
    return (
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Comece sua operacao" action="Primeiros passos">
          <div className="grid gap-3">
            {[
              ['1', 'Configure sua identidade', 'Preencha marca, nome profissional, CREF e WhatsApp.', 'configuracoes'],
              ['2', 'Cadastre o primeiro aluno', 'Registre objetivo, plano, contato e dados iniciais.', 'alunos'],
              ['3', 'Monte o acompanhamento', 'Crie treino, dieta, avaliacao, agenda e cobranca.', 'treinos'],
              ['4', 'Envie o convite', 'Teste o portal do aluno e o consentimento de dados.', 'aluno-app'],
            ].map(([number, title, description, view]) => (
              <button
                key={number}
                onClick={() => setActiveView(view)}
                className="flex w-full items-start gap-4 rounded-md border border-white/10 bg-white/[0.03] p-4 text-left hover:border-emerald-300/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-emerald-400 font-black text-zinc-950">{number}</span>
                <span>
                  <span className="block font-black">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Conta pronta para iniciar" action="Ambiente limpo">
          <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
            <p className="font-black text-emerald-200">Nenhum dado demonstrativo</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Sua conta esta vazia e preparada para receber somente alunos reais da sua operacao.
            </p>
          </div>
          <button onClick={() => setActiveView('alunos')} className="mt-4 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
            Cadastrar primeiro aluno
          </button>
        </Panel>
      </div>
    )
  }

  const assessmentData = buildAssessmentChartData(assessments, selectedStudent?.id)
  const revenueChartData = buildRevenueChartData(invoices)

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Evolucao corporal" action={`${assessmentData.length} avaliacoes`}>
        {assessmentData.length ? (
          <ChartWrap>
            <LineChart data={assessmentData} margin={{ left: -18, right: 8, top: 10 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="#34d399" strokeWidth={3} />
              <Line type="monotone" dataKey="gordura" name="Gordura (%)" stroke="#fbbf24" strokeWidth={3} />
            </LineChart>
          </ChartWrap>
        ) : (
          <Empty text="Registre avaliacoes para visualizar a evolucao real do aluno." />
        )}
      </Panel>

      <Panel title="Aluno em foco" action={selectedStudent?.status ?? 'Sem aluno'}>
        {selectedStudent ? <StudentSnapshot student={selectedStudent} /> : <Empty text="Cadastre seu primeiro aluno." />}
        <button onClick={() => setActiveView('alunos')} className="mt-5 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          Abrir alunos
        </button>
      </Panel>

      <Panel title="Receita recebida" action="Dados financeiros">
        {revenueChartData.length ? (
          <ChartWrap>
            <AreaChart data={revenueChartData} margin={{ left: -18, right: 8, top: 10 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
              <XAxis dataKey="month" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="receita" stroke="#60a5fa" fill="#1d4ed8" fillOpacity={0.35} />
            </AreaChart>
          </ChartWrap>
        ) : (
          <Empty text="Marque cobrancas como pagas para formar o grafico de receita." />
        )}
      </Panel>

      <Panel title="Prioridades" action={`${smartAlerts.length} alertas`}>
        <div className="space-y-3">
          {smartAlerts.length ? (
            smartAlerts.slice(0, 5).map((alert) => (
              <SmartAlertCard key={alert.id} alert={alert} compact onOpen={() => setActiveView(alert.view)} />
            ))
          ) : (
            <Empty text="Nenhuma prioridade critica agora." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function Agenda({ students, appointments, onSaveAppointment, onUpdateStatus }) {
  const [filter, setFilter] = useState('Proximos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
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

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const startsAtValue = form.get('startsAt')?.toString()
    if (!startsAtValue) return

    setSaving(true)
    setMessage('')
    await onSaveAppointment({
      studentId: form.get('studentId').toString(),
      title: form.get('title').toString(),
      type: form.get('type').toString(),
      startsAt: new Date(startsAtValue).toISOString(),
      durationMinutes: Number(form.get('durationMinutes')),
      status: 'Agendado',
      location: form.get('location').toString(),
      notes: form.get('notes').toString(),
    })
    event.currentTarget.reset()
    setSaving(false)
    setMessage('Compromisso adicionado na agenda.')
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Panel title="Novo compromisso" action="Agenda">
        {students.length ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Select
              label="Aluno"
              name="studentId"
              options={students.map((student) => ({ label: student.name, value: student.id }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titulo" name="title" defaultValue="Acompanhamento" />
              <Select label="Tipo" name="type" defaultValue="Consulta" options={['Consulta', 'Avaliacao', 'Check-in', 'Chamada', 'Outro']} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e horario" name="startsAt" type="datetime-local" defaultValue={getDefaultAppointmentDate()} />
              <Select
                label="Duracao"
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
            <TextArea label="Observacoes" name="notes" defaultValue="Revisar progresso, aderencia e proximos ajustes." />
            <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
              {saving ? 'Salvando...' : 'Agendar compromisso'}
            </button>
            {message ? <p className="text-sm font-bold text-emerald-200">{message}</p> : null}
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
                  ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300'
              }`}
            >
              {option}
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
                        <span className="text-xs font-bold text-zinc-500">{appointment.type}</span>
                      </div>
                      <h4 className="mt-3 text-lg font-black">{appointment.title}</h4>
                      <p className="mt-1 text-sm text-zinc-300">{student?.name ?? 'Aluno'}</p>
                      <p className="mt-2 text-sm font-bold text-emerald-200">{formatFullDateTime(appointment.startsAt)}</p>
                      <p className="mt-1 text-sm text-zinc-400">{appointment.durationMinutes} min - {appointment.location || 'Sem local'}</p>
                      {appointment.notes ? <p className="mt-3 text-sm leading-6 text-zinc-400">{appointment.notes}</p> : null}
                    </div>

                    {!['Concluido', 'Cancelado'].includes(appointment.status) ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-1">
                        {appointment.status !== 'Confirmado' ? (
                          <button onClick={() => onUpdateStatus(appointment.id, 'Confirmado')} className="rounded-md border border-emerald-300/30 px-3 py-2 text-xs font-black text-emerald-200">
                            Confirmar
                          </button>
                        ) : null}
                        <button onClick={() => onUpdateStatus(appointment.id, 'Concluido')} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950">
                          Concluir
                        </button>
                        <button onClick={() => onUpdateStatus(appointment.id, 'Cancelado')} className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200">
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

function Students({ students, selectedStudent, setSelectedStudentId, onSave }) {
  const [editing, setEditing] = useState(null)

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1fr_1.15fr]">
      <Panel title="Carteira de alunos" action={`${students.length} perfis`}>
        <button onClick={() => setEditing(createBlankStudent())} className="mb-4 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          Novo aluno
        </button>
        <div className="space-y-3">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className={`w-full rounded-md border p-4 text-left transition ${
                selectedStudent?.id === student.id ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{student.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{student.goal}</p>
                </div>
                <Badge tone={student.risk}>{student.risk}</Badge>
              </div>
              <div className="mt-4 h-2 rounded bg-zinc-800">
                <div className="h-2 rounded bg-emerald-400" style={{ width: `${student.adherence}%` }} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ficha e edicao" action={selectedStudent?.phase ?? 'Novo'}>
        {editing ? (
          <StudentForm
            student={editing}
            onCancel={() => setEditing(null)}
            onSave={(student) => {
              onSave(student)
              setEditing(null)
            }}
          />
        ) : selectedStudent ? (
          <>
            <StudentSnapshot student={selectedStudent} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="Email" value={selectedStudent.email} />
              <Info label="Telefone" value={selectedStudent.phone} />
              <Info label="Peso atual" value={selectedStudent.weight} />
              <Info label="Plano" value={selectedStudent.plan} />
              <Info label="Pagamento" value={selectedStudent.payment} />
              <Info label="Próximo check-in" value={selectedStudent.nextCheckin} />
            </div>
            <button onClick={() => setEditing(selectedStudent)} className="mt-5 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              Editar aluno
            </button>
          </>
        ) : (
          <Empty text="Nenhum aluno selecionado." />
        )}
      </Panel>
    </div>
  )
}

function StudentForm({ student, onSave, onCancel }) {
  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSave({
      ...student,
      name: form.get('name').toString(),
      email: form.get('email').toString(),
      phone: form.get('phone').toString(),
      goal: form.get('goal').toString(),
      phase: form.get('phase').toString(),
      status: form.get('status').toString(),
      plan: form.get('plan').toString(),
      payment: form.get('payment').toString(),
      adherence: Number(form.get('adherence')),
      risk: form.get('risk').toString(),
      nextCheckin: form.get('nextCheckin').toString(),
      weight: form.get('weight').toString(),
      bodyFat: form.get('bodyFat').toString(),
      calories: form.get('calories').toString(),
      protein: form.get('protein').toString(),
      workout: form.get('workout').toString(),
      lastMessage: form.get('lastMessage').toString(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" defaultValue={student.name} />
        <Field label="Email" name="email" defaultValue={student.email} />
        <Field label="Telefone" name="phone" defaultValue={student.phone} />
        <Field label="Objetivo" name="goal" defaultValue={student.goal} />
        <Field label="Fase" name="phase" defaultValue={student.phase} />
        <Select label="Status" name="status" defaultValue={student.status} options={['Em dia', 'Atrasado', 'Atencao']} />
        <Select label="Plano" name="plan" defaultValue={student.plan} options={plans.map((plan) => plan.name)} />
        <Select label="Pagamento" name="payment" defaultValue={student.payment} options={['Pago', 'Pendente']} />
        <Field label="Aderência" name="adherence" type="number" defaultValue={student.adherence} />
        <Select label="Risco" name="risk" defaultValue={student.risk} options={['Baixo', 'Medio', 'Alto']} />
        <Field label="Próximo check-in" name="nextCheckin" defaultValue={student.nextCheckin} />
        <Field label="Peso" name="weight" defaultValue={student.weight} />
        <Field label="Gordura corporal" name="bodyFat" defaultValue={student.bodyFat} />
        <Field label="Calorias" name="calories" defaultValue={student.calories} />
        <Field label="Proteína" name="protein" defaultValue={student.protein} />
        <Field label="Treino atual" name="workout" defaultValue={student.workout} />
      </div>
      <TextArea label="Última observação" name="lastMessage" defaultValue={student.lastMessage} />
      <div className="flex flex-wrap gap-3">
        <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">Salvar aluno</button>
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
  const student = students.find((item) => String(item.id) === String(studentId)) ?? selectedStudent
  const studentAssessments = assessments
    .filter((assessment) => String(assessment.studentId) === String(student?.id))
    .slice()
    .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    await onSaveAssessment({
      studentId: form.get('studentId').toString(),
      assessedAt: form.get('assessedAt').toString(),
      weightKg: form.get('weightKg').toString(),
      heightCm: form.get('heightCm').toString(),
      bodyFatPercent: form.get('bodyFatPercent').toString(),
      waistCm: form.get('waistCm').toString(),
      abdomenCm: form.get('abdomenCm').toString(),
      hipCm: form.get('hipCm').toString(),
      chestCm: form.get('chestCm').toString(),
      armCm: form.get('armCm').toString(),
      thighCm: form.get('thighCm').toString(),
      calfCm: form.get('calfCm').toString(),
      restingHeartRate: form.get('restingHeartRate').toString(),
      notes: form.get('notes').toString(),
    })
    setSaving(false)
  }

  return (
    <div className="grid gap-4 lg:gap-6">
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Nova avaliacao" action="Medidas corporais">
          {students.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Aluno
                <select
                  name="studentId"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
                >
                  {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data da avaliacao" name="assessedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Field label="Peso (kg)" name="weightKg" type="number" defaultValue={parseMetric(student?.weight)} />
                <Field label="Altura (cm)" name="heightCm" type="number" defaultValue="175" />
                <Field label="Gordura corporal (%)" name="bodyFatPercent" type="number" defaultValue={parseMetric(student?.bodyFat)} required={false} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Cintura (cm)" name="waistCm" type="number" required={false} />
                <Field label="Abdomen (cm)" name="abdomenCm" type="number" required={false} />
                <Field label="Quadril (cm)" name="hipCm" type="number" required={false} />
                <Field label="Peitoral (cm)" name="chestCm" type="number" required={false} />
                <Field label="Braco (cm)" name="armCm" type="number" required={false} />
                <Field label="Coxa (cm)" name="thighCm" type="number" required={false} />
                <Field label="Panturrilha (cm)" name="calfCm" type="number" required={false} />
                <Field label="FC repouso" name="restingHeartRate" type="number" required={false} />
              </div>
              <TextArea label="Parecer do coach" name="notes" defaultValue="Registrar evolucao, pontos de atencao e proximo objetivo." />
              <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
                {saving ? 'Salvando...' : 'Salvar avaliacao'}
              </button>
            </form>
          ) : (
            <Empty text="Cadastre um aluno antes de registrar avaliacoes." />
          )}
        </Panel>

        <Panel title={`Evolucao - ${student?.name ?? 'Aluno'}`} action={`${studentAssessments.length} registros`}>
          <AssessmentProgress assessments={studentAssessments} student={student} detailed />
        </Panel>
      </div>

      <Panel title="Historico de avaliacoes" action="Comparativo">
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
            <Empty text="Nenhuma avaliacao registrada para este aluno." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function AssessmentProgress({ assessments, student, detailed = false }) {
  const ordered = assessments.slice().sort((a, b) => new Date(a.assessedAt) - new Date(b.assessedAt))
  const latest = ordered.at(-1)
  const first = ordered[0]
  const chartData = ordered.map((assessment) => ({
    label: formatShortDate(assessment.assessedAt),
    peso: assessment.weightKg,
    gordura: assessment.bodyFatPercent,
    cintura: assessment.waistCm,
  }))

  if (!latest) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Peso atual" value={student?.weight ?? '-'} />
        <Info label="Gordura corporal" value={student?.bodyFat ?? '-'} />
        <Empty text="A evolucao detalhada aparecera depois da primeira avaliacao." />
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
      {detailed && chartData.length > 1 ? (
        <ChartWrap>
          <LineChart data={chartData} margin={{ left: -18, right: 8, top: 10 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
            <XAxis dataKey="label" stroke="#a1a1aa" />
            <YAxis stroke="#a1a1aa" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="peso" name="Peso" stroke="#34d399" strokeWidth={3} />
            <Line type="monotone" dataKey="gordura" name="Gordura" stroke="#fbbf24" strokeWidth={3} />
          </LineChart>
        </ChartWrap>
      ) : null}
      <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-normal text-emerald-200">Leitura da evolucao</p>
        <p className="mt-2 text-sm leading-6 text-zinc-200">{insight}</p>
      </div>
    </div>
  )
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
        <AssessmentValue label="Braco" value={assessment.armCm} suffix=" cm" previous={previous?.armCm} />
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

function Workouts({ selectedStudent, students, workouts, workoutLogs, onSaveWorkout }) {
  const studentWorkouts = workouts.filter((workout) => String(workout.studentId) === String(selectedStudent?.id))
  const studentLogs = workoutLogs.filter((log) => String(log.studentId) === String(selectedStudent?.id))

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Panel title={`Prescrever treino - ${selectedStudent?.name ?? 'Aluno'}`} action="Novo plano">
        <WorkoutForm students={students} selectedStudent={selectedStudent} onSaveWorkout={onSaveWorkout} />
      </Panel>

      <Panel title="Treinos prescritos" action={`${studentWorkouts.length} ativos`}>
        <WorkoutList workouts={studentWorkouts} fallbackTitle={selectedStudent?.workout} />
      </Panel>

      <Panel title="Histórico de execução" action={`${studentLogs.length} registros`}>
        <WorkoutLogList logs={studentLogs} />
      </Panel>
    </div>
  )
}

function WorkoutForm({ students, selectedStudent, onSaveWorkout }) {
  const [exercises, setExercises] = useState([
    { name: 'Supino reto', sets: '4', reps: '8-10', load: 'RPE 8', rest: '90s' },
    { name: 'Remada baixa', sets: '4', reps: '10-12', load: 'RPE 8', rest: '90s' },
    { name: 'Desenvolvimento', sets: '3', reps: '8-10', load: 'RPE 7', rest: '75s' },
  ])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateExercise(index, field, value) {
    setExercises((current) => current.map((exercise, itemIndex) => (
      itemIndex === index ? { ...exercise, [field]: value } : exercise
    )))
  }

  function addExercise() {
    setExercises((current) => [...current, { name: '', sets: '3', reps: '10', load: '', rest: '60s' }])
  }

  function removeExercise(index) {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const filledExercises = exercises.filter((exercise) => exercise.name.trim())

    setSaving(true)
    setMessage('')
    await onSaveWorkout({
      studentId: form.get('studentId').toString(),
      title: form.get('title').toString(),
      focus: form.get('focus').toString(),
      notes: form.get('notes').toString(),
      exercises: filledExercises,
    })
    setSaving(false)
    setMessage('Treino salvo e adicionado na lista.')
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

      <div className="space-y-3">
        {exercises.map((exercise, index) => (
          <div key={index} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.8fr_0.6fr_auto]">
              <InlineInput label="Exercício" value={exercise.name} onChange={(value) => updateExercise(index, 'name', value)} />
              <InlineInput label="Series" value={exercise.sets} onChange={(value) => updateExercise(index, 'sets', value)} />
              <InlineInput label="Reps" value={exercise.reps} onChange={(value) => updateExercise(index, 'reps', value)} />
              <InlineInput label="Carga" value={exercise.load} onChange={(value) => updateExercise(index, 'load', value)} />
              <InlineInput label="Descanso" value={exercise.rest} onChange={(value) => updateExercise(index, 'rest', value)} />
              <button type="button" onClick={() => removeExercise(index)} className="self-end rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-100">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addExercise} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
          Adicionar exercicio
        </button>
        <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          {saving ? 'Salvando...' : 'Salvar treino'}
        </button>
      </div>
      {message ? (
        <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-200">
          {message}
        </p>
      ) : null}
    </form>
  )
}

function WorkoutList({ workouts, fallbackTitle }) {
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-black">{workout.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">{workout.focus}</p>
              {workout.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{workout.notes}</p> : null}
            </div>
            <span className="rounded border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
              Ativo
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {workout.exercises.map((exercise) => (
              <Row
                key={exercise.id ?? exercise.name}
                title={exercise.name}
                meta={`${exercise.sets} series x ${exercise.reps} reps | carga: ${exercise.load || '-'} | descanso: ${exercise.rest || '-'}`}
                badge="Exercício"
              />
            ))}
          </div>
        </div>
      ))}
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
            <span className="rounded border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
              Feito
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

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setSaving(true)
    setMessage('')
    await onCompleteWorkout({
      coachId: workout.coachId,
      studentId: student.id,
      workoutId: workout.id,
      title: workout.title,
      effort: form.get('effort').toString(),
      notes: form.get('notes').toString(),
    })
    setSaving(false)
    setMessage('Treino marcado como concluído.')
    event.currentTarget.reset()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/5 p-4">
      <Select label="Esforço percebido" name="effort" defaultValue="Moderado" options={['Leve', 'Moderado', 'Forte', 'Muito forte']} />
      <TextArea label="Observação do treino" name="notes" defaultValue="Carga usada, dificuldade, dor, energia ou algo importante." />
      <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
        {saving ? 'Salvando...' : 'Marcar treino como concluído'}
      </button>
      {message ? <p className="text-sm font-bold text-emerald-200">{message}</p> : null}
    </form>
  )
}

function Nutrition({ selectedStudent, students, nutritionPlans, onSaveNutritionPlan }) {
  const studentPlans = nutritionPlans.filter((plan) => String(plan.studentId) === String(selectedStudent?.id))

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel title={`Prescrever dieta - ${selectedStudent?.name ?? 'Aluno'}`} action={`${foodDatabase.length}+ alimentos`}>
        <NutritionForm students={students} selectedStudent={selectedStudent} onSaveNutritionPlan={onSaveNutritionPlan} />
      </Panel>

      <Panel title="Dietas prescritas" action={`${studentPlans.length} ativas`}>
        <NutritionPlanList plans={studentPlans} selectedStudent={selectedStudent} />
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
          currentItemIndex === itemIndex ? normalizeNutritionItem(nextItem) : item
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
            .map((item) => `${item.foodName} (${item.grams}g)`)
            .join(', '),
          macros: formatMacroSummary(totals),
        }
      })

    setSaving(true)
    setMessage('')
    await onSaveNutritionPlan({
      studentId: form.get('studentId').toString(),
      title: form.get('title').toString(),
      calories: `${Math.round(planTotals.calories)} kcal`,
      protein: `${roundMacro(planTotals.protein)} g`,
      notes: form.get('notes').toString(),
      meals: filledMeals,
    })
    setSaving(false)
    setMessage('Dieta salva com macros calculados automaticamente.')
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
        <p className="font-black text-emerald-100">Assistente inteligente de alimentos</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">
          Digite o alimento e a quantidade. O FIT COACH procura na biblioteca, reconhece nomes semelhantes e preenche kcal, proteína, carboidratos, gordura, fibra e sódio automaticamente.
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
        <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          {saving ? 'Salvando...' : 'Salvar dieta'}
        </button>
      </div>
      {message ? (
        <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-200">
          {message}
        </p>
      ) : null}
    </form>
  )
}

function NutritionPlanList({ plans, selectedStudent }) {
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-black">{plan.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">{plan.calories} | {plan.protein}</p>
              {plan.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{plan.notes}</p> : null}
            </div>
            <span className="rounded border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
              Ativa
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {plan.meals.map((meal) => (
              <div key={meal.id ?? meal.name} className="rounded-md border border-white/10 bg-zinc-950/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h5 className="font-black">{meal.time ? `${meal.time} - ` : ''}{meal.name}</h5>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{meal.foods}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
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
  const recognition = recognizeFood(item.foodName)
  const recognizedFood = recognition.food
  const manualMode = item.mode === 'manual'
  const estimatedFood = !recognizedFood ? estimateFoodMacros(item.foodName, item.category) : null
  const intelligence = recognizedFood
    ? { label: recognition.matchType === 'exact' ? 'Encontrado na base' : 'Reconhecido por nome semelhante', confidence: recognition.confidence }
    : { label: estimatedFood?._source === 'rule' ? 'Estimativa inteligente' : 'Estimativa pela categoria', confidence: estimatedFood?._confidence ?? 0.45 }

  function setFoodName(value) {
    const recognized = recognizeFood(value).food
    const estimate = recognized ? null : estimateFoodMacros(value, item.category)
    onChange({
      ...item,
      foodName: value,
      category: recognized?.category ?? estimate?.category ?? item.category,
      mode: recognized ? 'database' : 'estimated',
      customMacros: recognized ? undefined : estimate ?? item.customMacros ?? emptyMacros(),
    })
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
          onChange={(value) => onChange({ ...item, category: value, foodName: foodDatabase.find((food) => food.category === value)?.name ?? item.foodName, mode: 'database' })}
        />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
          Alimento
          <input
            value={item.foodName}
            list="food-options"
            onChange={(event) => setFoodName(event.target.value)}
            placeholder="Ex.: tilápia grelhada, aveia ou feijoada"
            className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
          />
        </label>
        <InlineInput label="Gramas" value={item.grams} onChange={(value) => onChange({ ...item, grams: Number(value) || 0 })} />
        <button type="button" onClick={onRemove} className="self-end rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-100">
          Remover
        </button>
      </div>

      <datalist id="food-options">
        {foodDatabase.map((food) => <option key={`${food.category}-${food.name}`} value={food.name} />)}
      </datalist>

      <div className="mt-3 flex flex-col gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">
            {manualMode ? 'Ajustado manualmente' : intelligence.label}
          </p>
          <p className="mt-1 text-sm font-black text-emerald-50">
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
    </div>
  )
}

function Checkins({ checkins, students, onAddCheckin }) {
  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Novo check-in" action="Upload local">
        <CheckinForm students={students} onAddCheckin={onAddCheckin} />
      </Panel>

      <Panel title="Histórico de check-ins" action={`${checkins.length} registros`}>
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
  const studentCheckins = checkins.filter((item) => item.studentId === student?.id)
  const studentWorkouts = workouts.filter((workout) => String(workout.studentId) === String(student?.id))
  const studentNutritionPlans = nutritionPlans.filter((plan) => String(plan.studentId) === String(student?.id))
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
    return <Empty text="Cadastre ou selecione um aluno para visualizar a area do aluno." />
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
    }
    setCreatingInvite(false)
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title={`Portal do aluno - ${student.name}`} action="Previa do app">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="Objetivo" value={student.goal} />
          <Info label="Treino atual" value={student.workout} />
          <Info label="Próximo check-in" value={student.nextCheckin} />
        </div>

        <div className="mt-5 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-4">
          <p className="text-sm font-black text-emerald-200">{coachSettings?.publicName || 'Mensagem do coach'}</p>
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
                  Gere um codigo para o aluno acessar a area dele pela tela inicial.
                </p>
              </div>
              <button onClick={generateInvite} className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
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
                <p className="mt-2 text-sm text-zinc-300">Envie o link ou o codigo para o aluno.</p>
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

      <Panel title="Proximos compromissos" action={`${studentAppointments.length} agendados`}>
        <div className="grid gap-3">
          {studentAppointments.length ? (
            studentAppointments.slice(0, 4).map((appointment) => (
              <div key={appointment.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black">{appointment.title}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{appointment.type} - {appointment.durationMinutes} min</p>
                    <p className="mt-2 text-sm font-bold text-emerald-200">{formatFullDateTime(appointment.startsAt)}</p>
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

      <Panel title="Financeiro" action={`${studentInvoices.length} cobrancas`}>
        <div className="grid gap-3">
          {studentInvoices.length ? (
            studentInvoices.slice(0, 4).map((invoice) => (
              <div key={invoice.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black">{invoice.planName}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{invoice.description || 'Mensalidade do acompanhamento'}</p>
                    <p className="mt-2 text-lg font-black text-emerald-200">{formatCurrency(invoice.amount)}</p>
                    <p className="mt-1 text-sm text-zinc-400">Vencimento: {formatDate(invoice.dueDate)}</p>
                  </div>
                  <InvoiceStatus status={invoice.status} />
                </div>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma cobranca registrada." />
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
        <AssessmentProgress assessments={studentAssessments} student={student} />
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

function StudentMessagePanel({ student, coachId, messages, onSendMessage }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const orderedMessages = messages
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))

  async function handleSubmit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !onSendMessage) return

    setSending(true)
    await onSendMessage({
      coachId,
      studentId: student.id,
      sender: 'student',
      body,
    })
    setDraft('')
    setSending(false)
  }

  return (
    <div>
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {orderedMessages.length ? (
          orderedMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md border p-4 ${
                message.sender === 'student'
                  ? 'ml-auto max-w-[92%] border-emerald-300/30 bg-emerald-300/10'
                  : 'mr-auto max-w-[92%] border-white/10 bg-white/[0.04]'
              }`}
            >
              <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{message.sender === 'student' ? 'Você' : 'Coach'}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{message.body}</p>
              <p className="mt-2 text-xs text-zinc-500">{formatDateTime(message.createdAt)}</p>
            </div>
          ))
        ) : (
          <Empty text="Nenhuma mensagem ainda." />
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Responder ao coach..."
          className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
        />
        <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
          {sending ? 'Enviando...' : 'Enviar resposta'}
        </button>
      </form>
    </div>
  )
}

function StudentConsent({ access, onAccept, onExit, error }) {
  const [accepting, setAccepting] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    await onAccept()
    setAccepting(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-2xl rounded-md border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
        <BrandLockup subtitle={`por ${access.coachSettings?.brandName || access.coachSettings?.publicName || 'seu treinador'}`} />
        <div className="mt-7 h-px bg-white/10" />
        <h1 className="mt-2 text-3xl font-black">Consentimento de dados</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Ola, {access.student.name}. Antes de acessar seu acompanhamento, precisamos registrar sua autorizacao.
        </p>

        <div className="mt-6 grid gap-3">
          {[
            'Dados de cadastro, treinos, dieta e comunicacao.',
            'Peso, medidas corporais, fotos e informacoes de saude fornecidas por voce.',
            'Uso dos dados exclusivamente para acompanhamento pelo seu treinador.',
            'Possibilidade de solicitar correcao ou exclusao dos seus dados ao treinador.',
          ].map((text) => (
            <div key={text} className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-300">
              {text}
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Ao continuar, voce confirma que leu e aceita o tratamento dessas informacoes para a prestacao do acompanhamento contratado.
        </p>
        {error ? <p className="mt-4 text-sm font-bold text-amber-200">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={handleAccept} className="flex-1 rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
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

function StudentAccessApp({ access, checkins, workouts, nutritionPlans, workoutLogs, messages, appointments, invoices, assessments, coachSettings, onCompleteWorkout, onAddCheckin, onSendMessage, onExit }) {
  const student = access.student
  const freshCheckins = checkins.filter((item) => String(item.studentId) === String(student.id))
  const studentCheckins = freshCheckins.length ? freshCheckins : access.checkins ?? []
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
    <div className="app-shell min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-950 p-3 text-zinc-100 sm:p-6">
      <div className="mx-auto min-w-0 max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <BrandLockup subtitle={`por ${coachSettings?.brandName || coachSettings?.publicName || 'seu treinador'}`} />
        </div>
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Área do aluno</p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">{student.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">{student.goal}</p>
          </div>
          <button onClick={onExit} className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
            Sair
          </button>
        </header>

        <StudentPortalPreview
          student={student}
          students={[student]}
          checkins={studentCheckins}
          workouts={workouts}
          nutritionPlans={nutritionPlans}
          workoutLogs={workoutLogs}
          messages={messages}
          appointments={appointments}
          invoices={invoices}
          assessments={assessments}
          coachSettings={coachSettings}
          onCompleteWorkout={completeStudentWorkout}
          onAddCheckin={addStudentCheckin}
          onSendMessage={sendStudentMessage}
          coachId={access.invite.coachId}
          onRemoteStatus={() => {}}
          onRemoteError={() => {}}
          canGenerateInvite={false}
        />
      </div>
    </div>
  )
}

function CheckinForm({ students, onAddCheckin }) {
  const [photo, setPhoto] = useState('')
  const [photoFile, setPhotoFile] = useState(null)

  function handlePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result.toString())
    reader.readAsDataURL(file)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onAddCheckin({
      studentId: form.get('studentId').toString(),
      type: form.get('type').toString(),
      due: form.get('due').toString(),
      state: form.get('state').toString(),
      weight: form.get('weight').toString(),
      note: form.get('note').toString(),
      photo,
      photoFile,
    })
    event.currentTarget.reset()
    setPhoto('')
    setPhotoFile(null)
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
      <Field label="Tipo" name="type" defaultValue="Fotos + peso" />
      <Field label="Prazo" name="due" defaultValue="Hoje" />
      <Select label="Status" name="state" defaultValue="Recebido" options={['Recebido', 'Pendente', 'Critico']} />
      <Field label="Peso informado" name="weight" defaultValue="84,0 kg" />
      <TextArea label="Observações" name="note" defaultValue="Registrar avaliação do coach." />
      <label className="grid gap-2 text-sm font-bold text-zinc-300">
        Foto do check-in
        <input type="file" accept="image/*" onChange={handlePhoto} className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-300" />
      </label>
      {photo ? <img src={photo} alt="Previa" className="h-44 rounded-md object-cover" /> : null}
      <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">Salvar check-in</button>
    </form>
  )
}

function Payments({ students, invoices, onSaveInvoice, onUpdateInvoiceStatus, onUpdatePayment }) {
  const [filter, setFilter] = useState('Todos')
  const [saving, setSaving] = useState(false)
  const paidTotal = invoices
    .filter((invoice) => invoice.status === 'Pago')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const pendingTotal = invoices
    .filter((invoice) => ['Pendente', 'Atrasado'].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const overdueCount = invoices.filter((invoice) => getInvoiceStatus(invoice) === 'Atrasado').length
  const visibleInvoices = invoices
    .map((invoice) => ({ ...invoice, status: getInvoiceStatus(invoice) }))
    .filter((invoice) => filter === 'Todos' || invoice.status === filter)
    .slice()
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const student = students.find((item) => String(item.id) === String(form.get('studentId')))
    const selectedPlan = plans.find((plan) => plan.name === form.get('planName'))

    setSaving(true)
    await onSaveInvoice({
      studentId: form.get('studentId').toString(),
      planName: form.get('planName').toString(),
      description: form.get('description').toString(),
      amount: Number(form.get('amount')),
      dueDate: form.get('dueDate').toString(),
      status: 'Pendente',
      paymentMethod: '',
    })
    if (student?.payment === 'Pago') {
      await onUpdatePayment(student.id, 'Pendente')
    }
    event.currentTarget.reset()
    setSaving(false)
  }

  return (
    <div className="grid gap-4 lg:gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Recebido" value={formatCurrency(paidTotal)} detail={`${invoices.filter((item) => item.status === 'Pago').length} pagamentos`} />
        <Metric label="A receber" value={formatCurrency(pendingTotal)} detail="pendentes e atrasados" />
        <Metric label="Em atraso" value={overdueCount} detail="cobrancas vencidas" />
      </section>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Gerar cobranca" action="Financeiro">
          {students.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Select label="Aluno" name="studentId" options={students.map((student) => ({ label: student.name, value: student.id }))} />
              <Select label="Plano" name="planName" defaultValue="Essential" options={plans.map((plan) => plan.name)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor (R$)" name="amount" type="number" defaultValue="197" />
                <Field label="Vencimento" name="dueDate" type="date" defaultValue={getDefaultDueDate()} />
              </div>
              <Field label="Descricao" name="description" defaultValue="Mensalidade do acompanhamento" />
              <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
                {saving ? 'Gerando...' : 'Gerar cobranca'}
              </button>
            </form>
          ) : (
            <Empty text="Cadastre um aluno antes de gerar cobrancas." />
          )}

          <div className="mt-5 grid gap-3">
            {plans.map((plan) => (
              <div key={plan.name} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black">{plan.name}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{plan.features}</p>
                  </div>
                  <span className="text-lg font-black text-emerald-300">{plan.price}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Historico de cobrancas" action={`${visibleInvoices.length} registros`}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {['Todos', 'Pendente', 'Pago', 'Atrasado', 'Cancelado'].map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-black ${
                  filter === option
                    ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
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
                        <p className="mt-3 text-xl font-black text-emerald-200">{formatCurrency(invoice.amount)}</p>
                        <p className="mt-1 text-sm text-zinc-400">Vence em {formatDate(invoice.dueDate)}</p>
                        {invoice.paidAt ? <p className="mt-1 text-xs text-zinc-500">Pago em {formatDateTime(invoice.paidAt)} via {invoice.paymentMethod || 'nao informado'}</p> : null}
                      </div>

                      {!['Pago', 'Cancelado'].includes(invoice.status) ? (
                        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-1">
                          <button onClick={() => onUpdateInvoiceStatus(invoice.id, 'Pago', 'Pix')} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950">
                            Marcar pago
                          </button>
                          <button onClick={() => onUpdateInvoiceStatus(invoice.id, 'Cancelado')} className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200">
                            Cancelar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <Empty text="Nenhuma cobranca encontrada neste filtro." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function InvoiceStatus({ status }) {
  const className = status === 'Pago'
    ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200'
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
        ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200'
        : 'border-amber-300/40 bg-amber-300/10 text-amber-200'
    }`}>
      {paid ? 'Pago' : 'Pendente'}
    </span>
  )
}

function Notifications({ notifications, onReadAll }) {
  return (
    <Panel title="Central de notificações" action={`${notifications.filter((item) => !item.read).length} não lidas`}>
      <button onClick={onReadAll} className="mb-4 rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
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
            <Empty text="Tudo em ordem com pagamentos, check-ins e prescricoes." />
          )}
        </div>
      </Panel>

      <Panel title="Central de notificacoes" action={`${unread} nao lidas`}>
        <button onClick={onReadAll} className="mb-4 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950 sm:w-auto">
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
            <Empty text="Nenhuma notificacao registrada ainda." />
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
    Baixo: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  }[alert.priority] ?? 'border-white/10 bg-white/[0.03] text-zinc-100'

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-950/30 px-2 py-1 text-[11px] font-black uppercase tracking-normal">{alert.type}</span>
            <span className="text-xs font-black">{alert.priority}</span>
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

function CoachSettings({ user, settings, onSave, onExport }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const current = {
    brandName: settings?.brandName || 'FitCoach',
    publicName: settings?.publicName || user?.name || '',
    cref: settings?.cref || '',
    whatsapp: settings?.whatsapp || '',
    supportEmail: settings?.supportEmail || user?.email || '',
    welcomeMessage: settings?.welcomeMessage || 'Mantenha o plano, registre seu treino e use o check-in para me contar como voce esta evoluindo.',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setMessage('')
    await onSave({
      brandName: form.get('brandName').toString().trim(),
      publicName: form.get('publicName').toString().trim(),
      cref: form.get('cref').toString().trim(),
      whatsapp: form.get('whatsapp').toString().trim(),
      supportEmail: form.get('supportEmail').toString().trim(),
      welcomeMessage: form.get('welcomeMessage').toString().trim(),
      timezone: form.get('timezone').toString(),
    })
    setSaving(false)
    setMessage('Configuracoes profissionais atualizadas.')
  }

  const readiness = [
    { label: 'Nome profissional', ready: Boolean(settings?.publicName) },
    { label: 'Marca do treinador', ready: Boolean(settings?.brandName) },
    { label: 'WhatsApp de suporte', ready: Boolean(settings?.whatsapp) },
    { label: 'Registro profissional', ready: Boolean(settings?.cref) },
    { label: 'Mensagem para alunos', ready: Boolean(settings?.welcomeMessage) },
  ]

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Panel title="Identidade profissional" action="Conta do treinador">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da marca" name="brandName" defaultValue={current.brandName} />
            <Field label="Nome publico" name="publicName" defaultValue={current.publicName} />
            <Field label="CREF ou registro" name="cref" defaultValue={current.cref} required={false} />
            <Field label="WhatsApp" name="whatsapp" defaultValue={current.whatsapp} required={false} />
            <Field label="Email de suporte" name="supportEmail" type="email" defaultValue={current.supportEmail} />
            <Select
              label="Fuso horario"
              name="timezone"
              defaultValue={current.timezone}
              options={[
                { label: 'Brasilia', value: 'America/Sao_Paulo' },
                { label: 'Manaus', value: 'America/Manaus' },
                { label: 'Fortaleza', value: 'America/Fortaleza' },
                { label: 'Rio Branco', value: 'America/Rio_Branco' },
              ]}
            />
          </div>
          <TextArea label="Mensagem de boas-vindas para alunos" name="welcomeMessage" defaultValue={current.welcomeMessage} />
          <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
            {saving ? 'Salvando...' : 'Salvar configuracoes'}
          </button>
          {message ? <p className="text-sm font-bold text-emerald-200">{message}</p> : null}
        </form>
      </Panel>

      <div className="grid gap-4 lg:gap-6">
        <Panel title="Como o aluno ve" action="Previa">
          <p className="text-xs font-bold uppercase tracking-normal text-emerald-300">Acompanhamento online</p>
          <h3 className="mt-2 text-3xl font-black">{current.brandName}</h3>
          <p className="mt-2 text-sm text-zinc-400">{current.publicName}{current.cref ? ` - ${current.cref}` : ''}</p>
          <div className="mt-5 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
            <p className="text-sm font-black text-emerald-200">Mensagem do treinador</p>
            <p className="mt-2 text-sm leading-6 text-zinc-200">{current.welcomeMessage}</p>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-zinc-400">
            <p>{current.whatsapp || 'WhatsApp ainda nao informado'}</p>
            <p>{current.supportEmail}</p>
          </div>
        </Panel>

        <Panel title="Prontidao da conta" action={`${readiness.filter((item) => item.ready).length}/${readiness.length}`}>
          <div className="grid gap-2">
            {readiness.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] p-3">
                <span className="text-sm font-bold">{item.label}</span>
                <span className={`text-xs font-black ${item.ready ? 'text-emerald-300' : 'text-amber-300'}`}>
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

function Messages({ tone, students, messages, onSendMessage }) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const selectedStudent = students.find((student) => String(student.id) === String(selectedStudentId)) ?? students[0]
  const studentMessages = messages
    .filter((message) => String(message.studentId) === String(selectedStudent?.id))
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))
  const suggestion = buildMessageSuggestion(selectedStudent, tone)

  async function handleSubmit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selectedStudent) return

    setSending(true)
    await onSendMessage({
      studentId: selectedStudent.id,
      sender: 'coach',
      body,
    })
    setDraft('')
    setSending(false)
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
                    ? 'border-emerald-400 bg-emerald-400/10'
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

      <Panel title={selectedStudent ? `Mensagem para ${selectedStudent.name}` : 'Mensagem'} action={tone}>
        <div className="mb-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-normal text-emerald-200">Resposta sugerida</p>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{suggestion}</p>
          <button onClick={() => setDraft(suggestion)} className="mt-3 rounded-md border border-emerald-300/30 px-3 py-2 text-xs font-black text-emerald-100">
            Usar sugestao
          </button>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {studentMessages.length ? (
            studentMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border p-4 ${
                  message.sender === 'coach'
                    ? 'ml-auto max-w-[92%] border-emerald-300/30 bg-emerald-300/10'
                    : 'mr-auto max-w-[92%] border-white/10 bg-white/[0.04]'
                }`}
              >
                <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{message.sender === 'coach' ? 'Coach' : 'Aluno'}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-200">{message.body}</p>
                <p className="mt-2 text-xs text-zinc-500">{formatDateTime(message.createdAt)}</p>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma mensagem nesta conversa ainda." />
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Escreva a mensagem para o aluno..."
            className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
          />
          <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-zinc-950">
            {sending ? 'Enviando...' : 'Enviar mensagem'}
          </button>
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
    goal: 'Hipertrofia',
    phase: 'Inicio',
    status: 'Em dia',
    plan: 'Essential',
    payment: 'Pendente',
    adherence: 80,
    risk: 'Baixo',
    nextCheckin: 'Sexta, 08:00',
    weight: '80 kg',
    bodyFat: '15%',
    calories: '2.400 kcal',
    protein: '160 g',
    workout: 'Full body',
    lastMessage: 'Novo aluno cadastrado.',
  }
}

const tooltipStyle = { background: '#18181b', border: '1px solid #3f3f46', color: '#f4f4f5' }

function ChartWrap({ children }) {
  return (
    <div className="h-64 min-w-0 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function BrandLockup({ subtitle = '', dark = false, large = false }) {
  const foreground = dark ? 'text-zinc-950' : 'text-zinc-50'
  const accent = dark ? 'bg-zinc-950 text-emerald-300' : 'bg-emerald-400 text-zinc-950'
  const secondary = dark ? 'text-zinc-950/65' : 'text-zinc-500'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`grid shrink-0 place-items-center rounded-md font-black ${accent} ${large ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm'}`}>
        FC
      </span>
      <span className="min-w-0">
        <span className={`block whitespace-nowrap font-black leading-none ${foreground} ${large ? 'text-3xl' : 'text-xl'}`}>
          FIT <span className={dark ? 'text-zinc-950/65' : 'text-emerald-400'}>COACH</span>
        </span>
        {subtitle ? (
          <span className={`mt-1 block truncate text-xs font-bold ${secondary}`}>{subtitle}</span>
        ) : null}
      </span>
    </div>
  )
}

function Metric({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <h3 className="mt-2 break-words text-2xl font-black sm:mt-3 sm:text-3xl">{value}</h3>
      <p className="mt-2 text-xs font-semibold text-emerald-300">{detail}</p>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h3 className="text-base font-black sm:text-lg">{title}</h3>
        <span className="w-fit rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-zinc-300">{action}</span>
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
          <p className="mt-1 text-sm text-zinc-400">{student.goal}</p>
        </div>
        <Badge tone={student.risk}>{student.risk}</Badge>
      </div>
      <div className="mt-5 h-2 rounded bg-zinc-800">
        <div className="h-2 rounded bg-emerald-400" style={{ width: `${student.adherence}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span>Aderência</span>
        <span>{student.adherence}%</span>
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
        <span className="w-fit shrink-0 rounded border border-white/10 px-2 py-1 text-xs font-bold text-zinc-300">{badge}</span>
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

function Field({ label, name, type = 'text', defaultValue = '', required = true }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-300">
      {label}
      <input
        name={name}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        defaultValue={defaultValue}
        required={required}
        className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
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
        className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
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
        className="min-h-10 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
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
        className="min-h-11 min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
      >
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const labelText = typeof option === 'string' ? option : option.label
          return <option key={value} value={value}>{labelText}</option>
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
        className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-400 sm:text-sm"
      />
    </label>
  )
}

function buildSmartAlerts(students, checkins, workouts, nutritionPlans, appointments = [], invoices = [], assessments = []) {
  const alerts = []
  const priorityScore = { Alto: 0, Medio: 1, Baixo: 2 }

  students.forEach((student) => {
    const studentId = String(student.id)
    const hasWorkout = workouts.some((workout) => String(workout.studentId) === studentId)
    const hasNutrition = nutritionPlans.some((plan) => String(plan.studentId) === studentId)
    const adherence = Number(student.adherence || 0)

    if (student.payment === 'Pendente') {
      alerts.push({
        id: `payment-${student.id}`,
        type: 'Financeiro',
        priority: 'Alto',
        title: `${student.name} esta com pagamento pendente`,
        body: `${student.plan} precisa de acompanhamento para evitar atraso de renovacao.`,
        action: 'Abrir pagamentos',
        view: 'pagamentos',
      })
    }

    if (student.status === 'Atrasado' || student.risk === 'Alto' || adherence < 75) {
      alerts.push({
        id: `risk-${student.id}`,
        type: 'Acompanhamento',
        priority: student.risk === 'Alto' || adherence < 70 ? 'Alto' : 'Medio',
        title: `${student.name} precisa de atencao`,
        body: `Status ${student.status}, risco ${student.risk} e aderencia de ${adherence || 0}%.`,
        action: 'Abrir alunos',
        view: 'alunos',
      })
    }

    if (!hasWorkout) {
      alerts.push({
        id: `workout-${student.id}`,
        type: 'Treino',
        priority: 'Medio',
        title: `${student.name} ainda nao tem treino salvo`,
        body: 'Prescreva um treino para liberar o plano na area do aluno.',
        action: 'Abrir treinos',
        view: 'treinos',
      })
    }

    if (!hasNutrition) {
      alerts.push({
        id: `nutrition-${student.id}`,
        type: 'Nutricao',
        priority: 'Medio',
        title: `${student.name} ainda nao tem dieta salva`,
        body: 'Crie uma dieta com macros calculados para acompanhar a meta do aluno.',
        action: 'Abrir nutricao',
        view: 'nutricao',
      })
    }

    const latestAssessment = assessments
      .filter((assessment) => String(assessment.studentId) === studentId)
      .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))[0]
    const assessmentAge = latestAssessment
      ? (Date.now() - new Date(`${latestAssessment.assessedAt}T12:00:00`).getTime()) / (24 * 60 * 60 * 1000)
      : null

    if (!latestAssessment || assessmentAge > 30) {
      alerts.push({
        id: `assessment-${student.id}`,
        type: 'Avaliacao',
        priority: latestAssessment ? 'Medio' : 'Alto',
        title: latestAssessment ? `${student.name} precisa ser reavaliado` : `${student.name} ainda nao tem avaliacao`,
        body: latestAssessment
          ? `Ultima avaliacao em ${formatDate(latestAssessment.assessedAt)}.`
          : 'Registre as medidas iniciais para criar uma linha de evolucao.',
        action: 'Abrir avaliacoes',
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
        title: `${student?.name ?? 'Aluno'} tem check-in ${String(checkin.state).toLowerCase()}`,
        body: `${checkin.type} - ${checkin.due}. ${checkin.note || 'Revise o retorno e registre o proximo ajuste.'}`,
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
        body: `${formatDateTime(appointment.startsAt)} - ${appointment.location || 'Local nao informado'}.`,
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
        title: `${student?.name ?? 'Aluno'} tem cobranca atrasada`,
        body: `${formatCurrency(invoice.amount)} venceu em ${formatDate(invoice.dueDate)}.`,
        action: 'Abrir pagamentos',
        view: 'pagamentos',
      })
    })

  return alerts
    .sort((a, b) => priorityScore[a.priority] - priorityScore[b.priority] || a.type.localeCompare(b.type))
    .slice(0, 12)
}

function buildMessageSuggestion(student, tone) {
  if (!student) return 'Me envie seu retorno de hoje com treino, dieta, sono e fome para eu ajustar seu plano.'

  const base = {
    Firme: `Recebi, ${student.name}. Vamos manter o plano sem improvisar: siga a meta de ${student.protein}, registre o treino ${student.workout} e me envie o check-in no prazo ${student.nextCheckin}.`,
    Tecnico: `Boa, ${student.name}. Pelo objetivo de ${student.goal}, vou acompanhar aderencia, peso e resposta ao treino. Mantenha ${student.calories}, ${student.protein} e detalhe fome, sono e performance no proximo check-in.`,
    Motivador: `Perfeito, ${student.name}. Continua no processo: cada check-in ajuda a ajustar melhor o plano. Hoje foca em cumprir o treino ${student.workout}, bater a proteina e me avisar qualquer dificuldade.`,
  }

  return base[tone] ?? base.Firme
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
  const food = item.mode === 'manual' ? null : findFoodByName(item.foodName)
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

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFullDateTime(value) {
  if (!value) return 'Data nao informada'

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value) {
  if (!value) return 'Sem data'

  const normalized = String(value).length === 10 ? `${value}T12:00:00` : value
  return new Intl.DateTimeFormat('pt-BR').format(new Date(normalized))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value))
}

function formatShortDate(value) {
  if (!value) return ''
  const normalized = String(value).length === 10 ? `${value}T12:00:00` : value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(normalized))
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
  if (!first || !latest) return 'Registre novas avaliacoes para formar uma leitura comparativa.'
  if (String(first.id) === String(latest.id)) {
    return 'Avaliacao inicial registrada. Ela sera a base para os proximos comparativos.'
  }

  const weightChange = Number(latest.weightKg || 0) - Number(first.weightKg || 0)
  const fatChange = Number(latest.bodyFatPercent || 0) - Number(first.bodyFatPercent || 0)
  const waistChange = Number(latest.waistCm || 0) - Number(first.waistCm || 0)
  const parts = []

  if (first.weightKg && latest.weightKg) parts.push(`peso ${describeChange(weightChange, 'kg')}`)
  if (first.bodyFatPercent && latest.bodyFatPercent) parts.push(`gordura corporal ${describeChange(fatChange, 'p.p.')}`)
  if (first.waistCm && latest.waistCm) parts.push(`cintura ${describeChange(waistChange, 'cm')}`)

  return parts.length
    ? `Desde a primeira avaliacao: ${parts.join(', ')}. Use a tendencia junto da performance e aderencia para decidir o proximo ajuste.`
    : 'As avaliacoes existem, mas ainda faltam medidas equivalentes para gerar um comparativo.'
}

function describeChange(value, unit) {
  const absolute = formatNumber(Math.abs(value))
  if (Math.abs(value) < 0.05) return `manteve (${absolute} ${unit})`
  return value > 0 ? `subiu ${absolute} ${unit}` : `reduziu ${absolute} ${unit}`
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

function Badge({ tone, children }) {
  const className =
    tone === 'Alto'
      ? 'border-red-300/40 bg-red-400/10 text-red-200'
      : tone === 'Medio'
        ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
        : 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200'

  return <span className={`rounded border px-2 py-1 text-xs font-black ${className}`}>{children}</span>
}
