import { useMemo, useState } from 'react'
import { useDialectica } from './hooks/useDialectica'
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

  const completedNodes = useMemo(() => {
    const done = new Set()
    if (coreClaim)                 done.add('understand')
    if (steelmanText)              done.add('steelman')
    if (attacks?.length)           done.add('attack')
    if (socraticQuestions?.length) done.add('interrogate')
    if (synthesis)                 done.add('synthesize')
    return done
  }, [coreClaim, steelmanText, attacks, socraticQuestions, synthesis])

  const handleStart = (claim) => {
    setOriginalClaim(claim)
    startSession(claim)
  }

  const handleReset = () => {
    setOriginalClaim('')
    reset()
  }

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

      {mode === 'idle' ? (
        <ClaimInput onSubmit={handleStart} />
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

