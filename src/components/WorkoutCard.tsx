import { Workout } from '@/types/workout'
import Link from 'next/link'
import { WorkoutBadge } from './WorkoutBadge'
import { MapPin, TrendingUp, Clock } from 'lucide-react'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TYPE_ACCENT: Record<string, string> = {
  easy: 'bg-blue-500',
  tempo: 'bg-orange-500',
  intervals: 'bg-red-500',
  hill: 'bg-yellow-500',
  long: 'bg-purple-500',
  progressive: 'bg-green-500',
}

function buildRouteMapUrl(geojson: GeoJSON.Feature): string {
  const encoded = encodeURIComponent(JSON.stringify(geojson))
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `geojson(${encoded})/auto/400x180@2x` +
    `?padding=30&access_token=${TOKEN}`
  )
}

function buildLocationMapUrl(lng: number, lat: number): string {
  // Generic area map centred on user when no route is stored
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `pin-s+22c55e(${lng},${lat})/` +
    `${lng},${lat},13/400x180@2x` +
    `?access_token=${TOKEN}`
  )
}

function estimateDuration(workout: Workout): string {
  if (workout.intervals && workout.intervals.length > 0) {
    const total = workout.intervals.reduce((sum, i) => sum + (i.duration_seconds ?? 0), 0)
    if (total > 0) {
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      return h > 0 ? `${h}h ${m}m` : `${m} min`
    }
  }
  if (workout.distance_km) {
    const mins = Math.round(workout.distance_km * 6)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `~${h}h ${m}m` : `~${m} min`
  }
  return '—'
}

interface WorkoutCardProps {
  workout: Workout
  userLocation?: [number, number] | null
}

export function WorkoutCard({ workout, userLocation }: WorkoutCardProps) {
  const hasRoute = !!workout.route_geojson
  const mapUrl = hasRoute
    ? buildRouteMapUrl(workout.route_geojson as GeoJSON.Feature)
    : userLocation
    ? buildLocationMapUrl(userLocation[0], userLocation[1])
    : null

  return (
    <Link href={`/workouts/${workout.id}`}>
      <div className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-green-500/50 hover:bg-gray-900/80 transition-all duration-200 cursor-pointer">
        {/* Accent bar */}
        <div className={`h-1 w-full ${TYPE_ACCENT[workout.type] ?? 'bg-gray-600'}`} />

        {/* Map preview */}
        {mapUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapUrl}
              alt="Route map"
              width={400}
              height={180}
              className="w-full h-36 object-cover"
            />
            {!hasRoute && (
              <div className="absolute bottom-2 right-2 bg-gray-900/80 text-gray-400 text-[10px] px-2 py-1 rounded">
                No route drawn
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-36 bg-gray-800 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-gray-600" />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <WorkoutBadge type={workout.type} />
            {workout.profiles?.full_name && (
              <span className="text-xs text-gray-500 truncate">{workout.profiles.full_name}</span>
            )}
          </div>

          <h3 className="text-base font-semibold text-white group-hover:text-green-400 transition-colors mt-2 mb-1 line-clamp-2">
            {workout.title}
          </h3>

          {workout.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-4">{workout.description}</p>
          )}

          <div className="flex items-center gap-4 mt-auto pt-3 border-t border-gray-800">
            {workout.distance_km && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <MapPin className="w-3.5 h-3.5 text-green-500" />
                <span>{workout.distance_km} km</span>
              </div>
            )}
            {workout.elevation_gain_m && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <TrendingUp className="w-3.5 h-3.5 text-yellow-500" />
                <span>{workout.elevation_gain_m} m</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{estimateDuration(workout)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
