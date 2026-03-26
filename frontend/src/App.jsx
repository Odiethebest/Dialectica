import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDialectica } from './hooks/useDialectica'
import { saveToHistory } from './utils/history'
import { detectInitialLang, saveLang } from './utils/language'
import { t } from './i18n/strings'
import ClaimInput from './components/ClaimInput'
import PipelineStatus from './components/PipelineStatus'
import DialogueThread from './components/DialogueThread'

function Footer({ lang }) {
  return (
    <footer className="d-footer">
      <div className="d-footer-rule" />
      <p className="d-footer-text">
        {lang === 'zh'
          ? `© ${new Date().getFullYear()} Odie Yang · 保留所有权利`
          : `© ${new Date().getFullYear()} Odie Yang · All rights reserved`}
      </p>
    </footer>
  )
}

export default function App() {
  const {
    mode, currentNode,
    sessionId,
    coreClaim, claimAssumptions,
    steelmanText, steelmanSources,
    attacks,
    socraticQuestions,
    synthesis, argumentMap,
    startSession, submitResponses, reset,
  } = useDialectica()

  const [originalClaim, setOriginalClaim] = useState('')
  const [claim, setClaim] = useState('')
  const [urlBanner, setUrlBanner] = useState('')
  const [lang, setLang] = useState(() => detectInitialLang())

  const switchLang = (newLang) => {
    setLang(newLang)
    saveLang(newLang)
  }

  const completedNodes = useMemo(() => {
    const done = new Set()
    if (coreClaim)                 done.add('understand')
    if (steelmanText)              done.add('steelman')
    if (attacks?.length)           done.add('attack')
    if (socraticQuestions?.length) done.add('interrogate')
    if (synthesis)                 done.add('synthesize')
    return done
  }, [coreClaim, steelmanText, attacks, socraticQuestions, synthesis])

  const handleAutoSubmit = useCallback((text) => {
    if (!text || text.trim().length < 3) return
    const trimmed = text.trim()
    setClaim(trimmed)
    saveToHistory(trimmed)
    setTimeout(() => {
      setOriginalClaim(trimmed)
      startSession(trimmed, lang)
    }, 300)
  }, [startSession, lang])

  const handleStart = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    saveToHistory(trimmed)
    setOriginalClaim(trimmed)
    startSession(trimmed, lang)
  }, [startSession, lang])

  const handleReset = () => {
    setOriginalClaim('')
    setClaim('')
    reset()
  }

  // URL param deep-link: ?claim=...&lang=zh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const claimParam = params.get('claim')
    const langParam  = params.get('lang')

    if (langParam === 'zh' || langParam === 'en') {
      setLang(langParam)
      saveLang(langParam)
    }

    if (!claimParam?.trim()) return

    const decoded = decodeURIComponent(claimParam.trim()).slice(0, 200)
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
    <div className={`dialectica-page lang-${lang}`}>
      <nav className="d-navbar">
        <div className="d-navbar-left">
          <span className="d-navbar-wordmark">Dialectica</span>
          <span className="d-navbar-byline">
            {lang === 'zh' ? '作者：Odie Yang' : 'by Odie Yang'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className="d-lang-btn"
            onClick={() => switchLang(lang === 'en' ? 'zh' : 'en')}
          >
            {lang === 'en' ? 'ZH' : 'EN'}
          </button>
          {mode !== 'idle' && (
            <button className="d-navbar-new-btn" onClick={handleReset}>
              {t(lang, 'newArgBtn')}
            </button>
          )}
        </div>
      </nav>
      <div className="d-gold-rule" />

      {urlBanner && (
        <div className="d-url-banner">
          Starting with: <em>{urlBanner}</em>
        </div>
      )}

      {mode === 'idle' ? (
        <>
          <ClaimInput
            claim={claim}
            onChange={setClaim}
            onSubmit={handleStart}
            onAutoSubmit={handleAutoSubmit}
            lang={lang}
          />
          <Footer lang={lang} />
        </>
      ) : (
        <div className="active-container">
          <PipelineStatus
            currentNode={currentNode}
            completedNodes={completedNodes}
            lang={lang}
          />
          <DialogueThread
            originalClaim={originalClaim}
            sessionId={sessionId}
            mode={mode}
            currentNode={currentNode}
            coreClaim={coreClaim}
            claimAssumptions={claimAssumptions}
            steelmanText={steelmanText}
            steelmanSources={steelmanSources}
            attacks={attacks}
            socraticQuestions={socraticQuestions}
            synthesis={synthesis}
            argumentMap={argumentMap}
            onSubmitResponses={submitResponses}
            lang={lang}
          />
          <Footer lang={lang} />
        </div>
      )}
    </div>
  )
}
