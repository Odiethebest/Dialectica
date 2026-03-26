import { useRef, useState } from 'react'

export function useSpeechInput(onTranscript) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = () => {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.continuous = false
    r.interimResults = true
    r.lang = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'

    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(result => result[0].transcript)
        .join('')
      onTranscript(transcript)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)

    r.start()
    recognitionRef.current = r
    setListening(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return { listening, start, stop, supported }
}
