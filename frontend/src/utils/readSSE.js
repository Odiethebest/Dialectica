/**
 * Async generator that parses a Server-Sent Events response.
 * Yields { type: string, data: any } for each complete SSE message.
 */
export async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      let type = 'message'
      let data = ''
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7).trim()
        else if (line.startsWith('data: ')) data = line.slice(6).trim()
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
