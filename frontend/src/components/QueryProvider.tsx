'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

const defaultOptions = {
  queries: {
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 10_000,
  },
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
