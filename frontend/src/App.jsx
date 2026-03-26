import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDialectica } from './hooks/useDialectica'
import { saveToHistory } from './utils/history'
import ClaimInput from './components/ClaimInput'
import PipelineStatus from './components/PipelineStatus'
import DialogueThread from './components/DialogueThread'

export default function App() {
  const {
    mode, currentNode,
    coreClaim, claimAssumptions,
    steelmanText, steelmanSources,
    attacks,
    socraticQuestions,
    userResponses,
    synthesis, argumentMap,
    startSession, submitResponses, setUserResponse, reset,
  } = useDialectica()

  const [originalClaim, setOriginalClaim] = useState('')
  const [claim, setClaim] = useState('')
  // Banner shown when URL param auto-starts the session
  const [urlBanner, setUrlBanner] = useState('')

  const completedNodes = useMemo(() => {
    const done = new Set()
    if (coreClaim)                 done.add('understand')
    if (steelmanText)              done.add('steelman')
    if (attacks?.length)           done.add('attack')
    if (socraticQuestions?.length) done.add('interrogate')
    if (synthesis)                 done.add('synthesize')
    return done
  }, [coreClaim, steelmanText, attacks, socraticQuestions, synthesis])

  // Shared auto-submit pattern: fill → 300ms delay → start
  const handleAutoSubmit = useCallback((text) => {
    if (!text || text.trim().length < 3) return
    const trimmed = text.trim()
    setClaim(trimmed)
    saveToHistory(trimmed)
    setTimeout(() => {
      setOriginalClaim(trimmed)
      startSession(trimmed)
    }, 300)
  }, [startSession])

  // Manual begin (no delay — user already decided)
  const handleStart = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    saveToHistory(trimmed)
    setOriginalClaim(trimmed)
    startSession(trimmed)
  }, [startSession])

  const handleReset = () => {
    setOriginalClaim('')
    setClaim('')
    reset()
  }

  // Feature 2 — URL param deep-link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const claimParam = params.get('claim')
    if (!claimParam?.trim()) return

    const decoded = decodeURIComponent(claimParam.trim()).slice(0, 200)
    // Clean URL immediately so a refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname)

    setUrlBanner(decoded)
    setClaim(decoded)

    const bannerTimer = setTimeout(() => setUrlBanner(''), 1500)
    const startTimer  = setTimeout(() => {
      setUrlBanner('')
      handleAutoSubmit(decoded)
    }, 600)

    return () => {
      clearTimeout(bannerTimer)
      clearTimeout(startTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dialectica-page">
      <nav className="d-navbar">
        <span className="d-navbar-wordmark">Dialectica</span>
        {mode !== 'idle' && (
          <button className="d-navbar-new-btn" onClick={handleReset}>
            New argument
          </button>
        )}
      </nav>
      <div className="d-gold-rule" />

      {urlBanner && (
        <div className="d-url-banner">
          Starting with: <em>{urlBanner}</em>
        </div>
      )}

      {mode === 'idle' ? (
        <ClaimInput
          claim={claim}
          onChange={setClaim}
          onSubmit={handleStart}
          onAutoSubmit={handleAutoSubmit}
        />
      ) : (
        <div className="active-container">
          <PipelineStatus currentNode={currentNode} completedNodes={completedNodes} />
          <DialogueThread
            originalClaim={originalClaim}
            mode={mode}
            currentNode={currentNode}
            coreClaim={coreClaim}
            claimAssumptions={claimAssumptions}
            steelmanText={steelmanText}
            steelmanSources={steelmanSources}
            attacks={attacks}
            socraticQuestions={socraticQuestions}
            userResponses={userResponses}
            synthesis={synthesis}
            argumentMap={argumentMap}
            onResponseChange={setUserResponse}
            onSubmitResponses={submitResponses}
          />
        </div>
      )}
    </div>
  )
}
