import { useState, useRef, useCallback } from 'react'
import { readSSE } from '../utils/readSSE'
import { INITIAL, TERMINAL_EVENTS, reduceEvent } from './dialecticaEvents'

export function useDialectica() {
  const [state, setState] = useState(INITIAL)
  const sessionIdRef = useRef(null)

  const patch = (updates) => setState(s => ({ ...s, ...updates }))

  /** Returns true if the stream ended in a known terminal state. */
  const processStream = useCallback(async (response) => {
    let sawTerminal = false
    for await (const { type, data } of readSSE(response)) {
      if (type === 'session') sessionIdRef.current = data.session_id
      const update = reduceEvent(type, data)
      if (update) patch(update)
      if (TERMINAL_EVENTS.has(type)) sawTerminal = true
    }
    return sawTerminal
  }, [])

  // A non-2xx response body is not SSE, so readSSE yields nothing and the loop
  // exits immediately. Without these two guards `mode` stayed 'streaming' and the
  // pipeline spun forever with no message — the usual trigger being a 502 while
  // Railway redeploys.
  const run = useCallback(async (url, body, pending) => {
    patch({ ...pending, error: null })
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      if (!await processStream(res)) throw new Error('Connection closed before the pipeline finished.')
    } catch (err) {
      patch({ mode: 'error', currentNode: null, error: err.message })
    }
  }, [processStream])

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
    sessionIdRef.current = null
    setState(INITIAL)
  }, [])

  return { ...state, startSession, submitResponses, setUserResponse, reset }
}
