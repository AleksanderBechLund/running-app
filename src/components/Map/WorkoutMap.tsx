'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

async function fetchElevationProfile(coordinates: number[][]): Promise<number[]> {
  // Sample up to 50 points evenly along the route
  const maxSamples = 50
  const step = Math.max(1, Math.floor(coordinates.length / maxSamples))
  const sampled = coordinates.filter((_, i) => i % step === 0)

  try {
    const elevations = await Promise.all(
      sampled.map(async (coord) => {
        const res = await fetch(
          `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coord[0]},${coord[1]}.json?layers=contour&limit=1&access_token=${TOKEN}`
        )
        if (!res.ok) return 0
        const json = await res.json()
        return json.features?.[0]?.properties?.ele ?? 0
      })
    )
    return elevations
  } catch {
    return sampled.map((_, i) => 50 + Math.sin(i * 0.3) * 30)
  }
}

interface WorkoutMapProps {
  editable?: boolean
  route?: GeoJSON.Feature | null
  onRouteChange?: (route: GeoJSON.Feature | null, distanceKm: number, elevationProfile: number[]) => void
  initialCenter?: [number, number]
  initialZoom?: number
}

export function WorkoutMap({
  editable = false,
  route,
  onRouteChange,
  initialCenter = [10.7522, 59.9139],
  initialZoom = 12,
}: WorkoutMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRouteUpdate = useCallback(async () => {
    if (!drawRef.current || !onRouteChange) return
    const data = drawRef.current.getAll()
    const line = data.features.find(f => f.geometry.type === 'LineString')
    if (!line) {
      onRouteChange(null, 0, [])
      return
    }

    setLoading(true)
    try {
      const distanceKm = turf.length(line as GeoJSON.Feature<GeoJSON.LineString>, { units: 'kilometers' })
      const coords = (line.geometry as GeoJSON.LineString).coordinates
      const elevationProfile = await fetchElevationProfile(coords)
      onRouteChange(line as GeoJSON.Feature, distanceKm, elevationProfile)
    } finally {
      setLoading(false)
    }
  }, [onRouteChange])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    })

    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
      }),
      'top-right'
    )

    if (editable) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, trash: true },
        defaultMode: 'draw_line_string',
        styles: [
          {
            id: 'gl-draw-line-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.9 },
          },
          {
            id: 'gl-draw-line-static',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['==', 'mode', 'static']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.9 },
          },
          {
            id: 'gl-draw-vertex-halo',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            paint: { 'circle-radius': 8, 'circle-color': '#fff' },
          },
          {
            id: 'gl-draw-vertex',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            paint: { 'circle-radius': 5, 'circle-color': '#22c55e' },
          },
          {
            id: 'gl-draw-midpoint',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
            paint: { 'circle-radius': 4, 'circle-color': '#22c55e', 'circle-opacity': 0.7 },
          },
        ],
      })

      drawRef.current = draw
      map.addControl(draw as unknown as mapboxgl.IControl, 'top-left')

      map.on('draw.create', handleRouteUpdate)
      map.on('draw.update', handleRouteUpdate)
      map.on('draw.delete', handleRouteUpdate)
    } else if (route) {
      map.on('load', () => {
        if (map.getSource('route')) return
        map.addSource('route', { type: 'geojson', data: route })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#22c55e', 'line-width': 4, 'line-opacity': 0.9 },
        })

        if (route.geometry.type === 'LineString') {
          const coords = (route.geometry as GeoJSON.LineString).coordinates
          if (coords.length > 0) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c as [number, number]),
              new mapboxgl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
            )
            map.fitBounds(bounds, { padding: 60, maxZoom: 16 })
          }
        }
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-gray-900/90 text-xs text-white px-3 py-2 rounded-lg">
          Fetching elevation data...
        </div>
      )}
      {editable && (
        <div className="absolute bottom-4 left-4 right-4 bg-gray-900/90 text-xs text-gray-300 px-3 py-2 rounded-lg pointer-events-none text-center">
          Click to draw your route — double-click to finish
        </div>
      )}
    </div>
  )
}
