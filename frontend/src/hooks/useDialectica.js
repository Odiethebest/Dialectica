import { useState, useRef, useCallback } from 'react'

const INITIAL = {
  mode: 'idle',           // idle | streaming | awaiting_input | complete | error
  currentNode: null,      // understand | steelman | attack | interrogate | synthesize
  sessionId: null,
  coreClaim: '',
  claimAssumptions: [],
  steelmanText: '',
  steelmanSources: [],
  attacks: [],
  attackSources: [],
  socraticQuestions: [],
  userResponses: ['', '', ''],
  synthesis: '',
  argumentMap: null,
  error: null,
}

async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    // SSE messages are separated by double newline
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      let type = 'message'
      let data = ''
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7).trim()
        else if (line.startsWith('data: '))  data = line.slice(6).trim()
      }
      if (!data) continue
      try {
        yield { type, data: JSON.parse(data) }
      } catch {
        // ignore malformed data
      }
    }
  }
}

export function useDialectica() {
  const [state, setState] = useState(INITIAL)
  const sessionIdRef = useRef(null)

  const patch = (updates) => setState(s => ({ ...s, ...updates }))

  const processStream = useCallback(async (response) => {
    for await (const { type, data } of readSSE(response)) {
      switch (type) {
        case 'session':
          sessionIdRef.current = data.session_id
          patch({ sessionId: data.session_id })
          break

        case 'node_start':
          patch({ currentNode: data.node, mode: 'streaming' })
          break

        case 'node_end': {
          const { node, output } = data
          if (node === 'understand') {
            patch({
              coreClaim: output.core_claim ?? '',
              claimAssumptions: output.claim_assumptions ?? [],
            })
          } else if (node === 'steelman') {
            patch({
              steelmanText: output.steelman_text ?? '',
              steelmanSources: output.steelman_sources ?? [],
            })
          } else if (node === 'attack') {
            patch({
              attacks: output.attacks ?? [],
              attackSources: output.attack_sources ?? [],
            })
          } else if (node === 'interrogate') {
            patch({ socraticQuestions: output.socratic_questions ?? [] })
          } else if (node === 'synthesize') {
            patch({
              synthesis: output.synthesis ?? '',
              argumentMap: output.argument_map ?? null,
            })
          }
          break
        }

        case 'awaiting_input':
          patch({
            mode: 'awaiting_input',
            currentNode: null,
            socraticQuestions: data.questions ?? [],
          })
          break

        case 'complete':
          patch({
            mode: 'complete',
            currentNode: null,
            synthesis: data.synthesis ?? '',
            argumentMap: data.argument_map ?? null,
          })
          break

        case 'error':
          patch({ mode: 'error', currentNode: null, error: data.message })
          break

        default:
          break
      }
    }
  }, [])

  const startSession = useCallback(async (claim) => {
    patch({ mode: 'streaming', currentNode: null, error: null })
    try {
      const res = await fetch('/dialectica/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
      })
      await processStream(res)
    } catch (err) {
      patch({ mode: 'error', error: err.message })
    }
  }, [processStream])

  const submitResponses = useCallback(async (responses) => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    patch({ mode: 'streaming', currentNode: 'synthesize', error: null })
    try {
      const res = await fetch('/dialectica/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, responses }),
      })
      await processStream(res)
    } catch (err) {
      patch({ mode: 'error', error: err.message })
    }
  }, [processStream])

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
