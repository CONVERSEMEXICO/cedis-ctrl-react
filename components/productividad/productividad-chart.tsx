'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface ProductividadDato {
  responsable: string
  real: number
  meta: number
}

const chartConfig: ChartConfig = {
  real: { label: 'Real (uds/h)', color: 'var(--chart-1)' },
  meta: { label: 'Meta (uds/h)', color: 'var(--chart-5)' },
}

export function ProductividadChart({ datos }: { datos: ProductividadDato[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <BarChart accessibilityLayer data={datos} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="responsable"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="real" fill="var(--color-real)" radius={4} />
        <Bar dataKey="meta" fill="var(--color-meta)" radius={4} fillOpacity={0.4} />
      </BarChart>
    </ChartContainer>
  )
}
