'use client'

import { useState, useCallback } from 'react'
import { IntervalFormData } from '@/types/workout'
import { Plus, Trash2, GripVertical } from 'lucide-react'

const INTERVAL_TYPES = [
  { value: 'warmup', label: 'Warm-up', color: 'text-blue-400' },
  { value: 'work', label: 'Work', color: 'text-red-400' },
  { value: 'rest', label: 'Rest', color: 'text-green-400' },
  { value: 'cooldown', label: 'Cool-down', color: 'text-purple-400' },
] as const

function paceToSeconds(pace: string): number | null {
  const match = pace.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function secondsToPace(seconds: number | null): string {
  if (!seconds) return ''
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

interface IntervalRowProps {
  interval: IntervalFormData
  index: number
  onChange: (index: number, updated: IntervalFormData) => void
  onDelete: (index: number) => void
}

function IntervalRow({ interval, index, onChange, onDelete }: IntervalRowProps) {
  const [paceStr, setPaceStr] = useState(
    interval.pace_min_per_km ? secondsToPace(Math.round(interval.pace_min_per_km * 60)) : ''
  )

  const update = (field: keyof IntervalFormData, value: unknown) => {
    onChange(index, { ...interval, [field]: value })
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-800 last:border-0">
      <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />

      {/* Type */}
      <select
        value={interval.type}
        onChange={e => update('type', e.target.value)}
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-green-500 w-28"
      >
        {INTERVAL_TYPES.map(t => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Label */}
      <input
        type="text"
        value={interval.label}
        onChange={e => update('label', e.target.value)}
        placeholder="e.g. 1km hard effort"
        className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-green-500 min-w-0"
      />

      {/* Distance */}
      <input
        type="number"
        step="0.1"
        min="0"
        value={interval.distance_km ?? ''}
        onChange={e => update('distance_km', e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="km"
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-green-500 w-16 text-center"
      />

      {/* Pace */}
      <input
        type="text"
        value={paceStr}
        onChange={e => {
          setPaceStr(e.target.value)
          const seconds = paceToSeconds(e.target.value)
          update('pace_min_per_km', seconds ? seconds / 60 : null)
        }}
        placeholder="4:30"
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-green-500 w-16 text-center"
      />

      {/* Duration */}
      <input
        type="number"
        min="0"
        value={interval.duration_seconds ? Math.round(interval.duration_seconds / 60) : ''}
        onChange={e =>
          update('duration_seconds', e.target.value ? parseInt(e.target.value) * 60 : null)
        }
        placeholder="min"
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-green-500 w-14 text-center"
      />

      <button
        type="button"
        onClick={() => onDelete(index)}
        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

interface IntervalBuilderProps {
  intervals: IntervalFormData[]
  onChange: (intervals: IntervalFormData[]) => void
}

export function IntervalBuilder({ intervals, onChange }: IntervalBuilderProps) {
  const addInterval = useCallback(() => {
    onChange([
      ...intervals,
      {
        type: 'work',
        label: '',
        duration_seconds: null,
        distance_km: null,
        pace_min_per_km: null,
      },
    ])
  }, [intervals, onChange])

  const updateInterval = useCallback(
    (index: number, updated: IntervalFormData) => {
      const copy = [...intervals]
      copy[index] = updated
      onChange(copy)
    },
    [intervals, onChange]
  )

  const deleteInterval = useCallback(
    (index: number) => {
      onChange(intervals.filter((_, i) => i !== index))
    },
    [intervals, onChange]
  )

  const totalDistance = intervals.reduce((sum, i) => sum + (i.distance_km ?? 0), 0)
  const totalSeconds = intervals.reduce((sum, i) => sum + (i.duration_seconds ?? 0), 0)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const durationStr = totalSeconds > 0 ? (h > 0 ? `${h}h ${m}m` : `${m} min`) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Intervals</h3>
        {(totalDistance > 0 || durationStr) && (
          <div className="flex gap-3 text-xs text-gray-400">
            {totalDistance > 0 && <span>{totalDistance.toFixed(1)} km total</span>}
            {durationStr && <span>{durationStr} total</span>}
          </div>
        )}
      </div>

      {intervals.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
          <div className="flex items-center gap-2 pb-1 text-xs text-gray-500 border-b border-gray-800 mb-1">
            <span className="w-4" />
            <span className="w-28">Type</span>
            <span className="flex-1">Label</span>
            <span className="w-16 text-center">km</span>
            <span className="w-16 text-center">pace</span>
            <span className="w-14 text-center">min</span>
            <span className="w-4" />
          </div>
          {intervals.map((interval, i) => (
            <IntervalRow
              key={i}
              interval={interval}
              index={i}
              onChange={updateInterval}
              onDelete={deleteInterval}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addInterval}
        className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add interval
      </button>
    </div>
  )
}
