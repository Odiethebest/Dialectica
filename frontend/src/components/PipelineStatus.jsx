const NODES = ['understand', 'steelman', 'attack', 'interrogate', 'synthesize']

function nodeState(name, currentNode, completedNodes) {
  if (completedNodes.has(name)) return 'complete'
  if (name === currentNode)     return 'active'
  return 'pending'
}

export default function PipelineStatus({ currentNode, completedNodes }) {
  return (
    <div className="pipeline">
      {NODES.map((name, i) => {
        const state = nodeState(name, currentNode, completedNodes)
        const labelColor = state === 'active'
          ? 'var(--d-maroon)'
          : state === 'complete'
          ? 'var(--d-maroon)'
          : 'var(--d-muted)'

        return (
          <div key={name} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div className="pipeline-node">
              <div className={`pipeline-node-dot ${state}`}>
                {state === 'complete' ? '✓' : state === 'active' ? '●' : '○'}
              </div>
              <span className="pipeline-node-label" style={{ color: labelColor }}>
                {name}
              </span>
            </div>
            {i < NODES.length - 1 && (
              <div className="pipeline-connector" />
            )}
          </div>
        )
      })}
    </div>
  )
}
