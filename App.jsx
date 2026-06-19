import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

export default function App() {
  const [frase, setFrase] = useState('Disciplina vence motivação.')

  const frases = [
    'Disciplina vence motivação.',
    'Seu shape é reflexo da sua constância.',
    'Cada treino conta.',
    'Resultados aparecem para quem permanece.',
  ]

  const alunos = [
    { nome: 'Carlos Henrique', objetivo: 'Bulking', score: 91 },
    { nome: 'João Pedro', objetivo: 'Cutting', score: 87 },
  ]

  const chartData = [
    { dia: 'Seg', valor: 80 },
    { dia: 'Ter', valor: 92 },
    { dia: 'Qua', valor: 75 },
    { dia: 'Qui', valor: 95 },
    { dia: 'Sex', valor: 88 },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
          <h1 className="text-5xl font-black text-green-400">
            FitCoach AI Pro
          </h1>

          <p className="text-slate-400 mt-3">
            Plataforma premium para personal trainers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Alunos" value="28" />
          <Card title="Ativos" value="24" />
          <Card title="Check-ins" value="18" />
          <Card title="Retenção" value="94%" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          <div className="xl:col-span-2 bg-white/5 rounded-3xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-6">
              Seus Alunos
            </h2>

            <div className="space-y-4">
              {alunos.map((aluno, index) => (
                <div
                  key={index}
                  className="bg-black/30 rounded-2xl p-5 border border-white/5 flex justify-between items-center"
                >
                  <div>
                    <h3 className="text-xl font-bold">
                      {aluno.nome}
                    </h3>

                    <p className="text-slate-400 mt-1 text-sm">
                      Objetivo: {aluno.objetivo} | Score: {aluno.score}%
                    </p>
                  </div>

                  <button className="bg-green-500 text-black px-4 py-2 rounded-xl font-bold">
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">

            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6">
              <h2 className="text-2xl font-black text-black">
                Motivação
              </h2>

              <div className="bg-black/20 rounded-2xl p-5 mt-5">
                <h3 className="text-2xl font-black text-black">
                  "{frase}"
                </h3>
              </div>

              <button
                onClick={() =>
                  setFrase(frases[Math.floor(Math.random() * frases.length)])
                }
                className="mt-5 w-full bg-black text-white p-3 rounded-2xl font-bold"
              >
                Nova frase
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-4">
                Engajamento
              </h2>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis dataKey="dia" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="#22c55e"
                    strokeWidth={4}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
      <p className="text-slate-400 text-sm">{title}</p>
      <h2 className="text-4xl font-black mt-3">{value}</h2>
    </div>
  )
}
