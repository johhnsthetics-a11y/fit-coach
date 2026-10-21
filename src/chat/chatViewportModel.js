export function getChatViewportMetrics({ visualViewport, innerHeight = 0, baselineHeight = 0 } = {}) {
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
  const stableHeight = Number(baselineHeight)
  const referenceHeight = Number.isFinite(stableHeight) && stableHeight > 0
    ? Math.max(stableHeight, fallbackHeight || 0)
    : fallbackHeight
  const keyboardHeight = Number.isFinite(referenceHeight) && referenceHeight > 0
    ? Math.max(Math.round(referenceHeight - resolvedHeight - resolvedOffsetTop), 0)
    : 0

  return {
    height: Math.round(resolvedHeight),
    offsetTop: Math.round(resolvedOffsetTop),
    keyboardHeight,
    keyboardOpen: keyboardHeight >= 120,
  }
}
