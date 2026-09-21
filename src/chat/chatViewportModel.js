export function getChatViewportMetrics({ visualViewport, innerHeight = 0 } = {}) {
  const visualHeight = Number(visualViewport?.height)
  const fallbackHeight = Number(innerHeight)
  const resolvedHeight = Number.isFinite(visualHeight) && visualHeight > 0
    ? visualHeight
    : Number.isFinite(fallbackHeight) && fallbackHeight > 0
      ? fallbackHeight
      : 0
  const rawOffsetTop = Number(visualViewport?.offsetTop)
  const resolvedOffsetTop = Number.isFinite(rawOffsetTop) && rawOffsetTop > 0
    ? rawOffsetTop
    : 0

  return {
    height: Math.round(resolvedHeight),
    offsetTop: Math.round(resolvedOffsetTop),
  }
}
