import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const tooltipStyle = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  color: '#f4f4f5',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

function ChartFrame({ children }) {
  return (
    <div className="h-64 min-w-0 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function AssessmentChart({ data, weightLabel = 'Peso', bodyFatLabel = 'Gordura' }) {
  return (
    <ChartFrame>
      <LineChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
        <XAxis dataKey="label" stroke="#a1a1aa" />
        <YAxis stroke="#a1a1aa" />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="peso" name={weightLabel} stroke="#10b981" strokeWidth={3} />
        <Line type="monotone" dataKey="gordura" name={bodyFatLabel} stroke="#fbbf24" strokeWidth={3} />
      </LineChart>
    </ChartFrame>
  )
}

export function RevenueChart({ data }) {
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
        <XAxis dataKey="month" stroke="#a1a1aa" />
        <YAxis stroke="#a1a1aa" />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => currencyFormatter.format(Number(value || 0))} />
        <Area type="monotone" dataKey="receita" stroke="#34d399" fill="#047857" fillOpacity={0.35} />
      </AreaChart>
    </ChartFrame>
  )
}
