'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteWorkoutButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setLoading(true)
    await supabase.from('workouts').delete().eq('id', id)
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors ${
        confirming
          ? 'bg-red-500 text-white hover:bg-red-400'
          : 'bg-gray-800 text-gray-400 hover:text-red-400'
      }`}
    >
      <Trash2 className="w-4 h-4" />
      {confirming ? 'Confirm delete' : 'Delete'}
    </button>
  )
}
