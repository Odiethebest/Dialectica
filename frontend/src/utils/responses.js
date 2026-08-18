const ROMAN = ['I', 'II', 'III', 'IV', 'V']

/** Roman numeral for a 0-based index, falling back to the plain number. */
export function numeral(i) {
  return ROMAN[i] ?? String(i + 1)
}

/**
 * True when every question has a non-empty answer.
 *
 * Driven by `questions`, not by a fixed-length answers array. The form used to
 * hold exactly three slots while the interrogate node only promises three
 * questions in its prompt — a run that came back with two left a third slot that
 * was never rendered and could never be filled, so submit stayed disabled and
 * the only way out was starting over.
 */
export function allAnswered(questions, responses) {
  return questions.length > 0 &&
    questions.every((_, i) => (responses[i] ?? '').trim() !== '')
}
