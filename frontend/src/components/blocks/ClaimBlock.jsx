import ParchmentBlock from '../ParchmentBlock'
import { t } from '../../i18n/strings'

export default function ClaimBlock({ claim, lang = 'en' }) {
  return (
    <ParchmentBlock type="claim" label={t(lang, 'yourClaim')}>
      <p className="block-body" style={{ fontSize: 17 }}>{claim}</p>
    </ParchmentBlock>
  )
}
