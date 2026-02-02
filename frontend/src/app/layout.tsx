import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import Navbar from '../components/Navbar'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Votuna',
  description: 'Votuna - Voting Platform',
}

/** Root layout shell for the application. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className} antialiased`}>
        <div className="min-h-screen">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  )
}
