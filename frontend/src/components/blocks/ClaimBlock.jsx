import ParchmentBlock from '../ParchmentBlock'

export default function ClaimBlock({ claim }) {
  return (
    <ParchmentBlock type="claim" label="Your claim">
      <p className="block-body" style={{ fontSize: 17 }}>{claim}</p>
    </ParchmentBlock>
  )
}
