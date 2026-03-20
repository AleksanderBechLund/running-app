'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { generateRouteSuggestions, SuggestedRoute } from '@/lib/routeSuggestions'
import { ElevationChart } from '@/components/ElevationChart'

const WorkoutMapViewer = dynamic(
  () => import('@/components/Map/WorkoutMapViewer').then(m => m.WorkoutMapViewer),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-800 rounded-xl animate-pulse" /> }
)

type SuggestionType = 'easy' | 'tempo' | 'hill'

const SUGGESTION_TYPES: { value: SuggestionType; label: string; description: string; color: string }[] = [
  { value: 'easy', label: 'Easy Loop', description: '~5km circular route at conversational pace', color: 'blue' },
  { value: 'tempo', label: 'Tempo Out & Back', description: '~8km threshold run, out and back', color: 'orange' },
  { value: 'hill', label: 'Hill Repeats', description: 'Finds nearest hill for power repeats', color: 'yellow' },
]

const COLOR_CLASSES: Record<string, { badge: string; button: string; ring: string }> = {
  blue:   { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',   button: 'bg-blue-500 hover:bg-blue-400',   ring: 'border-blue-500' },
  orange: { badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', button: 'bg-orange-500 hover:bg-orange-400', ring: 'border-orange-500' },
  yellow: { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', button: 'bg-yellow-500 hover:bg-yellow-400', ring: 'border-yellow-500' },
}

function formatPace(pace: number | null): string {
  if (!pace) return '—'
  const mins = Math.floor(pace)
  const secs = Math.round((pace - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /km`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const INTERVAL_COLORS: Record<string, string> = {
  warmup: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  work: 'bg-red-500/20 text-red-300 border-red-500/30',
  rest: 'bg-gray-700/60 text-gray-300 border-gray-600',
  cooldown: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

export default function SuggestPage() {
  const router = useRouter()
  const supabase = createClient()

  const [location, setLocation] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<Partial<Record<SuggestionType, SuggestedRoute | null>>>({})
  const [loading, setLoading] = useState<Partial<Record<SuggestionType, boolean>>>({})

  const [selected, setSelected] = useState<SuggestionType | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const getLocation = useCallback(() => {
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation([pos.coords.longitude, pos.coords.latitude])
        setLocating(false)
      },
      (err) => {
        setLocError(`Could not get your location: ${err.message}`)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const fetchSuggestion = useCallback(async (type: SuggestionType) => {
    if (!location) return
    setLoading(prev => ({ ...prev, [type]: true }))
    setSuggestions(prev => ({ ...prev, [type]: undefined }))
    try {
      const result = await generateRouteSuggestions(location, type)
      setSuggestions(prev => ({ ...prev, [type]: result }))
      setSelected(type)
    } catch {
      setSuggestions(prev => ({ ...prev, [type]: null }))
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }))
    }
  }, [location])

  const handleSave = useCallback(async () => {
    if (!selected) return
    const route = suggestions[selected]
    if (!route) return

    setSaving(true)
    setSaveError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaveError('You must be signed in to save a workout.')
      setSaving(false)
      return
    }

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        title: route.title,
        description: route.description,
        type: route.type,
        is_public: false,
        route_geojson: route.geojson,
        distance_km: route.distanceKm,
        elevation_gain_m: route.elevationGain,
        elevation_profile: route.elevationProfile,
      })
      .select()
      .single()

    if (workoutError || !workout) {
      setSaveError(workoutError?.message ?? 'Failed to save workout.')
      setSaving(false)
      return
    }

    if (route.intervals.length > 0) {
      await supabase.from('intervals').insert(
        route.intervals.map((interval, i) => ({
          workout_id: workout.id,
          type: interval.type,
          label: interval.label,
          duration_seconds: interval.duration_seconds,
          distance_km: interval.distance_km,
          pace_min_per_km: interval.pace_min_per_km,
          order: i,
        }))
      )
    }

    router.push(`/workouts/${workout.id}`)
    router.refresh()
  }, [selected, suggestions, supabase, router])

  const selectedRoute = selected ? suggestions[selected] : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
          AI Route Suggestions
        </h1>
        <p className="text-gray-400 text-base max-w-2xl">
          Share your GPS position and we&apos;ll generate personalised running routes near you — including finding real hills for hill repeats.
        </p>
      </div>

      {/* Step 1: Location */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Step 1 — Your location</h2>
            {location ? (
              <p className="text-sm text-green-400">
                GPS acquired: {location[1].toFixed(5)}&deg;N, {location[0].toFixed(5)}&deg;E
              </p>
            ) : (
              <p className="text-sm text-gray-400">We need your GPS position to generate nearby routes.</p>
            )}
            {locError && <p className="text-sm text-red-400 mt-1">{locError}</p>}
          </div>
          <button
            onClick={getLocation}
            disabled={locating}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            {locating ? 'Locating...' : location ? 'Update location' : 'Get my location'}
          </button>
        </div>
      </div>

      {/* Step 2: Choose workout type */}
      {location && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Step 2 — Choose a workout type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SUGGESTION_TYPES.map(st => {
              const colors = COLOR_CLASSES[st.color]
              const isSelected = selected === st.value
              const isLoading = loading[st.value]
              const result = suggestions[st.value]
              return (
                <div
                  key={st.value}
                  className={`rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected ? `${colors.ring} bg-gray-800` : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                  onClick={() => {
                    if (result !== undefined) {
                      setSelected(st.value)
                    } else {
                      fetchSuggestion(st.value)
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors.badge}`}>
                      {st.label}
                    </span>
                    {result && (
                      <span className="text-xs text-gray-500">{result.distanceKm} km</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{st.description}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchSuggestion(st.value) }}
                    disabled={isLoading}
                    className={`w-full text-xs font-semibold py-2 rounded-lg text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
                  >
                    {isLoading ? 'Generating...' : result !== undefined ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {selectedRoute && (
        <div className="space-y-6">
          {/* Stats bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedRoute.title}</h2>
                <p className="text-gray-400 text-sm mt-1 max-w-xl">{selectedRoute.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  {saving ? 'Saving...' : 'Save as Workout'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-gray-800 rounded-xl px-4 py-2">
                <span className="text-gray-400">Distance </span>
                <span className="text-white font-semibold">{selectedRoute.distanceKm} km</span>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-2">
                <span className="text-gray-400">Elevation gain </span>
                <span className="text-yellow-400 font-semibold">+{selectedRoute.elevationGain} m</span>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-2">
                <span className="text-gray-400">Intervals </span>
                <span className="text-white font-semibold">{selectedRoute.intervals.length}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Map */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="h-[380px] relative">
                <WorkoutMapViewer route={selectedRoute.geojson} />
                {selectedRoute.hillSpots?.map((spot, i) => (
                  <div
                    key={i}
                    className="absolute top-3 left-3 bg-yellow-500/90 text-black text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Hill: {spot.name} ({spot.grade}% grade)
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel: elevation + intervals */}
            <div className="space-y-4">
              {/* Elevation */}
              {selectedRoute.elevationProfile.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <ElevationChart
                    profile={selectedRoute.elevationProfile}
                    distanceKm={selectedRoute.distanceKm}
                  />
                </div>
              )}

              {/* Intervals */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Workout Structure</h3>
                <div className="space-y-2">
                  {selectedRoute.intervals.map((interval, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${INTERVAL_COLORS[interval.type]}`}
                    >
                      <div>
                        <span className="font-semibold capitalize">{interval.type}</span>
                        <span className="ml-2 opacity-80">{interval.label}</span>
                      </div>
                      <div className="flex gap-3 shrink-0 ml-2 opacity-70">
                        {interval.distance_km && <span>{interval.distance_km} km</span>}
                        {interval.pace_min_per_km && <span>{formatPace(interval.pace_min_per_km)}</span>}
                        {interval.duration_seconds && <span>{formatDuration(interval.duration_seconds)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no suggestion generated yet */}
      {location && selected && suggestions[selected] === null && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-gray-400">Could not generate a route suggestion. Try regenerating or check your connection.</p>
        </div>
      )}
    </div>
  )
}
