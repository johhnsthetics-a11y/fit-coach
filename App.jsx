import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import fitCoachLogo from './fit-coach-logo.png'
import {
  acceptRemoteStudentConsent,
  archiveRemoteNutritionPlan,
  archiveRemoteWorkout,
  createRemoteStudentInvite,
  deleteRemoteStudent,
  loadRemoteData,
  loadRemoteMessages,
  loadRemoteStudentMessagesByInvite,
  loadRemoteStudentMessages,
  loadRemoteStudentByInvite,
  markRemoteStudentMessagesRead,
  markRemoteNotificationsRead,
  requestCoachPasswordReset,
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
const productionWithoutSupabase = import.meta.env.PROD && !supabaseEnabled

const plans = [
  { name: 'Essential', price: 'R$ 197', features: 'Treino, dieta e 1 check-in semanal' },
  { name: 'Performance', price: 'R$ 347', features: 'Ajustes semanais, suporte e análise de vídeos' },
  { name: 'Elite', price: 'R$ 597', features: 'Acompanhamento premium, chamadas e revisões completas' },
]

const navItems = [
  { id: 'visao', label: 'Visão geral', icon: '01' },
  { id: 'agenda', label: 'Agenda', icon: '02' },
  { id: 'alunos', label: 'Alunos', icon: '03' },
  { id: 'avaliacoes', label: 'Avaliações', icon: '04' },
  { id: 'treinos', label: 'Treinos', icon: '05' },
  { id: 'nutricao', label: 'Nutrição', icon: '06' },
  { id: 'checkins', label: 'Check-ins', icon: '07' },
  { id: 'pagamentos', label: 'Recebimentos', icon: '08' },
  { id: 'notificacoes', label: 'Notificações', icon: '09' },
  { id: 'mensagens', label: 'Mensagens', icon: '10' },
  { id: 'aluno-app', label: 'Área do aluno', icon: '11' },
  { id: 'configuracoes', label: 'Configurações', icon: '12' },
  { id: 'assinatura', label: 'Minha assinatura', icon: '13' },
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
  const [tone, setTone] = useState('Firme')
  const [studentAccess, setStudentAccess] = useState(null)
  const [recoveryAccessToken, setRecoveryAccessToken] = useState(() => getRecoveryAccessToken())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [billingClock, setBillingClock] = useState(Date.now())
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
  const totalAlertCount = unreadCount + smartAlerts.length
  const coachBillingCycle = getCoachBillingCycle(data.coachSubscription, data.user?.createdAt, billingClock)
  const coachSubscriptionActive = isCoachSubscriptionActive(data.coachSubscription)
  const shouldLockCoachTools = Boolean(data.user && supabaseEnabled && !coachSubscriptionActive)

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
    if (shouldLockCoachTools && activeView !== 'assinatura') {
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
        handleRemoteError(error, 'Erro ao concluir treino')
        throw error
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
      body: message.body?.trim() || (localAttachmentUrl ? 'Foto enviada' : ''),
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

  if (salesPreview) {
    return (
      <LoginScreen
        onLogin={login}
        onStudentAccess={enterStudentByInvite}
        remoteStatus={remoteStatus}
        remoteError={remoteError}
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
      />
    )
  }

  if (supabaseEnabled && remoteStatus === 'Conectando Supabase') {
    return <AppLoading />
  }

  const viewTitle = navItems.find((item) => item.id === activeView)?.label ?? 'Visão geral'

  return (
    <div className="app-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-3 py-2 backdrop-blur-xl lg:hidden">
        <BrandLockup compact subtitle="FIT COACH" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu"
          className="grid h-11 w-11 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-2xl text-white"
        >
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

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[286px] max-w-[86vw] min-w-0 flex-col overflow-hidden border-r border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform duration-200 lg:w-[300px] lg:max-w-none lg:translate-x-0 lg:p-3 xl:w-[320px] ${
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
              className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-xl text-zinc-300 lg:hidden"
            >
              ×
            </button>
          </div>

          <div className="mt-3 rounded-md border border-blue-500/40 bg-blue-500/10 p-2.5 lg:p-2">
            <p className="text-[11px] font-black uppercase text-zinc-400">Status da operação</p>
            <p className="mt-1 text-sm font-bold text-blue-200">{remoteStatus}</p>
            {remoteError ? <p className="mt-2 break-words text-xs leading-5 text-amber-200">{remoteError}</p> : null}
          </div>

          <div className="mb-2 mt-3 flex items-center justify-between px-1">
            <p className="text-[11px] font-black uppercase text-zinc-500">Navegação</p>
            <span className="text-[10px] font-bold text-zinc-600">{navItems.length} áreas</span>
          </div>
          <nav className="scrollbar-soft grid min-h-0 min-w-0 flex-1 grid-cols-1 content-start gap-1.5 overflow-y-auto pr-1 lg:grid-cols-2 lg:gap-1.5 lg:overflow-hidden lg:pr-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={activeView === item.id ? 'page' : undefined}
                disabled={shouldLockCoachTools && item.id !== 'assinatura'}
                onClick={() => {
                  if (shouldLockCoachTools && item.id !== 'assinatura') return
                  setActiveView(item.id)
                  setMobileMenuOpen(false)
                }}
                className={`flex min-h-9 min-w-0 items-center gap-2.5 rounded-md border px-3 py-1.5 text-left text-sm font-semibold transition lg:min-h-[46px] lg:flex-col lg:items-start lg:justify-center lg:gap-1 lg:px-2 lg:py-2 ${
                  activeView === item.id
                    ? 'border-blue-500 bg-blue-500 text-zinc-950 shadow-lg shadow-emerald-950/20'
                    : shouldLockCoachTools && item.id !== 'assinatura'
                      ? 'cursor-not-allowed border-white/5 bg-white/[0.015] text-zinc-600'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-zinc-950/10 text-[11px] font-black lg:h-5 lg:w-5 lg:text-[9px]">{item.icon}</span>
                <span className="min-w-0 flex-1 break-words text-[13px] leading-tight lg:text-[11px]">{item.label}</span>
                {shouldLockCoachTools && item.id !== 'assinatura' ? (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-black uppercase text-zinc-500">Bloq.</span>
                ) : null}
                {item.id === 'notificacoes' && totalAlertCount > 0 ? (
                  <span className="rounded bg-amber-300 px-2 py-0.5 text-xs text-zinc-950">{totalAlertCount}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <button type="button" onClick={logout} className="mt-3 w-full rounded-md border border-white/10 px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.04] lg:mt-2 lg:py-2">
            Sair
          </button>
      </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:ml-[300px] lg:w-[calc(100%-300px)] lg:px-5 xl:ml-[320px] xl:w-[calc(100%-320px)] xl:px-7">
          <div className="mx-auto min-w-0 max-w-[1440px]">
          <header className="mb-5 rounded-md border border-white/10 bg-zinc-900/60 p-4 sm:p-5 xl:mb-6 xl:flex xl:items-end xl:justify-between xl:gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-8 bg-blue-500" />
                <p className="text-xs font-black uppercase text-blue-300">FIT COACH / Central do coach</p>
              </div>
              <h2 className="mt-1 text-3xl font-black sm:text-4xl">{viewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Gerencie alunos, prescrições, evolução, agenda, comunicação e financeiro em um único lugar.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 xl:mt-0">
              <button
                type="button"
                onClick={() => setActiveView('assinatura')}
                className="rounded-md border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-left text-sm font-bold text-emerald-100"
              >
                <span className="block text-[10px] font-black uppercase text-emerald-300">Próxima cobrança</span>
                <span className="mt-0.5 block">{coachBillingCycle.daysRemaining} {coachBillingCycle.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}</span>
              </button>
              {['Firme', 'Tecnico', 'Motivador'].map((item) => (
                <button
                  key={item}
                  onClick={() => setTone(item)}
                  className={`rounded-md border px-4 py-2 text-sm font-bold ${
                    tone === item ? 'border-amber-300 bg-amber-300 text-zinc-950' : 'border-white/10 bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  {formatUiText(item)}
                </button>
              ))}
            </div>
          </header>

          {shouldLockCoachTools ? (
            <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50">
              <p className="text-xs font-black uppercase text-amber-200">Assinatura pendente</p>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                Crie sua conta, conclua o pagamento seguro e o painel será liberado assim que a confirmação chegar no sistema.
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
          <BrandLockup large subtitle="FIT COACH" />
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
          <BrandLockup subtitle="FIT COACH" />
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

function LoginScreen({ onLogin, onStudentAccess, remoteStatus, remoteError }) {
  const [mode, setMode] = useState('signin')
  const [loading, setLoading] = useState(false)
  const [revenueScenario, setRevenueScenario] = useState({
    students: 20,
    monthlyPrice: 250,
    additionalStudents: 6,
    priceIncrease: 30,
  })
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-2 sm:px-6">
          <BrandLockup compact subtitle="FIT COACH" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openAccess('student')} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 sm:px-4 sm:text-sm">
              Sou aluno
            </button>
            <button type="button" onClick={() => openAccess('signin')} className="rounded-md bg-blue-500 px-3 py-2 text-xs font-black text-zinc-950 sm:px-4 sm:text-sm">
              Entrar
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-68px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.72fr)] lg:px-10 lg:py-14">
          <div className="min-w-0" data-reveal>
            <p className="text-sm font-semibold uppercase text-blue-200">Gestão profissional para personal trainers</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.5rem]">
              Transforme seu acompanhamento em uma operação profissional, clara e escalável.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              O FIT COACH reúne treinos, nutrição, evolução, agenda, pagamentos e comunicação para você atender melhor, demonstrar mais valor e crescer sem depender de planilhas espalhadas.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => openAccess('signup')} className="w-full rounded-md bg-blue-500 px-5 py-3 text-sm font-black text-zinc-950 sm:w-auto">
                Profissionalizar meu acompanhamento
              </button>
              <button type="button" onClick={() => document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' })} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black text-zinc-100 sm:w-auto">
                Ver como funciona
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Acesso pelo navegador, implantação gradual e portal individual para cada aluno.</p>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/15 pt-5">
              <SalesStat value="1 painel" label="operação centralizada" />
              <SalesStat value="13 áreas" label="gestão completa" />
              <SalesStat value="2 portais" label="coach e aluno" />
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
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-zinc-400">Sistema</p>
                <span className="h-2 w-2 rounded bg-blue-400" />
              </div>
              <p className="mt-1 text-sm font-bold text-blue-200">{remoteStatus}</p>
              {remoteError ? <p className="mt-2 break-words text-sm leading-6 text-amber-200">{remoteError}</p> : null}
            </div>
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
            {mode === 'signup' ? (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Se a confirmação por e-mail estiver ativa, confirme sua conta antes do primeiro acesso.
              </p>
            ) : null}
          </form>
        </section>

        <section className="border-y border-white/10 bg-zinc-950/80">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:grid-cols-3 sm:px-6">
            {[
              ['Sem instalação', 'Coach e aluno acessam diretamente pelo navegador.'],
              ['Comece aos poucos', 'Migre primeiro os alunos ativos, sem parar sua rotina.'],
              ['Dados por aluno', 'Histórico, anamnese e evolução permanecem organizados.'],
            ].map(([title, text]) => (
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

        <section id="recursos" className="sales-section sales-section-blue border-y border-white/10 bg-[#05070d]/75 py-10 backdrop-blur-xl sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl" data-reveal>
              <p className="text-sm font-semibold uppercase text-emerald-300">Uma estrutura para toda a operação</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Tudo que o coach precisa para entregar acompanhamento premium</h2>
              <p className="mt-4 leading-7 text-zinc-400">Menos ferramentas espalhadas, menos tarefas manuais e uma experiência mais clara para cada aluno.</p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['01', 'Alunos e anamnese', 'Cadastro, código automático, anamnese quando necessária e histórico centralizado.'],
                ['02', 'Treinos com execução guiada', 'Prescrição por exercício, séries, cargas, orientações e acesso ao vídeo do movimento.'],
                ['03', 'Nutrição inteligente', 'Planos alimentares, busca de alimentos e cálculo automático de macronutrientes.'],
                ['04', 'Evolução visual', 'Avaliações, medidas, fotos, gráficos e leitura clara do progresso.'],
                ['05', 'Agenda e comunicação', 'Compromissos, mensagens e notificações para manter o acompanhamento ativo.'],
                ['06', 'Financeiro organizado', 'Planos, cobranças, vencimentos e situação de pagamento de cada aluno.'],
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

        <section className="sales-section mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div data-reveal className="lg:sticky lg:top-28">
              <p className="text-sm font-semibold uppercase text-emerald-300">O custo da desorganização</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Seu acompanhamento pode ser excelente e ainda parecer improvisado.</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                Quando cada informação fica em um lugar, o coach trabalha mais, responde as mesmas dúvidas e tem dificuldade para demonstrar tudo que entrega.
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
                  <p className="text-sm font-bold leading-6 text-zinc-200"><strong className="text-emerald-200">Com FIT COACH:</strong> {after}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-section sales-section-red mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">Experiência do aluno</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Seu serviço continua sendo seu. A percepção se torna muito maior.</h2>
              <p className="mt-4 leading-7 text-zinc-300">Cada aluno recebe um acesso próprio para consultar treino, dieta, compromissos, cobranças e falar com o coach.</p>
              <button type="button" onClick={() => openAccess('signup')} className="mt-6 w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 sm:w-auto">
                Profissionalizar meu acompanhamento
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Primeiro acesso', 'Código individual, consentimento e anamnese guiada.'],
                ['Rotina diária', 'Treino e alimentação sempre disponíveis no celular.'],
                ['Prestação de contas', 'Check-ins, fotos e conclusão de treinos registrados.'],
                ['Proximidade', 'Mensagens, agenda e orientações em um só ambiente.'],
              ].map(([title, text], index) => (
                <div key={title} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="sales-feature-card rounded-md border border-white/10 bg-zinc-950/70 p-5">
                  <h3 className="font-black text-emerald-200">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-section sales-section-blue mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-blue-300">Potencial de faturamento</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Quando a operação fica mais profissional, o crescimento deixa de depender apenas de trabalhar mais horas.</h2>
              <p className="mt-4 leading-7 text-zinc-300">
                O FIT COACH reúne tudo que sustenta um acompanhamento de maior valor: entrega organizada, experiência do aluno, histórico, comunicação, financeiro e capacidade para atender uma carteira maior.
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
              <div data-reveal className="rounded-md border border-emerald-300/25 bg-emerald-400/[0.07] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-emerald-300">O FIT COACH faz sentido para você que</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Atende alunos online, presencialmente ou de forma híbrida.',
                    'Quer reduzir tarefas repetitivas sem perder proximidade.',
                    'Precisa organizar treino, dieta, evolução e financeiro.',
                    'Deseja aumentar o valor percebido do acompanhamento.',
                  ].map((item) => <ObjectionPoint key={item} text={item} positive />)}
                </div>
              </div>
              <div data-reveal className="rounded-md border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <p className="text-xs font-black uppercase text-zinc-400">O sistema não promete atalhos</p>
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

        <section className="sales-section mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="text-center" data-reveal>
            <p className="text-sm font-semibold uppercase text-emerald-200">Dúvidas antes de começar</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">O que você precisa saber sobre o FIT COACH</h2>
          </div>
          <div className="mt-9 grid gap-3">
            {[
              ['Meus alunos precisam instalar alguma coisa?', 'Não. O acesso funciona pelo navegador no celular ou computador, usando o código individual enviado pelo coach.'],
              ['Já uso WhatsApp. Por que preciso de uma plataforma?', 'O WhatsApp continua útil para contato rápido. O FIT COACH organiza o que precisa permanecer acessível e consultável: prescrição, histórico, check-ins, medidas, agenda e financeiro.'],
              ['Vou precisar cadastrar tudo novamente?', 'Você pode começar com os alunos ativos e preencher as informações conforme usa. Não é necessário interromper seu atendimento para organizar toda a carteira.'],
              ['Consigo usar no celular e no desktop?', 'Sim. O painel e o portal do aluno foram adaptados para os dois formatos, permitindo acompanhar a operação onde você estiver.'],
              ['Preciso abandonar minhas ferramentas atuais no primeiro dia?', 'Não. Você pode implantar o FIT COACH por etapas, validar o fluxo com alguns alunos e ampliar conforme sua equipe ganha segurança.'],
              ['Como funciona o valor depois do primeiro mês?', 'Após o primeiro mês promocional, a assinatura passa para R$ 49,90 mais 2% sobre o valor mensal dos planos dos alunos ativos cadastrados. O resumo fica visível antes do fechamento.'],
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

        <section className="sales-section sales-section-final border-t border-white/10 bg-zinc-950/80 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6" data-reveal>
            <div className="overflow-hidden rounded-md border border-emerald-300/25 bg-[#070b0a] shadow-2xl shadow-black/40">
              <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-stretch">
                <div className="min-w-0 rounded-md border border-emerald-300/30 bg-gradient-to-br from-emerald-400/15 via-emerald-950/10 to-transparent p-5 sm:p-7">
                  <span className="inline-flex rounded bg-emerald-400 px-3 py-2 text-xs font-black uppercase text-zinc-950">
                    Oferta de lançamento
                  </span>
                  <p className="mt-5 text-sm font-black uppercase text-emerald-200">Seu primeiro mês completo por</p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <span className="text-6xl font-black leading-none text-white sm:text-7xl">R$ 9,90</span>
                    <span className="pb-1 text-sm font-bold text-zinc-400">pagamento único no primeiro ciclo</span>
                  </div>
                  <h2 className="mt-6 max-w-3xl text-2xl font-bold leading-tight sm:text-3xl">Comece pequeno no investimento e grande na experiência entregue aos seus alunos.</h2>
                  <p className="mt-4 max-w-2xl leading-7 text-zinc-300">
                    Acesse toda a estrutura do FIT COACH com <strong className="text-emerald-100">isenção total da taxa de manutenção</strong>. Use o primeiro mês para organizar sua carteira e perceber o ganho na rotina.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ['0% de taxa', 'isenção total no primeiro mês'],
                      ['Sem limite inicial', 'cadastre sua carteira ativa'],
                      ['Acesso completo', 'painel do coach e portal do aluno'],
                    ].map(([value, label]) => (
                      <div key={label} className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-4">
                        <p className="break-words text-lg font-black text-emerald-100">{value}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={startFirstMonthOffer} className="mt-6 w-full rounded-md bg-emerald-400 px-5 py-4 text-base font-black text-zinc-950 shadow-xl shadow-emerald-950/30 sm:w-auto">
                    Garantir meu primeiro mês por R$ 9,90
                  </button>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Crie sua conta agora. Depois você será levado para a página de assinatura para ativar o primeiro mês.
                  </p>
                </div>

                <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <p className="text-xs font-black uppercase text-zinc-500">Transparência nos próximos ciclos</p>
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <span className="text-2xl font-black text-zinc-200">R$ 49,90</span>
                    <span className="pb-1 text-sm font-bold text-zinc-400">por mês</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    Mais 2% sobre o valor mensal do plano de cada aluno ativo cadastrado. Você acompanha a composição antes do fechamento, aluno por aluno.
                  </p>
                  <div className="mt-5 grid gap-3 border-t border-white/10 pt-5">
                    <ObjectionPoint text="Cobrança proporcional ao tamanho da operação." />
                    <ObjectionPoint text="Cálculo detalhado por aluno." />
                    <ObjectionPoint text="Resumo disponível antes do pagamento." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05070d] px-4 py-6 text-center text-xs text-zinc-500">
        FIT COACH · Gestão profissional de acompanhamento
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
        notes: form.get('notes')?.toString() || '',
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
              <Select label="Tipo" name="type" defaultValue="Consulta" options={['Consulta', 'Avaliacao', 'Check-in', 'Chamada', 'Outro']} />
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

function Students({ students, invites, anamneses, selectedStudent, setSelectedStudentId, onSave, onGenerateInvite, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [savedInvite, setSavedInvite] = useState(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const selectedInvite = savedInvite?.studentId === selectedStudent?.id
    ? savedInvite
    : invites.find((invite) => String(invite.studentId) === String(selectedStudent?.id) && invite.status === 'active')
  const selectedAnamnesis = anamneses.find((item) => String(item.studentId) === String(selectedStudent?.id))

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
                <div className="h-2 rounded bg-blue-500" style={{ width: `${student.adherence}%` }} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ficha e edição" action={selectedStudent?.phase ?? 'Novo'}>
        {editing ? (
          <StudentForm
            student={editing}
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
              <Info label="Próximo check-in" value={selectedStudent.nextCheckin} />
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
              <StudentAnamnesisSummary anamnesis={selectedAnamnesis} student={selectedStudent} />
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

function StudentForm({ student, onSave, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [continuingStudent, setContinuingStudent] = useState(student.requireAnamnesis === false)

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
            Use para transferir um aluno atual para o FIT COACH. Ele aceitará o consentimento e entrará direto no portal, sem preencher uma nova anamnese.
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
        <Select label="Plano" name="plan" defaultValue={student.plan} options={plans.map((plan) => plan.name)} />
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
        <Empty text="A evolução detalhada aparecerá depois da primeira avaliação." />
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

function Workouts({ selectedStudent, students, workouts, workoutLogs, onSaveWorkout, onArchiveWorkout }) {
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

      <Panel title="Histórico de execução" action={`${studentLogs.length} registros`}>
        <WorkoutLogList logs={studentLogs} />
      </Panel>
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
      setMessage('Treino marcado como concluído.')
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
      <TextArea label="Observação do treino" name="notes" defaultValue="Carga usada, dificuldade, dor, energia ou algo importante." />
      <button disabled={saving} className="rounded-md bg-blue-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">
        {saving ? 'Salvando...' : 'Marcar treino como concluído'}
      </button>
      {message ? <p className="text-sm font-bold text-blue-200">{message}</p> : null}
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
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida.')
      event.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A foto deve ter no máximo 8 MB.')
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
              <img src={attachmentPreview} alt="Prévia da foto" className="h-20 w-20 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-zinc-200">{attachmentFile?.name || 'Foto selecionada'}</p>
                <button type="button" onClick={clearAttachment} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200">
                  Remover foto
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
            Enviar foto
            <input type="file" accept="image/*" onChange={handleAttachment} className="hidden" />
          </label>
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
          <BrandLockup subtitle="FIT COACH" />
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
  const [activeTab, setActiveTab] = useState('treino')
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null)
  const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState(0)
  const [workoutClock, setWorkoutClock] = useState(Date.now())
  const [installPrompt, setInstallPrompt] = useState(null)
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
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
  const nextWorkout = studentWorkouts[0]
  const nextAppointment = studentAppointments[0]
  const workoutSeconds = workoutElapsedSeconds + (workoutStartedAt ? Math.floor((workoutClock - workoutStartedAt) / 1000) : 0)
  const navItems = [
    ['treino', 'Treino', '01'],
    ['dieta', 'Dieta', '02'],
    ['checkin', 'Check-in', '03'],
    ['mensagens', 'Chat', '04'],
    ['agenda', 'Agenda', '05'],
    ['progresso', 'Progresso', '06'],
    ['historico', 'Histórico', '07'],
  ]
  const quickNavItems = navItems.slice(0, 4)
  const activeTitle = navItems.find(([id]) => id === activeTab)?.[1] || 'Treino'

  useEffect(() => {
    if (!workoutStartedAt) return undefined
    const timer = window.setInterval(() => setWorkoutClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [workoutStartedAt])

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

  function toggleWorkoutTimer() {
    if (workoutStartedAt) {
      setWorkoutElapsedSeconds((current) => current + Math.floor((Date.now() - workoutStartedAt) / 1000))
      setWorkoutStartedAt(null)
      return
    }
    setWorkoutStartedAt(Date.now())
    setWorkoutClock(Date.now())
  }

  async function installStudentApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice.catch(() => null)
    setInstallPrompt(null)
  }

  function renderActiveContent() {
    if (activeTab === 'treino') {
      return (
        <StudentAppSection title="Treino de hoje" action={nextWorkout?.title || student.workout || 'Plano'}>
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
              {onCompleteWorkout ? <CompleteWorkoutForm student={student} workout={studentWorkouts[0]} onCompleteWorkout={onCompleteWorkout} /> : null}
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

    if (activeTab === 'agenda') {
      return (
        <StudentAppSection title="Agenda" action={`${studentAppointments.length} próximos`}>
          {nextAppointment ? <div className="rounded-md border border-white/10 bg-white/[0.035] p-4"><h4 className="font-black">{nextAppointment.title}</h4><p className="mt-1 text-sm text-zinc-400">{nextAppointment.type} - {nextAppointment.durationMinutes} min</p><p className="mt-2 text-sm font-bold text-blue-200">{formatFullDateTime(nextAppointment.startsAt)}</p><p className="mt-1 text-sm text-zinc-400">{nextAppointment.location || 'Local a confirmar'}</p></div> : <Empty text="Nenhum compromisso futuro agendado." />}
        </StudentAppSection>
      )
    }

    if (activeTab === 'progresso') {
      return <StudentAppSection title="Progresso" action={`${checkins.length} check-ins`}><AssessmentProgress assessments={studentAssessments} student={student} /></StudentAppSection>
    }

    return (
      <StudentAppSection title="Histórico" action={`${studentWorkoutLogs.length} treinos`}>
        <WorkoutLogList logs={studentWorkoutLogs} />
        {checkins.length ? <div className="mt-4 space-y-3">{checkins.slice(0, 3).map((item) => <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4"><h4 className="font-bold">{item.type}</h4><p className="mt-1 text-sm text-zinc-400">{item.due} - {item.weight}</p><p className="mt-2 text-sm leading-6 text-zinc-300">{item.note}</p></div>)}</div> : null}
      </StudentAppSection>
    )
  }

  return (
    <div className="app-shell fit-gradient-bg min-h-screen w-full max-w-full overflow-x-hidden text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/94 px-3 py-3 shadow-2xl shadow-black/25 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
            <span className="grid gap-1.5"><span className="block h-0.5 w-5 rounded bg-zinc-100" /><span className="block h-0.5 w-5 rounded bg-zinc-100" /><span className="block h-0.5 w-5 rounded bg-zinc-100" /></span>
          </button>
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
              <BrandLockup compact subtitle="FIT COACH" />
              <button type="button" onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-xl text-zinc-200">×</button>
            </div>
            <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3">
              <p className="text-xs font-black uppercase text-emerald-200">Área do aluno</p>
              <p className="mt-1 text-lg font-black">{student.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{student.goal || 'Acompanhamento em andamento'}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {navItems.map(([id, label, icon]) => (
                <button key={id} type="button" onClick={() => openTab(id)} className={`flex min-h-11 items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-black ${activeTab === id ? 'border-emerald-300/40 bg-emerald-400/12 text-emerald-100' : 'border-white/10 bg-white/[0.035] text-zinc-100'}`}>
                  <span>{icon} · {label}</span><span className="text-zinc-500">›</span>
                </button>
              ))}
            </div>            {!appInstalled ? (
              <div className="mt-4 rounded-md border border-blue-300/20 bg-blue-400/10 p-3">
                <p className="text-xs font-black uppercase text-blue-200">Acesso rápido</p>
                <p className="mt-1 text-xs leading-5 text-zinc-300">Adicione o FIT COACH na tela inicial para abrir sem digitar o código toda hora.</p>
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
              {navItems.map(([id, label]) => <button key={id} type="button" onClick={() => openTab(id)} className={`rounded-md border px-3 py-2 text-left text-sm font-bold ${activeTab === id ? 'border-emerald-300/40 bg-emerald-400/12 text-emerald-100' : 'border-white/10 bg-white/[0.035] text-zinc-200 hover:border-emerald-300/35'}`}>{label}</button>)}
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
              <p className="text-xs font-black uppercase text-emerald-300">FIT COACH</p>
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/94 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {quickNavItems.map(([id, label, icon]) => (
            <button key={id} type="button" onClick={() => openTab(id)} className={`grid min-h-14 place-items-center rounded-md px-1 py-1 text-center text-[10px] font-black ${activeTab === id ? 'bg-emerald-400/12 text-emerald-100' : 'text-zinc-300'}`}>
              <span className="grid h-6 w-6 place-items-center rounded bg-emerald-400/12 text-[9px] text-emerald-200">{icon}</span>
              <span className="mt-1 leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
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

function CoachSubscription({ students, invoices, subscription, userCreatedAt }) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const firstMonthCheckoutUrl = normalizeCheckoutUrl(import.meta.env.VITE_FITCOACH_FIRST_MONTH_CHECKOUT_URL || subscription?.checkoutFirstMonthUrl || import.meta.env.VITE_FITCOACH_BILLING_URL || '')
  const regularCheckoutUrl = normalizeCheckoutUrl(import.meta.env.VITE_FITCOACH_REGULAR_CHECKOUT_URL || subscription?.checkoutRegularUrl || firstMonthCheckoutUrl)
  const activeStudents = students.filter((student) => student.status !== 'Inativo')
  const estimatedRevenue = activeStudents.reduce((total, student) => total + getPlanMonthlyPrice(student.plan), 0)
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
  const maintenanceRate = subscription?.maintenanceRate ?? 0.02
  const maintenanceFee = estimatedRevenue * maintenanceRate
  const firstMonthTotal = firstMonthPrice
  const regularTotal = regularPrice + maintenanceFee
  const currentBillingTotal = billingCycle.isPromotional ? firstMonthTotal : regularTotal
  const currentCheckoutUrl = billingCycle.isPromotional ? firstMonthCheckoutUrl : regularCheckoutUrl
  const retainedRevenue = Math.max(estimatedRevenue - regularTotal, 0)
  const costShare = estimatedRevenue > 0 ? (regularTotal / estimatedRevenue) * 100 : 0
  const returnMultiple = regularTotal > 0 ? estimatedRevenue / regularTotal : 0
  const closingDate = new Date(billingCycle.nextBillingAt)
  const studentBreakdown = activeStudents.map((student) => {
    const monthlyValue = getPlanMonthlyPrice(student.plan)
    return {
      ...student,
      monthlyValue,
      maintenanceValue: monthlyValue * maintenanceRate,
    }
  })

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function copyBillingSummary() {
    const summary = [
      'Resumo da assinatura FIT COACH',
      `Alunos ativos: ${activeStudents.length}`,
      `Receita estimada da carteira: ${formatCurrency(estimatedRevenue)}`,
      `Mensalidade regular: ${formatCurrency(regularPrice)}`,
      `Taxa de manutenção (${formatPercent(maintenanceRate)}): ${formatCurrency(maintenanceFee)}`,
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

  return (
    <div className="grid min-w-0 gap-4 lg:gap-6">
      <section className="overflow-hidden rounded-md border border-emerald-300/25 bg-zinc-950/75 shadow-2xl shadow-black/25">
        <div className="grid gap-5 border-b border-white/10 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-emerald-300">Sua assinatura FIT COACH</p>
            <h3 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">Uma estrutura profissional que cresce junto com sua carteira.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Você começa por apenas <strong className="text-emerald-200">{formatCurrency(firstMonthPrice)} no primeiro mês</strong>, com isenção total da taxa de manutenção. Depois, a mensalidade é de {formatCurrency(regularPrice)} mais {formatPercent(maintenanceRate)} sobre o valor dos planos dos alunos ativos cadastrados.
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">{billingCycle.isPromotional ? 'Primeiro fechamento' : 'Próximo fechamento'}</p>
            <p className="mt-2 break-words text-4xl font-black text-white">{formatCurrency(currentBillingTotal)}</p>
            <p className="mt-2 text-xs leading-5 text-emerald-100">
              {billingCycle.isPromotional
                ? 'Taxa de manutenção totalmente isenta neste ciclo.'
                : `${formatCurrency(regularPrice)} + ${formatCurrency(maintenanceFee)} de manutenção estimada.`}
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
            <BillingLine label="Taxa no primeiro mês" value={formatCurrency(0)} note={`Isenção de ${formatCurrency(maintenanceFee)} neste ciclo`} />
            <BillingLine label="Mensalidade após o primeiro mês" value={formatCurrency(regularPrice)} note="Valor fixo mensal" />
            <BillingLine label="Taxa nos meses seguintes" value={formatCurrency(maintenanceFee)} note={`${formatPercent(maintenanceRate)} sobre ${formatCurrency(estimatedRevenue)} em planos ativos`} />
            <div className="mt-1 rounded-md border border-emerald-300/30 bg-emerald-400/10 p-4">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-emerald-200">Próximos fechamentos</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">Mensalidade regular somada à taxa da carteira ativa.</p>
                </div>
                <p className="break-words text-3xl font-black text-white">{formatCurrency(regularTotal)}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setShowDetails((current) => !current)} className="mt-4 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
            {showDetails ? 'Ocultar alunos considerados' : 'Ver alunos considerados'}
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
                    <p className="text-xs text-zinc-500">Taxa de 2%</p>
                    <p className="mt-1 text-sm font-black text-cyan-200">{formatCurrency(student.maintenanceValue)}</p>
                  </div>
                </div>
              )) : <Empty text="Cadastre alunos e selecione os planos para calcular a taxa." />}
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

          <Panel title="Pagamento da assinatura" action="Oferta ativa">
            <p className="text-sm leading-6 text-zinc-400">
              O primeiro pagamento ativa a oferta de entrada por {formatCurrency(firstMonthPrice)}. Depois, o fechamento considera os alunos ativos e os planos cadastrados até o último dia do mês.
            </p>
            <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase text-amber-200">Importante para liberar automaticamente</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">
                No checkout, use o mesmo e-mail cadastrado aqui no FIT COACH. E-mail diferente pode impedir a liberação automática das ferramentas.
              </p>
            </div>
            {currentCheckoutUrl ? (
              <a href={currentCheckoutUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-emerald-500 px-4 py-3 text-center text-sm font-black text-zinc-950">
                {billingCycle.isPromotional ? `Pagar primeiro mês por ${formatCurrency(firstMonthPrice)}` : `Pagar mensalidade de ${formatCurrency(regularPrice)}`}
              </a>
            ) : (
              <button type="button" disabled className="mt-4 w-full rounded-md bg-zinc-800 px-4 py-3 text-sm font-black text-zinc-500">
                Checkout seguro em configuração
              </button>
            )}
            <button type="button" onClick={copyBillingSummary} className="mt-3 w-full rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-100">
              {copied ? 'Resumo copiado' : 'Copiar resumo da cobrança'}
            </button>
            <p className="mt-3 text-xs leading-5 text-zinc-500">A cobrança recorrente será conferida no fechamento mensal, mantendo o primeiro mês com isenção total da taxa de manutenção.</p>
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

function Payments({ students, invoices, onSaveInvoice, onUpdateInvoiceStatus, onUpdatePayment }) {
  const [filter, setFilter] = useState('Todos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
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
        planName: form.get('planName')?.toString() || 'Essential',
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

  return (
    <div className="grid gap-4 lg:gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Recebido" value={formatCurrency(paidTotal)} detail={`${invoices.filter((item) => item.status === 'Pago').length} pagamentos`} />
        <Metric label="A receber" value={formatCurrency(pendingTotal)} detail="pendentes e atrasados" />
        <Metric label="Em atraso" value={overdueCount} detail="cobranças vencidas" />
      </section>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Gerar cobrança" action="Financeiro">
          {students.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Select label="Aluno" name="studentId" options={students.map((student) => ({ label: student.name, value: student.id }))} />
              <Select label="Plano" name="planName" defaultValue="Essential" options={plans.map((plan) => plan.name)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor (R$)" name="amount" type="number" defaultValue="197" />
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
            {plans.map((plan) => (
              <div key={plan.name} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black">{plan.name}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{plan.features}</p>
                  </div>
                  <span className="text-lg font-black text-blue-300">{plan.price}</span>
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
                          <button disabled={updatingId === String(invoice.id)} onClick={() => handleInvoiceStatus(invoice.id, 'Pago')} className="rounded-md bg-blue-500 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">
                            Marcar como pago
                          </button>
                          <button disabled={updatingId === String(invoice.id)} onClick={() => handleInvoiceStatus(invoice.id, 'Cancelado')} className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-50">
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
    welcomeMessage: settings?.welcomeMessage || 'Mantenha o plano, registre seu treino e use o check-in para me contar como você está evoluindo.',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await onSave({
        brandName: form.get('brandName')?.toString().trim() || 'FIT COACH',
        publicName: form.get('publicName')?.toString().trim() || '',
        cref: form.get('cref')?.toString().trim() || '',
        whatsapp: form.get('whatsapp')?.toString().trim() || '',
        supportEmail: form.get('supportEmail')?.toString().trim() || '',
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
          </div>
          <TextArea label="Mensagem de boas-vindas para alunos" name="welcomeMessage" defaultValue={current.welcomeMessage} />
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

function Messages({ tone, students, messages, onSendMessage, onMarkRead, onRefreshMessages }) {
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
  const suggestion = buildMessageSuggestion(selectedStudent, tone)
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
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida.')
      event.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A foto deve ter no máximo 8 MB.')
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

      <Panel title={selectedStudent ? `Mensagem para ${selectedStudent.name}` : 'Mensagem'} action={tone}>
        <div className="mb-4 rounded-md border border-blue-300/25 bg-blue-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-normal text-blue-200">Resposta sugerida</p>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{suggestion}</p>
          <button onClick={() => setDraft(suggestion)} className="mt-3 rounded-md border border-blue-300/30 px-3 py-2 text-xs font-black text-blue-100">
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
                <img src={attachmentPreview} alt="Prévia da foto" className="h-20 w-20 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold text-zinc-200">{attachmentFile?.name || 'Foto selecionada'}</p>
                  <button type="button" onClick={clearAttachment} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-zinc-200">
                    Remover foto
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/10 px-4 py-3 text-sm font-black text-zinc-200">
              Enviar foto
              <input type="file" accept="image/*" onChange={handleAttachment} className="hidden" />
            </label>
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
    plan: 'Essential',
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
        alt="FIT COACH PRO"
        className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.48)]"
        decoding="async"
        draggable="false"
      />
    </div>
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
        <div className="h-2 rounded bg-blue-500" style={{ width: `${student.adherence}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span>Constância</span>
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
    const assessmentAge = latestAssessment
      ? (Date.now() - new Date(`${latestAssessment.assessedAt}T12:00:00`).getTime()) / (24 * 60 * 60 * 1000)
      : null

    if (!latestAssessment || assessmentAge > 30) {
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

function buildMessageSuggestion(student, tone) {
  if (!student) return 'Me envie seu retorno de hoje com treino, dieta, sono e fome para eu ajustar seu plano.'

  const base = {
    Firme: `Recebi, ${student.name}. Vamos manter o plano sem improvisar: siga a meta de ${student.protein}, registre o treino ${student.workout} e me envie o check-in no prazo ${student.nextCheckin}.`,
    Tecnico: `Boa, ${student.name}. Pelo objetivo de ${student.goal}, vou acompanhar constância, peso e resposta ao treino. Mantenha ${student.calories}, ${student.protein} e detalhe fome, sono e desempenho no próximo check-in.`,
    Motivador: `Perfeito, ${student.name}. Continue no processo: cada check-in ajuda a ajustar melhor o plano. Hoje, foque em cumprir o treino ${student.workout}, atingir a proteína e me avisar sobre qualquer dificuldade.`,
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

function getPlanMonthlyPrice(planName) {
  const plan = plans.find((item) => item.name === planName)
  if (!plan) return 0
  const normalized = plan.price.replace(/[^\d,]/g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
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
  return ['active', 'paid', 'em dia', 'em_dia', 'trialing'].includes(status)
}

function normalizeCheckoutUrl(value) {
  const raw = String(value || '').trim()
  const urlIndex = raw.indexOf('https://')
  if (urlIndex >= 0) return raw.slice(urlIndex).trim()
  const httpIndex = raw.indexOf('http://')
  if (httpIndex >= 0) return raw.slice(httpIndex).trim()
  return raw
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
    Tecnico: 'Técnico',
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
