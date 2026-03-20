import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RunInspire — Find Your Next Workout',
  description: 'Discover running routes, tempo sessions, hill workouts and more.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-gray-950 text-white min-h-screen">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
