'use client'

import { useEffect, useState } from 'react'
import { Workout } from '@/types/workout'
import { WorkoutCard } from './WorkoutCard'
import Link from 'next/link'

interface WorkoutGridProps {
  workouts: Workout[]
  user: { id: string } | null
}

export function WorkoutGrid({ workouts, user }: WorkoutGridProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      () => {} // silently ignore — map cards simply won't have location fallback
    )
  }, [])

  if (workouts.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">No workouts found.</p>
        {user && (
          <Link href="/workouts/new" className="text-green-400 hover:text-green-300 text-sm mt-2 inline-block">
            Be the first to create one
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {workouts.map(workout => (
        <WorkoutCard key={workout.id} workout={workout} userLocation={userLocation} />
      ))}
    </div>
  )
}
