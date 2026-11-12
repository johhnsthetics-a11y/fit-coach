import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const infoPlist = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8')
const project = readFileSync(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8')

test('iOS declara NSCameraUsageDescription antes de abrir captura pela câmera', () => {
  assert.match(infoPlist, /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/)
  assert.match(infoPlist, /câmera/i)
})

test('Debug e Release do app usam o Info.plist com a justificativa de câmera', () => {
  const appTargetSettings = project.match(/INFOPLIST_FILE = App\/Info\.plist;/g) ?? []
  assert.ok(appTargetSettings.length >= 2, 'o app iOS deve usar App/Info.plist em Debug e Release')
})
