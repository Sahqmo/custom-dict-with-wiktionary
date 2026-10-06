import { useEffect, useState } from 'react'

/**
 * 비동기 데이터 훅. 결과에 "어느 요청(deps)의 것인지"를 붙여 둔다.
 * 예전에는 요청이 바뀌어도 이전 data를 loading 플래그가 켜질 때까지(=렌더 한 번 뒤의 effect) 그대로 돌려줘서,
 * 새 단어로 이동한 첫 렌더에서 "이전 단어의 데이터"를 "새 단어의 결과"로 착각하는 경쟁 상태가 있었다.
 * 지금은 deps가 달라진 즉시 loading=true, data=undefined 로 보인다.
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps)
  type S = { key: string; data?: T; error?: string; loading: boolean }
  const [state, setState] = useState<S>({ key, loading: true })
  useEffect(() => {
    let alive = true
    // deps가 바뀌거나 화면을 떠나면 진행 중인 요청을 취소한다 (빠르게 검색어를 바꿀 때 낡은 요청이 쌓이지 않게)
    const ctl = new AbortController()
    setState({ key, loading: true })
    fn(ctl.signal).then(
      (data) => alive && setState({ key, data, loading: false }),
      (e) => alive && setState({ key, error: String(e), loading: false }),
    )
    return () => {
      alive = false
      ctl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state.key === key ? state : { key, loading: true }
}
