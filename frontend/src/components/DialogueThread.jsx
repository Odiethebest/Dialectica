import ClaimBlock from './blocks/ClaimBlock'
import UnderstandBlock from './blocks/UnderstandBlock'
import SteelmanBlock from './blocks/SteelmanBlock'
import AttackBlock from './blocks/AttackBlock'
import SocraticBlock from './blocks/SocraticBlock'
import ResponseForm from './blocks/ResponseForm'
import SynthesisBlock from './blocks/SynthesisBlock'
import { t } from '../i18n/strings'

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
  lang = 'en',
}) {
  const streaming = (node) => mode === 'streaming' && currentNode === node

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
        <p style={{
          fontFamily: 'var(--d-serif)',
          fontSize: 13,
          fontStyle: 'italic',
          color: 'var(--d-attack)',
          marginTop: 8,
        }}>
          {t(lang, 'errorMsg')}
        </p>
      )}

    </div>
  )
}
