import { useCallback, useEffect, useState, type DependencyList } from 'react'

type AsyncState<T> = { data: T | undefined; error: Error | null; loading: boolean }

/** 비동기 데이터 불러오기. deps 가 바뀌면 다시 불러오고, 늦게 도착한 이전 응답은 버린다. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: null, loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, error: null, loading: true }))
    fn().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) =>
        !cancelled &&
        setState({ data: undefined, error: error instanceof Error ? error : new Error(String(error)), loading: false }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
