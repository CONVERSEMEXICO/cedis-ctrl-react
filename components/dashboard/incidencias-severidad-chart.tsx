'use client'

import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface SeveridadDato {
  severidad: string
  cantidad: number
  fill: string
}

export function IncidenciasSeveridadChart({ datos }: { datos: SeveridadDato[] }) {
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0)

  const chartConfig: ChartConfig = datos.reduce((config, d) => {
    config[d.severidad] = { label: d.severidad, color: d.fill }
    return config
  }, {} as ChartConfig)

  return (
    <div className="relative">
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="severidad" />} />
          <Pie
            data={datos}
            dataKey="cantidad"
            nameKey="severidad"
            innerRadius={56}
            outerRadius={84}
            strokeWidth={2}
            stroke="var(--card)"
          >
            {datos.map((entry) => (
              <Cell key={entry.severidad} fill={entry.fill} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="severidad" />} />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {total}
        </span>
        <span className="text-xs text-muted-foreground">abiertas</span>
      </div>
    </div>
  )
}
