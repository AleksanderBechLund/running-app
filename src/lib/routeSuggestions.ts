import { WorkoutType } from '@/types/workout'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export interface SuggestedRoute {
  id: string
  title: string
  description: string
  type: WorkoutType
  distanceKm: number
  elevationGain: number
  elevationProfile: number[]
  geojson: GeoJSON.Feature<GeoJSON.LineString>
  intervals: Array<{
    type: 'warmup' | 'work' | 'rest' | 'cooldown'
    label: string
    distance_km: number | null
    pace_min_per_km: number | null
    duration_seconds: number | null
  }>
  hillSpots?: Array<{ lng: number; lat: number; grade: number; name: string }>
}

// Generate waypoints for a circular loop route
function loopWaypoints(
  origin: [number, number],
  radiusKm: number,
  numPoints: number = 4
): [number, number][] {
  const R = 6371
  const points: [number, number][] = [origin]
  for (let i = 1; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI
    const dx = (radiusKm * Math.cos(angle)) / R * (180 / Math.PI) / Math.cos(origin[1] * Math.PI / 180)
    const dy = (radiusKm * Math.sin(angle)) / R * (180 / Math.PI)
    points.push([origin[0] + dx, origin[1] + dy])
  }
  points.push(origin) // close the loop
  return points
}

// Generate waypoints for out-and-back
function outAndBackWaypoints(
  origin: [number, number],
  distanceKm: number,
  bearingDeg: number
): [number, number][] {
  const R = 6371
  const d = distanceKm / 2 // go half the distance out
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (origin[1] * Math.PI) / 180
  const lon1 = (origin[0] * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(bearing)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d / R) * Math.cos(lat1),
      Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
    )
  const turnaround: [number, number] = [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
  // Add mid-point for variation
  const midLng = (origin[0] + turnaround[0]) / 2
  const midLat = (origin[1] + turnaround[1]) / 2
  return [origin, [midLng, midLat], turnaround, [midLng, midLat], origin]
}

// Offset a point by meters in a given direction (for hill repeats)
function offsetPoint(origin: [number, number], bearingDeg: number, distanceM: number): [number, number] {
  const R = 6371000
  const d = distanceM
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (origin[1] * Math.PI) / 180
  const lon1 = (origin[0] * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(bearing)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d / R) * Math.cos(lat1),
      Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
    )
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

async function getDirectionsRoute(waypoints: [number, number][]): Promise<GeoJSON.Feature<GeoJSON.LineString> | null> {
  const coords = waypoints.map(w => w.join(',')).join(';')
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null
    return {
      type: 'Feature',
      properties: {},
      geometry: data.routes[0].geometry,
    }
  } catch {
    return null
  }
}

async function getElevationProfile(coords: number[][]): Promise<{ profile: number[]; gain: number }> {
  const step = Math.max(1, Math.floor(coords.length / 40))
  const sampled = coords.filter((_, i) => i % step === 0).slice(0, 40)

  try {
    const elevations = await Promise.all(
      sampled.map(async (coord) => {
        const res = await fetch(
          `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coord[0]},${coord[1]}.json?layers=contour&limit=1&access_token=${TOKEN}`
        )
        if (!res.ok) return 50
        const json = await res.json()
        return json.features?.[0]?.properties?.ele ?? 50
      })
    )

    const gain = elevations.reduce((acc, val, i) => {
      if (i === 0) return acc
      const diff = val - elevations[i - 1]
      return diff > 0 ? acc + diff : acc
    }, 0)

    return { profile: elevations, gain: Math.round(gain) }
  } catch {
    return { profile: sampled.map(() => 50), gain: 0 }
  }
}

// Find a nearby hill by sampling elevation in multiple directions
async function findNearbyHill(
  origin: [number, number]
): Promise<{ point: [number, number]; topPoint: [number, number]; gain: number; bearing: number } | null> {
  // Sample 8 directions, look for a hill 300-600m away
  const bearings = [0, 45, 90, 135, 180, 225, 270, 315]
  const hillDistance = 400 // meters to the hill start

  const candidates = await Promise.all(
    bearings.map(async (bearing) => {
      const hillBase = offsetPoint(origin, bearing, hillDistance)
      const hillTop = offsetPoint(origin, bearing, hillDistance + 250)

      try {
        const [baseRes, topRes] = await Promise.all([
          fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${hillBase[0]},${hillBase[1]}.json?layers=contour&limit=1&access_token=${TOKEN}`),
          fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${hillTop[0]},${hillTop[1]}.json?layers=contour&limit=1&access_token=${TOKEN}`)
        ])
        const baseJson = await baseRes.json()
        const topJson = await topRes.json()
        const baseEle = baseJson.features?.[0]?.properties?.ele ?? 0
        const topEle = topJson.features?.[0]?.properties?.ele ?? 0
        const gain = topEle - baseEle
        return { point: hillBase, topPoint: hillTop, gain, bearing }
      } catch {
        return { point: hillBase, topPoint: hillTop, gain: 0, bearing }
      }
    })
  )

  // Pick the direction with the most elevation gain
  const best = candidates.sort((a, b) => b.gain - a.gain)[0]
  if (best.gain < 10) return null // No significant hill found
  return best
}

export async function generateRouteSuggestions(
  origin: [number, number],
  workoutType: 'easy' | 'tempo' | 'hill'
): Promise<SuggestedRoute | null> {
  if (workoutType === 'easy') {
    // 5km easy loop
    const waypoints = loopWaypoints(origin, 0.8, 4)
    const geojson = await getDirectionsRoute(waypoints)
    if (!geojson) return null
    const coords = geojson.geometry.coordinates
    const distKm = coords.length > 1
      ? coords.reduce((d, c, i) => {
          if (i === 0) return 0
          const prev = coords[i - 1]
          const dlng = (c[0] - prev[0]) * Math.cos(prev[1] * Math.PI / 180)
          const dlat = c[1] - prev[1]
          return d + Math.sqrt(dlng * dlng + dlat * dlat) * 111
        }, 0)
      : 5
    const { profile, gain } = await getElevationProfile(coords)
    return {
      id: 'easy-loop',
      title: 'Easy 5km Loop',
      description: 'A relaxed circular loop near you — perfect for an easy aerobic run at conversational pace.',
      type: 'easy',
      distanceKm: parseFloat(distKm.toFixed(2)),
      elevationGain: gain,
      elevationProfile: profile,
      geojson,
      intervals: [
        { type: 'warmup', label: 'Easy warm-up', distance_km: 1, pace_min_per_km: 6.5, duration_seconds: 390 },
        { type: 'work', label: 'Easy loop run', distance_km: parseFloat((distKm - 1.5).toFixed(1)), pace_min_per_km: 6.0, duration_seconds: Math.round((distKm - 1.5) * 360) },
        { type: 'cooldown', label: 'Cool-down walk', distance_km: 0.5, pace_min_per_km: null, duration_seconds: 300 },
      ],
    }
  }

  if (workoutType === 'tempo') {
    // 8km tempo out-and-back heading north
    const bearing = Math.random() * 360
    const waypoints = outAndBackWaypoints(origin, 8, bearing)
    const geojson = await getDirectionsRoute(waypoints)
    if (!geojson) return null
    const coords = geojson.geometry.coordinates
    const { profile, gain } = await getElevationProfile(coords)
    return {
      id: 'tempo',
      title: 'Tempo Out & Back',
      description: 'Warm up, then run out at threshold pace and return. Classic lactate-threshold builder.',
      type: 'tempo',
      distanceKm: 8,
      elevationGain: gain,
      elevationProfile: profile,
      geojson,
      intervals: [
        { type: 'warmup', label: 'Easy warm-up jog', distance_km: 2, pace_min_per_km: 6.0, duration_seconds: 720 },
        { type: 'work', label: 'Threshold pace out', distance_km: 2, pace_min_per_km: 4.5, duration_seconds: 540 },
        { type: 'work', label: 'Threshold pace back', distance_km: 2, pace_min_per_km: 4.5, duration_seconds: 540 },
        { type: 'cooldown', label: 'Easy cool-down jog', distance_km: 2, pace_min_per_km: 6.5, duration_seconds: 780 },
      ],
    }
  }

  if (workoutType === 'hill') {
    // Find the best nearby hill
    const hill = await findNearbyHill(origin)
    const hillBase = hill?.point ?? offsetPoint(origin, 0, 400)
    const hillTop = hill?.topPoint ?? offsetPoint(origin, 0, 650)
    const bearing = hill?.bearing ?? 0

    // Route: from origin to hill base
    const toHillRoute = await getDirectionsRoute([origin, hillBase])
    const hillRoute = await getDirectionsRoute([hillBase, hillTop])

    // Combine: warm-up jog to hill, then 6 repeats up and down, jog back
    const mainGeojson: GeoJSON.Feature<GeoJSON.LineString> = toHillRoute ?? {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [origin, hillBase, hillTop, hillBase, origin] },
    }

    // Build elevation profile
    const coords = mainGeojson.geometry.coordinates
    const { profile, gain } = await getElevationProfile([
      ...coords,
      ...(hillRoute?.geometry.coordinates ?? [hillBase, hillTop]),
    ])

    const actualGain = hill?.gain ?? 40
    const gradePercent = hill ? Math.round((hill.gain / 250) * 100) : 8

    return {
      id: 'hill-repeats',
      title: `Hill Repeats — ${gradePercent}% grade nearby`,
      description: `Found a ${actualGain}m hill ${Math.round(400 / 1000 * 10) / 10}km from your location. ${gradePercent >= 8 ? 'Steep enough for real power work!' : 'A moderate grade — good for form drills.'}`,
      type: 'hill',
      distanceKm: 7,
      elevationGain: actualGain * 8 + gain,
      elevationProfile: profile,
      geojson: mainGeojson,
      intervals: [
        { type: 'warmup', label: 'Jog to the hill', distance_km: 0.5, pace_min_per_km: 6.0, duration_seconds: 300 },
        { type: 'work', label: '200m hill sprint — hard effort', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: '200m hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: '200m hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: '200m hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: '200m hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: '200m hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'cooldown', label: 'Easy jog back home', distance_km: 0.5, pace_min_per_km: 6.5, duration_seconds: 330 },
      ],
      hillSpots: hill
        ? [{ lng: hillBase[0], lat: hillBase[1], grade: gradePercent, name: `${actualGain}m hill` }]
        : undefined,
    }
  }

  return null
}
