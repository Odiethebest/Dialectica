const LANG_KEY = 'dialectica_lang'

export const LANGS = { EN: 'en', ZH: 'zh' }

export function detectInitialLang() {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  const browser = navigator.language || navigator.userLanguage || ''
  if (browser.startsWith('zh')) return 'zh'
  return 'en'
}

export function saveLang(lang) {
  localStorage.setItem(LANG_KEY, lang)
}
