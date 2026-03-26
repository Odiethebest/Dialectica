export default function ClaimBlock({ claim }) {
  return (
    <div
      className="dialogue-block"
      style={{ borderLeft: '2px solid var(--d-bg3)', background: 'var(--d-bg2)' }}
    >
      <div className="block-label" style={{ color: 'var(--d-muted)' }}>Your claim</div>
      <p className="block-body" style={{ fontSize: 17 }}>{claim}</p>
    </div>
  )
}
