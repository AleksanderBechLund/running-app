import { createClient } from '@/lib/supabase/server'
import { WorkoutCard } from '@/components/WorkoutCard'
import { Calculator } from '@/components/Calculator'
import Link from 'next/link'
import { WorkoutType } from '@/types/workout'

const TYPES: { value: WorkoutType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'hill', label: 'Hill' },
  { value: 'long', label: 'Long Run' },
  { value: 'progressive', label: 'Progressive' },
]

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('workouts')
    .select('*, profiles(full_name, username), intervals(*)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (type && type !== 'all') {
    query = query.eq('type', type)
  }

  const { data: workouts } = await query

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          Find your next{' '}
          <span className="text-green-400">run</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Browse community workouts — routes on the map, tempo sessions, hill repeats and more.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/suggest"
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Suggest a Route
          </Link>
          {user && (
            <Link
              href="/workouts/new"
              className="inline-block bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              + Create Workout
            </Link>
          )}
        </div>
        {!user && (
          <p className="mt-3 text-sm text-gray-500">
            <Link href="/auth/register" className="text-green-400 hover:text-green-300">
              Sign up
            </Link>{' '}
            to create and share your own workouts.
          </p>
        )}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TYPES.map(t => (
          <Link
            key={t.value}
            href={t.value === 'all' ? '/' : `/?type=${t.value}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (type ?? 'all') === t.value
                ? 'bg-green-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Workout grid */}
        <div className="lg:col-span-3">
          {workouts && workouts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {workouts.map(workout => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No workouts found.</p>
              {user && (
                <Link href="/workouts/new" className="text-green-400 hover:text-green-300 text-sm mt-2 inline-block">
                  Be the first to create one
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Calculator />

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Workout Types</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><span className="text-blue-400 font-medium">Easy</span> — Conversational pace, aerobic base building</li>
              <li><span className="text-orange-400 font-medium">Tempo</span> — Comfortably hard, ~85–90% max HR</li>
              <li><span className="text-red-400 font-medium">Intervals</span> — Hard repetitions with recovery</li>
              <li><span className="text-yellow-400 font-medium">Hill</span> — Uphill repeats for power & economy</li>
              <li><span className="text-purple-400 font-medium">Long Run</span> — Slow, long, aerobic endurance</li>
              <li><span className="text-green-400 font-medium">Progressive</span> — Start slow, finish fast</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
