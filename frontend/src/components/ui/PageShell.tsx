import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  maxWidth?: '4xl' | '6xl'
  className?: string
}

export default function PageShell({
  children,
  maxWidth = '6xl',
  className = '',
}: PageShellProps) {
  const maxWidthClass = maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-6xl'
  const classes = `mx-auto w-full ${maxWidthClass} px-6 pt-6 pb-16 ${className}`.trim()
  return <main className={classes}>{children}</main>
}
