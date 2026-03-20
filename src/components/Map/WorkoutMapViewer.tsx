'use client'

import { WorkoutMap } from './WorkoutMap'

interface WorkoutMapViewerProps {
  route: GeoJSON.Feature
}

export function WorkoutMapViewer({ route }: WorkoutMapViewerProps) {
  return <WorkoutMap editable={false} route={route} />
}
