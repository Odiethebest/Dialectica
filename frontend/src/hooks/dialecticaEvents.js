export const INITIAL = {
  mode: 'idle',           // idle | streaming | awaiting_input | complete | error
  currentNode: null,      // understand | steelman | attack | interrogate | synthesize
  sessionId: null,
  coreClaim: '',
  claimAssumptions: [],
  steelmanText: '',
  steelmanSources: [],
  attacks: [],
  attackUrls: [],
  socraticQuestions: [],
  userResponses: ['', '', ''],
  synthesis: '',
  argumentMap: null,
  error: null,
  errorNode: null,        // which pipeline node failed, when the backend reports one
}

/**
 * Frames after which the pipeline is no longer running. If a stream ends without
 * one of these the UI is stuck mid-flight, so the hook treats that as an error
 * rather than leaving the pipeline spinning forever.
 */
export const TERMINAL_EVENTS = new Set(['awaiting_input', 'complete', 'error'])

function nodePatch(node, out) {
  switch (node) {
    case 'understand':
      return { coreClaim: out.core_claim ?? '', claimAssumptions: out.claim_assumptions ?? [] }
    case 'steelman':
      return { steelmanText: out.steelman_text ?? '', steelmanSources: out.steelman_sources ?? [] }
    case 'attack':
      return { attacks: out.attacks ?? [], attackUrls: out.attack_urls ?? [] }
    case 'interrogate':
      return { socraticQuestions: out.socratic_questions ?? [] }
    case 'synthesize':
      return { synthesis: out.synthesis ?? '', argumentMap: out.argument_map ?? null }
    default:
      return null
  }
}

/**
 * Map one SSE frame to a state patch, or null for frames the UI ignores.
 * `token` is ignored on purpose: the main pipeline renders per node, not per
 * token — only ResponseForm's suggest flow consumes tokens.
 */
export function reduceEvent(type, data = {}) {
  switch (type) {
    case 'session':
      return { sessionId: data.session_id }
    case 'node_start':
      return { currentNode: data.node, mode: 'streaming' }
    case 'node_end':
      return nodePatch(data.node, data.output ?? {})
    case 'awaiting_input':
      return { mode: 'awaiting_input', currentNode: null, socraticQuestions: data.questions ?? [] }
    case 'complete':
      return {
        mode: 'complete',
        currentNode: null,
        synthesis: data.synthesis ?? '',
        argumentMap: data.argument_map ?? null,
      }
    case 'error':
      return { mode: 'error', currentNode: null, error: data.message, errorNode: data.node ?? null }
    default:
      return null
  }
}
