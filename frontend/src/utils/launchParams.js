export const MAX_CLAIM_LENGTH = 200

/**
 * Read the ?claim= / ?lang= deep-link parameters.
 *
 * URLSearchParams already percent-decodes, so the value is taken as-is. Running
 * decodeURIComponent over it a second time throws URIError on any claim
 * containing a '%' ("90% of startups fail"), and the throw happened inside a
 * mount effect with no boundary above it, which blanked the page.
 */
export function readLaunchParams(search) {
  const params = new URLSearchParams(search)
  const claim = params.get('claim')?.trim()
  const lang = params.get('lang')
  return {
    claim: claim ? claim.slice(0, MAX_CLAIM_LENGTH) : null,
    lang: lang === 'zh' || lang === 'en' ? lang : null,
  }
}
