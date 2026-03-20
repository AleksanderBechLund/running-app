import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { WorkoutBadge } from '@/components/WorkoutBadge'
import { ElevationChart } from '@/components/ElevationChart'
import { WorkoutMapViewer } from '@/components/Map/WorkoutMapViewer'
import { MapPin, TrendingUp, Clock, User, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { DeleteWorkoutButton } from '@/components/DeleteWorkoutButton'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s > 0 ? s + 's' : ''}`
  return `${s}s`
}

function formatPace(paceMinPerKm: number): string {
  const min = Math.floor(paceMinPerKm)
  const sec = Math.round((paceMinPerKm - min) * 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

const intervalTypeColor: Record<string, string> = {
  warmup: 'border-blue-500 bg-blue-500/10',
  work: 'border-red-500 bg-red-500/10',
  rest: 'border-green-500 bg-green-500/10',
  cooldown: 'border-purple-500 bg-purple-500/10',
}

const intervalTypeLabel: Record<string, string> = {
  warmup: 'Warm-up',
  work: 'Work',
  rest: 'Rest',
  cooldown: 'Cool-down',
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: workout } = await supabase
    .from('workouts')
    .select('*, profiles(full_name, username), intervals(*)')
    .eq('id', id)
    .single()

  if (!workout) notFound()

  // Check access
  if (!workout.is_public && workout.user_id !== user?.id) {
    redirect('/')
  }

  const isOwner = user?.id === workout.user_id
  const intervals = (workout.intervals ?? []).sort((a: { order: number }, b: { order: number }) => a.order - b.order)
  const elevationProfile = workout.elevation_profile as number[] | null

  const totalWorkSeconds = intervals
    .filter((i: { type: string }) => i.type === 'work')
    .reduce((sum: number, i: { duration_seconds: number | null }) => sum + (i.duration_seconds ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <WorkoutBadge type={workout.type} size="md" />
            {!workout.is_public && (
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">Private</span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white">{workout.title}</h1>
          {workout.profiles?.full_name && (
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {workout.profiles.full_name}
            </p>
          )}
        </div>
        {isOwner && (
          <div className="flex gap-2 flex-shrink-0">
            <DeleteWorkoutButton id={workout.id} />
          </div>
        )}
      </div>

      {workout.description && (
        <p className="text-gray-300 mb-6 text-base leading-relaxed max-w-2xl">{workout.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {workout.distance_km && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-green-400" />
              Distance
            </div>
            <p className="text-xl font-bold text-white">{workout.distance_km} km</p>
          </div>
        )}
        {workout.elevation_gain_m && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
              Elevation gain
            </div>
            <p className="text-xl font-bold text-white">{workout.elevation_gain_m} m</p>
          </div>
        )}
        {totalWorkSeconds > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Work time
            </div>
            <p className="text-xl font-bold text-white">{formatDuration(totalWorkSeconds)}</p>
          </div>
        )}
        {intervals.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Intervals
            </div>
            <p className="text-xl font-bold text-white">
              {intervals.filter((i: { type: string }) => i.type === 'work').length} work sets
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Map */}
        <div className="lg:col-span-3 space-y-4">
          {workout.route_geojson ? (
            <div className="rounded-xl overflow-hidden h-72 border border-gray-800">
              <WorkoutMapViewer route={workout.route_geojson} />
            </div>
          ) : (
            <div className="rounded-xl h-72 border border-dashed border-gray-700 flex items-center justify-center text-gray-500 text-sm">
              No route map for this workout
            </div>
          )}

          {elevationProfile && workout.distance_km && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <ElevationChart
                profile={elevationProfile}
                distanceKm={workout.distance_km}
              />
            </div>
          )}
        </div>

        {/* Intervals */}
        <div className="lg:col-span-2">
          {intervals.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white mb-3">Workout Structure</h2>
              {intervals.map((interval: {
                id: string
                type: string
                label: string
                distance_km: number | null
                pace_min_per_km: number | null
                duration_seconds: number | null
              }) => (
                <div
                  key={interval.id}
                  className={`rounded-xl border-l-4 px-4 py-3 ${intervalTypeColor[interval.type] ?? 'border-gray-700 bg-gray-800'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {intervalTypeLabel[interval.type] ?? interval.type}
                      </span>
                      <p className="text-sm font-medium text-white mt-0.5">{interval.label}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400 space-y-0.5 ml-4 flex-shrink-0">
                      {interval.distance_km && <p>{interval.distance_km} km</p>}
                      {interval.pace_min_per_km && <p>{formatPace(interval.pace_min_per_km)}</p>}
                      {interval.duration_seconds && <p>{formatDuration(interval.duration_seconds)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No intervals defined for this workout.</div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Back to workouts
        </Link>
      </div>
    </div>
  )
}
