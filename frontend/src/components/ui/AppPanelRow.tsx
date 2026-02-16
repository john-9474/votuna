import type { ComponentPropsWithoutRef } from 'react'

type AppPanelRowProps = ComponentPropsWithoutRef<'div'>

const BASE_CLASS =
  'rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3'

export default function AppPanelRow({ className = '', ...props }: AppPanelRowProps) {
  const classes = `${BASE_CLASS} ${className}`.trim()
  return <div className={classes} {...props} />
}
