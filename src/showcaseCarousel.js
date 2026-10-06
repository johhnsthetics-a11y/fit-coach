export function swapShowcasePositions(positions, selectedIndex) {
  const centeredIndex = positions.indexOf('center')
  if (centeredIndex < 0 || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= positions.length) return positions
  if (selectedIndex === centeredIndex) return positions

  const nextPositions = [...positions]
  ;[nextPositions[centeredIndex], nextPositions[selectedIndex]] = [
    nextPositions[selectedIndex],
    nextPositions[centeredIndex],
  ]
  return nextPositions
}
