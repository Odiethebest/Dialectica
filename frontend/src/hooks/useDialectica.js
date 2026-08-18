import { useState, useRef, useCallback } from 'react'
import { INITIAL, drainStream } from './dialecticaEvents'

export function useDialectica() {
  const [state, setState] = useState(INITIAL)
  const sessionIdRef = useRef(null)
  const abortRef = useRef(null)
  const runIdRef = useRef(0)

  const patch = (updates) => setState(s => ({ ...s, ...updates }))

  /**
   * Abort whatever is in flight and claim the next run id. "New argument" is
   * offered throughout the 20-40s pipeline, so an old run being left to finish
   * was the normal case, not an edge case.
   */
  const supersede = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    runIdRef.current += 1
    return runIdRef.current
  }, [])

  const run = useCallback(async (url, body, pending) => {
    const runId = supersede()
    const controller = new AbortController()
    abortRef.current = controller
    patch({ ...pending, error: null })

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      // A non-2xx body is not SSE, so the reader yields nothing and the loop ends
      // at once. Without this the UI stayed on 'streaming' with no message.
      if (!res.ok) throw new Error(`Server error (${res.status})`)

      const { terminal, cancelled } = await drainStream(res, {
        onPatch: (update) => {
          if (update.sessionId) sessionIdRef.current = update.sessionId
          patch(update)
        },
        isCancelled: () => runIdRef.current !== runId,
      })
      if (cancelled) return
      if (!terminal) throw new Error('Connection closed before the pipeline finished.')
    } catch (err) {
      if (controller.signal.aborted || runIdRef.current !== runId) return
      patch({ mode: 'error', currentNode: null, error: err.message })
    }
  }, [supersede])

  const startSession = useCallback((claim, lang = 'en') =>
    run('/dialectica/start', { claim, lang }, { mode: 'streaming', currentNode: null }), [run])

  const submitResponses = useCallback((responses) => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    return run('/dialectica/respond', { session_id: sessionId, responses },
      { mode: 'streaming', currentNode: 'synthesize' })
  }, [run])

  const setUserResponse = useCallback((index, value) => {
    setState(s => {
      const responses = [...s.userResponses]
      responses[index] = value
      return { ...s, userResponses: responses }
    })
  }, [])

  const reset = useCallback(() => {
    supersede()
    sessionIdRef.current = null
    setState(INITIAL)
  }, [supersede])

  return { ...state, startSession, submitResponses, setUserResponse, reset }
}
