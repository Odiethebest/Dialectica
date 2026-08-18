const LANG_KEY = 'dialectica_lang'

export const LANGS = { EN: 'en', ZH: 'zh' }

/**
 * Reading localStorage throws outright where storage is blocked — Safari private
 * mode, embedded webviews, an iframe denied third-party storage. detectInitialLang
 * runs inside a useState initialiser on the very first render, so an unguarded
 * throw took the whole page down. history.js already guarded this; this file did not.
 */
function readStored() {
  try {
    return localStorage.getItem(LANG_KEY)
  } catch {
    return null
  }
}

export function detectInitialLang() {
  const saved = readStored()
  if (saved === LANGS.ZH || saved === LANGS.EN) return saved

  const nav = typeof navigator !== 'undefined' ? navigator : null
  const browser = (nav && (nav.language || nav.userLanguage)) || ''
  return browser.startsWith('zh') ? LANGS.ZH : LANGS.EN
}

export function saveLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // Storage blocked — the toggle still works for this page view.
  }
}
