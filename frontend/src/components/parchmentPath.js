/**
 * Generate an irregular torn-paper SVG path for a given width × height.
 * Call once on mount — never on re-render.
 */
export function parchmentPath(width, height, roughness = 6) {
  // Top edge: slight wave, left → right
  const topPts = []
  for (let x = 0; x <= width; x += width / 12) {
    topPts.push([x, 3 + (Math.random() - 0.5) * roughness])
  }

  // Right edge: subtle undulation, top → bottom
  const rightPts = []
  for (let y = 0; y <= height; y += height / 8) {
    rightPts.push([width - 3 + (Math.random() - 0.5) * roughness * 0.6, y])
  }

  // Bottom edge: most torn, larger variance, right → left
  const botPts = []
  for (let x = width; x >= 0; x -= width / 10) {
    botPts.push([x, height - 4 + (Math.random() - 0.5) * roughness * 1.8])
  }

  // Left edge: subtle undulation, bottom → top
  const leftPts = []
  for (let y = height; y >= 0; y -= height / 8) {
    leftPts.push([3 + (Math.random() - 0.5) * roughness * 0.6, y])
  }

  // Stitch all edges with quadratic curves
  const pts = [...topPts, ...rightPts, ...botPts, ...leftPts]
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mid = [
      (pts[i - 1][0] + pts[i][0]) / 2,
      (pts[i - 1][1] + pts[i][1]) / 2,
    ]
    d += ` Q ${pts[i - 1][0]},${pts[i - 1][1]} ${mid[0]},${mid[1]}`
  }
  return d + ' Z'
}
