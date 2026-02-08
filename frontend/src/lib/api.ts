const apiUrl = process.env.NEXT_PUBLIC_API_URL

if (!apiUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is required in production builds')
}

export const API_URL = apiUrl ?? 'http://localhost:8000'
const AUTH_EXPIRED_HEADER = 'X-Votuna-Auth-Expired'

type ApiFetchOptions = RequestInit & {
  authRequired?: boolean
}

export type ApiError = Error & {
  status?: number
  detail?: string
  rawDetail?: unknown
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { authRequired, ...init } = options
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
  })

  const authExpired = response.headers.get(AUTH_EXPIRED_HEADER) === '1'
  if (authRequired && response.status === 401 && authExpired && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('votuna:auth-expired'))
  }

  return response
}

export async function apiJson<T>(path: string, options: ApiFetchOptions = {}) {
  const response = await apiFetch(path, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const rawDetail = body.detail
    const message =
      typeof rawDetail === 'string'
        ? rawDetail
        : typeof rawDetail?.message === 'string'
          ? rawDetail.message
          : 'Request failed'
    const error: ApiError = new Error(message)
    error.status = response.status
    error.detail = message
    error.rawDetail = rawDetail
    throw error
  }
  return (await response.json()) as T
}

export async function apiJsonOrNull<T>(path: string, options: ApiFetchOptions = {}) {
  const response = await apiFetch(path, options)
  if (!response.ok) {
    return null
  }
  return (await response.json()) as T
}
