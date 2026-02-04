import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import Navbar from '../components/Navbar'
import QueryProvider from '../components/QueryProvider'
import ThemeManager from '../components/ThemeManager'
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var stored = localStorage.getItem('votuna-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'system';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.dataset.theme = resolved;
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.className} antialiased`}>
        <div className="min-h-screen">
          <QueryProvider>
            <ThemeManager />
            <Navbar />
            {children}
          </QueryProvider>
        </div>
      </body>
    </html>
  )
}
