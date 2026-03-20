export type WorkoutType = 'easy' | 'tempo' | 'intervals' | 'hill' | 'long' | 'progressive'

export interface Interval {
  id: string
  workout_id: string
  type: 'work' | 'rest' | 'warmup' | 'cooldown'
  label: string
  duration_seconds: number | null
  distance_km: number | null
  pace_min_per_km: number | null
  order: number
}

export interface Workout {
  id: string
  user_id: string | null
  title: string
  description: string | null
  type: WorkoutType
  is_public: boolean
  route_geojson: GeoJSON.Feature | null
  distance_km: number | null
  elevation_gain_m: number | null
  elevation_profile: number[] | null
  created_at: string
  updated_at: string
  intervals?: Interval[]
  profiles?: { username: string | null; full_name: string | null }
}

export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export interface IntervalFormData {
  type: 'work' | 'rest' | 'warmup' | 'cooldown'
  label: string
  duration_seconds: number | null
  distance_km: number | null
  pace_min_per_km: number | null
}

export interface WorkoutFormData {
  title: string
  description: string
  type: WorkoutType
  is_public: boolean
  route_geojson: GeoJSON.Feature | null
  distance_km: number | null
  elevation_gain_m: number | null
  elevation_profile: number[] | null
  intervals: IntervalFormData[]
}
