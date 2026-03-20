'use client'

import { useState } from 'react'

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm)
  const sec = Math.round((minPerKm - min) * 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function parsePace(paceStr: string): number | null {
  const match = paceStr.trim().match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) + parseInt(match[2]) / 60
}

function parseTime(timeStr: string): number | null {
  // Formats: "1:30:00", "30:00", "30"
  const parts = timeStr.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0] * 60
  return null
}

export function Calculator() {
  const [distance, setDistance] = useState('')
  const [pace, setPace] = useState('')
  const [time, setTime] = useState('')
  const [result, setResult] = useState<{ label: string; value: string } | null>(null)

  const calculate = () => {
    const d = parseFloat(distance) || null
    const p = parsePace(pace)
    const t = parseTime(time)

    const filled = [d, p, t].filter(Boolean).length

    if (filled < 2) {
      setResult({ label: 'Error', value: 'Fill in at least 2 fields' })
      return
    }

    if (d && p && !t) {
      // Calculate time
      const totalSecs = d * p * 60
      setResult({ label: 'Time', value: formatTime(totalSecs) })
    } else if (d && t && !p) {
      // Calculate pace (t in seconds already from parseTime)
      const paceMinPerKm = t! / 60 / d
      setResult({ label: 'Pace', value: formatPace(paceMinPerKm) + '/km' })
    } else if (p && t && !d) {
      // Calculate distance
      const dist = t! / 60 / p
      setResult({ label: 'Distance', value: dist.toFixed(2) + ' km' })
    } else if (d && p && t) {
      // All three filled — validate consistency
      const expectedSecs = d * p * 60
      const diff = Math.abs(expectedSecs - t!)
      if (diff < 30) {
        setResult({ label: 'Consistent!', value: `${formatTime(expectedSecs)} for ${d} km @ ${formatPace(p)}/km` })
      } else {
        setResult({ label: 'Mismatch', value: `Expected ${formatTime(expectedSecs)}, got ${formatTime(t!)}` })
      }
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white">Pace Calculator</h3>
      <p className="text-xs text-gray-400">Fill in any 2 fields to calculate the third.</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Distance (km)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            placeholder="10.0"
            className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Pace (mm:ss)</label>
          <input
            type="text"
            value={pace}
            onChange={e => setPace(e.target.value)}
            placeholder="4:30"
            className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Time (h:mm:ss)</label>
          <input
            type="text"
            value={time}
            onChange={e => setTime(e.target.value)}
            placeholder="45:00"
            className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      <button
        onClick={calculate}
        className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold text-sm py-2 rounded-lg transition-colors"
      >
        Calculate
      </button>

      {result && (
        <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 uppercase tracking-wide">{result.label}</span>
          <span className="text-lg font-bold text-green-400">{result.value}</span>
        </div>
      )}
    </div>
  )
}
