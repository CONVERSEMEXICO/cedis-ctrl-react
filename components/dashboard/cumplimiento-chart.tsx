'use client'

import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface CumplimientoDato {
  proceso: string
  valor: number
  fill: string
}

const chartConfig: ChartConfig = {
  valor: { label: 'Cumplimiento' },
}

export function CumplimientoChart({ datos }: { datos: CumplimientoDato[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
          fontFamily="var(--font-mono)"
        />
        <YAxis
          type="category"
          dataKey="proceso"
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelKey="proceso" nameKey="proceso" />}
        />
        <Bar dataKey="valor" radius={4} barSize={22}>
          {datos.map((entry) => (
            <Cell key={entry.proceso} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
