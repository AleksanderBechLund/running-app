'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface ElevationChartProps {
  profile: number[]
  distanceKm: number
}

export function ElevationChart({ profile, distanceKm }: ElevationChartProps) {
  if (!profile || profile.length === 0) return null

  const step = distanceKm / (profile.length - 1)
  const data = profile.map((elev, i) => ({
    distance: parseFloat((i * step).toFixed(2)),
    elevation: Math.round(elev),
  }))

  const minElev = Math.min(...profile)
  const maxElev = Math.max(...profile)
  const gain = profile.reduce((acc, val, i) => {
    if (i === 0) return acc
    const diff = val - profile[i - 1]
    return diff > 0 ? acc + diff : acc
  }, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Elevation Profile</span>
        <div className="flex gap-4">
          <span>Min: {Math.round(minElev)}m</span>
          <span>Max: {Math.round(maxElev)}m</span>
          <span className="text-yellow-400">+{Math.round(gain)}m gain</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="distance"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={v => `${v}km`}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={v => `${v}m`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelFormatter={v => `${v} km`}
            formatter={(value) => [`${value}m`, 'Elevation']}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#elevGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
