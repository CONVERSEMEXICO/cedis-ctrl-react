'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface ProductividadDato {
  operador: string
  unidadesHora: number
}

const chartConfig: ChartConfig = {
  unidadesHora: { label: 'Unid./hora', color: 'var(--module-productividad)' },
}

export function ProductividadChart({ datos }: { datos: ProductividadDato[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <BarChart accessibilityLayer data={datos} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="operador"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="unidadesHora" fill="var(--color-unidadesHora)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
