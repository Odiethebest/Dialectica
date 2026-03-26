const HISTORY_KEY = 'dialectica_history'
const MAX_HISTORY = 5

export function saveToHistory(claim) {
  if (!claim || claim.trim().length < 5) return
  const existing = getHistory()
  const filtered = existing.filter(c => c !== claim)
  const updated = [claim, ...filtered].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch (e) {
    // localStorage unavailable — fail silently
  }
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY) } catch (e) {}
}
