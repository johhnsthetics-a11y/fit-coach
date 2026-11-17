import assert from 'node:assert/strict'

export async function assertLightMobileNavigation(page, selector) {
  if (page.viewportSize().width >= 1024) return
  const nav = page.locator(selector)
  await page.waitForTimeout(250)
  const palette = { emerald: 'rgb(8, 125, 108)', lime: 'rgb(77, 124, 15)', orange: 'rgb(194, 65, 12)', sky: 'rgb(3, 105, 161)', cyan: 'rgb(14, 116, 144)' }
  const state = await nav.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    width: el.getBoundingClientRect().width,
    scrollWidth: el.scrollWidth,
    items: [...el.querySelectorAll('button')].map(button => ({
      tone: [...button.classList].find(name => name.startsWith('tone-'))?.slice(5),
      color: getComputedStyle(button).color,
      icon: getComputedStyle(button.querySelector('svg')).color,
      label: getComputedStyle(button.querySelector('span')).color,
      active: button.classList.contains('is-active'),
      background: getComputedStyle(button).backgroundColor,
      height: button.getBoundingClientRect().height,
    })),
  }))
  assert.equal(state.background, 'rgb(255, 255, 255)', 'Menu claro deve ter superfície branca')
  assert.ok(state.scrollWidth <= state.width + 1, 'Menu não deve ultrapassar a viewport')
  for (const item of state.items) {
    assert.ok(palette[item.tone], `Tom não previsto: ${item.tone}`)
    assert.equal(item.color, palette[item.tone], 'Opção deve preservar a cor do módulo com contraste no claro')
    assert.equal(item.icon, item.color)
    assert.equal(item.label, item.color)
    assert.ok(item.height >= 44, 'Área de toque deve ter pelo menos 44px')
    if (!item.active) assert.equal(item.background, 'rgba(0, 0, 0, 0)', 'Opção inativa não deve ter bloco cinza')
  }
}
