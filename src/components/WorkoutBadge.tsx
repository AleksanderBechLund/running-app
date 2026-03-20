import { WorkoutType } from '@/types/workout'

interface WorkoutBadgeProps {
  type: WorkoutType
  size?: 'sm' | 'md'
}

const config: Record<WorkoutType, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-blue-900 text-blue-300' },
  tempo: { label: 'Tempo', color: 'bg-orange-900 text-orange-300' },
  intervals: { label: 'Intervals', color: 'bg-red-900 text-red-300' },
  hill: { label: 'Hill', color: 'bg-yellow-900 text-yellow-300' },
  long: { label: 'Long Run', color: 'bg-purple-900 text-purple-300' },
  progressive: { label: 'Progressive', color: 'bg-green-900 text-green-300' },
}

export function WorkoutBadge({ type, size = 'sm' }: WorkoutBadgeProps) {
  const { label, color } = config[type]
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${color} ${
        size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'
      }`}
    >
      {label}
    </span>
  )
}
