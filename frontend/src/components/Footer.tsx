import { Text } from '@tremor/react'

import AppLinkButton from '@/components/ui/AppLinkButton'

type GitHubIconProps = {
  className?: string
}

function GitHubIcon({ className = 'h-4 w-4' }: GitHubIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6V21c-3.3.7-4-1.4-4-1.4-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 .1 2.7 2.1 3.5 2.9.8.7 2.2.5 2.8.4.1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6.1 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.2 11.2 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 3 .1 3.3.8.8 1.2 1.9 1.2 3.2 0 4.8-2.8 5.8-5.5 6.1.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
    </svg>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.88)]">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-[color:rgb(var(--votuna-ink)/0.62)]">
        <Text>
          {`Copyright ${year} Votuna. Open source by `}
          <a
            href="https://johnthorlby.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
          >
            John Thorlby
          </a>
          .
        </Text>
        <Text className="flex flex-wrap items-center gap-3">
          <AppLinkButton
            href="https://github.com/john-9474/votuna"
            target="_blank"
            rel="noreferrer"
            aria-label="Votuna GitHub repository"
            title="Votuna GitHub repository"
            intent="icon"
          >
            <GitHubIcon />
          </AppLinkButton>
        </Text>
      </div>
    </footer>
  )
}
