import ClaimBlock from './blocks/ClaimBlock'
import UnderstandBlock from './blocks/UnderstandBlock'
import SteelmanBlock from './blocks/SteelmanBlock'
import AttackBlock from './blocks/AttackBlock'
import SocraticBlock from './blocks/SocraticBlock'
import ResponseForm from './blocks/ResponseForm'
import SynthesisBlock from './blocks/SynthesisBlock'

export default function DialogueThread({
  originalClaim,
  sessionId,
  mode,
  currentNode,
  coreClaim,
  claimAssumptions,
  steelmanText,
  steelmanSources,
  attacks,
  socraticQuestions,
  synthesis,
  argumentMap,
  onSubmitResponses,
}) {
  const streaming = (node) => mode === 'streaming' && currentNode === node

  return (
    <div style={{ marginTop: '1.5rem' }}>

      <ClaimBlock claim={originalClaim} />

      {(coreClaim || streaming('understand')) && (
        <UnderstandBlock
          coreClaim={coreClaim}
          claimAssumptions={claimAssumptions}
          isStreaming={streaming('understand')}
        />
      )}

      {(steelmanText || streaming('steelman')) && (
        <SteelmanBlock
          steelmanText={steelmanText}
          steelmanSources={steelmanSources}
          isStreaming={streaming('steelman')}
        />
      )}

      {(attacks?.length > 0 || streaming('attack')) && (
        <AttackBlock
          attacks={attacks}
          isStreaming={streaming('attack')}
        />
      )}

      {(socraticQuestions?.length > 0 || streaming('interrogate')) && (
        <SocraticBlock
          questions={socraticQuestions}
          isStreaming={streaming('interrogate')}
        />
      )}

      {mode === 'awaiting_input' && socraticQuestions?.length > 0 && (
        <ResponseForm
          questions={socraticQuestions}
          sessionId={sessionId}
          onSubmit={onSubmitResponses}
        />
      )}

      {(synthesis || streaming('synthesize')) && (
        <SynthesisBlock
          synthesis={synthesis}
          argumentMap={argumentMap}
          isStreaming={streaming('synthesize')}
        />
      )}

      {mode === 'error' && (
        <p style={{
          fontFamily: 'var(--d-serif)',
          fontSize: 13,
          fontStyle: 'italic',
          color: 'var(--d-attack)',
          marginTop: 8,
        }}>
          Something went wrong. Please try again.
        </p>
      )}

    </div>
  )
}
