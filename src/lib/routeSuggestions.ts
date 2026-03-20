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

// Offset a point by meters in a given direction
function offsetPoint(origin: [number, number], bearingDeg: number, distanceM: number): [number, number] {
  const R = 6371000
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (origin[1] * Math.PI) / 180
  const lon1 = (origin[0] * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / R) +
    Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(bearing)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distanceM / R) * Math.cos(lat1),
      Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
    )
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

// Compute 2D distance in degrees between two lon/lat points (approximate, for polygon sampling)
function lngLatDist(a: number[], b: number[]): number {
  const dlng = (a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180)
  const dlat = a[1] - b[1]
  return Math.sqrt(dlng * dlng + dlat * dlat)
}

// Use Mapbox Isochrone API to get a reachable polygon, then pick waypoints evenly by arc-length
async function getIsochroneWaypoints(
  origin: [number, number],
  walkMinutes: number,
  numPoints: number
): Promise<[number, number][]> {
  const url =
    `https://api.mapbox.com/isochrone/v1/mapbox/walking/${origin[0]},${origin[1]}` +
    `?contours_minutes=${walkMinutes}&polygons=true&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const polygon: number[][] = data.features?.[0]?.geometry?.coordinates?.[0]
    if (!polygon || polygon.length < 4) return []

    // Build cumulative arc-length table
    const arcLen: number[] = [0]
    for (let i = 1; i < polygon.length; i++) {
      arcLen.push(arcLen[i - 1] + lngLatDist(polygon[i - 1], polygon[i]))
    }
    const totalLen = arcLen[arcLen.length - 1]

    // Sample numPoints evenly spaced by arc-length (skip the closing duplicate point)
    const waypoints: [number, number][] = []
    for (let k = 0; k < numPoints; k++) {
      const target = (k / numPoints) * totalLen
      // Find the segment containing this arc-length
      let idx = arcLen.findIndex(l => l >= target)
      if (idx <= 0) idx = 0
      const pt = polygon[idx]
      waypoints.push([pt[0], pt[1]])
    }
    return waypoints
  } catch {
    return []
  }
}

async function getDirectionsRoute(
  waypoints: [number, number][]
): Promise<GeoJSON.Feature<GeoJSON.LineString> | null> {
  if (waypoints.length < 2) return null
  // Mapbox Directions supports max 25 waypoints
  const capped = waypoints.slice(0, 25)
  const coords = capped.map(w => w.join(',')).join(';')
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
    `?geometries=geojson&overview=full&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null
    const distanceM: number = data.routes[0].distance
    // Sanity check: reject routes that are absurdly long (ferries, wrong routing)
    if (distanceM > 25000) return null
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
  const step = Math.max(1, Math.floor(coords.length / 30))
  const sampled = coords.filter((_, i) => i % step === 0).slice(0, 30)

  try {
    const elevations = await Promise.all(
      sampled.map(async (coord) => {
        const res = await fetch(
          `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coord[0]},${coord[1]}.json` +
          `?layers=contour&limit=50&access_token=${TOKEN}`
        )
        if (!res.ok) return 0
        const json = await res.json()
        const eles: number[] = (json.features ?? []).map(
          (f: { properties: { ele?: number } }) => f.properties?.ele ?? 0
        )
        return eles.length > 0 ? Math.max(...eles) : 0
      })
    )

    const gain = elevations.reduce((acc, val, i) => {
      if (i === 0) return acc
      const diff = val - elevations[i - 1]
      return diff > 0 ? acc + diff : acc
    }, 0)

    return { profile: elevations, gain: Math.round(gain) }
  } catch {
    return { profile: sampled.map(() => 0), gain: 0 }
  }
}

// Find a nearby hill: sample 8 directions, pick steepest
async function findNearbyHill(
  origin: [number, number]
): Promise<{ point: [number, number]; topPoint: [number, number]; gain: number; bearing: number } | null> {
  const bearings = [0, 45, 90, 135, 180, 225, 270, 315]

  const candidates = await Promise.all(
    bearings.map(async (bearing) => {
      // Sample at 3 distances to find a good hill segment
      const pts = [300, 500, 700, 900].map(d => offsetPoint(origin, bearing, d))
      try {
        const results = await Promise.all(
          pts.map(async p => {
            const res = await fetch(
              `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${p[0]},${p[1]}.json` +
              `?layers=contour&limit=50&access_token=${TOKEN}`
            )
            if (!res.ok) return 0
            const json = await res.json()
            const eles: number[] = (json.features ?? []).map(
              (f: { properties: { ele?: number } }) => f.properties?.ele ?? 0
            )
            return eles.length > 0 ? Math.max(...eles) : 0
          })
        )
        // Find the steepest 400m segment
        let bestGain = 0
        let bestBase = pts[0]
        let bestTop = pts[1]
        for (let i = 0; i < results.length - 1; i++) {
          const g = results[i + 1] - results[i]
          if (g > bestGain) {
            bestGain = g
            bestBase = pts[i]
            bestTop = pts[i + 1]
          }
        }
        return { point: bestBase, topPoint: bestTop, gain: bestGain, bearing }
      } catch {
        return { point: pts[0], topPoint: pts[1], gain: 0, bearing }
      }
    })
  )

  const best = candidates.sort((a, b) => b.gain - a.gain)[0]
  if (best.gain < 10) return null
  return best
}

export async function generateRouteSuggestions(
  origin: [number, number],
  workoutType: 'easy' | 'tempo' | 'hill'
): Promise<SuggestedRoute | null> {

  if (workoutType === 'easy') {
    // Use isochrone (~12 min walk radius ≈ 1km) to get reachable boundary, pick 4 waypoints
    let waypoints = await getIsochroneWaypoints(origin, 12, 4)

    // Fallback: if isochrone fails, try smaller offsets in cardinal directions
    if (waypoints.length < 2) {
      waypoints = [
        origin,
        offsetPoint(origin, 0, 700),
        offsetPoint(origin, 90, 700),
        offsetPoint(origin, 180, 700),
        origin,
      ]
    } else {
      // Close the loop back to origin
      waypoints = [origin, ...waypoints, origin]
    }

    const geojson = await getDirectionsRoute(waypoints)
    if (!geojson) return null

    const coords = geojson.geometry.coordinates
    const distKm = coords.reduce((d, c, i) => {
      if (i === 0) return 0
      const prev = coords[i - 1]
      const dlng = (c[0] - prev[0]) * Math.cos(prev[1] * Math.PI / 180)
      const dlat = c[1] - prev[1]
      return d + Math.sqrt(dlng * dlng + dlat * dlat) * 111
    }, 0)

    const { profile, gain } = await getElevationProfile(coords)

    return {
      id: 'easy-loop',
      title: 'Easy Loop Run',
      description: 'A relaxed loop through your local area — perfect for an easy aerobic run at conversational pace.',
      type: 'easy',
      distanceKm: parseFloat(distKm.toFixed(2)),
      elevationGain: gain,
      elevationProfile: profile,
      geojson,
      intervals: [
        { type: 'warmup', label: 'Easy warm-up', distance_km: 1, pace_min_per_km: 6.5, duration_seconds: 390 },
        { type: 'work', label: 'Easy loop run', distance_km: parseFloat(Math.max(0.5, distKm - 1.5).toFixed(1)), pace_min_per_km: 6.0, duration_seconds: Math.round(Math.max(0.5, distKm - 1.5) * 360) },
        { type: 'cooldown', label: 'Cool-down walk', distance_km: 0.5, pace_min_per_km: null, duration_seconds: 300 },
      ],
    }
  }

  if (workoutType === 'tempo') {
    // Use isochrone (~35 min walking ≈ 4km radius) to get reachable polygon,
    // then pick a point on that boundary as the turnaround — guaranteed on land / walkable paths
    const isoWaypoints = await getIsochroneWaypoints(origin, 35, 8)

    let geojson: GeoJSON.Feature<GeoJSON.LineString> | null = null

    if (isoWaypoints.length >= 2) {
      // Try each isochrone boundary point as a turnaround, pick first that routes OK
      for (const turnaround of isoWaypoints) {
        const candidate = await getDirectionsRoute([origin, turnaround, origin])
        if (candidate) {
          geojson = candidate
          break
        }
      }
    }

    // Fallback: try bearing-based offsets if isochrone failed
    if (!geojson) {
      const bearingsToTry = [0, 45, 90, 135, 180, 225, 270, 315]
      const targetDist = 4000 // 4km out = 8km total
      for (const bearing of bearingsToTry) {
        const turnaround = offsetPoint(origin, bearing, targetDist)
        const mid = offsetPoint(origin, bearing, targetDist / 2)
        const candidate = await getDirectionsRoute([origin, mid, turnaround, mid, origin])
        if (candidate) {
          geojson = candidate
          break
        }
      }
    }

    if (!geojson) return null

    const coords = geojson.geometry.coordinates
    const distKm = coords.reduce((d, c, i) => {
      if (i === 0) return 0
      const prev = coords[i - 1]
      const dlng = (c[0] - prev[0]) * Math.cos(prev[1] * Math.PI / 180)
      const dlat = c[1] - prev[1]
      return d + Math.sqrt(dlng * dlng + dlat * dlat) * 111
    }, 0)

    const { profile, gain } = await getElevationProfile(coords)

    return {
      id: 'tempo',
      title: 'Tempo Out & Back',
      description: 'Warm up, then run out at threshold pace and return. Classic lactate-threshold builder.',
      type: 'tempo',
      distanceKm: parseFloat(distKm.toFixed(2)),
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
    const hill = await findNearbyHill(origin)
    const hillBase = hill?.point ?? offsetPoint(origin, 0, 400)
    const hillTop = hill?.topPoint ?? offsetPoint(origin, 0, 700)

    const toHillRoute = await getDirectionsRoute([origin, hillBase])
    const hillSegment = await getDirectionsRoute([hillBase, hillTop])

    const mainGeojson: GeoJSON.Feature<GeoJSON.LineString> = toHillRoute ?? {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [origin, hillBase, hillTop, hillBase, origin] },
    }

    const allCoords = [
      ...mainGeojson.geometry.coordinates,
      ...(hillSegment?.geometry.coordinates ?? [hillBase, hillTop]),
    ]
    const { profile, gain } = await getElevationProfile(allCoords)

    const actualGain = hill?.gain ?? 30
    const gradePercent = Math.max(1, Math.round((actualGain / 200) * 100))

    return {
      id: 'hill-repeats',
      title: `Hill Repeats — ${gradePercent}% grade nearby`,
      description: `Found a ${actualGain}m elevation gain nearby. ${gradePercent >= 8 ? 'Steep enough for real power work!' : 'A moderate grade — good for form drills.'}`,
      type: 'hill',
      distanceKm: 5,
      elevationGain: actualGain * 6 + gain,
      elevationProfile: profile,
      geojson: mainGeojson,
      intervals: [
        { type: 'warmup', label: 'Jog to the hill', distance_km: 0.5, pace_min_per_km: 6.0, duration_seconds: 300 },
        { type: 'work', label: 'Hill sprint — hard effort', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: 'Hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: 'Hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: 'Hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: 'Hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
        { type: 'rest', label: 'Walk/jog back down', distance_km: null, pace_min_per_km: null, duration_seconds: 90 },
        { type: 'work', label: 'Hill sprint', distance_km: 0.2, pace_min_per_km: null, duration_seconds: 50 },
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
