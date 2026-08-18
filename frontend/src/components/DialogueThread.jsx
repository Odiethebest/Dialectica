import ClaimBlock from './blocks/ClaimBlock'
import UnderstandBlock from './blocks/UnderstandBlock'
import SteelmanBlock from './blocks/SteelmanBlock'
import AttackBlock from './blocks/AttackBlock'
import SocraticBlock from './blocks/SocraticBlock'
import ResponseForm from './blocks/ResponseForm'
import SynthesisBlock from './blocks/SynthesisBlock'
import { t } from '../i18n/strings'

const PIPELINE_NODES = ['understand', 'steelman', 'attack', 'interrogate', 'synthesize']

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
  attackUrls,
  socraticQuestions,
  synthesis,
  argumentMap,
  onSubmitResponses,
  error,
  errorNode,
  lang = 'en',
}) {
  const streaming = (node) => mode === 'streaming' && currentNode === node

  // Name the stage that failed, using the same localized labels as PipelineStatus
  const failedStage = (() => {
    const i = PIPELINE_NODES.indexOf(errorNode)
    return i >= 0 ? t(lang, 'pipelineNodes')[i] : null
  })()

  return (
    <div style={{ marginTop: '1.5rem' }}>

      <ClaimBlock claim={originalClaim} lang={lang} />

      {(coreClaim || streaming('understand')) && (
        <UnderstandBlock
          coreClaim={coreClaim}
          claimAssumptions={claimAssumptions}
          isStreaming={streaming('understand')}
          lang={lang}
        />
      )}

      {(steelmanText || streaming('steelman')) && (
        <SteelmanBlock
          steelmanText={steelmanText}
          steelmanSources={steelmanSources}
          isStreaming={streaming('steelman')}
          lang={lang}
        />
      )}

      {(attacks?.length > 0 || streaming('attack')) && (
        <AttackBlock
          attacks={attacks}
          attackUrls={attackUrls}
          isStreaming={streaming('attack')}
          lang={lang}
        />
      )}

      {(socraticQuestions?.length > 0 || streaming('interrogate')) && (
        <SocraticBlock
          questions={socraticQuestions}
          isStreaming={streaming('interrogate')}
          lang={lang}
        />
      )}

      {mode === 'awaiting_input' && socraticQuestions?.length > 0 && (
        <ResponseForm
          questions={socraticQuestions}
          sessionId={sessionId}
          onSubmit={onSubmitResponses}
          lang={lang}
        />
      )}

      {(synthesis || streaming('synthesize')) && (
        <SynthesisBlock
          synthesis={synthesis}
          argumentMap={argumentMap}
          isStreaming={streaming('synthesize')}
          lang={lang}
        />
      )}

      {mode === 'error' && (
        <p title={error || undefined} style={{
          fontFamily: 'var(--d-serif)',
          fontSize: 13,
          fontStyle: 'italic',
          color: 'var(--d-attack)',
          marginTop: 8,
        }}>
          {failedStage ? `${failedStage} · ${t(lang, 'errorMsg')}` : t(lang, 'errorMsg')}
        </p>
      )}

    </div>
  )
}
