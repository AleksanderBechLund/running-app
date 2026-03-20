'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkoutType, WorkoutFormData, IntervalFormData } from '@/types/workout'
import { IntervalBuilder } from '@/components/IntervalBuilder'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Mapbox
const WorkoutMap = dynamic(
  () => import('@/components/Map/WorkoutMap').then(m => m.WorkoutMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-800 rounded-xl animate-pulse" /> }
)

const WORKOUT_TYPES: { value: WorkoutType; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Conversational pace' },
  { value: 'tempo', label: 'Tempo', description: 'Comfortably hard' },
  { value: 'intervals', label: 'Intervals', description: 'Hard reps with recovery' },
  { value: 'hill', label: 'Hill', description: 'Uphill repeats' },
  { value: 'long', label: 'Long Run', description: 'Slow and long' },
  { value: 'progressive', label: 'Progressive', description: 'Negative split run' },
]

export default function NewWorkoutPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<WorkoutFormData>({
    title: '',
    description: '',
    type: 'easy',
    is_public: true,
    route_geojson: null,
    distance_km: null,
    elevation_gain_m: null,
    elevation_profile: null,
    intervals: [],
  })

  const handleRouteChange = useCallback(
    (route: GeoJSON.Feature | null, distanceKm: number, elevationProfile: number[]) => {
      const gain = elevationProfile.reduce((acc, val, i) => {
        if (i === 0) return acc
        const diff = val - elevationProfile[i - 1]
        return diff > 0 ? acc + diff : acc
      }, 0)

      setForm(prev => ({
        ...prev,
        route_geojson: route,
        distance_km: distanceKm > 0 ? parseFloat(distanceKm.toFixed(2)) : null,
        elevation_gain_m: gain > 0 ? parseFloat(gain.toFixed(1)) : null,
        elevation_profile: elevationProfile.length > 0 ? elevationProfile : null,
      }))
    },
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError('Please enter a workout title.')
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to create a workout.')
      setSaving(false)
      return
    }

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        is_public: form.is_public,
        route_geojson: form.route_geojson,
        distance_km: form.distance_km,
        elevation_gain_m: form.elevation_gain_m,
        elevation_profile: form.elevation_profile,
      })
      .select()
      .single()

    if (workoutError || !workout) {
      setError(workoutError?.message ?? 'Failed to save workout.')
      setSaving(false)
      return
    }

    if (form.intervals.length > 0) {
      const intervalsToInsert = form.intervals.map((interval, i) => ({
        workout_id: workout.id,
        type: interval.type,
        label: interval.label || `Interval ${i + 1}`,
        duration_seconds: interval.duration_seconds,
        distance_km: interval.distance_km,
        pace_min_per_km: interval.pace_min_per_km,
        order: i,
      }))

      const { error: intervalsError } = await supabase
        .from('intervals')
        .insert(intervalsToInsert)

      if (intervalsError) {
        setError(intervalsError.message)
        setSaving(false)
        return
      }
    }

    router.push(`/workouts/${workout.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create Workout</h1>
        <p className="text-gray-400 mt-1">Design your run with a route, intervals, and details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: details */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Workout title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Tuesday Tempo Run"
                className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-green-500 text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="What's the goal of this workout? Any tips or notes?"
                className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-green-500 text-sm resize-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Workout type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WORKOUT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: t.value }))}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                      form.type === t.value
                        ? 'border-green-500 bg-green-500/10 text-white'
                        : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Route stats */}
            {(form.distance_km || form.elevation_gain_m) && (
              <div className="flex gap-4 text-sm">
                {form.distance_km && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
                    <span className="text-gray-400">Distance: </span>
                    <span className="text-white font-semibold">{form.distance_km} km</span>
                  </div>
                )}
                {form.elevation_gain_m && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
                    <span className="text-gray-400">Elevation: </span>
                    <span className="text-white font-semibold">+{form.elevation_gain_m} m</span>
                  </div>
                )}
              </div>
            )}

            {/* Visibility */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, is_public: !prev.is_public }))}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  form.is_public ? 'bg-green-500' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    form.is_public ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-300">
                {form.is_public ? 'Public — visible to everyone' : 'Private — only visible to you'}
              </span>
            </div>

            {/* Intervals */}
            <IntervalBuilder
              intervals={form.intervals}
              onChange={intervals => setForm(prev => ({ ...prev, intervals }))}
            />
          </div>

          {/* Right: map */}
          <div className="h-[500px] lg:h-auto lg:min-h-[500px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Route map <span className="text-gray-500">(optional)</span>
            </label>
            <div className="h-[460px] rounded-xl overflow-hidden border border-gray-700">
              <WorkoutMap editable onRouteChange={handleRouteChange} />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Workout'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-8 py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
